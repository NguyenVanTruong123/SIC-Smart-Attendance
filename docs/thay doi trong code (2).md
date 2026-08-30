## 5.1. Backend: authentication, RBAC và bảo mật

| Hạng mục | `main` (nguồn baseline) | Bản hiện tại | Thay đổi ở đâu | Lý do thay đổi |
|---|---|---|---|---|
| Đăng nhập | BE — `backend/src/routes/auth.routes.ts` (main) | JWT access/refresh, login, refresh, me | `backend/src/routes/auth.routes.ts`, `backend/src/services/auth.service.ts` | Xác thực tập trung và giữ session ổn định. |
| Đổi mật khẩu | BE — `backend/src/routes/auth.routes.ts` (main), chưa đầy đủ | Có `POST /api/v1/auth/change-password` | `backend/src/routes/auth.routes.ts`, `backend/src/controllers/auth.controller.ts` | Đưa thao tác tài khoản cá nhân về Backend có kiểm tra token. |
| RBAC | BE — `backend/src/middlewares/auth.middlewares.ts` (main) | Route admin/teacher/student có verify token và role guard | `backend/src/routes/*.routes.ts`, `backend/src/middlewares/auth.middlewares.ts` | Ngăn gọi API vượt quyền, không chỉ ẩn nút trên FE. |
| Rate limit | BE — chưa có file `backend/src/middlewares/rate-limit.middleware.ts` trong main | Rate limit dưới `/api/v1` | `backend/src/middlewares/rate-limit.middleware.ts`, `backend/src/app.ts` | Giảm brute-force login và lạm dụng upload/API. |
| Audit log | BE — chưa có file `backend/src/services/admin-ops.service.ts`/audit model tương ứng trong main | Lưu thao tác quản trị và thay đổi attendance | `backend/src/services/admin-ops.service.ts`, `backend/prisma/schema.prisma` | GV/admin phải giải trình được ai sửa dữ liệu, trước và sau ra sao. |
| Reset khuôn mặt | BE — `backend/src/routes/admin.routes.ts` (main), flow chưa đầy đủ | Admin reset biometric qua API | `backend/src/routes/admin.routes.ts`, `backend/src/services/biometric.service.ts` | Mỗi tài khoản chỉ đăng ký theo policy; reset do admin kiểm soát. |
| RTSP credential | BE — `backend/src/services/classroom.service.ts` (main) | Backend/AI giữ credential server-side | `backend/src/services/ai-client.service.ts`, `ai-service/main.py` | Không để camera credential hoặc AI key lộ trên browser. |
| CORS/error envelope | BE — `backend/src/app.ts` (main) | CORS theo `FRONTEND_URL`, error handler tập trung | `backend/src/app.ts`, `backend/src/server.ts` | FE nhận lỗi có cấu trúc và chỉ cho phép origin hợp lệ. |

## 5.2. Backend: quản lý đào tạo và import dữ liệu

| Hạng mục | `main` (nguồn baseline) | Bản hiện tại | Thay đổi ở đâu | Lý do thay đổi |
|---|---|---|---|---|
| Quản lý người dùng | BE — `backend/src/routes/admin.routes.ts` (main), CRUD cơ bản | Admin list/create/update/delete user | `backend/src/controllers/admin-academic.controller.ts`, `backend/src/services/admin-academic.service.ts` | Quản lý dữ liệu bằng seed/API, không fix cứng trong FE. |
| Quản lý khoa | BE — `backend/src/services/admin-class.service.ts` (main), chưa đủ | CRUD department | `backend/src/routes/admin.routes.ts`, `backend/src/services/admin-academic.service.ts` | Sinh viên cần khoa, lớp và niên khóa có quan hệ rõ ràng. |
| Quản lý môn học | BE — `backend/src/services/admin-class.service.ts` (main), chưa đủ | CRUD course | `backend/src/services/admin-academic.service.ts`, `frontend/src/components/admin/AdminClasses.tsx` | Tách môn học khỏi lớp học phần để tái sử dụng. |
| Quản lý lớp học phần | BE — `backend/src/services/admin-class.service.ts` (main), chưa đủ | CRUD course class có GV, kỳ, năm học, lịch | `backend/src/services/admin-academic.service.ts`, `backend/src/services/admin-class.service.ts` | Một môn có thể mở nhiều lớp và nhiều buổi/ca. |
| Sinh viên trong lớp | BE — `backend/src/routes/admin.routes.ts` (main), chưa đủ | Thêm/xóa enrollment | `backend/src/routes/admin.routes.ts`, `backend/src/services/admin-academic.service.ts` | Roster là nguồn đối chiếu trực tiếp khi điểm danh. |
| Import Excel bundle | BE — `backend/src/services/import.service.ts` (main), chưa có flow đầy đủ | Nhận file sinh viên, GV, lịch học | `backend/src/services/import.service.ts`, `backend/src/routes/admin.routes.ts` | Giảm nhập thủ công dữ liệu đào tạo lớn. |
| Validate import | BE — `backend/src/services/import.service.ts` (main), mức validate chưa rõ | Có parser/validate cơ bản | `backend/src/services/import.service.ts` | Chặn mã trùng, thiếu cột hoặc quan hệ không tồn tại. |
| Preview/rollback import | BE — `backend/src/services/import.service.ts` (main), chưa đầy đủ | Chưa hoàn thiện preview lỗi và rollback toàn bộ | `backend/src/services/import.service.ts`, admin import UI | Admin cần kiểm tra trước khi áp dụng dữ liệu lớn. |
| Paging danh sách | FE — `frontend/src/components/admin/` (main), chưa đồng nhất | FE có một số paging/giới hạn | Admin components và API list | Tránh render toàn bộ dữ liệu khi số bản ghi tăng. |
| Search danh sách/dropdown | FE — `frontend/src/components/admin/*.tsx` (main), chưa đồng nhất | FE đã bổ sung search nhiều danh sách | `frontend/src/components/admin/*.tsx`, `docs/FRONTEND_DROPDOWN_SEARCH_REPORT.md` | Tìm nhanh theo mã/tên thay vì cuộn thủ công. |

## 5.3. Backend/Frontend: lịch học, ca học và calendar

| Hạng mục | `main` (nguồn baseline) | Bản hiện tại | Thay đổi ở đâu | Lý do thay đổi |
|---|---|---|---|---|
| Giờ học tự do | BE — `backend/prisma/schema.prisma` (main), nhập giờ bắt đầu/kết thúc | Dùng period/ca chuẩn theo 13 tiết | `backend/src/utils/study-periods.ts`, `backend/prisma/schema.prisma` | Tránh nhập sai giờ và đồng nhất lịch. |
| Ca học/tiết học | BE — `backend/prisma/schema.prisma` (main), chưa đủ | Có `periodStart`, `periodEnd`, `periodLabel` | `backend/src/utils/study-periods.ts`, `frontend/src/types/index.ts` | Một lớp có thể học liên tiếp nhiều tiết. |
| Một học phần nhiều buổi | BE — `backend/prisma/schema.prisma` (main), chưa rõ | Hỗ trợ nhiều `ClassSession`/lịch | `backend/prisma/schema.prisma`, `backend/src/services/admin-academic.service.ts` | Một môn có thể học nhiều ngày/ca. |
| Chống trùng phòng | BE — `backend/prisma/schema.prisma` (main), chưa đủ | Kiểm tra overlap phòng/thời gian | `backend/prisma/schema.prisma`, `backend/src/services/admin-academic.service.ts` | Cùng phòng/cùng thời gian không được trùng; khác phòng được phép. |
| Chống trùng giảng viên | BE — `backend/src/services/admin-class.service.ts` (main), chưa rõ | Có kiểm tra overlap trong service | `backend/src/services/admin-academic.service.ts` | Không xếp một GV vào hai lớp cùng ca. |
| Calendar sinh viên | FE — `frontend/src/components/student/StudentDashboard.tsx` (main), card/lịch cũ | Ma trận `Ca học` + Thứ 2–CN, hàng tiết 1–13 | `frontend/src/components/student/StudentDashboard.tsx`, `frontend/src/index.css` | Nhìn toàn bộ tuần và lớp nhiều tiết rõ hơn. |
| Điều hướng tuần | FE — `frontend/src/components/student/StudentDashboard.tsx` (main), nút chữ | Mũi tên có `title` và `aria-label` | `frontend/src/components/student/StudentDashboard.tsx` | Gọn hơn nhưng vẫn rõ và accessible. |
| Calendar GV/admin | FE — `TeacherSchedule.tsx`, `AdminClasses.tsx` (main), form/list rời | Teacher schedule theo khoảng ngày; admin quản lý học phần/lịch | `frontend/src/components/teacher/TeacherSchedule.tsx`, `frontend/src/components/admin/AdminClasses.tsx` | GV xem lịch dạy, admin kiểm soát xung đột. |
| Responsive calendar | FE — `frontend/src/index.css` (main), dễ tràn ngang | Cột ca cố định, phần thứ kéo ngang có kiểm soát | `frontend/src/index.css` | Giữ nhãn ca học trên màn hình hẹp. |

## 5.4. AI/Backend/Frontend: enrollment và sinh trắc học

| Hạng mục | `main` (nguồn baseline) | Bản hiện tại | Thay đổi ở đâu | Lý do thay đổi |
|---|---|---|---|---|
| Face detection | AI — chưa có `ai-service/main.py` trong main | YOLO `face_best.pt` detect khuôn mặt | `ai-service/main.py`, `ai-service/Dockerfile` | Tách detection thành service để Backend gọi thống nhất. |
| Face embedding | AI — chưa có file `ai-service/main.py` hoặc model tương ứng trong main | FaceNet `facenet_best.pt`, vector 512D | `ai-service/main.py`, `backend/src/services/ai-client.service.ts` | So khớp đặc trưng thay vì tên/ảnh nguyên bản. |
| Pose enrollment | BE — chưa có `backend/src/routes/ekyc.routes.ts` trong main | Front/left/right qua `/ekyc/pose` | `backend/src/routes/ekyc.routes.ts`, `frontend/src/components/student/Enrollment.tsx` | Tạo nhiều góc mặt ổn định hơn một ảnh thẳng. |
| Enrollment nhiều frame | Doc — `docs/api_documentation.md` (main), mô tả `video_file`/ảnh cũ | FE gửi `frames[]`, AI tối thiểu 3 frame; flow hiện dùng 8 | `frontend/src/components/student/Enrollment.tsx`, `ai-service/main.py` | Phù hợp flow quay trái/phải và ánh sáng thay đổi. |
| Lưu toàn bộ enrollment images | BE — `backend/prisma/schema.prisma` (main), chưa có model đầy đủ | `UserEnrollmentImage`, migration mới đang working tree | `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260829_store_all_enrollment_images/`, `backend/src/services/ekyc.service.ts` | Giữ nhiều crop 8–12 ảnh thay vì một ảnh gốc. |
| Duplicate face | AI — chưa có file `ai-service/main.py` tương ứng trong main | Global cosine check, ngưỡng hiện tại `0.60` | `ai-service/main.py`, `backend/src/services/ekyc.service.ts` | Ngăn cùng một mặt đăng ký cho hai tài khoản. |
| Roster-scoped identity | BE — chưa có `ai-client.service.ts`; AI — chưa có `ai-service/main.py` trong main | Session chỉ nhận roster SV thuộc lớp | `backend/src/services/teacher-session.service.ts`, `ai-service/main.py` | SV lớp khác, GV hoặc người ngoài phải là `UNKNOWN_PERSON`. |
| Admin biometric management | FE — `frontend/src/components/admin/AdminBiometrics.tsx`; BE — `backend/src/routes/admin.routes.ts` (main), chưa đủ | List/detail/preview/reset | `frontend/src/components/admin/AdminBiometrics.tsx`, `backend/src/services/biometric.service.ts` | Admin cần kiểm tra và reset có audit. |
| Student face profile | FE — `frontend/src/components/student/StudentBiometricProfile.tsx` (main), tab sinh trắc riêng | Gộp trạng thái face vào `Hồ sơ tài khoản` | `frontend/src/components/common/Profile.tsx`, `frontend/src/components/student/StudentBiometricProfile.tsx`, `frontend/src/App.tsx` | Giảm tab thừa, đặt thông tin cùng một nơi. |

## 5.5. Backend/AI: phiên điểm danh và nhận diện

| Hạng mục | `main` (nguồn baseline) | Bản hiện tại | Thay đổi ở đâu | Lý do thay đổi |
|---|---|---|---|---|
| Tạo phiên điểm danh | BE — `backend/src/services/teacher.service.ts` (main), flow cơ bản | Scheduler tự start theo lịch và GV có thể start | `backend/src/services/teacher-session.service.ts`, `backend/src/routes/teacher.routes.ts` | Gắn điểm danh với buổi học thực tế. |
| Nạp roster vào AI | BE — `backend/src/services/teacher.service.ts` (main), chưa có AI client | Backend gửi ma trận embedding đúng lớp vào AI session | `backend/src/services/ai-client.service.ts`, `ai-service/main.py` | Match trực tiếp N×512 của lớp, không tìm toàn trường. |
| Nhận diện frame | AI — chưa có `ai-service/main.py` trong main | AI trả matched/unknown/ambiguous, score, bbox, pose, quality, evidence | `ai-service/main.py`, `backend/src/services/teacher-session.service.ts` | BE có dữ liệu quan sát để ghi attendance/hậu kiểm. |
| Quy tắc trạng thái | BE — `backend/prisma/schema.prisma` (main), enum/rule chưa đủ | Có present/late/absent/excused ở Backend | `backend/src/services/teacher-session.service.ts`, `backend/prisma/schema.prisma` | Rule thời gian/leave thuộc nghiệp vụ, không để AI tự gán. |
| Người ngoài roster | AI/BE — `ai-service/main.py` và matching alert chưa có trong main | `UNKNOWN_PERSON` và alert GV | `ai-service/main.py`, `backend/src/realtime/socket.ts` | Người vào sai lớp không bị nhận nhầm. |
| Capture camera | BE — `backend/src/services/classroom.service.ts` (main), chưa có AI capture | Backend gọi AI capture RTSP và lưu evidence | `backend/src/services/ai-client.service.ts`, `backend/src/services/evidence.service.ts` | Camera xử lý server-side, không lộ RTSP cho FE. |
| Retry/cảnh báo AI-camera | BE — `backend/src/services/classroom.service.ts` (main), health/camera nền tảng | Có health/error path và cảnh báo | `backend/src/services/admin-ops.service.ts`, `backend/src/services/teacher-session.service.ts` | Biết khi kết quả không đáng tin do hạ tầng. |
| 15 phút đầu mỗi ca | Doc — `docs/api_documentation.md` (main); BA — trao đổi, chưa có file riêng; state machine chưa có | Có nền tảng capture/rule nhưng chưa hoàn chỉnh từng period | `backend/src/services/teacher-session.service.ts`, `backend/src/utils/study-periods.ts` | Chốt sổ sau cửa sổ ổn định. |
| Recheck sau giờ nghỉ | Doc — `docs/api_documentation.md` (main); BA — trao đổi phân tích, chưa có file implementation | Mới được thống nhất ở phân tích | Chưa có service/state machine hoàn chỉnh | Phân biệt người đi vệ sinh quay lại với người rời lớp. |
| Kết thúc sớm | BE — `backend/src/routes/teacher.routes.ts` (main), chưa đủ rule | End session có cảnh báo/chặn và confirm | `backend/src/services/teacher-session.service.ts`, teacher UI | Tránh GV kết thúc khi còn ca học. |
| Snapshot/evidence | BE — `backend/src/services/evidence.service.ts` (main), nền tảng cũ | Lưu crop/detection/evidence cho GV/SV theo quyền | `backend/src/services/evidence.service.ts`, student/teacher routes | Có bằng chứng hậu kiểm. |
| GV không nằm trong roster SV | Doc — `docs/api_documentation.md` (main); BA — yêu cầu nghiệp vụ, chưa có rule rõ | Roster chỉ nạp SV của course class | `backend/src/services/teacher-session.service.ts` | Tránh nhận nhầm GV là SV/người học hộ. |

## 5.6. Frontend: teacher workspace

| Hạng mục | `main` (nguồn baseline) | Bản hiện tại | Thay đổi ở đâu | Lý do thay đổi |
|---|---|---|---|---|
| Lịch dạy GV | FE — `frontend/src/components/teacher/TeacherSchedule.tsx` (main), chưa đầy đủ | Schedule theo tuần/khoảng ngày | `frontend/src/components/teacher/TeacherSchedule.tsx` | GV xem lớp phụ trách trước khi mở phiên. |
| Mở phiên | FE — `frontend/src/components/teacher/TeacherScan.tsx` (main), chưa đủ | Nút start gọi Backend session | `frontend/src/components/teacher/TeacherScan.tsx` | GV chủ động kiểm soát buổi học. |
| Camera/scan | FE — `frontend/src/components/teacher/TeacherScan.tsx` (main), demo đơn giản | Hiển thị capture, detection, evidence | `frontend/src/components/teacher/TeacherScan.tsx`, `frontend/src/utils/socket.ts` | Đưa kết quả AI vào màn hình GV. |
| Realtime | FE — `frontend/src/utils/socket.ts` (main); BE — chưa có realtime đầy đủ | Socket.IO nhận session/attendance/alert | `backend/src/realtime/socket.ts`, `frontend/src/utils/socket.ts` | Không bắt GV refresh liên tục. |
| Hậu kiểm | FE — `frontend/src/components/teacher/TeacherScan.tsx`; BE — `backend/src/routes/teacher.routes.ts` (main), chưa đủ | Override attendance và lý do | `backend/src/routes/teacher.routes.ts`, `TeacherScan.tsx` | AI chỉ hỗ trợ; GV xác nhận cuối. |
| Đơn nghỉ | FE — `frontend/src/components/teacher/TeacherLeaveRequests.tsx`; BE — `backend/src/routes/teacher.routes.ts` (main), chưa đủ | Xem và quick approve leave | `backend/src/services/teacher-workspace.service.ts`, `TeacherScan.tsx` | Gắn `Có phép` vào kết quả. |
| Kết thúc phiên | FE — `frontend/src/components/teacher/TeacherScan.tsx`; BE — `backend/src/routes/teacher.routes.ts` (main), chưa đủ | End session và cảnh báo sớm | `backend/src/services/teacher-session.service.ts`, `TeacherScan.tsx` | Chốt đúng thời lượng và báo cáo. |

## 5.7. Frontend: student portal

| Hạng mục | `main` (nguồn baseline) | Bản hiện tại | Thay đổi ở đâu | Lý do thay đổi |
|---|---|---|---|---|
| Dashboard | FE — `frontend/src/components/student/StudentDashboard.tsx` (main), KPI/lịch cũ | Tổng quan chuyên cần và lịch tuần | `frontend/src/components/student/StudentDashboard.tsx` | SV tự kiểm tra tình trạng điểm danh. |
| Lịch học | FE — `frontend/src/components/student/StudentDashboard.tsx` (main), card khó so sánh | Calendar ma trận ca/tiết, Thứ 2–CN | `frontend/src/components/student/StudentDashboard.tsx`, `frontend/src/index.css` | Phù hợp timetable và lớp nhiều tiết. |
| Đổi tuần | FE — `frontend/src/components/student/StudentDashboard.tsx` (main), nút text | Mũi tên trước/sau, accessibility label | `frontend/src/components/student/StudentDashboard.tsx` | Gọn và dễ thao tác. |
| Lịch sử attendance | FE — `frontend/src/components/student/AttendanceHistory.tsx`; BE — `backend/src/routes/student.routes.ts` (main), chưa đầy đủ | Xem theo môn/buổi qua `/student/attendance-history` | `frontend/src/components/student/AttendanceHistory.tsx` | SV tự xác minh kết quả. |
| Evidence cá nhân | FE — `frontend/src/components/student/StudentBiometricProfile.tsx`; BE — `backend/src/routes/student.routes.ts` (main), policy chưa rõ | Có route evidence/face preview theo user | `frontend/src/components/student/AttendanceHistory.tsx`, `StudentBiometricProfile.tsx` | Đối chiếu crop đúng buổi và tài khoản. |
| Đăng ký khuôn mặt | FE — `frontend/src/components/student/Enrollment.tsx` (main), ảnh/video cũ | Camera front/left/right, multi-frame, stop camera | `frontend/src/components/student/Enrollment.tsx` | Đại diện nhiều góc và giải phóng camera. |
| Hồ sơ cá nhân | FE — `Profile.tsx`, `StudentBiometricProfile.tsx` (main), tách tab | Đổi thành `Hồ sơ tài khoản`, có face status | `frontend/src/components/common/Profile.tsx`, `frontend/src/App.tsx` | Đúng scope MVP, giảm tab thừa. |
| Đơn nghỉ | FE — `frontend/src/components/student/StudentLeaveRequests.tsx`; BE — `backend/src/routes/student.routes.ts` (main), chưa đủ | SV xem/tạo leave request | `frontend/src/components/student/AttendanceHistory.tsx`, student routes | Hỗ trợ `Có phép` do GV duyệt. |

## 5.8. Frontend/Backend: admin workspace và UI/UX Stitch

| Hạng mục | `main` (nguồn baseline) | Bản hiện tại | Thay đổi ở đâu | Lý do thay đổi |
|---|---|---|---|---|
| Admin shell | FE — `frontend/src/App.tsx` (main), ít màn hình | Sidebar role-based, dashboard/users/classes/rooms/biometrics | `frontend/src/App.tsx`, `frontend/src/components/admin/*.tsx` | Gom quản trị vào workspace rõ ràng. |
| Header/sidebar | FE — `frontend/src/App.tsx`, `frontend/src/index.css` (main), brand/user card dư | Header tối giản, account dropdown, active state | `frontend/src/App.tsx`, `frontend/src/index.css` | Giảm trang trí, biết tab đang mở. |
| Màu hệ thống | FE — `frontend/src/index.css` (main), chưa đồng nhất | Primary đỏ, secondary neutral/slate/blue | `frontend/src/index.css` | Giữ màu hệ thống nhưng tăng độ đọc. |
| Quản lý sinh viên | FE — `frontend/src/components/admin/AdminBiometrics.tsx`; BE — `backend/src/routes/admin.routes.ts` (main), danh sách đơn giản | Search, profile/detail, enrollment/face status, reset | `frontend/src/components/admin/AdminBiometrics.tsx`, `AdminClasses.tsx` | Admin xử lý từng tài khoản chính xác. |
| Quản lý môn/lớp | FE — `frontend/src/components/admin/AdminClasses.tsx`; BE — `backend/src/routes/admin.routes.ts` (main), form khó đọc | Tách course, class, GV, phòng, period, enrollment | `frontend/src/components/admin/AdminClasses.tsx` | Dữ liệu có quan hệ, không dồn vào một box. |
| Phòng/camera | FE — `frontend/src/components/admin/AdminClassrooms.tsx`; BE — `backend/src/routes/admin.routes.ts` (main), chưa đủ | CRUD phòng/camera và ping health | `frontend/src/components/admin/AdminClassrooms.tsx`, admin routes | Kiểm tra camera trước giờ học. |
| Import dữ liệu | FE — admin import UI trong `frontend/src/components/admin/` (main), chọn file rời/chưa preview | Hướng tới modal kéo-thả/chọn file, preview | Admin UI, `backend/src/services/import.service.ts` | Giảm lỗi nhập Excel/CSV. |
| Dropdown nhiều dữ liệu | FE — native select trong `frontend/src/components/admin/*.tsx` (main) | Searchable dropdown mã/tên SV/GV/môn/lớp/phòng | Admin components và dropdown report | Tìm nhanh thay vì cuộn thủ công. |
| Responsive | FE — `frontend/src/index.css` (main), khoảng trắng/tràn ngang | Grid responsive, calendar scroll kiểm soát | `frontend/src/index.css` | Cân bằng desktop/tablet/mobile. |
| Stitch calendar | Stitch — không có file `C:\Users\dangv\Desktop\SIC\stitch_h_th_ng_duy_t_n_spas` trong workspace; chỉ có screenshot tham chiếu | Period matrix và arrow navigation | `StudentDashboard.tsx`, `index.css` | Lấy ý tưởng Stitch nhưng ưu tiên ca/tiết trường. |
| Hồ sơ Stitch | Stitch — không có file `C:\Users\dangv\Desktop\SIC\stitch_h_th_ng_duy_t_n_spas` trong workspace; chỉ có screenshot yêu cầu vector/ảnh gốc | Gộp vào hồ sơ tài khoản, không đưa vector thô | `Profile.tsx`, `StudentBiometricProfile.tsx` | Giảm lộ dữ liệu nhạy cảm và đúng MVP. |

## 5.9. API contract và platform

| Hạng mục | `main` (nguồn baseline) | Bản hiện tại | Thay đổi ở đâu | Lý do thay đổi |
|---|---|---|---|---|
| Public API prefix | Doc — `docs/api_documentation.md` (main); BE — `backend/src/app.ts` (main) | Backend dùng `/api/v1` | `backend/src/app.ts`, `frontend/src/utils/api.ts` | Có versioning và gateway duy nhất. |
| AI API boundary | Doc — `docs/api_documentation.md` (main), ví dụ public `/api/enroll`/`recognize` | Internal `/internal/v1/*`, chỉ Backend gọi | `ai-service/main.py`, `backend/src/services/ai-client.service.ts` | Không lộ key, roster và RTSP cho browser. |
| Enrollment request | Doc — `docs/api_documentation.md` (main), `video_file`/flow cũ | Multipart `frames[]`, tối đa 12, FE dùng 8 | `backend/src/routes/ekyc.routes.ts`, `docs/api_documentation.md` | Phù hợp enrollment nhiều ảnh pose. |
| Student dashboard query | Doc — `docs/api_documentation.md` (main), chưa mô tả tuần rõ | `GET /student/dashboard?weekStart=YYYY-MM-DD` | `backend/src/routes/student.routes.ts`, `StudentDashboard.tsx` | Calendar cần điểm neo tuần. |
| Teacher schedule query | Doc — `docs/api_documentation.md` (main), có `week/year` | Code dùng `startDate/endDate` | `backend/src/routes/teacher.routes.ts`, `TeacherSchedule.tsx` | Khoảng ngày ISO dễ thống nhất timezone. |
| AI response | Doc — `docs/api_documentation.md` (main), có thể hiểu AI trả status | AI trả identity/score/pose/quality/bbox/evidence | `ai-service/main.py`, `docs/AI_BE_MVP_HANDOFF.md` | BE áp rule thời gian, leave, hậu kiểm/audit. |
| Response envelope/error | BE — `backend/src/app.ts` (main), chưa thống nhất | `{success,data}`, Axios unwrap ở FE | `backend/src/app.ts`, `frontend/src/utils/api.ts` | Tách wire contract và client data. |
| Evidence access | BE — `backend/src/routes/student.routes.ts`, `teacher.routes.ts`, `admin.routes.ts` (main), policy chưa rõ | Route theo role/user | `backend/src/routes/student.routes.ts`, `teacher.routes.ts`, `admin.routes.ts` | Chặn xem ảnh/evidence trái quyền. |
| Socket.IO | FE — `frontend/src/utils/socket.ts` (main); BE — chưa có realtime đầy đủ | Realtime session/attendance/unknown | `backend/src/realtime/socket.ts`, `frontend/src/utils/socket.ts` | Cập nhật scan không cần refresh. |
| Database | BE — `backend/prisma/schema.prisma` (main), schema cũ | Prisma/PostgreSQL, migration và seed flow | `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | Đồng bộ dữ liệu và phù hợp Docker. |
| Docker | Ops — chưa có `docker-compose.yml` trong main | Compose Postgres/Backend/Frontend/AI | `docker-compose.yml`, Dockerfiles | Chạy cùng stack cho team. |
| Storage model/evidence | Ops — chưa có file `docker-compose.yml`/AI storage config trong main | Mounted `models/` và `runtime/evidence` | `docker-compose.yml`, `ai-service/main.py` | Reproducible local trước object storage. |
| Queue/worker | Ops — chưa có file `backend/src/workers/` hoặc queue trong main | Capture theo request/interval | `backend/src/services/teacher-session.service.ts` | MVP một camera; scale cần queue. |

## 5.10. Cập nhật mới: responsive, sidebar và định tuyến theo vai trò

Phần này ghi nhận các thay đổi mới nhất sau khi đối chiếu lại giao diện và luồng thao tác. Các thay đổi bên dưới chỉ tác động đến Frontend; không thay đổi API contract, schema hoặc nghiệp vụ Backend.

| Hạng mục | `main`/bản trước | Bản hiện tại | Thay đổi ở đâu | Lý do thay đổi |
|---|---|---|---|---|
| Sidebar responsive | FE — `frontend/src/index.css` (main), sidebar có thể bị đẩy xuống dưới nội dung ở màn hình hẹp | Sidebar vẫn cố định ở bên trái; tablet giữ nhãn và mobile hẹp chuyển thành thanh icon 68px | `frontend/src/index.css` — breakpoint `800px` và `599px` | Giữ điều hướng nhất quán, không làm người dùng mất ngữ cảnh tab hiện tại. |
| Responsive nội dung | FE — layout dễ tràn ngang/khoảng trắng ở nhiều kích thước | Shell, card, form, table, modal, ảnh và camera dùng `minmax`, `max-width`, `overflow` có kiểm soát | `frontend/src/index.css` — vùng style responsive dùng chung | Hỗ trợ desktop, tablet và điện thoại mà không phá sidebar hoặc làm vỡ bố cục. |
| Calendar trên màn hình hẹp | FE — tuần học có thể bị co quá nhỏ hoặc tràn toàn trang | Cột `Ca học` giữ độ rộng; vùng các ngày trong tuần cuộn ngang riêng | `frontend/src/index.css`, `frontend/src/components/student/StudentDashboard.tsx` | Giữ khả năng đọc tên ca/tiết và vẫn xem đủ Thứ 2–Chủ nhật. |
| URL theo vai trò | FE — nhiều màn hình dùng một root path `/` | Student, teacher và admin có path riêng; refresh/back/forward được đồng bộ | `frontend/src/App.tsx` — `defaultPageForRole`, `pagePathForRole`, `routeForLocation`, History API | Deep-link được từng màn hình, dễ debug và không phụ thuộc một URL duy nhất. |
| Trang mặc định sau đăng nhập | FE — điều hướng dựa chủ yếu vào state trong React | Tự chuyển theo role: `/student`, `/teacher/schedule`, `/admin` | `frontend/src/App.tsx` | Người dùng vào đúng workspace sau khi login hoặc refresh. |
| Mở điểm danh từ lịch dạy | FE — chọn lớp chưa truyền mã phiên sang màn hình scan | Click lớp dạy điều hướng tới `/teacher/attendance/<sessionId>` và tự điền mã ca học | `frontend/src/App.tsx`, `frontend/src/components/teacher/TeacherSchedule.tsx`, `frontend/src/components/teacher/TeacherScan.tsx` | Giảm nhập tay và bảo đảm phiên điểm danh gắn đúng lớp/buổi. |
| Browser navigation | FE — đổi tab không tạo route có thể chia sẻ | Có `popstate` và thay đổi URL bằng `pushState`, logout quay về `/login` | `frontend/src/App.tsx` | Nút back/forward và link trực tiếp hoạt động đúng trong cùng SPA. |

### Kiểm tra sau cập nhật

- `pnpm --dir frontend exec vite build` — build Frontend thành công.
- `docker compose up -d --build frontend` — container Frontend build và chạy lại thành công.
- `docker exec sic-smart-attendance-frontend-1 nginx -t` — cấu hình Nginx hợp lệ.
- `GET http://127.0.0.1:8600/` và các route `/student`, `/student/attendance`, `/teacher/schedule`, `/teacher/attendance/<sessionId>`, `/admin/classes` — trả về HTTP 200.
- Chưa thay đổi endpoint hoặc dữ liệu Backend trong nhóm thay đổi này; các file Backend đang có thay đổi riêng vẫn cần review/merge độc lập.
