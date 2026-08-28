import { Card, Row, Col, Statistic, Alert, Table, Tag, Progress, Typography } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";
import type { StudentDashboardData } from "@/types";
import { useAuthStore } from "@/stores/authStore";

const { Title, Text } = Typography;

// =============================================================================
// Student Dashboard — GET /api/v1/student/dashboard (§5.1)
// =============================================================================

export function StudentDashboard() {
  const user = useAuthStore((s) => s.user)!;

  const { data, isLoading } = useQuery<StudentDashboardData>({
    queryKey: ["student-dashboard"],
    queryFn: () => api.get("/student/dashboard") as Promise<StudentDashboardData>,
  });

  const columns = [
    { title: "Mã HP", dataIndex: "courseCode", key: "courseCode", width: 100 },
    { title: "Tên học phần", dataIndex: "courseName", key: "courseName" },
    { title: "Phòng", dataIndex: "room", key: "room", width: 90 },
    { title: "Tiến độ", dataIndex: "progress", key: "progress", width: 110 },
    {
      title: "Tỉ lệ",
      dataIndex: "attendanceRate",
      key: "attendanceRate",
      width: 100,
      render: (rate: number) => <Progress percent={rate} size="small" strokeColor={rate >= 80 ? "#10b981" : rate >= 60 ? "#d97706" : "#dc2626"} />,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => (
        <Tag color={status === "SAFE" ? "success" : status === "WARNING" ? "warning" : "error"}>
          {status === "SAFE" ? "An toàn" : status === "WARNING" ? "Cảnh báo" : "Nguy hiểm"}
        </Tag>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <Card className="kpi-card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Xin chào, {user.fullName} 👋
            </Title>
            <Text type="secondary">
              Hệ thống ghi nhận trạng thái học tập của bạn theo thời gian thực.
            </Text>
          </div>
          <Tag color="blue" className="text-sm px-3 py-1">
            MSSV: {user.userCode}
          </Tag>
        </div>
      </Card>

      {/* Urgent Alert */}
      {data?.urgentAlert?.hasRisk && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message="Chú ý chuyên cần"
          description={data.urgentAlert.message}
          banner
        />
      )}

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card">
            <Statistic
              title="Chuyên cần tổng thể"
              value={data?.overallRate ?? 0}
              suffix="%"
              precision={1}
              valueStyle={{ color: "#2563eb", fontWeight: 800, fontSize: 28 }}
            />
            <Text type="secondary">{data?.ranking ?? "—"}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card">
            <Statistic
              title="Buổi đúng giờ"
              value={data?.stats?.onTimeCount ?? 0}
              prefix={<CheckCircleOutlined style={{ color: "#10b981" }} />}
              valueStyle={{ color: "#10b981" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card">
            <Statistic
              title="Buổi đi muộn"
              value={data?.stats?.lateCount ?? 0}
              prefix={<ClockCircleOutlined style={{ color: "#d97706" }} />}
              valueStyle={{ color: "#d97706" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card">
            <Statistic
              title="Buổi vắng"
              value={(data?.stats?.unexcusedAbsentCount ?? 0) + (data?.stats?.excusedAbsentCount ?? 0)}
              prefix={<CloseCircleOutlined style={{ color: "#dc2626" }} />}
              valueStyle={{ color: "#dc2626" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Enrolled Courses */}
      <Card title="Danh sách học phần đăng ký" extra={<Tag icon={<SafetyCertificateOutlined />}>{data?.semester ?? ""}</Tag>}>
        <Table
          columns={columns}
          dataSource={data?.enrolledCourses ?? []}
          rowKey="courseCode"
          loading={isLoading}
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
}
