import { Alert, Card, Input, Table, Tag, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import api from "@/utils/api";
import { ProtectedImage } from "@/components/common/ProtectedImage";
import { statusLabels, type AttendanceStatus } from "@/types";

const { Text } = Typography;

interface AttendanceRecord {
  date: string;
  courseCode: string;
  courseName: string;
  roomCode: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus;
  firstDetectedAt?: string;
  snapshotUrl?: string;
}

export function AttendanceHistory() {
  const [search, setSearch] = useState("");
  const { data, isLoading, isError } = useQuery<AttendanceRecord[]>({
    queryKey: ["student-attendance"],
    queryFn: () => api.get("/student/attendance-history") as Promise<AttendanceRecord[]>,
  });

  const records = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi-VN");
    return (data ?? []).filter((record) => !query || [
      record.date,
      record.courseCode,
      record.courseName,
      record.roomCode,
    ].some((value) => value.toLocaleLowerCase("vi-VN").includes(query)));
  }, [data, search]);

  const columns = [
    { title: "Ngày", dataIndex: "date", key: "date", width: 115, render: (date: string) => <Text strong>{date}</Text> },
    {
      title: "Học phần",
      key: "course",
      render: (_: unknown, record: AttendanceRecord) => <div><strong>{record.courseCode}</strong><br /><Text type="secondary">{record.courseName}</Text></div>,
    },
    { title: "Phòng", dataIndex: "roomCode", key: "roomCode", width: 105 },
    {
      title: "Thời điểm ghi nhận",
      key: "time",
      width: 165,
      render: (_: unknown, record: AttendanceRecord) => record.firstDetectedAt ? new Date(record.firstDetectedAt).toLocaleString("vi-VN") : `${record.startTime}–${record.endTime}`,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: AttendanceStatus) => <Tag className={`status-tag-${status}`}>{statusLabels[status]}</Tag>,
    },
    {
      title: "Ảnh xác minh",
      dataIndex: "snapshotUrl",
      key: "snapshotUrl",
      width: 120,
      render: (url?: string) => <ProtectedImage width={50} height={50} preview src={url} alt="Ảnh điểm danh" style={{ objectFit: "cover" }} />,
    },
  ];

  return (
    <section aria-labelledby="attendance-history-title">
      <div className="page-heading">
        <div>
          <h1 id="attendance-history-title">Kết quả điểm danh</h1>
          <p>Theo dõi các buổi học đã được giảng viên hoặc AI ghi nhận.</p>
        </div>
      </div>
      {isError && <Alert className="portal-alert" type="warning" showIcon message="Chưa tải được lịch sử điểm danh" description="Backend chưa cung cấp endpoint GET /api/v1/student/attendance-history." />}
      <Card
        className="portal-card"
        extra={<Input className="portal-search" value={search} onChange={(event) => setSearch(event.target.value)} prefix={<SearchOutlined />} placeholder="Tìm theo môn, ngày hoặc phòng" allowClear />}
      >
        <Table columns={columns} dataSource={records} rowKey={(record, index) => `${record.date}-${record.courseCode}-${index}`} loading={isLoading} pagination={{ pageSize: 10, showSizeChanger: true }} scroll={{ x: 800 }} />
      </Card>
    </section>
  );
}
