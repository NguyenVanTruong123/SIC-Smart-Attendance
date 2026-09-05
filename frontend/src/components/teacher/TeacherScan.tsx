import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Image, Input, Modal, Select, Table, Tag, message } from "antd";
import { CameraOutlined, EditOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { postMultipart } from "@/utils/api";
import { ProtectedImage } from "@/components/common/ProtectedImage";
import { connectSocket, disconnectSocket, joinSession } from "@/utils/socket";
import { statusLabels, type AttendanceStatus, type SessionDetail, type SnapshotMilestone, type TeacherSessionLookup, type WsFaceDetected, type WsFrameCaptured, type WsIntruderAlert, type WsStatUpdate } from "@/types";

interface AttendanceRow {
  studentId: string;
  studentCode: string;
  fullName: string;
  avatarUrl?: string;
  firstDetectedAt?: string;
  matchPercentage?: number;
  status: AttendanceStatus;
}

interface TriggerSnapshotResponse {
  capturedAt: string;
  mode?: "OBSERVE" | "CHECKPOINT" | "FINAL";
  checkpointMinutes?: number;
  detectedFacesCount: number;
  framePreview?: string;
  frameWidth?: number;
  frameHeight?: number;
  faces: WsFrameCaptured["faces"];
  counts?: WsStatUpdate;
}

interface EvidenceSnapshot {
  milestone: string;
  time: string;
  snapshotUrl: string;
}

const CHECKPOINT_SCAN_WINDOW_MS = 60_000;
const CHECKPOINT_SCAN_INTERVAL_MS = 1_000;

function captureVideoFrame(video: HTMLVideoElement) {
  return new Promise<Blob>((resolve, reject) => {
    if (!video.videoWidth || !video.videoHeight) {
      reject(new Error("Camera chưa sẵn sàng."));
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Không tạo được ảnh camera."));
      return;
    }
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không chụp được frame camera.")), "image/jpeg", 0.85);
  });
}

export function TeacherScan({ initialSessionId }: { initialSessionId?: string }) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? "");
  const [sessionInput, setSessionInput] = useState(initialSessionId ?? "");
  const [liveCounts, setLiveCounts] = useState<WsStatUpdate | null>(null);
  const [unknownFaces, setUnknownFaces] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<EvidenceSnapshot[]>([]);
  const [liveFrame, setLiveFrame] = useState<WsFrameCaptured | null>(null);
  const [editing, setEditing] = useState<AttendanceRow | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);
  const [autoStartedSession, setAutoStartedSession] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const captureInFlightRef = useRef(false);
  const confirmedCodesRef = useRef(new Set<string>());

  useEffect(() => {
    setSessionId(initialSessionId ?? "");
    setSessionInput(initialSessionId ?? "");
  }, [initialSessionId]);

  const { data, isLoading, isError } = useQuery<SessionDetail>({
    queryKey: ["teacher-session", sessionId],
    queryFn: () => api.get(`/teacher/sessions/${sessionId}`) as Promise<SessionDetail>,
    enabled: Boolean(sessionId),
    refetchInterval: 15_000,
  });

  const isBrowserCamera = data?.session?.cameraMode === "BROWSER";

  useEffect(() => {
    confirmedCodesRef.current = new Set();
  }, [sessionId]);

  useEffect(() => {
    const status = data?.session?.status;
    const canOpen = isBrowserCamera && ["SCHEDULED", "UPCOMING", "LIVE_NOW", "DEGRADED"].includes(status || "");
    if (!canOpen) {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Thiết bị không hỗ trợ camera hoặc trang chưa chạy HTTPS/localhost.");
      return;
    }
    let cancelled = false;
    setCameraError(null);
    void navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraError("Không thể mở camera. Hãy cấp quyền camera cho trình duyệt."));
    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [data?.session?.status, isBrowserCamera, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const socket = connectSocket();
    joinSession(sessionId);

    const onFaceDetected = (payload: WsFaceDetected) => {
      if (payload.studentCode) confirmedCodesRef.current.add(payload.studentCode);
      queryClient.invalidateQueries({ queryKey: ["teacher-session", sessionId] });
    };
    const onStats = (payload: WsStatUpdate) => setLiveCounts(payload);
    const onFrameCaptured = (payload: WsFrameCaptured) => setLiveFrame(payload);
    const onSnapshot = (payload: SnapshotMilestone) => setSnapshots((current) => [...current, payload]);
    const onIntruder = (payload: WsIntruderAlert) => {
      setUnknownFaces((current) => payload.cropUrl ? [payload.cropUrl, ...current] : current);
      message.warning("Phát hiện người lạ trong lớp học.");
    };

    socket.on("attendance:face_detected", onFaceDetected);
    socket.on("attendance:stat_update", onStats);
    socket.on("attendance:frame_captured", onFrameCaptured);
    socket.on("attendance:snapshot_captured", onSnapshot);
    socket.on("security:intruder_alert", onIntruder);
    return () => {
      socket.off("attendance:face_detected", onFaceDetected);
      socket.off("attendance:stat_update", onStats);
      socket.off("attendance:frame_captured", onFrameCaptured);
      socket.off("attendance:snapshot_captured", onSnapshot);
      socket.off("security:intruder_alert", onIntruder);
      disconnectSocket();
    };
  }, [queryClient, sessionId]);

  const counts = liveCounts ?? data?.counts ?? { total: 0, present: 0, late: 0, absent: 0, truant: 0 };
  const rows = (data?.students ?? []) as AttendanceRow[];

  useEffect(() => {
    setUnknownFaces((data?.unknownFaces ?? []).map((item) => item.cropUrl).filter((url): url is string => Boolean(url)));
  }, [data?.unknownFaces]);

  const startSession = async () => {
    if (!sessionId) return false;
    setActionLoading(true);
    try {
      await api.post(`/teacher/sessions/${sessionId}/start`);
      await queryClient.refetchQueries({ queryKey: ["teacher-session", sessionId] });
      message.success("Đã mở phiên điểm danh.");
      return true;
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "Không thể mở phiên.");
      return false;
    } finally { setActionLoading(false); }
  };

  const loadSession = async () => {
    const value = sessionInput.trim();
    if (!value) return;
    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) {
      setSessionId(value);
      return;
    }
    setActionLoading(true);
    try {
      const matches = await api.get(`/teacher/sessions/resolve?courseCode=${encodeURIComponent(value)}`) as TeacherSessionLookup[];
      const first = matches[0];
      if (!first) throw new Error("Không tìm thấy ca học phù hợp với mã môn hoặc bạn không phụ trách môn này.");
      setSessionId(first.id);
      message.success(`Đã mở ${first.courseCode} · ${first.classCode} · ${first.roomCode}.`);
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "Không tìm thấy ca học.");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (!initialSessionId || initialSessionId !== sessionId || !data?.session || autoStartedSession === sessionId) return;
    if (data.session.status !== "SCHEDULED" && data.session.status !== "UPCOMING") return;
    setAutoStartedSession(sessionId);
    void startSession();
  }, [autoStartedSession, data?.session, initialSessionId, sessionId]);

  const endSession = async () => {
    if (!sessionId) return;
    setActionLoading(true);
    try {
      try {
        if (isBrowserCamera) await captureBrowserFrame("FINAL", true);
        else await api.post(`/teacher/sessions/${sessionId}/trigger-snapshot`, { mode: "FINAL" });
      } catch {
        message.warning("Không lưu được ảnh cuối, phiên vẫn được kết thúc.");
      }
      await api.post(`/teacher/sessions/${sessionId}/end`, { confirmEarly: false });
      queryClient.invalidateQueries({ queryKey: ["teacher-session", sessionId] });
      message.success("Đã kết thúc và chốt điểm danh.");
    }
    catch (cause) { message.warning(cause instanceof Error ? cause.message : "Phiên chưa thể kết thúc."); }
    finally { setActionLoading(false); }
  };

  const captureBrowserFrame = async (mode: "OBSERVE" | "CHECKPOINT" | "FINAL" = "CHECKPOINT", silent = false) => {
    if (!sessionId || !videoRef.current || captureInFlightRef.current) return null;
    captureInFlightRef.current = true;
    try {
      const frame = await captureVideoFrame(videoRef.current);
      const formData = new FormData();
      formData.append("image", frame, "attendance-webcam.jpg");
      formData.append("mode", mode);
      const result = await postMultipart<TriggerSnapshotResponse>(`/teacher/sessions/${sessionId}/trigger-snapshot`, formData);
      result.faces.forEach((face) => {
        if (face.result === "MATCHED" && face.studentCode) confirmedCodesRef.current.add(face.studentCode);
      });
      if (result.counts) setLiveCounts(result.counts);
      setLiveFrame({ capturedAt: result.capturedAt, framePreview: result.framePreview, frameWidth: result.frameWidth, frameHeight: result.frameHeight, faces: result.faces });
      if (result.framePreview && !silent) {
        setSnapshots((current) => [...current, {
          milestone: `Webcam · ${result.detectedFacesCount} khuôn mặt`,
          time: new Date(result.capturedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          snapshotUrl: `data:image/jpeg;base64,${result.framePreview}`,
        }]);
      }
      if (!silent) queryClient.invalidateQueries({ queryKey: ["teacher-session", sessionId] });
      return result;
    } finally {
      captureInFlightRef.current = false;
    }
  };

  const runBrowserCheckpoint = async () => {
    confirmedCodesRef.current = new Set();
    const rosterSize = data?.students.length ?? 0;
    const deadline = Date.now() + CHECKPOINT_SCAN_WINDOW_MS;
    do {
      await captureBrowserFrame("OBSERVE", true);
      if (rosterSize > 0 && confirmedCodesRef.current.size >= rosterSize) break;
      const remaining = deadline - Date.now();
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, Math.min(CHECKPOINT_SCAN_INTERVAL_MS, remaining)));
    } while (Date.now() < deadline);
    return captureBrowserFrame("CHECKPOINT");
  };

  const triggerSnapshot = async () => {
    if (!sessionId) return;
    setActionLoading(true);
    try {
      const result = isBrowserCamera
        ? await runBrowserCheckpoint()
        : await api.post(`/teacher/sessions/${sessionId}/trigger-snapshot`, { mode: "CHECKPOINT" }) as TriggerSnapshotResponse;
      if (!result) return;
      setLiveFrame({ capturedAt: result.capturedAt, framePreview: result.framePreview, frameWidth: result.frameWidth, frameHeight: result.frameHeight, faces: result.faces });
      if (result.framePreview && !isBrowserCamera) {
        setSnapshots((current) => [...current, {
          milestone: `Thủ công · ${result.detectedFacesCount} khuôn mặt`,
          time: new Date(result.capturedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          snapshotUrl: `data:image/jpeg;base64,${result.framePreview}`,
        }]);
      }
      message.success("Đã chốt mốc điểm danh 15 phút.");
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "Không thể chụp ảnh đối soát.");
    } finally {
      setActionLoading(false);
    }
  };

  const runAttendanceNow = async () => {
    if (!sessionId) return;
    const isLive = data?.session?.status === "LIVE_NOW" || data?.session?.status === "DEGRADED";
    if (!isLive) {
      const started = await startSession();
      if (started) await triggerSnapshot();
      return;
    }
    await triggerSnapshot();
  };

  const frameWidth = liveFrame?.frameWidth || 1;
  const frameHeight = liveFrame?.frameHeight || 1;

  const saveOverride = async () => {
    if (!editing) return;
    try {
      await api.put(`/teacher/sessions/${sessionId}/attendance/${editing.studentId}/override`, {
        newStatus: status,
        reason: "Giảng viên hậu kiểm tại lớp",
      });
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["teacher-session", sessionId] });
      message.success("Đã lưu thay đổi điểm danh.");
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "Không thể cập nhật điểm danh.");
    }
  };

  const columns = [
    { title: "Mã SV", dataIndex: "studentCode", key: "studentCode", width: 115 },
    {
      title: "Sinh viên",
      key: "student",
      render: (_: unknown, row: AttendanceRow) => <div className="scan-person">{row.avatarUrl ? <Image preview={false} src={row.avatarUrl} alt="Ảnh sinh viên" /> : null}<span>{row.fullName}</span></div>,
    },
    { title: "Ghi nhận", dataIndex: "firstDetectedAt", key: "firstDetectedAt", width: 125, render: (value?: string) => value ? new Date(value).toLocaleTimeString("vi-VN") : "Chưa ghi nhận" },
    { title: "Điểm khớp", dataIndex: "matchPercentage", key: "matchPercentage", width: 105, render: (value?: number) => value ? `${value}%` : "—" },
    { title: "Trạng thái", dataIndex: "status", key: "status", width: 130, render: (value: AttendanceStatus) => <Tag className={`status-tag-${value}`}>{statusLabels[value]}</Tag> },
    { title: "", key: "edit", width: 80, render: (_: unknown, row: AttendanceRow) => <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(row); setStatus(row.status); }}>Sửa</Button> },
  ];

  return (
    <section aria-labelledby="teacher-scan-title">
      <div className="page-heading">
        <div>
          <h1 id="teacher-scan-title">Điểm danh AI</h1>
          <p>Chỉ sinh viên thuộc lớp học phần mới được ghi nhận. Người ngoài danh sách được giữ là Unknown.</p>
        </div>
      </div>
      <Card className="portal-card scan-session-card">
        <label className="scan-session-label" htmlFor="scan-session-id">Mã ca học hoặc mã môn</label>
        <div className="scan-session-input">
          <Input id="scan-session-id" value={sessionInput} onChange={(event) => setSessionInput(event.target.value)} placeholder="Nhập mã ca học hoặc mã môn, ví dụ AI202" />
          <Button type="primary" onClick={loadSession} loading={actionLoading} disabled={!sessionInput.trim()}>Tải ca học</Button>
          <Button onClick={runAttendanceNow} loading={actionLoading} disabled={!sessionId}>Điểm danh ngay</Button>
          <Button danger onClick={endSession} loading={actionLoading} disabled={!sessionId || (data?.session?.status !== "LIVE_NOW" && data?.session?.status !== "DEGRADED")}>Kết thúc</Button>
        </div>
        {data?.session && <p className="scan-session-caption">{data.session.courseName} · {data.session.roomCode} · {data.session.status}{isBrowserCamera && " · Quét tối đa 1 phút mỗi lần bấm"}</p>}
      </Card>

      {isError && <Alert className="portal-alert" type="warning" showIcon message="Chưa tải được ca học" description="Backend chưa cung cấp endpoint GET /api/v1/teacher/sessions/:id theo tài liệu." />}

      <div className="scan-layout">
        <Card className="portal-card scan-camera-card" title="Camera lớp học">
          {isBrowserCamera || liveFrame?.framePreview ? (
            <div className="scan-camera-frame" aria-label="Ảnh camera có khung nhận diện">
              {isBrowserCamera ? <video ref={videoRef} autoPlay muted playsInline className="scan-camera-video" aria-label="Webcam thiết bị giáo viên" /> : <img src={`data:image/jpeg;base64,${liveFrame?.framePreview}`} alt="Khung hình camera lớp học" />}
              {liveFrame?.faces.map((face, index) => {
                const left = Math.max(0, Math.min(100, (face.bbox.x / frameWidth) * 100));
                const top = Math.max(0, Math.min(100, (face.bbox.y / frameHeight) * 100));
                const width = Math.max(1, Math.min(100 - left, (face.bbox.width / frameWidth) * 100));
                const height = Math.max(1, Math.min(100 - top, (face.bbox.height / frameHeight) * 100));
                const matched = face.result === "MATCHED";
                const label = matched ? face.fullName || face.studentCode || "Đã nhận diện" : "UNKNOWN";
                return <div className={`scan-bbox ${matched ? "is-matched" : "is-unknown"}`} key={`${face.studentCode || face.result}-${index}`} style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}><span>{label} · ${(face.score * 100).toFixed(0)}%</span></div>;
              })}
              {liveFrame && <span className="scan-frame-time">Cập nhật {new Date(liveFrame.capturedAt).toLocaleTimeString("vi-VN")}</span>}
            </div>
          ) : <div className="scan-camera-placeholder"><CameraOutlined /><span>Nhấn “Điểm danh ngay” để chụp và nhận diện lập tức.</span></div>}
          {cameraError && <Alert className="mt-3" type="warning" showIcon message="Không mở được webcam" description={cameraError} />}
          <div className="scan-camera-actions"><Button type="primary" icon={<CameraOutlined />} onClick={runAttendanceNow} loading={actionLoading} disabled={!sessionId}>Điểm danh ngay</Button></div>
        </Card>
        <Card className="portal-card" title="Tình trạng lớp">
          <div className="scan-stat-grid">
            <div><strong>{counts.total}</strong><span>Sĩ số</span></div>
            <div><strong>{counts.present}</strong><span>Có mặt</span></div>
            <div><strong>{counts.late}</strong><span>Đi muộn</span></div>
            <div><strong>{counts.absent + counts.truant}</strong><span>Vắng</span></div>
          </div>
          <div className="unknown-panel"><strong><ExclamationCircleOutlined /> Người lạ: {unknownFaces.length}</strong>{unknownFaces.length ? <div className="unknown-list">{unknownFaces.map((url, index) => <ProtectedImage key={`${url}-${index}`} src={url} alt="Khuôn mặt chưa xác định" />)}</div> : <span>Chưa phát hiện người lạ.</span>}</div>
        </Card>
      </div>

      <Card className="portal-card" title={`Danh sách sinh viên · ${rows.length}`}>
        <Table columns={columns} dataSource={rows} rowKey="studentId" loading={isLoading} pagination={false} scroll={{ x: 780 }} />
      </Card>

      {snapshots.length > 0 && <Card className="portal-card" title="Ảnh đối soát"><div className="snapshot-list">{snapshots.map((snapshot, index) => <article key={`${snapshot.snapshotUrl}-${index}`}><Image src={snapshot.snapshotUrl} alt={`Ảnh ${snapshot.milestone}`} /><span>{snapshot.milestone} · {snapshot.time}</span></article>)}</div></Card>}

      <Modal title={`Sửa điểm danh · ${editing?.fullName ?? ""}`} open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={saveOverride} okText="Lưu" cancelText="Hủy">
        <label className="scan-session-label" htmlFor="attendance-status">Trạng thái</label>
        <Select id="attendance-status" value={status} onChange={setStatus} style={{ width: "100%" }} options={[
          { value: "PRESENT", label: "Đúng giờ" }, { value: "LATE", label: "Đi muộn" }, { value: "ABSENT", label: "Vắng mặt" }, { value: "EXCUSED", label: "Có phép" },
        ]} />
      </Modal>
    </section>
  );
}
