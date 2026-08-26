import { useCallback, useEffect, useState } from "react";
import { Card, Table, Tag, Button, Select, Image, Modal, Form, Input, Alert, Row, Col, Statistic, message, Badge, Typography } from "antd";
import {
  CameraOutlined,
  VideoCameraOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import { connectSocket, joinSession, disconnectSocket } from "@/utils/socket";
import { statusLabels, type AttendanceStatus, type SessionDetail, type WsFaceDetected, type WsStatUpdate, type WsIntruderAlert, type SnapshotMilestone } from "@/types";

const { Text } = Typography;
const { TextArea } = Input;

// =============================================================================
// Teacher: Live Scan — GET /api/v1/teacher/sessions/{id} (§4.1.2)
// WebSocket: attendance:face_detected, attendance:stat_update, etc.
// =============================================================================

export function TeacherScan({ initialSessionId }: { initialSessionId?: string }) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? "");
  const [overrideStudent, setOverrideStudent] = useState<{ studentId: string; fullName: string } | null>(null);
  const [overrideForm] = Form.useForm();
  const [intruderAlert, setIntruderAlert] = useState<WsIntruderAlert | null>(null);
  const [liveCounts, setLiveCounts] = useState<WsStatUpdate | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMilestone[]>([]);
  const queryClient = useQueryClient();

  // Fetch session detail
  const { data, isLoading } = useQuery<SessionDetail>({
    queryKey: ["teacher-session", sessionId],
    queryFn: () => api.get(`/teacher/sessions/${sessionId}`) as Promise<SessionDetail>,
    enabled: !!sessionId,
    refetchInterval: 15000, // poll every 15s as backup
  });

  // WebSocket connection
  useEffect(() => {
    if (!sessionId) return;
    const socket = connectSocket();
    joinSession(sessionId);

    socket.on("attendance:face_detected", (payload: WsFaceDetected) => {
      message.info(`AI nhận diện: ${payload.fullName} (${payload.matchPercentage}%)`);
      queryClient.invalidateQueries({ queryKey: ["teacher-session", sessionId] });
    });

    socket.on("attendance:stat_update", (payload: WsStatUpdate) => {
      setLiveCounts(payload);
    });

    socket.on("attendance:snapshot_captured", (payload: SnapshotMilestone) => {
      setSnapshots((prev) => [...prev, payload]);
    });

    socket.on("security:intruder_alert", (payload: WsIntruderAlert) => {
      setIntruderAlert(payload);
    });

    return () => {
      socket.off("attendance:face_detected");
      socket.off("attendance:stat_update");
      socket.off("attendance:snapshot_captured");
      socket.off("security:intruder_alert");
      disconnectSocket();
    };
  }, [sessionId, queryClient]);

  // Trigger instant snapshot
  const triggerSnapshot = async () => {
    try {
      await api.post(`/teacher/sessions/${sessionId}/trigger-snapshot`);
      message.success("Đã chụp ảnh đối soát toàn lớp!");
      queryClient.invalidateQueries({ queryKey: ["teacher-session", sessionId] });
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Chụp thất bại");
    }
  };

  // Manual override
  const handleOverride = async (values: { newStatus: AttendanceStatus; reason: string }) => {
    if (!overrideStudent) return;
    try {
      await api.put(`/teacher/sessions/${sessionId}/attendance/${overrideStudent.studentId}/override`, values);
      message.success("Đã sửa điểm danh thủ công.");
      setOverrideStudent(null);
      overrideForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["teacher-session", sessionId] });
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Cập nhật thất bại");
    }
  };

  const counts = liveCounts ?? data?.counts ?? { total: 0, present: 0, late: 0, absent: 0, truant: 0 };

  const columns = [
    {
      title: "MSSV",
      dataIndex: "studentCode",
      key: "studentCode",
      width: 100,
      render: (code: string) => <Text strong>{code}</Text>,
    },
    { title: "Họ và tên", dataIndex: "fullName", key: "fullName" },
    {
      title: "Avatar",
      dataIndex: "avatarUrl",
      key: "avatarUrl",
      width: 60,
      render: (url: string) => url ? <Image src={url} width={36} height={36} style={{ borderRadius: "50%", objectFit: "cover" }} /> : "—",
    },
    {
      title: "Nhận diện lúc",
      dataIndex: "firstDetectedAt",
      key: "firstDetectedAt",
      width: 130,
      render: (t: string) => t ? new Date(t).toLocaleTimeString("vi-VN") : "—",
    },
    {
      title: "Match %",
      dataIndex: "matchPercentage",
      key: "matchPercentage",
      width: 90,
      render: (p: number) => p ? <Tag color={p >= 95 ? "success" : p >= 80 ? "warning" : "error"}>{p}%</Tag> : "—",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: AttendanceStatus) => <Tag className={`status-tag-${s}`}>{statusLabels[s]}</Tag>,
    },
    {
      title: "Thao tác",
      key: "action",
      width: 100,
      render: (_: unknown, r: { studentId: string; fullName: string }) => (
        <Button size="small" onClick={() => setOverrideStudent(r)}>Sửa</Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Session Input */}
      <Card size="small">
        <div className="flex items-center gap-4 flex-wrap">
          <Text strong>Session ID:</Text>
          <Input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="Nhập Session ID"
            style={{ width: 280 }}
          />
          {data?.session && (
            <Tag color="red">🔴 {data.session.courseName} · {data.session.roomCode}</Tag>
          )}
        </div>
      </Card>

      {/* Intruder Alert */}
      {intruderAlert && (
        <Alert
          type="error"
          showIcon
          icon={<WarningOutlined />}
          banner
          closable
          onClose={() => setIntruderAlert(null)}
          message="⚠️ CẢNH BÁO: Phát hiện người lạ trong lớp học!"
          description={
            intruderAlert.cropUrl ? (
              <Image src={intruderAlert.cropUrl} width={100} alt="Intruder" />
            ) : undefined
          }
        />
      )}

      {/* Live Stats */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Tổng sĩ số" value={counts.total} /></Card></Col>
        <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Có mặt" value={counts.present} valueStyle={{ color: "#10b981" }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Đi muộn" value={counts.late} valueStyle={{ color: "#d97706" }} /></Card></Col>
        <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Vắng / Bỏ học" value={counts.absent + counts.truant} valueStyle={{ color: "#dc2626" }} /></Card></Col>
      </Row>

      {/* Student Roster */}
      <Card
        title={`Danh sách sinh viên (${data?.students?.length ?? 0})`}
        extra={
          <Button type="primary" icon={<CameraOutlined />} onClick={triggerSnapshot} disabled={!sessionId}>
            Chụp đối soát ngay
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={data?.students ?? []}
          rowKey="studentId"
          loading={isLoading}
          pagination={false}
          size="middle"
        />
      </Card>

      {/* Snapshot Milestones */}
      {snapshots.length > 0 && (
        <Card title="Ảnh Snapshot đối soát chu kỳ">
          <div className="flex gap-4 flex-wrap">
            {snapshots.map((snap, i) => (
              <Card key={i} size="small" style={{ width: 180 }}>
                <Image src={snap.snapshotUrl} width="100%" alt={`Snapshot ${snap.milestone}`} />
                <div className="mt-2">
                  <Tag>{snap.milestone}</Tag>
                  <Text type="secondary" className="text-xs">{snap.time}</Text>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Override Modal */}
      <Modal
        title={`Sửa điểm danh: ${overrideStudent?.fullName ?? ""}`}
        open={!!overrideStudent}
        onCancel={() => setOverrideStudent(null)}
        footer={null}
      >
        <Form form={overrideForm} layout="vertical" onFinish={handleOverride}>
          <Form.Item name="newStatus" label="Trạng thái mới" rules={[{ required: true }]}>
            <Select placeholder="Chọn trạng thái">
              <Select.Option value="PRESENT">Đúng giờ</Select.Option>
              <Select.Option value="LATE">Đi muộn</Select.Option>
              <Select.Option value="ABSENT">Vắng mặt</Select.Option>
              <Select.Option value="EXCUSED">Nghỉ có phép</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="Lý do giải trình" rules={[{ required: true, message: "Bắt buộc nhập lý do" }]}>
            <TextArea rows={2} placeholder="VD: Sinh viên có mặt thực tế, bị lỗi camera góc khuất" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Xác nhận sửa điểm danh
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
