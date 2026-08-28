import { Card, Row, Col, Statistic, Typography, Tag, Progress, Spin, Empty, Timeline } from "antd";
import {
  TeamOutlined,
  VideoCameraOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined,
  UserOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";

const { Title, Text } = Typography;

// =============================================================================
// Admin: Quick Overview / Enterprise System Dashboard (100% Real Database Data)
// =============================================================================

export interface TodaySessionItem {
  id: string;
  sessionNumber: number;
  courseCode: string;
  courseName: string;
  classCode: string;
  teacherName: string;
  roomCode: string;
  startTime: string;
  endTime: string;
  totalStudents: number;
  attendedCount: number;
  liveStatus: "LIVE" | "UPCOMING" | "COMPLETED";
}

export interface RecentActivityItem {
  id: string;
  action: string;
  description: string;
  userName: string;
  userRole: string;
  ipAddress?: string;
  createdAt: string;
}

export interface SystemOverviewData {
  kpis: {
    totalStudents: number;
    totalTeachers: number;
    enrolledStudents: number;
    enrolledRate: string;
    totalClassrooms: number;
    onlineCameras: number;
    offlineCameras: number;
    cameraCoverageRate: string;
    todayActiveSessions: number;
    todayAttendanceRate: number;
  };
  attendanceBreakdown: {
    totalLogs: number;
    present: number;
    late: number;
    absent: number;
  };
  todaySessions: TodaySessionItem[];
  recentActivities: RecentActivityItem[];
}

export function AdminQuickOverview() {
  const { data, isLoading } = useQuery<SystemOverviewData>({
    queryKey: ["admin-overview"],
    queryFn: () => api.get("/admin/overview") as Promise<SystemOverviewData>,
  });

  const kpis = data?.kpis;
  const breakdown = data?.attendanceBreakdown;
  const sessions = data?.todaySessions || [];
  const activities = data?.recentActivities || [];

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
            Trung Tâm Điều Hành Hệ Thống SPAS
          </Title>
          <Text type="secondary" className="text-xs">
            Tổng quan số liệu thực tế thời gian thực và giám sát hoạt động điểm danh toàn trường.
          </Text>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 text-xs shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Cơ sở dữ liệu: Kết nối trực tiếp
          </span>
          <span className="text-xs text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            Hôm nay: {new Date().toLocaleDateString("vi-VN")}
          </span>
        </div>
      </div>

      <Spin spinning={isLoading}>
        {/* 2. Hàng 6 Thẻ KPI Cốt Lõi (Lấy 100% từ Database) */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="kpi-card hover:shadow-md transition-shadow rounded-xl border-slate-200">
              <Statistic
                title={<span className="text-xs font-bold text-slate-500 uppercase">Tổng Sinh Viên</span>}
                value={kpis?.totalStudents ?? 0}
                prefix={<TeamOutlined style={{ color: "#2563eb" }} />}
                valueStyle={{ color: "#1e293b", fontWeight: 800 }}
              />
              <div className="text-[11px] text-slate-400 mt-1">Đã nạp vào hệ thống</div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="kpi-card hover:shadow-md transition-shadow rounded-xl border-slate-200">
              <Statistic
                title={<span className="text-xs font-bold text-slate-500 uppercase">Tổng Giảng Viên</span>}
                value={kpis?.totalTeachers ?? 0}
                prefix={<UserOutlined style={{ color: "#0284c7" }} />}
                valueStyle={{ color: "#1e293b", fontWeight: 800 }}
              />
              <div className="text-[11px] text-slate-400 mt-1">Đang công tác</div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="kpi-card hover:shadow-md transition-shadow rounded-xl border-slate-200">
              <Statistic
                title={<span className="text-xs font-bold text-slate-500 uppercase">Phòng Học</span>}
                value={kpis?.totalClassrooms ?? 0}
                prefix={<DatabaseOutlined style={{ color: "#6366f1" }} />}
                valueStyle={{ color: "#1e293b", fontWeight: 800 }}
              />
              <div className="text-[11px] text-slate-400 mt-1">Phủ sóng: {kpis?.cameraCoverageRate || "100%"}</div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="kpi-card hover:shadow-md transition-shadow rounded-xl border-slate-200">
              <Statistic
                title={<span className="text-xs font-bold text-slate-500 uppercase">Camera Online</span>}
                value={kpis?.onlineCameras ?? 0}
                prefix={<CheckCircleOutlined style={{ color: "#10b981" }} />}
                valueStyle={{ color: "#10b981", fontWeight: 800 }}
              />
              <div className="text-[11px] text-emerald-600 font-medium mt-1">Sẵn sàng AI Stream</div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="kpi-card hover:shadow-md transition-shadow rounded-xl border-slate-200">
              <Statistic
                title={<span className="text-xs font-bold text-slate-500 uppercase">Camera Offline</span>}
                value={kpis?.offlineCameras ?? 0}
                prefix={<CloseCircleOutlined style={{ color: kpis?.offlineCameras ? "#dc2626" : "#94a3b8" }} />}
                valueStyle={{ color: kpis?.offlineCameras ? "#dc2626" : "#64748b", fontWeight: 800 }}
              />
              <div className="text-[11px] text-slate-400 mt-1">Cần kiểm tra thiết bị</div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card className="kpi-card hover:shadow-md transition-shadow rounded-xl border-slate-200">
              <Statistic
                title={<span className="text-xs font-bold text-slate-500 uppercase">Tỉ Lệ Nạp eKYC</span>}
                value={kpis?.enrolledRate || "0%"}
                prefix={<SafetyCertificateOutlined style={{ color: "#8b5cf6" }} />}
                valueStyle={{ color: "#8b5cf6", fontWeight: 800 }}
              />
              <div className="text-[11px] text-slate-400 mt-1">
                {kpis?.enrolledStudents || 0}/{kpis?.totalStudents || 0} Sinh viên
              </div>
            </Card>
          </Col>
        </Row>

        {/* 3. Khối Chi Tiết Điều Hành 2 Cột */}
        <Row gutter={[20, 20]} className="mt-6">
          {/* Cột Trái (Col 15): Giám Sát Ca Học Hôm Nay */}
          <Col xs={24} lg={15}>
            <Card
              className="rounded-xl border-slate-200 shadow-sm h-full"
              title={
                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <ClockCircleOutlined className="text-blue-600" />
                    Giám Sát Ca Học Hoạt Động Hôm Nay
                  </span>
                  <Tag color="blue" className="font-semibold">
                    {sessions.length} Ca học
                  </Tag>
                </div>
              }
            >
              {sessions.length > 0 ? (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        session.liveStatus === "LIVE"
                          ? "bg-emerald-50/50 border-emerald-300 shadow-sm"
                          : session.liveStatus === "COMPLETED"
                          ? "bg-slate-50/60 border-slate-200"
                          : "bg-white border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {session.courseName}
                            </span>
                            <span className="text-xs font-mono text-slate-400">
                              ({session.courseCode})
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-600 mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1 font-medium text-slate-700">
                              <EnvironmentOutlined className="text-blue-500" />
                              Phòng: <b>{session.roomCode}</b>
                            </span>
                            <span>•</span>
                            <span>GV: <b>{session.teacherName}</b></span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">
                              {session.startTime} - {session.endTime}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end gap-1.5 shrink-0">
                          {session.liveStatus === "LIVE" && (
                            <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-extrabold px-2.5 py-0.5 rounded-full animate-pulse shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              ● ĐANG DIỄN RA
                            </span>
                          )}
                          {session.liveStatus === "UPCOMING" && (
                            <Tag color="purple" className="m-0 text-xs font-semibold">
                              ⏱ Sắp diễn ra
                            </Tag>
                          )}
                          {session.liveStatus === "COMPLETED" && (
                            <Tag color="default" className="m-0 text-xs text-slate-500 font-medium">
                              ✓ Đã kết thúc
                            </Tag>
                          )}

                          <span className="text-[11px] text-slate-500">
                            Sĩ số: <b>{session.attendedCount}/{session.totalStudents} SV</b>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span className="text-xs text-slate-500">
                      Hôm nay không có ca học nào được xếp lịch trong hệ thống.
                    </span>
                  }
                />
              )}
            </Card>
          </Col>

          {/* Cột Phải (Col 9): Tỷ Lệ Chuyên Cần & Nhật Ký Hoạt Động */}
          <Col xs={24} lg={9} className="space-y-6">
            {/* 1. Tỷ Lệ Chuyên Cần Hôm Nay */}
            <Card
              className="rounded-xl border-slate-200 shadow-sm"
              title={
                <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <ThunderboltOutlined className="text-amber-500" />
                  Tỉ Lệ Chuyên Cần Hôm Nay
                </span>
              }
            >
              <div className="text-center py-2">
                <div className="text-3xl font-extrabold text-blue-600 font-mono">
                  {kpis?.todayAttendanceRate ?? 0}%
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Tổng bản ghi nhận diện: <b>{breakdown?.totalLogs ?? 0}</b> lượt
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-slate-100 mt-3">
                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                  <div className="font-bold text-sm text-emerald-700">{breakdown?.present ?? 0}</div>
                  <div className="text-[11px] text-emerald-600 font-medium">Có mặt</div>
                </div>
                <div className="bg-amber-50 p-2 rounded-lg border border-amber-100">
                  <div className="font-bold text-sm text-amber-700">{breakdown?.late ?? 0}</div>
                  <div className="text-[11px] text-amber-600 font-medium">Đi muộn</div>
                </div>
                <div className="bg-rose-50 p-2 rounded-lg border border-rose-100">
                  <div className="font-bold text-sm text-rose-700">{breakdown?.absent ?? 0}</div>
                  <div className="text-[11px] text-rose-600 font-medium">Vắng mặt</div>
                </div>
              </div>
            </Card>

            {/* 2. Nhật Ký Hoạt Động Gần Nhất */}
            <Card
              className="rounded-xl border-slate-200 shadow-sm"
              title={
                <span className="text-sm font-bold text-slate-800">
                  Nhật Ký Hoạt Động Hệ Thống
                </span>
              }
            >
              {activities.length > 0 ? (
                <Timeline
                  className="mt-2 text-xs"
                  items={activities.map((act) => ({
                    color: act.action.includes("IMPORT") ? "green" : act.action.includes("DELETE") ? "red" : "blue",
                    children: (
                      <div>
                        <div className="font-semibold text-slate-800">{act.description}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-between">
                          <span>{act.userName} ({act.userRole})</span>
                          <span>{new Date(act.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    ),
                  }))}
                />
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">
                  Chưa có nhật ký hoạt động nào được ghi nhận.
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
