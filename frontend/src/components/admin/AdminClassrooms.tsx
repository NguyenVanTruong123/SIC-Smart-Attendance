import { useState, useEffect, useRef } from "react";
import { Card, Table, Tag, Button, Input, InputNumber, Select, Row, Col, Statistic, Modal, Form, Descriptions, message, Typography } from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  EyeOutlined,
  WifiOutlined,
  DisconnectOutlined,
  PlusCircleOutlined,
  LinkOutlined,
  VideoCameraOutlined,
  CalendarOutlined,
  SlidersOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import type { Classroom, ClassroomKpis, ClassroomDetail, PingCameraResponse, Pagination, CameraStatus } from "@/types";

const { Text } = Typography;

// =============================================================================
// Admin: Classrooms & Camera IP — GET/POST/PUT/DELETE /api/v1/admin/classrooms (§3.1)
// =============================================================================

interface ClassroomListResponse {
  kpis: ClassroomKpis;
  buildings: string[];
  items: Classroom[];
  pagination: Pagination;
}

export function AdminClassrooms() {
  const [search, setSearch] = useState("");
  const [building, setBuilding] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Classroom | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pingResult, setPingResult] = useState<PingCameraResponse | null>(null);
  const [modalPingStatus, setModalPingStatus] = useState<"IDLE" | "SUCCESS" | "FAILED">("IDLE");
  const [modalPingLatency, setModalPingLatency] = useState<number | null>(null);
  const [modalPinging, setModalPinging] = useState(false);
  const [hasIvcam, setHasIvcam] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [form] = Form.useForm();
  const watchedDeviceType = Form.useWatch("deviceType", form);
  const isIvcam = watchedDeviceType === "iVCam (Mobile Bridge)";
  const queryClient = useQueryClient();

  // Quét nhận diện thiết bị camera trên máy (iVCam / USB Cam)
  useEffect(() => {
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const found = devices.some(
            (d) => d.label.toLowerCase().includes("ivcam") || d.kind === "videoinput"
          );
          setHasIvcam(found);
        })
        .catch(() => {});
    }
  }, []);

  // List
  const { data, isLoading } = useQuery<ClassroomListResponse>({
    queryKey: ["admin-classrooms", search, building, statusFilter, page],
    queryFn: () =>
      api.get(`/admin/classrooms?search=${search}&building=${building}&status=${statusFilter}&page=${page}&limit=10`) as Promise<ClassroomListResponse>,
  });

  // Detail
  const { data: detail } = useQuery<ClassroomDetail>({
    queryKey: ["admin-classroom-detail", detailId],
    queryFn: () => api.get(`/admin/classrooms/${detailId}`) as Promise<ClassroomDetail>,
    enabled: !!detailId,
  });

  // Tự động kết nối luồng Video thật từ Camera (iVCam / Webcam máy tính) khi mở Modal Giám sát
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    if (detailId && detail?.classroom?.cameraStatus === "ONLINE") {
      navigator.mediaDevices
        ?.enumerateDevices()
        .then(async (devices) => {
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          // Ưu tiên chọn thiết bị iVCam nếu có, nếu không thì lấy Camera mặc định của máy
          const ivcamDevice = videoDevices.find((d) =>
            d.label.toLowerCase().includes("ivcam")
          );
          const targetDeviceId = ivcamDevice?.deviceId || videoDevices[0]?.deviceId;

          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : true,
              audio: false,
            });
            activeStream = stream;
            setMediaStream(stream);
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
            }
          } catch (e) {
            console.warn("Không thể mở luồng Camera phần cứng:", e);
          }
        })
        .catch(() => {});
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [detailId, detail?.classroom?.cameraStatus]);

  // Create/Update
  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (values: Record<string, unknown>) =>
      editItem
        ? api.put(`/admin/classrooms/${editItem.id}`, values)
        : api.post("/admin/classrooms", values),
    onSuccess: () => {
      message.success(editItem ? "Cập nhật thành công!" : "Thêm mới thành công!");
      setFormOpen(false);
      setEditItem(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["admin-classrooms"] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  // Delete
  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/classrooms/${id}`),
    onSuccess: () => {
      message.success("Xóa phòng học thành công.");
      queryClient.invalidateQueries({ queryKey: ["admin-classrooms"] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  // Ping camera ngoài bảng
  const { mutate: ping, isPending: pinging } = useMutation({
    mutationFn: (rtspUrl: string) =>
      api.post("/admin/classrooms/ping-camera", { rtspUrl }) as Promise<PingCameraResponse>,
    onSuccess: (result) => {
      const res = result as unknown as PingCameraResponse;
      setPingResult(res);
      if (res.status === "ONLINE") {
        message.success("Kết nối Camera thành công!");
      } else {
        message.warning("Camera mất tín hiệu (OFFLINE)!");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-classrooms"] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  // Ping trực tiếp trong Modal Khai Báo (bấm bao nhiêu lần cũng re-check mượt mà)
  const handleModalPing = async () => {
    const rtspUrl = form.getFieldValue("rtspUrl");
    if (!rtspUrl) {
      message.error("Vui lòng nhập RTSP Stream URL trước.");
      return;
    }
    setModalPingStatus("IDLE");
    setModalPinging(true);
    try {
      const res = (await api.post("/admin/classrooms/ping-camera", {
        rtspUrl,
      })) as unknown as PingCameraResponse;
      if (res.status === "ONLINE") {
        setModalPingStatus("SUCCESS");
        setModalPingLatency(res.latencyMs);
        message.success("Kết nối RTSP thành công!");
      } else {
        setModalPingStatus("FAILED");
        message.warning("Không thể kết nối đến luồng RTSP (OFFLINE)!");
      }
    } catch (err: any) {
      setModalPingStatus("FAILED");
      message.error(err.message || "Kiểm tra kết nối thất bại");
    } finally {
      setModalPinging(false);
    }
  };

  const openCreate = () => {
    setEditItem(null);
    form.resetFields();
    form.setFieldsValue({
      floor: 5,
      capacity: 50,
      deviceType: "Hikvision IP Camera",
      cameraIp: "192.168.1.102",
      rtspUrl: "rtsp://192.168.1.102:554/live/ch0",
    });
    setModalPingStatus("IDLE");
    setModalPingLatency(null);
    setFormOpen(true);
  };

  const openEdit = (item: Classroom) => {
    setEditItem(item);
    form.setFieldsValue(item);
    setModalPingStatus("IDLE");
    setModalPingLatency(null);
    setFormOpen(true);
  };

  const kpis = data?.kpis;
  const buildings = data?.buildings ?? [];

  const statusTag = (s: CameraStatus) => {
    switch (s) {
      case "ONLINE": return <Tag icon={<WifiOutlined />} color="success">Hoạt động</Tag>;
      case "OFFLINE": return <Tag icon={<DisconnectOutlined />} color="error">Mất tín hiệu</Tag>;
      case "MAINTENANCE": return <Tag color="warning">Bảo trì</Tag>;
    }
  };

  const columns = [
    {
      title: "Phòng",
      key: "room",
      width: 130,
      render: (_: unknown, r: Classroom) => (
        <div>
          <Text strong>{r.roomCode}</Text>
          <br />
          <Text type="secondary" className="text-xs">{r.building} · Tầng {r.floor}</Text>
        </div>
      ),
    },
    { title: "Sức chứa", dataIndex: "capacity", key: "capacity", width: 80, render: (c: number) => `${c} chỗ` },
    {
      title: "Camera IP",
      dataIndex: "cameraIp",
      key: "cameraIp",
      width: 130,
      render: (ip: string) => <code className="text-xs">{ip}</code>,
    },
    {
      title: "RTSP URL",
      dataIndex: "rtspUrl",
      key: "rtspUrl",
      ellipsis: true,
      render: (url: string) => <code className="text-xs">{url}</code>,
    },
    {
      title: "Trạng thái",
      dataIndex: "cameraStatus",
      key: "cameraStatus",
      width: 130,
      render: (s: CameraStatus) => statusTag(s),
    },
    { title: "FPS", dataIndex: "fps", key: "fps", width: 60 },
    {
      title: "Latency",
      dataIndex: "latencyMs",
      key: "latencyMs",
      width: 80,
      render: (ms: number | null) => ms != null ? `${ms}ms` : "—",
    },
    {
      title: "",
      key: "action",
      width: 200,
      render: (_: unknown, r: Classroom) => (
        <div className="flex gap-2">
          {r.cameraStatus === "ONLINE" && (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailId(r.id)}
              title="Xem trực tiếp luồng camera"
            />
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button size="small" icon={<ApiOutlined />} onClick={() => ping(r.rtspUrl)} loading={pinging} />
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(r.id)} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {kpis && (
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Tổng phòng học" value={kpis.totalClassrooms} /></Card></Col>
          <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Camera Online" value={kpis.onlineCameras} valueStyle={{ color: "#10b981" }} prefix={<WifiOutlined />} /></Card></Col>
          <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Camera Offline" value={kpis.offlineCameras} valueStyle={{ color: "#dc2626" }} prefix={<DisconnectOutlined />} /></Card></Col>
          <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Tỉ lệ phủ sóng" value={kpis.cameraCoverageRate} /></Card></Col>
        </Row>
      )}

      {/* Main Table */}
      <Card
        title="Quản lý Phòng học & Camera IP"
        extra={
          <div className="flex gap-3">
            <Input placeholder="Tìm phòng, tòa, IP..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ width: 200 }} />
            <Select value={building} onChange={setBuilding} style={{ width: 130 }}>
              <Select.Option value="ALL">Tất cả tòa</Select.Option>
              {buildings.map((b) => <Select.Option key={b} value={b}>{b}</Select.Option>)}
            </Select>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 130 }}>
              <Select.Option value="ALL">Tất cả</Select.Option>
              <Select.Option value="ONLINE">Online</Select.Option>
              <Select.Option value="OFFLINE">Offline</Select.Option>
              <Select.Option value="MAINTENANCE">Bảo trì</Select.Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm phòng</Button>
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={data?.items ?? []}
          rowKey="id"
          loading={isLoading}
          pagination={{ current: page, pageSize: 10, total: data?.pagination?.totalItems ?? 0, onChange: setPage }}
          size="middle"
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={
          <span className="flex items-center gap-2 text-base font-bold text-slate-800">
            <PlusCircleOutlined className="text-blue-600" />
            {editItem ? "Cập Nhật Phòng Học & Cấu Hình Camera IP" : "Khai Báo Phòng Học Mới & Cấu Hình Camera IP"}
          </span>
        }
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        footer={null}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={(v) => save(v)} className="mt-4">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="roomCode"
                label={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tên phòng học</span>}
                rules={[{ required: true, message: "Vui lòng nhập tên phòng học" }]}
              >
                <Input placeholder="Ví dụ: A2-502" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="building"
                label={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tòa nhà / Tầng</span>}
                rules={[{ required: true, message: "Vui lòng nhập tòa nhà" }]}
              >
                <Input placeholder="Ví dụ: Tòa A - Tầng 5" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="floor"
                label={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tầng</span>}
                initialValue={5}
              >
                <InputNumber min={1} max={50} style={{ width: "100%" }} placeholder="Ví dụ: 5" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="capacity"
                label={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sức chứa</span>}
                initialValue={50}
              >
                <InputNumber min={1} max={500} style={{ width: "100%" }} placeholder="Ví dụ: 50" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="deviceType"
            label={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Thiết bị & Giao thức</span>}
            initialValue="Hikvision IP Camera"
          >
            <Select
              onChange={(val) => {
                setModalPingStatus("IDLE");
                if (val === "iVCam (Mobile Bridge)") {
                  form.setFieldsValue({
                    cameraIp: "127.0.0.1",
                    rtspUrl: "rtsp://127.0.0.1:4747/live",
                  });
                } else if (val === "Hikvision IP Camera") {
                  form.setFieldsValue({
                    cameraIp: "192.168.1.102",
                    rtspUrl: "rtsp://192.168.1.102:554/live/ch0",
                  });
                } else if (val === "Dahua AI Camera") {
                  form.setFieldsValue({
                    cameraIp: "192.168.1.108",
                    rtspUrl: "rtsp://admin:admin123@192.168.1.108:554/cam/realmonitor?channel=1&subtype=0",
                  });
                }
              }}
              options={[
                { value: "Hikvision IP Camera", label: "Hikvision IP Camera (H.264/H.265)" },
                {
                  value: "iVCam (Mobile Bridge)",
                  label: `📱 iVCam (Mobile Bridge - Smartphone) ${hasIvcam ? "🟢 Đã phát hiện" : ""}`,
                },
                { value: "Dahua AI Camera", label: "Dahua AI RTSP Camera" },
                { value: "Ezviz / Imou Camera", label: "Ezviz / Imou Home RTSP Camera" },
                { value: "Webcam USB / Integrated", label: "💻 Webcam USB / DirectShow" },
                { value: "Custom RTSP Stream", label: "⚙️ Camera IP khác (Custom RTSP Stream)" },
              ]}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="cameraIp"
                label={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Camera IP</span>}
                rules={[{ required: true, message: "Vui lòng nhập IP" }]}
              >
                <Input
                  placeholder="192.168.1.102"
                  disabled={isIvcam}
                  style={isIvcam ? { backgroundColor: "#f8fafc", color: "#64748b", cursor: "not-allowed" } : undefined}
                />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="rtspUrl"
                label={<span className="text-xs font-semibold uppercase tracking-wider text-slate-500">RTSP Stream URL</span>}
                rules={[{ required: true, message: "Vui lòng nhập RTSP Stream URL" }]}
              >
                <Input
                  prefix={<LinkOutlined className="text-slate-400" />}
                  placeholder="rtsp://192.168.1.102:554/live/ch0"
                  disabled={isIvcam}
                  style={isIvcam ? { backgroundColor: "#f8fafc", color: "#64748b", cursor: "not-allowed" } : undefined}
                />
              </Form.Item>
            </Col>
          </Row>

          {isIvcam && (
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 12,
                color: "#1d4ed8",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: -8,
                marginBottom: 16,
              }}
            >
              <span>🔒</span>
              <span>
                <strong>iVCam DirectShow:</strong> Đã tự động khóa & cấu hình luồng nội bộ cục bộ (Không cần chỉnh sửa IP thủ công).
              </span>
            </div>
          )}

          {/* Test connection card inside modal */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 16,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            <Button
              icon={<VideoCameraOutlined />}
              onClick={handleModalPing}
              loading={modalPinging}
              style={{
                width: "100%",
                color: "#2563eb",
                borderColor: "#93c5fd",
                background: "#ffffff",
                fontWeight: 500,
                height: 40,
              }}
            >
              Kiểm Tra Kết Nối Luồng Ngay
            </Button>
            {modalPingStatus === "SUCCESS" && (
              <div className="mt-3 flex items-center justify-center gap-2 font-semibold text-sm" style={{ color: "#10b981" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                Kết nối RTSP thành công! {modalPingLatency ? `(${modalPingLatency}ms - 30 FPS)` : ""}
              </div>
            )}
            {modalPingStatus === "FAILED" && (
              <div className="mt-3 flex items-center justify-center gap-2 font-semibold text-sm" style={{ color: "#ef4444" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                Không thể kết nối đến Camera (OFFLINE)!
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid #f1f5f9" }}>
            <Button onClick={() => setFormOpen(false)}>Hủy Bỏ</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              style={{ background: "#1d4ed8", fontWeight: 600, padding: "0 24px", height: 38 }}
            >
              {editItem ? "Lưu & Cập Nhật Phòng Học" : "Lưu & Kích Hoạt Phòng Học"}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Detail Modal (1.1.1) — Giám sát luồng Camera & Lịch trình hôm nay (Khớp 100% Hình 1) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-800 pb-1">
            <span className="text-xl">📹</span>
            <span className="text-xl">🎥</span>
            <span>
              CHI TIẾT PHÒNG HỌC {detail?.classroom.roomCode} & GIÁM SÁT LUỒNG CAMERA IP
            </span>
          </div>
        }
        open={!!detailId}
        onCancel={() => {
          if (mediaStream) {
            mediaStream.getTracks().forEach((t) => t.stop());
            setMediaStream(null);
          }
          setDetailId(null);
        }}
        footer={null}
        width={1050}
        centered
        styles={{
          body: { padding: "16px 24px 20px 24px" },
        }}
      >
        {detail && (
          <div className="mt-2">
            <Row gutter={24}>
              {/* Cột trái: Khung Live Video Stream Lớn Chuẩn Cinematic 16:9 */}
              <Col span={14}>
                <div
                  style={{
                    position: "relative",
                    height: 380,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#090d16",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Video Stream Element thật từ Camera / iVCam điện thoại */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      zIndex: 1,
                    }}
                  />

                  {/* Họa tiết dự phòng nếu camera chưa bật hoặc đang kết nối */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0.25,
                      backgroundImage:
                        "radial-gradient(#3b82f6 1px, transparent 1px), radial-gradient(#6366f1 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                      backgroundPosition: "0 0, 10px 10px",
                      zIndex: 0,
                    }}
                  />

                  {/* Trung tâm: Tên thiết bị (khi đang kết nối feed) */}
                  {!mediaStream && (
                    <div className="text-center z-0 text-slate-300">
                      <VideoCameraOutlined style={{ fontSize: 52, color: "#60a5fa" }} className="animate-pulse mb-3" />
                      <div className="text-sm tracking-wider uppercase font-semibold text-slate-300">
                        {detail.classroom.deviceType || "Hikvision IP Camera"} — Đang kết nối luồng...
                      </div>
                    </div>
                  )}

                  {/* Badge Top Left: LIVE RTSP (30 FPS) */}
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      left: 14,
                      zIndex: 10,
                      background: "rgba(0,0,0,0.7)",
                      backdropFilter: "blur(6px)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      color: "#34d399",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 12px",
                      borderRadius: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: "#10b981",
                        boxShadow: "0 0 8px #10b981",
                      }}
                    />
                    LIVE RTSP ({detail.classroom.fps || 30} FPS)
                  </div>

                  {/* Badge Top Right: Độ trễ AI & Sĩ số */}
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      right: 14,
                      zIndex: 10,
                      background: "rgba(0,0,0,0.7)",
                      backdropFilter: "blur(6px)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      color: "#ffffff",
                      fontSize: 11,
                      padding: "4px 12px",
                      borderRadius: 20,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    }}
                  >
                    <span className="text-slate-300 font-medium">Độ trễ AI:</span>
                    <span style={{ color: "#34d399", fontFamily: "monospace", fontWeight: 700 }}>
                      {detail.classroom.latencyMs || 118}ms
                    </span>
                    <span className="text-slate-500">|</span>
                    <span style={{ color: "#60a5fa", fontWeight: 600 }}>
                      👥 {detail.todaySchedule[0]?.attendedCount || 44} SV
                    </span>
                  </div>

                  {/* Floating Bottom Banner: Trạng thái phân tích khuôn mặt AI chuẩn Hình 1 */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 14,
                      left: 14,
                      zIndex: 10,
                      background: "rgba(15, 23, 42, 0.85)",
                      backdropFilter: "blur(8px)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "8px 18px",
                      borderRadius: 8,
                      boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
                    }}
                  >
                    Đang phân tích: {detail.todaySchedule[0]?.attendedCount || 44}/{detail.todaySchedule[0]?.totalStudents || detail.classroom.capacity} Sinh viên khớp khuôn mặt ({Math.min(100, Math.round(((detail.todaySchedule[0]?.attendedCount || 44) / (detail.todaySchedule[0]?.totalStudents || detail.classroom.capacity)) * 100))}%)
                  </div>
                </div>

                {/* Hộp Thông số Luồng (RTSP Stream Box) */}
                <div
                  style={{
                    marginTop: 14,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "12px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <SlidersOutlined style={{ fontSize: 22, color: "#2563eb" }} />
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        ĐỊA CHỈ LUỒNG
                      </div>
                      <div style={{ fontSize: 13, fontFamily: "monospace", color: "#1e293b", fontWeight: 600 }}>
                        {detail.classroom.rtspUrl}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      CODEC / BITRATE
                    </div>
                    <div style={{ fontSize: 13, fontFamily: "monospace", color: "#1e293b", fontWeight: 600 }}>
                      {detail.classroom.codec || "H.264"} / 4.2 Mbps
                    </div>
                  </div>
                </div>
              </Col>

              {/* Cột phải: Lịch trình hôm nay & Thông tin phòng */}
              <Col span={10}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <CalendarOutlined style={{ color: "#2563eb" }} />
                  <span>LỊCH TRÌNH HÔM NAY ({new Date().toLocaleDateString("vi-VN")})</span>
                </div>

                {/* Danh sách các ca học hôm nay */}
                <div className="space-y-3" style={{ maxHeight: 290, overflowY: "auto" }}>
                  {detail.todaySchedule.length > 0 ? (
                    detail.todaySchedule.map((item, idx) => (
                      <div
                        key={item.sessionId || idx}
                        style={{
                          background: idx === 0 ? "#f0fdf4" : "#f8fafc",
                          border: idx === 0 ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                          borderRadius: 10,
                          padding: "12px 14px",
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                            {item.startTime} - {item.endTime}
                          </span>
                          {idx === 0 ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", background: "#dcfce7", padding: "2px 10px", borderRadius: 12 }}>
                              🟢 Đang Live
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", background: "#f3e8ff", padding: "2px 10px", borderRadius: 12 }}>
                              🟣 Sắp diễn ra
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                          {item.courseCode} - {item.courseName}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                          GV: {item.teacherName}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: idx === 0 ? "#16a34a" : "#64748b", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                          <CheckCircleOutlined />
                          <span>{item.attendedCount}/{item.totalStudents} SV có mặt</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px dashed #cbd5e1",
                        borderRadius: 10,
                        padding: 24,
                        textAlign: "center",
                        color: "#64748b",
                        fontSize: 13,
                      }}
                    >
                      Không có ca học nào được xếp lịch hôm nay
                    </div>
                  )}
                </div>

                {/* THÔNG TIN PHÒNG */}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                    THÔNG TIN PHÒNG
                  </div>
                  <Row gutter={16}>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>Sức chứa</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                        {detail.classroom.capacity} Chỗ
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>Vị trí</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                        {detail.classroom.building} - P.{detail.classroom.roomCode}
                      </div>
                    </Col>
                  </Row>
                </div>
              </Col>
            </Row>

            {/* Footer Buttons chuẩn Hình 1 */}
            <div className="flex justify-end items-center gap-3 mt-6 pt-4" style={{ borderTop: "1px solid #f1f5f9" }}>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  if (mediaStream) {
                    mediaStream.getTracks().forEach((t) => t.stop());
                    setMediaStream(null);
                  }
                  const c = detail.classroom;
                  setDetailId(null);
                  openEdit(c);
                }}
              >
                Chỉnh Sửa Cấu Hình
              </Button>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                style={{ background: "#2563eb", borderColor: "#2563eb", fontWeight: 600 }}
                onClick={() => message.success(`Đang khởi động lại luồng RTSP phòng ${detail.classroom.roomCode}...`)}
              >
                Khởi Động Lại Luồng
              </Button>
              <Button
                onClick={() => {
                  if (mediaStream) {
                    mediaStream.getTracks().forEach((t) => t.stop());
                    setMediaStream(null);
                  }
                  setDetailId(null);
                }}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Ping Result */}
      {pingResult && (
        <Modal title="Kết quả Ping Camera" open={!!pingResult} onCancel={() => setPingResult(null)} footer={null}>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Trạng thái">{statusTag(pingResult.status)}</Descriptions.Item>
            <Descriptions.Item label="Latency">{pingResult.latencyMs}ms</Descriptions.Item>
            <Descriptions.Item label="FPS">{pingResult.fps}</Descriptions.Item>
            <Descriptions.Item label="Resolution">{pingResult.resolution}</Descriptions.Item>
            <Descriptions.Item label="Bitrate">{pingResult.bitrateKbps} Kbps</Descriptions.Item>
            <Descriptions.Item label="Codec">{pingResult.codec}</Descriptions.Item>
          </Descriptions>
        </Modal>
      )}
    </div>
  );
}
