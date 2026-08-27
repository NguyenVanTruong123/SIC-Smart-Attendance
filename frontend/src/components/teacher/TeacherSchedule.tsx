import { useState, useMemo } from "react";
import { Button, Tag, Typography, Spin } from "antd";
import {
  LeftOutlined,
  RightOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";

const { Text, Title } = Typography;

// =============================================================================
// Teacher: Weekly Schedule — Real-time Proportional Google Calendar Time Grid
// =============================================================================

export interface TeacherCalendarSession {
  id: string;
  sessionId: string;
  sessionNumber: number;
  sessionDate: string; // YYYY-MM-DD
  dayOfWeek: number; // 2: Thứ 2 ... 8: Chủ nhật
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  courseId: string;
  courseCode: string;
  courseName: string;
  classCode: string;
  totalStudents: number;
  classroomId?: string;
  roomCode: string;
  building: string;
  cameraStatus: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  cameraRtsp?: string;
  liveStatus: "LIVE" | "UPCOMING" | "COMPLETED";
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    hasProof: boolean;
  };
}

export interface TeacherScheduleResponse {
  startDate: string;
  endDate: string;
  totalSessions: number;
  sessions: TeacherCalendarSession[];
}

// Cấu hình mốc giờ bắt đầu & kết thúc của Time Grid (Từ 07:00 đến 23:00)
const START_HOUR = 7; // 07:00
const END_HOUR = 23; // 23:00
const HOUR_HEIGHT = 70; // 70px cho mỗi 1 giờ (1 phút = 1.166px)

const hoursArray = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i
);

export function TeacherSchedule({
  onStartScan,
}: {
  onStartScan: (sessionId: string) => void;
}) {
  // Quản lý tuần hiện tại (Mốc Thứ 2)
  const [currentMonday, setCurrentMonday] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    mon.setHours(0, 0, 0, 0);
    return mon;
  });

  // Tính 7 ngày trong tuần từ Thứ 2 đến Chủ Nhật
  const weekDays = useMemo(() => {
    const days: Array<{
      dayOfWeek: number;
      label: string;
      dateStr: string;
      dayNumber: string;
      formattedDate: string;
      isToday: boolean;
      fullDate: Date;
    }> = [];

    const dayLabels = [
      "THỨ 2",
      "THỨ 3",
      "THỨ 4",
      "THỨ 5",
      "THỨ 6",
      "THỨ 7",
      "CN",
    ];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentMonday);
      date.setDate(currentMonday.getDate() + i);

      const isToday =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();

      const dayNum = String(date.getDate()).padStart(2, "0");
      const monthNum = String(date.getMonth() + 1).padStart(2, "0");
      const dateString = `${date.getFullYear()}-${monthNum}-${dayNum}`;

      days.push({
        dayOfWeek: i + 2,
        label: dayLabels[i],
        dateStr: dateString,
        dayNumber: dayNum,
        formattedDate: `${dayNum}/${monthNum}`,
        isToday,
        fullDate: date,
      });
    }
    return days;
  }, [currentMonday]);

  // Chuỗi tuần: "Tuần 42 (13/10/2026 - 19/10/2026)"
  const weekRangeText = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    const year = currentMonday.getFullYear();
    return `Tuần (${start.formattedDate}/${year} - ${end.formattedDate}/${year})`;
  }, [weekDays, currentMonday]);

  const startDateStr = weekDays[0].dateStr;
  const endDateStr = weekDays[6].dateStr;

  // Gọi API lịch dạy
  const { data, isLoading } = useQuery<TeacherScheduleResponse>({
    queryKey: ["teacher-schedule", startDateStr, endDateStr],
    queryFn: () =>
      api.get(
        `/teacher/schedule?startDate=${startDateStr}&endDate=${endDateStr}`
      ) as Promise<TeacherScheduleResponse>,
  });

  const sessions = data?.sessions ?? [];

  // Điều hướng tuần
  const handlePrevWeek = () => {
    const prev = new Date(currentMonday);
    prev.setDate(currentMonday.getDate() - 7);
    setCurrentMonday(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentMonday);
    next.setDate(currentMonday.getDate() + 7);
    setCurrentMonday(next);
  };

  const handleCurrentWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    mon.setHours(0, 0, 0, 0);
    setCurrentMonday(mon);
  };

  // Tính vị trí top và chiều cao theo phút
  const calculateSessionStyle = (startTimeStr: string, endTimeStr: string) => {
    const [startH, startM] = startTimeStr.split(":").map(Number);
    const [endH, endM] = endTimeStr.split(":").map(Number);

    const startTotalMinutes = startH * 60 + startM;
    const endTotalMinutes = endH * 60 + endM;
    const gridStartTotalMinutes = START_HOUR * 60;

    const minuteHeight = HOUR_HEIGHT / 60;
    const top = Math.max(0, (startTotalMinutes - gridStartTotalMinutes) * minuteHeight);
    const durationMinutes = Math.max(30, endTotalMinutes - startTotalMinutes);
    const height = durationMinutes * minuteHeight;

    return { top: `${top}px`, height: `${height}px` };
  };

  const totalGridHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT;

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Header & Điều hướng tuần chuẩn Google Calendar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
            Thời khóa biểu
          </Title>
          <div className="text-xs text-slate-500 mt-1 font-medium">{weekRangeText}</div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            icon={<LeftOutlined style={{ fontSize: 11 }} />}
            onClick={handlePrevWeek}
            className="text-xs text-slate-600 rounded-lg hover:border-blue-500"
          >
            Tuần trước
          </Button>

          <Button
            type="primary"
            onClick={handleCurrentWeek}
            style={{ background: "#2563eb", borderColor: "#2563eb", fontWeight: 600 }}
            className="text-xs rounded-lg shadow-sm"
          >
            Hôm nay
          </Button>

          <Button
            onClick={handleNextWeek}
            className="text-xs text-slate-600 rounded-lg hover:border-blue-500"
          >
            Tuần sau <RightOutlined style={{ fontSize: 11 }} />
          </Button>
        </div>
      </div>

      {/* 2. Lưới Lịch Thời Gian Thực (Time Grid Calendar) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <Spin spinning={isLoading}>
          <div className="min-w-[1050px]">
            {/* Header các cột 7 ngày */}
            <div className="grid grid-cols-[70px_repeat(7,1fr)] border-b border-slate-200 bg-white sticky top-0 z-20">
              <div className="py-3 px-2 text-[11px] font-bold text-slate-400 border-r border-slate-200 flex flex-col items-center justify-center bg-slate-50/50">
                <span>GMT+7</span>
              </div>
              {weekDays.map((day) => (
                <div
                  key={day.dateStr}
                  className={`py-3 px-2 border-r border-slate-200 last:border-r-0 text-center transition-colors ${
                    day.isToday ? "bg-blue-50/40 relative" : ""
                  }`}
                >
                  {day.isToday && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600" />
                  )}
                  <div
                    className={`text-xs font-bold uppercase tracking-wider ${
                      day.isToday ? "text-blue-600" : "text-slate-500"
                    }`}
                  >
                    {day.label}
                  </div>
                  <div
                    className={`mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full text-base font-extrabold ${
                      day.isToday
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-800"
                    }`}
                  >
                    {day.dayNumber}
                  </div>
                </div>
              ))}
            </div>

            {/* Thân bảng với các dòng giờ kẻ ngang và thẻ ca học tuyệt đối */}
            <div
              className="grid grid-cols-[70px_repeat(7,1fr)] relative"
              style={{ height: `${totalGridHeight}px` }}
            >
              {/* Cột mốc giờ bên trái */}
              <div className="border-r border-slate-200 bg-slate-50/30 relative">
                {hoursArray.map((hour, idx) => (
                  <div
                    key={hour}
                    style={{
                      position: "absolute",
                      top: `${idx * HOUR_HEIGHT}px`,
                      left: 0,
                      right: 0,
                      height: `${HOUR_HEIGHT}px`,
                    }}
                    className="pr-2 pt-1 text-right text-[11px] font-mono text-slate-400"
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* 7 Cột Ngày - Chứa các đường kẻ ngang và các thẻ ca học */}
              {weekDays.map((day) => {
                const daySessions = sessions.filter((s) => s.sessionDate === day.dateStr);

                return (
                  <div
                    key={day.dateStr}
                    className={`border-r border-slate-200 last:border-r-0 relative transition-colors ${
                      day.isToday ? "bg-blue-50/15" : ""
                    }`}
                    style={{ height: `${totalGridHeight}px` }}
                  >
                    {/* Các đường kẻ ngang mỗi 1 giờ */}
                    {hoursArray.map((hour, idx) => (
                      <div
                        key={hour}
                        style={{
                          position: "absolute",
                          top: `${idx * HOUR_HEIGHT}px`,
                          left: 0,
                          right: 0,
                          height: `${HOUR_HEIGHT}px`,
                          borderTop: "1px solid #f1f5f9",
                        }}
                      />
                    ))}

                    {/* Render các thẻ ca học định vị tuyệt đối theo giờ thực tế */}
                    {daySessions.map((session) => {
                      const { top, height } = calculateSessionStyle(
                        session.startTime,
                        session.endTime
                      );

                      return (
                        <div
                          key={session.id}
                          style={{
                            position: "absolute",
                            top,
                            height,
                            left: "4px",
                            right: "4px",
                            zIndex: session.liveStatus === "LIVE" ? 10 : 5,
                          }}
                        >
                          {/* 🟢 CARD CA HỌC: LIVE */}
                          {session.liveStatus === "LIVE" && (
                            <div
                              className="h-full rounded-xl p-3 flex flex-col justify-between border-2 border-emerald-500 shadow-lg transition-all"
                              style={{
                                background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                                borderLeft: "5px solid #16a34a",
                              }}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                    ● ĐANG DIỄN RA
                                  </span>
                                  <Tag color="success" className="text-[10px] font-mono m-0 px-1 font-bold">
                                    RTSP LIVE
                                  </Tag>
                                </div>

                                <div className="font-bold text-slate-900 text-xs line-clamp-2 leading-tight">
                                  {session.courseName}
                                </div>

                                <div className="text-[11px] text-slate-600 mt-1">
                                  {session.courseCode} • {session.roomCode}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                  {session.totalStudents} SV • {session.startTime} - {session.endTime}
                                </div>
                              </div>

                              <button
                                onClick={() => onStartScan(session.id)}
                                className="w-full flex items-center justify-center gap-1 text-emerald-800 hover:text-emerald-950 font-bold bg-white hover:bg-emerald-50 py-1 rounded-md border border-emerald-300 shadow-sm transition-all text-xs mt-1"
                              >
                                Vào Ca Live <ArrowRightOutlined style={{ fontSize: 11 }} />
                              </button>
                            </div>
                          )}

                          {/* 🟣 CARD CA HỌC: SẮP DIỄN RA */}
                          {session.liveStatus === "UPCOMING" && (
                            <div
                              className="h-full rounded-xl p-3 flex flex-col justify-between bg-white border border-slate-200 hover:border-indigo-300 shadow-sm transition-all"
                              style={{ borderLeft: "4px solid #6366f1" }}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                                    ⏱ Sắp diễn ra
                                  </span>
                                </div>

                                <div className="font-bold text-slate-800 text-xs line-clamp-2 leading-tight">
                                  {session.courseName}
                                </div>

                                <div className="text-[11px] text-slate-500 mt-1">
                                  {session.courseCode} • {session.roomCode}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {session.startTime} - {session.endTime}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                                  Chưa tới giờ
                                </span>
                                <span>{session.totalStudents} SV</span>
                              </div>
                            </div>
                          )}

                          {/* ⚪ CARD CA HỌC: ĐÃ KẾT THÚC */}
                          {session.liveStatus === "COMPLETED" && (
                            <div
                              className="h-full rounded-xl p-3 flex flex-col justify-between bg-white border border-slate-200/90 shadow-sm transition-all"
                              style={{ borderLeft: "4px solid #2563eb" }}
                            >
                              <div>
                                <div className="font-bold text-slate-800 text-xs line-clamp-2 leading-tight">
                                  {session.courseName}
                                </div>

                                <div className="text-[11px] text-slate-500 mt-1">
                                  {session.courseCode} • {session.roomCode}
                                </div>
                                <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                                  {session.startTime} - {session.endTime}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  GV phụ trách
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[10px]">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  Đúng giờ
                                </span>
                                <span className="text-blue-600 font-semibold text-[10px] cursor-pointer hover:underline">
                                  Xem proof ➔
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </Spin>
      </div>

      {/* 3. Footer */}
      <div className="flex items-center justify-between text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <span>
            Học kỳ: <b className="text-slate-700">HK1 (2026-2027)</b>
          </span>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1.5">
            AI Camera Hub:{" "}
            <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              ● Hoạt động
            </span>
          </span>
        </div>
        <div className="text-slate-400">
          Tổng cộng: <b>{sessions.length}</b> ca học trong tuần
        </div>
      </div>
    </div>
  );
}
