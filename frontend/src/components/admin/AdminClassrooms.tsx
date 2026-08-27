import { useState } from "react";
import { Card, Table, Tag, Button, Input, InputNumber, Select, Row, Col, Statistic, Modal, Form, Descriptions, message, Typography } from "antd";
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined, EyeOutlined, WifiOutlined, DisconnectOutlined } from "@ant-design/icons";
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
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

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

  // Ping camera
  const { mutate: ping, isPending: pinging } = useMutation({
    mutationFn: (rtspUrl: string) =>
      api.post("/admin/classrooms/ping-camera", { rtspUrl }) as Promise<PingCameraResponse>,
    onSuccess: (result) => {
      setPingResult(result as unknown as PingCameraResponse);
      message.success("Kết nối Camera thành công!");
    },
    onError: (err: Error) => message.error(err.message),
  });

  const openCreate = () => {
    setEditItem(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (item: Classroom) => {
    setEditItem(item);
    form.setFieldsValue(item);
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
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(r.id)} />
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
      <Modal title={editItem ? "Cập nhật phòng học" : "Thêm phòng học mới"} open={formOpen} onCancel={() => setFormOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={(v) => save(v)}>
          <Form.Item name="roomCode" label="Mã phòng" rules={[{ required: true }]}><Input placeholder="VD: A2-502" /></Form.Item>
          <Form.Item name="building" label="Tòa nhà" rules={[{ required: true }]}><Input placeholder="VD: Tòa A" /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="floor" label="Tầng" rules={[{ required: true }]}><InputNumber min={1} max={50} style={{ width: "100%" }} placeholder="VD: 3" /></Form.Item></Col>
            <Col span={12}><Form.Item name="capacity" label="Sức chứa" rules={[{ required: true }]}><InputNumber min={1} max={500} style={{ width: "100%" }} placeholder="VD: 45" /></Form.Item></Col>
          </Row>
          <Form.Item name="deviceType" label="Loại camera"><Input placeholder="VD: iVCam (Mobile Bridge)" /></Form.Item>
          <Form.Item name="cameraIp" label="Camera IP" rules={[{ required: true }]}><Input placeholder="192.168.1.15" /></Form.Item>
          <Form.Item name="rtspUrl" label="RTSP URL" rules={[{ required: true }]}><Input placeholder="rtsp://192.168.1.15:554/live" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} block>{editItem ? "Cập nhật" : "Thêm mới"}</Button>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal title="Chi tiết phòng học & Lịch trình hôm nay" open={!!detailId} onCancel={() => setDetailId(null)} footer={null} width={640}>
        {detail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Phòng">{detail.classroom.roomCode}</Descriptions.Item>
              <Descriptions.Item label="Tòa">{detail.classroom.building}</Descriptions.Item>
              <Descriptions.Item label="Camera IP">{detail.classroom.cameraIp}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{statusTag(detail.classroom.cameraStatus)}</Descriptions.Item>
              <Descriptions.Item label="FPS">{detail.classroom.fps}</Descriptions.Item>
              <Descriptions.Item label="Codec">{detail.classroom.codec ?? "—"}</Descriptions.Item>
            </Descriptions>
            <Text strong className="block mt-4 mb-2">Ca học hôm nay:</Text>
            <Table
              size="small"
              pagination={false}
              dataSource={detail.todaySchedule}
              rowKey="sessionId"
              columns={[
                { title: "Mã HP", dataIndex: "courseCode", key: "courseCode" },
                { title: "Tên HP", dataIndex: "courseName", key: "courseName" },
                { title: "GV", dataIndex: "teacherName", key: "teacherName" },
                { title: "Thời gian", key: "time", render: (_: unknown, r: (typeof detail.todaySchedule)[number]) => `${r.startTime} – ${r.endTime}` },
                { title: "Sĩ số", key: "count", render: (_: unknown, r: (typeof detail.todaySchedule)[number]) => `${r.attendedCount}/${r.totalStudents}` },
              ]}
            />
          </>
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
