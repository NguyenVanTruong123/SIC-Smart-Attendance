import { useEffect, useState } from "react";
import { Alert, Button, Card, Image, Input, Modal, Select, Table, Tag, message } from "antd";
import { CameraOutlined, EditOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import { connectSocket, disconnectSocket, joinSession } from "@/utils/socket";
import { statusLabels, type AttendanceStatus, type SessionDetail, type SnapshotMilestone, type WsFaceDetected, type WsIntruderAlert, type WsStatUpdate } from "@/types";

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
  snapshotUrl: string;
  capturedAt: string;
  detectedFacesCount: number;
}

interface EvidenceSnapshot {
  milestone: string;
  time: string;
  snapshotUrl: string;
}

export function TeacherScan({ initialSessionId }: { initialSessionId?: string }) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? "");
  const [liveCounts, setLiveCounts] = useState<WsStatUpdate | null>(null);
  const [unknownFaces, setUnknownFaces] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<EvidenceSnapshot[]>([]);
  const [editing, setEditing] = useState<AttendanceRow | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setSessionId(initialSessionId ?? "");
  }, [initialSessionId]);

  const { data, isLoading, isError } = useQuery<SessionDetail>({
    queryKey: ["teacher-session", sessionId],
    queryFn: () => api.get(`/teacher/sessions/${sessionId}`) as Promise<SessionDetail>,
    enabled: Boolean(sessionId),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!sessionId) return;
    const socket = connectSocket();
    joinSession(sessionId);

    const onFaceDetected = (_payload: WsFaceDetected) => queryClient.invalidateQueries({ queryKey: ["teacher-session", sessionId] });
    const onStats = (payload: WsStatUpdate) => setLiveCounts(payload);
    const onSnapshot = (payload: SnapshotMilestone) => setSnapshots((current) => [...current, payload]);
    const onIntruder = (payload: WsIntruderAlert) => {
      setUnknownFaces((current) => payload.cropUrl ? [payload.cropUrl, ...current] : current);
      message.warning("Phát hiện người lạ trong lớp học.");
    };

    socket.on("attendance:face_detected", onFaceDetected);
    socket.on("attendance:stat_update", onStats);
    socket.on("attendance:snapshot_captured", onSnapshot);
    socket.on("security:intruder_alert", onIntruder);
    return () => {
      socket.off("attendance:face_detected", onFaceDetected);
      socket.off("attendance:stat_update", onStats);
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
    if (!sessionId) return;
    setActionLoading(true);
    try { await api.post(`/teacher/sessions/${sessionId}/start`); queryClient.invalidateQueries({ queryKey: ["teacher-session", sessionId] }); message.success("Đã mở phiên; hệ thống bắt đầu quét tự động."); }
    catch (cause) { message.error(cause instanceof Error ? cause.message : "Không thể mở phiên."); }
    finally { setActionLoading(false); }
  };

  const endSession = async () => {
    if (!sessionId) return;
    setActionLoading(true);
    try { await api.post(`/teacher/sessions/${sessionId}/end`, { confirmEarly: false }); queryClient.invalidateQueries({ queryKey: ["teacher-session", sessionId] }); message.success("Đã kết thúc và chốt điểm danh."); }
    catch (cause) { message.warning(cause instanceof Error ? cause.message : "Phiên chưa thể kết thúc."); }
    finally { setActionLoading(false); }
  };

  const triggerSnapshot = async () => {
    if (!sessionId) return;
    try {
      const result = await api.post(`/teacher/sessions/${sessionId}/trigger-snapshot`) as TriggerSnapshotResponse;
      setSnapshots((current) => [...current, {
        milestone: `Thủ công · ${result.detectedFacesCount} khuôn mặt`,
        time: new Date(result.capturedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        snapshotUrl: result.snapshotUrl,
      }]);
      message.success("Đã yêu cầu chụp ảnh đối soát.");
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "Không thể chụp ảnh đối soát.");
    }
  };

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
        <label className="scan-session-label" htmlFor="scan-session-id">Mã ca học</label>
        <div className="scan-session-input">
          <Input id="scan-session-id" value={sessionId} onChange={(event) => setSessionId(event.target.value)} placeholder="Chọn lớp từ trang Lớp giảng dạy hoặc nhập mã ca học" />
          <Button type="primary" onClick={() => queryClient.invalidateQueries({ queryKey: ["teacher-session", sessionId] })} disabled={!sessionId}>Tải ca học</Button>
          <Button onClick={startSession} loading={actionLoading} disabled={!sessionId || data?.session?.status === "LIVE_NOW"}>Mở phiên</Button>
          <Button danger onClick={endSession} loading={actionLoading} disabled={!sessionId || (data?.session?.status !== "LIVE_NOW" && data?.session?.status !== "DEGRADED")}>Kết thúc</Button>
        </div>
        {data?.session && <p className="scan-session-caption">{data.session.courseName} · {data.session.roomCode} · {data.session.status}</p>}
      </Card>

      {isError && <Alert className="portal-alert" type="warning" showIcon message="Chưa tải được ca học" description="Backend chưa cung cấp endpoint GET /api/v1/teacher/sessions/:id theo tài liệu." />}

      <div className="scan-layout">
        <Card className="portal-card scan-camera-card" title="Camera lớp học">
          <div className="scan-camera-placeholder"><CameraOutlined /><span>Luồng camera sẽ do Gateway cấp cho phiên học đang mở.</span></div>
          <div className="scan-camera-actions"><Button type="primary" icon={<CameraOutlined />} onClick={triggerSnapshot} disabled={!sessionId}>Chụp đối soát</Button></div>
        </Card>
        <Card className="portal-card" title="Tình trạng lớp">
          <div className="scan-stat-grid">
            <div><strong>{counts.total}</strong><span>Sĩ số</span></div>
            <div><strong>{counts.present}</strong><span>Có mặt</span></div>
            <div><strong>{counts.late}</strong><span>Đi muộn</span></div>
            <div><strong>{counts.absent + counts.truant}</strong><span>Vắng</span></div>
          </div>
          <div className="unknown-panel"><strong><ExclamationCircleOutlined /> Người lạ: {unknownFaces.length}</strong>{unknownFaces.length ? <div className="unknown-list">{unknownFaces.map((url, index) => <Image key={`${url}-${index}`} src={url} alt="Khuôn mặt chưa xác định" />)}</div> : <span>Chưa phát hiện người lạ.</span>}</div>
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
