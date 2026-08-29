import { useMemo, useState } from "react";
import { Alert, Button, Card, Empty, Spin, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";
import type { StudentDashboardData } from "@/types";
import { useAuthStore } from "@/stores/authStore";

const courseStatus = {
  SAFE: "Ổn định",
  WARNING: "Cần lưu ý",
  DANGER: "Nguy cơ",
} as const;

const weekDayLabels = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

function getMonday(offset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return date;
}

function dateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(date: Date) {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

const sessionStatus = {
  LIVE_NOW: { label: "Đang học", color: "error" },
  COMPLETED: { label: "Đã học", color: "success" },
  CANCELLED: { label: "Đã hủy", color: "default" },
} as const;

export function StudentDashboard() {
  const user = useAuthStore((state) => state.user)!;
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => getMonday(weekOffset), [weekOffset]);
  const weekStartValue = dateValue(weekStart);
  const weekEnd = useMemo(() => {
    const value = new Date(weekStart);
    value.setDate(value.getDate() + 6);
    return value;
  }, [weekStart]);
  const { data, isLoading, isError } = useQuery<StudentDashboardData>({
    queryKey: ["student-dashboard", weekStartValue],
    queryFn: () => api.get(`/student/dashboard?weekStart=${weekStartValue}`) as Promise<StudentDashboardData>,
  });

  const stats = data?.stats;
  const absentCount = (stats?.unexcusedAbsentCount ?? 0) + (stats?.excusedAbsentCount ?? 0);
  const weeklySchedule = data?.weeklySchedule ?? [];
  const today = dateValue(new Date());

  return (
    <section className="student-dashboard" aria-labelledby="student-dashboard-title">
      <div className="page-heading">
        <div>
          <h1 id="student-dashboard-title">Trang chủ</h1>
          <p>{data?.semester ?? "Thông tin học tập và điểm danh của bạn"} · MSSV {user.userCode}</p>
        </div>
        <Tag color={user.isFaceEnrolled ? "success" : "warning"}>
          {user.isFaceEnrolled ? "Đã đăng ký khuôn mặt" : "Chưa đăng ký khuôn mặt"}
        </Tag>
      </div>

      {isError && (
        <Alert
          className="portal-alert"
          type="warning"
          showIcon
          message="Chưa tải được dữ liệu trang chủ"
          description="Trang sẽ hiển thị đầy đủ khi Backend cung cấp endpoint GET /api/v1/student/dashboard theo tài liệu API."
        />
      )}

      <div className="dashboard-metrics" aria-label="Tổng quan điểm danh">
        <article className="portal-metric"><strong>{data?.enrolledCourses.length ?? 0}</strong><span>Học phần đang học</span></article>
        <article className="portal-metric"><strong>{data?.overallRate ?? 0}%</strong><span>Tỷ lệ điểm danh</span></article>
        <article className="portal-metric"><strong>{(stats?.lateCount ?? 0) + absentCount}</strong><span>Buổi cần lưu ý</span></article>
      </div>

      {data?.urgentAlert?.hasRisk && (
        <Alert
          className="portal-alert"
          type="warning"
          showIcon
          message={`Cảnh báo chuyên cần: ${data.urgentAlert.courseName}`}
          description={data.urgentAlert.message}
        />
      )}

      <Card
        className="portal-card student-calendar-card"
        title="Lịch học trong tuần"
        extra={
          <div className="student-calendar-actions">
            <Button size="small" onClick={() => setWeekOffset((value) => value - 1)}>Tuần trước</Button>
            <Button size="small" type={weekOffset === 0 ? "primary" : "default"} onClick={() => setWeekOffset(0)}>Tuần này</Button>
            <Button size="small" onClick={() => setWeekOffset((value) => value + 1)}>Tuần sau</Button>
          </div>
        }
      >
        <div className="student-calendar-range">{displayDate(weekStart)} – {displayDate(weekEnd)}</div>
        {isLoading ? (
          <div className="portal-loading"><Spin /></div>
        ) : (
          <div className="student-week-calendar" aria-label={`Lịch học từ ${dateValue(weekStart)} đến ${dateValue(weekEnd)}`}>
            {weekDayLabels.map((label, index) => {
              const day = new Date(weekStart);
              day.setDate(day.getDate() + index);
              const dayValue = dateValue(day);
              const sessions = weeklySchedule.filter((session) => session.dayOfWeek === index + 1);
              return (
                <div className={`student-calendar-day ${dayValue === today ? "is-today" : ""}`} key={label}>
                  <div className="student-calendar-day-heading">
                    <strong>{label}</strong>
                    <span>{displayDate(day)}</span>
                  </div>
                  <div className="student-calendar-events">
                    {sessions.map((session) => {
                      const status = sessionStatus[session.status as keyof typeof sessionStatus];
                      return (
                        <article className="student-calendar-event" key={session.id}>
                          <strong>{session.courseCode}</strong>
                          <span>{session.courseName}</span>
                          <small>{session.periodLabel ? `${session.periodLabel} · ` : ""}{session.startTime} – {session.endTime}</small>
                          <small>{session.roomCode} · {session.classCode}</small>
                          {status && <Tag color={status.color}>{status.label}</Tag>}
                        </article>
                      );
                    })}
                    {!sessions.length && <span className="student-calendar-empty">Trống</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="portal-card" title="Học phần đang học">
        {isLoading ? (
          <div className="portal-loading"><Spin /></div>
        ) : data?.enrolledCourses.length ? (
          <div className="course-list">
            {data.enrolledCourses.map((course) => (
              <article className="course-session" key={course.courseCode}>
                <div>
                  <strong>{course.courseCode} · {course.courseName}</strong>
                  <span>Phòng {course.room} · {course.progress}</span>
                </div>
                <div className="course-session-meta">
                  <strong>{course.attendanceRate}%</strong>
                  <Tag color={course.status === "SAFE" ? "success" : course.status === "WARNING" ? "warning" : "error"}>
                    {courseStatus[course.status]}
                  </Tag>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty description="Chưa có học phần được phân công." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </section>
  );
}
