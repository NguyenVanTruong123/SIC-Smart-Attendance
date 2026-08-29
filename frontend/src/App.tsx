import { useEffect, useState } from "react";
import { ConfigProvider, Dropdown, Spin, theme } from "antd";
import {
  AuditOutlined,
  BarChartOutlined,
  BookOutlined,
  CameraOutlined,
  DashboardOutlined,
  FileProtectOutlined,
  IdcardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ScheduleOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import api from "@/utils/api";
import type { AnyPage, User } from "@/types";
import { Login } from "@/components/auth/Login";
import { Profile } from "@/components/common/Profile";
import { StudentDashboard } from "@/components/student/StudentDashboard";
import { AttendanceHistory } from "@/components/student/AttendanceHistory";
import { Enrollment } from "@/components/student/Enrollment";
import { TeacherSchedule } from "@/components/teacher/TeacherSchedule";
import { TeacherScan } from "@/components/teacher/TeacherScan";
import { TeacherLeaveRequests } from "@/components/teacher/TeacherLeaveRequests";
import { TeacherReports } from "@/components/teacher/TeacherReports";
import { AdminQuickOverview } from "@/components/admin/AdminQuickOverview";
import { AdminBiometrics } from "@/components/admin/AdminBiometrics";
import { AdminClassrooms } from "@/components/admin/AdminClassrooms";
import { AdminClasses } from "@/components/admin/AdminClasses";
import { AdminAuditLogs } from "@/components/admin/AdminAuditLogs";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

type NavigationItem = { key: AnyPage; icon: React.ReactNode; label: string };

const studentMenu: NavigationItem[] = [
  { key: "dashboard", icon: <DashboardOutlined />, label: "Trang chủ" },
  { key: "enrollment", icon: <CameraOutlined />, label: "Đăng ký khuôn mặt" },
  { key: "attendance", icon: <ScheduleOutlined />, label: "Kết quả điểm danh" },
  { key: "profile", icon: <UserOutlined />, label: "Thông tin cá nhân" },
];

const teacherMenu: NavigationItem[] = [
  { key: "schedule", icon: <DashboardOutlined />, label: "Lớp giảng dạy" },
  { key: "scan", icon: <VideoCameraOutlined />, label: "Điểm danh AI" },
  { key: "leave_requests", icon: <FileProtectOutlined />, label: "Duyệt đơn nghỉ" },
  { key: "reports", icon: <BarChartOutlined />, label: "Báo cáo chuyên cần" },
  { key: "profile", icon: <UserOutlined />, label: "Tài khoản cá nhân" },
];

const adminMenu: NavigationItem[] = [
  { key: "dashboard", icon: <DashboardOutlined />, label: "Tổng quan" },
  { key: "biometrics", icon: <IdcardOutlined />, label: "Quản lý sinh trắc học" },
  { key: "classrooms", icon: <VideoCameraOutlined />, label: "Phòng học & camera" },
  { key: "classes", icon: <BookOutlined />, label: "Môn & lớp học phần" },
  { key: "audit", icon: <AuditOutlined />, label: "Nhật ký hệ thống" },
  { key: "profile", icon: <UserOutlined />, label: "Tài khoản cá nhân" },
];

const roleLabels: Record<string, string> = {
  ADMIN: "Quản trị viên",
  TEACHER: "Giảng viên",
  STUDENT: "Sinh viên",
};

function AppShell() {
  const { user, logout } = useAuthStore();
  const [page, setPage] = useState<AnyPage>(user?.role === "TEACHER" ? "schedule" : "dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>();

  if (!user) return null;

  const menuItems = user.role === "STUDENT" ? studentMenu : user.role === "TEACHER" ? teacherMenu : adminMenu;
  const handleLogout = () => {
    logout();
    queryClient.clear();
  };

  let content: React.ReactNode = null;
  if (user.role === "STUDENT") {
    switch (page) {
      case "dashboard": content = <StudentDashboard />; break;
      case "attendance": content = <AttendanceHistory />; break;
      case "enrollment": content = <Enrollment />; break;
      case "profile": content = <Profile />; break;
    }
  } else if (user.role === "TEACHER") {
    switch (page) {
      case "schedule":
      case "dashboard":
        content = <TeacherSchedule onStartScan={(sessionId) => { setSelectedSession(sessionId); setPage("scan"); }} />;
        break;
      case "scan": content = <TeacherScan initialSessionId={selectedSession} />; break;
      case "leave_requests": content = <TeacherLeaveRequests />; break;
      case "reports": content = <TeacherReports />; break;
      case "profile": content = <Profile />; break;
    }
  } else {
    switch (page) {
      case "dashboard": content = <AdminQuickOverview />; break;
      case "biometrics": content = <AdminBiometrics />; break;
      case "classrooms": content = <AdminClassrooms />; break;
      case "classes": content = <AdminClasses />; break;
      case "audit": content = <AdminAuditLogs />; break;
      case "profile": content = <Profile />; break;
    }
  }

  return (
    <div className={`portal-shell ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="portal-sidebar">
        {!collapsed && (
          <div className="portal-user-brief">
            <span className="portal-avatar" aria-hidden="true">{user.fullName.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{user.fullName}</strong>
              <small>{user.userCode}</small>
            </div>
          </div>
        )}
        <nav className="portal-navigation" aria-label="Chức năng học vụ">
          {!collapsed && <span className="portal-nav-title">HỌC VỤ</span>}
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`portal-nav-item ${page === item.key ? "is-active" : ""}`}
              aria-current={page === item.key ? "page" : undefined}
              onClick={() => setPage(item.key)}
            >
              <span className="portal-nav-icon" aria-hidden="true">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        {!collapsed && <p className="portal-sidebar-footer">{roleLabels[user.role]} · Hệ thống điểm danh AI</p>}
      </aside>

      <div className="portal-app">
        <header className="portal-header">
          <button
            className="portal-collapse-button"
            type="button"
            aria-label={collapsed ? "Mở thanh điều hướng" : "Thu gọn thanh điều hướng"}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
          <strong className="portal-title">CỔNG THÔNG TIN ĐÀO TẠO</strong>
          <Dropdown
            menu={{
              items: [
                { key: "profile", icon: <UserOutlined />, label: "Tài khoản cá nhân", onClick: () => setPage("profile") },
                { type: "divider" },
                { key: "logout", icon: <LogoutOutlined />, label: "Đăng xuất", danger: true, onClick: handleLogout },
              ],
            }}
            trigger={["click"]}
          >
            <button className="portal-header-avatar" type="button" aria-label="Mở menu tài khoản">
              <UserOutlined aria-hidden="true" />
            </button>
          </Dropdown>
        </header>
        <main className="portal-content">{content}</main>
      </div>
    </div>
  );
}

export function App() {
  const { user, accessToken, setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/me")
      .then((data) => setUser(data as unknown as User))
      .catch(() => useAuthStore.getState().logout())
      .finally(() => setLoading(false));
  }, [accessToken, setUser]);

  if (loading) {
    return <div className="login-page"><Spin size="large" tip="Đang tải cổng học vụ SPAS..." /></div>;
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#a10000",
          borderRadius: 4,
          fontFamily: "Inter, Segoe UI, Arial, sans-serif",
          colorSuccess: "#166534",
          colorWarning: "#92400e",
          colorError: "#b91c1c",
          colorInfo: "#2563eb",
        },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <QueryClientProvider client={queryClient}>
        {user && accessToken ? <AppShell /> : <Login />}
      </QueryClientProvider>
    </ConfigProvider>
  );
}
