import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Alert, Button, Card, Progress, Result, Tag, message } from "antd";
import {
  CheckCircleOutlined,
  LeftOutlined,
  RightOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import api from "@/utils/api";
import type { EkycEnrollResponse, PoseDetection, User } from "@/types";
import { useAuthStore } from "@/stores/authStore";
import { StudentBiometricProfile } from "@/components/student/StudentBiometricProfile";

type Pose = "front" | "left" | "right";

const REQUIRED_FRAMES_PER_POSE = 2;
const MAX_ATTEMPTS_PER_POSE = 30;
const MIN_POSE_CONFIDENCE = 0.55;

const poseSteps: Array<{ pose: Pose; label: string; icon: ReactNode }> = [
  { pose: "front", label: "Nhìn thẳng vào camera", icon: <UserOutlined /> },
  { pose: "left", label: "Quay mặt sang trái", icon: <LeftOutlined /> },
  { pose: "right", label: "Quay mặt sang phải", icon: <RightOutlined /> },
  { pose: "front", label: "Nhìn thẳng lần cuối", icon: <UserOutlined /> },
];

const poseLabels: Record<Pose | "unknown", string> = {
  front: "nhìn thẳng",
  left: "quay trái",
  right: "quay phải",
  unknown: "chưa xác định",
};

export function Enrollment() {
  const user = useAuthStore((state) => state.user)!;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState<Blob[]>([]);
  const [poseStep, setPoseStep] = useState(0);
  const [poseFrameCount, setPoseFrameCount] = useState(0);
  const [acceptedFrameCount, setAcceptedFrameCount] = useState(0);
  const [observedPose, setObservedPose] = useState<Pose | "unknown">("unknown");
  const [poseConfidence, setPoseConfidence] = useState(0);
  const [poseMessage, setPoseMessage] = useState("Bấm bắt đầu để hệ thống theo dõi tư thế.");
  const [enrolled, setEnrolled] = useState(user.isFaceEnrolled);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setRecording(false);
  }, []);

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      message.error("Trình duyệt không hỗ trợ camera. Hãy dùng HTTPS hoặc localhost.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCapturedFrames([]);
      setAcceptedFrameCount(0);
      setPoseStep(0);
      setPoseFrameCount(0);
      setObservedPose("unknown");
      setPoseConfidence(0);
      setPoseMessage("Camera sẵn sàng. Bấm bắt đầu để theo dõi.");
      setCameraActive(true);
    } catch {
      message.error("Không thể mở camera. Hãy kiểm tra quyền truy cập camera.");
    }
  };

  const startRecording = () => {
    if (!videoRef.current?.videoWidth || !canvasRef.current) {
      message.error("Camera chưa sẵn sàng.");
      return;
    }

    const capture = () => new Promise<Blob>((resolve, reject) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) {
        reject(new Error("Camera không sẵn sàng."));
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Không thể chụp frame."));
        return;
      }

      context.save();
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0);
      context.restore();
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không thể chụp frame.")), "image/jpeg", 0.9);
    });

    const detectPose = async (frame: Blob) => {
      const formData = new FormData();
      formData.append("frame", frame, "pose.jpg");
      return (await api.post("/ekyc/pose", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })) as unknown as PoseDetection;
    };

    const captureSequence = async () => {
      setCapturedFrames([]);
      setAcceptedFrameCount(0);
      setPoseStep(0);
      setPoseFrameCount(0);
      setRecording(true);
      const frames: Blob[] = [];

      try {
        for (let stepIndex = 0; stepIndex < poseSteps.length; stepIndex += 1) {
          const target = poseSteps[stepIndex];
          let acceptedForPose = 0;
          setPoseStep(stepIndex);
          setPoseFrameCount(0);
          setPoseMessage(`Đưa mặt về tư thế: ${target.label}.`);

          for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_POSE && acceptedForPose < REQUIRED_FRAMES_PER_POSE; attempt += 1) {
            const frame = await capture();
            const detection = await detectPose(frame);
            const detectedPose = detection.pose === "front" || detection.pose === "left" || detection.pose === "right"
              ? detection.pose
              : "unknown";
            setObservedPose(detectedPose);
            setPoseConfidence(detection.confidence);

            if (detection.faceCount !== 1) {
              setPoseMessage(detection.faceCount === 0 ? "Chưa thấy khuôn mặt, hãy vào giữa khung." : "Chỉ để một khuôn mặt trong khung.");
            } else if (detectedPose !== target.pose || detection.confidence < MIN_POSE_CONFIDENCE) {
              setPoseMessage(`Đang thấy ${poseLabels[detectedPose]}. ${target.label}.`);
            } else {
              frames.push(frame);
              acceptedForPose += 1;
              setAcceptedFrameCount(frames.length);
              setPoseFrameCount(acceptedForPose);
              setPoseMessage(`Đã chụp ${acceptedForPose}/${REQUIRED_FRAMES_PER_POSE} ảnh cho tư thế này.`);
              if (acceptedForPose < REQUIRED_FRAMES_PER_POSE) await new Promise((resolve) => window.setTimeout(resolve, 500));
              continue;
            }

            await new Promise((resolve) => window.setTimeout(resolve, 350));
          }

          if (acceptedForPose < REQUIRED_FRAMES_PER_POSE) {
            throw new Error(`Chưa ghi nhận đủ tư thế: ${target.label}. Hãy thử lại.`);
          }
        }

        setPoseStep(poseSteps.length);
        setPoseFrameCount(REQUIRED_FRAMES_PER_POSE);
        setCapturedFrames(frames);
        setPoseMessage("Đã đủ bốn bước. Kiểm tra rồi gửi xác thực.");
      } catch (error) {
        setCapturedFrames([]);
        setAcceptedFrameCount(0);
        message.error(error instanceof Error ? error.message : "Không thể ghi nhận ảnh eKYC.");
      } finally {
        setRecording(false);
      }
    };

    void captureSequence();
  };

  const submitFrames = async () => {
    if (!capturedFrames.length) return;
    setSubmitting(true);

    try {
      const formData = new FormData();
      capturedFrames.forEach((frame, index) => formData.append("frames", frame, `face-${index + 1}.jpg`));
      const result = (await api.post("/ekyc/enroll-initial", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })) as unknown as EkycEnrollResponse;

      const refreshedUser = (await api.get("/auth/me")) as unknown as User;
      useAuthStore.getState().setUser({ ...refreshedUser, isFaceEnrolled: result.isFaceEnrolled });
      setEnrolled(result.isFaceEnrolled);
      stopCamera();
      message.success("Đăng ký khuôn mặt thành công.");
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "Đăng ký khuôn mặt thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => () => stopCamera(), [stopCamera]);

  if (enrolled) {
    return (
      <section className="enrollment-page" aria-labelledby="enrollment-title">
        <Card className="portal-card">
          <Result
            status="success"
            icon={<CheckCircleOutlined />}
            title="Bạn đã đăng ký khuôn mặt"
            subTitle="Hồ sơ đang được dùng cho các phiên điểm danh thuộc lớp học phần của bạn."
            extra={<Tag color="success">Đã đăng ký</Tag>}
          />
        </Card>
        <StudentBiometricProfile />
      </section>
    );
  }

  const currentPose = poseSteps[Math.min(poseStep, poseSteps.length - 1)];
  const sequenceComplete = capturedFrames.length > 0;
  const progress = Math.round(((poseStep * REQUIRED_FRAMES_PER_POSE + poseFrameCount) / (poseSteps.length * REQUIRED_FRAMES_PER_POSE)) * 100);

  return (
    <section className="enrollment-page" aria-labelledby="enrollment-title">
      <div className="page-heading">
        <div>
          <h1 id="enrollment-title">Đăng ký khuôn mặt</h1>
          <p>AI chỉ chụp khi nhận đúng tư thế theo thứ tự hướng dẫn.</p>
        </div>
        <Tag color="processing">eKYC lần đầu</Tag>
      </div>

      <Card className="portal-card enrollment-card">
        <div className="enrollment-layout">
          <div className="camera-panel">
            <video ref={videoRef} autoPlay muted playsInline className="camera-preview" />
            <canvas ref={canvasRef} hidden />
            {!cameraActive && <div className="camera-placeholder">Camera đang tắt</div>}
            {cameraActive && (
              <div className="face-guide" aria-hidden="true">
                <div className="face-guide-oval" />
              </div>
            )}
            {recording && <span className="recording-badge">● Đang theo dõi</span>}
          </div>

          <div className="enrollment-instructions">
            <h2>Hướng dẫn thực hiện</h2>
            <div className={`pose-cue ${sequenceComplete ? "complete" : ""}`} aria-live="polite">
              <span>{sequenceComplete ? <CheckCircleOutlined /> : currentPose.icon}</span>
              <div>
                <strong>{sequenceComplete ? "Đã hoàn tất tracking" : currentPose.label}</strong>
                <small>{recording ? `${poseMessage} (${poseLabels[observedPose]}, ${(poseConfidence * 100).toFixed(0)}%)` : poseMessage}</small>
              </div>
            </div>
            <ol className="pose-list">
              {poseSteps.map((step, index) => {
                const active = recording && poseStep === index;
                const completed = sequenceComplete || (recording && poseStep > index);
                return (
                  <li className={active ? "active" : completed ? "complete" : ""} key={`${step.pose}-${index}`}>
                    <span>{completed ? <CheckCircleOutlined /> : step.icon}</span>
                    <div>
                      <strong>{index + 1}. {step.label}</strong>
                      <small>{active ? `Đã chụp ${poseFrameCount}/${REQUIRED_FRAMES_PER_POSE}` : completed ? "Đã ghi nhận" : "Chờ đến lượt"}</small>
                    </div>
                  </li>
                );
              })}
            </ol>
            {(recording || sequenceComplete) && (
              <div className="recording-progress">
                <strong>{acceptedFrameCount}/{poseSteps.length * REQUIRED_FRAMES_PER_POSE} frame hợp lệ</strong>
                <Progress percent={sequenceComplete ? 100 : progress} showInfo={false} strokeColor="#a10000" />
              </div>
            )}
          </div>
        </div>

        <div className="enrollment-actions">
          <Button icon={<VideoCameraOutlined />} onClick={cameraActive ? stopCamera : startCamera} disabled={recording || submitting}>
            {cameraActive ? "Tắt camera" : "Bật camera"}
          </Button>
          {cameraActive && !recording && !capturedFrames.length && (
            <Button type="primary" onClick={startRecording} disabled={submitting}>
              Bắt đầu tracking
            </Button>
          )}
          {!!capturedFrames.length && (
            <Button type="primary" onClick={submitFrames} loading={submitting}>
              {submitting ? "Đang xác thực..." : "Gửi xác thực"}
            </Button>
          )}
        </div>
        <Alert
          className="enrollment-note"
          type="info"
          showIcon
          message={capturedFrames.length ? "Đã ghi nhận đủ 8 frame đúng tư thế. Gửi xác thực để hoàn tất." : "Mỗi tư thế cần 2 frame đúng hướng; frame sai, thiếu mặt hoặc có nhiều mặt sẽ bị bỏ qua."}
        />
      </Card>
    </section>
  );
}
