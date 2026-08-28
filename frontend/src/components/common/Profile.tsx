import { Card, Descriptions, Tag, Avatar, Image, Typography } from "antd";
import { useAuthStore } from "@/stores/authStore";
import { roleLabels } from "@/types";

const { Title, Text } = Typography;

// =============================================================================
// Common: Profile Page — displays current user info from /api/v1/auth/me (§2.3)
// =============================================================================

export function Profile() {
  const user = useAuthStore((s) => s.user)!;

  return (
    <Card>
      <div className="flex items-center gap-5 mb-6">
        {user.avatarUrl ? (
          <Image src={user.avatarUrl} width={80} style={{ borderRadius: "50%", objectFit: "cover" }} alt="Avatar" preview={false} />
        ) : (
          <Avatar size={80} style={{ backgroundColor: "#2563eb", fontSize: 32 }}>
            {user.fullName.charAt(0).toUpperCase()}
          </Avatar>
        )}
        <div>
          <Title level={4} style={{ margin: 0 }}>{user.fullName}</Title>
          <Tag color="blue">{roleLabels[user.role]}</Tag>
        </div>
      </div>

      <Descriptions bordered column={{ xs: 1, sm: 2 }} size="middle">
        <Descriptions.Item label="Mã người dùng">{user.userCode}</Descriptions.Item>
        <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
        <Descriptions.Item label="Vai trò">{roleLabels[user.role]}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái tài khoản">
          <Tag color={user.status === "ACTIVE" ? "success" : "default"}>{user.status ?? "ACTIVE"}</Tag>
        </Descriptions.Item>
        {user.department && <Descriptions.Item label="Khoa / Phòng ban">{user.department}</Descriptions.Item>}
        {user.className && <Descriptions.Item label="Lớp">{user.className}</Descriptions.Item>}
        <Descriptions.Item label="Xác thực khuôn mặt">
          <Tag color={user.isFaceEnrolled ? "success" : "error"}>
            {user.isFaceEnrolled ? "✅ Đã xác thực" : "❌ Chưa xác thực"}
          </Tag>
        </Descriptions.Item>
        {user.createdAt && (
          <Descriptions.Item label="Ngày tạo tài khoản">
            {new Date(user.createdAt).toLocaleDateString("vi-VN")}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );
}
