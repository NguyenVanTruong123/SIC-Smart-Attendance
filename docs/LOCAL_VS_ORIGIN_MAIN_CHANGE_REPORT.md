# Báo cáo đối chiếu Local và `origin/main`

**Dự án:** SIC Smart Attendance
**Ngày kiểm tra:** 29/08/2026
**Phạm vi:** backend, frontend, AI service, database, Docker và tài liệu
**Mục tiêu:** xác định chính xác phần đã thay đổi ở máy local so với source đang có trên repository trước khi review/merge.

## 1. Tóm tắt điều hành

Local đang ở branch `kien0512/module-mới`. Sau khi `git fetch origin`, `HEAD` local và `origin/main` cùng trỏ tới commit:

```text
ef5e6c5dec4c3a731b8a5344355d0d64f8c3250b
```

Vì vậy, phần khác biệt hiện tại **chưa được commit/push**, không phải là commit mới trên remote.

Tại thời điểm đối chiếu:

- `37` file tracked đã thay đổi, khoảng `2.367` dòng thêm và `1.996` dòng xóa.
- `45` file untracked mới tồn tại trong working tree trước khi tạo báo cáo này.
- Remote AI chỉ có `ai-service/README.md`; local đã có service Python thực thi model.
- Local đã hình thành prototype full-stack gồm Node.js gateway, Python AI service, PostgreSQL, React frontend, Socket.IO và Docker Compose.
- Các file trong `runtime/` chứa gallery, ảnh enrollment và evidence thực tế; không được commit lên GitHub.

## 2. Phương pháp đối chiếu

Đối chiếu được thực hiện bằng các bước:

1. Cập nhật remote bằng `git fetch origin`.
2. So sánh `HEAD`, `origin/main`, `git diff`, `git status` và danh sách file untracked.
3. Đọc các route, service, schema, migration, Dockerfile và frontend component liên quan.
4. Đối chiếu với build/runtime local đã thực hiện trong cùng workspace.

Định nghĩa trong báo cáo:

- **Remote baseline:** source tại `origin/main`.
- **Local delta:** thay đổi tracked chưa commit và file untracked tại working tree.
- **Đã có trong code:** có implementation local, không đồng nghĩa đã production-ready.

## 3. Bảng tổng hợp thay đổi

| Nhóm | Remote baseline | Local delta | Đánh giá |
|---|---|---|---|
| Database | Schema attendance cơ bản | Thêm trạng thái phiên, detection, evidence, biometric metadata, khoa, ca học và constraint chống trùng | Đã có prototype |
| Backend API | Auth, classroom, import, teacher schedule, biometric list | Thêm quản lý đào tạo, eKYC, student API, teacher session, audit/report, rate limit, Socket.IO | Đã có nhiều route |
| AI | Chỉ có README | YOLO face detection, FaceNet 512D, MTCNN pose/alignment, roster cosine matching, enrollment và RTSP capture | Chạy được single-instance |
| Frontend | Portal/components ban đầu | Refactor portal, RBAC menu, dashboard, calendar, enrollment tracking, admin forms, teacher scan, evidence | Đã build được |
| Hạ tầng | Chưa có stack Compose hoàn chỉnh | Docker Compose gồm PostgreSQL, Node gateway, Python AI, Nginx frontend | Dùng được cho demo local |
| Tài liệu | API và thiếu sót backend cũ | README Docker, AI handoff, six-module report, schedule/dropdown/create-class reports | Cần đồng bộ lại trước merge |
| Dữ liệu runtime | Không có trên remote | Gallery, crop enrollment và evidence local | Dữ liệu nhạy cảm, phải loại khỏi commit |

## 4. Thay đổi database và nghiệp vụ lõi

### 4.1. Schema Prisma

File chính: `backend/prisma/schema.prisma`

Local đã bổ sung:

- `SessionStatus`: `REVIEW`, `DEGRADED`, `FAILED`.
- `AttendanceStatus`: `UNCONFIRMED` để phân biệt chưa chốt với vắng.
- `AuditActionType`: thay đổi dữ liệu admin, bắt đầu/kết thúc phiên, reset eKYC.
- `FaceDetectionResult`: `MATCHED`, `UNKNOWN_PERSON`, `AMBIGUOUS`.
- `Department` và quan hệ khoa với tài khoản.
- `SessionFaceDetection` để lưu kết quả nhận diện, score, pose, bounding box và crop evidence.
- `ClassSession.periodStart`, `periodEnd`, `startedAt`, `endedAt`, `rosterVersion`, `failureReason`.
- `AttendanceLog.firstSeenAt`, `bestScore`, `bestEvidenceId`, mặc định `UNCONFIRMED`.
- `UserBiometric.modelVersion`, `embeddingDimension`, `enrollmentVersion`.
- Index tra cứu session theo ngày/phòng và lớp/ngày.

### 4.2. Migration và chống trùng lịch

File mới:

- `backend/prisma/migrations/20260829_init/migration.sql`
- `backend/prisma/migrations/20260829_add_study_periods_and_overlap_guards/migration.sql`

Migration ca học dùng 13 ca cố định từ `07:00` đến `20:05`. Database bật `btree_gist` và thêm exclusion constraint để:

- Không cho hai session khác nhau dùng cùng phòng trong khoảng thời gian giao nhau.
- Không cho một lớp học phần có hai session giao nhau.
- Bỏ qua session có trạng thái `CANCELLED`.

File hỗ trợ: `backend/src/utils/study-periods.ts`.

### 4.3. Import thời khóa biểu

`backend/src/services/import.service.ts` hiện đọc các cột ca học/từ ca/đến ca, nhóm nhiều dòng cùng mã lớp và tạo nhiều `ClassSession`. Điều này cho phép một lớp học phần có nhiều ngày và nhiều khoảng ca thay vì chỉ một lịch duy nhất.

### 4.4. Tạo lớp học phần kèm ca đầu tiên

`backend/src/services/admin-academic.service.ts` và `frontend/src/components/admin/AdminClasses.tsx` đã bổ sung:

- Chọn môn, giảng viên và lớp bằng dropdown có tìm kiếm.
- Chọn phòng học, ngày học, ca bắt đầu và ca kết thúc.
- Tạo `CourseClass` và `ClassSession` trong cùng transaction.
- Trả lỗi `409` khi trùng phòng hoặc trùng lớp học phần.
- Vẫn tương thích client cũ nếu không gửi phần lịch.

## 5. Backend API và flow điểm danh

### 5.1. Xác thực và phân quyền

Local bổ sung:

- `POST /api/v1/auth/change-password`.
- Rate limit toàn bộ `/api/v1`.
- Các route admin yêu cầu `ADMIN`.
- Các route teacher yêu cầu `TEACHER` hoặc `ADMIN`.
- Các route student yêu cầu `STUDENT`.
- AI service chỉ được gọi từ Node gateway bằng `x-ai-service-key`.

### 5.2. eKYC và dữ liệu khuôn mặt

Các route mới:

- `POST /api/v1/ekyc/enroll-initial`.
- `POST /api/v1/ekyc/pose`.
- `GET /api/v1/student/biometric-profile`.
- `GET /api/v1/student/face-preview`.
- `GET /api/v1/admin/biometrics/:userId`.
- `POST /api/v1/admin/biometrics/:userId/reset`.

Flow local hiện tại:

1. Sinh viên bật camera và tracking tư thế thẳng/trái/phải.
2. Frontend chỉ chụp frame khi AI trả đúng pose; mỗi pose lấy hai frame hợp lệ.
3. Gateway gửi các frame enrollment tới Python AI.
4. AI yêu cầu tối thiểu năm crop rõ mặt, đủ ba tư thế và chỉ một mặt trong frame.
5. Gateway lưu trạng thái enrollment, metadata vector và ảnh preview evidence.
6. Khi đã đăng ký, tài khoản không thể đăng ký lại; chỉ admin reset.

### 5.3. Phiên điểm danh của giảng viên

Các route mới:

- `GET /api/v1/teacher/sessions/:id`.
- `POST /api/v1/teacher/sessions/:id/start`.
- `POST /api/v1/teacher/sessions/:id/trigger-snapshot`.
- `PUT /api/v1/teacher/sessions/:id/attendance/:studentId/override`.
- `POST /api/v1/teacher/sessions/:id/end`.
- `GET /api/v1/teacher/sessions/:id/evidence/:evidenceId`.

Khi mở phiên, gateway:

1. Lấy roster sinh viên thuộc đúng lớp học phần.
2. Chỉ nạp các sinh viên đã enrollment vào AI roster.
3. Tạo các bản ghi attendance ở trạng thái `UNCONFIRMED`.
4. Gọi AI capture RTSP, lưu matched/unknown/ambiguous face crop.
5. Cập nhật `PRESENT` hoặc `LATE`, score tốt nhất và bằng chứng tốt nhất.
6. Đẩy event Socket.IO cho kết quả nhận diện, thống kê và cảnh báo người lạ.
7. Khi kết thúc, các bản ghi còn `UNCONFIRMED` được chốt thành `ABSENT`.

Ngưỡng hiện tại:

- Đi muộn sau `15` phút kể từ lúc phiên bắt đầu.
- Không cho kết thúc sớm nếu còn hơn `30` phút, trừ khi gửi xác nhận.
- Capture loop mặc định mỗi `5.000 ms`.
- Scheduler kiểm tra session đến hạn mỗi `30.000 ms` khi `AUTO_START_SESSIONS` được bật.

### 5.4. Student và admin API

Student API hiện có dashboard tuần, lịch sử điểm danh có tìm kiếm, evidence của chính sinh viên, hồ sơ biometric và leave request.

Admin API hiện có CRUD/soft-delete cho tài khoản, khoa, môn, lớp học phần, enrollment và session; dashboard health; audit log; báo cáo attendance; quản lý biometric và reset.

## 6. AI service local

### 6.1. Pipeline model

File chính: `ai-service/main.py`

Pipeline hiện tại:

```text
Ảnh/frame hoặc RTSP
        ↓
YOLO face detector, imgsz=640, conf=0.35
        ↓
Crop mặt có margin
        ↓
MTCNN landmark + thử xoay 0/90/180/270 để alignment
        ↓
InceptionResnetV1 / FaceNet embedding 512D
        ↓
L2 normalize
        ↓
Cosine similarity với roster của đúng session
        ↓
MATCHED / AMBIGUOUS / UNKNOWN_PERSON
        ↓
Bounding box, score, pose và evidence crop
```

Model được đọc từ `FACE_DETECTOR_PATH` và `FACE_RECOGNITION_PATH`; Docker mount thư mục `models/` ở chế độ read-only.

### 6.2. AI endpoint nội bộ

Python service có các endpoint nội bộ:

- `GET /health`.
- `POST /internal/v1/pose`.
- `POST /internal/v1/enrollments`.
- `DELETE /internal/v1/enrollments/{student_id}`.
- `PUT /internal/v1/attendance-sessions/{session_id}/roster`.
- `DELETE /internal/v1/attendance-sessions/{session_id}/roster`.
- `POST /internal/v1/attendance-sessions/{session_id}/recognitions`.
- `POST /internal/v1/attendance-sessions/{session_id}/capture`.

AI trả dữ liệu nhận diện và bằng chứng; việc quyết định đi học/muộn/vắng, phân quyền và audit vẫn do backend xử lý.

## 7. Frontend local

### 7.1. Khung giao diện và RBAC

`frontend/src/App.tsx` được refactor thành portal dùng menu theo role:

- Sinh viên: tổng quan, kết quả điểm danh, tài khoản cá nhân.
- Giảng viên: lớp giảng dạy, điểm danh AI, duyệt đơn nghỉ.
- Admin: tổng quan, sinh trắc học, phòng/camera, môn/lớp học phần, audit.

Sidebar có trạng thái active, thu gọn/mở rộng, responsive; theme chính dùng màu đỏ hệ thống và font giao diện thống nhất.

### 7.2. Sinh viên

- Dashboard hiển thị lịch tuần theo calendar.
- Lịch sử điểm danh có search theo môn/ngày/phòng và xem ảnh bằng chứng của chính tài khoản.
- Enrollment camera tracking thẳng/trái/phải, có progress, hướng dẫn và tự dừng camera.
- Hồ sơ biometric hiển thị trạng thái, model version, vector ID metadata và ngày enrollment.

### 7.3. Giảng viên

- Lịch giảng dạy có chuyển tuần.
- Mở phiên, kết thúc phiên và chụp đối soát.
- Bảng danh sách sinh viên, trạng thái, thời điểm nhận diện, score và ảnh.
- Danh sách unknown/ambiguous crop.
- Sửa attendance thủ công qua modal.
- Nhận cập nhật realtime bằng Socket.IO.

### 7.4. Admin

- Dashboard KPI sinh viên, giảng viên, phòng, camera và enrollment.
- Quản lý sinh trắc học có xem hồ sơ, preview và reset.
- Form quản lý môn, lớp học phần, xếp sinh viên.
- Dropdown môn, giảng viên, lớp, sinh viên và phòng có search; search tiếng Việt không dấu ở phía frontend kết hợp query backend.
- Hiển thị lịch buổi đầu ngay khi tạo lớp học phần.

## 8. Hạ tầng và tài liệu

### 8.1. Docker Compose

File mới: `docker-compose.yml`.

Các service local:

- `postgres`: PostgreSQL 16, volume `postgres-data`.
- `ai-service`: Python FastAPI, mount model read-only và runtime AI.
- `backend`: Node.js/Prisma gateway, chạy migration/seed và kết nối AI nội bộ.
- `frontend`: Vite build qua Nginx, proxy API tới backend.

Các Dockerfile mới:

- `ai-service/Dockerfile`.
- `backend/Dockerfile`.
- `frontend/Dockerfile`.
- `frontend/nginx.conf`.

### 8.2. Tài liệu local mới

- `docs/AI_BE_MVP_HANDOFF.md`: contract AI gửi cho BE.
- `docs/SIX_MODULES_IMPLEMENTATION_REPORT.md`: tổng hợp sáu nhóm chức năng.
- `docs/COURSE_CLASS_SCHEDULE_CHANGE_REPORT.md`: ca học và chống trùng.
- `docs/COURSE_CLASS_CREATE_SCHEDULE_REPORT.md`: tạo lớp kèm ca đầu.
- `docs/FRONTEND_DROPDOWN_SEARCH_REPORT.md`: search dropdown.
- `docs/LOCAL_VS_ORIGIN_MAIN_CHANGE_REPORT.md`: báo cáo đối chiếu này.

README local đã thêm hướng dẫn `docker compose up --build`, model đặt ở `models/` và truy cập `http://localhost`.

## 9. Kiểm chứng local

Các kiểm chứng đã thực hiện trên working tree:

- Backend `pnpm run build`: đạt.
- Frontend `pnpm run check`: đạt.
- Frontend `pnpm run build`: đạt; Vite chỉ cảnh báo bundle lớn.
- Docker Compose rebuild `backend` và `frontend`: đạt.
- Backend health trong container: HTTP `200` tại `/api/v1/health`.
- Frontend Nginx: HTTP `200` tại `http://localhost`.
- Smoke test tạo lớp kèm ca `1–3`: tạo đúng `ClassSession`.
- Smoke test lịch trùng: trả HTTP logic `409`.
- Dữ liệu smoke test đã được xóa sau kiểm tra.

Đây là kết quả build/smoke test local, chưa phải load test, security audit hoặc kiểm chứng multi-instance.

## 10. Khoảng cách và rủi ro cần review

### 10.1. Chưa đồng bộ chính xác với yêu cầu vận hành ca

Code hiện capture mỗi 5 giây trong toàn bộ thời gian `LIVE_NOW`. Nó chưa hiện thực đầy đủ lịch “realtime 15 phút đầu của từng ca, chốt ca rồi mở lại sau giờ nghỉ” như flow nghiệp vụ đã bàn. Cần tách scheduler theo `ClassSession`/period và định nghĩa rõ milestone trước khi gọi production-ready.

### 10.2. AI service hiện phù hợp demo một instance

- `ROSTERS` đang lưu trong RAM; restart process hoặc chạy nhiều replica sẽ mất/không đồng bộ roster.
- Gallery và evidence đang lưu file local/volume; chưa phải object storage production.
- RTSP được mở và đọc theo từng request capture; chưa có worker/queue, backpressure hoặc giới hạn tải cho nhiều camera.
- Chưa có load test cho nhiều phòng và chưa đo latency/throughput theo GPU/CPU.

### 10.3. Dữ liệu nhạy cảm local

Thư mục `runtime/` đang chứa:

- `runtime/ai-data/gallery.npz`.
- Ảnh crop enrollment trong `runtime/ai-data/enrollment_crops/`.
- Ảnh evidence trong `runtime/evidence/`.

Đây là dữ liệu sinh trắc/evidence thực tế. Không add vào commit; nên bổ sung ignore rule và dùng dữ liệu demo đã ẩn danh nếu cần chia sẻ.

### 10.4. Secrets và cấu hình demo

`docker-compose.yml` đang có fallback password/database key/JWT key cho local. Dùng được cho demo, nhưng khi deploy phải truyền qua secret manager hoặc environment riêng và rotate toàn bộ key.

### 10.5. Lockfile và package manager

Backend remote còn `package-lock.json`, local thêm `backend/pnpm-lock.yaml` và dùng pnpm trong Docker. Team cần chốt một package manager trước merge để tránh cài dependency khác nhau.

### 10.6. Tài liệu/UI còn dòng trạng thái cũ

Một số cảnh báo trong `docs/backend_missing_features.md`, `AdminBiometrics.tsx` và `AttendanceHistory.tsx` vẫn ghi route backend chưa có, trong khi local đã thêm route tương ứng. Cần cập nhật các dòng này để reviewer không hiểu nhầm implementation vẫn thiếu.

## 11. Đề xuất trước khi merge

1. Chỉ stage source, migration, Dockerfile và docs cần thiết; loại `runtime/`, ảnh, gallery, model weights và file secret.
2. Chốt `pnpm` hay npm cho backend, sau đó giữ đúng một lockfile theo quyết định của team.
3. Review migration trên database sạch rồi chạy seed; kiểm tra rollback/backup trước khi dùng DB thật.
4. Đồng bộ `docs/backend_missing_features.md` và các UI alert với route hiện tại.
5. Tách AI roster/evidence sang storage/cache dùng chung trước khi chạy nhiều backend/AI replica.
6. Bổ sung test API, test quyền theo role, test trùng lịch, test enrollment trùng người và test kết thúc sớm.
7. Thiết kế worker/queue và benchmark camera/AI trước khi tuyên bố hỗ trợ nhiều phòng.
8. Sau khi review diff, mới commit vào branch `kien0512/module-mới` và tạo PR; hiện tại chưa push.

## 12. Inventory file thay đổi

### 12.1. Tracked files đã sửa: 37 file

- Root/config: `README.md`, `backend/.env.example`, `backend/package.json`.
- Database: `backend/prisma/schema.prisma`.
- Backend gateway: `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/controllers/auth.controller.ts`, `backend/src/controllers/biometric.controller.ts`, `backend/src/middlewares/upload.middleware.ts`, `backend/src/routes/admin.routes.ts`, `backend/src/routes/auth.routes.ts`, `backend/src/routes/teacher.routes.ts`.
- Backend services: `backend/src/services/admin-class.service.ts`, `backend/src/services/admin-overview.service.ts`, `backend/src/services/auth.service.ts`, `backend/src/services/biometric.service.ts`, `backend/src/services/classroom.service.ts`, `backend/src/services/import.service.ts`, `backend/src/services/teacher.service.ts`.
- Backend docs: `docs/api_documentation.md`, `docs/backend_missing_features.md`.
- Frontend shell/types: `frontend/src/App.tsx`, `frontend/src/index.css`, `frontend/src/types/index.ts`, `frontend/src/utils/socket.ts`.
- Frontend admin: `frontend/src/components/admin/AdminBiometrics.tsx`, `frontend/src/components/admin/AdminClasses.tsx`, `frontend/src/components/admin/AdminClassrooms.tsx`, `frontend/src/components/admin/AdminQuickOverview.tsx`.
- Frontend auth/profile: `frontend/src/components/auth/Login.tsx`, `frontend/src/components/common/Profile.tsx`.
- Frontend student: `frontend/src/components/student/AttendanceHistory.tsx`, `frontend/src/components/student/Enrollment.tsx`, `frontend/src/components/student/StudentBiometricProfile.tsx`, `frontend/src/components/student/StudentDashboard.tsx`.
- Frontend teacher: `frontend/src/components/teacher/TeacherScan.tsx`, `frontend/src/components/teacher/TeacherSchedule.tsx`.

### 12.2. File local-only mới cần review

- AI runtime: `ai-service/Dockerfile`, `ai-service/main.py`, `ai-service/requirements.txt`.
- Backend runtime: `backend/Dockerfile`, `backend/pnpm-lock.yaml`, hai migration Prisma, các controller/service/route/realtime/middleware mới và `backend/src/utils/study-periods.ts`.
- Frontend runtime: `frontend/Dockerfile`, `frontend/nginx.conf`.
- Infrastructure: `docker-compose.yml`.
- Documentation: `docs/AI_BE_MVP_HANDOFF.md`, `docs/SIX_MODULES_IMPLEMENTATION_REPORT.md`, `docs/COURSE_CLASS_SCHEDULE_CHANGE_REPORT.md`, `docs/COURSE_CLASS_CREATE_SCHEDULE_REPORT.md`, `docs/FRONTEND_DROPDOWN_SEARCH_REPORT.md`, file report này.
- Runtime data: `runtime/ai-data/gallery.npz`, `runtime/ai-data/enrollment_crops/*` và `runtime/evidence/*`; **không commit**.

## 13. Kết luận

Local đã tiến xa hơn `origin/main` về mức prototype full-stack: có pipeline AI, gateway API, flow điểm danh, giao diện theo role, schema/migration và Docker runtime. Tuy nhiên, toàn bộ phần này vẫn đang là **working tree chưa commit**, và AI/Storage/queue chưa đạt mức production nhiều camera. Ưu tiên hiện tại là làm sạch dữ liệu nhạy cảm, đồng bộ tài liệu, chốt package manager, review migration và sau đó mới commit/merge theo từng nhóm thay đổi.
