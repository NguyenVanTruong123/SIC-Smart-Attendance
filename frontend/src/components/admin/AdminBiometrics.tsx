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
    { title: "Họ và tên", dataIndex: "fullName", key: "fullName" },
    { title: "Lớp", dataIndex: "className", key: "className", width: 100 },
    { title: "Khoa", dataIndex: "department", key: "department", width: 180, ellipsis: true },
    {
      title: "Vector ID",
      dataIndex: "vectorId",
      key: "vectorId",
      width: 100,
      render: (v: string) => (v ? <Tag color="blue">{v}</Tag> : "—"),
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
              style={{ background: "#10b981", borderColor: "#10b981" }}
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

      {/* ========================================================================= */}
      {/* 🚀 MODAL 1.2.1: NẠP DỮ LIỆU HỆ THỐNG TỪ FILE EXCEL (KHỚP 100% MOCKUP) */}
      {/* ========================================================================= */}
      <Modal
        title={
          <div className="font-bold text-lg text-slate-800 pb-1">
            Nạp Dữ Liệu Hệ Thống từ File Excel
          </div>
        }
        open={importOpen}
        onCancel={handleCloseImportModal}
        footer={null}
        width={600}
        centered
        bodyStyle={{ padding: "20px 24px" }}
      >
        <div className="space-y-4">
          {/* 1. Chọn loại dữ liệu cần nạp */}
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">Loại dữ liệu cần nạp</div>
            {/* Thanh Tab Segmented nằm ngang trên 1 hàng chuẩn mockup */}
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
                      padding: "8px 12px",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "#2563eb" : "#64748b",
                      background: isActive ? "#ffffff" : "transparent",
                      borderRadius: 6,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: isActive ? "0 1px 3px rgba(0, 0, 0, 0.1)" : "none",
                      transition: "all 0.2s ease-in-out",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div className="text-slate-400 text-xs italic mt-2">
              Lưu ý: Vui lòng sử dụng đúng file mẫu cho từng loại dữ liệu để tránh lỗi xử lý.
            </div>
          </div>

          {/* 2. Drag & Drop Khu vực kéo thả file */}
          {!selectedFile ? (
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
                background: "#fafcff",
                borderColor: "#93c5fd",
                borderStyle: "dashed",
                borderRadius: 12,
                padding: "24px 16px",
                cursor: "pointer",
              }}
            >
              <p className="ant-upload-drag-icon mb-2">
                <InboxOutlined style={{ color: "#60a5fa", fontSize: 48 }} />
              </p>
              <p className="text-base font-bold text-slate-700 mb-1 font-mono">
                cloud_upload
              </p>
              <p className="text-xs text-slate-500 font-medium">
                Kéo thả file <span className="font-semibold text-blue-600">.xlsx</span> vào đây...
              </p>
              <p className="text-xs text-slate-400">hoặc click để chọn file từ máy tính</p>
            </Dragger>
          ) : (
            <div className="bg-sky-50/70 p-4 rounded-xl border border-sky-200 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600 text-xl font-bold">
                  <FileExcelOutlined />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-800">{selectedFile.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {importing ? "Đang xử lý dữ liệu..." : "Đã nạp file thành công"}
                  </div>
                </div>
              </div>
              <Button
                size="small"
                disabled={importing}
                onClick={() => {
                  setSelectedFile(null);
                  setImportProgress(0);
                  setImportResult(null);
                }}
              >
                Đổi file khác
              </Button>
            </div>
          )}

          {/* 3. Tiến độ đang xử lý (Hiển thị khi đang import hoặc vừa import xong) */}
          {(importing || (selectedFile && importProgress > 0)) && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5 font-medium text-slate-700">
                  <SyncOutlined spin={importing} className="text-blue-600" />
                  <FileExcelOutlined className="text-green-600" />
                  <span className="truncate max-w-[280px]">
                    Đang xử lý: {selectedFile?.name || "file_du_lieu.xlsx"}
                  </span>
                </div>
                <span className="font-bold text-blue-600 font-mono">
                  {importProgress === 100 ? "100%" : `${importProgress}%`}
                </span>
              </div>
              <Progress
                percent={importProgress}
                showInfo={false}
                strokeColor="#2563eb"
                status={importing ? "active" : "normal"}
                size="small"
              />
            </div>
          )}

          {/* 4. Hộp thông báo kết quả thành công */}
          {importResult && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: 8,
                padding: "12px 16px",
              }}
              className="flex items-start gap-3"
            >
              <CheckCircleFilled style={{ color: "#16a34a", fontSize: 20, marginTop: 2 }} />
              <div>
                <div className="font-bold text-sm text-green-900">
                  {importTab === "SCHEDULE" ? (
                    <>
                      Nạp thành công: {importResult.summary.classesImported} Lớp học phần ({importResult.summary.sessionsCreated} Ca học)
                    </>
                  ) : (
                    <>
                      Nạp thành công: {currentSuccessCount} {currentTargetLabel}
                    </>
                  )}
                </div>
                <div className="text-xs text-green-700 mt-1 flex items-center gap-2 flex-wrap">
                  {importTab === "STUDENT" && (
                    <>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                        🆕 {importResult.summary.studentsCreated || 0} thêm mới
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded">
                        🔄 {importResult.summary.studentsUpdated || 0} đã có trong CSDL (cập nhật đè)
                      </span>
                    </>
                  )}
                  {importTab === "TEACHER" && (
                    <>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                        🆕 {importResult.summary.teachersCreated || 0} thêm mới
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded">
                        🔄 {importResult.summary.teachersUpdated || 0} đã có trong CSDL (cập nhật đè)
                      </span>
                    </>
                  )}
                  {importTab === "SCHEDULE" && (
                    <>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded">
                        🆕 {importResult.summary.classesCreated || 0} lớp mới
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded">
                        🔄 {importResult.summary.classesUpdated || 0} lớp cập nhật lại lịch
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5. Hộp cảnh báo lỗi theo từng dòng */}
          {importResult && currentWarnings.length > 0 && (
            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 8,
                padding: "12px 16px",
              }}
              className="flex items-start gap-3"
            >
              <WarningFilled style={{ color: "#f59e0b", fontSize: 20, marginTop: 2 }} />
              <div className="w-full">
                <div className="font-bold text-sm text-amber-900 mb-1">
                  Cảnh báo lỗi {String(currentWarnings.length).padStart(2, "0")} dòng:
                </div>
                <ul className="text-xs text-amber-800 space-y-1 list-disc pl-4 max-h-32 overflow-y-auto">
                  {currentWarnings.map((w, idx) => (
                    <li key={idx}>
                      <span className="font-semibold">Dòng {w.row}:</span> {w.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 6. Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button onClick={handleCloseImportModal} disabled={importing}>
              Đóng / Hủy Bỏ
            </Button>
            <Button
              type="primary"
              onClick={handleConfirmFinish}
              disabled={importing || !importResult}
              style={{
                background: importResult ? "#10b981" : undefined,
                borderColor: importResult ? "#10b981" : undefined,
                fontWeight: 600,
              }}
            >
              Xác Nhận Hoàn Tất
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
