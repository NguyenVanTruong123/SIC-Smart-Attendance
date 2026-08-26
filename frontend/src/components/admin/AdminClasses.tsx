import { Card, Table, Tag, Input, Typography, Empty } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/utils/api";

const { Text } = Typography;

// =============================================================================
// Admin: Classes Management (Môn & Lớp học phần)
// =============================================================================

interface ClassItem {
  id: string;
  courseCode: string;
  courseName: string;
  classCode: string;
  teacherName: string;
  semester: string;
  totalStudents: number;
  totalSessions: number;
  completedSessions: number;
}

export function AdminClasses() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<ClassItem[]>({
    queryKey: ["admin-classes", search],
    queryFn: () => api.get(`/admin/classes?search=${search}`) as Promise<ClassItem[]>,
  });

  const columns = [
    {
      title: "Mã HP",
      dataIndex: "courseCode",
      key: "courseCode",
      width: 100,
      render: (code: string) => <Text strong>{code}</Text>,
    },
    { title: "Tên học phần", dataIndex: "courseName", key: "courseName" },
    { title: "Mã lớp", dataIndex: "classCode", key: "classCode", width: 120 },
    { title: "Giảng viên", dataIndex: "teacherName", key: "teacherName", width: 160 },
    { title: "Học kỳ", dataIndex: "semester", key: "semester", width: 130 },
    { title: "Sĩ số", dataIndex: "totalStudents", key: "totalStudents", width: 70 },
    {
      title: "Tiến độ",
      key: "progress",
      width: 120,
      render: (_: unknown, r: ClassItem) => (
        <Tag color={r.completedSessions >= r.totalSessions ? "success" : "processing"}>
          {r.completedSessions}/{r.totalSessions} buổi
        </Tag>
      ),
    },
  ];

  return (
    <Card
      title="Quản lý Môn & Lớp học phần"
      extra={
        <Input
          placeholder="Tìm mã HP, tên môn, giảng viên..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
      }
    >
      <Table
        columns={columns}
        dataSource={data ?? []}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 15, showSizeChanger: true }}
        size="middle"
        locale={{ emptyText: <Empty description="Chưa có dữ liệu lớp học phần" /> }}
      />
    </Card>
  );
}
