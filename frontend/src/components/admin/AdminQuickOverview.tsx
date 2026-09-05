import { Alert, Card, Empty, Spin, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";

export interface TodaySessionItem {
  id: string;
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
  createdAt: string;
}

interface SystemOverviewData {
  kpis: {
    totalStudents: number;
    totalTeachers: number;
    enrolledStudents: number;
    enrolledRate: string;
    totalClassrooms: number;
    onlineCameras: number;
    offlineCameras: number;
    todayActiveSessions: number;
    todayAttendanceRate: number;
  };
  attendanceBreakdown: { totalLogs: number; present: number; late: number; absent: number };
  todaySessions: TodaySessionItem[];
  recentActivities: RecentActivityItem[];
}

export function AdminQuickOverview() {
  const { data, isLoading, isError } = useQuery<SystemOverviewData>({
    queryKey: ["admin-overview"],
    queryFn: () => api.get("/admin/overview") as Promise<SystemOverviewData>,
  });

  const kpis = data?.kpis;
  const sessions = data?.todaySessions ?? [];
  const activities = data?.recentActivities ?? [];

  return (
    <section aria-labelledby="admin-overview-title">
      <div className="page-heading">
        <div>
          <h1 id="admin-overview-title">Tổng quan</h1>
          <p>Quản lý lịch học, camera và trạng thái điểm danh toàn trường.</p>
        </div>
        <Tag color="success">Hệ thống đang hoạt động</Tag>
      </div>
      {isError && <Alert className="portal-alert" type="warning" showIcon message="Chưa tải được dữ liệu tổng quan" description="Backend chưa phản hồi endpoint GET /api/v1/admin/overview." />}

      <Spin spinning={isLoading}>
        <div className="dashboard-metrics admin-metrics">
          <article className="portal-metric"><strong>{kpis?.totalStudents ?? 0}</strong><span>Sinh viên</span></article>
          <article className="portal-metric"><strong>{kpis?.totalTeachers ?? 0}</strong><span>Giảng viên</span></article>
          <article className="portal-metric"><strong>{kpis?.totalClassrooms ?? 0}</strong><span>Phòng học</span></article>
          <article className="portal-metric"><strong>{kpis?.onlineCameras ?? 0}/{(kpis?.onlineCameras ?? 0) + (kpis?.offlineCameras ?? 0)}</strong><span>Camera sẵn sàng</span></article>
          <article className="portal-metric"><strong>{kpis?.enrolledRate ?? "0%"}</strong><span>Đã đăng ký khuôn mặt</span></article>
        </div>

        <div className="admin-overview-grid">
          <Card className="portal-card" title="Ca học hôm nay">
            {sessions.length ? <div className="course-list">
              {sessions.map((session) => (
                <article className={`course-session ${session.liveStatus === "LIVE" ? "teacher-session is-live" : ""}`} key={session.id}>
                  <div>
                    <strong>{session.courseCode} · {session.courseName}</strong>
                    <span>{session.classCode} · {session.roomCode} · GV {session.teacherName} · {session.startTime}–{session.endTime}</span>
                  </div>
                  <div className="course-session-meta">
                    <strong>{session.attendedCount}/{session.totalStudents}</strong>
                    <Tag color={session.liveStatus === "LIVE" ? "success" : session.liveStatus === "UPCOMING" ? "processing" : "default"}>
                      {session.liveStatus === "LIVE" ? "Đang diễn ra" : session.liveStatus === "UPCOMING" ? "Sắp diễn ra" : "Đã kết thúc"}
                    </Tag>
                  </div>
                </article>
              ))}
            </div> : <Empty description="Hôm nay chưa có ca học." image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
          <Card className="portal-card" title="Hoạt động gần đây">
            {activities.length ? <div className="activity-list">
              {activities.slice(0, 6).map((activity) => (
                <article key={activity.id}>
                  <strong>{activity.description}</strong>
                  <span>{activity.userName} · {new Date(activity.createdAt).toLocaleString("vi-VN")}</span>
                </article>
              ))}
            </div> : <Empty description="Chưa có hoạt động gần đây." image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </div>
      </Spin>
    </section>
  );
}
