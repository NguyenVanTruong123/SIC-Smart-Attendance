// =============================================================================
// SPAS v6.0 — Type Definitions aligned with API Documentation
// =============================================================================

// --- Enums (UPPERCASE as per API docs) ---
export type Role = "ADMIN" | "TEACHER" | "STUDENT";
export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "TRUANT" | "EXCUSED";
export type CameraStatus = "ONLINE" | "OFFLINE" | "MAINTENANCE";
export type SessionStatus = "LIVE_NOW" | "UPCOMING" | "COMPLETED";
export type LeaveRequestType = "FULL_SESSION" | "LATE_ENTRY";
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type EkycStatus = "ENROLLED" | "NOT_ENROLLED" | "PENDING_RESET";

// --- API Response Envelope (§1.3 docs) ---
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp?: string;
}

export interface ApiError {
  success: false;
  statusCode: number;
  error: {
    code: string;
    message: string;
  };
  timestamp: string;
  path: string;
}

export interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

// --- User (§2.1, §2.3 docs) ---
export interface User {
  id: string;
  userCode: string;
  fullName: string;
  email: string;
  role: Role;
  department?: string;
  className?: string;
  avatarUrl?: string;
  isFaceEnrolled: boolean;
  status?: string;
  createdAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  redirectUrl: string;
}

// --- eKYC (§2.2 docs) ---
export interface EkycEnrollResponse {
  vectorId: number;
  matchScore: number;
  isFaceEnrolled: boolean;
  redirectUrl: string;
}

// --- Admin: Classrooms (§3.1 docs) ---
export interface ClassroomKpis {
  totalClassrooms: number;
  onlineCameras: number;
  offlineCameras: number;
  cameraCoverageRate: string;
}

export interface Classroom {
  id: string;
  roomCode: string;
  building: string;
  floor: number;
  capacity: number;
  roomType?: string;
  deviceType?: string;
  cameraIp: string;
  rtspUrl: string;
  cameraStatus: CameraStatus;
  latencyMs: number | null;
  fps: number;
  createdAt: string;
}

export interface ClassroomDetail {
  classroom: Classroom & {
    codec?: string;
    bitrate?: string;
  };
  todaySchedule: Array<{
    sessionId: string;
    courseCode: string;
    courseName: string;
    teacherName: string;
    startTime: string;
    endTime: string;
    status: SessionStatus | "LIVE";
    attendedCount: number;
    totalStudents: number;
  }>;
}

export interface PingCameraResponse {
  status: CameraStatus;
  latencyMs: number;
  fps: number;
  packetLossPercent: number;
  resolution: string;
  bitrateKbps: number;
  codec: string;
}

// --- Admin: Biometrics (§3.2 docs) ---
export interface BiometricKpis {
  totalStudents: number;
  enrolledCount: number;
  enrolledRate: string;
  notEnrolledCount: number;
  pendingResetRequests: number;
}

export interface BiometricItem {
  id: string;
  userCode: string;
  fullName: string;
  role: Role;
  className: string;
  department: string;
  email: string;
  phone: string;
  avatarUrl: string;
  isFaceEnrolled: boolean;
  vectorId: string;
  enrolledDate: string;
  hasPendingResetRequest: boolean;
  pendingRequestId: string | null;
}

export interface BiometricDetail {
  user: {
    userCode: string;
    fullName: string;
    role: Role;
    department: string;
    vectorId: number;
    masterImageUrl: string;
    aiModel: string;
    matchScore: number;
  };
  recentCctvSnapshots: Array<{
    snapshotUrl: string;
    roomCode: string;
    capturedAt: string;
    matchPercentage: number;
  }>;
}

export interface ReEkycComparison {
  requestCode: string;
  studentCode: string;
  fullName: string;
  reason: string;
  submittedAt: string;
  images: {
    originalEnrollmentImage: string;
    studentCardImage: string;
    newFaceCropFromVideo: string;
  };
}

// --- Admin: Audit Logs (§3.3 docs) ---
export interface AuditKpis {
  totalOverrides: number;
  overridesToPresent: number;
  overridesToExcused: number;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  actorName: string;
  studentCode: string;
  studentName: string;
  courseClassName: string;
  oldStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
}

export interface AuditDetail extends AuditRecord {
  actor: { id: string; name: string; role: Role };
  student: { code: string; name: string; class: string };
  session: { id: string; room: string; time: string };
  change: { from: AttendanceStatus; to: AttendanceStatus };
  cctvClassroomSnapshotUrl: string;
}

// --- Teacher: Schedule (§4.1.1 docs) ---
export interface TeacherSession {
  sessionId: string;
  courseName: string;
  courseCode: string;
  classCode: string;
  roomCode: string;
  dayOfWeek: number;
  date: string;
  startTime: string;
  endTime: string;
  status: SessionStatus;
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    truant: number;
  };
}

// --- Teacher: Session Detail (§4.1.2 docs) ---
export interface SessionDetail {
  session: {
    id: string;
    courseName: string;
    className: string;
    roomCode: string;
    rtspStreamUrl: string;
    fps: number;
    status: SessionStatus;
  };
  counts: {
    total: number;
    present: number;
    late: number;
    absent: number;
    truant: number;
  };
  students: Array<{
    studentId: string;
    studentCode: string;
    fullName: string;
    status: AttendanceStatus;
    firstDetectedAt: string;
    matchPercentage: number;
    avatarUrl: string;
  }>;
}

export interface SnapshotMilestone {
  milestone: string;
  time: string;
  snapshotUrl: string;
  matchScore: number;
  status: AttendanceStatus;
}

// --- Teacher: Reports Matrix (§4.2.1 docs) ---
export interface ReportKpis {
  averageAttendanceRate: number;
  growthRate: number;
  completedSessions: string;
  examBanCount: number;
}

export interface MatrixStudent {
  studentId: string;
  studentCode: string;
  fullName: string;
  sessions: AttendanceStatus[];
  totalAbsences: number;
  attendanceRate: number;
  isBannedFromExam: boolean;
}

// --- Student: Dashboard (§5.1 docs) ---
export interface StudentDashboardData {
  student: { code: string; name: string; class: string };
  semester: string;
  overallRate: number;
  ranking: string;
  stats: {
    onTimeCount: number;
    lateCount: number;
    unexcusedAbsentCount: number;
    excusedAbsentCount: number;
  };
  urgentAlert: {
    hasRisk: boolean;
    courseName: string;
    absentCount: number;
    totalSessions: number;
    absentPercentage: number;
    message: string;
  };
  enrolledCourses: Array<{
    courseCode: string;
    courseName: string;
    room: string;
    progress: string;
    attendanceRate: number;
    status: "SAFE" | "WARNING" | "DANGER";
  }>;
}

// --- Student: Leave Request (§5.2.1 docs) ---
export interface LeaveRequestData {
  requestId: string;
  status: LeaveRequestStatus;
}

// --- WebSocket Events (§6 docs) ---
export interface WsFaceDetected {
  studentCode: string;
  fullName: string;
  matchPercentage: number;
  boundingBox: { x: number; y: number; w: number; h: number };
}

export interface WsStatUpdate {
  total: number;
  present: number;
  late: number;
  absent: number;
  truant: number;
}

export interface WsSnapshotCaptured {
  milestone: string;
  capturedAt: string;
  snapshotUrl: string;
}

export interface WsIntruderAlert {
  alert: "INTRUDER_DETECTED";
  cropUrl: string;
}

// --- Page types for navigation ---
export type StudentPage = "dashboard" | "enrollment" | "attendance" | "leave" | "biometric" | "profile";
export type TeacherPage = "schedule" | "scan" | "leave_requests" | "reports" | "profile";
export type AdminPage = "dashboard" | "biometrics" | "classrooms" | "classes" | "audit" | "profile";
export type AnyPage = StudentPage | TeacherPage | AdminPage;

// --- Labels ---
export const roleLabels: Record<Role, string> = {
  ADMIN: "Quản trị viên SPAS",
  TEACHER: "Giảng viên",
  STUDENT: "Sinh viên",
};

export const statusLabels: Record<AttendanceStatus, string> = {
  PRESENT: "Đúng giờ",
  LATE: "Đi muộn",
  ABSENT: "Vắng mặt",
  TRUANT: "Bỏ học",
  EXCUSED: "Nghỉ có phép",
};

export const statusColors: Record<AttendanceStatus, string> = {
  PRESENT: "#10b981",
  LATE: "#d97706",
  ABSENT: "#dc2626",
  TRUANT: "#ea580c",
  EXCUSED: "#0284c7",
};
