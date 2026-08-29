import { useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Spin, Tag } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";

export interface TeacherCalendarSession {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  periodStart?: number | null;
  periodEnd?: number | null;
  periodLabel?: string | null;
  courseCode: string;
  courseName: string;
  classCode: string;
  totalStudents: number;
  roomCode: string;
  cameraStatus: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  liveStatus: "LIVE" | "UPCOMING" | "COMPLETED";
}

interface TeacherScheduleResponse {
  startDate: string;
  endDate: string;
  totalSessions: number;
  sessions: TeacherCalendarSession[];
}

const dayLabels = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function mondayOf(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
  result.setHours(0, 0, 0, 0);
  return result;
}

function isoDate(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function TeacherSchedule({ onStartScan }: { onStartScan: (sessionId: string) => void }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const weekEnd = useMemo(() => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + 6);
    return date;
  }, [weekStart]);

  const startDate = isoDate(weekStart);
  const endDate = isoDate(weekEnd);
  const { data, isLoading, isError } = useQuery<TeacherScheduleResponse>({
    queryKey: ["teacher-schedule", startDate, endDate],
    queryFn: () => api.get(`/teacher/schedule?startDate=${startDate}&endDate=${endDate}`) as Promise<TeacherScheduleResponse>,
  });

  const range = `${weekStart.toLocaleDateString("vi-VN")} – ${weekEnd.toLocaleDateString("vi-VN")}`;
  const sessions = data?.sessions ?? [];

  return (
    <section aria-labelledby="teacher-schedule-title">
      <div className="page-heading teacher-heading">
        <div>
          <h1 id="teacher-schedule-title">Lớp giảng dạy</h1>
          <p>Chọn lớp để theo dõi và thực hiện điểm danh.</p>
        </div>
        <div className="schedule-navigation">
          <Button icon={<LeftOutlined />} aria-label="Tuần trước" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7))} />
          <Button onClick={() => setWeekStart(mondayOf(new Date()))}>Tuần này</Button>
          <Button icon={<RightOutlined />} aria-label="Tuần sau" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7))} />
        </div>
      </div>

      <Card className="portal-card" title={`Lịch dạy tuần · ${range}`}>
        {isError && <Alert type="warning" showIcon message="Chưa tải được lịch dạy" description="Backend chưa phản hồi dữ liệu lịch dạy cho khoảng thời gian đã chọn." />}
        {isLoading ? (
          <div className="portal-loading"><Spin /></div>
        ) : sessions.length ? (
          <div className="course-list teacher-course-list">
            {sessions.map((session) => {
              const date = new Date(`${session.sessionDate}T00:00:00`);
              const isLive = session.liveStatus === "LIVE";
              return (
                <article className={`course-session teacher-session ${isLive ? "is-live" : ""}`} key={session.id}>
                  <div>
                    <strong>{session.courseCode} · {session.courseName}</strong>
                    <span>{dayLabels[date.getDay()]} · {session.periodLabel ? `${session.periodLabel} · ` : ""}{session.startTime}–{session.endTime} · {session.roomCode} · {session.totalStudents} sinh viên</span>
                  </div>
                  <div className="teacher-session-actions">
                    <Tag color={isLive ? "success" : session.liveStatus === "COMPLETED" ? "default" : "processing"}>
                      {isLive ? "Đang diễn ra" : session.liveStatus === "COMPLETED" ? "Đã kết thúc" : "Sắp diễn ra"}
                    </Tag>
                    <Tag color={session.cameraStatus === "ONLINE" ? "success" : "error"}>
                      Camera {session.cameraStatus === "ONLINE" ? "sẵn sàng" : "chưa sẵn sàng"}
                    </Tag>
                    <Button type={isLive ? "primary" : "default"} onClick={() => onStartScan(session.id)}>
                      Điểm danh lớp
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty description="Chưa có lớp được phân công trong tuần này." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </section>
  );
}
