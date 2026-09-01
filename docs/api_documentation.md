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

### 1.5. Đối chiếu API doc với implementation hiện tại (2026-08-30)

> Phần này được thêm để tránh nhầm giữa đặc tả BA/API v6.0 và contract đang chạy trong working tree. Khi hai phần khác nhau, Backend và Frontend cần ưu tiên bảng này trong MVP; các endpoint được đánh dấu **chưa triển khai** không được gọi từ UI.

| Khu vực | API doc/BA ban đầu | Implementation hiện tại | Lý do và hướng xử lý |
| :--- | :--- | :--- | :--- |
| Base URL | Ghi đầy đủ `http://localhost:5000/api/v1` | Backend mount toàn bộ module dưới `/api/v1`; Frontend Axios dùng `baseURL: /api/v1` | FE gọi relative path để chạy được qua Vite/Nginx/Cloudflare mà không hard-code host hoặc port. |
| Response | Ví dụ luôn có `success`, `statusCode`, `message`, `data`, `meta` | Các controller tối thiểu luôn có `success` và `data`; một số endpoint có thêm `statusCode`, `message`, `timestamp`; Axios tự unwrap `data` | Không đổi nghiệp vụ; khi hoàn thiện production cần thống nhất envelope đầy đủ hoặc cập nhật type theo endpoint thực tế. |
| Student dashboard | `GET /api/v1/student/dashboard` không mô tả tham số tuần | Có thêm `weekStart=YYYY-MM-DD`, trả `weeklySchedule` kèm `periodStart`, `periodEnd`, `periodLabel` | Calendar mới cần tải đúng tuần và dựng hàng theo ca học; không cần đổi database/API route. |
| Teacher schedule | Doc minh họa query `week`, `year` | Controller hiện hỗ trợ `startDate`, `endDate`; `week`, `year` mới chỉ được đọc nhưng chưa dùng để tính khoảng ngày | Cần dùng `startDate/endDate` ở FE hiện tại; nếu muốn giữ contract BA thì BE phải bổ sung mapping `week/year` ở task sau. |
| Teacher snapshots | Doc có `GET /api/v1/teacher/sessions/{id}/snapshots` | Chưa có route GET riêng; hiện có `POST /sessions/{id}/trigger-snapshot`, session detail và evidence | Không để FE gọi endpoint ảo; thêm route snapshots khi cần xem lịch sử milestone đầy đủ. |
| eKYC enrollment | Doc cũ mô tả `video_file` 3 giây | `POST /api/v1/ekyc/enroll-initial` nhận `frames[]` (3–12 ảnh), lưu toàn bộ frame gốc; `POST /api/v1/ekyc/pose` kiểm tra từng frame | Flow thực tế của FE là tracking 3 pose rồi chụp 8 ảnh; frames phù hợp hơn video đơn vì cần lưu evidence và retry từng pose. |
| AI public endpoints | Doc có `/api/check-enrollment`, `/api/enroll`, `/api/recognize` | Không mount các route AI này ở Gateway; BE gọi AI nội bộ qua `AI_SERVICE_URL` và `x-ai-service-key` tại `/internal/v1/*` | Giữ credential/RTSP/AI service ở server, không đưa lên browser. FE chỉ gọi Gateway. |
| AI enrollment | Doc trả `vectorId`, `matchScore`, `redirectUrl` | AI client trả `acceptedFrames`, `embeddingDimension`, `preview`; BE trả `isFaceEnrolled`, `acceptedFrames`, `savedOriginalFrames` | Không trả embedding thô cho client; metadata vector được lưu và quản lý phía server. |
| Re-eKYC | Doc có submit/review comparison | Chưa có route tương ứng trong `backend/src/routes/student.routes.ts` và `admin.routes.ts` | Đây là phạm vi sau MVP; UI không được coi là đã hoạt động chỉ vì type/Mock đã tồn tại. |

#### Quy ước tích hợp hiện tại

- Frontend chỉ gọi các route Gateway qua `frontend/src/utils/api.ts`; không gọi thẳng Python AI service.
- Gateway chịu trách nhiệm JWT/RBAC, kiểm tra sinh viên thuộc lớp, quy tắc điểm danh, lưu evidence và audit; AI chỉ trả detection/identity/score/pose/evidence.
- `POST /api/v1/teacher/sessions/{id}/trigger-snapshot` là API điều khiển nghiệp vụ; việc gọi AI nội bộ và ghi nhận kết quả do Backend thực hiện.
- Port `5000`, `8000`, `5173` chỉ là mặc định local; không được đưa port cố định vào payload hoặc lưu trong frontend production.

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

### 2.2. Enrollment nhiều frame theo pose (Onboarding Lock Wizard - `/student/enrollment`)
* **Endpoint:** `POST /api/v1/ekyc/enroll-initial` | **Auth:** `STUDENT`
* **Content-Type:** `multipart/form-data`
* **Form Data:** `frames`: nhiều file ảnh JPEG/PNG, tối thiểu 3 và tối đa 12; bản Frontend hiện tại gửi 8 frame theo các pose `front`, `left`, `right`.
* **Xử lý Backend:**
  1. Gửi frames sang AI service nội bộ để trích xuất embedding và kiểm tra frame hợp lệ.
  2. Lưu vector/metadata ở AI service và lưu toàn bộ bytes ảnh gốc ở Backend storage.
  3. Cập nhật `users.is_face_enrolled = true` và tạo các bản ghi `user_enrollment_images`.
  4. Từ chối lần đăng ký tiếp theo nếu chưa có quyền reset của Admin.
* **Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "isFaceEnrolled": true,
    "acceptedFrames": 8,
    "savedOriginalFrames": 8
  }
}
```

`POST /api/v1/ekyc/pose` nhận một field `frame` và trả `pose`, `confidence`, `faceCount`, `bbox`; Frontend dùng endpoint này để chỉ chụp khi người dùng đang ở đúng hướng.

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

#### 📍 3.1.1. Lấy danh sách phòng học & 3 Thẻ KPI (Màn hình 1.1)
* **Endpoint:** `GET /api/v1/admin/classrooms` | **Auth:** `ADMIN` (Gửi kèm `Authorization: Bearer <token>`)
* **Query Params:**
  * `search`: Tìm kiếm theo Tên phòng, Tòa nhà, hoặc Địa chỉ IP/RTSP.
  * `building`: Lọc theo Tòa nhà (`ALL`, `Tòa A`, `Tòa B`...).
  * `status`: Lọc theo Trạng thái Camera (`ALL`, `ONLINE` - Hoạt động, `OFFLINE` - Mất tín hiệu, `MAINTENANCE` - Bảo trì).
  * `page`: Trang hiện tại (Mặc định: 1).
  * `limit`: Số bản ghi trên 1 trang (Mặc định: 10).
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy danh sách phòng học và KPI thành công.",
  "data": {
    "kpis": {
      "totalClassrooms": 50,
      "onlineCameras": 48,
      "offlineCameras": 2,
      "cameraCoverageRate": "100%"
    },
    "buildings": ["Tòa A", "Tòa B", "Tòa C"],
    "items": [
      {
        "id": "c1a2b3c4-0001-0000-0000-000000000001",
        "roomCode": "A2-301",
        "building": "Tòa A",
        "floor": 3,
        "capacity": 45,
        "roomType": "Phòng Lý thuyết",
        "deviceType": "iVCam (Mobile Bridge)",
        "cameraIp": "192.168.1.100",
        "rtspUrl": "rtsp://192.168.1.100:554/live/ch0",
        "cameraStatus": "ONLINE",
        "latencyMs": 118,
        "fps": 30,
        "createdAt": "2026-08-26T08:00:00.000Z"
      },
      {
        "id": "c1a2b3c4-0002-0000-0000-000000000002",
        "roomCode": "B1-102",
        "building": "Tòa B",
        "floor": 1,
        "capacity": 120,
        "roomType": "Hội trường",
        "deviceType": "Dahua Smart Cam",
        "cameraIp": "192.168.1.105",
        "rtspUrl": "rtsp://192.168.1.105:554/live/ch0",
        "cameraStatus": "OFFLINE",
        "latencyMs": null,
        "fps": 0,
        "createdAt": "2026-08-26T08:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 50,
      "totalPages": 5
    }
  },
  "timestamp": "2026-08-26T09:41:03.856Z"
}
```

#### 📍 3.1.2. Thêm mới Phòng học & Cấu hình Camera IP (Modal 1.1.2)
* **Endpoint:** `POST /api/v1/admin/classrooms` | **Auth:** `ADMIN`
* **Request Body:**
```json
{
  "roomCode": "A2-502",
  "building": "Tòa A",
  "floor": 5,
  "capacity": 45,
  "deviceType": "iVCam (Mobile Bridge)",
  "rtspUrl": "rtsp://192.168.1.15:554/live",
  "cameraIp": "192.168.1.15"
}
```
* **Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Thêm mới và kích hoạt phòng học thành công.",
  "data": {
    "id": "c1a2b3c4-0003-0000-0000-000000000003",
    "roomCode": "A2-502",
    "building": "Tòa A",
    "floor": 5,
    "capacity": 45,
    "cameraIp": "192.168.1.15",
    "rtspUrl": "rtsp://192.168.1.15:554/live",
    "cameraStatus": "ONLINE",
    "createdAt": "2026-08-26T10:00:00.000Z"
  }
}
```

#### 📍 3.1.3. Cập nhật Cấu hình Phòng học & Gắn Camera IP
* **Endpoint:** `PUT /api/v1/admin/classrooms/{id}` | **Auth:** `ADMIN`
* **Request Body:**
```json
{
  "roomCode": "A2-301",
  "building": "Tòa A",
  "floor": 3,
  "capacity": 45,
  "deviceType": "iVCam (Mobile Bridge)",
  "rtspUrl": "rtsp://192.168.1.15:4747/live",
  "cameraIp": "192.168.1.15"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Cập nhật cấu hình phòng học thành công.",
  "data": {
    "id": "c1a2b3c4-0001-0000-0000-000000000001",
    "roomCode": "A2-301",
    "building": "Tòa A",
    "floor": 3,
    "capacity": 45,
    "cameraIp": "192.168.1.15",
    "rtspUrl": "rtsp://192.168.1.15:4747/live",
    "cameraStatus": "ONLINE"
  }
}
```

#### 📍 3.1.4. Xóa Phòng học
* **Endpoint:** `DELETE /api/v1/admin/classrooms/{id}` | **Auth:** `ADMIN`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Xóa phòng học thành công."
}
```

#### 📍 3.1.5. Kiểm tra kết nối Camera IP / iVCam (Ping Test - Modal 1.1.2 & 1.1.1)
* **Endpoint:** `POST /api/v1/admin/classrooms/ping-camera` (Kiểm tra URL trực tiếp khi nhập form) hoặc `POST /api/v1/admin/classrooms/{id}/ping-camera` (Kiểm tra phòng đã có)
* **Request Body (Khi kiểm tra URL trực tiếp):**
```json
{
  "rtspUrl": "rtsp://192.168.1.15:554/live"
}
```
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Kết nối Camera RTSP thành công!",
  "data": {
    "status": "ONLINE",
    "latencyMs": 118,
    "fps": 30,
    "packetLossPercent": 0.0,
    "resolution": "1920x1080",
    "bitrateKbps": 4096,
    "codec": "H.264"
  }
}
```

#### 📍 3.1.6. Xem chi tiết Phòng học & Lịch trình ca học hôm nay (Modal 1.1.1)
* **Endpoint:** `GET /api/v1/admin/classrooms/{id}` | **Auth:** `ADMIN`
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "classroom": {
      "id": "c1a2b3c4-0001-0000-0000-000000000001",
      "roomCode": "A2-301",
      "building": "Tòa A",
      "floor": 3,
      "capacity": 45,
      "cameraIp": "192.168.1.100",
      "rtspUrl": "rtsp://192.168.1.100:554/live/ch0",
      "cameraStatus": "ONLINE",
      "latencyMs": 118,
      "fps": 30,
      "codec": "H.264",
      "bitrate": "4.2 Mbps"
    },
    "todaySchedule": [
      {
        "sessionId": "ses_001",
        "courseCode": "CS101",
        "courseName": "Nhập môn AI",
        "teacherName": "TS. Nguyễn Văn A",
        "startTime": "07:00",
        "endTime": "09:30",
        "status": "LIVE",
        "attendedCount": 44,
        "totalStudents": 45
      },
      {
        "sessionId": "ses_002",
        "courseCode": "SE202",
        "courseName": "Lập trình Web",
        "teacherName": "ThS. Trần Thị B",
        "startTime": "13:00",
        "endTime": "15:30",
        "status": "UPCOMING",
        "attendedCount": 0,
        "totalStudents": 45
      }
    ]
  }
}
```

---

### 3.2. Trung tâm Sinh trắc học & Kho Vector (`/admin/biometrics`)

#### 📍 3.2.1. Lấy danh sách hồ sơ sinh trắc học & 4 Thẻ KPI (Màn hình 1.2)
* **Endpoint:** `GET /api/v1/admin/biometrics` | **Auth:** `ADMIN` (Gửi kèm `Authorization: Bearer <token>`)
* **Query Params:**
  * `role`: Lọc theo Tab đối tượng (`STUDENT` - mặc định, `TEACHER`, `ADMIN`).
  * `search`: Tìm kiếm theo MSSV, Họ tên hoặc Mã Vector ID.
  * `department`: Lọc theo Khoa (`ALL`, `Khoa Công Nghệ Thông Tin`, `Khoa Kinh Tế`...).
  * `status`: Lọc theo trạng thái eKYC (`ALL`, `ENROLLED` - Đã nạp Vector, `NOT_ENROLLED` - Chưa xác thực, `PENDING_RESET` - Có đơn xin đổi diện mạo).
  * `page`: Trang hiện tại (Mặc định: 1).
  * `limit`: Số bản ghi trên 1 trang (Mặc định: 10).
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy danh sách sinh trắc học và KPI thành công.",
  "data": {
    "kpis": {
      "totalStudents": 4250,
      "enrolledCount": 4180,
      "enrolledRate": "98.3%",
      "notEnrolledCount": 70,
      "pendingResetRequests": 5
    },
    "tabCounts": {
      "students": 4250,
      "teachers": 185
    },
    "items": [
      {
        "id": "17f96b03-51a2-499f-8998-cafd8653fdc4",
        "userCode": "21110001",
        "fullName": "Nguyễn Văn An",
        "role": "STUDENT",
        "className": "21CNTT1",
        "department": "Khoa Công Nghệ Thông Tin",
        "email": "21110001@vnu.edu.vn",
        "phone": "0912345678",
        "avatarUrl": "https://cdn.spas.edu.vn/faces/master/21110001.jpg",
        "isFaceEnrolled": true,
        "vectorId": "#V-512001",
        "enrolledDate": "2023-10-10",
        "hasPendingResetRequest": false,
        "pendingRequestId": null
      },
      {
        "id": "85036671-afe4-4156-877a-55627a65f8d5",
        "userCode": "21110045",
        "fullName": "Trần Thị Bích Ngọc",
        "role": "STUDENT",
        "className": "21KT3",
        "department": "Khoa Kinh Tế",
        "email": "21110045@vnu.edu.vn",
        "phone": "0912345681",
        "avatarUrl": "https://cdn.spas.edu.vn/faces/master/21110045.jpg",
        "isFaceEnrolled": true,
        "vectorId": "#V-512045",
        "enrolledDate": "2022-09-15",
        "hasPendingResetRequest": true,
        "pendingRequestId": "req_bio_2026_001"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "totalItems": 4250,
      "totalPages": 425
    }
  },
  "timestamp": "2026-08-26T09:41:03.856Z"
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

### 5.1.1. Hồ sơ định danh sau khi đăng ký khuôn mặt (`/student/biometric-profile`)
* **Endpoint:** `GET /api/v1/student/biometric-profile` | **Auth:** `STUDENT`
* **Mục đích:** Hiển thị lại trạng thái và metadata enrollment ngay trong trang Đăng ký khuôn mặt sau khi hoàn tất. Endpoint không nhận `user_id`; Backend lấy sinh viên từ JWT để ngăn đọc chéo tài khoản.
* **Response không chứa:** embedding thô, đường dẫn filesystem/storage nội bộ hoặc dữ liệu sinh trắc của sinh viên khác.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "student": {
      "id": "usr_stu_01",
      "userCode": "2102001",
      "fullName": "Nguyễn Văn An",
      "email": "an@example.edu.vn",
      "department": "Khoa Công nghệ Thông tin",
      "className": "21CNTT1"
    },
    "status": "ENROLLED",
    "biometric": {
      "vectorId": "#V-12",
      "modelVersion": "facenet-512d",
      "embeddingDimension": 512,
      "enrollmentVersion": 1,
      "enrolledAt": "2026-08-29T08:00:00.000Z"
    },
    "previewUrl": "/api/v1/student/face-preview",
    "enrollmentImages": [
      {
        "id": "img_01",
        "imageIndex": 1,
        "pose": "front",
        "previewBase64": "data:image/jpeg;base64,/9j/..."
      },
      {
        "id": "img_02",
        "imageIndex": 2,
        "pose": "left",
        "previewBase64": "data:image/jpeg;base64,/9j/..."
      }
    ]
  }
}
```

`enrollmentImages` chứa toàn bộ frame gốc đã gửi khi enrollment (thường 8, tối đa 12), không phải ảnh crop duy nhất. `previewUrl` vẫn giữ để tương thích và trả ảnh đầu tiên.

### 5.1.2. Xem ảnh enrollment sau khi đăng ký (`/student/face-preview`)
* **Endpoint:** `GET /api/v1/student/face-preview` | **Auth:** `STUDENT`
* **Mục đích:** Trả ảnh gốc enrollment đầu tiên để tương thích với client cũ; danh sách đầy đủ nằm trong `enrollmentImages` của `/student/biometric-profile`.
* **Response:** `image/jpeg` binary. Frontend phải gọi bằng Axios/Bearer token, không dùng thẻ `<img>` trực tiếp với URL protected.
* **Phân quyền:** Chỉ trả ảnh của `req.user.userId`; chưa có ảnh trả `404`.

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

## 🤖 7. MODULE 6: PYTHON AI MICROSERVICE ENGINE (INTERNAL REST API)

### 7.1. Tổng Quan Kiến Trúc & Mục Đích của AI Engine
* **Công nghệ cốt lõi:**
  * **Phát hiện khuôn mặt (Face Detection):** YOLO
  * **Ước lượng góc mặt (Pose Estimation / Landmarks):** MTCNN
  * **Trích xuất đặc trưng & Nhận diện (Recognition):** FaceNet (512D Embeddings)
  * **Ngưỡng so khớp (Similarity Threshold):** $\ge 0.60$ (Cosine Similarity / Euclidean Distance)
  * **Giao thức:** REST API (`multipart/form-data` và `application/json`), Base URL: `http://localhost:8000`
* **Phạm vi nhiệm vụ:**
  1. Kiểm tra góc mặt (Trước, Trái, Phải, Không rõ).
  2. Kiểm tra trùng mặt (Tránh 1 khuôn mặt đăng ký cho nhiều MSSV).
  3. Quản lý kho dữ liệu vector khuôn mặt (Thêm, Đọc xem trước, Xóa).
  4. Nhận diện khuôn mặt từ ảnh chụp cả lớp (Batch Face Recognition).
* **Quy ước ranh giới hệ thống:**
  * AI Service không tự động điểm danh, không duy trì kết nối WebSocket, không tự động lưu dữ liệu vào CSDL PostgreSQL của ứng dụng Web.
  * Backend Node.js đóng vai trò điều phối (gửi request sang AI Service, nhận kết quả và cập nhật CSDL).

---

### 7.2. Danh Sách Chi Tiết 7 API của Python AI Microservice

#### 📍 7.2.1. Kiểm tra Trạng thái Dịch vụ AI (Health Check)
* **Endpoint:** `GET /health` | **Auth:** Internal
* **Mục đích:** Backend/Frontend gọi để kiểm tra xem Python AI Engine có đang sẵn sàng hoạt động trước khi mở Camera hoặc kích hoạt phiên quét.
* **Success Response (200 OK):**
```json
{
  "status": "ok",
  "service": "spas-ai-engine",
  "version": "1.0.0",
  "gpu_available": true,
  "models_loaded": {
    "yolo": true,
    "mtcnn": true,
    "facenet": true
  }
}
```

---

#### 📍 7.2.2. Kiểm tra Góc Mặt (Face Pose Estimation)
* **Endpoint:** `POST /api/face-pose` | **Auth:** Internal
* **Content-Type:** `multipart/form-data`
* **Form Data:**
  * `image`: File ảnh chân dung rời (`.jpg`, `.jpeg`, `.png`).
* **Mục đích:** Backend/Frontend dùng để kiểm tra và lọc lấy các khung hình rõ nét, đúng góc độ (`front`, `left`, `right`) trong quy trình eKYC.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "pose": "front",
  "confidence": 0.96,
  "bbox": [120, 85, 280, 310]
}
```
* **Các giá trị của `pose`:**
  * `"front"`: Mặt nhìn thẳng trực diện.
  * `"left"`: Mặt quay nghiêng sang trái.
  * `"right"`: Mặt quay nghiêng sang phải.
  * `"unknown"`: Không xác định được góc mặt / bị che khuất hoặc mờ.

---

#### 📍 7.2.3. Kiểm tra Trùng Khuôn Mặt (Check Duplicate Enrollment)
* **Endpoint:** `POST /api/check-enrollment` | **Auth:** Internal
* **Content-Type:** `multipart/form-data`
* **Form Data:**
  * `student_id`: Mã số sinh viên (`userCode`, ví dụ: `"21020001"`).
  * `frames`: Danh sách tối thiểu 3 file ảnh chân dung đã lọc (`frame1.jpg`, `frame2.jpg`, `frame3.jpg`).
* **Mục đích:** So sánh vector khuôn mặt mới với toàn bộ kho dữ liệu khuôn mặt đã đăng ký trước đó để chống gian lận (đăng ký hộ người khác).
* **Success Response (200 OK):**
```json
{
  "success": true,
  "is_duplicate": false,
  "matched_student_id": null,
  "similarity_score": 0.24,
  "message": "Khuôn mặt hợp lệ, chưa từng được đăng ký trong hệ thống."
}
```
* **Trường hợp bị trùng (Duplicate):**
```json
{
  "success": true,
  "is_duplicate": true,
  "matched_student_id": "21020099",
  "similarity_score": 0.89,
  "message": "Khuôn mặt này đã được đăng ký cho sinh viên có mã: 21020099."
}
```

---

#### 📍 7.2.4. Đăng Ký & Lưu Trữ Khuôn Mặt (Enroll Face)
* **Endpoint:** `POST /api/enroll` | **Auth:** Internal
* **Content-Type:** `multipart/form-data`
* **Form Data:**
  * `student_id`: Mã số sinh viên (`userCode`, ví dụ: `"21020001"`).
  * `name`: Họ và tên sinh viên (ví dụ: `"Nguyễn Văn An"`).
  * `frames`: Danh sách tối thiểu 3 file ảnh chân dung đạt chuẩn (`front`, `left`, `right`).
* **Mục đích:** AI Engine trích xuất đặc trưng FaceNet 512D, lưu vector và ảnh khuôn mặt đại diện vào kho dữ liệu AI.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "student_id": "21020001",
  "enrolled_frames_count": 3,
  "face_crop_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
  "message": "Đăng ký dữ liệu khuôn mặt sinh viên thành công."
}
```

---

#### 📍 7.2.5. Xem Ảnh Đã Đăng Ký (Get Enrollment Face Previews)
* **Endpoint:** `GET /api/enrollment/{student_id}/previews` | **Auth:** Internal
* **URL Params:** `student_id` (Mã số sinh viên, ví dụ: `21020001`).
* **Mục đích:** Trả về các ảnh khuôn mặt (định dạng Base64) đã lưu trữ của sinh viên đó để phục vụ hiển thị xem trước hoặc đối soát.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "student_id": "21020001",
  "total_images": 3,
  "images": [
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..."
  ]
}
```

---

#### 📍 7.2.6. Xóa Dữ Liệu Khuôn Mặt Sinh Viên (Delete Enrollment)
* **Endpoint:** `DELETE /api/enrollment/{student_id}` | **Auth:** Internal (Chỉ Admin)
* **URL Params:** `student_id` (Mã số sinh viên cần xóa).
* **Mục đích:** Xóa toàn bộ vector đặc trưng và ảnh mẫu của sinh viên khỏi kho dữ liệu AI (khi Admin cấp quyền đăng ký lại eKYC hoặc sinh viên thôi học).
* **Success Response (200 OK):**
```json
{
  "success": true,
  "student_id": "21020001",
  "message": "Đã xóa toàn bộ dữ liệu khuôn mặt của sinh viên 21020001 khỏi AI Engine."
}
```

---

#### 📍 7.2.7. Nhận Diện Điểm Danh Cả Lớp (Classroom Batch Face Recognition)
* **Endpoint:** `POST /api/recognize` | **Auth:** Internal
* **Content-Type:** `multipart/form-data`
* **Form Data:**
  * `image`: 1 file ảnh chụp toàn cảnh phòng học / lớp học (`classroom_snapshot.jpg`).
* **Mục đích:** YOLO quét tất cả khuôn mặt trong phòng học -> FaceNet trích xuất vector và so sánh với kho dữ liệu ($\text{score} \ge 0.60$) -> Trả về danh sách sinh viên có mặt và ảnh đã vẽ sẵn khung Bounding Box.
* **Success Response (200 OK):**
```json
{
  "success": true,
  "total_faces": 42,
  "recognized": [
    {
      "student_id": "21020001",
      "name": "Nguyễn Văn An",
      "score": 0.88,
      "bbox": [140, 210, 210, 305]
    },
    {
      "student_id": "21020002",
      "name": "Trần Thị Bình",
      "score": 0.79,
      "bbox": [320, 190, 390, 280]
    }
  ],
  "unknown_faces_count": 3,
  "annotated_image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..."
}
```

---

### 7.3. Luồng Tương Tác Giữa Backend Node.js và Python AI Service

```mermaid
sequenceDiagram
    autonumber
    actor User as Sinh Viên / Giảng Viên
    participant Web as Frontend Web (React)
    participant BE as Backend Gateway (Node.js)
    participant AI as Python AI Engine (FastAPI)
    participant DB as PostgreSQL Database

    Note over User, AI: 1. LUỒNG ĐĂNG KÝ KHUÔN MẶT (eKYC ONBOARDING)
    User->>Web: Thực hiện quay/chụp 3 góc mặt (Thẳng, Trái, Phải)
    Web->>BE: Gửi danh sách ảnh chân dung
    BE->>AI: POST /api/face-pose (Kiểm tra góc mặt từng ảnh)
    AI-->>BE: Trả về kết quả: front, left, right
    BE->>AI: POST /api/check-enrollment (Kiểm tra trùng mặt)
    AI-->>BE: is_duplicate: false
    BE->>AI: POST /api/enroll (Lưu vector & thông tin sinh viên)
    AI-->>BE: Đăng ký thành công + Face Crop Base64
    BE->>DB: Cập nhật is_face_enrolled = true & lưu avatar
    BE-->>Web: Thông báo đăng ký eKYC hoàn tất

    Note over User, AI: 2. LUỒNG ĐIỂM DANH TỰ ĐỘNG (CLASS ATTENDANCE)
    User->>Web: Giảng viên kích hoạt quét / Chụp ảnh phòng học
    Web->>BE: Gửi 1 ảnh chụp cả lớp (Snapshot)
    BE->>AI: POST /api/recognize (Gửi ảnh cả lớp)
    Note over AI: YOLO phát hiện mặt -> FaceNet so khớp vector (Score >= 0.60)
    AI-->>BE: Trả về recognized_list & annotated_image
    BE->>DB: Đối chiếu sĩ số lớp & Ghi nhận AttendanceLog (PRESENT)
    BE-->>Web: Trả về kết quả sĩ số có mặt kèm ảnh đã vẽ khung
```

---
### 7.4. AI MVP demo contract — current implementation

Phần này là contract đang dùng trong code hiện tại; các endpoint cũ ở mục 7.2 chỉ giữ để tham khảo lịch sử.

| Endpoint nội bộ | Mục đích |
|---|---|
| `POST /internal/v1/pose` | Kiểm tra frame enrollment có đúng một mặt và pose `front/left/right`. |
| `POST /internal/v1/enrollments` | Nhận `student_id` và nhiều file `frames`; tạo vector 512D từ các frame hợp lệ. |
| `PUT /internal/v1/attendance-sessions/{session_id}/roster` | Nạp roster chỉ gồm sinh viên của session. |
| `POST /internal/v1/attendance-sessions/{session_id}/recognitions` | Nhận diện từ một ảnh upload. |
| `POST /internal/v1/attendance-sessions/{session_id}/capture` | Đọc một frame từ RTSP rồi nhận diện ngay. |
| `DELETE /internal/v1/attendance-sessions/{session_id}/roster` | Gỡ roster khi kết thúc session. |

Các endpoint nội bộ bắt buộc header `x-ai-service-key` và chỉ Backend được gọi. Frontend không gọi trực tiếp AI.

Recognition response hiện trả thêm:

```json
{
  "framePreview": "base64-jpeg-without-data-prefix",
  "frameWidth": 1280,
  "frameHeight": 720,
  "faces": [
    {
      "result": "MATCHED",
      "studentId": "SV001",
      "score": 0.82,
      "bbox": { "x": 220, "y": 100, "width": 160, "height": 190 }
    }
  ]
}
```

Backend phát event Socket.IO `attendance:frame_captured` để FE hiển thị frame và vẽ BBox. Màu xanh là `MATCHED`; màu đỏ là `UNKNOWN_PERSON` hoặc `AMBIGUOUS`.

### 7.5. Demo timing

Local Docker mặc định dùng `DEMO_MODE=true`, `LATE_CUTOFF_MINUTES=1` và `AI_CAPTURE_INTERVAL_MS=3000`. Nút điểm danh gọi capture ngay; không chờ đến giờ lịch. Nút kết thúc thực hiện capture cuối rồi chốt session, không bị khóa bởi `EARLY_END_MINUTES` trong demo.

Xem flow chi tiết tại `docs/AI_MVP_DEMO_FLOW.md`.

### 7.6. Camera browser cho demo

Phòng học có thể dùng `browser://camera` thay cho iVCam. FE giáo viên mở `navigator.mediaDevices.getUserMedia`, chụp JPEG và gửi vào endpoint hiện có:

```http
POST /api/v1/teacher/sessions/{session_id}/trigger-snapshot
Authorization: Bearer <teacher_token>
Content-Type: multipart/form-data
image=<jpeg>
```

BE chuyển file qua `aiClientService.recognize()`; AI vẫn nhận roster của đúng session và trả `faces`, `score`, `pose`, `bbox`, `evidenceCrop`, `framePreview`. BE là nơi ghi attendance, lưu evidence và phát Socket.IO; FE không gọi trực tiếp AI.

Với phòng RTSP, request JSON cũ tới cùng endpoint vẫn giữ nguyên. `GET /api/v1/teacher/sessions/resolve?courseCode={course_code}` cho phép giáo viên tra cứu phiên thuộc môn mình phụ trách rồi mở camera không cần nhập UUID session.

Chi tiết thay đổi và checklist QA: `docs/CAMERA_WEBCAM_ATTENDANCE_REPORT.md`.

---
*Đây là tài liệu API tổng hợp; khi có khác biệt, contract ở mục 7.4 và `docs/AI_MVP_DEMO_FLOW.md` phản ánh implementation hiện tại của AI MVP.*

