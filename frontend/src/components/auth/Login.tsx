import { useState } from "react";
import { Alert, Button, Form, Input, Modal, Typography, message } from "antd";
import { LockOutlined, LoginOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/authStore";
import api from "@/utils/api";
import type { LoginResponse } from "@/types";

const { Title, Text } = Typography;

type QuickAccount = {
  key: string;
  label: string;
  role: "Quản trị viên" | "Giảng viên" | "Sinh viên";
  username: string;
  password: string;
};

const quickAccounts: QuickAccount[] = [
  { key: "ADMIN001", label: "Quản trị SPAS", role: "Quản trị viên", username: "ADMIN001", password: "Admin@123" },
  ...[
    ["GV001", "Nguyễn Minh An"], ["GV002", "Trần Thu Hà"], ["GV003", "Lê Hoài Nam"], ["GV004", "Phạm Thu Huyền"],
    ["GV005", "Đỗ Quốc Bảo"], ["GV006", "Nguyễn Quỳnh Chi"], ["GV007", "Vũ Trung Đức"],
  ].map(([username, label]) => ({ key: username, label, role: "Giảng viên" as const, username, password: "Teacher@123" })),
  ...[
    ["21020001", "Trần Thị Mai"], ["21020002", "Nguyễn Hoàng Nam"], ["21020003", "Lê Minh Quang"], ["21020004", "Nguyễn Lan Anh"],
    ["21020005", "Phạm Gia Huy"], ["21020006", "Vũ Ngọc Mai"], ["21020007", "Đỗ Thành Long"], ["21020008", "Hoàng Thu Trang"],
    ["21020009", "Bùi Khánh Linh"], ["21020010", "Trần Đức Anh"], ["21020011", "Lý Thanh Tùng"], ["21020012", "Ngô Phương Thảo"],
    ["21020013", "Đặng Nhật Minh"], ["21020014", "Phan Bảo Ngọc"], ["21020015", "Đinh Minh Khoa"], ["21020016", "Mai Thu Hà"],
    ["21020017", "Lương Quốc Khánh"], ["21020018", "Hà Mỹ Duyên"], ["21020019", "Chu Đức Thành"], ["21020020", "Tạ Thu Phương"],
    ["21020021", "Nguyễn Gia Hân"], ["21020022", "Võ Minh Tú"], ["21020023", "Lâm Khôi Nguyên"], ["21020024", "Đoàn Thanh Vân"],
  ].map(([username, label]) => ({ key: username, label, role: "Sinh viên" as const, username, password: "Student@123" })),
];

const showQuickAccounts = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === "true";

export function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quickAccountsOpen, setQuickAccountsOpen] = useState(false);
  const [quickAccountSearch, setQuickAccountSearch] = useState("");
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

  const handleQuickLogin = (account: QuickAccount) => {
    if (busy) return;
    setQuickAccountsOpen(false);
    void handleFinish({ username: account.username, password: account.password });
  };

  const visibleQuickAccounts = quickAccounts.filter((account) => {
    const query = quickAccountSearch.trim().toLocaleLowerCase("vi-VN");
    return !query || [account.label, account.role, account.username].some((value) => value.toLocaleLowerCase("vi-VN").includes(query));
  });

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

        {showQuickAccounts && (
          <div className="login-quick-accounts">
            <div className="login-quick-heading">
              <Text strong>Đăng nhập nhanh</Text>
              <Text type="secondary">32 tài khoản demo</Text>
            </div>
            <Button className="login-demo-trigger" block disabled={busy} onClick={() => setQuickAccountsOpen(true)}>
              Chọn tài khoản demo
            </Button>
          </div>
        )}

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

        {showQuickAccounts && (
          <Modal
            title="Chọn tài khoản demo"
            open={quickAccountsOpen}
            footer={null}
            onCancel={() => setQuickAccountsOpen(false)}
          >
            <Input
              allowClear
              autoFocus
              prefix={<SearchOutlined />}
              placeholder="Tìm theo mã, tên hoặc vai trò"
              value={quickAccountSearch}
              onChange={(event) => setQuickAccountSearch(event.target.value)}
            />
            <div className="login-demo-account-list">
              {visibleQuickAccounts.map((account) => (
                <Button
                  className="login-demo-account"
                  key={account.key}
                  disabled={busy}
                  onClick={() => handleQuickLogin(account)}
                >
                  <span>
                    <strong>{account.label}</strong>
                    <small>{account.role} · {account.username}</small>
                  </span>
                </Button>
              ))}
              {!visibleQuickAccounts.length && <Text type="secondary">Không tìm thấy tài khoản demo.</Text>}
            </div>
          </Modal>
        )}
      </section>
    </main>
  );
}
