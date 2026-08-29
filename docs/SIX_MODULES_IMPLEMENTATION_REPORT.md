# Báo cáo cập nhật hệ thống SPAS

Ngày cập nhật: 29/08/2026
Phạm vi: backend TypeScript, AI FastAPI, frontend React và cấu hình chạy local/Compose.

## 0. Change note — tách endpoint tab định danh sinh viên

- **Backend:** thêm `GET /api/v1/student/biometric-profile` tại `backend/src/services/student.service.ts`, `backend/src/controllers/student.controller.ts` và `backend/src/routes/student.routes.ts`. Endpoint chỉ lấy `req.user.userId`, trả metadata enrollment; giữ `GET /api/v1/student/face-preview` riêng cho binary ảnh.
- **Frontend:** hiển thị `StudentBiometricProfile` ngay trong trang `Đăng ký khuôn mặt` sau khi enrollment thành công; component gọi metadata và ảnh qua hai request có Bearer token, hiển thị mã vector/model/kích thước/ngày đăng ký/ảnh crop. Không tạo tab sinh trắc học riêng.
- **Contract:** `/api/v1/auth/me` chỉ còn thông tin user/phiên cơ bản; dashboard, attendance history, biometric profile, face preview và leave requests dùng endpoint riêng theo tab. Không trả embedding thô hoặc storage path.
- **RBAC:** không thêm `userId` vào public student route; sinh viên chỉ đọc hồ sơ và ảnh của chính mình, còn reset vẫn thuộc endpoint admin hiện có.
- **Review scope:** không đổi API AI nội bộ, flow enrollment, quy tắc điểm danh, schema Prisma hoặc quyền admin.

## 1. Kết luận nhanh

Sáu nhóm đã có khung MVP chạy xuyên suốt. Không nên gọi đây là production-ready cho 100 phòng học: AI hiện giữ roster trong RAM, worker là timer trong một process và bằng chứng đang lưu filesystem. Đây là chủ ý để demo một camera; khi mở rộng phải chuyển sang queue, object storage và worker riêng.

| Nhóm | Trạng thái | Ghi chú |
|---|---|---|
| Điểm danh tự động | Đã có MVP | Roster theo lớp, cosine tại AI, start/capture/end, chậm, unknown, retry khi AI/camera lỗi, Socket.IO |
| Quản lý đào tạo | Đã có API nền | User, khoa, môn, lớp, xếp SV, phòng, lịch, import Excel; CRUD lịch/danh mục đã thêm |
| Sinh viên | Đã có MVP | Lịch sử có ảnh, gửi đơn nghỉ kèm tệp, xem ảnh enrollment cá nhân, đổi mật khẩu |
| Giảng viên | Đã có MVP | Mở/kết thúc phiên, hậu kiểm, sửa trạng thái có audit, đơn nghỉ, báo cáo matrix, realtime |
| Admin | Đã có API nền | Dashboard cũ + health, audit log, báo cáo CSV, reset khuôn mặt, quản trị dữ liệu |
| Production | Demo/local-ready | Migration, seed, Compose, rate limit; chưa phải HA/queue/object storage/load-test |

## 2. Luồng AI–Backend chuẩn

1. Backend xác định `ClassSession` và lấy đúng danh sách `CourseEnrollment` của lớp.
2. Backend gọi `PUT /internal/v1/attendance-sessions/{sessionId}/roster` với mã sinh viên đã enrollment.
3. AI tạo/cache ma trận `N x 512` của đúng roster; không tìm kiếm toàn trường trong phiên điểm danh.
4. AI nhận frame RTSP, detect khuôn mặt, tạo vector 512D và tính cosine với ma trận roster.
5. `score >= acceptThreshold` và không mơ hồ thì trả `MATCHED`; ngược lại trả `UNKNOWN_PERSON` hoặc `AMBIGUOUS`.
6. Backend mới áp dụng nghiệp vụ: `PRESENT` trong 15 phút đầu, `LATE` sau đó, `UNCONFIRMED` khi chưa chốt và `ABSENT` khi giáo viên kết thúc.
7. Crop bằng chứng được lưu với mã ngẫu nhiên; quyền đọc đi qua endpoint có JWT, không trả RTSP credential ra frontend.

AI không tự quyết định trạng thái đi học. AI chỉ trả mặt, identity trong roster, score, pose/chất lượng và crop; Backend giữ RBAC, lịch, quy tắc điểm danh và audit.

## 3. Thay đổi theo file

### Backend

- `backend/prisma/schema.prisma`: thêm `Department`, `SessionFaceDetection`, roster/session fields, `UNCONFIRMED`, `DEGRADED`, `FAILED`, `ADMIN_DATA_CHANGE`, thông tin model enrollment.
- `backend/prisma/migrations/20260829_init/migration.sql`: baseline migration sinh từ schema hiện tại; dùng `prisma migrate deploy` trên môi trường mới.
- `backend/src/services/ai-client.service.ts`: client nội bộ gọi AI bằng `AI_SERVICE_KEY`, không đưa URL RTSP về client.
- `backend/src/services/teacher-session.service.ts`: nạp roster, start/capture/end, tính muộn, tạo crop/snapshot, retry timer và phát sự kiện realtime.
- `backend/src/realtime/socket.ts` và `backend/src/server.ts`: namespace `/attendance`, path `/ws`, kiểm JWT và quyền giáo viên sở hữu phiên trước khi join.
- `backend/src/services/evidence.service.ts`: lưu/đọc crop; route đọc bằng chứng đã kiểm quyền ở teacher, student và admin enrollment.
- `backend/src/services/ekyc.service.ts`: enrollment nhiều frame, transaction DB và rollback enrollment AI khi ghi DB thất bại.
- `backend/src/services/admin-academic.service.ts`: CRUD tài khoản/khoa/môn/lớp/lịch, xếp sinh viên, chống trùng phòng hoặc trùng lớp trong cùng khung giờ.
- `backend/src/services/admin-ops.service.ts`: health AI/camera, audit log phân trang và báo cáo điểm danh JSON/CSV.
- `backend/src/services/student.service.ts`: lịch sử theo chính sinh viên, đơn nghỉ kiểm tra roster, tệp minh chứng và ảnh enrollment.
- `backend/src/middlewares/auth.middlewares.ts`, `rate-limit.middleware.ts`, `upload.middleware.ts`: JWT/RBAC, rate limit MVP, giới hạn loại và kích thước file.
- `backend/src/routes/*.routes.ts`: route eKYC, student, teacher session/realtime và admin academic/ops.

### AI service

- `ai-service/main.py`: YOLO detect + FaceNet 512D + MTCNN alignment; enrollment front/left/right; roster-scoped cosine; capture RTSP; crop base64 trả nội bộ.
- `ai-service/requirements.txt`, `ai-service/Dockerfile`: runtime FastAPI; model `.pt` không commit, mount qua `/models` hoặc biến môi trường.

### Frontend

- `frontend/src/components/teacher/TeacherScan.tsx`: nút mở/kết thúc phiên, gọi trigger snapshot, nghe Socket.IO và hiển thị thống kê/unknown.
- `frontend/src/components/student/AttendanceHistory.tsx`, `StudentBiometricProfile.tsx`: lịch sử, ảnh bằng chứng và ảnh enrollment qua endpoint có JWT.
- `frontend/src/utils/socket.ts`, `frontend/src/types/index.ts`: token động khi reconnect, trạng thái `UNCONFIRMED/DEGRADED` và payload realtime.
- `frontend/Dockerfile`, `frontend/nginx.conf`: build static và proxy REST/WebSocket qua cùng origin.

## 4. API MVP cần BE review

### AI nội bộ (chỉ Backend gọi)

- `GET /health`
- `POST /internal/v1/enrollments` — multipart `student_id`, `frames[]`
- `DELETE /internal/v1/enrollments/{studentId}`
- `PUT/DELETE /internal/v1/attendance-sessions/{sessionId}/roster`
- `POST /internal/v1/attendance-sessions/{sessionId}/recognitions` — upload image
- `POST /internal/v1/attendance-sessions/{sessionId}/capture` — JSON `rtspUrl`, chỉ nhận ở mạng nội bộ AI

### Backend mới

- `POST /api/v1/ekyc/enroll-initial`
- `GET /api/v1/teacher/sessions/{id}`, `POST .../start`, `POST .../trigger-snapshot`, `POST .../end`
- `PUT /api/v1/teacher/sessions/{id}/attendance/{studentId}/override`
- `GET /api/v1/teacher/sessions/{id}/evidence/{evidenceId}`
- `GET /api/v1/student/dashboard`, `GET /api/v1/student/attendance-history`, `GET/POST /api/v1/student/leave-requests`, `GET /api/v1/student/biometric-profile`, `GET /api/v1/student/face-preview`
- `GET/POST/PATCH/DELETE /api/v1/admin/users|departments|courses|course-classes`
- `GET/POST/PATCH/DELETE /api/v1/admin/sessions`
- `GET /api/v1/admin/health`, `GET /api/v1/admin/audit-logs`, `GET /api/v1/admin/reports/attendance?format=csv`

Mọi route nghiệp vụ đều yêu cầu JWT; route admin yêu cầu `ADMIN`; route giáo viên kiểm tra teacher sở hữu `CourseClass`; route student lọc theo `req.user.userId`.

## 5. Chạy và kiểm tra

### Local

```powershell
cd backend
Copy-Item .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed
pnpm dev

cd ..\frontend
pnpm install
pnpm dev
```

AI cần hai file model ngoài Git:

```text
models/face_best.pt
models/facenet_best.pt
```

### Compose

```powershell
docker compose up --build
```

Frontend ở `http://localhost`, backend chỉ expose nội bộ Compose, AI chỉ expose nội bộ. Tạo `models/` và đặt model vào đó trước khi chạy AI.

### Kiểm tra đã chạy

- `pnpm exec prisma validate` với `DATABASE_URL` và `DIRECT_URL` hợp lệ.
- `pnpm run build` tại `backend`.
- `pnpm run check` và `pnpm run build` tại `frontend`.
- `python -m py_compile ai-service/main.py`.

## 6. Việc chưa nên giả vờ là đã xong

- Chưa có Redis/BullMQ; timer phù hợp một camera/demo, không phù hợp 100 phòng.
- Chưa có object storage/S3, retention job, backup/restore tự động và monitoring tập trung.
- Chưa có anti-spoof liveness độc lập; enrollment hiện kiểm tra nhiều pose và chất lượng mặt, không phải bằng chứng chống replay.
- Chưa có PDF export và load/E2E test thật; CSV là định dạng export MVP.
- `AUTO_START_SESSIONS` nên để `false` khi demo để giáo viên chủ động mở phiên; production scheduler có thể bật sau khi kiểm thử timezone và camera.

## 7. Thứ tự merge khuyến nghị

1. Schema + migration + seed.
2. AI service + `ai-client` + eKYC.
3. Teacher session + evidence + Socket.IO.
4. Student/admin academic/ops.
5. Frontend và Compose.
6. Review security, chạy integration trên Postgres thật rồi mới merge `main`.
