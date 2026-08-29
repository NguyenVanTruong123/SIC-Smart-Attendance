# Báo cáo thay đổi: tìm kiếm nhanh trong dropdown

Ngày cập nhật: 29/08/2026

## Phạm vi

Tập trung vào các dropdown dữ liệu dài trong trang quản trị:

- Môn học: tìm theo mã môn và tên môn.
- Giảng viên: tìm theo mã giảng viên và họ tên.
- Lớp học phần: tìm theo mã lớp, mã môn, tên môn, mã/tên giảng viên, học kỳ và năm học.
- Sinh viên: tìm theo mã sinh viên và họ tên.

## Thay đổi frontend

File `frontend/src/components/admin/AdminClasses.tsx` giữ `Select` của Ant Design nhưng bổ sung:

- Ô nhập tìm kiếm trực tiếp khi mở dropdown bằng `showSearch` và `onSearch`.
- Lọc cục bộ theo toàn bộ nhãn option.
- Tìm không phân biệt hoa thường và dấu tiếng Việt.
- Gọi API theo từ khóa sau khi người dùng nhập, thay vì chỉ tải cố định 100 bản ghi ban đầu.
- Xóa từ khóa sau khi chọn để dropdown trở lại danh sách đầy đủ.

## Thay đổi backend

File `backend/src/services/admin-academic.service.ts` mở rộng tìm kiếm lớp học phần theo:

```text
classCode, courseCode, courseName, teacher.userCode,
teacher.fullName, semester, academicYear
```

Các endpoint được dùng lại, không tạo endpoint mới:

- `GET /api/v1/admin/courses?search=<keyword>`
- `GET /api/v1/admin/users?role=TEACHER&limit=100&search=<keyword>`
- `GET /api/v1/admin/users?role=STUDENT&limit=100&search=<keyword>`
- `GET /api/v1/admin/course-classes?search=<keyword>`

## Kết quả

Admin có thể gõ trực tiếp tên/mã trong dropdown và nhận danh sách phù hợp, không cần kéo qua toàn bộ danh sách. Backend vẫn giữ phân quyền ADMIN và contract API cũ.

## Kiểm thử

- Frontend TypeScript check: đạt.
- Frontend production build: đạt.
- Backend TypeScript build sau khi mở rộng query: đạt.
