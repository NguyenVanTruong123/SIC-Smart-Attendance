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
  const [username, setUsername] = useState("admin@vnu.edu.vn");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuthStore();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api.post<LoginResponse>("/auth/login", { username, password });
      const res = data as unknown as LoginResponse;
      login(res.accessToken, res.refreshToken, res.user);
      message.success("Đăng nhập thành công!");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const quickSelect = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
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

        {/* Login Form */}
        <form onSubmit={submit}>
          <Form layout="vertical" size="large">
            <Form.Item label="Tài khoản (Email / MSSV)">
              <Input
                prefix={<UserOutlined />}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="VD: admin@vnu.edu.vn"
                required
              />
            </Form.Item>

            <Form.Item label="Mật khẩu">
              <Input.Password
                prefix={<LockOutlined />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
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
        </form>

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
            <Button size="small" onClick={() => quickSelect("admin@vnu.edu.vn", "Admin@123")}>
              🛡️ Quản trị viên
            </Button>
            <Button size="small" onClick={() => quickSelect("gv.nguyenvanan@vnu.edu.vn", "Teacher@123")}>
              👨‍🏫 Giảng viên
            </Button>
            <Button size="small" onClick={() => quickSelect("21020001@vnu.edu.vn", "Student@123")}>
              🎓 Sinh viên
            </Button>
          </Space>
        </div>
      </div>
    </main>
  );
}
