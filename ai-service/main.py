from __future__ import annotations

import base64
import hmac
import os
import re
import shutil
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Annotated

import cv2
import numpy as np
import torch
from facenet_pytorch import InceptionResnetV1, MTCNN, fixed_image_standardization
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel, Field
from torchvision import transforms
from ultralytics import YOLO

APP_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("AI_DATA_DIR", APP_DIR / "data"))
GALLERY_PATH = DATA_DIR / "gallery.npz"
CROP_DIR = DATA_DIR / "enrollment_crops"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
TRANSFORM = transforms.Compose(
    [transforms.Resize((160, 160)), transforms.ToTensor(), fixed_image_standardization]
)
FACE_TEMPLATE = np.float32(
    [[54.7, 73.9], [105.0, 73.6], [80.0, 102.5], [59.4, 132.0], [101.0, 131.7]]
)


class RosterMember(BaseModel):
    studentId: str = Field(min_length=1, max_length=50)


class RosterPolicy(BaseModel):
    acceptThreshold: float = Field(default=0.6, ge=-1, le=1)
    ambiguityMargin: float = Field(default=0.05, ge=0, le=1)


class RosterRequest(BaseModel):
    rosterVersion: str = Field(min_length=1, max_length=100)
    members: list[RosterMember] = Field(min_length=1)
    policy: RosterPolicy = Field(default_factory=RosterPolicy)


class CaptureRequest(BaseModel):
    rtspUrl: str = Field(min_length=8, max_length=500)


@dataclass
class Roster:
    version: str
    student_ids: list[str]
    embeddings: np.ndarray
    policy: RosterPolicy


ROSTERS: dict[str, Roster] = {}
app = FastAPI(title="SPAS AI Service", version="1.0.0")


def model_path(env_name: str, filename: str) -> Path:
    configured = os.getenv(env_name)
    candidates = [Path(configured)] if configured else []
    candidates.extend([APP_DIR / "models" / filename, Path.home() / "Downloads" / filename])
    return next((candidate for candidate in candidates if candidate.is_file()), Path(filename))


def require_internal_key(
    x_ai_service_key: Annotated[str | None, Header()] = None,
) -> None:
    expected = os.getenv("AI_SERVICE_KEY")
    if not expected:
        raise HTTPException(503, "AI_SERVICE_KEY is not configured.")
    if not x_ai_service_key or not hmac.compare_digest(x_ai_service_key, expected):
        raise HTTPException(401, "Invalid AI service credential.")


@app.get("/health")
def health() -> dict[str, str | bool]:
    detector = model_path("FACE_DETECTOR_PATH", "face_best.pt")
    recognizer = model_path("FACE_RECOGNITION_PATH", "facenet_best.pt")
    return {
        "status": "ok" if detector.is_file() and recognizer.is_file() else "degraded",
        "device": str(DEVICE),
        "detectorLoaded": detector.is_file(),
        "recognizerLoaded": recognizer.is_file(),
    }


@lru_cache
def models() -> tuple[YOLO, InceptionResnetV1]:
    detector_path = model_path("FACE_DETECTOR_PATH", "face_best.pt")
    recognizer_path = model_path("FACE_RECOGNITION_PATH", "facenet_best.pt")
    if not detector_path.is_file() or not recognizer_path.is_file():
        raise HTTPException(503, "Face model files are unavailable.")
    detector = YOLO(str(detector_path))
    checkpoint = torch.load(recognizer_path, map_location=DEVICE, weights_only=True)
    recognizer = InceptionResnetV1(classify=False, pretrained=None, num_classes=8631)
    recognizer.load_state_dict(checkpoint["state_dict"], strict=False)
    return detector, recognizer.eval().to(DEVICE)


@lru_cache
def landmark_model() -> MTCNN:
    return MTCNN(keep_all=False, device=DEVICE)


def safe_student_id(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "", value)[:50]


def decode(data: bytes) -> np.ndarray:
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(422, "Invalid camera image.")
    return image


def base64_jpeg(image_bgr: np.ndarray) -> str:
    success, encoded = cv2.imencode(".jpg", image_bgr)
    if not success:
        raise HTTPException(500, "Cannot encode evidence crop.")
    return base64.b64encode(encoded).decode("ascii")


def l2_normalize(vector: np.ndarray) -> np.ndarray:
    magnitude = np.linalg.norm(vector)
    if magnitude <= 0:
        raise HTTPException(422, "Invalid face embedding.")
    return vector / magnitude


def face_boxes(image_bgr: np.ndarray) -> list[tuple[int, int, int, int]]:
    detector, _ = models()
    result = detector(image_bgr, imgsz=640, conf=0.35, verbose=False)[0]
    if result.boxes is None:
        return []
    return [tuple(map(int, box)) for box in result.boxes.xyxy.cpu().numpy()]


def crop(image_bgr: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    x1, y1, x2, y2 = box
    height, width = image_bgr.shape[:2]
    margin_x, margin_y = int((x2 - x1) * 0.2), int((y2 - y1) * 0.2)
    return image_bgr[max(0, y1 - margin_y) : min(height, y2 + margin_y), max(0, x1 - margin_x) : min(width, x2 + margin_x)]


def align_face(face_bgr: np.ndarray) -> np.ndarray:
    rotations = [None, cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_90_COUNTERCLOCKWISE, cv2.ROTATE_180]
    detector = landmark_model()
    best_candidate: np.ndarray | None = None
    best_landmarks: np.ndarray | None = None
    best_probability = -1.0
    for rotation in rotations:
        candidate = face_bgr if rotation is None else cv2.rotate(face_bgr, rotation)
        _, probabilities, landmarks = detector.detect(
            Image.fromarray(cv2.cvtColor(candidate, cv2.COLOR_BGR2RGB)), landmarks=True
        )
        if landmarks is None or probabilities is None or probabilities[0] is None:
            continue
        probability = float(probabilities[0])
        if probability > best_probability:
            best_candidate, best_landmarks, best_probability = candidate, landmarks[0], probability
    if best_candidate is None or best_landmarks is None:
        return face_bgr
    matrix, _ = cv2.estimateAffinePartial2D(best_landmarks.astype(np.float32), FACE_TEMPLATE, method=cv2.LMEDS)
    if matrix is None:
        return best_candidate
    return cv2.warpAffine(best_candidate, matrix, (160, 160), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def face_pose(face_bgr: np.ndarray) -> tuple[str, float]:
    _, probabilities, landmarks = landmark_model().detect(
        Image.fromarray(cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)), landmarks=True
    )
    if landmarks is None or probabilities is None or probabilities[0] is None:
        return "unknown", 0.0
    left_eye, right_eye, nose = landmarks[0][:3].astype(np.float32)
    eye_width = float(right_eye[0] - left_eye[0])
    if eye_width <= 1:
        return "unknown", 0.0
    nose_ratio = float((nose[0] - left_eye[0]) / eye_width)
    pose = "left" if nose_ratio < 0.40 else "right" if nose_ratio > 0.60 else "front"
    return pose, float(probabilities[0])


@app.post("/internal/v1/pose", dependencies=[Depends(require_internal_key)])
async def detect_pose(image: Annotated[UploadFile, File()]) -> dict:
    frame = decode(await image.read())
    boxes = face_boxes(frame)
    if len(boxes) != 1:
        return {"pose": "unknown", "confidence": 0.0, "faceCount": len(boxes)}
    box = boxes[0]
    face = crop(frame, box)
    if min(face.shape[:2]) < 80:
        return {"pose": "unknown", "confidence": 0.0, "faceCount": 1}
    pose, confidence = face_pose(face)
    return {
        "pose": pose,
        "confidence": confidence,
        "faceCount": 1,
        "bbox": {"x": box[0], "y": box[1], "width": box[2] - box[0], "height": box[3] - box[1]},
    }


def embedding(face_bgr: np.ndarray) -> np.ndarray:
    _, recognizer = models()
    aligned = align_face(face_bgr)
    face_rgb = cv2.cvtColor(aligned, cv2.COLOR_BGR2RGB)
    pixels = TRANSFORM(Image.fromarray(face_rgb)).unsqueeze(0).to(DEVICE)
    with torch.inference_mode():
        vector = torch.nn.functional.normalize(recognizer(pixels), dim=1)[0]
    return vector.cpu().numpy()


def load_gallery() -> tuple[list[str], np.ndarray]:
    if not GALLERY_PATH.is_file():
        return [], np.empty((0, 512), dtype=np.float32)
    with np.load(GALLERY_PATH, allow_pickle=False) as data:
        return data["student_ids"].tolist(), data["embeddings"].astype(np.float32)


def save_gallery(student_id: str, vectors: list[np.ndarray]) -> None:
    student_ids, embeddings = load_gallery()
    vector = l2_normalize(np.mean(vectors, axis=0)).astype(np.float32)
    if student_id in student_ids:
        embeddings[student_ids.index(student_id)] = vector
    else:
        student_ids.append(student_id)
        embeddings = np.vstack([embeddings, vector])
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    np.savez(GALLERY_PATH, student_ids=np.asarray(student_ids), embeddings=embeddings)


def remove_gallery_person(student_id: str) -> None:
    student_ids, embeddings = load_gallery()
    kept = [index for index, value in enumerate(student_ids) if value != student_id]
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    np.savez(
        GALLERY_PATH,
        student_ids=np.asarray([student_ids[index] for index in kept]),
        embeddings=embeddings[kept] if kept else np.empty((0, 512), dtype=np.float32),
    )


def enrollment_crops(frames: list[np.ndarray]) -> list[np.ndarray]:
    candidates: list[np.ndarray] = []
    for frame in frames:
        boxes = face_boxes(frame)
        if len(boxes) != 1:
            continue
        face = crop(frame, boxes[0])
        if min(face.shape[:2]) >= 80:
            candidates.append(face)
    if len(candidates) > 8:
        indexes = np.linspace(0, len(candidates) - 1, 8, dtype=int)
        return [candidates[index] for index in indexes]
    return candidates


@app.post("/internal/v1/enrollments", dependencies=[Depends(require_internal_key)])
async def enroll(
    student_id: Annotated[str, Form()],
    frames: Annotated[list[UploadFile], File()],
) -> dict:
    student_id = safe_student_id(student_id)
    if not student_id or len(frames) < 3:
        raise HTTPException(422, "student_id and at least three frames are required.")
    face_crops = enrollment_crops([decode(await frame.read()) for frame in frames])
    if len(face_crops) < 5:
        raise HTTPException(422, "At least five clear frames with exactly one face are required.")
    poses = {face_pose(face)[0] for face in face_crops}
    if not {"front", "left", "right"}.issubset(poses):
        raise HTTPException(422, "Enrollment requires front, left and right poses.")
    vectors = [embedding(face) for face in face_crops]
    candidate = l2_normalize(np.mean(vectors, axis=0))
    existing_ids, gallery = load_gallery()
    if existing_ids:
        scores = gallery @ candidate
        index = int(scores.argmax())
        if existing_ids[index] != student_id and float(scores[index]) >= 0.60:
            raise HTTPException(409, "Face is already enrolled for another account.")
    save_gallery(student_id, vectors)
    output_dir = CROP_DIR / student_id
    output_dir.mkdir(parents=True, exist_ok=True)
    for index, face in enumerate(face_crops, 1):
        cv2.imwrite(str(output_dir / f"face_{index:02d}.jpg"), face)
    return {
        "studentId": student_id,
        "embeddingDimension": 512,
        "acceptedFrames": len(face_crops),
        "preview": base64_jpeg(face_crops[0]),
    }


@app.delete("/internal/v1/enrollments/{student_id}", dependencies=[Depends(require_internal_key)])
def reset_enrollment(student_id: str) -> dict:
    student_id = safe_student_id(student_id)
    if not student_id:
        raise HTTPException(422, "Invalid student_id.")
    remove_gallery_person(student_id)
    shutil.rmtree(CROP_DIR / student_id, ignore_errors=True)
    return {"studentId": student_id, "reset": True}


@app.put("/internal/v1/attendance-sessions/{session_id}/roster", dependencies=[Depends(require_internal_key)])
def load_roster(session_id: str, request: RosterRequest) -> dict:
    ids, gallery = load_gallery()
    positions = {student_id: index for index, student_id in enumerate(ids)}
    student_ids = [member.studentId for member in request.members if member.studentId in positions]
    if not student_ids:
        raise HTTPException(422, "No enrolled roster member is available for this session.")
    matrix = np.vstack([gallery[positions[student_id]] for student_id in student_ids]).astype(np.float32)
    ROSTERS[session_id] = Roster(request.rosterVersion, student_ids, matrix, request.policy)
    return {"sessionId": session_id, "rosterVersion": request.rosterVersion, "loadedMembers": len(student_ids)}


@app.delete("/internal/v1/attendance-sessions/{session_id}/roster", dependencies=[Depends(require_internal_key)])
def unload_roster(session_id: str) -> dict:
    ROSTERS.pop(session_id, None)
    return {"sessionId": session_id, "unloaded": True}


def recognize_frame(session_id: str, frame: np.ndarray) -> dict:
    roster = ROSTERS.get(session_id)
    if roster is None:
        raise HTTPException(409, "Roster is not loaded for this session.")
    results: list[dict] = []
    for index, box in enumerate(face_boxes(frame)):
        face = crop(frame, box)
        if min(face.shape[:2]) < 80:
            continue
        vector = embedding(face)
        pose, _ = face_pose(face)
        scores = roster.embeddings @ vector
        ranking = np.argsort(scores)[::-1]
        winner_index = int(ranking[0])
        score = float(scores[winner_index])
        runner_up = float(scores[int(ranking[1])]) if len(ranking) > 1 else -1.0
        result = "MATCHED"
        if score < roster.policy.acceptThreshold:
            result = "UNKNOWN_PERSON"
        elif score - runner_up < roster.policy.ambiguityMargin:
            result = "AMBIGUOUS"
        payload = {
            "faceIndex": index,
            "bbox": {"x": box[0], "y": box[1], "width": box[2] - box[0], "height": box[3] - box[1]},
            "quality": min(1.0, min(face.shape[:2]) / 160),
            "pose": pose,
            "result": result,
            "score": score,
            "runnerUpScore": runner_up,
            "evidenceCrop": base64_jpeg(face),
        }
        if result == "MATCHED":
            payload["studentId"] = roster.student_ids[winner_index]
        results.append(payload)
    return {
        "sessionId": session_id,
        "rosterVersion": roster.version,
        "faces": results,
        "framePreview": base64_jpeg(frame),
        "frameWidth": int(frame.shape[1]),
        "frameHeight": int(frame.shape[0]),
    }


@app.post("/internal/v1/attendance-sessions/{session_id}/recognitions", dependencies=[Depends(require_internal_key)])
async def recognize_roster(session_id: str, image: Annotated[UploadFile, File()]) -> dict:
    return recognize_frame(session_id, decode(await image.read()))


@app.post("/internal/v1/attendance-sessions/{session_id}/capture", dependencies=[Depends(require_internal_key)])
def capture_rtsp(session_id: str, request: CaptureRequest) -> dict:
    capture = cv2.VideoCapture(request.rtspUrl)
    try:
        success, frame = capture.read()
    finally:
        capture.release()
    if not success or frame is None:
        raise HTTPException(503, "Camera RTSP frame is unavailable.")
    return recognize_frame(session_id, frame)
