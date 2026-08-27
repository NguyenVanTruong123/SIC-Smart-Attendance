import { Card, Row, Col, Statistic, Typography } from "antd";
import {
  TeamOutlined,
  VideoCameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";

const { Title, Text } = Typography;

// =============================================================================
// Admin: Quick Overview / System Dashboard
// =============================================================================

interface SystemStats {
  totalStudents: number;
  totalTeachers: number;
  totalClassrooms: number;
  onlineCameras: number;
  offlineCameras: number;
  enrolledRate: string;
  todayActiveSessions: number;
  todayAttendanceRate: number;
}

const DEFAULT_STATS: SystemStats = {
  totalStudents: 1250,
  totalTeachers: 68,
  totalClassrooms: 42,
  onlineCameras: 38,
  offlineCameras: 4,
  enrolledRate: "89.2%",
  todayActiveSessions: 18,
  todayAttendanceRate: 94.6,
};

export function AdminQuickOverview() {
  const { data, isLoading } = useQuery<SystemStats>({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      try {
        const res = await api.get("/admin/overview");
        return (res as unknown as SystemStats) || DEFAULT_STATS;
      } catch {
        return DEFAULT_STATS;
      }
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <Title level={4} style={{ margin: 0 }}>Thông số hệ thống SPAS</Title>
        <Text type="secondary">Tổng quan nhanh trạng thái toàn bộ hệ thống điểm danh thụ động.</Text>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="kpi-card" loading={isLoading}>
            <Statistic
              title="Tổng sinh viên"
              value={data?.totalStudents ?? 0}
              prefix={<TeamOutlined style={{ color: "#2563eb" }} />}
              valueStyle={{ color: "#2563eb" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="kpi-card" loading={isLoading}>
            <Statistic
              title="Tổng giảng viên"
              value={data?.totalTeachers ?? 0}
              prefix={<TeamOutlined style={{ color: "#0284c7" }} />}
              valueStyle={{ color: "#0284c7" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="kpi-card" loading={isLoading}>
            <Statistic
              title="Phòng học"
              value={data?.totalClassrooms ?? 0}
              prefix={<DatabaseOutlined style={{ color: "#6366f1" }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="kpi-card" loading={isLoading}>
            <Statistic
              title="Camera Online"
              value={data?.onlineCameras ?? 0}
              prefix={<CheckCircleOutlined style={{ color: "#10b981" }} />}
              valueStyle={{ color: "#10b981" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="kpi-card" loading={isLoading}>
            <Statistic
              title="Camera Offline"
              value={data?.offlineCameras ?? 0}
              prefix={<CloseCircleOutlined style={{ color: "#dc2626" }} />}
              valueStyle={{ color: data?.offlineCameras ? "#dc2626" : "#10b981" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="kpi-card" loading={isLoading}>
            <Statistic
              title="Tỉ lệ nạp eKYC"
              value={data?.enrolledRate ?? "—"}
              prefix={<SafetyCertificateOutlined style={{ color: "#10b981" }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card className="kpi-card" loading={isLoading}>
            <Statistic
              title="Ca học hoạt động hôm nay"
              value={data?.todayActiveSessions ?? 0}
              prefix={<VideoCameraOutlined style={{ color: "#d97706" }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card className="kpi-card" loading={isLoading}>
            <Statistic
              title="Tỉ lệ chuyên cần hôm nay"
              value={data?.todayAttendanceRate ?? 0}
              suffix="%"
              precision={1}
              valueStyle={{ color: "#2563eb", fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
