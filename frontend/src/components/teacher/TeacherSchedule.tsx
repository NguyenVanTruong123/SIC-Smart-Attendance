import { useState, useMemo } from "react";
import { Button, Tag, Typography, Spin, Tooltip } from "antd";
import {
  LeftOutlined,
  RightOutlined,
  VideoCameraOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  CheckCircleFilled,
  SyncOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";

const { Text, Title } = Typography;

// =============================================================================
// Teacher: Weekly Schedule — Time Grid Calendar (Khớp 100% Mockup người dùng)
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

const timeSlots = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

export function TeacherSchedule({
  onStartScan,
}: {
  onStartScan: (sessionId: string) => void;
}) {
  // Quản lý tuần hiện tại (Tính mốc Thứ 2 của tuần)
  const [currentMonday, setCurrentMonday] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Thứ 2 là ngày bắt đầu
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
      formattedDate: string;
      isToday: boolean;
      fullDate: Date;
    }> = [];

    const dayLabels = [
      "Thứ 2",
      "Thứ 3",
      "Thứ 4",
      "Thứ 5",
      "Thứ 6",
      "Thứ 7",
      "Chủ Nhật",
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
        dayOfWeek: i + 2, // 2: Thứ 2 ... 8: Chủ nhật
        label: dayLabels[i],
        dateStr: dateString,
        formattedDate: `${dayNum}/${monthNum}`,
        isToday,
        fullDate: date,
      });
    }
    return days;
  }, [currentMonday]);

  // Chuỗi hiển thị khoảng thời gian: "Tuần này: 12/10 - 18/10/2026"
  const weekRangeText = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    const year = currentMonday.getFullYear();
    return `Tuần này: ${start.formattedDate} - ${end.formattedDate}/${year}`;
  }, [weekDays, currentMonday]);

  const startDateStr = weekDays[0].dateStr;
  const endDateStr = weekDays[6].dateStr;

  // Gọi API lấy dữ liệu lịch dạy
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

  return (
    <div className="space-y-4 pb-8">
      {/* 1. Header & Bộ Điều Hướng Tuần */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 700, color: "#1e293b" }}>
            Lịch Dạy Hàng Tuần
          </Title>
          <Text type="secondary" className="text-xs">
            Thời khóa biểu giảng dạy và ca học kết nối Camera AI
          </Text>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            icon={<LeftOutlined style={{ fontSize: 12 }} />}
            onClick={handlePrevWeek}
            className="text-xs font-medium text-slate-600 rounded-lg hover:border-blue-500"
          >
            Tuần trước
          </Button>

          <div className="bg-sky-50 text-sky-700 font-semibold px-4 py-1.5 rounded-lg border border-sky-200 text-xs shadow-inner">
            {weekRangeText}
          </div>

          <Button
            onClick={handleNextWeek}
            className="text-xs font-medium text-slate-600 rounded-lg hover:border-blue-500"
          >
            Sang tuần <RightOutlined style={{ fontSize: 12 }} />
          </Button>

          <Button
            type="primary"
            onClick={handleCurrentWeek}
            style={{ background: "#0f172a", borderColor: "#0f172a" }}
            className="text-xs font-semibold rounded-lg ml-1 shadow-sm"
          >
            Hôm nay
          </Button>
        </div>
      </div>

      {/* 2. Lưới Thời Gian 7 Ngày (Time Grid Calendar) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <Spin spinning={isLoading}>
          <div className="min-w-[1050px]">
            {/* Header các cột Ngày trong tuần */}
            <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50/70 text-center">
              <div className="py-3 font-bold text-xs text-slate-400 border-r border-slate-200 flex items-center justify-center">
                GIỜ
              </div>
              {weekDays.map((day) => (
                <div
                  key={day.dateStr}
                  className={`py-3 px-2 border-r border-slate-200 last:border-r-0 transition-colors ${
                    day.isToday ? "bg-sky-50/80 border-b-2 border-b-blue-600" : ""
                  }`}
                >
                  <div
                    className={`font-bold text-sm ${
                      day.isToday ? "text-blue-600 font-extrabold" : "text-slate-700"
                    }`}
                  >
                    {day.label}
                  </div>
                  <div
                    className={`text-xs mt-0.5 ${
                      day.isToday ? "text-blue-600 font-semibold" : "text-slate-400"
                    }`}
                  >
                    {day.formattedDate} {day.isToday && <span className="text-[11px]">(Hôm nay)</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Thân bảng lịch theo giờ (Time slots) */}
            <div className="relative divide-y divide-slate-100">
              {timeSlots.map((time) => (
                <div
                  key={time}
                  className="grid grid-cols-[80px_repeat(7,1fr)] min-h-[90px]"
                >
                  {/* Cột Giờ bên trái */}
                  <div className="p-2 border-r border-slate-200 text-xs font-mono text-slate-400 flex items-start justify-center bg-slate-50/30">
                    {time}
                  </div>

                  {/* 7 Ô ngày trong tuần */}
                  {weekDays.map((day) => {
                    // Lọc các ca học bắt đầu trong khung giờ này
                    const slotHour = parseInt(time.split(":")[0], 10);
                    const matchedSessions = sessions.filter((s) => {
                      if (s.sessionDate !== day.dateStr) return false;
                      const sHour = parseInt(s.startTime.split(":")[0], 10);
                      return sHour === slotHour;
                    });

                    return (
                      <div
                        key={`${day.dateStr}-${time}`}
                        className={`p-1.5 border-r border-slate-100 last:border-r-0 relative transition-colors ${
                          day.isToday ? "bg-sky-50/20" : "hover:bg-slate-50/60"
                        }`}
                      >
                        {matchedSessions.map((session) => (
                          <div key={session.id} className="mb-2">
                            {/* Card Ca Học: 🟢 LIVE */}
                            {session.liveStatus === "LIVE" && (
                              <div
                                className="rounded-xl p-3 border border-emerald-400 shadow-lg transition-all"
                                style={{
                                  background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.25)",
                                }}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse tracking-wide uppercase shadow-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                    ● ĐANG DIỄN RA
                                  </span>
                                  <Tag color="success" className="text-[10px] font-mono m-0 px-1 font-bold">
                                    RTSP LIVE
                                  </Tag>
                                </div>

                                <div className="font-bold text-slate-900 text-xs mb-1">
                                  {session.courseName}
                                </div>

                                <div className="text-[11px] text-slate-600 mb-2 flex items-center gap-1 font-medium">
                                  <span>Phòng: <b>{session.roomCode}</b></span>
                                  <span>•</span>
                                  <span>{session.totalStudents} SV</span>
                                </div>

                                <div className="flex items-center justify-between pt-1.5 border-t border-emerald-200/80 text-[11px]">
                                  <span className="text-slate-500 font-mono">
                                    {session.startTime} - {session.endTime}
                                  </span>
                                  <button
                                    onClick={() => onStartScan(session.id)}
                                    className="flex items-center gap-1 text-emerald-800 hover:text-emerald-950 font-bold bg-white/90 hover:bg-white px-2 py-0.5 rounded-md border border-emerald-300 shadow-sm transition-all text-[11px]"
                                  >
                                    Vào Ca Live <ArrowRightOutlined style={{ fontSize: 10 }} />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Card Ca Học: 🟣 SẮP DIỄN RA */}
                            {session.liveStatus === "UPCOMING" && (
                              <div className="rounded-xl p-3 bg-white border border-slate-200 hover:border-indigo-300 shadow-sm transition-all">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                                    ⏱ Sắp diễn ra
                                  </span>
                                </div>

                                <div className="font-bold text-slate-800 text-xs mb-1">
                                  {session.courseName}
                                </div>

                                <div className="text-[11px] text-slate-500 mb-2 flex items-center gap-1">
                                  <span>Phòng: <b>{session.roomCode}</b></span>
                                  <span>•</span>
                                  <span>{session.totalStudents} SV</span>
                                </div>

                                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] text-slate-400 font-mono">
                                  <span>{session.startTime} - {session.endTime}</span>
                                  <span className="text-[10px]">Chưa tới giờ</span>
                                </div>
                              </div>
                            )}

                            {/* Card Ca Học: ⚪ ĐÃ KẾT THÚC */}
                            {session.liveStatus === "COMPLETED" && (
                              <div className="rounded-xl p-3 bg-slate-50 border border-slate-200/80 shadow-none transition-all">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    ✓ Đã kết thúc (Sĩ số: {session.summary.present}/{session.totalStudents})
                                  </span>
                                </div>

                                <div className="font-bold text-slate-700 text-xs mb-1">
                                  {session.courseName}
                                </div>

                                <div className="text-[11px] text-slate-500 mb-2 flex items-center gap-1">
                                  <span>Phòng: <b>{session.roomCode}</b></span>
                                  <span>•</span>
                                  <span>{session.totalStudents} SV</span>
                                </div>

                                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-[11px]">
                                  <span className="text-slate-400 font-mono">
                                    {session.startTime} - {session.endTime}
                                  </span>
                                  <span className="text-blue-600 font-medium text-[11px] cursor-pointer hover:underline">
                                    Xem lại ảnh proof ➔
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Spin>
      </div>

      {/* 3. Footer Trạng Thái Hệ Thống */}
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
