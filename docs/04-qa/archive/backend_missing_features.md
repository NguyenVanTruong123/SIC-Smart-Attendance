# 📋 TỔNG HỢP CŨ CÁC CHỨC NĂNG BACKEND & AI SERVICE CÒN THIẾU

> Tài liệu lưu trữ để tham khảo lịch sử. Không dùng làm trạng thái triển khai hiện tại.
### Dự án: Smart Passive Attendance System (SPAS v6.0 Final)
*Tài liệu lịch sử đối soát giữa Frontend (`/frontend`), Backend (`/backend`), AI Service (`/ai-service`) và API (`/docs/02-api/api_documentation.md`). Không dùng file này thay cho trạng thái code hiện tại nếu có khác biệt.*

---

## 📌 TỔNG QUAN HIỆN TRẠNG HỆ THỐNG

| Thành phần | Công nghệ | Hiện trạng triển khai |
|---|---|---|
| **Frontend** | React 19 + TypeScript + Ant Design v5 + TailwindCSS + Zustand + TanStack Query + Socket.io | **100% hoàn thiện** (Auth, eKYC Onboarding, Admin Dashboard, Teacher Scan/Live/Reports, Student Portal). Đã sẵn sàng kết nối API & WebSocket. |
| **Backend API Gateway** | Node.js (Express + TypeScript + Prisma ORM + PostgreSQL/Supabase) | **~30% hoàn thiện** (Đã có Auth Login/Me, Admin Biometrics Overview, Import Excel 3-in-1, Classrooms CRUD + Ping Camera). Chưa có các routes Teacher, Student, eKYC, Audit Logs, Socket.io Server. |
| **AI Core Service** | Python 3.10+ (FastAPI + InsightFace / ArcFace + FAISS + ByteTrack + OpenCV) | Nội dung lịch sử; đối chiếu hiện tại xem `docs/01-product/BA_FINAL_VS_CURRENT_IMPLEMENTATION_QA_REPORT.md`. |

---

## 🔄 HANDOFF FRONTEND / GATEWAY HIỆN TẠI

Frontend TypeScript đã được refactor về giao diện portal đơn giản của bản Python và **không gọi trực tiếp Python AI từ trình duyệt**. Luồng bắt buộc là `Web → Node.js Gateway → Python AI → Database/Storage`.

| Chức năng UI đã sẵn sàng | Gateway cần cung cấp | Trạng thái hiện tại |
|---|---|---|
| Đăng ký khuôn mặt sinh viên (video 3 giây, hướng dẫn thẳng/trái/phải) | `POST /api/v1/ekyc/enroll-initial` | **Chưa có route** |
| Đồng bộ ảnh enrollment của sinh viên sau khi đăng ký | `GET /api/v1/auth/me` trả `avatarUrl` mới | Có route; cần Gateway cập nhật ảnh sau eKYC |
| Danh sách sinh trắc học admin | `GET /api/v1/admin/biometrics` | Đã có route |
| Xem ảnh/hồ sơ sinh trắc chi tiết admin | `GET /api/v1/admin/biometrics/:userId` | **Chưa có route** |
| Điểm danh AI, evidence crop, unknown faces, sửa tay | Các route `/api/v1/teacher/sessions/*` và Socket.IO | **Chưa có route / Socket.IO** |

**Lệch tài liệu cần chốt:** tài liệu API mô tả lịch dạy dùng `week`/`year`, nhưng backend hiện triển khai `startDate`/`endDate`. Frontend đang dùng `startDate`/`endDate` để chuyển tuần hoạt động đúng với backend; chỉ cần đồng bộ tài liệu hoặc thêm hỗ trợ `week`/`year`, không đổi cả hai tùy ý.

---

## 🚨 1. DANH SÁCH CHỨC NĂNG BACKEND CÒN THIẾU (THEO TỪNG MODULE)

### 🔐 1.1. Module Xác thực (Authentication)
* **`POST /api/v1/auth/refresh`**:
  - *Mô tả:* Làm mới Access Token khi hết hạn (15 phút) bằng Refresh Token (7 ngày). Frontend `utils/api.ts` đã cài đặt interceptor tự động gọi endpoint này khi nhận lỗi `401 Unauthorized`.
  - *Request Body:* `{ "refreshToken": "..." }`
  - *Response kỳ vọng:* `{ "success": true, "data": { "accessToken": "...", "refreshToken": "..." } }`

---

### 📷 1.2. Module eKYC & Sinh trắc học (eKYC Onboarding)
* **`POST /api/v1/ekyc/enroll-initial`** (Auth: `STUDENT`):
  - *Mô tả:* Nhận file video 3s quay từ webcam (`multipart/form-data: video_file`), chuyển tiếp sang Python AI Service để kiểm tra Liveness, trích xuất vector ArcFace 512D, lưu vector vào FAISS và cập nhật `is_face_enrolled = true` vào bảng `users`.
  - *Frontend component:* `components/student/Enrollment.tsx`.

---

### 🏛️ 1.3. Module Quản trị viên (Admin Workspace)
* **`GET /api/v1/admin/overview`**:
  - *Mô tả:* Lấy các chỉ số thống kê KPI toàn trường: tổng sinh viên, tổng giảng viên, tổng phòng học, camera online/offline, tỉ lệ eKYC, ca học hoạt động hôm nay, tỉ lệ chuyên cần trung bình.
  - *Frontend component:* `components/admin/AdminQuickOverview.tsx`.

* **`GET /api/v1/admin/biometrics/:user_id`**:
  - *Mô tả:* Lấy chi tiết hồ sơ sinh trắc của 1 sinh viên (Vector ID, AI model, Match score) kèm danh sách 3 ảnh chụp CCTV gần nhất từ bảng `SessionProofSnapshot`.
  - *Frontend component:* `components/admin/AdminBiometrics.tsx` (Modal chi tiết).

* **`GET /api/v1/admin/biometrics/re-ekyc-requests/:id/comparison`**:
  - *Mô tả:* Lấy dữ liệu lưới đối soát 3 ảnh cho đơn xin cấp lại khuôn mặt: Ảnh gốc eKYC + Ảnh thẻ SV/CCCD + Ảnh cắt từ video mới.
  - *Frontend component:* `components/admin/AdminBiometrics.tsx` (Modal Re-eKYC).

* **`POST /api/v1/admin/biometrics/re-ekyc-requests/:id/review`**:
  - *Mô tả:* Admin duyệt (`APPROVE`) hoặc từ chối (`REJECT`) yêu cầu thay đổi diện mạo. Nếu duyệt thì cập nhật vector mới vào FAISS.
  - *Request Body:* `{ "action": "APPROVE" | "REJECT", "reviewNote": "..." }`

* **`GET /api/v1/admin/classes`**:
  - *Mô tả:* Danh sách các môn & lớp học phần (`CourseClass`), kèm tiến độ số buổi hoàn thành (`completedSessions / totalSessions`), sĩ số, tên giảng viên phụ trách.
  - *Frontend component:* `components/admin/AdminClasses.tsx`.

* **`GET /api/v1/admin/audit-logs`**:
  - *Mô tả:* Danh sách vết can thiệp thủ công từ bảng `SystemAuditLog` (Actor, Sinh viên, Trạng thái cũ/mới, Lý do) kèm 3 thẻ KPI.
  - *Frontend component:* `components/admin/AdminAuditLogs.tsx`.

* **`GET /api/v1/admin/audit-logs/:id`**:
  - *Mô tả:* Xem chi tiết bản ghi audit log kèm đường dẫn ảnh bằng chứng CCTV lớp học tại thời điểm sửa điểm danh.

---

### 👨‍🏫 1.4. Module Giảng viên (Teacher Workspace)
* **`GET /api/v1/teacher/schedule?week=X&year=Y`**:
  - *Mô tả:* Lấy lịch giảng dạy tuần dạng Grid của giảng viên hiện tại, thống kê sĩ số realtime và trạng thái ca học (`LIVE_NOW`, `UPCOMING`, `COMPLETED`).
  - *Frontend component:* `components/teacher/TeacherSchedule.tsx`.

* **`GET /api/v1/teacher/sessions/:id`**:
  - *Mô tả:* Lấy thông tin chi tiết ca học đang Live: luồng RTSP camera phòng học, FPS, sĩ số 4 màu (có mặt, muộn, vắng, bỏ học) và danh sách chi tiết sinh viên trong lớp kèm match %.
  - *Frontend component:* `components/teacher/TeacherScan.tsx`.

* **`POST /api/v1/teacher/sessions/:id/trigger-snapshot`**:
  - *Mô tả:* Cưỡng chế chụp ảnh đối soát toàn lớp ngay lập tức qua camera RTSP phòng học.
  - *Frontend component:* `components/teacher/TeacherScan.tsx` (Nút "Chụp đối soát ngay").

* **`GET /api/v1/teacher/sessions/:id/snapshots`**:
  - *Mô tả:* Lấy 4 bức ảnh snapshot đối soát định kỳ 15p, 30p, 45p, 60p từ bảng `SessionProofSnapshot`.

* **`PUT /api/v1/teacher/sessions/:id/attendance/:student_id/override`**:
  - *Mô tả:* Giảng viên can thiệp sửa điểm danh thủ công, bắt buộc ghi rõ `newStatus` và `reason`. Tự động ghi log vào bảng `SystemAuditLog`.
  - *Frontend component:* `components/teacher/TeacherScan.tsx` (Modal sửa điểm danh).

* **`GET /api/v1/teacher/leave-requests`**:
  - *Mô tả:* Danh sách các đơn xin nghỉ / xin vào muộn của sinh viên thuộc các lớp mà giảng viên phụ trách.
  - *Frontend component:* `components/teacher/TeacherLeaveRequests.tsx`.

* **`POST /api/v1/teacher/sessions/:id/quick-approve-leave`**:
  - *Mô tả:* Giảng viên duyệt nhanh hoặc từ chối đơn xin nghỉ (`APPROVED` / `REJECTED`).
  - *Frontend component:* `components/teacher/TeacherLeaveRequests.tsx`.

* **`GET /api/v1/teacher/reports/matrix?course_class_id=X&semester=Y`**:
  - *Mô tả:* Ma trận điểm danh 15 buổi học của toàn bộ sinh viên trong lớp học phần, tính toán tỉ lệ vắng, tỉ lệ chuyên cần % và cờ cảnh báo cấm thi `isBannedFromExam` (vắng > 20%).
  - *Frontend component:* `components/teacher/TeacherReports.tsx`.

---

### 🎓 1.5. Module Sinh viên (Student Portal)
* **`GET /api/v1/student/dashboard`**:
  - *Mô tả:* Dashboard cá nhân sinh viên: tỉ lệ chuyên cần tổng thể, xếp loại, thống kê 4 loại (đúng giờ, muộn, vắng không phép, vắng có phép), cảnh báo nguy cơ cấm thi (`urgentAlert`), và danh sách các môn học phần đang theo học.
  - *Frontend component:* `components/student/StudentDashboard.tsx`.

* **`GET /api/v1/student/attendance-history`**:
  - *Mô tả:* Lịch sử điểm danh chi tiết từng buổi học của sinh viên, thời gian nhận diện AI và ảnh thumbnail minh chứng.
  - *Frontend component:* `components/student/AttendanceHistory.tsx`.

* **`GET /api/v1/student/leave-requests`**:
  - *Mô tả:* Danh sách các đơn xin nghỉ / muộn mà sinh viên đã gửi kèm trạng thái xử lý (`PENDING`, `APPROVED`, `REJECTED`).
  - *Frontend component:* `components/student/StudentLeaveRequests.tsx`.

* **`POST /api/v1/student/leave-requests`**:
  - *Mô tả:* Nộp đơn xin nghỉ (`FULL_SESSION`) hoặc xin vào muộn (`LATE_ENTRY`), hỗ trợ upload file minh chứng giấy khám bệnh / đơn phép (`multipart/form-data: attachment_file`).
  - *Frontend component:* `components/student/StudentLeaveRequests.tsx`.

* **`POST /api/v1/student/re-ekyc/submit`**:
  - *Mô tả:* Nộp đơn xin cấp lại khuôn mặt Re-eKYC (upload ảnh thẻ SV/CCCD + video 3s diện mạo mới + lý do thay đổi).
  - *Frontend component:* `components/student/StudentBiometricProfile.tsx`.

---

## 🧠 2. DANH SÁCH THÀNH PHẦN AI SERVICE CẦN XÂY DỰNG (`/ai-service`)

Theo kiến trúc hệ thống, Backend Node.js đóng vai trò API Gateway & Business Logic, còn các tác vụ Computer Vision nặng sẽ được ủy quyền sang **Python AI Microservice** (`http://localhost:8000/api/v1/ai`):

### 2.1. eKYC Liveness & ArcFace Feature Extractor
* **Endpoint:** `POST /api/v1/ai/ekyc/liveness-and-vector`
* **Nhiệm vụ:**
  1. Nhận file video 3s (`.mp4` / `.webm`).
  2. Dùng mô hình **Silent-Face-Anti-Spoofing** kiểm tra người thật (Anti-Spoofing: phát hiện giả mạo qua màn hình điện thoại, in ảnh giấy).
  3. Chọn frame có chất lượng nét nhất và góc nhìn thẳng (`pitch`, `yaw`, `roll` $\le 15^\circ$).
  4. Trích xuất vector đặc trưng 512 chiều bằng **InsightFace / ArcFace ResNet-50**.
  5. Thêm vector vào chỉ mục **FAISS Index** (`vectors.index`).
  6. Trả về `matchScore`, `vectorId`, và ảnh crop khuôn mặt chân dung.

### 2.2. Background Worker: RTSP Classroom Camera Ingestion & Tracking
* **Nhiệm vụ:**
  1. Kết nối luồng RTSP camera phòng học (`rtspUrl`) với tần số 30 FPS bằng OpenCV / GStreamer / FFmpeg.
  2. Phát hiện khuôn mặt trong khung hình (Face Detection via RetinaFace / SCRFD).
  3. Theo dõi liên tục từng đối tượng trong lớp bằng thuật toán tracking **ByteTrack / BoT-SORT** để tránh nhận diện trùng lặp.
  4. So khớp vector với cơ sở dữ liệu FAISS để xác định MSSV (`studentCode`).
  5. Phát hiện người lạ không có trong danh sách lớp hoặc chưa nạp eKYC -> Sinh sự kiện `INTRUDER_ALERT`.
  6. Tự động lưu 4 khung hình snapshot toàn cảnh lớp học tại các mốc: 15 phút, 30 phút, 45 phút, 60 phút.

### 2.3. Dịch vụ chụp ảnh đối soát tức thì (Instant Snapshot Trigger)
* **Endpoint:** `POST /api/v1/ai/sessions/{sessionId}/instant-snapshot`
* **Nhiệm vụ:** Lấy tức thì 1 frame độ phân giải cao từ luồng RTSP của ca học, đánh dấu bounding boxes các khuôn mặt đã phát hiện và lưu URL ảnh đối soát.

---

## ⚡ 3. WEBSOCKET REALTIME GATEWAY CẦN TRIỂN KHAI TRÊN BACKEND

Backend cần tích hợp **Socket.io Server** lắng nghe tại đường dẫn `/ws` với Namespace `/attendance`:

```typescript
// Các sự kiện cần xử lý:
1. io.of('/attendance').on('connection', (socket) => { ... })
2. socket.on('attendance:join_session', ({ sessionId }) => { socket.join(sessionId); })
3. socket.on('attendance:leave_session', ({ sessionId }) => { socket.leave(sessionId); })

// Các sự kiện Backend & AI phát về cho Frontend:
- 'attendance:face_detected'     -> Gửi khi AI nhận diện thành công sinh viên
- 'attendance:stat_update'       -> Cập nhật thanh sĩ số 4 màu realtime
- 'attendance:snapshot_captured' -> Gửi khi AI hoàn thành snapshot mốc 15p
- 'security:intruder_alert'      -> Cảnh báo người lạ chớp đỏ viền
- 'attendance:leave_approved'    -> Cập nhật tức thì badge sinh viên sang EXCUSED
```

---

## 🚀 4. LỘ TRÌNH TRIỂN KHAI ĐỀ XUẤT (BACKEND & AI)

1. **Giai đoạn 1 (Backend Core Extensions):**
   - Bổ sung route `POST /api/v1/auth/refresh` và controller `auth.controller.ts`.
   - Bổ sung module `admin.routes.ts` (overview, classes, audit-logs, re-ekyc review).
2. **Giai đoạn 2 (Teacher & Student API Modules):**
   - Viết `teacher.routes.ts`, `teacher.controller.ts`, `teacher.service.ts`.
   - Viết `student.routes.ts`, `student.controller.ts`, `student.service.ts`.
3. **Giai đoạn 3 (Socket.io Realtime Gateway):**
   - Cài đặt `socket.io` vào `backend`, gắn vào HTTP Server trong `server.ts`.
   - Xây dựng middleware xác thực JWT cho WebSocket connection.
4. **Giai đoạn 4 (AI Core Service FastAPI):**
   - Viết FastAPI server (`main.py`) trong thư mục `ai-service/`.
   - Tích hợp InsightFace, FAISS vector storage, và luồng đọc camera RTSP.
