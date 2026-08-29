# Báo cáo thay đổi: Tạo lớp học phần kèm ca học

## 1. Vấn đề

Form `Tạo lớp học phần` trước đây chỉ lưu môn, giảng viên, mã lớp, học kỳ và năm học. Lớp được tạo ra nhưng chưa có `ClassSession`, vì vậy admin chưa thể chọn ca học ngay trong luồng tạo lớp.

## 2. Thay đổi đã thực hiện

### Frontend

File: `frontend/src/components/admin/AdminClasses.tsx`

Form tạo lớp đã thêm nhóm `Lịch buổi đầu` gồm:

- `Phòng học`: dropdown có tìm kiếm theo mã phòng, tòa nhà và tầng.
- `Ngày học`: ngày của buổi đầu tiên.
- `Từ ca`: ca bắt đầu từ 1 đến 13.
- `Đến ca`: ca kết thúc từ 1 đến 13.

Các ca dùng đúng khung giờ cố định của trường:

```text
Ca 1  07:00–07:50     Ca 7  13:30–14:20     Ca 12 18:20–19:10
Ca 2  07:55–08:45     Ca 8  14:25–15:15     Ca 13 19:15–20:05
Ca 3  08:50–09:40     Ca 9  15:20–16:10
Ca 4  09:50–10:40     Ca 10 16:20–17:10
Ca 5  10:45–11:35     Ca 11 17:15–18:05
Ca 6  11:40–12:30
```

Dropdown ca cũng có tìm kiếm nhanh, không cần kéo danh sách thủ công.

### Backend

File: `backend/src/services/admin-academic.service.ts`

`POST /api/v1/admin/course-classes` tiếp nhận thêm các trường tùy chọn:

```json
{
  "courseId": "course-uuid",
  "teacherId": "teacher-uuid",
  "classCode": "INT101-01",
  "semester": "HK1",
  "academicYear": "2026-2027",
  "classroomId": "classroom-uuid",
  "sessionDate": "2026-09-01",
  "sessionNumber": 1,
  "periodStart": 1,
  "periodEnd": 3
}
```

Khi có đủ thông tin lịch, backend tạo `CourseClass` và `ClassSession` trong cùng một transaction. Nếu tạo ca thất bại thì lớp cũng không được tạo dở dang.

Nếu client cũ không gửi các trường lịch, endpoint vẫn chỉ tạo metadata `CourseClass` như trước. Đây là cơ chế tương thích ngược; form frontend hiện tại gửi lịch buổi đầu bắt buộc.

## 3. Quy tắc chống trùng

- Không cho phép cùng một phòng có hai lịch giao nhau trong cùng ngày.
- Không cho phép một lớp học phần có hai lịch giao nhau trong cùng ngày, kể cả khác phòng.
- Lịch có trạng thái `CANCELLED` không tham gia kiểm tra trùng.
- Backend kiểm tra ở transaction và database constraint để tránh race condition.
- Lỗi trùng lịch trả HTTP `409` với thông báo rõ nguyên nhân.

## 4. Tạo nhiều ca cho một lớp

Một `CourseClass` có thể có nhiều `ClassSession`. Form này tạo buổi đầu tiên; các buổi/ca tiếp theo tiếp tục dùng:

- `POST /api/v1/admin/sessions` để thêm từng lịch.
- Luồng import thời khóa biểu để tạo nhiều dòng lịch cho cùng một mã lớp.

Các luồng trên đều dùng chung bộ quy tắc ca học và kiểm tra trùng.

## 5. Kiểm tra đã thực hiện

- Backend TypeScript build thành công.
- Frontend typecheck thành công.
- Frontend production build thành công.
- Docker Compose rebuild thành công cho `backend` và `frontend`.
- Smoke test trong container: tạo lớp kèm ca `1–3` tạo đúng `ClassSession`; tạo lịch trùng cùng phòng/ngày/ca trả `409`; dữ liệu test đã được dọn.

## 6. Lưu ý review

- Không đổi route cũ.
- Không đổi format các trường lớp học phần hiện có.
- Chỉ bổ sung dữ liệu lịch buổi đầu và tái sử dụng helper `sessionTiming` cùng `assertSessionAvailable` hiện có.
- Không đưa `rtspUrl` vào payload tạo lớp; frontend chỉ chọn `classroomId`, backend giữ thông tin camera trong phòng học.
