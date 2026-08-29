import { Avatar, Card, Descriptions, Image, Tag } from "antd";
import { useAuthStore } from "@/stores/authStore";
import { roleLabels } from "@/types";

export function Profile() {
  const user = useAuthStore((state) => state.user)!;

  return (
    <section aria-labelledby="profile-title">
      <div className="page-heading">
        <div>
          <h1 id="profile-title">Tài khoản cá nhân</h1>
          <p>Thông tin tài khoản được nhà trường quản lý.</p>
        </div>
      </div>
      <Card className="portal-card profile-card">
        <div className="profile-summary">
          {user.avatarUrl ? <Image preview={false} src={user.avatarUrl} alt="Ảnh hồ sơ" /> : <Avatar size={80}>{user.fullName.slice(0, 1).toUpperCase()}</Avatar>}
          <div>
            <h2>{user.fullName}</h2>
            <p>{roleLabels[user.role]} · {user.userCode}</p>
            <Tag color={user.status === "ACTIVE" ? "success" : "default"}>{user.status === "ACTIVE" ? "Đang hoạt động" : user.status ?? "Đang hoạt động"}</Tag>
          </div>
        </div>
        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="middle">
          <Descriptions.Item label="Mã người dùng">{user.userCode}</Descriptions.Item>
          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          <Descriptions.Item label="Vai trò">{roleLabels[user.role]}</Descriptions.Item>
          <Descriptions.Item label="Khoa / phòng ban">{user.department ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Lớp">{user.className ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Khuôn mặt">
            <Tag color={user.isFaceEnrolled ? "success" : "warning"}>{user.isFaceEnrolled ? "Đã đăng ký" : "Chưa đăng ký"}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </section>
  );
}
