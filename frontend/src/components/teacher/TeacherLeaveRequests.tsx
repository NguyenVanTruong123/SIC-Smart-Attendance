import { Card, Table, Tag, Button, message, Typography, Empty } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import type { LeaveRequestStatus } from "@/types";

const { Text } = Typography;

// =============================================================================
// Teacher: Leave Request Approval — POST /api/v1/teacher/sessions/{id}/quick-approve-leave (§4.1.6)
// =============================================================================

interface TeacherLeaveItem {
  leaveRequestId: string;
  sessionId: string;
  studentCode: string;
  studentName: string;
  courseName: string;
  requestType: "FULL_SESSION" | "LATE_ENTRY";
  reason: string;
  attachmentUrl?: string;
  status: LeaveRequestStatus;
  createdAt: string;
}

export function TeacherLeaveRequests() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<TeacherLeaveItem[]>({
    queryKey: ["teacher-leave-requests"],
    queryFn: () => api.get("/teacher/leave-requests") as Promise<TeacherLeaveItem[]>,
  });

  const { mutate: decide } = useMutation({
    mutationFn: async ({ sessionId, leaveRequestId, decision }: { sessionId: string; leaveRequestId: string; decision: "APPROVED" | "REJECTED" }) => {
      return api.post(`/teacher/sessions/${sessionId}/quick-approve-leave`, { leaveRequestId, decision });
    },
    onSuccess: () => {
      message.success("Đã xử lý đơn xin nghỉ.");
      queryClient.invalidateQueries({ queryKey: ["teacher-leave-requests"] });
    },
    onError: (err: Error) => message.error(err.message),
  });

  const columns = [
    {
      title: "Sinh viên",
      key: "student",
      render: (_: unknown, r: TeacherLeaveItem) => (
        <div>
          <Text strong>{r.studentName}</Text>
          <br />
          <Text type="secondary" className="text-xs">{r.studentCode}</Text>
        </div>
      ),
    },
    { title: "Môn học", dataIndex: "courseName", key: "courseName" },
    {
      title: "Loại",
      dataIndex: "requestType",
      key: "requestType",
      width: 120,
      render: (t: string) => (t === "FULL_SESSION" ? "Nghỉ cả buổi" : "Vào muộn"),
    },
    {
      title: "Lý do",
      dataIndex: "reason",
      key: "reason",
      ellipsis: true,
    },
    {
      title: "Ngày gửi",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 110,
      render: (d: string) => new Date(d).toLocaleDateString("vi-VN"),
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
    {
      title: "Thao tác",
      key: "action",
      width: 150,
      render: (_: unknown, r: TeacherLeaveItem) =>
        r.status === "PENDING" ? (
          <div className="flex gap-2">
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => decide({ sessionId: r.sessionId, leaveRequestId: r.leaveRequestId, decision: "APPROVED" })}
            >
              Duyệt
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => decide({ sessionId: r.sessionId, leaveRequestId: r.leaveRequestId, decision: "REJECTED" })}
            >
              Từ chối
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <Card title="Duyệt đơn xin nghỉ / đi muộn">
      <Table
        columns={columns}
        dataSource={data ?? []}
        rowKey="leaveRequestId"
        loading={isLoading}
        pagination={{ pageSize: 15 }}
        size="middle"
        locale={{ emptyText: <Empty description="Không có đơn xin nghỉ nào" /> }}
      />
    </Card>
  );
}
