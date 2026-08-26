import { useState } from "react";
import { Card, Table, Tag, Button, Input, Select, Row, Col, Statistic, Tabs, Modal, Descriptions, Image, Upload, Form, message, Typography, Divider } from "antd";
import { SearchOutlined, UploadOutlined, EyeOutlined, CheckOutlined, CloseOutlined, SafetyCertificateOutlined, UserOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import type { BiometricItem, BiometricKpis, BiometricDetail, ReEkycComparison, Pagination } from "@/types";

const { Text } = Typography;
const { TextArea } = Input;

// =============================================================================
// Admin: Biometric Management — GET /api/v1/admin/biometrics (§3.2)
// =============================================================================

interface BiometricListResponse {
  kpis: BiometricKpis;
  tabCounts: { students: number; teachers: number };
  items: BiometricItem[];
  pagination: Pagination;
}

export function AdminBiometrics() {
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [detailUser, setDetailUser] = useState<string | null>(null);
  const [reEkycId, setReEkycId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch biometric list
  const { data, isLoading } = useQuery<BiometricListResponse>({
    queryKey: ["admin-biometrics", role, search, department, status, page],
    queryFn: () =>
      api.get(`/admin/biometrics?role=${role}&search=${search}&department=${department}&status=${status}&page=${page}&limit=10`) as Promise<BiometricListResponse>,
  });

  // Fetch detail
  const { data: detail } = useQuery<BiometricDetail>({
    queryKey: ["admin-biometric-detail", detailUser],
    queryFn: () => api.get(`/admin/biometrics/${detailUser}`) as Promise<BiometricDetail>,
    enabled: !!detailUser,
  });

  // Fetch re-eKYC comparison
  const { data: reEkycData } = useQuery<ReEkycComparison>({
    queryKey: ["admin-reekyc", reEkycId],
    queryFn: () =>
      api.get(`/admin/biometrics/re-ekyc-requests/${reEkycId}/comparison`) as Promise<ReEkycComparison>,
    enabled: !!reEkycId,
  });

  // Approve/reject re-eKYC
  const { mutate: reviewReEkyc } = useMutation({
    mutationFn: ({ id, action, reviewNote }: { id: string; action: "APPROVE" | "REJECT"; reviewNote: string }) =>
      api.post(`/admin/biometrics/re-ekyc-requests/${id}/review`, { action, reviewNote }),
    onSuccess: () => {
      message.success("Đã xử lý yêu cầu Re-eKYC.");
      setReEkycId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-biometrics"] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  // Import Excel
  const { mutate: importExcel, isPending: importing } = useMutation({
    mutationFn: (formData: FormData) =>
      api.post("/admin/import/excel-bundle", formData, { headers: { "Content-Type": "multipart/form-data" } }),
    onSuccess: (result: unknown) => {
      message.success("Nạp dữ liệu 3-trong-1 thành công!");
      setImportOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-biometrics"] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const kpis = data?.kpis;

  const columns = [
    {
      title: "MSSV / Mã GV",
      dataIndex: "userCode",
      key: "userCode",
      width: 110,
      render: (code: string) => <Text strong>{code}</Text>,
    },
    { title: "Họ và tên", dataIndex: "fullName", key: "fullName" },
    { title: "Lớp", dataIndex: "className", key: "className", width: 100 },
    { title: "Khoa", dataIndex: "department", key: "department", width: 180, ellipsis: true },
    {
      title: "Vector ID",
      dataIndex: "vectorId",
      key: "vectorId",
      width: 100,
      render: (v: string) => v ? <Tag color="blue">{v}</Tag> : "—",
    },
    {
      title: "eKYC",
      dataIndex: "isFaceEnrolled",
      key: "isFaceEnrolled",
      width: 120,
      render: (enrolled: boolean) => (
        <Tag color={enrolled ? "success" : "error"}>
          {enrolled ? "Đã nạp" : "Chưa đăng ký"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 180,
      render: (_: unknown, r: BiometricItem) => (
        <div className="flex gap-2">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailUser(r.id)}>
            Chi tiết
          </Button>
          {r.hasPendingResetRequest && r.pendingRequestId && (
            <Button size="small" type="primary" danger onClick={() => setReEkycId(r.pendingRequestId!)}>
              Re-eKYC
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {kpis && (
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Tổng sinh viên" value={kpis.totalStudents} prefix={<UserOutlined />} /></Card></Col>
          <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Đã nạp eKYC" value={kpis.enrolledCount} valueStyle={{ color: "#10b981" }} prefix={<SafetyCertificateOutlined />} /></Card></Col>
          <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Tỉ lệ nạp" value={kpis.enrolledRate} valueStyle={{ color: "#2563eb" }} /></Card></Col>
          <Col xs={12} sm={6}><Card className="kpi-card"><Statistic title="Đơn chờ duyệt" value={kpis.pendingResetRequests} prefix={<ExclamationCircleOutlined />} valueStyle={{ color: kpis.pendingResetRequests > 0 ? "#d97706" : "#10b981" }} /></Card></Col>
        </Row>
      )}

      {/* Main Table */}
      <Card
        title="Trung tâm Sinh trắc học & Kho Vector"
        extra={
          <div className="flex gap-3">
            <Input
              placeholder="Tìm MSSV, họ tên..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 220 }}
            />
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
              Import Excel 3-in-1
            </Button>
          </div>
        }
      >
        <Tabs
          activeKey={role}
          onChange={(k) => { setRole(k as "STUDENT" | "TEACHER"); setPage(1); }}
          items={[
            { key: "STUDENT", label: `Sinh viên (${data?.tabCounts?.students ?? 0})` },
            { key: "TEACHER", label: `Giảng viên (${data?.tabCounts?.teachers ?? 0})` },
          ]}
        />
        <Table
          columns={columns}
          dataSource={data?.items ?? []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: 10,
            total: data?.pagination?.totalItems ?? 0,
            onChange: setPage,
            showTotal: (total) => `Tổng ${total} bản ghi`,
          }}
          size="middle"
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={`Hồ sơ sinh trắc: ${detail?.user?.fullName ?? ""}`}
        open={!!detailUser}
        onCancel={() => setDetailUser(null)}
        footer={null}
        width={640}
      >
        {detail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="MSSV">{detail.user.userCode}</Descriptions.Item>
              <Descriptions.Item label="Khoa">{detail.user.department}</Descriptions.Item>
              <Descriptions.Item label="Vector ID">{detail.user.vectorId}</Descriptions.Item>
              <Descriptions.Item label="AI Model">{detail.user.aiModel}</Descriptions.Item>
              <Descriptions.Item label="Match Score">{detail.user.matchScore}%</Descriptions.Item>
              <Descriptions.Item label="Ảnh gốc">
                <Image src={detail.user.masterImageUrl} width={80} alt="Master" />
              </Descriptions.Item>
            </Descriptions>
            <Divider>3 Ảnh CCTV gần nhất</Divider>
            <div className="flex gap-3 flex-wrap">
              {detail.recentCctvSnapshots.map((snap, i) => (
                <Card key={i} size="small" style={{ width: 180 }}>
                  <Image src={snap.snapshotUrl} width="100%" alt={`CCTV ${i + 1}`} />
                  <div className="mt-1">
                    <Text type="secondary" className="text-xs">{snap.roomCode} · {new Date(snap.capturedAt).toLocaleString("vi-VN")}</Text>
                    <br />
                    <Tag color="blue">{snap.matchPercentage}% match</Tag>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* Re-eKYC Comparison Modal */}
      <Modal
        title={`Phê duyệt Re-eKYC: ${reEkycData?.requestCode ?? ""}`}
        open={!!reEkycId}
        onCancel={() => setReEkycId(null)}
        footer={null}
        width={700}
      >
        {reEkycData && (
          <>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="Sinh viên">{reEkycData.fullName} ({reEkycData.studentCode})</Descriptions.Item>
              <Descriptions.Item label="Lý do">{reEkycData.reason}</Descriptions.Item>
            </Descriptions>
            <Divider>So sánh 3 ảnh</Divider>
            <Row gutter={16}>
              <Col span={8}>
                <Text strong className="block mb-2">Ảnh gốc eKYC</Text>
                <Image src={reEkycData.images.originalEnrollmentImage} width="100%" alt="Original" />
              </Col>
              <Col span={8}>
                <Text strong className="block mb-2">Thẻ SV / CCCD</Text>
                <Image src={reEkycData.images.studentCardImage} width="100%" alt="Card" />
              </Col>
              <Col span={8}>
                <Text strong className="block mb-2">Diện mạo mới</Text>
                <Image src={reEkycData.images.newFaceCropFromVideo} width="100%" alt="New" />
              </Col>
            </Row>
            <Divider />
            <div className="flex gap-3 justify-end">
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => reviewReEkyc({ id: reEkycId!, action: "APPROVE", reviewNote: "Đã đối soát, chấp thuận" })}
              >
                Phê duyệt
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => reviewReEkyc({ id: reEkycId!, action: "REJECT", reviewNote: "Không khớp thông tin" })}
              >
                Từ chối
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Import Excel Modal */}
      <Modal title="Import Dữ Liệu 3-trong-1 từ File Excel" open={importOpen} onCancel={() => setImportOpen(false)} footer={null}>
        <Form
          layout="vertical"
          onFinish={(values) => {
            const formData = new FormData();
            if (values.student_file?.file) formData.append("student_file", values.student_file.file);
            if (values.teacher_file?.file) formData.append("teacher_file", values.teacher_file.file);
            if (values.schedule_file?.file) formData.append("schedule_file", values.schedule_file.file);
            importExcel(formData);
          }}
        >
          <Form.Item name="student_file" label="File danh sách sinh viên (.xlsx)">
            <Upload maxCount={1} beforeUpload={() => false} accept=".xlsx"><Button icon={<UploadOutlined />}>Chọn file</Button></Upload>
          </Form.Item>
          <Form.Item name="teacher_file" label="File danh sách giảng viên (.xlsx)">
            <Upload maxCount={1} beforeUpload={() => false} accept=".xlsx"><Button icon={<UploadOutlined />}>Chọn file</Button></Upload>
          </Form.Item>
          <Form.Item name="schedule_file" label="File thời khóa biểu 15 tuần (.xlsx)">
            <Upload maxCount={1} beforeUpload={() => false} accept=".xlsx"><Button icon={<UploadOutlined />}>Chọn file</Button></Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={importing} block>Nạp dữ liệu</Button>
        </Form>
      </Modal>
    </div>
  );
}
