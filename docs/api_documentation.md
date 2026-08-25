# 📡 TÀI LIỆU ĐẶC TẢ RESTFUL API & WEBSOCKET CHI TIẾT (API SPECIFICATION)
## DỰ ÁN: SMART PASSIVE ATTENDANCE SYSTEM (SPAS) - PHIÊN BẢN v6.0 FINAL
### NỀN TẢNG CÔNG NGHỆ BACKEND: NODE.JS (NESTJS / EXPRESS + TYPESCRIPT) & PYTHON AI MICROSERVICE (FASTAPI)

---

## 📌 1. TỔNG QUAN KIẾN TRÚC & QUY ƯỚC CHUNG

### 1.1. Base URL & Môi trường:
* **Development API (Node.js Gateway):** `http://localhost:5000/api/v1`
* **Python AI Microservice (Internal):** `http://localhost:8000/api/v1/ai`
* **WebSocket Gateway:** `ws://localhost:5000/ws` (Socket.io Namespace: `/attendance`)
* **Production API:** `https://api.spas.edu.vn/api/v1`

---

### 1.2. Chuẩn Xác Thực (Authentication & Authorization):
Hệ thống sử dụng **JWT (JSON Web Token)** với cơ chế **Role-Based Access Control (RBAC)**:
* **Header bắt buộc cho mọi Request cần xác thực:**
  ```http
  Authorization: Bearer <access_token>
  Content-Type: application/json
  ```
* **4 Vai trò Phân quyền (User Roles):**
  * `ADMIN`: Quản trị viên hệ thống & Ban Đào Tạo.
  * `TEACHER`: Giảng viên giảng dạy và duyệt phép.
  * `STUDENT`: Sinh viên tham gia lớp học và theo dõi chuyên cần.
  * `SYSTEM_AI`: Service Key nội bộ giữa Node.js và Python AI Server.

---

### 1.3. Chuẩn Đóng Gói Phản Hồi JSON (Standard Response Envelope):

#### ✅ Phản Hồi Thành Công (HTTP 200 OK / 201 Created):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Xử lý yêu cầu thành công",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 40,
    "totalPages": 4
  }
}
```

#### ❌ Phản Hồi Khi Gặp Lỗi (HTTP 4xx / 5xx):
```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "INVALID_EKYC_VIDEO",
    "message": "Video xác thực không phát hiện được khuôn mặt người thật (Liveness check failed)"
  },
  "timestamp": "2026-10-18T08:30:15.120Z",
  "path": "/api/v1/ekyc/enroll-initial"
}
```

---

### 1.4. Bảng Mã Lỗi Hệ Thống Chuẩn (Error Codes Reference):

| Mã Lỗi (Code) | HTTP Status | Ý Nghĩa / Ngữ Cảnh Xảy Ra |
| :--- | :---: | :--- |
| `UNAUTHORIZED` | 401 | Token JWT hết hạn, sai chữ ký hoặc không gửi kèm Token |
| `FORBIDDEN` | 403 | Không đủ quyền hạn truy cập tài nguyên |
| `USER_NOT_FOUND` | 404 | Không tìm thấy tài khoản người dùng theo ID/MSSV |
| `FACE_NOT_ENROLLED` | 403 | Sinh viên chưa hoàn tất eKYC lần đầu (`is_face_enrolled = false`), bị khóa màn hình |
| `SESSION_NOT_LIVE` | 400 | Ca học chưa tới giờ hoặc đã kết thúc, không thể kích hoạt luồng live điểm danh |
| `CAMERA_OFFLINE` | 502 | Camera IP phòng học mất kết nối mạng hoặc sai đường dẫn RTSP |
| `OVERRIDE_REASON_REQUIRED` | 422 | Giảng viên sửa điểm danh thủ công nhưng không nhập lý do giải trình |
| `DUPLICATE_IMPORT_RECORD` | 409 | Dữ liệu import Excel bị trùng MSSV hoặc mã giảng viên |

---

## 🔐 2. MODULE 1: AUTHENTICATION & eKYC ONBOARDING (`/api/v1/auth`, `/api/v1/ekyc`)

### 2.1. Đăng Nhập Hệ Thống (Login with RBAC)
* **Endpoint:** `POST /api/v1/auth/login` | **Auth:** Public
* **Request Body:**
```json
{
  "username": "2102001@vnu.edu.vn",
  "password": "Password@123"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "userCode": "2102001",
      "fullName": "Nguyễn Văn An",
      "email": "2102001@vnu.edu.vn",
      "role": "STUDENT",
      "isFaceEnrolled": false
    },
    "redirectUrl": "/student/onboarding-ekyc"
  }
}
```

---

### 2.2. Quay Video 3s Xác Thực eKYC Lần Đầu (Onboarding Lock Wizard - `/student/onboarding-ekyc`)
* **Endpoint:** `POST /api/v1/ekyc/enroll-initial` | **Auth:** `STUDENT`
* **Content-Type:** `multipart/form-data`
* **Form Data:** `video_file`: File Video `.mp4` / `.webm` (Quay 3 giây, $\ge 720p$).
* **Xử lý Backend:**
  1. Gửi video sang Python AI Microservice kiểm tra Silent-Face-Anti-Spoofing.
  2. Trích xuất khung hình chân dung nét nhất và sinh 512D ArcFace Vector.
  3. Lưu Vector vào FAISS Vector Database (`vectors.index`) và lưu ảnh vào Cloudinary/S3.
  4. Cập nhật `users.is_face_enrolled = true`.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Xác thực khuôn mặt lần đầu thành công",
  "data": {
    "vectorId": 512,
    "matchScore": 98.5,
    "isFaceEnrolled": true,
    "redirectUrl": "/student/dashboard"
  }
}
```

---

### 2.3. Lấy Thông Tin Tài Khoản Hiện Tại (Get Current Profile / Me)
* **Endpoint:** `GET /api/v1/auth/me` | **Auth:** `ADMIN`, `TEACHER`, `STUDENT` (Bắt buộc gửi kèm `Authorization: Bearer <access_token>`)
* **Header:**
  ```http
  Authorization: Bearer <access_token>
  ```
* **Mô tả:** Được gọi khi tải lại trang (F5) để phục hồi phiên đăng nhập và lấy thông tin cá nhân mới nhất từ CSDL.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy thông tin tài khoản thành công.",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "userCode": "2102001",
    "fullName": "Nguyễn Văn An",
    "email": "2102001@vnu.edu.vn",
    "role": "STUDENT",
    "department": "Khoa Công Nghệ Thông Tin",
    "className": "21CNTT1",
    "avatarUrl": "https://cdn.spas.edu.vn/faces/master/2102001.jpg",
    "isFaceEnrolled": true,
    "status": "ACTIVE",
    "createdAt": "2026-08-24T11:17:21.618Z"
  },
  "timestamp": "2026-08-25T16:00:47.807Z"
}
```

---

## 🏛️ 3. MODULE 2: QUẢN TRỊ VIÊN (ADMIN WORKSPACE - `/api/v1/admin`)

### 3.1. Quản lý Phòng học & Camera IP RTSP (`/admin/classrooms`)

#### 📍 3.1.1. Lấy danh sách phòng học
* **Endpoint:** `GET /api/v1/admin/classrooms` | **Auth:** `ADMIN`
* **Query Params:** `building` (A2, B1), `status` (`ONLINE`, `OFFLINE`, `MAINTENANCE`), `search`.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "id": "c1a2b3c4-0001-0000-0000-000000000001",
      "roomCode": "A2-301",
      "building": "Tòa A2",
      "floor": 3,
      "capacity": 60,
      "cameraIp": "192.168.1.101",
      "rtspUrl": "rtsp://admin:pass@192.168.1.101:554/live/ch0",
      "cameraStatus": "ONLINE",
      "latencyMs": 42,
      "fps": 30
    }
  ]
}
```

#### 📍 3.1.2. Thêm mới / Cập nhật cấu hình Phòng học & Camera
* **Endpoint:** `POST /api/v1/admin/classrooms` & `PUT /api/v1/admin/classrooms/{id}` | **Auth:** `ADMIN`
* **Request Body:**
```json
{
  "roomCode": "B1-102",
  "building": "Tòa B1",
  "floor": 1,
  "capacity": 50,
  "cameraIp": "192.168.1.102",
  "rtspUrl": "rtsp://admin:Pass123@192.168.1.102:554/h264Preview_01_main"
}
```

#### 📍 3.1.3. Kiểm tra kết nối Camera IP (Ping Test - Modal 1.1.1)
* **Endpoint:** `POST /api/v1/admin/classrooms/{id}/ping-camera` | **Auth:** `ADMIN`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "status": "ONLINE",
    "latencyMs": 45,
    "fps": 30,
    "packetLossPercent": 0.0,
    "resolution": "1920x1080",
    "bitrateKbps": 4096
  }
}
```

---

### 3.2. Trung tâm Sinh trắc học & Kho Vector (`/admin/biometrics`)

#### 📍 3.2.1. Lấy danh sách hồ sơ sinh trắc học & 3 Thẻ KPI
* **Endpoint:** `GET /api/v1/admin/biometrics` | **Auth:** `ADMIN`
* **Query Params:** `role` (`STUDENT`, `TEACHER`), `status` (`ENROLLED`, `PENDING`, `NOT_ENROLLED`), `page`, `limit`, `search`.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "kpis": {
      "totalVectors": 1250,
      "pendingRequests": 5,
      "notEnrolledCount": 42
    },
    "items": [
      {
        "id": "usr_stu_2102001",
        "userCode": "2102001",
        "fullName": "Nguyễn Văn An",
        "role": "STUDENT",
        "className": "21CNTT1",
        "isFaceEnrolled": true,
        "vectorId": 512,
        "masterImageUrl": "https://cdn.spas.edu.vn/faces/master/2102001.jpg",
        "matchScore": 96.4,
        "updatedAt": "2026-09-10T14:35:10Z"
      }
    ]
  }
}
```

#### 📍 3.2.2. Import Dữ Liệu 3-trong-1 từ File Excel (Modal 1.2.1)
* **Endpoint:** `POST /api/v1/admin/import/excel-bundle` | **Auth:** `ADMIN`
* **Content-Type:** `multipart/form-data`
* **Files:**
  * `student_file`: File `.xlsx` danh sách sinh viên nhập học.
  * `teacher_file`: File `.xlsx` danh sách giảng viên.
  * `schedule_file`: File `.xlsx` thời khóa biểu toàn trường 15 tuần.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Nạp dữ liệu 3-trong-1 thành công",
  "data": {
    "studentsCreated": 498,
    "teachersCreated": 45,
    "classesCreated": 120,
    "sessionsCreated": 1800,
    "errors": [
      { "row": 15, "file": "student_file", "reason": "Trùng MSSV 2102015" }
    ]
  }
}
```

#### 📍 3.2.3. Xem chi tiết hồ sơ & 3 Ảnh CCTV lớp học gần nhất (Modal 1.2.2)
* **Endpoint:** `GET /api/v1/admin/biometrics/{user_id}` | **Auth:** `ADMIN`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "user": {
      "userCode": "2102001",
      "fullName": "Nguyễn Văn An",
      "role": "STUDENT",
      "department": "Khoa Công nghệ Thông tin",
      "vectorId": 512,
      "masterImageUrl": "https://cdn.spas.edu.vn/faces/master/2102001.jpg",
      "aiModel": "ArcFace-ResNet50 (512D)",
      "matchScore": 96.4
    },
    "recentCctvSnapshots": [
      {
        "snapshotUrl": "https://cdn.spas.edu.vn/cctv/snaps/b1_0715.jpg",
        "roomCode": "B1-102",
        "capturedAt": "2026-10-15T07:15:00Z",
        "matchPercentage": 98.2
      },
      {
        "snapshotUrl": "https://cdn.spas.edu.vn/cctv/snaps/b1_0730.jpg",
        "roomCode": "B1-102",
        "capturedAt": "2026-10-15T07:30:00Z",
        "matchPercentage": 97.5
      },
      {
        "snapshotUrl": "https://cdn.spas.edu.vn/cctv/snaps/b1_0745.jpg",
        "roomCode": "B1-102",
        "capturedAt": "2026-10-15T07:45:00Z",
        "matchPercentage": 96.8
      }
    ]
  }
}
```

#### 📍 3.2.4. Lấy dữ liệu lưới đối soát 3 ảnh phê duyệt cấp lại khuôn mặt (Modal 1.2.3)
* **Endpoint:** `GET /api/v1/admin/biometrics/re-ekyc-requests/{id}/comparison` | **Auth:** `ADMIN`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "requestCode": "#ĐKY-STH-2026-0045",
    "studentCode": "2102001",
    "fullName": "Nguyễn Văn An",
    "reason": "Phẫu thuật thẩm mỹ mí mắt và nâng mũi tháng trước",
    "submittedAt": "2026-10-18T09:15:00Z",
    "images": {
      "originalEnrollmentImage": "https://cdn.spas.edu.vn/faces/original/2102001.jpg",
      "studentCardImage": "https://cdn.spas.edu.vn/proofs/student_cards/2102001_card.jpg",
      "newFaceCropFromVideo": "https://cdn.spas.edu.vn/faces/new_crops/2102001_crop.jpg"
    }
  }
}
```

#### 📍 3.2.5. Phê duyệt hoặc Từ chối cấp lại khuôn mặt
* **Endpoint:** `POST /api/v1/admin/biometrics/re-ekyc-requests/{id}/review` | **Auth:** `ADMIN`
* **Request Body:**
```json
{
  "action": "APPROVE",
  "reviewNote": "Đã đối soát thẻ sinh viên và khuôn mặt mới khớp thông tin"
}
```

---

### 3.3. Nhật ký Vết Hệ thống & Audit Trail (`/admin/audit-logs`)

#### 📍 3.3.1. Lấy danh sách vết can thiệp thủ công
* **Endpoint:** `GET /api/v1/admin/audit-logs` | **Auth:** `ADMIN`
* **Query Params:** `actor_id`, `student_code`, `start_date`, `end_date`, `page`, `limit`.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "kpis": {
      "totalOverrides": 142,
      "overridesToPresent": 98,
      "overridesToExcused": 44
    },
    "items": [
      {
        "id": "aud_001",
        "timestamp": "2026-10-14T08:35:10Z",
        "actorName": "TS. Nguyễn Văn A",
        "studentCode": "2102001",
        "studentName": "Nguyễn Văn An",
        "courseClassName": "Kiến trúc PM (21KTP1)",
        "oldStatus": "ABSENT",
        "newStatus": "PRESENT",
        "reason": "Sinh viên gặp sự cố mạng điểm danh muộn và có mặt tại lớp"
      }
    ]
  }
}
```

#### 📍 3.3.2. Lấy chi tiết bản ghi vết & Ảnh chụp CCTV bằng chứng (Modal 1.3.1)
* **Endpoint:** `GET /api/v1/admin/audit-logs/{id}` | **Auth:** `ADMIN`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "aud_001",
    "timestamp": "2026-10-14T08:35:10Z",
    "actor": { "id": "usr_gv_01", "name": "TS. Nguyễn Văn A", "role": "TEACHER" },
    "student": { "code": "2102001", "name": "Nguyễn Văn An", "class": "21CNTT1" },
    "session": { "id": "ses_08", "room": "A2-301", "time": "07:00 - 11:30" },
    "change": { "from": "ABSENT", "to": "PRESENT" },
    "reason": "Sinh viên có mặt thực tế tại hàng ghế số 2",
    "cctvClassroomSnapshotUrl": "https://cdn.spas.edu.vn/audit_cctv/20261014_083510_A2301.jpg"
  }
}
```

---

## 👨‍🏫 4. MODULE 3: GIẢNG VIÊN (TEACHER WORKSPACE - `/api/v1/teacher`)

### 4.1. Lịch Dạy Tuần & Ca Học Live RTSP 30 FPS

#### 📍 4.1.1. Lấy lịch dạy tuần dạng Grid
* **Endpoint:** `GET /api/v1/teacher/schedule` | **Auth:** `TEACHER`
* **Query Params:** `week` (42), `year` (2026).
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "sessionId": "ses_int3401_02",
      "courseName": "Hệ thống AI",
      "courseCode": "INT3401",
      "classCode": "INT3401_02",
      "roomCode": "B1-102",
      "dayOfWeek": 3,
      "date": "2026-10-15",
      "startTime": "07:00",
      "endTime": "11:30",
      "status": "LIVE_NOW",
      "summary": { "total": 40, "present": 32, "late": 4, "absent": 3, "truant": 1 }
    }
  ]
}
```

#### 📍 4.1.2. Lấy thông tin chi tiết ca học Live & Sĩ số Realtime
* **Endpoint:** `GET /api/v1/teacher/sessions/{id}` | **Auth:** `TEACHER`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "session": {
      "id": "ses_int3401_02",
      "courseName": "Hệ thống AI (INT3401)",
      "className": "Lớp INT3401_02",
      "roomCode": "B1-102",
      "rtspStreamUrl": "rtsp://admin:Pass123@192.168.1.102:554/live/ch0",
      "fps": 30,
      "status": "LIVE_NOW"
    },
    "counts": {
      "total": 40,
      "present": 32,
      "late": 4,
      "absent": 3,
      "truant": 1
    },
    "students": [
      {
        "studentId": "usr_stu_2102001",
        "studentCode": "2102001",
        "fullName": "Nguyễn Văn An",
        "status": "TRUANT",
        "firstDetectedAt": "2026-10-15T07:02:15Z",
        "matchPercentage": 96.0,
        "avatarUrl": "https://cdn.spas.edu.vn/faces/master/2102001.jpg"
      }
    ]
  }
}
```

#### 📍 4.1.3. Cưỡng chế chụp đối soát ngay (Trigger Instant Snapshot)
* **Endpoint:** `POST /api/v1/teacher/sessions/{id}/trigger-snapshot` | **Auth:** `TEACHER`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Đã chụp ảnh đối soát toàn lớp thành công",
  "data": {
    "snapshotUrl": "https://cdn.spas.edu.vn/snapshots/manual_snap_072510.jpg",
    "capturedAt": "2026-10-15T07:25:10Z",
    "detectedFacesCount": 36
  }
}
```

#### 📍 4.1.4. Lấy 4 bức ảnh Snapshot đối soát chu kỳ 15 phút (Modal 2.2.3)
* **Endpoint:** `GET /api/v1/teacher/sessions/{id}/snapshots` | **Auth:** `TEACHER`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "sessionId": "ses_int3401_02",
    "milestones": [
      {
        "milestone": "15p",
        "time": "07:15",
        "snapshotUrl": "https://cdn.spas.edu.vn/snaps/15m.jpg",
        "matchScore": 98.5,
        "status": "PRESENT"
      },
      {
        "milestone": "30p",
        "time": "07:30",
        "snapshotUrl": "https://cdn.spas.edu.vn/snaps/30m.jpg",
        "matchScore": 97.1,
        "status": "PRESENT"
      },
      {
        "milestone": "45p",
        "time": "07:45",
        "snapshotUrl": "https://cdn.spas.edu.vn/snaps/45m.jpg",
        "matchScore": 96.8,
        "status": "PRESENT"
      },
      {
        "milestone": "60p",
        "time": "08:00",
        "snapshotUrl": "https://cdn.spas.edu.vn/snaps/60m.jpg",
        "matchScore": 97.4,
        "status": "PRESENT"
      }
    ]
  }
}
```

#### 📍 4.1.5. Sửa điểm danh thủ công (Manual Override - Drawer 2.2.1)
* **Endpoint:** `PUT /api/v1/teacher/sessions/{id}/attendance/{student_id}/override` | **Auth:** `TEACHER`
* **Request Body:**
```json
{
  "newStatus": "PRESENT",
  "reason": "Sinh viên có mặt thực tế, bị lỗi camera góc khuất"
}
```

#### 📍 4.1.6. Duyệt nhanh đơn xin nghỉ trong ca học (Drawer 2.2.2)
* **Endpoint:** `POST /api/v1/teacher/sessions/{id}/quick-approve-leave` | **Auth:** `TEACHER`
* **Request Body:**
```json
{
  "leaveRequestId": "req_leave_089",
  "decision": "APPROVED"
}
```

---

### 4.2. Báo Cáo Chuyên Cần Ma Trận 15 Buổi & Cấm Thi (`/teacher/reports`)

#### 📍 4.2.1. Lấy Ma trận Điểm danh 15 buổi học & Cảnh báo Cấm thi
* **Endpoint:** `GET /api/v1/teacher/reports/matrix` | **Auth:** `TEACHER`
* **Query Params:** `course_class_id`, `semester`.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "kpis": {
      "averageAttendanceRate": 94.2,
      "growthRate": 2.1,
      "completedSessions": "8/15",
      "examBanCount": 3
    },
    "matrix": [
      {
        "studentId": "usr_stu_01",
        "studentCode": "2102001",
        "fullName": "Nguyễn Văn An",
        "sessions": ["PRESENT", "PRESENT", "ABSENT", "LATE", "ABSENT", "PRESENT", "TRUANT", "ABSENT"],
        "totalAbsences": 3,
        "attendanceRate": 62.5,
        "isBannedFromExam": true
      }
    ]
  }
}
```

---

## 🎓 5. MODULE 4: SINH VIÊN (STUDENT PORTAL - `/api/v1/student`)

### 5.1. Dashboard Chuyên Cần Cá Nhân (`/student/dashboard`)
* **Endpoint:** `GET /api/v1/student/dashboard` | **Auth:** `STUDENT`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "student": { "code": "2102001", "name": "Nguyễn Văn An", "class": "21CNTT1" },
    "semester": "Học kỳ 1 (2026-2027)",
    "overallRate": 92.8,
    "ranking": "Khá Tốt",
    "stats": {
      "onTimeCount": 24,
      "lateCount": 2,
      "unexcusedAbsentCount": 1,
      "excusedAbsentCount": 1
    },
    "urgentAlert": {
      "hasRisk": true,
      "courseName": "Nhập môn Trí tuệ Nhân tạo",
      "absentCount": 2,
      "totalSessions": 15,
      "absentPercentage": 13.3,
      "message": "Bạn đã vắng 2/15 buổi (13.3%). Nếu vắng quá 3 buổi (>20%) bạn sẽ bị CẤM THI!"
    },
    "enrolledCourses": [
      {
        "courseCode": "SE202",
        "courseName": "Nhập môn Kỹ thuật Phần mềm",
        "room": "D3-501",
        "progress": "8/15 buổi",
        "attendanceRate": 100.0,
        "status": "SAFE"
      }
    ]
  }
}
```

---

### 5.2. Nộp Đơn Xin Nghỉ & Quy Trình 3 Bước Re-eKYC

#### 📍 5.2.1. Nộp đơn xin nghỉ học / Đi muộn (`/student/leave-requests`)
* **Endpoint:** `POST /api/v1/student/leave-requests` | **Auth:** `STUDENT`
* **Content-Type:** `multipart/form-data`
* **Form Data:**
  * `session_id`: ID ca học xin nghỉ.
  * `request_type`: `FULL_SESSION` (Nghỉ cả buổi) hoặc `LATE_ENTRY` (Vào muộn tối đa 15p).
  * `reason`: "Em bị sốt cao 39 độ cần truyền dịch tại Bệnh viện Bạch Mai."
  * `attachment_file`: File PDF / Ảnh `.jpg` giấy khám bệnh.
* **Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Nộp đơn xin nghỉ thành công",
  "data": {
    "requestId": "req_leave_089",
    "status": "PENDING"
  }
}
```

#### 📍 5.2.2. Nộp đơn xin cấp lại khuôn mặt 3 Bước (Modal 3.5 - Re-eKYC)
* **Endpoint:** `POST /api/v1/student/re-ekyc/submit` | **Auth:** `STUDENT`
* **Content-Type:** `multipart/form-data`
* **Form Data:**
  * `student_card_image`: File ảnh chụp thẻ SV/CCCD thật.
  * `reason`: "Phẫu thuật nâng mũi và cắt mí tháng trước."
  * `new_video_file`: File video 3s diện mạo mới.
* **Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Đã gửi yêu cầu cập nhật diện mạo mới thành công",
  "data": {
    "requestCode": "#ĐKY-STH-2026-0045",
    "submittedAt": "2026-10-18T09:15:00Z",
    "status": "PENDING_ADMIN_APPROVAL"
  }
}
```

---

## ⚡ 6. WEBSOCKET REAL-TIME GATEWAY (Socket.io Namespace: `/attendance`)

### 6.1. Luồng Sự Kiện (Real-time Events Flow):

| Tên Event | Sender | Receiver | Payload / Mô tả |
| :--- | :---: | :---: | :--- |
| `attendance:join_session` | Client (GV/SV) | Server | `{ "sessionId": "ses_int3401_02" }` |
| `attendance:face_detected` | Python AI | Client (GV) | Tọa độ Bounding Box mặt, MSSV, Họ tên, Tỷ lệ match % |
| `attendance:stat_update` | Python AI | Client (GV) | Cập nhật thanh OSD Sĩ số 4 màu: `{ "total": 40, "present": 32, "late": 4, "absent": 3, "truant": 1 }` |
| `attendance:snapshot_captured` | Python AI | Client | `{ "milestone": "15m", "capturedAt": "07:15:00", "snapshotUrl": "..." }` |
| `security:intruder_alert` | Python AI | Client (GV) | Cảnh báo người lạ chớp đỏ viền: `{ "alert": "INTRUDER_DETECTED", "cropUrl": "..." }` |
| `attendance:leave_approved` | Server | Client | Cập nhật tức thì badge sinh viên sang `EXCUSED` khi GV duyệt đơn |

---
*Tài liệu Đặc tả API v6.0 Final hoàn chỉnh 100%, chuẩn RESTful & WebSocket.*
