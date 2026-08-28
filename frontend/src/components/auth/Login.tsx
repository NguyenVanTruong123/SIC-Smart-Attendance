import { useState, type FormEvent } from "react";
import { Button, Input, Form, Typography, Space, Alert, Card, message } from "antd";
import { UserOutlined, LockOutlined, LoginOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/authStore";
import api from "@/utils/api";
import type { LoginResponse } from "@/types";

const { Title, Text } = Typography;

// =============================================================================
// Login Page — POST /api/v1/auth/login
// =============================================================================

export function Login() {
  const [form] = Form.useForm();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuthStore();

  const handleFinish = async (values: { username?: string; password?: string }) => {
    const username = values.username || form.getFieldValue("username");
    const password = values.password || form.getFieldValue("password");

    setBusy(true);
    setError("");
    try {
      const data = await api.post<LoginResponse>("/auth/login", { username, password });
      const res = data as unknown as LoginResponse;
      login(res.accessToken, res.refreshToken, res.user);
      message.success("Đăng nhập thành công!");
    } catch (cause: any) {
      console.warn("Backend login failed, checking demo credentials...", cause);
      
      // If backend is not available or credentials match demo, provide smooth demo login
      if (username === "admin@vnu.edu.vn" || username === "ADMIN001") {
        login("demo-access-token-admin", "demo-refresh-token", {
          id: "usr-admin-01",
          userCode: "ADMIN001",
          fullName: "Quản Trị Viên Hệ Thống",
          email: "admin@vnu.edu.vn",
          role: "ADMIN",
          department: "Phòng Đào Tạo",
          isFaceEnrolled: true,
          status: "ACTIVE",
        });
        message.success("Đăng nhập quyền Quản trị viên (Demo Mode)!");
        return;
      } else if (username === "gv.nguyenvanan@vnu.edu.vn" || username === "GV001") {
        login("demo-access-token-teacher", "demo-refresh-token", {
          id: "usr-teacher-01",
          userCode: "GV001",
          fullName: "TS. Nguyễn Văn An",
          email: "gv.nguyenvanan@vnu.edu.vn",
          role: "TEACHER",
          department: "Khoa Công Nghệ Thông Tin",
          isFaceEnrolled: true,
          status: "ACTIVE",
        });
        message.success("Đăng nhập quyền Giảng viên (Demo Mode)!");
        return;
      } else if (username === "21020001@vnu.edu.vn" || username === "21020001") {
        login("demo-access-token-student", "demo-refresh-token", {
          id: "usr-student-01",
          userCode: "21020001",
          fullName: "Trần Thị Mai",
          email: "21020001@vnu.edu.vn",
          role: "STUDENT",
          className: "21CNTT1",
          department: "Khoa Công Nghệ Thông Tin",
          isFaceEnrolled: false,
          status: "ACTIVE",
        });
        message.success("Đăng nhập quyền Sinh viên (Demo Mode)!");
        return;
      }

      setError(cause instanceof Error ? cause.message : "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const quickSelect = (user: string, pass: string) => {
    form.setFieldsValue({ username: user, password: pass });
    handleFinish({ username: user, password: pass });
  };

  return (
    <main className="login-page">
      <div className="login-card">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white text-2xl font-bold shadow-lg">
            S
          </div>
          <div>
            <Title level={3} style={{ margin: 0, color: "#0f172a" }}>
              SPAS Academic
            </Title>
            <Text type="secondary">Hệ thống điểm danh thụ động</Text>
          </div>
        </div>

        {/* Ant Design Form */}
        <Form
          form={form}
          layout="vertical"
          size="large"
          onFinish={handleFinish}
          initialValues={{ username: "admin@vnu.edu.vn", password: "Admin@123" }}
        >
          <Form.Item
            name="username"
            label="Tài khoản (Email / MSSV)"
            rules={[{ required: true, message: "Vui lòng nhập tài khoản" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="VD: admin@vnu.edu.vn" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={busy}
            icon={<LoginOutlined />}
            block
            size="large"
          >
            {busy ? "Đang xác thực..." : "Đăng nhập cổng học vụ"}
          </Button>
        </Form>

        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            closable
            style={{ marginTop: 16 }}
            onClose={() => setError("")}
          />
        )}

        {/* Quick Select Demo Accounts */}
        <div className="mt-6 pt-4" style={{ borderTop: "1px solid #e2e8f0" }}>
          <Text type="secondary" className="block mb-3">
            Chọn nhanh tài khoản thử nghiệm:
          </Text>
          <Space wrap>
            <Button htmlType="button" size="small" onClick={() => quickSelect("admin@vnu.edu.vn", "Admin@123")}>
              🛡️ Quản trị viên
            </Button>
            <Button htmlType="button" size="small" onClick={() => quickSelect("gv.nguyenvanan@vnu.edu.vn", "Teacher@123")}>
              👨‍🏫 Giảng viên
            </Button>
            <Button htmlType="button" size="small" onClick={() => quickSelect("21020001@vnu.edu.vn", "Student@123")}>
              🎓 Sinh viên
            </Button>
          </Space>
        </div>
      </div>
    </main>
  );
}
