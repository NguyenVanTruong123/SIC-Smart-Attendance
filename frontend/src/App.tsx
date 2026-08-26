import { useEffect, useState } from "react";
import { ConfigProvider, Layout, Menu, Dropdown, Avatar, Button, Spin, theme } from "antd";
import {
  DashboardOutlined,
  ScheduleOutlined,
  VideoCameraOutlined,
  FileProtectOutlined,
  BarChartOutlined,
  UserOutlined,
  CameraOutlined,
  IdcardOutlined,
  AuditOutlined,
  BookOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import api from "@/utils/api";
import type { AnyPage, User } from "@/types";

// Components
import { Login } from "@/components/auth/Login";
import { Profile } from "@/components/common/Profile";
import { StudentDashboard } from "@/components/student/StudentDashboard";
import { AttendanceHistory } from "@/components/student/AttendanceHistory";
import { StudentLeaveRequests } from "@/components/student/StudentLeaveRequests";
import { Enrollment } from "@/components/student/Enrollment";
import { StudentBiometricProfile } from "@/components/student/StudentBiometricProfile";
import { TeacherSchedule } from "@/components/teacher/TeacherSchedule";
import { TeacherScan } from "@/components/teacher/TeacherScan";
import { TeacherLeaveRequests } from "@/components/teacher/TeacherLeaveRequests";
import { TeacherReports } from "@/components/teacher/TeacherReports";
import { AdminQuickOverview } from "@/components/admin/AdminQuickOverview";
import { AdminBiometrics } from "@/components/admin/AdminBiometrics";
import { AdminClassrooms } from "@/components/admin/AdminClassrooms";
import { AdminClasses } from "@/components/admin/AdminClasses";
import { AdminAuditLogs } from "@/components/admin/AdminAuditLogs";

const { Sider, Header, Content } = Layout;
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// =============================================================================
// Menu items per role
// =============================================================================
const studentMenu: Array<{ key: AnyPage; icon: React.ReactNode; label: string }> = [
  { key: "dashboard", icon: <DashboardOutlined />, label: "Tổng quan" },
  { key: "attendance", icon: <ScheduleOutlined />, label: "Lịch sử điểm danh" },
  { key: "leave", icon: <FileProtectOutlined />, label: "Đơn xin nghỉ & muộn" },
  { key: "enrollment", icon: <CameraOutlined />, label: "Đăng ký khuôn mặt" },
  { key: "biometric", icon: <IdcardOutlined />, label: "Hồ sơ sinh trắc" },
  { key: "profile", icon: <UserOutlined />, label: "Tài khoản cá nhân" },
];

const teacherMenu: Array<{ key: AnyPage; icon: React.ReactNode; label: string }> = [
  { key: "schedule", icon: <ScheduleOutlined />, label: "Lịch giảng dạy" },
  { key: "scan", icon: <VideoCameraOutlined />, label: "Quét Camera điểm danh" },
  { key: "leave_requests", icon: <FileProtectOutlined />, label: "Duyệt đơn xin nghỉ" },
  { key: "reports", icon: <BarChartOutlined />, label: "Báo cáo chuyên cần" },
  { key: "profile", icon: <UserOutlined />, label: "Tài khoản cá nhân" },
];

const adminMenu: Array<{ key: AnyPage; icon: React.ReactNode; label: string }> = [
  { key: "dashboard", icon: <DashboardOutlined />, label: "Thông số hệ thống" },
  { key: "biometrics", icon: <IdcardOutlined />, label: "Quản lý Sinh trắc học" },
  { key: "classrooms", icon: <VideoCameraOutlined />, label: "Phòng học & Camera IP" },
  { key: "classes", icon: <BookOutlined />, label: "Môn & Lớp học phần" },
  { key: "audit", icon: <AuditOutlined />, label: "Nhật ký vết hệ thống" },
  { key: "profile", icon: <UserOutlined />, label: "Tài khoản cá nhân" },
];

const roleLabels: Record<string, string> = {
  ADMIN: "Quản trị viên SPAS",
  TEACHER: "Giảng viên",
  STUDENT: "Sinh viên",
};

// =============================================================================
// App Shell
// =============================================================================
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

  // Route content
  let content: React.ReactNode = null;
  if (user.role === "STUDENT") {
    switch (page) {
      case "dashboard": content = <StudentDashboard />; break;
      case "attendance": content = <AttendanceHistory />; break;
      case "leave": content = <StudentLeaveRequests />; break;
      case "enrollment": content = <Enrollment />; break;
      case "biometric": content = <StudentBiometricProfile />; break;
      case "profile": content = <Profile />; break;
    }
  } else if (user.role === "TEACHER") {
    switch (page) {
      case "schedule":
      case "dashboard":
        content = (
          <TeacherSchedule
            onStartScan={(sessionId: string) => {
              setSelectedSession(sessionId);
              setPage("scan");
            }}
          />
        );
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
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={260}
        theme="light"
        trigger={null}
        style={{ position: "fixed", height: "100vh", left: 0, top: 0, zIndex: 100 }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-white text-lg font-bold">
            S
          </div>
          {!collapsed && (
            <div>
              <div className="font-bold text-sm text-text-primary">SPAS Portal</div>
              <div className="text-xs text-text-muted">Academic v6.0</div>
            </div>
          )}
        </div>

        {/* User Info */}
        {!collapsed && (
          <div className="flex items-center gap-3 mx-4 mb-4 p-3 rounded-lg bg-canvas">
            <Avatar style={{ backgroundColor: "#2563eb" }} size={36}>
              {user.fullName.charAt(0).toUpperCase()}
            </Avatar>
            <div className="overflow-hidden">
              <div className="font-semibold text-sm truncate">{user.fullName}</div>
              <div className="text-xs text-text-muted">{roleLabels[user.role]}</div>
            </div>
          </div>
        )}

        <Menu
          mode="inline"
          selectedKeys={[page]}
          items={menuItems}
          onClick={({ key }) => setPage(key as AnyPage)}
          style={{ border: "none" }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 260, transition: "margin-left 0.2s" }}>
        <Header
          style={{
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 64,
            position: "sticky",
            top: 0,
            zIndex: 99,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted hidden sm:inline">
              Cổng thông tin Đào tạo
            </span>
            <Dropdown
              menu={{
                items: [
                  { key: "profile", icon: <UserOutlined />, label: "Hồ sơ cá nhân", onClick: () => setPage("profile") },
                  { type: "divider" },
                  { key: "logout", icon: <LogoutOutlined />, label: "Đăng xuất", danger: true, onClick: handleLogout },
                ],
              }}
              trigger={["click"]}
            >
              <Avatar style={{ backgroundColor: "#2563eb", cursor: "pointer" }} size={36}>
                {user.fullName.charAt(0).toUpperCase()}
              </Avatar>
            </Dropdown>
          </div>
        </Header>

        <Content className="page-content">{content}</Content>
      </Layout>
    </Layout>
  );
}

// =============================================================================
// Root App — Auth gate + providers
// =============================================================================
export function App() {
  const { user, accessToken, setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Restore session on mount
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="login-page">
        <Spin size="large" tip="Đang tải cổng học vụ SPAS..." />
      </div>
    );
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#2563eb",
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          colorSuccess: "#10b981",
          colorWarning: "#d97706",
          colorError: "#dc2626",
          colorInfo: "#0284c7",
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
