import { Card, Descriptions, Tag, Image, Typography, Button, Form, Input, Upload, Modal, message, Steps } from "antd";
import { CameraOutlined, UploadOutlined, SafetyOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/authStore";
import { useState } from "react";
import api from "@/utils/api";

const { Text, Title } = Typography;
const { TextArea } = Input;

// =============================================================================
// Student: Biometric Profile + Re-eKYC (§5.2.2)
// =============================================================================

export function StudentBiometricProfile() {
  const user = useAuthStore((s) => s.user)!;
  const [reEkycOpen, setReEkycOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const handleReEkyc = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("reason", values.reason as string);
      if (values.student_card_image) {
        formData.append("student_card_image", (values.student_card_image as { file: File }).file);
      }
      if (values.new_video_file) {
        formData.append("new_video_file", (values.new_video_file as { file: File }).file);
      }
      await api.post("/student/re-ekyc/submit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      message.success("Đã gửi yêu cầu cập nhật diện mạo mới. Vui lòng chờ Admin phê duyệt.");
      setReEkycOpen(false);
      form.resetFields();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Gửi yêu cầu thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card
        title="Hồ sơ sinh trắc học"
        extra={
          <Tag color={user.isFaceEnrolled ? "success" : "error"}>
            {user.isFaceEnrolled ? "✅ Đã xác thực" : "❌ Chưa xác thực"}
          </Tag>
        }
      >
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="MSSV">{user.userCode}</Descriptions.Item>
          <Descriptions.Item label="Họ và tên">{user.fullName}</Descriptions.Item>
          <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          <Descriptions.Item label="Khoa">{user.department ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Lớp">{user.className ?? "—"}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái eKYC">
            {user.isFaceEnrolled ? "Đã nạp Vector khuôn mặt" : "Chưa đăng ký"}
          </Descriptions.Item>
          <Descriptions.Item label="Ảnh đại diện" span={2}>
            {user.avatarUrl ? (
              <Image src={user.avatarUrl} width={80} style={{ borderRadius: 8 }} alt="Avatar" />
            ) : (
              <Text type="secondary">Chưa có ảnh</Text>
            )}
          </Descriptions.Item>
        </Descriptions>

        {user.isFaceEnrolled && (
          <Button
            type="default"
            icon={<SafetyOutlined />}
            className="mt-4"
            onClick={() => setReEkycOpen(true)}
          >
            Yêu cầu cập nhật diện mạo (Re-eKYC)
          </Button>
        )}
      </Card>

      {/* Re-eKYC Modal */}
      <Modal
        title="Yêu cầu cấp lại khuôn mặt (Re-eKYC)"
        open={reEkycOpen}
        onCancel={() => setReEkycOpen(false)}
        footer={null}
        width={520}
      >
        <Steps
          size="small"
          current={0}
          className="mb-4"
          items={[
            { title: "Tải ảnh thẻ SV/CCCD" },
            { title: "Quay video mới" },
            { title: "Chờ Admin duyệt" },
          ]}
        />
        <Form form={form} layout="vertical" onFinish={handleReEkyc}>
          <Form.Item name="reason" label="Lý do thay đổi diện mạo" rules={[{ required: true, min: 10 }]}>
            <TextArea rows={2} placeholder="VD: Phẫu thuật nâng mũi và cắt mí tháng trước." />
          </Form.Item>

          <Form.Item name="student_card_image" label="Ảnh thẻ Sinh viên / CCCD" rules={[{ required: true }]}>
            <Upload maxCount={1} beforeUpload={() => false} accept="image/*">
              <Button icon={<UploadOutlined />}>Chọn ảnh</Button>
            </Upload>
          </Form.Item>

          <Form.Item name="new_video_file" label="Video 3s diện mạo mới" rules={[{ required: true }]}>
            <Upload maxCount={1} beforeUpload={() => false} accept="video/*">
              <Button icon={<CameraOutlined />}>Chọn video</Button>
            </Upload>
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={submitting} block>
            Gửi yêu cầu Re-eKYC
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
