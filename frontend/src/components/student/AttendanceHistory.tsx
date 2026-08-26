import { Card, Table, Tag, Input, Image, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/utils/api";
import { statusLabels, type AttendanceStatus } from "@/types";

const { Text } = Typography;

// =============================================================================
// Student: Attendance History — GET /api/v1/student/attendance-history
// =============================================================================

interface AttendanceRecord {
  date: string;
  courseCode: string;
  courseName: string;
  room: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus;
  firstDetectedAt?: string;
  snapshotUrl?: string;
}

export function AttendanceHistory() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["student-attendance"],
    queryFn: () => api.get("/student/attendance-history") as Promise<AttendanceRecord[]>,
  });

  const filtered = (data ?? []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.courseCode.toLowerCase().includes(q) ||
      r.courseName.toLowerCase().includes(q) ||
      r.room.toLowerCase().includes(q) ||
      r.date.includes(q)
    );
  });

  const columns = [
    {
      title: "Ngày học",
      dataIndex: "date",
      key: "date",
      width: 110,
      render: (d: string) => <Text strong>{d}</Text>,
    },
    {
      title: "Học phần",
      key: "course",
      render: (_: unknown, r: AttendanceRecord) => (
        <div>
          <Text strong>{r.courseCode}</Text>
          <br />
          <Text type="secondary" className="text-xs">{r.courseName}</Text>
        </div>
      ),
    },
    {
      title: "Phòng / Thời gian",
      key: "room",
      render: (_: unknown, r: AttendanceRecord) => (
        <div>
          Phòng {r.room}
          <br />
          <Text type="secondary" className="text-xs">{r.startTime} – {r.endTime}</Text>
        </div>
      ),
    },
    {
      title: "Nhận diện lúc",
      dataIndex: "firstDetectedAt",
      key: "firstDetectedAt",
      width: 120,
      render: (t?: string) => t ? new Date(t).toLocaleTimeString("vi-VN") : "—",
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (s: AttendanceStatus) => (
        <Tag className={`status-tag-${s}`}>{statusLabels[s]}</Tag>
      ),
    },
    {
      title: "Minh chứng AI",
      dataIndex: "snapshotUrl",
      key: "snapshotUrl",
      width: 90,
      render: (url?: string) =>
        url ? (
          <Image src={url} width={48} height={48} style={{ objectFit: "cover", borderRadius: 8 }} alt="Ảnh nhận diện" />
        ) : (
          <Text type="secondary" className="text-xs">Không có</Text>
        ),
    },
  ];

  return (
    <Card
      title="Lịch sử điểm danh chi tiết"
      extra={
        <Input
          placeholder="Tìm theo môn, ngày, phòng..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 260 }}
        />
      }
    >
      <Table
        columns={columns}
        dataSource={filtered}
        rowKey={(r, i) => `${r.date}-${r.courseCode}-${i}`}
        loading={isLoading}
        pagination={{ pageSize: 15, showSizeChanger: true }}
        size="middle"
      />
    </Card>
  );
}
