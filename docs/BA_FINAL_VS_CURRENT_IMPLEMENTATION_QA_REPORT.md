# SPAS — BA Final vs Current Implementation & QA Report

> Báo cáo đối chiếu dùng làm baseline cho team review, lập report và viết test QA.

## 1. Phạm vi và nguồn đối chiếu

| Hạng mục | Baseline |
|---|---|
| Tài liệu BA | `DỰ ÁN SPAS - PRODUCT BACKLOG .docx` |
| Phiên bản BA ghi trong tài liệu | Product Backlog Version 6.0 Final; tài liệu đồng thời có các đoạn Version 6.2 và Version 5.0 |
| Repository | `C:\Users\dangv\Desktop\SIC\SIC-Smart-Attendance` |
| Nhánh đang kiểm tra | `kien0512/refactor` |
| Commit HEAD | `328f52a docs: record responsive and route updates` |
| `origin/main` tại thời điểm kiểm tra | `ef5e6c5dec4c3a731b8a5344355d0d64f8c3250b` |
| Ngày đối chiếu | 2026-08-30 |
| Phương pháp | Đọc BA bằng `python-docx`, kiểm kê route/service/schema/AI/FE, index codebase-memory và đối chiếu theo Acceptance Criteria |

Report đánh giá **working tree hiện tại**, không chỉ commit HEAD. Working tree đang có thay đổi chưa commit; các thay đổi đó được giữ nguyên và không bị reset.

### Quy ước trạng thái

- **Đạt một phần**: đã có luồng lõi hoặc endpoint nhưng còn thiếu Acceptance Criteria, bằng chứng hoặc hardening để nghiệm thu.
- **Thiếu**: chưa có luồng bắt buộc hoặc không thể chứng minh đang hoạt động.
- **Đạt lõi**: có thể dùng cho demo nền tảng, nhưng chưa đồng nghĩa đạt toàn bộ BA.
- **Thừa/ngoài BA API**: endpoint hoặc chức năng hiện có nhưng không được liệt kê trong bảng API BA; không tự động có nghĩa là phải xóa.
- **Không kiểm chứng**: tài liệu hoặc code có mô tả nhưng chưa có test/runtime evidence.
- **Thay thế MVP được chấp nhận**: đổi cách triển khai nhưng vẫn giữ được mục tiêu demo; phải ghi rõ trong API/report.
- **Thay thế tạm thời**: dùng được ở local/demo nhưng phải có technical debt và điều kiện hoàn thành trước pilot/production.
- **Không tương đương**: cách hiện tại không đáp ứng cùng yêu cầu BA; không được đánh dấu hoàn thành.

## 2. Kết luận điều hành

### 2.1. Kết luận nghiệm thu

**Chưa đủ để nghiệm thu BA Final.** Repository đã có phần lõi của hệ thống điểm danh: Auth/RBAC, CRUD đào tạo, đăng ký nhiều frame khuôn mặt, roster theo lớp, cosine matching, capture ảnh từ RTSP theo chu kỳ, cập nhật AttendanceLog, bằng chứng crop, Socket.IO, đơn nghỉ, lịch sử và audit cơ bản.

Đối chiếu nghiêm theo 21 user story chi tiết trong BA:

| Mức | Số lượng | Nhận xét |
|---|---:|---|
| Đạt đầy đủ toàn bộ AC | 0 | Chưa user story nào có đủ toàn bộ AI, UI, API, lưu trữ và QA evidence theo BA |
| Đạt một phần | 17 | Có nền tảng hoặc luồng lõi nhưng thiếu AC quan trọng |
| Thiếu | 4 | Thiếu hẳn hoặc chưa có contract/flow triển khai |
| Tổng | 21 | BA nói 25 user stories nhưng phần chi tiết hiện đếm được 21 |

Các khác biệt triển khai không được gộp chung với “thiếu chức năng”. Report có **17 điểm thay thế/khác biệt** được phân loại riêng:

| Loại thay thế | Số điểm | Cách hiểu |
|---|---:|---|
| Chấp nhận được cho MVP | 9 | Có thể giữ nếu team cập nhật BA/API và QA test đúng contract mới |
| Tạm thời, phải ghi nợ kỹ thuật | 7 | Dùng được cho demo/local, chưa được dùng để tuyên bố production-ready |
| Không tương đương hoặc còn thiếu | 1 | Phải triển khai thêm hoặc xin BA xác nhận loại khỏi phạm vi |

### 2.2. Bốn blocker lớn nhất

1. **Liveness mới ở mức thử thách tư thế**: flow quay trái/phải đã có và phù hợp MVP; chưa phải anti-spoof chuyên dụng để chặn mọi ảnh/video replay, cũng chưa có ArcFace/FAISS production như BA.
2. **RTSP 30 FPS là rủi ro hạ tầng và chưa nên cam kết**: backend hiện đọc frame theo capture loop; nếu MVP chỉ cần snapshot theo checkpoint thì phải ghi rõ đây là quyết định phạm vi, không gọi là AI live 30 FPS.
3. **Đang thay thế 4 mốc cố định bằng checkpoint sau giờ nghỉ**: đây là hướng nghiệp vụ hợp lý hơn để phát hiện người rời lớp, nhưng cần chốt state machine và số checkpoint cuối buổi.
4. **eKYC/re-eKYC được giản lược cho MVP**: reset xóa enrollment để người dùng đăng ký lại đã có; chưa phải quy trình re-eKYC có lý do, hồ sơ và admin approve/reject như BA đầy đủ.

### 2.3. Phần đã đủ cho demo nền tảng

- Đăng nhập JWT, role guard và route tách theo `admin`, `teacher`, `student`.
- Admin quản lý phòng, camera metadata, ping camera, người dùng, khoa, môn, lớp học phần, enrollment và session.
- Student enrollment sử dụng nhiều frame front/left/right, lưu các ảnh enrollment và reset biometric ở admin.
- AI match trong roster của session, trả `MATCHED`, `UNKNOWN_PERSON` hoặc `AMBIGUOUS`, cosine score, bbox và crop.
- Teacher start/capture/end session, cập nhật điểm danh, nhận unknown event, xem evidence và override có reason.
- Student xem dashboard, attendance history, evidence và biometric profile.
- Leave request cơ bản, teacher review, report matrix và audit list cơ bản.

## 3. Vấn đề nội tại của tài liệu BA cần chốt trước khi QA

| Mã | Phát hiện | Tác động | Quyết định đề nghị |
|---|---|---|---|
| BA-01 | Tài liệu ghi 25 user stories nhưng phần detailed backlog đếm được 21: ADM 3, ATT 8, SEC 3, PORTAL 5, REP 2. | QA không biết phải test 21 hay 25 story. | Dùng 21 detailed story làm acceptance baseline; 4 story còn lại nếu có phải được đặt ID riêng. |
| BA-02 | Một file chứa Version 6.0 Final, Version 6.2 Final và Version 5.0 Final. | Có thể lấy nhầm yêu cầu cũ hoặc roadmap làm AC bắt buộc. | Chốt một phiên bản duy nhất; các đoạn cũ đánh dấu `historical`, không dùng làm acceptance. |
| BA-03 | BA vừa nói “đồng bộ 100%” vừa có roadmap Sprint 1–4 và các hạng mục ghi “chờ Sprint 2/3”. | Không thể dùng đồng thời như sản phẩm hoàn tất và roadmap. | Tách `BA Acceptance` khỏi `Roadmap`; report này dùng AC đầy đủ, sprint chỉ để tham khảo. |
| BA-04 | Bảng API student thiếu `GET /student/attendance-history`, `GET /student/evidence/:id`, `GET /student/biometric-profile`, trong khi user story yêu cầu các chức năng này. | API review có thể đánh dấu nhầm endpoint hiện có là thừa. | Bổ sung chúng vào API contract chính thức. |
| BA-05 | Bảng API teacher thiếu `GET /teacher/leave-requests`, dù US-ATT-07 yêu cầu hub đơn nghỉ của giáo viên. | Không đủ API để dựng màn hình teacher. | Bổ sung vào spec. |
| BA-06 | BA dùng role `SYSTEM_AI`, nhưng Prisma chỉ có `ADMIN`, `TEACHER`, `STUDENT`; AI hiện xác thực bằng internal key. | Không rõ AI là user, service principal hay machine credential. | Giữ AI là service-to-service identity, không đưa vào human RBAC; ghi rõ trong security contract. |
| BA-07 | BA dùng `video_file` cho enroll, code hiện dùng `frames[]`. | FE/BE/AI không thống nhất multipart contract. | Chọn một contract. Với MVP hiện tại nên giữ `frames[]` nhiều ảnh; nếu cần video thì thêm endpoint versioned riêng. |
| BA-08 | BA ghi `GET /student/schedule`, code hiện lấy calendar qua `GET /student/dashboard?weekStart=...`. | FE route và API route bị hiểu là một. | Ghi rõ UI path và API path độc lập; nếu cần, thêm API schedule riêng. |
| BA-09 | BA yêu cầu response envelope có `meta`; nhiều controller hiện trả `{ success, data }`, còn lỗi dùng `REQUEST_FAILED`. | Client và QA không có một error contract ổn định. | Chuẩn hóa envelope/error code trước khi đóng API v1. |
| BA-10 | BA nêu “camera 30 FPS”, nhưng flow nghiệp vụ hiện tại là capture ảnh định kỳ. | “Live stream” và “AI inference frequency” bị đánh đồng. | Tách `video preview FPS` khỏi `AI sampling interval`; MVP có thể dùng snapshot, nhưng phải ghi rõ. |

## 4. Ma trận đầy đủ 21 User Story

### EPIC 1 — Admin

| ID | BA yêu cầu chính | Bằng chứng hiện tại | Trạng thái | Thiếu / tiêu chí QA cần bổ sung |
|---|---|---|---|---|
| US-ADM-01 | Login bcrypt/JWT, redirect theo role, onboarding student, RBAC 403. | `backend/src/routes/auth.routes.ts:13`; `backend/src/middlewares/auth.middlewares.ts:12`; route shell ở `frontend/src/App.tsx`. | Đạt một phần | `requireFaceEnrolled` tồn tại nhưng chưa mount vào route; access token mặc định dài; cần test mọi tổ hợp role/resource và redirect onboarding. |
| US-ADM-02 | CRUD phòng, cấu hình RTSP/IP, ping latency/packet loss/FPS, preview RTSP 30 FPS, schedule camera. | `backend/src/routes/admin.routes.ts:42`; `backend/src/services/classroom.service.ts`; admin UI `frontend/src/components/admin/AdminClassrooms.tsx`. | Đạt một phần | Có metadata/ping nhưng chưa chứng minh live RTSP player, 30 FPS HUD, main/sub stream và bật/tắt theo lịch. |
| US-ADM-03 | Trung tâm biometric SV/GV, KPI, import 3 Excel, detail vector/score/ảnh CCTV, re-eKYC review. | `backend/src/routes/admin.routes.ts:25`; `backend/src/services/biometric.service.ts`; `backend/src/services/import.service.ts`. | Đạt một phần | Chưa có teacher eKYC, comparison/review re-eKYC, FAISS persistent; import chưa có preview/dry-run contract hoàn chỉnh; CCTV detail đang thiếu dữ liệu thật. |

### EPIC 2 — Teacher

| ID | BA yêu cầu chính | Bằng chứng hiện tại | Trạng thái | Thiếu / tiêu chí QA cần bổ sung |
|---|---|---|---|---|
| US-ATT-01 | Lịch dạy tuần dạng grid Mon–Sun, card lớp/ca/phòng/trạng thái, click vào session. | `backend/src/services/teacher.service.ts:16`; `frontend/src/components/teacher/TeacherSchedule.tsx`. | Đạt một phần | Có lịch và route nhưng chưa xác nhận đủ grid/calendar, filter tuần, trạng thái theo thời gian và dữ liệu nhiều ca theo AC. |
| US-ATT-02 | RTSP live 30 FPS, OSD sĩ số, bbox, WebSocket realtime, snapshot 15/30/45/60. | `backend/src/services/teacher-session.service.ts:42`; `backend/src/routes/teacher.routes.ts:19`; `ai-service/main.py:372`. | Đạt một phần | Hiện là capture từng ảnh bằng loop; `TeacherScan` còn placeholder video; chưa có 30 FPS live, state machine 15 phút đầu, re-check sau nghỉ và auto snapshots đúng mốc. |
| US-ATT-03 | Drawer danh sách 4 trạng thái, 5 filter, avatar/time/4 snapshot, manual override audit. | `frontend/src/components/teacher/TeacherScan.tsx:136`; `backend/src/services/teacher-session.service.ts:190`. | Đạt một phần | Có bảng/override nhưng thiếu đủ filter chip, 4 snapshot per student, semantics `UNCONFIRMED/PRESENT/LATE/ABSENT/TRUANT/EXCUSED` hiển thị rõ và negative tests. |
| US-ATT-04 | Duyệt đơn nghỉ nhanh trong session, xem file, approve/reject. | `backend/src/routes/teacher.routes.ts:25`; `backend/src/services/teacher-workspace.service.ts`. | Đạt một phần | Có list/review cơ bản; cần kiểm tra attachment access, mapping approved → EXCUSED, audit review và route FE đã nối đủ chưa. |
| US-ATT-05 | Modal đối soát 4 snapshot ở 15/30/45/60, bbox/score, download. | `backend/src/routes/teacher.routes.ts:21`; `frontend/src/components/teacher/TeacherScan.tsx:185`. | Đạt một phần | Chỉ có capture/ảnh trả về theo flow hiện tại; thiếu endpoint list snapshots, exact milestones, download authorization và 4 ảnh ổn định. |
| US-ATT-06 | Matrix 15 buổi, KPI/filter, 5 trạng thái, cảnh báo cấm thi >20%, export. | `backend/src/routes/teacher.routes.ts:27`; `backend/src/services/teacher-workspace.service.ts`; `frontend/src/components/teacher/TeacherReports.tsx`. | Đạt một phần | Có matrix và tỷ lệ cơ bản; thiếu export Excel/PDF, kiểm chứng công thức theo session, trạng thái TRUANT và warning/UI cấm thi đầy đủ. |
| US-ATT-07 | Hub đơn nghỉ teacher, KPI/table/detail attachment/approve/reject. | `backend/src/routes/teacher.routes.ts:25`; `frontend/src/components/teacher/TeacherLeaveRequests.tsx`. | Đạt một phần | Endpoint/UI cơ bản có; cần audit review, filter/paging, file authorization và empty/error states. |
| US-ATT-08 | Hồ sơ/eKYC teacher, ArcFace score/threshold, update face, loại trừ GV khỏi intruder. | Chưa có route eKYC teacher; `backend/src/routes/ekyc.routes.ts:9` chỉ cho STUDENT. | Thiếu | Thêm teacher enrollment/reset/re-eKYC, đưa teacher vào roster loại trừ hoặc role-aware recognition; test GV lọt camera không bị UNKNOWN. |

### EPIC 3 — AI và Security

| ID | BA yêu cầu chính | Bằng chứng hiện tại | Trạng thái | Thiếu / tiêu chí QA cần bổ sung |
|---|---|---|---|---|
| US-SEC-01 | Video 3s liveness, chọn frame nét, ArcFace 512D, FAISS. | `ai-service/main.py:193`, `ai-service/main.py:267`; `facenet_pytorch` + cosine; FE `frontend/src/components/student/Enrollment.tsx:128`. | Đạt một phần | Pose/tracking enrollment có nhưng pose không phải liveness; chưa có anti-spoof, ArcFace contract, FAISS index persistent, duplicate-face rejection và model version/evaluation. |
| US-SEC-02 | Roster matching, unknown dưới threshold, crop/log, cảnh báo đỏ, loại trừ teacher. | `ai-service/main.py:312`, `ai-service/main.py:367`; `backend/src/services/teacher-session.service.ts:117`; Socket.IO. | Đạt một phần | Roster-scoped cosine/unknown/crop đã có; chưa có teacher eKYC/role-aware exclusion hoàn chỉnh, security log riêng và policy chống một mặt đăng ký nhiều account cần test. |
| US-SEC-03 | Tính vắng và cảnh báo cấm thi >20%, dashboard/banner. | `backend/src/services/teacher-workspace.service.ts` report matrix. | Đạt một phần | Có tính tỷ lệ ở report nhưng chưa thấy luồng cảnh báo toàn hệ thống, admin/student notification, kỳ học và edge case vắng có phép. |

### EPIC 4 — Student Portal

| ID | BA yêu cầu chính | Bằng chứng hiện tại | Trạng thái | Thiếu / tiêu chí QA cần bổ sung |
|---|---|---|---|---|
| US-PORTAL-01 | Khóa onboarding lần đầu, webcam 3 bước/3s, thành công mới vào dashboard. | FE enrollment `frontend/src/components/student/Enrollment.tsx`; auth trả `isFaceEnrolled`. | Thiếu | Có màn hình enroll nhưng chưa chặn toàn bộ student route ở middleware/App; cần test deep-link khi chưa enroll và refresh session. |
| US-PORTAL-02 | Dashboard donut/KPI/course/warning. | `backend/src/routes/student.routes.ts:9`; `frontend/src/components/student/StudentDashboard.tsx`. | Đạt một phần | Có dashboard/calendar/KPI cơ bản; thiếu xác nhận donut, warning vắng/muộn/eKYC và trạng thái realtime theo BA. |
| US-PORTAL-03 | Calendar tuần, lịch sử 15 buổi, 4 snapshot/student, modal realtime và download. | `backend/src/routes/student.routes.ts:10`; `backend/src/routes/student.routes.ts:13`; `frontend/src/components/student/StudentDashboard.tsx`. | Đạt một phần | History/evidence đã có; chưa đủ 4 mốc, download/ownership test, realtime modal và giới hạn/ phân trang 15 buổi theo AC. |
| US-PORTAL-04 | Nộp đơn nghỉ/muộn kèm file, theo dõi trạng thái. | `backend/src/routes/student.routes.ts:11`; `frontend/src/components/student/StudentLeaveRequests.tsx`. | Đạt một phần | Backend có CRUD cơ bản nhưng component chưa được route/menu đầy đủ trong `frontend/src/App.tsx`; cần session selector, validate file, withdraw/status lifecycle. |
| US-PORTAL-05 | Hồ sơ biometric và 3 bước re-eKYC/update face, chờ admin duyệt. | `backend/src/routes/student.routes.ts:14`; `frontend/src/components/student/StudentBiometricProfile.tsx`. | Thiếu | Chỉ có profile/read; thiếu submit request, card/reason/video, pending/reject reason và admin review. |

### EPIC 5 — Reports và Audit

| ID | BA yêu cầu chính | Bằng chứng hiện tại | Trạng thái | Thiếu / tiêu chí QA cần bổ sung |
|---|---|---|---|---|
| US-REP-01 | Report matrix toàn trường, exam-ban, export `.xlsx`/`.pdf`. | `backend/src/routes/admin.routes.ts:22`; `backend/src/services/admin-ops.service.ts`; teacher matrix route. | Đạt một phần | Admin report hiện thiên về JSON/CSV; chưa có XLSX/PDF, filter đầy đủ theo kỳ/lớp/môn/SV và exam-ban export. |
| US-REP-02 | Audit log KPI/filter/detail, before/after, CCTV evidence, read-only. | `backend/src/routes/admin.routes.ts:21`; `backend/src/services/admin-ops.service.ts`; Prisma `SystemAuditLog`. | Đạt một phần | Có list/paging và audit override/reset; thiếu detail endpoint, filter actor/action/date/resource, CCTV evidence liên kết và kiểm tra immutable/read-only. |

## 5. Đối chiếu API BA với API hiện tại

### 5.1. API BA đã có hoặc có biến thể tương đương

| BA endpoint | API hiện tại | Trạng thái | Ghi chú |
|---|---|---|---|
| `POST /api/v1/auth/login` | Có | Đạt lõi | Auth route tương thích; cần chốt response/TTL. |
| `POST /api/v1/ekyc/enroll-initial` | Có | Lệch contract | Code nhận multipart `frames[]` tối đa 12; BA mô tả `video_file`. |
| `GET /api/v1/admin/classrooms` | Có | Đạt lõi | Có list/filter/paging. |
| `POST /api/v1/admin/classrooms` | Có | Đạt lõi | CRUD metadata. |
| `PUT /api/v1/admin/classrooms/{id}` | Có | Đạt lõi | Cần test camera URL validation. |
| `POST /api/v1/admin/classrooms/{id}/ping-camera` | Có | Đạt một phần | Có thêm legacy `POST /admin/classrooms/ping-camera`; cần chọn một contract. |
| `GET /api/v1/admin/biometrics` | Có | Đạt một phần | Có list/KPI; thiếu đầy đủ GV/re-eKYC/FAISS. |
| `POST /api/v1/admin/import/excel-bundle` | Có | Đạt một phần | Có parse/transaction cơ bản; thiếu preview/dry-run/template response/định nghĩa rollback rõ. |
| `GET /api/v1/admin/biometrics/{user_id}` | Có | Đạt một phần | Có detail enrollment; CCTV và master/vector fields chưa hoàn chỉnh. |
| `GET /api/v1/admin/audit-logs` | Có | Đạt một phần | Có search/page/limit; thiếu filter như BA. |
| `GET /api/v1/teacher/schedule` | Có | Đạt lõi | Cần test calendar/week boundary. |
| `GET /api/v1/teacher/sessions/{id}` | Có | Đạt lõi | Có detail/counts/student list. |
| `POST /api/v1/teacher/sessions/{id}/trigger-snapshot` | Có | Đạt một phần | Trigger capture có; chưa có snapshot schedule/list contract. |
| `PUT /api/v1/teacher/sessions/{id}/attendance/{student_id}/override` | Có | Đạt một phần | Có reason và audit; cần status whitelist/negative tests. |
| `POST /api/v1/teacher/sessions/{id}/quick-approve-leave` | Có | Đạt một phần | Có review cơ bản; cần attachment/audit contract. |
| `GET /api/v1/teacher/reports/matrix` | Có | Đạt một phần | Có matrix; thiếu export/đầy đủ KPI. |
| `GET /api/v1/student/dashboard` | Có | Đạt lõi | UI path khác API path. |
| `POST /api/v1/student/leave-requests` | Có | Đạt một phần | Có multipart attachment; cần lifecycle/validation. |
| `GET /api/v1/student/attendance-history` | Có nhưng BA API table bỏ sót | Đạt lõi | Bổ sung vào spec chính thức. |
| `GET /api/v1/student/evidence/{evidenceId}` | Có nhưng BA API table bỏ sót | Đạt một phần | Có ownership check; cần test signed/private storage. |
| `GET /api/v1/student/biometric-profile` | Có nhưng BA API table bỏ sót | Đạt một phần | Read profile; chưa có re-eKYC submit. |

### 5.2. API BA yêu cầu nhưng hiện thiếu hoặc chưa đúng

| BA endpoint/contract | Hiện trạng | Mức | Việc cần làm |
|---|---|---|---|
| `GET /api/v1/admin/biometrics/re-ekyc-requests/{id}/comparison` | Chưa có route | P0 | Thêm comparison trả ảnh thẻ/enrollment/request/video metadata theo quyền Admin. |
| `POST /api/v1/admin/biometrics/re-ekyc-requests/{id}/review` | Chưa có route | P0 | Approve/reject, reason bắt buộc, transaction, audit, cập nhật vector/index. |
| `GET /api/v1/admin/audit-logs/{id}` | Chưa có route detail | P1 | Trả before/after, actor, resource, evidence; read-only. |
| `GET /api/v1/teacher/sessions/{id}/snapshots` | Chưa có route | P0 | Trả 15/30/45/60, crop mapping, timestamp, status và access control. |
| `POST /api/v1/student/re-ekyc/submit` | Chưa có route | P0 | Multipart card/reason/video hoặc frames; trạng thái pending/rejected/approved. |
| `POST /api/v1/ai/ekyc/liveness-and-vector` | Chưa có public/internal contract đúng BA | P0 | Chốt service-to-service endpoint, liveness result, vector/model version, quality and evidence. |
| `POST /api/v1/ai/sessions/{sessionId}/instant-snapshot` | Chưa có endpoint AI tương ứng | P1 | Tách instant capture khỏi backend orchestration hoặc ghi rõ backend proxy. |
| AI background worker RTSP 30 FPS + tracker | Hiện capture một frame theo timer, không ByteTrack/BoT-SORT | P0 | Chốt MVP snapshot sampling trước; không gọi là 30 FPS AI nếu chưa có stream/tracker. |
| `video_file` enrollment | Code dùng `frames[]` | P1 | Chốt một schema và cập nhật BA, OpenAPI, FE, BE, AI cùng lúc. |

### 5.3. API hiện có nhưng chưa được BA API table liệt kê

Các endpoint sau là phần mở rộng hữu ích, không nên xóa nếu FE/BE đang dùng:

- Auth: `POST /auth/refresh`, `GET /auth/me`, `POST /auth/change-password`.
- Admin overview/health: `GET /admin/overview`, `GET /admin/health`.
- Admin academic CRUD: users, departments, courses, course classes, enrollments, sessions.
- Teacher lifecycle: `POST /teacher/sessions/{id}/start`, `POST /teacher/sessions/{id}/end`, `GET /teacher/sessions/{id}/evidence/{evidenceId}`, `GET /teacher/leave-requests`.
- Student read APIs: history, evidence, biometric profile, face preview, leave list.
- AI internal APIs: `/internal/v1/pose`, `/internal/v1/enrollments`, roster load/delete, recognition và capture.

### 5.4. Contract/API risk cần sửa trước khi merge

1. **Envelope**: BA yêu cầu `{ success, statusCode, message, data, meta }`; code nhiều nơi chỉ trả `{ success, data }`. Chọn một schema và cập nhật OpenAPI/FE client.
2. **Error code**: BA có `FACE_NOT_ENROLLED`, `SESSION_NOT_LIVE`, `CAMERA_OFFLINE`, `OVERRIDE_REASON_REQUIRED`, `DUPLICATE_IMPORT_RECORD`; global handler hiện có thể trả `REQUEST_FAILED`. Cần map lỗi nghiệp vụ thành code ổn định.
3. **Multipart limits**: `express.json/urlencoded` là 10 MB, còn upload frames/video có thể lớn hơn; phải cấu hình giới hạn riêng, nén/resize và trả lỗi 413 có hướng dẫn.
4. **AI boundary**: không mở internal AI route ra frontend; chỉ backend gateway gọi bằng service key/mTLS/network policy.
5. **Authorization**: student chỉ xem evidence/session của chính mình; teacher chỉ session được phân công; admin không được dùng endpoint student để vượt scope.
6. **URL/path**: frontend route `/student`, `/student/attendance`, `/teacher/attendance/:id`, `/admin/...` không phải API path; tài liệu phải ghi tách rõ UI route và API route.

## 6. Đối chiếu data model và persistence

### Đã có

- `User`, `Department`, `Course`, `CourseClass`, `CourseEnrollment`, `ClassSession`.
- `AttendanceLog` có các trạng thái `UNCONFIRMED`, `PRESENT`, `LATE`, `ABSENT`, `TRUANT`, `EXCUSED`.
- `SessionProofSnapshot`, `SessionFaceDetection`, `LeaveRequest`, `UserEnrollmentImage`, `UserBiometric`, `BiometricUpdateRequest`, `SystemAuditLog`.
- Period table 1–13 ở `backend/src/utils/study-periods.ts`, phù hợp lịch ca học đã chốt.
- Có migration lưu nhiều ảnh enrollment trong working tree.

### Còn thiếu hoặc rủi ro

| Rủi ro | Hiện trạng | Đề xuất QA/BE |
|---|---|---|
| Roster AI mất sau restart | AI giữ `ROSTERS` trong memory; có `gallery.npz`, chưa có FAISS/index lifecycle. | Rebuild roster từ DB khi start session hoặc lưu index versioned; test restart giữa buổi. |
| Camera/session trùng | Có kiểm tra application-level; schema chưa có unique constraint đủ mạnh cho race condition. | Transaction + constraint/idempotency; test hai request đồng thời cùng phòng/ca. |
| Snapshot milestone | Service tạo milestone theo phút phát hiện, không đảm bảo đúng 15/30/45/60. | Tạo checkpoint enum/unique `(sessionId, milestone)` và job scheduler rõ ràng. |
| Attendance state | End session chuyển `UNCONFIRMED` thành `ABSENT`, nhưng chưa có đầy đủ rule re-check/truant theo BA. | Chốt state machine và bảng transition; test boundary 0/15/20/30 phút. |
| File storage | Evidence đang mount local `runtime/evidence`; BA yêu cầu storage riêng production. | Dùng storage adapter S3/MinIO-compatible; private URL/signed URL/retention job. |
| Biometric duplicate | Có cờ `isFaceEnrolled`, nhưng duplicate cross-account/face identity policy chưa được chứng minh. | AI/BE kiểm tra similarity với toàn bộ active enrolled vector trong enrollment, transaction và audit. |
| Model metadata | Có model name/vector ID dạng metadata; chưa có model hash, threshold config, embedding normalization/version. | Persist `modelVersion`, `embeddingDimension`, `threshold`, `quality`, `createdAt`. |

## 7. Ma trận QA tối thiểu để xác nhận “đủ chức năng”

### P0 — phải pass trước khi demo nghiệm thu

| Nhóm | Kịch bản bắt buộc | Kết quả mong đợi |
|---|---|---|
| Auth/RBAC | Login đúng/sai; mỗi role gọi endpoint của role khác; token thiếu/hết hạn; deep-link student chưa eKYC. | 401/403 đúng code; không lộ data; student bị khóa onboarding. |
| Enrollment | 8–12 frames front/left/right; mặt mờ; không có mặt; 2 mặt; đăng ký lại cùng account; cùng mặt đăng ký account thứ hai. | Chỉ nhận dữ liệu hợp lệ; chặn duplicate; lỗi có mã và reason; transaction không để dữ liệu nửa chừng. |
| Roster | SV lớp A, SV lớp B, GV, người lạ trong cùng ảnh. | Chỉ SV roster A được match; B/GV/người lạ là `UNKNOWN_PERSON` hoặc được loại trừ theo policy GV; crop/evidence đúng người. |
| Session lifecycle | Start trước giờ, trong 15 phút đầu, sau 15 phút, sau giờ nghỉ, end đúng giờ, end sớm. | State và late cutoff chính xác; cảnh báo end sớm; không tạo duplicate attendance. |
| Camera/AI fault | RTSP offline, AI timeout, frame lỗi, AI restart giữa session. | Retry/backoff; session `DEGRADED`; thông báo GV; không mất toàn bộ kết quả đã lưu. |
| Evidence | GV/student/admin xem đúng scope; snapshot thiếu/ảnh hỏng; crop unknown. | Không truy cập chéo; trả empty/error rõ; evidence lưu đúng session/student/timestamp. |
| Leave/override | Student nộp file; teacher approve/reject; override status thiếu reason; approve sau khi đã absent. | Validate file; EXCUSED mapping; reason bắt buộc; audit before/after. |
| Import | File sai cột, duplicate code, relation không tồn tại, conflict phòng/ca, file lớn, lỗi giữa transaction. | Preview lỗi; không ghi partial; rollback hoặc báo rõ row-level; import lại idempotent. |
| Schedule | Cùng phòng trùng ca; cùng GV trùng ca; cùng lớp học phần nhiều ngày/nhiều ca; khác phòng cùng ca. | Chặn đúng conflict; cho phép khác phòng; period start/end canonical. |

### P1 — phải có trước pilot

- Teacher eKYC và re-eKYC admin review.
- Snapshot API 15/30/45/60 và student history 4 ảnh.
- XLSX/PDF report, exam-ban report, audit detail/CCTV evidence.
- Paging/search/filter đầy đủ cho mọi danh sách và dropdown lớn.
- Private object storage, retention, signed URL, backup/restore.
- Socket.IO reconnect, room authorization, duplicate event/idempotency.
- Responsive FE cho desktop/tablet/mobile và camera permission/HTTPS.

### P2 — production hardening

- Queue/background worker cho RTSP/AI jobs và giới hạn concurrency.
- Metrics: inference latency, FPS, queue depth, camera health, match/unknown rate.
- Load test 1/10/50/100 phòng; rate limit theo user/service; tracing/log correlation.
- Model evaluation set: front/left/right, nghiêng 90°, khẩu trang, kính, ánh sáng, nhiều mặt, ảnh/video replay.
- Model registry/model hash/rollback và threshold calibration theo validation set.

## 8. Phân công file/module đề xuất

| Owner | File/module nên chỉnh | Phạm vi |
|---|---|---|
| BE/Auth | `backend/src/middlewares/auth.middlewares.ts`, `backend/src/services/auth.service.ts`, `backend/src/app.ts` | Onboarding guard, token TTL, error/envelope, RBAC negative tests. |
| BE/Academic | `backend/src/services/admin-academic.service.ts`, `backend/src/services/import.service.ts`, `backend/src/routes/admin.routes.ts`, `backend/prisma/schema.prisma` | Conflict/race/idempotency, import preview/rollback, schedule/period contract. |
| BE/Attendance | `backend/src/services/teacher-session.service.ts`, `backend/src/services/teacher-workspace.service.ts`, `backend/src/routes/teacher.routes.ts` | State machine, checkpoint 15/30/45/60, retry/degraded, early-end/recheck/truant. |
| BE/Biometric | `backend/src/services/ekyc.service.ts`, `backend/src/services/biometric.service.ts`, `backend/src/routes/ekyc.routes.ts`, `backend/src/routes/student.routes.ts`, `backend/src/routes/admin.routes.ts` | Teacher eKYC, re-eKYC, duplicate-face policy, evidence access, admin review. |
| AI | `ai-service/main.py`, `ai-service/requirements.txt`, `ai-service/Dockerfile`, `backend/src/services/ai-client.service.ts` | Liveness, model/version contract, persistent roster/index, quality/threshold, service auth. |
| Realtime | `backend/src/realtime/socket.ts`, `frontend/src/components/teacher/TeacherScan.tsx` | Room authorization, reconnect, live/snapshot distinction, event schema. |
| FE | `frontend/src/App.tsx`, `frontend/src/components/student/*`, `frontend/src/components/teacher/*`, `frontend/src/components/admin/*` | Route guard, missing leave/re-eKYC/report screens, live stream UI, filters, evidence. |
| Storage/Ops | `docker-compose.yml`, runtime/storage adapter, environment config | Postgres migration, object storage, queue, health/metrics, backup/restore. |
| QA | `docs/BA_FINAL_VS_CURRENT_IMPLEMENTATION_QA_REPORT.md` + test repository | Contract tests, RBAC matrix, boundary tests, integration/E2E/load evidence. |

## 9. Thứ tự triển khai đề nghị

### Giai đoạn 1 — chốt MVP điểm danh có thể demo

1. Chốt BA contract: 21 story, response/error envelope, `frames[]` hay `video_file`, snapshot semantics.
2. Hoàn thiện onboarding guard, roster-scoped matching, duplicate-face policy và evidence ownership.
3. Hoàn thiện session state machine: start, 15 phút đầu, late, checkpoint, end, absent, early-end warning.
4. Làm teacher scan ở mức **snapshot realtime** ổn định; chỉ gọi “live 30 FPS” sau khi có video stream thật.
5. Thêm teacher eKYC hoặc ít nhất teacher exclusion rõ ràng trước khi pilot nhiều người trong camera.
6. Chạy P0 QA và lưu evidence cho từng case.

### Giai đoạn 2 — hoàn thiện BA portal/report

1. Re-eKYC student → admin comparison/review.
2. Snapshot list 4 mốc, student evidence/history và leave flow hoàn chỉnh.
3. XLSX/PDF report, exam-ban warning, audit detail/CCTV evidence.
4. Import preview/template/row error/rollback và paging/filter chuẩn.

### Giai đoạn 3 — production

1. Anti-spoof/liveness được benchmark trên validation set.
2. Persistent vector index hoặc vector database; không phụ thuộc `ROSTERS` memory.
3. Queue/worker, object storage, backup, monitoring, load test nhiều phòng.

## 10. Acceptance gate cuối cùng

Chỉ đánh dấu “BA Final complete” khi đồng thời thỏa các điều kiện sau:

- 21/21 user story có test case và evidence, không còn P0 blocker.
- Tất cả BA endpoint hoặc được implement, hoặc có quyết định loại bỏ được ghi trong API change report.
- FE route, API route, WebSocket event và AI internal contract khớp tên, payload, lỗi và quyền.
- Test roster chứng minh người ngoài lớp là `UNKNOWN_PERSON`; không dùng gallery toàn trường để nhận nhầm người vào lớp.
- Test enrollment chứng minh một người không thể đăng ký cho hai account; reset phải có quyền và audit.
- Test session chứng minh đúng rule đi học/muộn/vắng/có phép, snapshot/checkpoint và early-end.
- Test evidence chứng minh GV xem được bằng chứng lớp, SV chỉ xem được bằng chứng của chính mình.
- Build/typecheck/backend integration và E2E pass trên Postgres thật; không chỉ chạy với mock/local disk.
- Các điểm chưa làm được được đánh dấu rõ là `deferred`, không ghi “đã hoàn thành 100%”.

## 11. Tóm tắt để gửi team

Bản hiện tại **không thiếu nền tảng**, nhưng đang ở mức **core demo / pre-pilot**, chưa phải BA Final hoàn chỉnh. Phần cần ưu tiên không phải thêm UI mới trước, mà là chốt contract và làm chắc 4 trục: **roster-scoped recognition, session state machine, evidence ownership, RBAC/error contract**. Sau đó mới bổ sung anti-spoof chuyên dụng, re-eKYC có phê duyệt, teacher exclusion, export và production infrastructure.

Các tài liệu cũ như `docs/backend_missing_features.md` và các report lịch sử không nên dùng làm source of truth nếu mâu thuẫn với code hiện tại hoặc BA Final. File này là baseline đối chiếu cho QA và review tiếp theo; mỗi thay đổi sau này nên cập nhật thêm bảng API/status và acceptance evidence tương ứng.

## 12. Những điểm đã thay thế so với BA

Phần này phân biệt rõ ba trường hợp:

- **Thay thế hợp lý**: đổi cách triển khai nhưng vẫn giữ đúng mục tiêu nghiệp vụ.
- **Thay thế tạm thời cho MVP**: dùng được để demo, nhưng cần ghi nợ kỹ thuật.
- **Không tương đương**: tên gọi gần giống nhưng chưa đáp ứng cùng yêu cầu; không được đánh dấu hoàn thành.

| BA mô tả | Code hiện tại | Loại thay thế | Đánh giá và quyết định |
|---|---|---|---|
| Enrollment bằng một `video_file` 3 giây | FE chụp 8–12 frame theo các tư thế front/left/right và gửi multipart `frames[]` | Thay thế hợp lý cho MVP | Dễ kiểm tra từng ảnh, dễ lưu ảnh gốc và phù hợp flow Python hiện tại. Cần sửa BA/API spec để dùng `frames[]`, hoặc tạo endpoint video riêng sau này. |
| AI có role `SYSTEM_AI` | AI service dùng internal API key qua các route `/internal/v1/*`; chỉ BE gọi AI | Thay thế hợp lý | An toàn hơn việc cho AI thành tài khoản người dùng. Cần ghi rõ đây là service identity, không phải human role. |
| API AI công khai dưới `/api/v1/ai/*` | BE làm gateway, gọi AI bằng `AI_SERVICE_URL` và internal key | Thay thế hợp lý | Frontend không gọi thẳng AI, phù hợp phân quyền. Cần thống nhất payload và error contract giữa BE–AI. |
| ArcFace 512D + FAISS | `facenet-pytorch`/FaceNet tạo vector, NumPy cosine, roster trong memory và `gallery.npz` | Thay thế tạm thời cho MVP | Có thể demo recognition theo roster, nhưng chưa tương đương về model, tốc độ và persistence. Cần benchmark và thay bằng model/index production trước pilot. |
| FAISS lưu vector lâu dài | `UserBiometric` lưu metadata/vector ID; AI nạp roster khi session start và giữ `ROSTERS` trong memory | Thay thế tạm thời | Restart AI có thể mất roster runtime. Phải rebuild từ DB hoặc dùng FAISS/vector DB có version trước production. |
| RTSP live stream 30 FPS và AI xử lý realtime | AI mở RTSP, đọc một frame theo `AI_CAPTURE_INTERVAL_MS`, mặc định khoảng 5 giây; FE nhận event Socket.IO | Thay thế tạm thời | Đây là snapshot polling, không phải video live 30 FPS. Có thể dùng cho MVP ít phòng nếu BA chấp nhận; không được ghi là live 30 FPS. |
| Snapshot cố định tại 15/30/45/60 phút | Đề xuất checkpoint sau giờ nghỉ và lần cuối khi kết thúc buổi | Thay thế nghiệp vụ cho MVP | Phù hợp mục tiêu phát hiện SV rời lớp hơn 4 ảnh cố định; cần BA xác nhận số checkpoint, thời điểm và bằng chứng bắt buộc. |
| Một ảnh gốc enrollment | Backend lưu nhiều `UserEnrollmentImage` từ các frame enrollment; AI vẫn có preview crop | Thay thế hợp lý theo yêu cầu mới | Phù hợp yêu cầu lưu toàn bộ 8–12 ảnh. UI/admin phải hiển thị rõ số lượng và pose từng ảnh. |
| Bốn trạng thái hiển thị điểm danh | Schema có thêm `UNCONFIRMED`, `TRUANT`, `EXCUSED` ngoài `PRESENT`, `LATE`, `ABSENT` | Mở rộng hợp lý | Sáu trạng thái nội bộ phục vụ nghiệp vụ chi tiết. Cần chốt mapping trạng thái nào hiển thị cho giáo viên/sinh viên. |
| `/student/schedule` | Student calendar lấy qua `GET /student/dashboard?weekStart=...`; UI route là `/student` | Thay thế contract/path | Không sai nghiệp vụ nếu tài liệu ghi rõ UI route và API route khác nhau. Nếu cần tách module, thêm `GET /student/schedule`. |
| Camera tự bật trước giờ học theo lịch | Scheduler backend chạy mỗi 30 giây và auto-start session đến hạn | Thay thế một phần | Có auto-start nhưng chưa chứng minh bật camera trước 15 phút và chưa có worker nhiều camera. Với MVP một camera, cần chốt snapshot theo lịch thay vì cam kết RTSP 30 FPS. |
| Lưu ảnh lên Cloudinary/S3 | Lưu evidence vào local mount `runtime/evidence` | Thay thế tạm thời cho local demo | Dễ chạy Docker local nhưng không phù hợp production hoặc nhiều instance. Cần storage adapter và signed URL. |
| Liveness anti-spoof bằng video | Có pose detection/tracking, yêu cầu nhìn thẳng rồi quay trái/phải | Đạt liveness cơ bản cho MVP | Đây là active pose challenge giúp xác nhận người dùng đang tương tác; chưa phải anti-spoof chuyên dụng. Report/demo phải ghi rõ giới hạn này. |
| Giáo viên được nhận diện và loại trừ khỏi cảnh báo người lạ | Roster hiện chủ yếu nạp sinh viên đã enroll của lớp | Chưa có thay thế hoàn chỉnh | Cần teacher eKYC hoặc cơ chế teacher whitelist/role-aware matching trước khi camera có thể nhìn thấy giáo viên. |
| Re-eKYC có student submit và admin review | Admin reset enrollment; người dùng đăng ký lại từ đầu | Thay thế đơn giản cho MVP | Đáp ứng sửa mặt lỗi/đăng ký nhầm trong demo; chưa có hồ sơ yêu cầu, lý do và quy trình phê duyệt như re-eKYC đầy đủ. |
| Export Excel/PDF | Một số report trả JSON/CSV hoặc hiển thị trên FE | Thay thế tạm thời | Có thể dùng để debug/demo, nhưng chưa đáp ứng định dạng BA. |
| Import có preview lỗi trước khi ghi | Import service parse, cảnh báo và transaction khi ghi | Thay thế một phần | Có xử lý lỗi/rollback cơ bản nhưng chưa có API dry-run/preview chính thức và UI duyệt trước khi import. |

### 12.1. Các thay thế được chấp nhận ngay cho MVP

Nên chấp nhận tạm thời `frames[]`, internal AI gateway, service key, lưu nhiều ảnh enrollment, roster theo lớp và checkpoint sau giờ nghỉ. Đây là các thay đổi giúp giảm độ phức tạp nhưng vẫn chứng minh được bài toán điểm danh.

### 12.2. Các thay thế không được dùng để kết luận “đã đủ BA”

Không được xem pose challenge là anti-spoof production, checkpoint sau giờ nghỉ là live 30 FPS, NumPy memory roster là FAISS production, reset là re-eKYC approval, hoặc JSON/CSV là tương đương XLSX/PDF. Những phần này phải được ghi là `tạm thời`, `deferred` hoặc tiếp tục triển khai.

### 12.3. Mapping thay thế với User Story/API

Bảng này là phần team cần dùng khi review. Mỗi dòng có một quyết định rõ ràng, tránh việc QA thấy code khác BA rồi đánh dấu sai là “thiếu”, hoặc ngược lại đánh dấu “đạt” khi hai cách không tương đương.

| Mã | Liên quan | BA cũ | Cách hiện tại | Quyết định review |
|---|---|---|---|---|
| ALT-01 | US-SEC-01, `POST /ekyc/enroll-initial` | Một video 3 giây | Multipart `frames[]`, 8–12 ảnh front/left/right | **Chấp nhận MVP**; cập nhật spec và test số lượng/pose ảnh. |
| ALT-02 | US-ADM-01, AI auth | AI là role `SYSTEM_AI` | Internal service key, không phải human account | **Chấp nhận**; ghi rõ service identity và không cho FE gọi trực tiếp. |
| ALT-03 | US-SEC-01 | ArcFace 512D + FAISS | FaceNet + NumPy cosine + roster memory/`gallery.npz` | **Tạm thời**; phải benchmark, version model và persistence trước pilot. |
| ALT-04 | US-SEC-01 | FAISS index lưu lâu dài | `UserBiometric` lưu metadata, AI nạp roster khi start session | **Tạm thời**; restart AI phải rebuild roster an toàn hoặc dùng vector index thật. |
| ALT-05 | US-ATT-02 | AI live RTSP 30 FPS | Đọc một frame theo `AI_CAPTURE_INTERVAL_MS` | **Tạm thời**; gọi đúng là snapshot sampling, chưa gọi là AI live 30 FPS. |
| ALT-06 | US-ATT-05, US-SEC-02 | Snapshot đúng 15/30/45/60 phút | Checkpoint sau giờ nghỉ và lần cuối khi kết thúc buổi | **Chấp nhận MVP theo flow mới**; cần chốt rõ thời điểm, số lần, tolerance và ảnh bằng chứng bắt buộc. |
| ALT-07 | US-ATT-05, US-PORTAL-03 | Mỗi người có một ảnh gốc | Lưu nhiều `UserEnrollmentImage` | **Chấp nhận theo yêu cầu mới**; hiển thị đủ ảnh và pose. |
| ALT-08 | US-ATT-03, US-SEC-03 | Bốn trạng thái nghiệp vụ | Sáu trạng thái DB gồm `UNCONFIRMED`, `TRUANT`, `EXCUSED` | **Chấp nhận mở rộng**; phải có bảng mapping trạng thái hiển thị. |
| ALT-09 | US-PORTAL-03 | API `GET /student/schedule` | Calendar dùng `GET /student/dashboard?weekStart=...` | **Chấp nhận contract/path**; ghi rõ UI route và API route khác nhau. |
| ALT-10 | US-ADM-02, US-ATT-02 | Camera bật theo lịch, live stream | Scheduler auto-start session mỗi 30 giây; capture loop riêng | **Tạm thời**; MVP không cam kết AI 30 FPS, cần chốt snapshot interval và retry. |
| ALT-11 | US-SEC-01, US-ADM-03 | Liveness anti-spoof | Pose challenge: nhìn thẳng, quay trái, quay phải | **Chấp nhận MVP ở mức liveness cơ bản**; anti-spoof ảnh/video replay vẫn là giới hạn ngoài phạm vi hiện tại. |
| ALT-12 | US-ATT-08, US-SEC-02 | Teacher eKYC và loại trừ GV | Roster chủ yếu chỉ có SV của lớp | **Thiếu**, không phải thay thế; cần teacher enrollment/whitelist. |
| ALT-13 | US-PORTAL-05, US-ADM-03 | Re-eKYC có lý do, hồ sơ và admin review | Admin reset enrollment và đăng ký lại | **Chấp nhận MVP đơn giản**; chưa có workflow yêu cầu/phê duyệt re-eKYC. |
| ALT-14 | US-REP-01 | Export `.xlsx`/`.pdf` | JSON/CSV hoặc dữ liệu trên FE | **Tạm thời**; cần export đúng định dạng BA. |
| ALT-15 | US-ADM-03 | Import có preview trước khi ghi | Parse, warning và transaction khi ghi | **Đạt một phần/tạm thời**; thêm dry-run/preview và row-level errors. |
| ALT-16 | US-SEC-02 | Tìm người lạ toàn trường/AI security log | So sánh trực tiếp với roster của session | **Chấp nhận MVP**; đúng mục tiêu xác định người thuộc lớp, không cần xác định người lạ là ai. |
| ALT-17 | US-REP-02, evidence | Cloudinary/S3 | Local `runtime/evidence` mount | **Tạm thời local**; production cần object storage, signed URL và retention. |

### 12.4. Cách ghi trong report/demo sau khi thay thế

- Với `ALT-01`, `ALT-02`, `ALT-06`, `ALT-07`, `ALT-08`, `ALT-09`, `ALT-11`, `ALT-13`, `ALT-16`: ghi **đã chọn phương án MVP thay thế BA**, không ghi là thiếu.
- Với `ALT-03`, `ALT-04`, `ALT-05`, `ALT-10`, `ALT-14`, `ALT-15`, `ALT-17`: ghi **đã có bản demo, còn giới hạn kỹ thuật**.
- Với `ALT-12`: ghi **chưa đạt BA**, không dùng các chức năng gần giống để che lấp phần thiếu.

## 13. Quyết định flow MVP mới: kiểm tra sau giờ nghỉ

Thay vì bắt buộc chụp đủ bốn mốc cố định 15/30/45/60 phút, MVP dùng các checkpoint gắn với lịch ca:

1. Giáo viên bắt đầu session; hệ thống tạo roster chỉ gồm sinh viên của lớp.
2. Trong khoảng đầu ca, hệ thống nhận diện và chốt danh sách điểm danh ban đầu.
3. Sau mỗi giờ nghỉ theo thời khóa biểu, hệ thống thực hiện một checkpoint mới để xác nhận ai quay lại lớp.
4. Nếu một sinh viên có ở checkpoint đầu nhưng vắng ở checkpoint sau giờ nghỉ, hệ thống đánh dấu **cần giáo viên xác minh**, không tự kết luận trốn học ngay.
5. Khi giáo viên kết thúc buổi, hệ thống thực hiện checkpoint cuối, lưu crop/evidence và báo rõ người thiếu, người lạ hoặc kết quả chưa chắc chắn.
6. Giáo viên là người hậu kiểm và quyết định cuối cùng đối với các trường hợp đi vệ sinh, đi muộn, học ghép hoặc AI nhận diện không chắc chắn.

### Điều kiện để flow mới được coi là hoàn chỉnh

- Lịch session phải biết ca nào có giờ nghỉ/checkpoint.
- Mỗi checkpoint có `checkpointType`, `scheduledAt`, `capturedAt`, trạng thái thành công/thất bại và ảnh bằng chứng.
- Không tạo hai checkpoint trùng cùng một ca.
- Có retry khi camera/AI lỗi và báo `DEGRADED` cho giáo viên.
- Có bảng chênh lệch giữa roster ban đầu và checkpoint cuối.
- Có quyền để giáo viên sửa kết luận và audit before/after.
- Sinh viên chỉ xem được bằng chứng của chính mình.

Flow này là **thay đổi nghiệp vụ cần BA xác nhận**, nhưng phù hợp mục tiêu thực tế hơn việc chụp cứng bốn ảnh nếu lớp có giờ nghỉ hoặc tan sớm.
