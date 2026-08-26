import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import "./styles.css";

// -----------------------------------------------------------------------------
// Data Types & Contracts
// -----------------------------------------------------------------------------
type Role = "admin" | "teacher" | "student";
type User = { id: string; fullName: string; role: Role };
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(/\/$/, "");
const ACCESS_TOKEN_KEY = "spas.access-token";

function portalUser(user: { id: string; userCode?: string; fullName: string; role: string }): User {
  return { id: user.userCode ?? user.id, fullName: user.fullName, role: user.role.toLowerCase() as Role };
}

type Section = {
  id: number;
  course_code: string;
  title: string;
  room: string;
  weekday: number;
  period: number;
  start_time: string;
  end_time: string;
  teacher_id?: string;
};

type Attendance = {
  date: string;
  status: "present" | "late" | "absent" | "left-midway" | "excused";
  firstSeenAt?: string;
  faceImage?: string;
  course_code: string;
  title: string;
  room: string;
  period: number;
  startTime: string;
  endTime: string;
};

type StoredUser = User & { enrolledAt?: string };
type RosterStudent = { studentId: string; fullName: string; status?: "present" | "late" | "absent"; firstSeenAt?: string };
type Course = { code: string; title: string };
type Pose = "front" | "left" | "right";

type LeaveRequest = {
  id: string;
  studentId: string;
  studentName: string;
  courseTitle: string;
  date: string;
  type: "absent" | "late";
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

type ClassroomCamera = {
  id: string;
  room: string;
  building: string;
  rtspUrl: string;
  status: "connected" | "offline";
  fps: number;
};

type AuditRecord = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
};

type StudentPage = "dashboard" | "enrollment" | "attendance" | "leave" | "biometric" | "profile";
type TeacherPage = "schedule" | "scan" | "leave_requests" | "reports" | "profile";
type AdminPage = "dashboard" | "biometrics" | "classrooms" | "classes" | "audit" | "profile";
type AnyPage = StudentPage | TeacherPage | AdminPage;

const weekdays = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
const periods = [
  [1, "07:00", "07:50"],
  [2, "07:55", "08:45"],
  [3, "08:50", "09:40"],
  [4, "09:50", "10:40"],
  [5, "10:45", "11:35"],
  [6, "11:40", "12:30"],
  [7, "13:30", "14:20"],
  [8, "14:25", "15:15"],
  [9, "15:20", "16:10"],
  [10, "16:20", "17:10"],
  [11, "17:15", "18:05"],
  [12, "18:20", "19:10"],
  [13, "19:15", "20:05"],
] as const;

const roleLabels: Record<Role, string> = {
  admin: "Quản trị viên SPAS",
  teacher: "Giảng viên",
  student: "Sinh viên",
};

const statusLabels: Record<string, string> = {
  present: "Đúng giờ",
  late: "Đi muộn",
  absent: "Vắng mặt",
  "left-midway": "Rời giữa giờ",
  excused: "Nghỉ có phép",
};

const enrollmentSteps: Array<{ pose: Pose; label: string; icon: string }> = [
  { pose: "front", label: "Nhìn thẳng vào camera", icon: "arrow_upward" },
  { pose: "left", label: "Nghiêng nhẹ sang trái", icon: "arrow_back" },
  { pose: "right", label: "Nghiêng nhẹ sang phải", icon: "arrow_forward" },
  { pose: "front", label: "Quay lại nhìn thẳng", icon: "center_focus_strong" },
];

// -----------------------------------------------------------------------------
// API Helper
// -----------------------------------------------------------------------------
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path.replace(/^\/api/, "")}`, { ...init, headers });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error?.message ?? body?.error ?? "Không thể xử lý yêu cầu.");
  return (body?.data ?? body) as T;
}

function matchesSearch(query: string, ...values: Array<string | number | undefined>) {
  const keyword = query.trim().toLocaleLowerCase("vi-VN");
  return !keyword || values.some((value) => String(value ?? "").toLocaleLowerCase("vi-VN").includes(keyword));
}

// -----------------------------------------------------------------------------
// Camera Components
// -----------------------------------------------------------------------------
function capture(video: HTMLVideoElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!video.videoWidth) return reject(new Error("Camera chưa sẵn sàng."));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return reject(new Error("Không tạo được ảnh camera."));
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Không chụp được ảnh."))), "image/jpeg", 0.9);
  });
}

function stopCamera(video?: HTMLVideoElement) {
  const stream = video?.srcObject;
  if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
  if (video) video.srcObject = null;
}

function Camera({ onReady, showGuide }: { onReady: (video: HTMLVideoElement | undefined) => void; showGuide?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      setMessage("Trình duyệt không hỗ trợ camera.");
      return;
    }
    if (!window.isSecureContext && location.hostname !== "localhost") {
      setMessage("Camera trên mạng LAN cần HTTPS.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        video.srcObject = stream;
        onReady(video);
      })
      .catch(() => setMessage("Không thể truy cập camera. Vui lòng cấp quyền trong trình duyệt."));

    return () => {
      onReady(undefined);
      (video.srcObject as MediaStream | null)?.getTracks().forEach((track) => track.stop());
    };
  }, [onReady]);

  return message ? (
    <div className="notice error"><span className="material-symbols-outlined">error</span>{message}</div>
  ) : (
    <div className="camera-box">
      <video ref={videoRef} autoPlay muted playsInline />
      {showGuide && <div className="face-oval-guide" />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Shared: Proof Image Modal
// -----------------------------------------------------------------------------
function ProofModal({ imageBase64, onClose }: { imageBase64: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Minh chứng điểm danh AI</h3>
          <button className="btn-ghost" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="modal-body">
          <img src={`data:image/jpeg;base64,${imageBase64}`} alt="Minh chứng khuôn mặt" className="proof-preview-img" />
          <p className="sub-text" style={{ marginTop: 12, textAlign: "center" }}>
            Khung hình trích xuất tự động tại thời điểm nhận diện khuôn mặt.
          </p>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Login Page
// -----------------------------------------------------------------------------
function Login({ onLogin }: { onLogin: (user: User) => Promise<void> }) {
  const [userId, setUserId] = useState("SV001");
  const [password, setPassword] = useState("sv123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ accessToken: string; user: { id: string; userCode?: string; fullName: string; role: string } }>("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: userId, password }),
      });
      localStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken);
      await onLogin(portalUser(result.user));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Đăng nhập thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const quickSelect = (id: string, pass: string) => {
    setUserId(id);
    setPassword(pass);
  };

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-logo">
            <span className="material-symbols-outlined fill">school</span>
          </div>
          <div>
            <h1>SPAS Academic</h1>
            <p className="sub-text">Hệ thống điểm danh thụ động</p>
          </div>
        </div>

        <form className="login-form" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="user-id">Mã tài khoản (MSSV / Mã GV / Admin)</label>
            <input
              id="user-id"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="VD: SV001, GV001, ADMIN001"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Đang xác thực..." : "Đăng nhập cổng học vụ"}
          </button>
        </form>

        {error && (
          <div className="notice error" style={{ marginTop: 16 }}>
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        <div className="login-demo-pills">
          <p className="sub-text">Chọn nhanh tài khoản thử nghiệm:</p>
          <div className="demo-btn-group">
            <button type="button" className="secondary small-button" onClick={() => quickSelect("SV001", "sv123")}>
              Sinh viên
            </button>
            <button type="button" className="secondary small-button" onClick={() => quickSelect("GV001", "gv123")}>
              Giảng viên
            </button>
            <button type="button" className="secondary small-button" onClick={() => quickSelect("ADMIN001", "admin123")}>
              Quản trị viên
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// -----------------------------------------------------------------------------
// Component: Timetable (Thời khóa biểu)
// -----------------------------------------------------------------------------
function Timetable({ sections, selected, onSelect }: { sections: Section[]; selected?: Section; onSelect?: (section: Section) => void }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Thời khóa biểu tuần</h2>
          <p>Lịch học và giảng dạy theo ca chuẩn của trường.</p>
        </div>
        <span className="header-title-badge">
          <span className="material-symbols-outlined">calendar_today</span>
          HK1 2026–2027
        </span>
      </div>
      <div className="timetable-wrap">
        <div className="timetable">
          <div className="time-head">Ca học</div>
          {weekdays.map((day) => (
            <div className="day-head" key={day}>{day}</div>
          ))}
          {periods.map(([period, start, end]) => (
            <div className="timetable-row" style={{ display: "contents" }} key={period}>
              <div className="period">
                <strong>Ca {period}</strong>
                <span>{start} – {end}</span>
              </div>
              {weekdays.map((_, day) => {
                const section = sections.find((item) => item.weekday === day && item.period === period);
                return (
                  <div className="slot" key={day}>
                    {section && (
                      onSelect ? (
                        <button
                          type="button"
                          className={`lesson-card selectable ${selected?.id === section.id ? "selected" : ""}`}
                          onClick={() => onSelect(section)}
                          title={`${section.course_code} - ${section.title} (Phòng ${section.room})`}
                        >
                          <b>{section.course_code}</b>
                          <span>{section.title}</span>
                          <small>Phòng {section.room}</small>
                        </button>
                      ) : (
                        <div
                          className="lesson-card"
                          title={`${section.course_code} - ${section.title} (Phòng ${section.room})`}
                        >
                          <b>{section.course_code}</b>
                          <span>{section.title}</span>
                          <small>Phòng {section.room}</small>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// STUDENT: Dashboard (Clean, Simple, Stats + Warning + Timetable)
// -----------------------------------------------------------------------------
function StudentDashboard({ user, sections }: { user: User; sections: Section[] }) {
  const [attendances, setAttendances] = useState<Attendance[]>([]);

  useEffect(() => {
    api<{ attendance: Attendance[] }>("/api/attendance/me")
      .then((data) => setAttendances(data.attendance))
      .catch(() => undefined);
  }, []);

  const total = attendances.length || 1;
  const presentCount = attendances.filter((a) => a.status === "present").length;
  const lateCount = attendances.filter((a) => a.status === "late").length;
  const absentCount = attendances.filter((a) => a.status === "absent").length;
  const excusedCount = attendances.filter((a) => a.status === "excused").length;
  const attendanceRate = Math.round(((presentCount + lateCount + excusedCount) / total) * 100) || 100;

  return (
    <div className="stack">
      {/* Greeting Banner */}
      <div className="banner-greeting">
        <div>
          <h2>Xin chào, {user.fullName} 👋</h2>
          <p className="sub-text">Hệ thống ghi nhận trạng thái học tập của bạn theo thời gian thực.</p>
        </div>
        <span className="header-title-badge">
          MSSV: {user.id}
        </span>
      </div>

      {/* Risk Warning (if any absence) */}
      {absentCount > 0 && (
        <div className="banner-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3>Chú ý chuyên cần</h3>
            <p className="sub-text" style={{ color: "#92400e" }}>
              Bạn đã có {absentCount} buổi vắng. Tỉ lệ vắng vượt quá 20% tổng số buổi sẽ không đủ điều kiện dự thi kết thúc học phần.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="rate-card">
          <div>
            <div className="kpi-metric">{attendanceRate}%</div>
            <div className="kpi-label">Chuyên cần tổng thể</div>
          </div>
          <div className="donut-ring" style={{ ["--rate" as string]: `${attendanceRate}%` }}>
            <div className="donut-ring-inner">{attendanceRate}%</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon present">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div>
            <div className="kpi-metric">{presentCount}</div>
            <div className="kpi-label">Buổi đúng giờ</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon late">
            <span className="material-symbols-outlined">schedule</span>
          </div>
          <div>
            <div className="kpi-metric">{lateCount}</div>
            <div className="kpi-label">Buổi đi muộn</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon absent">
            <span className="material-symbols-outlined">cancel</span>
          </div>
          <div>
            <div className="kpi-metric">{absentCount}</div>
            <div className="kpi-label">Buổi vắng</div>
          </div>
        </div>
      </div>

      {/* Timetable */}
      <Timetable sections={sections} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// STUDENT: Attendance History
// -----------------------------------------------------------------------------
function AttendanceHistory() {
  const [rows, setRows] = useState<Attendance[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    api<{ attendance: Attendance[] }>("/api/attendance/me")
      .then((data) => setRows(data.attendance))
      .catch((cause) => setError(cause.message));
  }, []);

  const filteredRows = rows.filter((row) =>
    matchesSearch(
      query,
      row.date,
      row.course_code,
      row.title,
      row.room,
      `Ca ${row.period}`,
      row.startTime,
      row.endTime,
      statusLabels[row.status] ?? row.status
    )
  );

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Lịch sử điểm danh chi tiết</h2>
            <p>Toàn bộ dữ liệu nhận diện tự động và điểm danh theo môn học.</p>
          </div>
          <div className="search-input-wrap">
            <span className="material-symbols-outlined">search</span>
            <input
              type="search"
              placeholder="Tìm theo môn, ngày, ca học..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <div className="notice error">{error}</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ngày học</th>
                  <th>Học phần</th>
                  <th>Phòng / Ca</th>
                  <th>Thời gian nhận diện</th>
                  <th>Trạng thái</th>
                  <th>Minh chứng AI</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length ? (
                  filteredRows.map((row, idx) => (
                    <tr key={`${row.date}-${row.course_code}-${row.period}-${idx}`}>
                      <td><b>{row.date}</b></td>
                      <td>
                        <b>{row.course_code}</b>
                        <br />
                        <small>{row.title}</small>
                      </td>
                      <td>
                        Phòng {row.room}
                        <br />
                        <small>Ca {row.period} · {row.startTime}–{row.endTime}</small>
                      </td>
                      <td>{row.firstSeenAt ? new Date(row.firstSeenAt).toLocaleTimeString("vi-VN") : "—"}</td>
                      <td>
                        <span className={`status ${row.status}`}>
                          <span className="status-dot" />
                          {statusLabels[row.status] ?? row.status}
                        </span>
                      </td>
                      <td>
                        {row.faceImage ? (
                          <img
                            className="proof-thumbnail"
                            src={`data:image/jpeg;base64,${row.faceImage}`}
                            alt="Ảnh nhận diện"
                            onClick={() => setPreviewImage(row.faceImage!)}
                            title="Bấm để phóng to"
                          />
                        ) : (
                          <small>Không có</small>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      {rows.length ? "Không tìm thấy dữ liệu phù hợp." : "Chưa có bản ghi điểm danh nào."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {previewImage && <ProofModal imageBase64={previewImage} onClose={() => setPreviewImage(null)} />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// STUDENT: Face eKYC Onboarding
// -----------------------------------------------------------------------------
function Enrollment() {
  const [video, setVideo] = useState<HTMLVideoElement>();
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [captured, setCaptured] = useState(0);
  const [message, setMessage] = useState("Bấm bật camera để bắt đầu quy trình đăng ký khuôn mặt.");
  const [submitting, setSubmitting] = useState(false);
  const [enrolledAt, setEnrolledAt] = useState<string>();

  const frames = useRef<Blob[]>([]);
  const inFlight = useRef(false);
  const finished = useRef(false);
  const current = enrollmentSteps[step] ?? enrollmentSteps.at(-1)!;

  const submitFrames = useCallback(
    async (items: Blob[]) => {
      setSubmitting(true);
      setMessage("Đủ 8 góc pose hợp lệ. Đang huấn luyện vector khuôn mặt...");
      try {
        const form = new FormData();
        items.forEach((frame, index) => form.append("frames", frame, `pose-${index + 1}.jpg`));
        const result = await api<{ accepted: number }>("/api/ai/enroll", { method: "POST", body: form });
        stopCamera(video);
        setVideo(undefined);
        setEnrolledAt(new Date().toISOString());
        setMessage(`Đăng ký thành công! Đã nạp ${result.accepted} khuôn mặt vào hệ thống vector nhận diện.`);
      } catch (cause) {
        finished.current = false;
        setStarted(false);
        setMessage(cause instanceof Error ? cause.message : "Đăng ký thất bại.");
      } finally {
        setSubmitting(false);
      }
    },
    [video]
  );

  const collect = useCallback(async () => {
    if (!video || !started || inFlight.current || finished.current) return;
    inFlight.current = true;
    try {
      const frame = await capture(video);
      const form = new FormData();
      form.append("image", frame, "pose.jpg");
      const result = await api<{ pose: string; confidence: number; detail: string }>("/api/ai/face-pose", {
        method: "POST",
        body: form,
      });

      if (result.pose !== current.pose || result.confidence < 0.6) {
        setMessage(`Bước ${step + 1}/4: ${current.label}. ${result.detail || "Giữ khuôn mặt ổn định trong khung elip."}`);
        return;
      }

      const items = [...frames.current, frame];
      frames.current = items;
      const phaseCount = items.length - step * 2;
      setCaptured(phaseCount);

      if (items.length === 8) {
        finished.current = true;
        setStarted(false);
        await submitFrames(items);
        return;
      }

      if (phaseCount === 2) {
        setStep((index) => index + 1);
        setCaptured(0);
        setMessage(`Tốt! Tiếp theo: ${enrollmentSteps[step + 1].label}.`);
      } else {
        setMessage(`Bước ${step + 1}/4: ${current.label} · Đã chụp ${phaseCount}/2 ảnh.`);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Đang kiểm tra pose...");
    } finally {
      inFlight.current = false;
    }
  }, [current.label, current.pose, started, step, submitFrames, video]);

  useEffect(() => {
    if (!started || !video || finished.current) return;
    const timer = window.setInterval(() => void collect(), 800);
    return () => window.clearInterval(timer);
  }, [collect, started, video]);

  useEffect(() => {
    api<{ user: StoredUser }>("/api/profile")
      .then((data) => setEnrolledAt(data.user.enrolledAt))
      .catch(() => undefined);
  }, []);

  const toggleCamera = () => {
    if (cameraEnabled) {
      stopCamera(video);
      setVideo(undefined);
      setCameraEnabled(false);
      setStarted(false);
      frames.current = [];
      setStep(0);
      setCaptured(0);
      setMessage("Camera đã tắt.");
    } else {
      setCameraEnabled(true);
      setMessage("Đang mở camera. Hãy cấp quyền nếu trình duyệt yêu cầu.");
    }
  };

  const begin = () => {
    frames.current = [];
    finished.current = false;
    setStep(0);
    setCaptured(0);
    setStarted(true);
    setMessage("Bước 1/4: Nhìn thẳng vào camera. Giữ khuôn mặt trong khung elip.");
  };

  if (enrolledAt) {
    return (
      <section className="panel enrollment-container">
        <div className="panel-heading">
          <h2>Hồ sơ sinh trắc học đã xác thực</h2>
          <span className="status present">
            <span className="status-dot" /> Đã đăng ký
          </span>
        </div>
        <div className="panel-body">
          <div className="notice success">
            <span className="material-symbols-outlined">verified</span>
            Khuôn mặt đã được xác thực vào {new Date(enrolledAt).toLocaleString("vi-VN")}.
          </div>
          <p className="sub-text" style={{ marginTop: 14 }}>
            Dữ liệu vector khuôn mặt của bạn đang hoạt động trên toàn bộ hệ thống camera lớp học. Nếu cần cập nhật lại khuôn mặt, vui lòng liên hệ Ban quản trị để yêu cầu reset.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel enrollment-container">
      <div className="panel-heading">
        <div>
          <h2>Đăng ký khuôn mặt eKYC</h2>
          <p>Thu thập 8 khung hình đa góc để nhận diện điểm danh tự động.</p>
        </div>
        <span className="header-title-badge">AI Biometric</span>
      </div>

      <div className="panel-body">
        {/* Step Indicator */}
        <div className="step-indicator">
          {enrollmentSteps.map((item, index) => (
            <div
              key={index}
              className={`step-pill ${index === step ? "active" : index < step ? "done" : ""}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{item.icon}</span>
              <div>{item.label}</div>
            </div>
          ))}
        </div>

        {cameraEnabled && <Camera onReady={setVideo} showGuide />}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="secondary" onClick={toggleCamera} disabled={submitting}>
            <span className="material-symbols-outlined">videocam</span>
            {cameraEnabled ? "Tắt camera" : "Bật camera"}
          </button>

          {cameraEnabled && (
            <button className="btn-primary" disabled={!video || started || submitting} onClick={begin}>
              <span className="material-symbols-outlined">play_arrow</span>
              {submitting ? "Đang xử lý..." : started ? "Đang nhận diện..." : "Bắt đầu đăng ký"}
            </button>
          )}
        </div>

        <div className="notice info" style={{ marginTop: 16 }}>
          <span className="material-symbols-outlined">info</span>
          {message}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// STUDENT: Leave Requests (Cổng đơn xin nghỉ & đi muộn)
// -----------------------------------------------------------------------------
function StudentLeaveRequests({ sections }: { sections: Section[] }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([
    {
      id: "LR-001",
      studentId: "SV001",
      studentName: "Nguyễn Văn An",
      courseTitle: "Lập trình Web nâng cao",
      date: "2026-08-28",
      type: "absent",
      reason: "Có lịch khám sức khỏe định kỳ tại bệnh viện Đa khoa",
      status: "approved",
      createdAt: "2026-08-20",
    },
    {
      id: "LR-002",
      studentId: "SV001",
      studentName: "Nguyễn Văn An",
      courseTitle: "Trí tuệ nhân tạo",
      date: "2026-09-02",
      type: "late",
      reason: "Xe buýt gặp sự cố trên tuyến đường đến trường",
      status: "pending",
      createdAt: "2026-08-24",
    },
  ]);

  const [sectionId, setSectionId] = useState("");
  const [type, setType] = useState<"absent" | "late">("absent");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const targetSection = sections.find((s) => s.id === Number(sectionId));
    const newReq: LeaveRequest = {
      id: `LR-00${requests.length + 1}`,
      studentId: "SV001",
      studentName: "Nguyễn Văn An",
      courseTitle: targetSection ? `${targetSection.course_code} - ${targetSection.title}` : "Học phần đã chọn",
      date: date || new Date().toISOString().slice(0, 10),
      type,
      reason,
      status: "pending",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setRequests([newReq, ...requests]);
    setReason("");
    setSuccessMsg("Gửi đơn xin phép thành công! Đang chờ giảng viên phê duyệt.");
  };

  return (
    <div className="grid-2">
      {/* Form gửi đơn */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Tạo đơn xin nghỉ / đi muộn</h2>
            <p>Đơn được gửi trực tiếp đến giảng viên phụ trách môn học.</p>
          </div>
        </div>
        <form className="panel-body login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Học phần xin phép</label>
            <select required value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">-- Chọn môn học phần --</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.course_code} · {s.title} (Phòng {s.room})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Loại yêu cầu</label>
            <div style={{ display: "flex", gap: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: "normal" }}>
                <input
                  type="radio"
                  name="leaveType"
                  checked={type === "absent"}
                  onChange={() => setType("absent")}
                  style={{ width: "auto" }}
                />
                Nghỉ cả buổi học
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: "normal" }}>
                <input
                  type="radio"
                  name="leaveType"
                  checked={type === "late"}
                  onChange={() => setType("late")}
                  style={{ width: "auto" }}
                />
                Xin phép đến muộn
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Ngày xin phép</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Lý do xin phép (tối thiểu 10 ký tự)</label>
            <textarea
              rows={3}
              required
              minLength={10}
              placeholder="Nêu rõ lý do vắng mặt / đi muộn..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary">
            <span className="material-symbols-outlined">send</span> Gửi đơn xin phép
          </button>

          {successMsg && <div className="notice success">{successMsg}</div>}
        </form>
      </section>

      {/* Lịch sử đơn */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Lịch sử đơn đã gửi ({requests.length})</h2>
            <p>Trạng thái xử lý từ giảng viên bộ môn.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Môn học</th>
                <th>Ngày xin</th>
                <th>Loại</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.courseTitle}</b>
                    <br />
                    <small>{r.reason}</small>
                  </td>
                  <td>{r.date}</td>
                  <td>{r.type === "absent" ? "Nghỉ học" : "Đi muộn"}</td>
                  <td>
                    <span className={`status ${r.status === "approved" ? "present" : r.status === "rejected" ? "absent" : "pending"}`}>
                      <span className="status-dot" />
                      {r.status === "approved" ? "Đã duyệt" : r.status === "rejected" ? "Từ chối" : "Chờ duyệt"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// STUDENT: Biometric Profile
// -----------------------------------------------------------------------------
function StudentBiometricProfile({ user }: { user: User }) {
  const [profile, setProfile] = useState<StoredUser>();

  useEffect(() => {
    api<{ user: StoredUser }>("/api/profile")
      .then((data) => setProfile(data.user))
      .catch(() => undefined);
  }, []);

  return (
    <section className="panel" style={{ maxWidth: 680 }}>
      <div className="panel-heading">
        <div>
          <h2>Hồ sơ sinh trắc học cá nhân</h2>
          <p>Mã định danh nhận dạng và trạng thái bảo mật khuôn mặt.</p>
        </div>
        <span className="status present">
          <span className="status-dot" /> Đang bảo vệ
        </span>
      </div>
      <div className="panel-body stack">
        <div className="grid-2">
          <div className="form-group">
            <label>Mã sinh viên</label>
            <input readOnly value={user.id} />
          </div>
          <div className="form-group">
            <label>Họ và tên</label>
            <input readOnly value={user.fullName} />
          </div>
        </div>

        <div className="notice info">
          <span className="material-symbols-outlined">fingerprint</span>
          <div>
            <b>Mã nhận dạng Vector:</b> Vector-512D (#{user.id}-AI-FACENET)
            <br />
            <small>Ngày nạp khuôn mặt: {profile?.enrolledAt ? new Date(profile.enrolledAt).toLocaleString("vi-VN") : "Đang đồng bộ"}</small>
          </div>
        </div>

        <p className="sub-text">
          Dữ liệu khuôn mặt được mã hóa dưới dạng vector đặc trưng toán học và không lưu trữ ảnh thô trái phép.
        </p>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// TEACHER: Schedule Hub
// -----------------------------------------------------------------------------
function TeacherSchedule({ sections, onStartScan }: { sections: Section[]; onStartScan: (section: Section) => void }) {
  return (
    <div className="stack">
      <div className="banner-greeting">
        <div>
          <h2>Lịch giảng dạy & Thời khóa biểu tuần</h2>
          <p className="sub-text">Theo dõi lịch các ca học phần và chuyển nhanh sang chế độ điểm danh camera.</p>
        </div>
        <span className="header-title-badge">
          <span className="material-symbols-outlined">class</span> {sections.length} lớp học phần
        </span>
      </div>

      <Timetable sections={sections} onSelect={onStartScan} />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Danh sách các lớp học phần phụ trách ({sections.length})</h2>
            <p>Bấm &quot;Mở Camera điểm danh&quot; để bắt đầu phiên nhận diện tự động cho ca học.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã môn</th>
                <th>Tên môn học</th>
                <th>Phòng học</th>
                <th>Thời gian ca học</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {sections.length ? (
                sections.map((section) => (
                  <tr key={section.id}>
                    <td><b>{section.course_code}</b></td>
                    <td>{section.title}</td>
                    <td>Phòng {section.room}</td>
                    <td>
                      {weekdays[section.weekday]} · Ca {section.period}
                      <br />
                      <small>{section.start_time} – {section.end_time}</small>
                    </td>
                    <td>
                      <button className="btn-primary small-button" onClick={() => onStartScan(section)}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>
                        Mở Camera điểm danh
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="empty-cell">Chưa có lớp học phần nào được phân công.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TEACHER: Scan & Live Attendance
// -----------------------------------------------------------------------------
function TeacherScan({ sections, initialSection }: { sections: Section[]; initialSection?: Section }) {
  const [selected, setSelected] = useState<Section | undefined>(initialSection || sections[0]);
  const [video, setVideo] = useState<HTMLVideoElement>();
  const [message, setMessage] = useState("Sẵn sàng quét điểm danh khuôn mặt.");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [rosterQuery, setRosterQuery] = useState("");
  const scanInFlight = useRef(false);

  useEffect(() => {
    if (initialSection) setSelected(initialSection);
  }, [initialSection]);

  const loadRoster = useCallback(async () => {
    if (!selected) return;
    const data = await api<{ students: RosterStudent[] }>(`/api/sections/${selected.id}/students`);
    setRoster(data.students);
  }, [selected]);

  useEffect(() => {
    setScanning(false);
    setRoster([]);
    if (selected) void loadRoster().catch((cause) => setMessage(cause.message));
  }, [loadRoster, selected]);

  const scanImage = useCallback(
    async (image: Blob) => {
      if (!selected || scanInFlight.current) return;
      scanInFlight.current = true;
      setBusy(true);
      try {
        const form = new FormData();
        form.append("image", image, "classroom.jpg");
        const result = await api<{ faces: number; results: Array<{ student_id: string; name: string; score: number }> }>("/api/ai/recognize", {
          method: "POST",
          body: form,
        });
        const recognized = result.results.filter((face) => face.student_id).map((face) => `${face.student_id} (${face.score.toFixed(2)})`);
        setMessage(`AI phát hiện ${result.faces} khuôn mặt. Nhận diện: ${recognized.join(", ") || "Chưa có khuôn mặt đã đăng ký"}.`);
        await loadRoster().catch(() => undefined);
      } catch (cause) {
        setMessage(cause instanceof Error ? cause.message : "Quét thất bại.");
      } finally {
        scanInFlight.current = false;
        setBusy(false);
      }
    },
    [loadRoster, selected]
  );

  const scan = useCallback(async () => {
    if (!video) return;
    await scanImage(await capture(video));
  }, [scanImage, video]);

  useEffect(() => {
    if (!scanning) return;
    void scan();
    const timer = window.setInterval(() => void scan(), 1500);
    return () => window.clearInterval(timer);
  }, [scan, scanning]);

  const mark = async (studentId: string, status: RosterStudent["status"]) => {
    if (!selected || !status) return;
    try {
      await api("/api/attendance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sectionId: selected.id, studentId, status }),
      });
      await loadRoster();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Không lưu được điểm danh.");
    }
  };

  const filteredRoster = roster.filter((student) =>
    matchesSearch(rosterQuery, student.studentId, student.fullName, student.status ? statusLabels[student.status] : "Chưa điểm danh")
  );

  const presentCount = roster.filter((s) => s.status === "present").length;
  const lateCount = roster.filter((s) => s.status === "late").length;
  const absentCount = roster.filter((s) => s.status === "absent").length;

  return (
    <div className="stack">
      {/* Class Selector Panel */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Chọn lớp học phần cần điểm danh</h2>
            <p>Chọn lớp để camera AI gán dữ liệu nhận diện vào đúng danh sách sinh viên.</p>
          </div>
          <div style={{ minWidth: 260 }}>
            <select
              value={selected?.id ?? ""}
              onChange={(e) => {
                const sec = sections.find((s) => s.id === Number(e.target.value));
                setSelected(sec);
              }}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.course_code} · {s.title} (Phòng {s.room} - {weekdays[s.weekday]} Ca {s.period})
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Live Camera View */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{selected ? `Camera phòng học: ${selected.room} (${selected.course_code})` : "Camera điểm danh"}</h2>
            <p>{selected ? `Thời gian: ${weekdays[selected.weekday]} · Ca ${selected.period} (${selected.start_time} – ${selected.end_time})` : message}</p>
          </div>
          {selected && (
            <span className="status present">
              <span className="status-dot" /> Đang hoạt động
            </span>
          )}
        </div>

        <div className="panel-body stack">
          <Camera onReady={setVideo} />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn-primary" disabled={!selected || !video || busy} onClick={() => void scan()}>
              <span className="material-symbols-outlined">center_focus_strong</span>
              {busy ? "Đang nhận diện..." : "Quét 1 Frame"}
            </button>

            <button className="secondary" disabled={!selected || !video} onClick={() => setScanning((v) => !v)}>
              <span className="material-symbols-outlined">{scanning ? "stop" : "videocam"}</span>
              {scanning ? "Dừng quét Realtime" : "Bật quét Realtime (AI)"}
            </button>

            <label className="secondary btn-secondary" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="material-symbols-outlined">upload_file</span> Quét ảnh chụp lớp
              <input
                type="file"
                accept="image/jpeg,image/png"
                disabled={!selected || busy}
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) void scanImage(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          <div className="notice info">
            <span className="material-symbols-outlined">info</span>
            {message}
          </div>
        </div>
      </section>

      {/* Live Class Roster Table */}
      {selected && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Danh sách sinh viên lớp: {selected.course_code} ({roster.length})</h2>
              <p>Đúng giờ: {presentCount} · Đi muộn: {lateCount} · Vắng: {absentCount}</p>
            </div>
            <div className="search-input-wrap">
              <span className="material-symbols-outlined">search</span>
              <input
                type="search"
                placeholder="Tìm MSSV, họ tên..."
                value={rosterQuery}
                onChange={(e) => setRosterQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>MSSV</th>
                  <th>Họ và tên</th>
                  <th>Thời gian nhận diện</th>
                  <th>Trạng thái điểm danh</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoster.length ? (
                  filteredRoster.map((student) => (
                    <tr key={student.studentId}>
                      <td><b>{student.studentId}</b></td>
                      <td>{student.fullName}</td>
                      <td>{student.firstSeenAt ? new Date(student.firstSeenAt).toLocaleTimeString("vi-VN") : "—"}</td>
                      <td>
                        <select
                          style={{ width: "auto", minHeight: 32 }}
                          value={student.status ?? ""}
                          onChange={(e) => void mark(student.studentId, e.target.value as RosterStudent["status"])}
                        >
                          <option value="">Chưa điểm danh</option>
                          <option value="present">Đúng giờ</option>
                          <option value="late">Đi muộn</option>
                          <option value="absent">Vắng mặt</option>
                        </select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="empty-cell">Chưa có sinh viên nào trong lớp này.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// TEACHER: Leave Requests Approval
// -----------------------------------------------------------------------------
function TeacherLeaveRequests() {
  const [requests, setRequests] = useState<LeaveRequest[]>([
    {
      id: "LR-101",
      studentId: "SV001",
      studentName: "Nguyễn Văn An",
      courseTitle: "Lập trình Web nâng cao (D3-501)",
      date: "2026-08-28",
      type: "absent",
      reason: "Có lịch khám sức khỏe định kỳ tại bệnh viện Đa khoa",
      status: "pending",
      createdAt: "2026-08-24",
    },
    {
      id: "LR-102",
      studentId: "SV002",
      studentName: "Trần Thị Bích Ngọc",
      courseTitle: "Trí tuệ nhân tạo (A1-204)",
      date: "2026-08-29",
      type: "late",
      reason: "Xe buýt tuyến 08 bị sự cố trên đường đến lớp",
      status: "pending",
      createdAt: "2026-08-24",
    },
  ]);

  const updateStatus = (id: string, newStatus: "approved" | "rejected") => {
    setRequests(requests.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Phê duyệt đơn xin nghỉ & đi muộn</h2>
          <p>Sinh viên gửi đơn kèm minh chứng trước hoặc sau buổi học.</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sinh viên</th>
              <th>Học phần</th>
              <th>Ngày xin phép</th>
              <th>Loại & Lý do</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>
                  <b>{r.studentName}</b>
                  <br />
                  <small>MSSV: {r.studentId}</small>
                </td>
                <td>{r.courseTitle}</td>
                <td>{r.date}</td>
                <td>
                  <span className={`status ${r.type === "absent" ? "absent" : "late"}`}>
                    {r.type === "absent" ? "Xin vắng" : "Xin đến muộn"}
                  </span>
                  <br />
                  <small>{r.reason}</small>
                </td>
                <td>
                  <span className={`status ${r.status === "approved" ? "present" : r.status === "rejected" ? "absent" : "pending"}`}>
                    <span className="status-dot" />
                    {r.status === "approved" ? "Đã duyệt" : r.status === "rejected" ? "Từ chối" : "Chờ duyệt"}
                  </span>
                </td>
                <td>
                  {r.status === "pending" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn-primary small-button" onClick={() => updateStatus(r.id, "approved")}>
                        Duyệt
                      </button>
                      <button className="secondary small-button" onClick={() => updateStatus(r.id, "rejected")}>
                        Từ chối
                      </button>
                    </div>
                  ) : (
                    <small>Đã xử lý</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// TEACHER: Attendance Reports & Multi-Session Matrix (Báo cáo chuyên cần)
// -----------------------------------------------------------------------------
type MatrixSession = {
  index: number;
  label: string;
  date: string;
};

type StudentMatrixRow = {
  id: string;
  studentId: string;
  fullName: string;
  records: Record<number, { status: "present" | "late" | "absent" | "excused" | "empty"; time?: string; confidence?: number; proofImage?: string }>;
};

const DEFAULT_SESSIONS: MatrixSession[] = [
  { index: 1, label: "B1", date: "24/08" },
  { index: 2, label: "B2", date: "31/08" },
  { index: 3, label: "B3", date: "07/09" },
  { index: 4, label: "B4", date: "14/09" },
  { index: 5, label: "B5", date: "21/09" },
  { index: 6, label: "B6", date: "28/09" },
  { index: 7, label: "B7", date: "05/10" },
  { index: 8, label: "B8", date: "12/10" },
];

const INITIAL_MATRIX_STUDENTS: StudentMatrixRow[] = [
  {
    id: "s1",
    studentId: "2114101",
    fullName: "Nguyễn Văn An",
    records: {
      1: { status: "present", time: "07:02", confidence: 99.1 },
      2: { status: "present", time: "07:04", confidence: 98.6 },
      3: { status: "absent" },
      4: { status: "late", time: "07:11", confidence: 97.4 },
      5: { status: "absent" },
      6: { status: "present", time: "07:01", confidence: 99.4 },
      7: { status: "absent" },
      8: { status: "absent" },
    },
  },
  {
    id: "s2",
    studentId: "2114102",
    fullName: "Lê Thị Mai",
    records: {
      1: { status: "present", time: "07:01", confidence: 99.5 },
      2: { status: "present", time: "07:03", confidence: 99.2 },
      3: { status: "present", time: "07:02", confidence: 98.9 },
      4: { status: "present", time: "07:05", confidence: 99.0 },
      5: { status: "present", time: "07:01", confidence: 99.7 },
      6: { status: "present", time: "07:04", confidence: 98.8 },
      7: { status: "present", time: "07:02", confidence: 99.3 },
      8: { status: "present", time: "07:03", confidence: 99.1 },
    },
  },
  {
    id: "s3",
    studentId: "2114103",
    fullName: "Trần Văn Cường",
    records: {
      1: { status: "present", time: "07:03", confidence: 98.2 },
      2: { status: "late", time: "07:12", confidence: 97.8 },
      3: { status: "present", time: "07:04", confidence: 99.0 },
      4: { status: "late", time: "07:09", confidence: 96.9 },
      5: { status: "present", time: "07:02", confidence: 98.5 },
      6: { status: "present", time: "07:01", confidence: 99.2 },
      7: { status: "late", time: "07:14", confidence: 97.1 },
      8: { status: "present", time: "07:05", confidence: 98.7 },
    },
  },
  {
    id: "s4",
    studentId: "2114104",
    fullName: "Phạm Quỳnh Trang",
    records: {
      1: { status: "present", time: "07:02", confidence: 99.3 },
      2: { status: "present", time: "07:01", confidence: 99.6 },
      3: { status: "excused", time: "Đã duyệt đơn nghỉ phép" },
      4: { status: "present", time: "07:04", confidence: 98.7 },
      5: { status: "present", time: "07:02", confidence: 99.1 },
      6: { status: "present", time: "07:03", confidence: 99.4 },
      7: { status: "present", time: "07:01", confidence: 99.0 },
      8: { status: "present", time: "07:05", confidence: 98.9 },
    },
  },
  {
    id: "s5",
    studentId: "2114105",
    fullName: "Hoàng Minh Đức",
    records: {
      1: { status: "absent" },
      2: { status: "present", time: "07:04", confidence: 98.1 },
      3: { status: "absent" },
      4: { status: "absent" },
      5: { status: "present", time: "07:03", confidence: 98.8 },
      6: { status: "present", time: "07:02", confidence: 99.0 },
      7: { status: "absent" },
      8: { status: "present", time: "07:04", confidence: 97.9 },
    },
  },
];

function TeacherReports({ sections }: { sections: Section[] }) {
  const [selectedSectionId, setSelectedSectionId] = useState<number>(sections[0]?.id || 1);
  const [semester, setSemester] = useState("HK1 (2026-2027)");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<StudentMatrixRow[]>(INITIAL_MATRIX_STUDENTS);
  const [proofModal, setProofModal] = useState<{ student: StudentMatrixRow; sessionIndex: number } | null>(null);
  const [editModal, setEditModal] = useState<{ student: StudentMatrixRow; sessionIndex: number; newStatus: "present" | "late" | "absent" | "excused"; note: string } | null>(null);

  const selectedSection = sections.find((s) => s.id === selectedSectionId) || sections[0] || {
    id: 1,
    course_code: "INT101",
    title: "Nhập môn Trí tuệ nhân tạo",
    room: "A2-301",
    weekday: 0,
    period: 1,
    start_time: "07:00",
    end_time: "07:50",
    teacher_id: "GV001",
  };

  // Filter students
  const filteredStudents = students.filter((s) => {
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Status / Risk filter
    const totalAbsent = DEFAULT_SESSIONS.filter((sess) => s.records[sess.index]?.status === "absent").length;
    const totalLate = DEFAULT_SESSIONS.filter((sess) => s.records[sess.index]?.status === "late").length;
    const isBanned = (totalAbsent / DEFAULT_SESSIONS.length) >= 0.20;

    if (statusFilter === "banned" && !isBanned) return false;
    if (statusFilter === "late" && totalLate < 2) return false;
    if (statusFilter === "perfect" && totalAbsent > 0) return false;

    return true;
  });

  // Calculate KPIs
  const totalSlots = filteredStudents.length * DEFAULT_SESSIONS.length;
  let totalPresentCount = 0;
  let bannedRiskCount = 0;

  filteredStudents.forEach((s) => {
    let studentAbsent = 0;
    DEFAULT_SESSIONS.forEach((sess) => {
      const st = s.records[sess.index]?.status;
      if (st === "present" || st === "late" || st === "excused") {
        totalPresentCount++;
      }
      if (st === "absent") {
        studentAbsent++;
      }
    });
    if ((studentAbsent / DEFAULT_SESSIONS.length) >= 0.20) {
      bannedRiskCount++;
    }
  });

  const avgAttendance = totalSlots ? ((totalPresentCount / totalSlots) * 100).toFixed(1) : "94.2";

  // Export to CSV/Excel
  const handleExportExcel = () => {
    const headers = ["STT", "MSSV", "Họ và Tên", ...DEFAULT_SESSIONS.map((s) => `${s.label} (${s.date})`), "Số buổi vắng", "Tỷ lệ chuyên cần", "Trạng thái"];
    const rows = filteredStudents.map((s, idx) => {
      const absentCount = DEFAULT_SESSIONS.filter((sess) => s.records[sess.index]?.status === "absent").length;
      const rate = (((DEFAULT_SESSIONS.length - absentCount) / DEFAULT_SESSIONS.length) * 100).toFixed(1) + "%";
      const isBanned = (absentCount / DEFAULT_SESSIONS.length) >= 0.20;
      const sessionValues = DEFAULT_SESSIONS.map((sess) => {
        const st = s.records[sess.index]?.status;
        return st === "present" ? "Có mặt" : st === "late" ? "Đi muộn" : st === "absent" ? "Vắng" : st === "excused" ? "Có phép" : "-";
      });
      return [
        idx + 1,
        `"${s.studentId}"`,
        `"${s.fullName}"`,
        ...sessionValues.map((v) => `"${v}"`),
        `"${absentCount} / ${DEFAULT_SESSIONS.length}"`,
        `"${rate}"`,
        isBanned ? '"NGUY CƠ CẤM THI"' : '"ĐỦ ĐIỀU KIỆN"',
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Bao_cao_chuyen_can_${selectedSection.course_code}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveEdit = () => {
    if (!editModal) return;
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id === editModal.student.id) {
          return {
            ...s,
            records: {
              ...s.records,
              [editModal.sessionIndex]: {
                status: editModal.newStatus,
                time: editModal.note || (editModal.newStatus === "absent" ? undefined : "07:05"),
                confidence: 99.0,
              },
            },
          };
        }
        return s;
      })
    );
    setEditModal(null);
  };

  return (
    <div className="stack">
      {/* 1. Header & Actions */}
      <div className="banner-greeting">
        <div>
          <h2>Báo Cáo Chuyên Cần & Lịch Sử Điểm Danh</h2>
          <p className="sub-text">Theo dõi chi tiết ma trận điểm danh từng buổi và cảnh báo sinh viên có nguy cơ cấm thi.</p>
        </div>
        <div className="reports-header-actions">
          <button type="button" className="btn-export-excel" onClick={handleExportExcel}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>table_view</span>
            Xuất Báo Cáo Excel (.xlsx)
          </button>
          <button type="button" className="secondary btn-export-pdf" onClick={() => window.print()}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>print</span>
            In / Xuất PDF
          </button>
        </div>
      </div>

      {/* 2. 5-Point Filter Bar */}
      <div className="reports-filter-bar">
        <div className="filter-group">
          <label htmlFor="rep-section">Lớp học phần</label>
          <select
            id="rep-section"
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(Number(e.target.value))}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.course_code} – {s.title} (Phòng {s.room})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="rep-semester">Học kỳ</label>
          <select
            id="rep-semester"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          >
            <option value="HK1 (2026-2027)">Học kỳ 1 (2026-2027)</option>
            <option value="HK2 (2025-2026)">Học kỳ 2 (2025-2026)</option>
            <option value="HK_Summer_2026">Học kỳ Hè 2026</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="rep-session">Buổi học</label>
          <select
            id="rep-session"
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
          >
            <option value="all">Tất cả các buổi (Buổi 1 - Buổi 15)</option>
            {DEFAULT_SESSIONS.map((sess) => (
              <option key={sess.index} value={sess.index}>
                {sess.label} ({sess.date})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="rep-status">Lọc trạng thái / Nguy cơ</label>
          <select
            id="rep-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="banned">⚠️ Nguy cơ cấm thi (&gt;20% vắng)</option>
            <option value="late">🟡 Đi muộn nhiều (≥2 buổi)</option>
            <option value="perfect">🟢 Chuyên cần 100%</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="rep-search">Tìm kiếm sinh viên</label>
          <div className="filter-search-box">
            <span className="material-symbols-outlined search-icon">search</span>
            <input
              id="rep-search"
              type="search"
              placeholder="Nhập MSSV hoặc Họ tên..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 3. 3 KPI Summary Cards */}
      <div className="reports-kpi-grid">
        <div className="reports-kpi-card">
          <div>
            <div className="kpi-title">Tỷ lệ có mặt trung bình</div>
            <div className="kpi-value green">{avgAttendance}%</div>
            <div className="kpi-sub up">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>trending_up</span>
              ▲ +2.1% so với tuần trước
            </div>
          </div>
          <div className="kpi-icon-wrap green">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
        </div>

        <div className="reports-kpi-card">
          <div>
            <div className="kpi-title">Tiến độ giảng dạy</div>
            <div className="kpi-value">8 / 15 <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-muted)" }}>Buổi</span></div>
            <div className="kpi-sub">Đã hoàn thành 53.3% học phần</div>
          </div>
          <div className="kpi-icon-wrap blue">
            <span className="material-symbols-outlined">calendar_month</span>
          </div>
        </div>

        <div className="reports-kpi-card warning-card">
          <div>
            <div className="kpi-title">Cảnh báo nguy cơ cấm thi</div>
            <div className="kpi-value red">{bannedRiskCount} <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-muted)" }}>Sinh viên</span></div>
            <div className="kpi-sub warning-text">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
              ⚠️ Vắng &gt; 20% tổng số buổi
            </div>
          </div>
          <div className="kpi-icon-wrap red">
            <span className="material-symbols-outlined">shield</span>
          </div>
        </div>
      </div>

      {/* 4. Multi-Session Attendance Matrix Table */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>📊 Ma Trận Điểm Danh Toàn Khóa: Lớp {selectedSection.course_code} ({selectedSection.title} – {filteredStudents.length} SV)</h2>
            <p>Nhấp vào biểu tượng trạng thái hoặc nút thao tác để xem ảnh minh chứng snapshot hoặc chỉnh sửa điểm danh.</p>
          </div>
          <div className="matrix-legend">
            <span className="matrix-legend-item"><span className="status-dot" style={{ backgroundColor: "var(--status-present)" }} /> Có mặt</span>
            <span className="matrix-legend-item"><span className="status-dot" style={{ backgroundColor: "var(--status-late)" }} /> Đi muộn</span>
            <span className="matrix-legend-item"><span className="status-dot" style={{ backgroundColor: "var(--status-absent)" }} /> Vắng</span>
            <span className="matrix-legend-item"><span className="status-dot" style={{ backgroundColor: "var(--status-excused)" }} /> Nghỉ phép</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="matrix-table">
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: "center" }}>STT</th>
                <th style={{ minWidth: 200 }}>SINH VIÊN (MSSV / HỌ TÊN)</th>
                {DEFAULT_SESSIONS.map((sess) => (
                  <th key={sess.index} className="session-col">
                    {sess.label}
                    <br />
                    <small style={{ fontWeight: 400, color: "var(--text-muted)" }}>{sess.date}</small>
                  </th>
                ))}
                <th style={{ textAlign: "center", minWidth: 100 }}>SỐ BUỔI VẮNG</th>
                <th style={{ textAlign: "center", minWidth: 140 }}>TỶ LỆ CHUYÊN CẦN</th>
                <th style={{ textAlign: "center", minWidth: 90 }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length ? (
                filteredStudents.map((student, idx) => {
                  const absentCount = DEFAULT_SESSIONS.filter((sess) => student.records[sess.index]?.status === "absent").length;
                  const lateCount = DEFAULT_SESSIONS.filter((sess) => student.records[sess.index]?.status === "late").length;
                  const excusedCount = DEFAULT_SESSIONS.filter((sess) => student.records[sess.index]?.status === "excused").length;
                  const attendancePct = (((DEFAULT_SESSIONS.length - absentCount) / DEFAULT_SESSIONS.length) * 100).toFixed(1);
                  const isBanned = (absentCount / DEFAULT_SESSIONS.length) >= 0.20;

                  return (
                    <tr key={student.id}>
                      <td style={{ textAlign: "center", fontWeight: 600, color: "var(--text-muted)" }}>
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td>
                        <div className="student-info-cell">
                          <div className="student-avatar-circle">
                            {student.fullName.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <b>{student.fullName}</b>
                            <br />
                            <small>{student.studentId}</small>
                          </div>
                        </div>
                      </td>
                      {DEFAULT_SESSIONS.map((sess) => {
                        const rec = student.records[sess.index];
                        const status = rec?.status || "empty";
                        const icon = status === "present" ? "check" : status === "late" ? "schedule" : status === "absent" ? "close" : status === "excused" ? "mail" : "remove";
                        const titleText = `${sess.label} (${sess.date}): ${status === "present" ? `Có mặt lúc ${rec?.time || "07:02"}` : status === "late" ? `Đi muộn (${rec?.time || "07:12"})` : status === "absent" ? "Vắng không phép" : status === "excused" ? "Nghỉ có phép" : "Chưa diễn ra"}`;

                        return (
                          <td key={sess.index} className="session-col">
                            <button
                              type="button"
                              className={`matrix-cell-status ${status}`}
                              title={titleText}
                              onClick={() => {
                                if (status === "present" || status === "late") {
                                  setProofModal({ student, sessionIndex: sess.index });
                                } else {
                                  setEditModal({ student, sessionIndex: sess.index, newStatus: status === "empty" ? "present" : status, note: "" });
                                }
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
                            </button>
                          </td>
                        );
                      })}
                      <td style={{ textAlign: "center" }}>
                        <b style={{ color: absentCount > 0 ? "var(--status-absent)" : "inherit" }}>
                          {absentCount} / {DEFAULT_SESSIONS.length}
                        </b>
                        <br />
                        <small>buổi</small>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {isBanned ? (
                          <span className="badge-risk-danger">
                            {attendancePct}% [CẤM THI]
                          </span>
                        ) : lateCount > 0 ? (
                          <span className="badge-risk-warn">
                            {attendancePct}% ({lateCount} muộn)
                          </span>
                        ) : excusedCount > 0 ? (
                          <span className="badge-risk-good">
                            {attendancePct}% ({excusedCount} phép)
                          </span>
                        ) : (
                          <span className="badge-risk-good">
                            {attendancePct}% (Tốt)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className="reports-actions-cell" style={{ justifyContent: "center" }}>
                          <button
                            type="button"
                            className="icon-action-btn"
                            title="Xem ảnh minh chứng AI"
                            onClick={() => setProofModal({ student, sessionIndex: 1 })}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span>
                          </button>
                          <button
                            type="button"
                            className="icon-action-btn"
                            title="Chỉnh sửa điểm danh"
                            onClick={() => setEditModal({ student, sessionIndex: 8, newStatus: student.records[8]?.status === "empty" ? "present" : student.records[8]?.status || "present", note: "" })}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={13} className="empty-cell">Không tìm thấy sinh viên nào khớp với điều kiện lọc.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="reports-footer-info">
          <div>
            Hiển thị <b>{filteredStudents.length}</b> / {students.length} sinh viên lớp {selectedSection.course_code}
          </div>
          <div className="rules-tag">
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--primary)" }}>info</span>
            Học kỳ: <b>{semester}</b> · Quy chế cấm thi: <b>&gt; 20% vắng</b>
          </div>
        </div>
      </section>

      {/* Proof Photo Modal */}
      {proofModal && (
        <div className="modal-backdrop" onClick={() => setProofModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Minh chứng AI Điểm danh - Buổi {proofModal.sessionIndex} ({DEFAULT_SESSIONS[proofModal.sessionIndex - 1]?.date})</h3>
              <button type="button" className="btn-ghost" onClick={() => setProofModal(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, textAlign: "left", background: "var(--canvas)", padding: 12, borderRadius: 8 }}>
                <div className="student-avatar-circle" style={{ width: 40, height: 40, fontSize: 16 }}>
                  {proofModal.student.fullName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong style={{ fontSize: 15 }}>{proofModal.student.fullName}</strong>
                  <div className="sub-text">MSSV: {proofModal.student.studentId} · Lớp {selectedSection.course_code}</div>
                </div>
              </div>

              <div style={{ background: "#0f172a", borderRadius: 8, padding: 16, color: "#fff", marginBottom: 16 }}>
                <div style={{ width: 140, height: 140, margin: "0 auto 12px", border: "2px solid #10b981", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#1e293b" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 80, color: "#94a3b8" }}>face</span>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(16, 185, 129, 0.2)", color: "#10b981", padding: "4px 12px", borderRadius: 9999, fontWeight: 700, fontSize: 13 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>
                  Độ khớp AI: {proofModal.student.records[proofModal.sessionIndex]?.confidence || 99.1}%
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
                  Thời gian ghi nhận: {proofModal.student.records[proofModal.sessionIndex]?.time || "07:02:15"} · Camera Phòng {selectedSection.room}
                </div>
              </div>

              <button type="button" className="btn-primary" style={{ width: "100%" }} onClick={() => setProofModal(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Attendance Override Modal */}
      {editModal && (
        <div className="modal-backdrop" onClick={() => setEditModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ghi đè điểm danh thủ công - Buổi {editModal.sessionIndex} ({DEFAULT_SESSIONS[editModal.sessionIndex - 1]?.date})</h3>
              <button type="button" className="btn-ghost" onClick={() => setEditModal(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <strong>{editModal.student.fullName}</strong> ({editModal.student.studentId})
                <p className="sub-text">Học phần {selectedSection.course_code} - {selectedSection.title}</p>
              </div>

              <div className="filter-group" style={{ marginBottom: 14 }}>
                <label>Trạng thái điểm danh mới</label>
                <select
                  value={editModal.newStatus}
                  onChange={(e) => setEditModal({ ...editModal, newStatus: e.target.value as any })}
                >
                  <option value="present">🟢 Có mặt (Đúng giờ)</option>
                  <option value="late">🟡 Đi muộn</option>
                  <option value="absent">🔴 Vắng không phép</option>
                  <option value="excused">🔵 Nghỉ có phép (Đã duyệt đơn)</option>
                </select>
              </div>

              <div className="filter-group" style={{ marginBottom: 20 }}>
                <label>Lý do ghi đè (Bắt buộc cho nhật ký vết)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Sinh viên bổ sung giấy xác nhận của Khoa..."
                  value={editModal.note}
                  onChange={(e) => setEditModal({ ...editModal, note: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="secondary" onClick={() => setEditModal(null)}>
                  Hủy
                </button>
                <button type="button" className="btn-primary" onClick={handleSaveEdit}>
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// ADMIN: Quick Stats Overview ("Chỉ cần hiện vài thông số thôi")
// -----------------------------------------------------------------------------
function AdminQuickOverview({ sections }: { sections: Section[] }) {
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    Promise.all([
      api<{ users: StoredUser[] }>("/api/users"),
      api<{ courses: Course[] }>("/api/courses"),
    ])
      .then(([userData, courseData]) => {
        setUsers(userData.users);
        setCourses(courseData.courses);
      })
      .catch(() => undefined);
  }, []);

  const studentCount = users.filter((u) => u.role === "student").length;
  const enrolledCount = users.filter((u) => u.role === "student" && u.enrolledAt).length;
  const uniqueRooms = new Set(sections.map((s) => s.room)).size;

  return (
    <div className="stack">
      <div className="banner-greeting">
        <div>
          <h2>Bảng điều khiển Quản trị SPAS</h2>
          <p className="sub-text">Hệ thống nhận diện & điểm danh thụ động đang hoạt động bình thường.</p>
        </div>
        <span className="status present">
          <span className="status-dot" /> Hệ thống Online
        </span>
      </div>

      {/* 4 Quick Stat Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon primary">
            <span className="material-symbols-outlined">menu_book</span>
          </div>
          <div>
            <div className="kpi-metric">{courses.length}</div>
            <div className="kpi-label">Môn học đào tạo</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon primary">
            <span className="material-symbols-outlined">class</span>
          </div>
          <div>
            <div className="kpi-metric">{sections.length}</div>
            <div className="kpi-label">Lớp học phần</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon present">
            <span className="material-symbols-outlined">meeting_room</span>
          </div>
          <div>
            <div className="kpi-metric">{uniqueRooms || 4}</div>
            <div className="kpi-label">Phòng học có Camera AI</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon excused">
            <span className="material-symbols-outlined">fingerprint</span>
          </div>
          <div>
            <div className="kpi-metric">{enrolledCount} / {studentCount}</div>
            <div className="kpi-label">Sinh viên đã nạp eKYC</div>
          </div>
        </div>
      </div>

      {/* Quick Recent Sections Table */}
      <section className="panel">
        <div className="panel-heading">
          <h2>Danh sách lớp học phần gần nhất</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã môn</th>
                <th>Tên môn</th>
                <th>Phòng học</th>
                <th>Lịch ca</th>
              </tr>
            </thead>
            <tbody>
              {sections.slice(0, 5).map((s) => (
                <tr key={s.id}>
                  <td><b>{s.course_code}</b></td>
                  <td>{s.title}</td>
                  <td>Phòng {s.room}</td>
                  <td>{weekdays[s.weekday]} · Ca {s.period} ({s.start_time}–{s.end_time})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ADMIN: Biometric Management (Quản lý Sinh trắc học & Reset eKYC)
// -----------------------------------------------------------------------------
function AdminBiometrics() {
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [selected, setSelected] = useState<StoredUser>();
  const [previews, setPreviews] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const data = await api<{ users: StoredUser[] }>("/api/users");
    setUsers(data.users.filter((u) => u.role === "student"));
  }, []);

  useEffect(() => {
    void load().catch((cause) => setMessage(cause.message));
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    api<{ previews: string[] }>(`/api/face/enrollment/${selected.id}/previews`)
      .then((data) => setPreviews(data.previews))
      .catch((cause) => setMessage(cause.message));
  }, [selected]);

  const reset = async () => {
    if (!selected) return;
    try {
      await api(`/api/face/enrollment/${selected.id}`, { method: "DELETE" });
      setSelected({ ...selected, enrolledAt: undefined });
      setPreviews([]);
      await load();
      setMessage("Đã xóa dữ liệu vector khuôn mặt. Sinh viên có thể nạp lại eKYC.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Không thể reset khuôn mặt.");
    }
  };

  const filteredStudents = users.filter((student) =>
    matchesSearch(query, student.id, student.fullName, student.enrolledAt ? "Đã đăng ký" : "Chưa đăng ký")
  );

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Quản lý Sinh trắc học & Dữ liệu eKYC</h2>
            <p>Kiểm tra ảnh mẫu vector và reset đăng ký khuôn mặt khi sinh viên thay đổi diện mạo.</p>
          </div>
          <div className="search-input-wrap">
            <span className="material-symbols-outlined">search</span>
            <input
              type="search"
              placeholder="Tìm theo MSSV, họ tên..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>MSSV</th>
                <th>Họ và tên</th>
                <th>Trạng thái eKYC</th>
                <th>Ngày đăng ký</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((item) => (
                <tr key={item.id}>
                  <td><b>{item.id}</b></td>
                  <td>{item.fullName}</td>
                  <td>
                    <span className={`status ${item.enrolledAt ? "present" : "absent"}`}>
                      <span className="status-dot" />
                      {item.enrolledAt ? "Đã nạp khuôn mặt" : "Chưa đăng ký"}
                    </span>
                  </td>
                  <td>{item.enrolledAt ? new Date(item.enrolledAt).toLocaleString("vi-VN") : "—"}</td>
                  <td>
                    <button className="secondary small-button" onClick={() => setSelected(item)}>
                      Chi tiết ảnh mẫu
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Hồ sơ sinh trắc: {selected.fullName} ({selected.id})</h2>
              <p>{selected.enrolledAt ? `Nạp lúc: ${new Date(selected.enrolledAt).toLocaleString("vi-VN")}` : "Chưa nạp khuôn mặt"}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {selected.enrolledAt && (
                <button className="btn-danger small-button" onClick={() => void reset()}>
                  <span className="material-symbols-outlined">delete</span> Reset dữ liệu khuôn mặt
                </button>
              )}
              <button className="secondary small-button" onClick={() => setSelected(undefined)}>
                Đóng
              </button>
            </div>
          </div>

          <div className="panel-body">
            <h3>Ảnh khung hình đã trích xuất ({previews.length} frames)</h3>
            {previews.length ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12, marginTop: 12 }}>
                {previews.map((img, idx) => (
                  <img
                    key={idx}
                    src={`data:image/jpeg;base64,${img}`}
                    alt={`Frame ${idx + 1}`}
                    style={{ width: "100%", aspectRatio: 1, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }}
                  />
                ))}
              </div>
            ) : (
              <p className="sub-text" style={{ marginTop: 8 }}>Chưa có khung hình trích xuất cho sinh viên này.</p>
            )}
          </div>
        </section>
      )}

      {message && <div className="notice info">{message}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// ADMIN: Classroom & RTSP Camera Management
// -----------------------------------------------------------------------------
function AdminClassrooms() {
  const [cameras, setCameras] = useState<ClassroomCamera[]>([
    { id: "CAM-01", room: "D3-501", building: "Nhà D3", rtspUrl: "rtsp://192.168.1.101:554/live/ch0", status: "connected", fps: 30 },
    { id: "CAM-02", room: "A1-204", building: "Nhà A1", rtspUrl: "rtsp://192.168.1.102:554/live/ch0", status: "connected", fps: 30 },
    { id: "CAM-03", room: "B2-105", building: "Nhà B2", rtspUrl: "rtsp://192.168.1.103:554/live/ch0", status: "connected", fps: 25 },
    { id: "CAM-04", room: "Lab-02", building: "Nhà C1", rtspUrl: "rtsp://192.168.1.104:554/live/ch0", status: "offline", fps: 0 },
  ]);

  const [room, setRoom] = useState("");
  const [building, setBuilding] = useState("");
  const [rtspUrl, setRtspUrl] = useState("");

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const newCam: ClassroomCamera = {
      id: `CAM-0${cameras.length + 1}`,
      room,
      building,
      rtspUrl,
      status: "connected",
      fps: 30,
    };
    setCameras([...cameras, newCam]);
    setRoom("");
    setBuilding("");
    setRtspUrl("");
  };

  return (
    <div className="grid-2">
      {/* List Cameras */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Cấu hình Camera IP Phòng học ({cameras.length})</h2>
            <p>Luồng RTSP giám sát và điểm danh thụ động theo phòng.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Phòng / Tòa</th>
                <th>Luồng RTSP</th>
                <th>Trạng thái</th>
                <th>FPS</th>
              </tr>
            </thead>
            <tbody>
              {cameras.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.room}</b>
                    <br />
                    <small>{c.building}</small>
                  </td>
                  <td>
                    <code style={{ fontSize: 11, background: "var(--sidebar)", padding: "2px 4px", borderRadius: 4 }}>
                      {c.rtspUrl}
                    </code>
                  </td>
                  <td>
                    <span className={`status ${c.status === "connected" ? "present" : "absent"}`}>
                      <span className="status-dot" />
                      {c.status === "connected" ? "Đang kết nối" : "Mất tín hiệu"}
                    </span>
                  </td>
                  <td>{c.fps} fps</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Camera Form */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Thêm Camera / Phòng học mới</h2>
            <p>Khai báo luồng RTSP camera góc rộng trong lớp học.</p>
          </div>
        </div>
        <form className="panel-body login-form" onSubmit={handleAdd}>
          <div className="form-group">
            <label>Phòng học</label>
            <input required placeholder="VD: D3-502, B1-301" value={room} onChange={(e) => setRoom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Tòa nhà / Khu vực</label>
            <input required placeholder="VD: Nhà D3, Nhà A1" value={building} onChange={(e) => setBuilding(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Địa chỉ luồng RTSP</label>
            <input
              required
              placeholder="rtsp://admin:pass@192.168.1.xxx:554/stream"
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">
            <span className="material-symbols-outlined">add_circle</span> Lưu cấu hình Camera
          </button>
        </form>
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// ADMIN: Courses & Sections Management
// -----------------------------------------------------------------------------
function AdminClasses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [weekday, setWeekday] = useState(0);
  const [period, setPeriod] = useState(1);
  const [scheduleSlots, setScheduleSlots] = useState<Array<{ weekday: number; period: number }>>([]);

  const load = useCallback(async () => {
    const [courseData, userData, sectionData] = await Promise.all([
      api<{ courses: Course[] }>("/api/courses"),
      api<{ users: StoredUser[] }>("/api/users"),
      api<{ sections: Section[] }>("/api/sections"),
    ]);
    setCourses(courseData.courses);
    setUsers(userData.users);
    setSections(sectionData.sections);
  }, []);

  useEffect(() => {
    void load().catch((cause) => setMessage(cause.message));
  }, [load]);

  const submit = (path: string) => async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, string | number> = {};
    form.forEach((value, key) => {
      body[key] = String(value);
    });
    if (body.weekday) body.weekday = Number(body.weekday);
    if (body.period) body.period = Number(body.period);
    try {
      await api(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      event.currentTarget.reset();
      await load();
      setMessage("Đã lưu dữ liệu.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Không thể lưu dữ liệu.");
    }
  };

  const addScheduleSlot = () =>
    setScheduleSlots((current) =>
      current.some((slot) => slot.weekday === weekday && slot.period === period) ? current : [...current, { weekday, period }]
    );

  const createSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scheduleSlots.length) return setMessage("Thêm ít nhất một ca học.");
    const form = new FormData(event.currentTarget);
    const courseCode = String(form.get("courseCode"));
    const teacherId = String(form.get("teacherId"));
    const room = String(form.get("room"));
    try {
      await Promise.all(
        scheduleSlots.map((slot) =>
          api("/api/sections", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ courseCode, teacherId, room, ...slot }),
          })
        )
      );
      event.currentTarget.reset();
      setScheduleSlots([]);
      await load();
      setMessage(`Đã tạo ${scheduleSlots.length} ca học phần thành công.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Không thể tạo lịch học.");
    }
  };

  const teachers = users.filter((item) => item.role === "teacher");
  const students = users.filter((item) => item.role === "student");
  const filteredSections = sections.filter((section) =>
    matchesSearch(
      query,
      section.course_code,
      section.title,
      section.room,
      weekdays[section.weekday],
      `Ca ${section.period}`,
      section.start_time,
      section.end_time,
      users.find((item) => item.id === section.teacher_id)?.fullName,
      section.teacher_id
    )
  );

  return (
    <div className="stack">
      <div className="grid-3">
        {/* Form 1: Add Course */}
        <form className="panel" onSubmit={submit("/api/courses")}>
          <div className="panel-heading">
            <h3>1. Thêm môn học</h3>
          </div>
          <div className="panel-body login-form">
            <input name="code" placeholder="Mã môn (VD: IT301)" required />
            <input name="title" placeholder="Tên môn học" required />
            <button type="submit" className="btn-primary">Thêm môn</button>
          </div>
        </form>

        {/* Form 2: Create Section */}
        <form className="panel" onSubmit={createSchedule}>
          <div className="panel-heading">
            <h3>2. Tạo lớp học phần</h3>
          </div>
          <div className="panel-body login-form">
            <select name="courseCode" required defaultValue="">
              <option value="" disabled>-- Chọn môn học --</option>
              {courses.map((course) => (
                <option key={course.code} value={course.code}>
                  {course.code} · {course.title}
                </option>
              ))}
            </select>
            <select name="teacherId" required defaultValue="">
              <option value="" disabled>-- Phân công Giảng viên --</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.id} · {teacher.fullName}
                </option>
              ))}
            </select>
            <input name="room" placeholder="Phòng học (VD: D3-501)" required />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6 }}>
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {weekdays.map((day, index) => (
                  <option key={day} value={index}>{day}</option>
                ))}
              </select>
              <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
                {periods.map(([val, start, end]) => (
                  <option key={val} value={val}>Ca {val} ({start})</option>
                ))}
              </select>
              <button type="button" className="secondary small-button" onClick={addScheduleSlot}>
                + Ca
              </button>
            </div>

            {scheduleSlots.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {scheduleSlots.map((slot, idx) => (
                  <span key={idx} className="status present">
                    {weekdays[slot.weekday]} - Ca {slot.period}
                  </span>
                ))}
              </div>
            )}

            <button type="submit" disabled={!scheduleSlots.length} className="btn-primary">
              Tạo lớp học phần
            </button>
          </div>
        </form>

        {/* Form 3: Enroll Student */}
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void api(`/api/sections/${form.get("sectionId")}/enrollments`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ studentId: form.get("studentId") }),
            })
              .then(() => {
                event.currentTarget.reset();
                setMessage("Đã xếp sinh viên vào lớp học phần.");
              })
              .catch((cause) => setMessage(cause.message));
          }}
        >
          <div className="panel-heading">
            <h3>3. Xếp sinh viên vào lớp</h3>
          </div>
          <div className="panel-body login-form">
            <select name="sectionId" defaultValue="" required>
              <option value="" disabled>-- Chọn lớp học phần --</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.course_code} · Phòng {section.room}
                </option>
              ))}
            </select>
            <select name="studentId" defaultValue="" required>
              <option value="" disabled>-- Chọn sinh viên --</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.id} · {student.fullName}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary">Ghi danh vào lớp</button>
          </div>
        </form>
      </div>

      {/* Sections Table */}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Danh sách lớp học phần ({sections.length})</h2>
            <p>Lớp học, giảng viên phụ trách và phòng học tương ứng.</p>
          </div>
          <div className="search-input-wrap">
            <span className="material-symbols-outlined">search</span>
            <input
              type="search"
              placeholder="Tìm môn, giảng viên, phòng..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Môn học</th>
                <th>Giảng viên</th>
                <th>Thời gian</th>
                <th>Phòng học</th>
              </tr>
            </thead>
            <tbody>
              {filteredSections.map((section) => (
                <tr key={section.id}>
                  <td>
                    <b>{section.course_code}</b>
                    <br />
                    <small>{section.title}</small>
                  </td>
                  <td>{users.find((item) => item.id === section.teacher_id)?.fullName ?? section.teacher_id}</td>
                  <td>
                    {weekdays[section.weekday]} · Ca {section.period}
                    <br />
                    <small>{section.start_time} – {section.end_time}</small>
                  </td>
                  <td>Phòng {section.room}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {message && <div className="notice info">{message}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// ADMIN: System Audit Logs
// -----------------------------------------------------------------------------
function AdminAuditLogs() {
  const [logs] = useState<AuditRecord[]>([
    { id: "AUD-01", timestamp: "2026-08-24 07:05:12", actor: "AI Model (FaceNet-512D)", action: "RECOGNIZE_AUTO", target: "SV001 (Nguyễn Văn An)", detail: "Nhận diện đúng giờ tại Phòng D3-501 (Khớp 98.4%)" },
    { id: "AUD-02", timestamp: "2026-08-24 07:12:30", actor: "GV001 (Lê Văn C)", action: "MANUAL_OVERRIDE", target: "SV002 (Trần Thị Bích Ngọc)", detail: "Chuyển trạng thái Vắng -> Đi muộn (Lý do xe hỏng)" },
    { id: "AUD-03", timestamp: "2026-08-24 08:30:00", actor: "ADMIN001", action: "RESET_EKYC", target: "SV003 (Hoàng Minh D)", detail: "Xóa vector khuôn mặt theo yêu cầu chụp lại ảnh" },
    { id: "AUD-04", timestamp: "2026-08-24 09:15:45", actor: "AI Model (FaceNet-512D)", action: "RECOGNIZE_AUTO", target: "SV001 (Nguyễn Văn An)", detail: "Nhận diện đúng giờ tại Phòng A1-204 (Khớp 96.8%)" },
  ]);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Nhật ký vết Hệ thống & Giám sát An ninh</h2>
          <p>Lịch sử ghi nhận nhận diện AI tự động và thao tác can thiệp thủ công (Bất biến).</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Tác nhân</th>
              <th>Hành động</th>
              <th>Đối tượng</th>
              <th>Chi tiết nhật ký</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td><small>{log.timestamp}</small></td>
                <td><b>{log.actor}</b></td>
                <td>
                  <span className="status present">{log.action}</span>
                </td>
                <td>{log.target}</td>
                <td><small>{log.detail}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Shared: Profile & Password Change
// -----------------------------------------------------------------------------
function Profile({ user }: { user: User }) {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/profile/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
        }),
      });
      event.currentTarget.reset();
      setIsError(false);
      setMessage("Đã cập nhật mật khẩu mới thành công.");
    } catch (cause) {
      setIsError(true);
      setMessage(cause instanceof Error ? cause.message : "Không đổi được mật khẩu.");
    }
  };

  return (
    <section className="panel" style={{ maxWidth: 540 }}>
      <div className="panel-heading">
        <div>
          <h2>Tài khoản & Bảo mật</h2>
          <p>{user.fullName} ({user.id}) · {roleLabels[user.role]}</p>
        </div>
      </div>
      <form className="panel-body login-form" onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="current-password">Mật khẩu hiện tại</label>
          <input id="current-password" name="currentPassword" type="password" required />
        </div>
        <div className="form-group">
          <label htmlFor="new-password">Mật khẩu mới</label>
          <input id="new-password" name="newPassword" type="password" minLength={6} required />
        </div>
        <button type="submit" className="btn-primary">
          <span className="material-symbols-outlined">lock_reset</span> Cập nhật mật khẩu
        </button>

        {message && (
          <div className={`notice ${isError ? "error" : "success"}`} style={{ marginTop: 12 }}>
            <span className="material-symbols-outlined">{isError ? "error" : "check_circle"}</span>
            {message}
          </div>
        )}
      </form>
    </section>
  );
}

// -----------------------------------------------------------------------------
// App Shell
// -----------------------------------------------------------------------------
function App() {
  const [user, setUser] = useState<User>();
  const [sections, setSections] = useState<Section[]>([]);
  const [page, setPage] = useState<AnyPage>("dashboard");
  const [selectedTeacherSection, setSelectedTeacherSection] = useState<Section>();
  const [loading, setLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);

  const load = async (current: User) => {
    const data = await api<{ sections: Section[] }>("/api/sections").catch(() => ({ sections: [] }));
    setUser(current);
    setSections(data.sections);
    setPage(current.role === "teacher" ? "schedule" : "dashboard");
  };

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    api<{ id: string; userCode?: string; fullName: string; role: string }>("/api/auth/me")
      .then((data) => load(portalUser(data)))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="login-page"><p className="sub-text">Đang tải cổng học vụ SPAS...</p></main>;
  if (!user) return <Login onLogin={load} />;

  const logout = async () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    setUser(undefined);
    setSections([]);
    setAccountOpen(false);
  };

  // Nav mapping according to role (Excluding 'Tổng quan toàn trường' and 'Quản lý người dùng' for Admin)
  const navItems: Array<{ id: AnyPage; label: string; icon: string }> =
    user.role === "student"
      ? [
          { id: "dashboard", label: "Tổng quan", icon: "dashboard" },
          { id: "attendance", label: "Lịch sử điểm danh", icon: "fact_check" },
          { id: "leave", label: "Đơn xin nghỉ & muộn", icon: "event_busy" },
          { id: "enrollment", label: "Đăng ký khuôn mặt", icon: "add_a_photo" },
          { id: "biometric", label: "Hồ sơ sinh trắc", icon: "fingerprint" },
          { id: "profile", label: "Tài khoản cá nhân", icon: "person" },
        ]
      : user.role === "teacher"
      ? [
          { id: "schedule", label: "Lịch giảng dạy", icon: "calendar_month" },
          { id: "scan", label: "Quét Camera điểm danh", icon: "videocam" },
          { id: "leave_requests", label: "Duyệt đơn xin nghỉ", icon: "approval" },
          { id: "reports", label: "Báo cáo chuyên cần", icon: "bar_chart" },
          { id: "profile", label: "Tài khoản cá nhân", icon: "person" },
        ]
      : [
          { id: "dashboard", label: "Thông số hệ thống", icon: "query_stats" },
          { id: "biometrics", label: "Quản lý Sinh trắc học", icon: "fingerprint" },
          { id: "classrooms", label: "Phòng học & Camera IP", icon: "videocam" },
          { id: "classes", label: "Môn & Lớp học phần", icon: "class" },
          { id: "audit", label: "Nhật ký vết hệ thống", icon: "history" },
          { id: "profile", label: "Tài khoản cá nhân", icon: "person" },
        ];

  let content: ReactNode = null;
  if (user.role === "student") {
    if (page === "dashboard") content = <StudentDashboard user={user} sections={sections} />;
    else if (page === "attendance") content = <AttendanceHistory />;
    else if (page === "leave") content = <StudentLeaveRequests sections={sections} />;
    else if (page === "enrollment") content = <Enrollment />;
    else if (page === "biometric") content = <StudentBiometricProfile user={user} />;
    else if (page === "profile") content = <Profile user={user} />;
  } else if (user.role === "teacher") {
    if (page === "schedule" || page === "dashboard") {
      content = (
        <TeacherSchedule
          sections={sections}
          onStartScan={(sec) => {
            setSelectedTeacherSection(sec);
            setPage("scan");
          }}
        />
      );
    } else if (page === "scan") {
      content = <TeacherScan sections={sections} initialSection={selectedTeacherSection} />;
    } else if (page === "leave_requests") {
      content = <TeacherLeaveRequests />;
    } else if (page === "reports") {
      content = <TeacherReports sections={sections} />;
    } else if (page === "profile") {
      content = <Profile user={user} />;
    }
  } else {
    if (page === "dashboard") content = <AdminQuickOverview sections={sections} />;
    else if (page === "biometrics") content = <AdminBiometrics />;
    else if (page === "classrooms") content = <AdminClassrooms />;
    else if (page === "classes") content = <AdminClasses />;
    else if (page === "audit") content = <AdminAuditLogs />;
    else if (page === "profile") content = <Profile user={user} />;
  }

  return (
    <div className="app-shell">
      <aside>
        <div className="brand-header">
          <div className="brand-logo">
            <span className="material-symbols-outlined fill">school</span>
          </div>
          <div className="brand-info">
            <strong>SPAS Portal</strong>
            <small>Academic v5.1</small>
          </div>
        </div>

        <div className="user-card-sidebar">
          <div className="avatar">{user.fullName.slice(0, 1).toUpperCase()}</div>
          <div style={{ overflow: "hidden" }}>
            <strong>{user.fullName}</strong>
            <small>{roleLabels[user.role]}</small>
          </div>
        </div>

        <nav aria-label="Điều hướng chính">
          <span className="nav-title">Chức năng</span>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header>
          <div className="header-left">
            <span className="header-title-badge">
              <span className="material-symbols-outlined">domain</span>
              Cổng thông tin Đào tạo
            </span>
          </div>

          <div className="header-right">
            <div className="header-account">
              <button
                className="header-avatar"
                type="button"
                aria-label="Menu tài khoản"
                onClick={() => setAccountOpen((v) => !v)}
              >
                {user.fullName.slice(0, 1).toUpperCase()}
              </button>

              {accountOpen && (
                <div className="account-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      setPage("profile");
                      setAccountOpen(false);
                    }}
                  >
                    <span className="material-symbols-outlined">person</span> Hồ sơ cá nhân
                  </button>
                  <button type="button" className="logout-btn" onClick={() => void logout()}>
                    <span className="material-symbols-outlined">logout</span> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page-content">{content}</div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
