import { Card, Table, Tag, Select, Row, Col, Typography, Button, InputNumber } from "antd";
import { PlayCircleOutlined, CalendarOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/utils/api";
import type { TeacherSession, SessionStatus } from "@/types";

const { Text } = Typography;

// =============================================================================
// Teacher: Weekly Schedule — GET /api/v1/teacher/schedule (§4.1.1)
// =============================================================================

const dayLabels: Record<number, string> = {
  2: "Thứ Hai", 3: "Thứ Ba", 4: "Thứ Tư", 5: "Thứ Năm",
  6: "Thứ Sáu", 7: "Thứ Bảy", 8: "Chủ Nhật",
};

const currentWeekOfYear = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
};

export function TeacherSchedule({ onStartScan }: { onStartScan: (sessionId: string) => void }) {
  const [week, setWeek] = useState(currentWeekOfYear());
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading } = useQuery<TeacherSession[]>({
    queryKey: ["teacher-schedule", week, year],
    queryFn: () => api.get(`/teacher/schedule?week=${week}&year=${year}`) as Promise<TeacherSession[]>,
  });

  const statusTag = (status: SessionStatus) => {
    switch (status) {
      case "LIVE_NOW": return <Tag color="red">🔴 LIVE</Tag>;
      case "UPCOMING": return <Tag color="blue">Sắp diễn ra</Tag>;
      case "COMPLETED": return <Tag color="default">Đã kết thúc</Tag>;
    }
  };

  const columns = [
    {
      title: "Thứ / Ngày",
      key: "day",
      width: 130,
      render: (_: unknown, r: TeacherSession) => (
        <div>
          <Text strong>{dayLabels[r.dayOfWeek] ?? `Thứ ${r.dayOfWeek}`}</Text>
          <br />
          <Text type="secondary" className="text-xs">{r.date}</Text>
        </div>
      ),
    },
    {
      title: "Học phần",
      key: "course",
      render: (_: unknown, r: TeacherSession) => (
        <div>
          <Text strong>{r.courseName}</Text>
          <br />
          <Text type="secondary" className="text-xs">{r.courseCode} · {r.classCode}</Text>
        </div>
      ),
    },
    { title: "Phòng", dataIndex: "roomCode", key: "roomCode", width: 90 },
    {
      title: "Thời gian",
      key: "time",
      width: 130,
      render: (_: unknown, r: TeacherSession) => `${r.startTime} – ${r.endTime}`,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (s: SessionStatus) => statusTag(s),
    },
    {
      title: "Sĩ số",
      key: "summary",
      width: 200,
      render: (_: unknown, r: TeacherSession) => (
        <div className="flex gap-2 flex-wrap">
          <Tag color="success">{r.summary.present} có mặt</Tag>
          <Tag color="warning">{r.summary.late} muộn</Tag>
          <Tag color="error">{r.summary.absent} vắng</Tag>
        </div>
      ),
    },
    {
      title: "",
      key: "action",
      width: 100,
      render: (_: unknown, r: TeacherSession) =>
        r.status === "LIVE_NOW" ? (
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => onStartScan(r.sessionId)}
          >
            Scan
          </Button>
        ) : null,
    },
  ];

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <CalendarOutlined /> Lịch giảng dạy tuần {week}
        </span>
      }
      extra={
        <div className="flex items-center gap-2">
          <Text type="secondary">Tuần:</Text>
          <InputNumber min={1} max={53} value={week} onChange={(v) => v && setWeek(v)} size="small" style={{ width: 70 }} />
          <Text type="secondary">Năm:</Text>
          <InputNumber min={2020} max={2030} value={year} onChange={(v) => v && setYear(v)} size="small" style={{ width: 80 }} />
        </div>
      }
    >
      <Table
        columns={columns}
        dataSource={data ?? []}
        rowKey="sessionId"
        loading={isLoading}
        pagination={false}
        size="middle"
      />
    </Card>
  );
}
