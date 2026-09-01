import { Alert, Card, Descriptions, Image, Result, Spin, Tag, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import api from "@/utils/api";
import type { StudentBiometricProfileData } from "@/types";

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("vi-VN") : "Chưa có dữ liệu";
}

export function StudentBiometricProfile() {
  const user = useAuthStore((state) => state.user)!;
  const { data, isLoading, isError } = useQuery<StudentBiometricProfileData>({
    queryKey: ["student-biometric-profile"],
    queryFn: () => api.get("/student/biometric-profile") as Promise<StudentBiometricProfileData>,
  });

  if (isLoading) return <div className="portal-loading"><Spin /></div>;
  if (isError || !data) {
    return <Alert className="portal-alert" type="warning" showIcon message="Chưa tải được hồ sơ định danh" description="Hãy thử tải lại trang hoặc đăng nhập lại." />;
  }

  const biometric = data.biometric;
  const enrolled = data.status === "ENROLLED";
  const enrollmentImages = data.enrollmentImages ?? [];

  return (
    <section aria-labelledby="biometric-profile-title">
      <div className="page-heading">
        <div>
          <h1 id="biometric-profile-title">Hồ sơ tài khoản</h1>
          <p>Thông tin tài khoản và dữ liệu khuôn mặt dùng để đối chiếu điểm danh.</p>
        </div>
        <Tag color={enrolled ? "success" : "warning"}>{enrolled ? "Đã đăng ký" : "Chưa đăng ký"}</Tag>
      </div>
      <Card className="portal-card" title="Thông tin tài khoản & khuôn mặt">
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="MSSV">{data.student.userCode || user.userCode}</Descriptions.Item>
          <Descriptions.Item label="Họ và tên">{data.student.fullName || user.fullName}</Descriptions.Item>
          <Descriptions.Item label="Email">{data.student.email}</Descriptions.Item>
          <Descriptions.Item label="Khoa">{data.student.department ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Lớp">{data.student.className ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">{enrolled ? "Đã nạp vector khuôn mặt" : "Chưa đăng ký"}</Descriptions.Item>
          <Descriptions.Item label="Mã vector">{biometric?.vectorId ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Mô hình">{biometric?.modelVersion ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Kích thước vector">{biometric?.embeddingDimension ? `${biometric.embeddingDimension}D` : "—"}</Descriptions.Item>
          <Descriptions.Item label="Ngày đăng ký">{formatDate(biometric?.enrolledAt)}</Descriptions.Item>
          <Descriptions.Item label="Ảnh enrollment" span={2}>
            {enrollmentImages.length ? (
              <Image.PreviewGroup>
                <div className="flex flex-wrap gap-3">
                  {enrollmentImages.map((image) => (
                    <div key={image.id} className="flex flex-col gap-1">
                      <Image src={image.previewBase64} width={140} style={{ borderRadius: 8 }} alt={`Ảnh enrollment ${image.imageIndex}`} />
                      <small>{image.pose === "left" ? "Quay trái" : image.pose === "right" ? "Quay phải" : "Nhìn thẳng"} · Ảnh {image.imageIndex}</small>
                    </div>
                  ))}
                </div>
              </Image.PreviewGroup>
            ) : (
              <Result status="info" title="Chưa có ảnh enrollment" subTitle="Hoàn tất đăng ký khuôn mặt để hiển thị ảnh định danh." />
            )}
          </Descriptions.Item>
        </Descriptions>
        <Typography.Paragraph type="secondary" className="mt-4">
          Chỉ tài khoản sinh viên hiện tại mới đọc được hồ sơ và ảnh này. Hệ thống không trả embedding thô hoặc đường dẫn lưu trữ nội bộ.
        </Typography.Paragraph>
      </Card>
    </section>
  );
}
