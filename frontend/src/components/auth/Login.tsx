import { useState } from "react";
import { Alert, Button, Form, Input, Typography, message } from "antd";
import { LockOutlined, LoginOutlined, UserOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/authStore";
import api from "@/utils/api";
import type { LoginResponse } from "@/types";

const { Title, Text } = Typography;

export function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuthStore();

  const handleFinish = async (values: { username: string; password: string }) => {
    setBusy(true);
    setError("");

    try {
      const result = (await api.post("/auth/login", values)) as unknown as LoginResponse;
      login(result.accessToken, result.refreshToken, result.user);
      message.success("Đăng nhập thành công.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-heading">
          <Text className="login-kicker">CỔNG HỌC VỤ</Text>
          <Title id="login-title" level={2}>Đăng nhập hệ thống</Title>
          <Text type="secondary">Dùng tài khoản được nhà trường cấp.</Text>
        </div>

        <Form layout="vertical" size="large" onFinish={handleFinish} autoComplete="on">
          <Form.Item
            name="username"
            label="Tài khoản"
            rules={[{ required: true, message: "Vui lòng nhập tài khoản." }]}
          >
            <Input
              autoComplete="username"
              prefix={<UserOutlined />}
              placeholder="Mã sinh viên, mã giảng viên hoặc email"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu." }]}
          >
            <Input.Password autoComplete="current-password" prefix={<LockOutlined />} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy} icon={<LoginOutlined />} block>
            {busy ? "Đang xác thực..." : "Đăng nhập"}
          </Button>
        </Form>

        {error && (
          <Alert
            className="login-error"
            type="error"
            message={error}
            showIcon
            closable
            onClose={() => setError("")}
          />
        )}
      </section>
    </main>
  );
}
