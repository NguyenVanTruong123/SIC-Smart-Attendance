# Báo cáo thay đổi: ca học và lịch lớp học phần

Ngày cập nhật: 29/08/2026

## 1. Mục tiêu

BE trước đây chỉ lưu `startTime` và `endTime` cho một buổi học. Cách này làm lớp học phần khó biểu diễn theo thời khóa biểu cố định và dễ mất lịch khi một `classCode` xuất hiện nhiều dòng trong file import.

Thay đổi lần này:

- Lưu thêm ca bắt đầu và ca kết thúc trên từng `ClassSession`.
- Tự suy ra giờ bắt đầu/kết thúc từ bảng 13 tiết học của trường.
- Cho phép một lớp học phần có nhiều khoảng ca học.
- Gom các dòng có cùng `classCode` trước khi import, không ghi đè ca trước.
- Chặn lịch trùng ở cả service và PostgreSQL.
- Giữ tương thích ngược với request/file đang gửi `startTime` và `endTime`.

## 2. Quy ước ca học

BE dùng bảng ca cố định trong `backend/src/utils/study-periods.ts`:

| Ca | Bắt đầu | Kết thúc |
|---:|:---:|:---:|
| 1 | 07:00 | 07:50 |
| 2 | 07:55 | 08:45 |
| 3 | 08:50 | 09:40 |
| 4 | 09:50 | 10:40 |
| 5 | 10:45 | 11:35 |
| 6 | 11:40 | 12:30 |
| 7 | 13:30 | 14:20 |
| 8 | 14:25 | 15:15 |
| 9 | 15:20 | 16:10 |
| 10 | 16:20 | 17:10 |
| 11 | 17:15 | 18:05 |
| 12 | 18:20 | 19:10 |
| 13 | 19:15 | 20:05 |

Request có thể gửi một ca (`periodStart: 1, periodEnd: 1`) hoặc một khoảng ca (`periodStart: 1, periodEnd: 3`). BE cũng nhận `period: "1-3"` hoặc `period: "Ca 1 đến 3"`.

## 3. Thay đổi database

File schema: `backend/prisma/schema.prisma`

`ClassSession` có thêm:

```prisma
periodStart Int? @map("period_start")
periodEnd   Int? @map("period_end")
```

Hai trường nullable để dữ liệu cũ chỉ có giờ vẫn đọc được. Dữ liệu mới từ ca học luôn ghi cả hai trường và phải thỏa mãn `1 <= periodStart <= periodEnd <= 13`.

Migration: `backend/prisma/migrations/20260829_add_study_periods_and_overlap_guards/migration.sql`

Migration tạo:

- Check constraint cho khoảng ca.
- Index theo ngày/phòng và lớp học phần/ngày.
- PostgreSQL exclusion constraint cho thời gian giao nhau trong cùng phòng.
- PostgreSQL exclusion constraint cho thời gian giao nhau trong cùng lớp học phần.
- Các session `CANCELLED` không chiếm lịch để có thể xếp lịch thay thế.

## 4. API admin lịch học

Base URL hiện tại là `/api/v1/admin` và route vẫn giữ nguyên:

### Tạo session

`POST /api/v1/admin/sessions`

Ví dụ dùng ca học:

```json
{
  "courseClassId": "<course-class-id>",
  "classroomId": "<classroom-id>",
  "sessionNumber": 1,
  "sessionDate": "2026-09-01",
  "periodStart": 1,
  "periodEnd": 3,
  "topic": "Nhập môn AI"
}
```

BE lưu thành `07:00–09:40`. Request cũ vẫn hợp lệ:

```json
{
  "courseClassId": "<course-class-id>",
  "classroomId": "<classroom-id>",
  "sessionNumber": 1,
  "sessionDate": "2026-09-01",
  "startTime": "07:00",
  "endTime": "09:40"
}
```

### Danh sách và cập nhật session

- `GET /api/v1/admin/sessions` trả thêm `periodStart`, `periodEnd` và `periodLabel` bên cạnh `startTime`, `endTime`.
- `PATCH /api/v1/admin/sessions/:id` nhận cùng quy ước ca học; nếu không gửi trường ca/giờ thì giữ timing hiện tại.
- `DELETE /api/v1/admin/sessions/:id` chuyển session sang `CANCELLED`, không xóa cứng.

Khi trùng phòng hoặc trùng lớp học phần, API trả HTTP `409`. Kiểm tra ở service giúp trả lỗi rõ ràng; exclusion constraint bảo vệ dữ liệu khi có hai request chạy đồng thời.

## 5. Import nhiều ca cho cùng lớp

File xử lý chính: `backend/src/services/import.service.ts`.

Các dòng cùng `classCode` được gom thành một lớp và giữ danh sách `schedules`. Mỗi schedule sinh session độc lập. Vì vậy một lớp có thể có hai dòng như sau:

```csv
courseCode,courseName,classCode,teacherCode,roomCode,period,startDate,totalSessions,studentCodes
AI101,Nhập môn AI,AI101-1,GV001,A2-301,1-3,2026-09-01,15,SV001 SV002
AI101,Nhập môn AI,AI101-1,GV001,A2-301,4-5,2026-09-01,15,SV001 SV002
```

Kết quả là cùng một lớp học phần có các session ca `1–3` và `4–5` trong từng tuần. Khi file có `periodStart`/`periodEnd` riêng, BE cũng đọc được hai cột này. File cũ dùng `Giờ Bắt Đầu`/`Giờ Kết Thúc` vẫn được hỗ trợ.

Toàn bộ import nằm trong một transaction. Nếu một ca trong file bị trùng phòng hoặc trùng lớp học phần, toàn bộ import rollback, không để trạng thái nửa cũ nửa mới.

## 6. Quy tắc chống trùng

- Cùng ngày, cùng phòng, hai khoảng thời gian giao nhau: không cho tạo.
- Cùng ngày, cùng lớp học phần, hai khoảng thời gian giao nhau: không cho tạo dù khác phòng, tránh một lớp bị xếp hai nơi cùng lúc.
- Hai khoảng kề nhau nhưng không giao nhau: cho phép. Ví dụ ca `1–3` kết thúc 09:40 và ca `4–5` bắt đầu 09:50.
- Khác phòng giữa hai lớp khác nhau: cho phép.
- Session đã `CANCELLED`: không tham gia kiểm tra trùng.

Ví dụ `AI ca 1–3` và `Python ca 3–4` cùng phòng sẽ bị từ chối vì cùng giao tại ca 3. Nếu hai lớp ở hai phòng khác nhau thì được tạo.

## 7. Các file hiển thị đã cập nhật

Các service sau trả thêm thông tin ca để frontend không phải tự suy đoán giờ:

- `backend/src/services/admin-academic.service.ts`
- `backend/src/services/admin-class.service.ts`
- `backend/src/services/admin-overview.service.ts`
- `backend/src/services/teacher.service.ts`
- `backend/src/services/student.service.ts`

Frontend chỉ bổ sung hiển thị `periodLabel`, còn `startTime/endTime` vẫn giữ để không phá contract cũ:

- `frontend/src/components/admin/AdminClasses.tsx`
- `frontend/src/components/teacher/TeacherSchedule.tsx`
- `frontend/src/components/student/StudentDashboard.tsx`
- `frontend/src/types/index.ts`

## 8. Cách review và triển khai

1. Chạy `pnpm exec prisma generate` trong `backend`.
2. Chạy `pnpm run build` trong `backend`.
3. Chạy `pnpm run check` và `pnpm run build` trong `frontend`.
4. Với môi trường Docker, chạy `docker compose up -d --build backend` để backend tự chạy `prisma migrate deploy`.
5. Kiểm tra `_prisma_migrations`, hai cột `period_start/period_end` và hai exclusion constraint trong PostgreSQL.

## 9. Kết quả kiểm thử

- Backend Prisma generate/build: đạt.
- Frontend typecheck/build: đạt.
- Parse `Ca 1 đến 3`: đạt, sinh `07:00–09:40`.
- Parse hai dòng cùng `classCode`: đạt, giữ đủ hai schedule.
- PostgreSQL chặn trùng phòng: đạt.
- PostgreSQL cho phép cùng thời gian ở hai phòng khác nhau: đạt.
- Health check backend trong container: HTTP 200.

## 10. Lưu ý cho BE/frontend khi merge

`ClassSession` vẫn là đơn vị điểm danh. `CourseClass` là lớp học phần chứa nhiều session. Không nên gộp nhiều khoảng ca vào một session, vì mỗi session cần có ngày, phòng, trạng thái phiên và log điểm danh riêng. Khi tạo UI lịch học, frontend nên gọi tạo từng session hoặc import file nhiều dòng; không gửi một chuỗi giờ không có khoảng ca nếu muốn hiển thị đúng thời khóa biểu.
