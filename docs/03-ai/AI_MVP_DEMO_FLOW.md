# SPAS AI — MVP Demo Flow

## 1. Mục tiêu của bản demo

Bản demo ưu tiên chứng minh một luồng hoàn chỉnh:

```text
Giáo viên chọn session
        ↓
Bấm “Điểm danh ngay”
        ↓
Backend mở session và bắt đầu cửa sổ quét tối đa 1 phút
        ↓
AI đọc nhiều frame, dừng sớm khi đã nhận đủ roster
        ↓
YOLO tìm các khuôn mặt
        ↓
FaceNet tạo vector 512 chiều
        ↓
Cosine similarity với roster của đúng lớp
        ↓
Backend chốt một mốc ảo 15 phút và gửi kết quả lên FE
        ↓
FE hiển thị ảnh camera + BBox + tên/UNKNOWN + score
```

Demo không yêu cầu người dùng phải chờ đến đúng giờ học, chờ timer đầu tiên hoặc chờ đủ thời lượng buổi học mới được kết thúc.

## 2. Phạm vi AI hiện tại

### Đã có

- YOLO detect khuôn mặt từ frame camera.
- Crop khuôn mặt và căn chỉnh bằng landmark.
- FaceNet tạo vector 512D và L2 normalize.
- Roster riêng cho từng session/lớp học phần.
- Cosine similarity chỉ với sinh viên trong roster của session.
- Kết quả `MATCHED`, `UNKNOWN_PERSON` hoặc `AMBIGUOUS`.
- Trả score, runner-up score, pose, quality và BBox.
- Lưu crop làm bằng chứng cho từng khuôn mặt.
- Pose challenge enrollment: nhìn thẳng, quay trái, quay phải.
- Lưu nhiều ảnh enrollment thay vì chỉ một ảnh.

### Giới hạn cần ghi rõ khi demo

- Quay trái/phải là **liveness cơ bản bằng thử thách tư thế**, chưa phải hệ thống anti-spoof chuyên dụng.
- AI hiện xử lý frame theo chu kỳ, không cam kết inference video 30 FPS.
- Roster runtime được nạp khi session bắt đầu; persistence/vector index production là hạng mục sau MVP.
- Kết quả AI là đề xuất; giáo viên vẫn là người hậu kiểm và có quyền sửa điểm danh.

## 3. Enrollment khuôn mặt

FE thu thập 8–12 ảnh từ webcam theo các bước:

1. Nhìn thẳng.
2. Quay trái.
3. Quay phải.
4. Quay lại nhìn thẳng nếu cần đủ số frame.

Mỗi frame phải có đúng một khuôn mặt đủ rõ. AI loại frame không có mặt, nhiều mặt hoặc mặt quá nhỏ. Cần có tối thiểu các pose `front`, `left`, `right` trước khi tạo vector.

Backend lưu các frame enrollment trong `UserEnrollmentImage`. AI tạo vector đại diện bằng cách trung bình các vector hợp lệ rồi normalize.

Reset enrollment có nghĩa là:

```text
Xóa mặt/vector cũ → isFaceEnrolled = false → đăng ký lại từ đầu
```

Đây là quy trình đăng ký lại đơn giản cho MVP, chưa phải re-eKYC có hồ sơ và admin phê duyệt.

## 4. Recognition theo đúng lớp

Khi mở session, Backend chỉ đưa các sinh viên đã enrollment trong lớp đó vào roster:

```text
Roster lớp A = [SV001, SV002, SV003]
Camera frame → các khuôn mặt → vector từng mặt
Cosine(vector mặt, ma trận roster lớp A)
```

Quy tắc:

- `score >= acceptThreshold` và đủ khác biệt với người đứng thứ hai → `MATCHED`.
- `score < acceptThreshold` → `UNKNOWN_PERSON`.
- Khoảng cách giữa hai kết quả tốt nhất quá nhỏ → `AMBIGUOUS`.
- Sinh viên lớp B, giáo viên hoặc người ngoài roster lớp A không được tự động nhận là thành viên lớp A.

AI không tự tìm “người lạ là ai” trong toàn trường. AI chỉ trả lời người đó có thuộc roster của session hiện tại hay không.

## 5. Contract frame + BBox

AI trả thêm frame camera để FE vẽ trực quan:

```json
{
  "sessionId": "session-id",
  "framePreview": "base64-jpeg-without-data-prefix",
  "frameWidth": 1280,
  "frameHeight": 720,
  "faces": [
    {
      "result": "MATCHED",
      "studentId": "SV001",
      "score": 0.82,
      "bbox": {
        "x": 220,
        "y": 100,
        "width": 160,
        "height": 190
      }
    }
  ]
}
```

Quy ước BBox:

- `x`, `y`: tọa độ góc trên bên trái trong frame gốc.
- `width`, `height`: kích thước BBox trong frame gốc.
- FE đổi sang phần trăm theo `frameWidth`/`frameHeight` để overlay đúng khi responsive.
- Màu xanh: `MATCHED`.
- Màu đỏ: `UNKNOWN_PERSON` hoặc `AMBIGUOUS`.
- Label hiển thị tên/mã nếu match, nếu không hiển thị `UNKNOWN` và score.

## 6. Flow điểm danh demo 5–10 phút

### Lần bấm đầu tiên

Nút **Điểm danh ngay** thực hiện một flow đầy đủ:

1. Nếu session chưa live, gọi `POST /api/v1/teacher/sessions/{id}/start`.
2. Backend nạp roster và tạo các `AttendanceLog` ở trạng thái `UNCONFIRMED`.
3. FE/Backend quét tối đa 1 phút, không chờ timer 15 phút.
4. AI trả frame, BBox và recognition; nếu đã nhận đủ roster thì dừng sớm.
5. Backend chốt mốc ảo `15m`: mặt đã nhận diện là `PRESENT`, không thấy là `ABSENT`; lưu crop và phát Socket.IO events.
6. FE cập nhật thống kê, bảng sinh viên, ảnh camera và BBox.

### Các lần bấm tiếp theo

- Nếu session đang live, cùng nút gọi `trigger-snapshot` với `mode=CHECKPOINT`.
- Mỗi lần bấm tạo mốc ảo tiếp theo `15m`, `30m`, `45m`... để thay cho chờ thời gian thật khi demo.
- Mốc sau được phép đổi một sinh viên từ `ABSENT` về `PRESENT` nếu AI nhận diện lại được; `EXCUSED` và kết quả giảng viên sửa tay không bị ghi đè.
- Có thể bấm lại để kiểm tra sau khi đổi vị trí hoặc cho người lạ ra/vào khung hình.

### Kết thúc buổi

Trong demo, nút **Kết thúc** không bị khóa bởi thời gian dự kiến của lớp:

1. FE gửi `mode=FINAL` để lưu crop bằng chứng cuối cho các khuôn mặt đang thấy.
2. Ảnh cuối không tự đổi trạng thái điểm danh của sinh viên.
3. Backend chuyển `UNCONFIRMED` còn lại thành `ABSENT`.
4. Đổi session thành `COMPLETED`.
5. Gỡ roster khỏi AI.

Production có thể bật lại early-end rule bằng `DEMO_MODE=false` và `EARLY_END_MINUTES`.

## 7. Cấu hình demo

Trong Docker Compose hiện dùng:

```env
DEMO_MODE=true
LATE_CUTOFF_MINUTES=1
AI_CAPTURE_INTERVAL_MS=900000
```

Ý nghĩa:

- `DEMO_MODE=true`: không chặn kết thúc sớm.
- `LATE_CUTOFF_MINUTES=1`: giữ ngưỡng vận hành demo, nhưng checkpoint thủ công chốt `PRESENT/ABSENT` để không phải chờ.
- `AI_CAPTURE_INTERVAL_MS=900000`: production tự tạo checkpoint mỗi 15 phút; demo không tự chạy timer này.

### Các thời gian giữ nguyên khi demo

- eKYC vẫn thu 8 frame đúng tư thế để tránh làm yếu định danh; dùng tài khoản đã enrollment cho phần điểm danh trong demo 10 phút.
- Ping camera giới hạn 1.5 giây để báo lỗi sớm, không phải thời gian chờ của người dùng.
- UI vẫn refetch dự phòng mỗi 15 giây, nhưng Socket.IO và kết quả của nút quét cập nhật ngay nên không cần chờ polling.

Khi chạy production nên đặt:

```env
DEMO_MODE=false
LATE_CUTOFF_MINUTES=15
EARLY_END_MINUTES=30
```

## 8. WebSocket events

Namespace:

```text
/attendance
```

Path:

```text
/ws
```

Các event FE dùng:

| Event | Ý nghĩa |
|---|---|
| `attendance:frame_captured` | Frame mới kèm `framePreview`, kích thước frame và danh sách BBox |
| `attendance:face_detected` | Một khuôn mặt match với sinh viên trong roster |
| `attendance:stat_update` | Cập nhật sĩ số, có mặt, muộn, vắng, trốn học |
| `security:intruder_alert` | Có khuôn mặt không thuộc roster hoặc ambiguous |
| `attendance:snapshot_captured` | Checkpoint snapshot nếu flow checkpoint được bật |

`attendance:frame_captured` chỉ là dữ liệu hiển thị demo. Evidence chính thức vẫn phải được Backend lưu và kiểm tra quyền khi truy cập.

## 9. QA checklist nhanh

- Bấm lần đầu khi session chưa live: session tự mở, quét tối đa 1 phút rồi chốt mốc `15m`.
- Bấm lần đầu trước giờ học: không bị chặn bởi giờ hệ thống trong demo.
- Bấm lần hai khi session live: chốt mốc `30m`, có frame mới và không tạo attendance log trùng.
- Sinh viên vắng ở mốc trước nhưng được nhận diện ở mốc sau: chuyển lại `PRESENT`.
- Bấm kết thúc sau 5–10 phút: không nhận lỗi “còn quá 30 phút”.
- Bấm kết thúc: lưu crop cuối nếu camera hoạt động, không đổi người đã vắng thành có mặt chỉ vì ảnh cuối.
- Frame có một sinh viên trong roster: BBox xanh, có tên và score.
- Frame có người ngoài roster: BBox đỏ, label `UNKNOWN`.
- Có nhiều mặt: tất cả mặt đều có BBox riêng.
- Đổi kích thước cửa sổ: BBox vẫn bám đúng khuôn mặt.
- AI/camera lỗi: session chuyển `DEGRADED`, FE hiển thị cảnh báo.
- Student chỉ được xem evidence của chính mình; teacher chỉ xem session được phân công.

## 10. File triển khai liên quan

- AI pipeline: `ai-service/main.py`.
- BE gọi AI: `backend/src/services/ai-client.service.ts`.
- BE session/attendance: `backend/src/services/teacher-session.service.ts`.
- Socket.IO: `backend/src/realtime/socket.ts`.
- FE điểm danh và BBox: `frontend/src/components/teacher/TeacherScan.tsx`.
- FE type contract: `frontend/src/types/index.ts`.
- Demo environment: `docker-compose.yml`.
