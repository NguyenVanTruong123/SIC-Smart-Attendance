import { useState } from "react";
import { Card, Form, Select, Radio, Input, DatePicker, Upload, Button, Table, Tag, message, Typography, Row, Col } from "antd";
import { SendOutlined, UploadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import type { LeaveRequestStatus } from "@/types";

const { TextArea } = Input;
const { Text } = Typography;

// =============================================================================
// Student: Leave Requests — POST /api/v1/student/leave-requests (§5.2.1)
// =============================================================================

interface LeaveRecord {
  requestId: string;
  sessionId: string;
  courseName: string;
  requestType: "FULL_SESSION" | "LATE_ENTRY";
  reason: string;
  status: LeaveRequestStatus;
  createdAt: string;
  date: string;
}

export function StudentLeaveRequests() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch existing requests
  const { data: requests, isLoading } = useQuery<LeaveRecord[]>({
    queryKey: ["student-leave-requests"],
    queryFn: () => api.get("/student/leave-requests") as Promise<LeaveRecord[]>,
  });

  // Submit new request
  const { mutate: submitLeave, isPending } = useMutation({
    mutationFn: async (values: { session_id: string; request_type: string; reason: string; attachment?: File }) => {
      const formData = new FormData();
      formData.append("session_id", values.session_id);
      formData.append("request_type", values.request_type);
      formData.append("reason", values.reason);
      if (values.attachment) {
        formData.append("attachment_file", values.attachment);
      }
      return api.post("/student/leave-requests", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      message.success("Gửi đơn xin phép thành công! Đang chờ giảng viên phê duyệt.");
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["student-leave-requests"] });
    },
    onError: (err: Error) => {
      message.error(err.message);
    },
  });

  const handleSubmit = (values: Record<string, unknown>) => {
    submitLeave({
      session_id: values.session_id as string,
      request_type: values.request_type as string,
      reason: values.reason as string,
      attachment: (values.attachment as { file?: File })?.file,
    });
  };

  const columns = [
    {
      title: "Môn học",
      key: "course",
      render: (_: unknown, r: LeaveRecord) => (
        <div>
          <Text strong>{r.courseName}</Text>
          <br />
          <Text type="secondary" className="text-xs">{r.reason}</Text>
        </div>
      ),
    },
    { title: "Ngày", dataIndex: "date", key: "date", width: 110 },
    {
      title: "Loại",
      dataIndex: "requestType",
      key: "requestType",
      width: 120,
      render: (t: string) => (t === "FULL_SESSION" ? "Nghỉ cả buổi" : "Vào muộn"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: LeaveRequestStatus) => (
        <Tag color={s === "APPROVED" ? "success" : s === "REJECTED" ? "error" : "processing"}>
          {s === "APPROVED" ? "Đã duyệt" : s === "REJECTED" ? "Từ chối" : "Chờ duyệt"}
        </Tag>
      ),
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {/* Form */}
      <Col xs={24} lg={12}>
        <Card title="Tạo đơn xin nghỉ / đi muộn" extra={<Text type="secondary">Gửi trực tiếp đến giảng viên</Text>}>
          <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ request_type: "FULL_SESSION" }}>
            <Form.Item name="session_id" label="Ca học xin phép" rules={[{ required: true, message: "Vui lòng nhập mã ca học" }]}>
              <Input placeholder="Nhập Session ID (VD: ses_int3401_02)" />
            </Form.Item>

            <Form.Item name="request_type" label="Loại yêu cầu">
              <Radio.Group>
                <Radio value="FULL_SESSION">Nghỉ cả buổi học</Radio>
                <Radio value="LATE_ENTRY">Xin phép đến muộn (tối đa 15p)</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item name="date" label="Ngày xin phép" rules={[{ required: true }]}>
              <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item name="reason" label="Lý do xin phép" rules={[{ required: true, min: 10, message: "Tối thiểu 10 ký tự" }]}>
              <TextArea rows={3} placeholder="Nêu rõ lý do vắng mặt / đi muộn..." />
            </Form.Item>

            <Form.Item name="attachment" label="Tệp đính kèm (giấy tờ minh chứng)">
              <Upload maxCount={1} beforeUpload={() => false} accept=".pdf,.jpg,.jpeg,.png">
                <Button icon={<UploadOutlined />}>Chọn file</Button>
              </Upload>
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={isPending} icon={<SendOutlined />} block>
              Gửi đơn xin phép
            </Button>
          </Form>
        </Card>
      </Col>

      {/* History */}
      <Col xs={24} lg={12}>
        <Card title={`Lịch sử đơn đã gửi (${requests?.length ?? 0})`}>
          <Table
            columns={columns}
            dataSource={requests ?? []}
            rowKey="requestId"
            loading={isLoading}
            pagination={{ pageSize: 10 }}
            size="middle"
          />
        </Card>
      </Col>
    </Row>
  );
}
