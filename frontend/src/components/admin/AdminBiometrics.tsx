import { useState } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Row,
  Col,
  Statistic,
  Tabs,
  Modal,
  Descriptions,
  Image,
  Upload,
  message,
  Typography,
  Divider,
  Progress,
  Radio,
  Alert,
  Avatar,
} from "antd";
import {
  SearchOutlined,
  UploadOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  CheckCircleFilled,
  WarningFilled,
  SyncOutlined,
  FileExcelOutlined,
  CloudUploadOutlined,
  CheckSquareFilled,
  DeleteOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import type { BiometricItem, BiometricKpis, BiometricDetail, ReEkycComparison, Pagination } from "@/types";

const { Text } = Typography;
const { Dragger } = Upload;

// =============================================================================
// Admin: Biometric Management — GET /api/v1/admin/biometrics (§3.2)
// =============================================================================

interface BiometricListResponse {
  kpis: BiometricKpis;
  tabCounts: { students: number; teachers: number };
  items: BiometricItem[];
  pagination: Pagination;
}

interface ImportWarning {
  row: number;
  message: string;
}

interface ImportResponse {
  summary: {
    studentsImported: number;
    studentsCreated?: number;
    studentsUpdated?: number;
    teachersImported: number;
    teachersCreated?: number;
    teachersUpdated?: number;
    coursesImported: number;
    coursesCreated?: number;
    coursesUpdated?: number;
    classesImported: number;
    classesCreated?: number;
    classesUpdated?: number;
    enrollmentsCreated: number;
    sessionsCreated: number;
  };
  warnings: {
    students?: ImportWarning[];
    teachers?: ImportWarning[];
    schedule?: ImportWarning[];
  };
}

type ImportTabType = "STUDENT" | "TEACHER" | "SCHEDULE";

export function AdminBiometrics() {
  const [role, setRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [detailUser, setDetailUser] = useState<string | null>(null);
  const [selectedBiometric, setSelectedBiometric] = useState<BiometricItem | null>(null);
  const [reEkycId, setReEkycId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // State cho Modal Import theo mockup người dùng
  const [importTab, setImportTab] = useState<ImportTabType>("STUDENT");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  const queryClient = useQueryClient();

  // Fetch biometric list
  const { data, isLoading } = useQuery<BiometricListResponse>({
    queryKey: ["admin-biometrics", role, search, department, status, page],
    queryFn: () =>
      api.get(
        `/admin/biometrics?role=${role}&search=${search}&department=${department}&status=${status}&page=${page}&limit=10`
      ) as Promise<BiometricListResponse>,
  });

  // Fetch detail
  const { data: detail, isError: isDetailUnavailable } = useQuery<BiometricDetail>({
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

  const { mutate: resetEnrollment, isPending: resettingEnrollment } = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      api.post(`/admin/biometrics/${userId}/reset`, { reason }),
    onMutate: () => {
      message.loading({ content: "Đang reset enrollment...", key: "reset-enrollment" });
    },
    onSuccess: () => {
      message.success({ content: "Đã reset enrollment khuôn mặt.", key: "reset-enrollment" });
      setDetailUser(null);
      setSelectedBiometric(null);
      queryClient.invalidateQueries({ queryKey: ["admin-biometrics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-biometric-detail"] });
    },
    onError: (err: Error) =>
      message.error({ content: err.message || "Không thể reset enrollment khuôn mặt.", key: "reset-enrollment" }),
  });

  // Import Excel Mutation
  const { mutate: importExcel, isPending: importing } = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      if (importTab === "STUDENT") {
        formData.append("student_file", file);
      } else if (importTab === "TEACHER") {
        formData.append("teacher_file", file);
      } else {
        formData.append("schedule_file", file);
      }

      setImportProgress(30);
      const res = (await api.post("/admin/import/excel-bundle", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })) as ImportResponse;

      setImportProgress(100);
      return res;
    },
    onSuccess: (res: ImportResponse) => {
      setImportResult(res);
      queryClient.invalidateQueries({ queryKey: ["admin-biometrics"] });
      queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
    },
    onError: (err: Error) => {
      setImportProgress(0);
      message.error(err.message || "Có lỗi xảy ra khi nạp file Excel.");
    },
  });

  const handleCloseImportModal = () => {
    setImportOpen(false);
    setSelectedFile(null);
    setImportProgress(0);
    setImportResult(null);
  };

  const handleConfirmFinish = () => {
    message.success("Đã lưu dữ liệu nạp thành công vào hệ thống!");
    handleCloseImportModal();
  };

  const kpis = data?.kpis;

  const columns = [
    {
      title: "MSSV / Mã GV",
      dataIndex: "userCode",
      key: "userCode",
      width: 110,
      render: (code: string) => <Text strong>{code}</Text>,
    },
    {
      title: "Họ và tên",
      dataIndex: "fullName",
      key: "fullName",
      render: (fullName: string, record: BiometricItem) => (
        <div className="biometric-person">
          <Avatar size={34} src={record.avatarUrl}>{fullName.slice(0, 1)}</Avatar>
          <span>{fullName}</span>
        </div>
      ),
    },
    { title: "Lớp", dataIndex: "className", key: "className", width: 100 },
    { title: "Khoa", dataIndex: "department", key: "department", width: 180, ellipsis: true },
    {
      title: "Vector ID",
      dataIndex: "vectorId",
      key: "vectorId",
      width: 100,
      render: (v: string) => (v ? <Tag color="red">{v}</Tag> : "—"),
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
          <Button size="small" icon={<EyeOutlined />} onClick={() => {
            setSelectedBiometric(r);
            setDetailUser(r.id);
          }}>
            Xem hồ sơ
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

  // Lấy danh sách cảnh báo của tab hiện tại
  const currentWarnings: ImportWarning[] = importResult
    ? importTab === "STUDENT"
      ? importResult.warnings.students || []
      : importTab === "TEACHER"
      ? importResult.warnings.teachers || []
      : importResult.warnings.schedule || []
    : [];

  const currentSuccessCount = importResult
    ? importTab === "STUDENT"
      ? importResult.summary.studentsImported
      : importTab === "TEACHER"
      ? importResult.summary.teachersImported
      : importResult.summary.classesImported
    : 0;

  const currentTargetLabel =
    importTab === "STUDENT" ? "Sinh viên" : importTab === "TEACHER" ? "Giảng viên" : "Lớp học phần";

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {kpis && (
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}>
            <Card className="kpi-card">
              <Statistic title="Tổng sinh viên" value={kpis.totalStudents} prefix={<UserOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="kpi-card">
              <Statistic
                title="Đã nạp eKYC"
                value={kpis.enrolledCount}
                valueStyle={{ color: "#10b981" }}
                prefix={<SafetyCertificateOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="kpi-card">
              <Statistic title="Tỉ lệ nạp" value={kpis.enrolledRate} valueStyle={{ color: "#2563eb" }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="kpi-card">
              <Statistic
                title="Đơn chờ duyệt"
                value={kpis.pendingResetRequests}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: kpis.pendingResetRequests > 0 ? "#d97706" : "#10b981" }}
              />
            </Card>
          </Col>
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
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => {
                setSelectedFile(null);
                setImportProgress(0);
                setImportResult(null);
                setImportOpen(true);
              }}
            >
              Import Excel
            </Button>
          </div>
        }
      >
        <Tabs
          activeKey={role}
          onChange={(k) => {
            setRole(k as "STUDENT" | "TEACHER");
            setPage(1);
          }}
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
        title={`Hồ sơ sinh trắc: ${detail?.user?.fullName ?? selectedBiometric?.fullName ?? ""}`}
        open={!!detailUser}
        onCancel={() => {
          setDetailUser(null);
          setSelectedBiometric(null);
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              loading={resettingEnrollment}
              disabled={!detailUser || resettingEnrollment}
              onClick={() => {
                if (!detailUser || resettingEnrollment) return;
                resetEnrollment({
                  userId: detailUser,
                  reason: "Admin reset enrollment từ hồ sơ sinh viên",
                });
              }}
            >
              Reset enrollment
            </Button>
            <Button
              onClick={() => {
                setDetailUser(null);
                setSelectedBiometric(null);
              }}
            >
              Đóng
            </Button>
          </div>
        }
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
              <Descriptions.Item label="Ảnh đại diện">
                <Image src={detail.user.previewBase64 || detail.user.masterImageUrl} width={80} alt="Master" />
              </Descriptions.Item>
            </Descriptions>
            <Divider>{detail.user.enrollmentImages?.length ?? 0} ảnh gốc enrollment</Divider>
            {detail.user.enrollmentImages?.length ? (
              <Image.PreviewGroup>
                <div className="flex gap-3 flex-wrap">
                  {detail.user.enrollmentImages.map((image) => (
                    <div key={image.id} className="flex flex-col gap-1">
                      <Image src={image.previewBase64} width={120} alt={`Enrollment ${image.imageIndex}`} />
                      <Text type="secondary" className="text-xs">
                        {image.pose === "left" ? "Quay trái" : image.pose === "right" ? "Quay phải" : "Nhìn thẳng"} · Ảnh {image.imageIndex}
                      </Text>
                    </div>
                  ))}
                </div>
              </Image.PreviewGroup>
            ) : (
              <Text type="secondary">Chưa có ảnh gốc enrollment.</Text>
            )}
            <Divider>3 Ảnh CCTV gần nhất</Divider>
            <div className="flex gap-3 flex-wrap">
              {detail.recentCctvSnapshots.map((snap, i) => (
                <Card key={i} size="small" style={{ width: 180 }}>
                  <Image src={snap.snapshotUrl} width="100%" alt={`CCTV ${i + 1}`} />
                  <div className="mt-1">
                    <Text type="secondary" className="text-xs">
                      {snap.roomCode} · {new Date(snap.capturedAt).toLocaleString("vi-VN")}
                    </Text>
                    <br />
                    <Tag color="blue">{snap.matchPercentage}% match</Tag>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
        {!detail && selectedBiometric && (
          <div className="biometric-fallback-profile">
            <Avatar size={80} src={selectedBiometric.avatarUrl}>{selectedBiometric.fullName.slice(0, 1)}</Avatar>
            <div>
              <h3>{selectedBiometric.fullName}</h3>
              <p>{selectedBiometric.userCode} · {selectedBiometric.className || selectedBiometric.department}</p>
              <Tag color={selectedBiometric.isFaceEnrolled ? "success" : "default"}>
                {selectedBiometric.isFaceEnrolled ? "Đã đăng ký khuôn mặt" : "Chưa đăng ký khuôn mặt"}
              </Tag>
            </div>
          </div>
        )}
        {isDetailUnavailable && (
          <Alert
            className="mt-4"
            type="warning"
            showIcon
            message="Chưa tải được hồ sơ chi tiết"
            description="Không thể tải dữ liệu chi tiết từ Backend. Hãy thử lại sau."
          />
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
              <Descriptions.Item label="Sinh viên">
                {reEkycData.fullName} ({reEkycData.studentCode})
              </Descriptions.Item>
              <Descriptions.Item label="Lý do">{reEkycData.reason}</Descriptions.Item>
            </Descriptions>
            <Divider>So sánh 3 ảnh</Divider>
            <Row gutter={16}>
              <Col span={8}>
                <Text strong className="block mb-2">
                  Ảnh gốc eKYC
                </Text>
                <Image src={reEkycData.images.originalEnrollmentImage} width="100%" alt="Original" />
              </Col>
              <Col span={8}>
                <Text strong className="block mb-2">
                  Thẻ SV / CCCD
                </Text>
                <Image src={reEkycData.images.studentCardImage} width="100%" alt="Card" />
              </Col>
              <Col span={8}>
                <Text strong className="block mb-2">
                  Diện mạo mới
                </Text>
                <Image src={reEkycData.images.newFaceCropFromVideo} width="100%" alt="New" />
              </Col>
            </Row>
            <Divider />
            <div className="flex gap-3 justify-end">
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() =>
                  reviewReEkyc({ id: reEkycId!, action: "APPROVE", reviewNote: "Đã đối soát, chấp thuận" })
                }
              >
                Phê duyệt
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() =>
                  reviewReEkyc({ id: reEkycId!, action: "REJECT", reviewNote: "Không khớp thông tin" })
                }
              >
                Từ chối
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Modal 1.2.1: Import Excel Master Bundle - 100% Giống Hình 2 */}
      <Modal
        title={
          <div className="text-base font-bold text-slate-800 pb-1">
            Nạp Dữ Liệu Hệ Thống từ File Excel
          </div>
        }
        open={importOpen}
        onCancel={handleCloseImportModal}
        footer={null}
        width={560}
        centered
        styles={{
          body: { padding: "16px 20px 20px 20px" },
        }}
      >
        <div className="flex flex-col gap-3.5 pt-1">
          {/* 1. Chọn loại dữ liệu cần nạp */}
          <div>
            <div className="text-xs text-slate-600 font-medium mb-1.5">
              Loại dữ liệu cần nạp
            </div>
            {/* Thanh Tab Segmented nền xám chuẩn mockup */}
            <div
              style={{
                display: "flex",
                background: "#f1f5f9",
                borderRadius: 8,
                padding: 4,
                width: "100%",
              }}
            >
              {[
                { key: "STUDENT", label: "Danh sách Sinh viên" },
                { key: "TEACHER", label: "Danh sách Giảng viên" },
                { key: "SCHEDULE", label: "Thời khóa biểu tổng" },
              ].map((tab) => {
                const isActive = importTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setImportTab(tab.key as ImportTabType);
                      setSelectedFile(null);
                      setImportProgress(0);
                      setImportResult(null);
                    }}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "8px 10px",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "#2563eb" : "#64748b",
                      background: isActive ? "#ffffff" : "transparent",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: isActive ? "0 1px 2px rgba(0, 0, 0, 0.06)" : "none",
                      transition: "all 0.15s ease-in-out",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div className="text-slate-400 text-xs italic mt-1.5">
              Lưu ý: Vui lòng sử dụng đúng file mẫu cho từng loại dữ liệu để tránh lỗi xử lý.
            </div>
          </div>

          {/* 2. Drag & Drop Khu vực kéo thả file (Luôn hiển thị chuẩn Hình 2) */}
          <Dragger
            name="file"
            multiple={false}
            accept=".xlsx,.xls"
            showUploadList={false}
            customRequest={({ file, onSuccess }) => {
              const uploadFile = file as File;
              setSelectedFile(uploadFile);
              setImportProgress(20);
              setImportResult(null);
              importExcel(uploadFile);
              if (onSuccess) onSuccess("ok");
            }}
            style={{
              background: "#ffffff",
              borderColor: "#cbd5e1",
              borderStyle: "dashed",
              borderWidth: "1.5px",
              borderRadius: 10,
              padding: "20px 16px",
              cursor: "pointer",
            }}
          >
            <div className="flex flex-col items-center justify-center py-1">
              <CloudUploadOutlined style={{ color: "#94a3b8", fontSize: 44, marginBottom: 8 }} />
              <div className="text-sm font-semibold text-slate-700 mb-0.5">
                Kéo thả file <span className="font-semibold text-blue-600">.xlsx</span> vào đây...
              </div>
              <div className="text-xs text-slate-400">
                hoặc click để chọn file từ máy tính
              </div>
            </div>
          </Dragger>

          {/* 3. Hộp tiến độ đang xử lý */}
          {(importing || (selectedFile && importProgress > 0)) && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2 text-slate-700 font-medium truncate max-w-[320px]">
                  <SyncOutlined spin={importing} style={{ color: "#2563eb", fontSize: 13 }} />
                  <span>Đang xử lý: {selectedFile?.name || "Danh_sach_du_lieu.xlsx"}</span>
                </div>
                <span className="font-semibold text-blue-600 text-xs font-mono">
                  {importProgress === 100 ? "100%" : `${importProgress}%`}
                </span>
              </div>
              <Progress
                percent={importProgress}
                showInfo={false}
                strokeColor="#2563eb"
                status={importing ? "active" : "normal"}
                size="small"
                style={{ marginBottom: 0 }}
              />
            </div>
          )}

          {/* 4. Hộp thông báo kết quả thành công */}
          {importResult && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                padding: "12px 14px",
              }}
              className="flex items-start gap-3"
            >
              <CheckSquareFilled style={{ color: "#16a34a", fontSize: 22, marginTop: 1 }} />
              <div className="space-y-1 w-full">
                <div className="font-bold text-sm text-green-900">
                  {importTab === "SCHEDULE" ? (
                    <>Nạp thành công: {importResult.summary.classesImported} Lớp học phần ({importResult.summary.sessionsCreated} Ca học)</>
                  ) : (
                    <>Nạp thành công: {currentSuccessCount} {currentTargetLabel}</>
                  )}
                </div>

                {/* Các chip phân loại Thêm mới & Cập nhật đè */}
                <div className="flex items-center gap-2 flex-wrap text-xs pt-0.5">
                  {importTab === "STUDENT" && (
                    <>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-200">
                        🆕 {importResult.summary.studentsCreated || 0} Sinh viên mới
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-800 bg-blue-100/90 px-2 py-0.5 rounded border border-blue-200">
                        🔄 {importResult.summary.studentsUpdated || 0} Sinh viên đã có trong hệ thống (cập nhật đè)
                      </span>
                    </>
                  )}
                  {importTab === "TEACHER" && (
                    <>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-200">
                        🆕 {importResult.summary.teachersCreated || 0} Giảng viên mới
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-800 bg-blue-100/90 px-2 py-0.5 rounded border border-blue-200">
                        🔄 {importResult.summary.teachersUpdated || 0} Giảng viên đã có trong hệ thống (cập nhật đè)
                      </span>
                    </>
                  )}
                  {importTab === "SCHEDULE" && (
                    <>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-200">
                        🆕 {importResult.summary.classesCreated || 0} lớp mới
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-800 bg-blue-100/90 px-2 py-0.5 rounded border border-blue-200">
                        🔄 {importResult.summary.classesUpdated || 0} lớp cập nhật lại lịch
                      </span>
                    </>
                  )}
                </div>

                <div className="text-xs text-green-700 mt-0.5">
                  Dữ liệu hợp lệ đã được thêm vào hệ thống tạm.
                </div>
              </div>
            </div>
          )}

          {/* 5. Hộp cảnh báo lỗi theo từng dòng */}
          {importResult && currentWarnings.length > 0 && (
            <div
              style={{
                background: "#fffbf5",
                border: "1px solid #fed7aa",
                borderRadius: 8,
                padding: "12px 14px",
              }}
              className="flex items-start gap-3"
            >
              <WarningFilled style={{ color: "#f97316", fontSize: 20, marginTop: 1 }} />
              <div className="w-full">
                <div className="font-bold text-sm text-amber-950 mb-1">
                  Cảnh báo lỗi {String(currentWarnings.length).padStart(2, "0")} dòng:
                </div>
                <ul className="text-xs text-amber-900 space-y-1 pl-1 list-none max-h-28 overflow-y-auto">
                  {currentWarnings.map((w, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-600 font-bold">•</span>
                      <span>
                        <b className="font-semibold">Dòng {w.row}:</b> {w.message}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 6. Footer Buttons chuẩn Hình 2 */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 mt-1">
            <button
              type="button"
              onClick={handleCloseImportModal}
              disabled={importing}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all cursor-pointer shadow-2xs"
            >
              Đóng / Hủy Bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirmFinish}
              disabled={importing || !importResult}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all cursor-pointer"
            >
              Xác Nhận Hoàn Tất
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
