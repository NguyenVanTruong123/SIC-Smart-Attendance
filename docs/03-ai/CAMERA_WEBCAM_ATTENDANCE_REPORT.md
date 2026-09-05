# Báo cáo thay đổi: Webcam máy tính/điện thoại cho điểm danh

## 1. Mục tiêu

Thay iVCam trong demo bằng webcam của thiết bị đang mở trang điểm danh. Giảng viên có thể mở trang bằng máy tính hoặc điện thoại, xem video realtime và bấm **Điểm danh ngay** mà không cần dựng RTSP server.

Luồng RTSP của camera IP vẫn được giữ lại cho môi trường thật.

## 2. Vấn đề trước đây

- Admin chọn iVCam nhưng chỉ trình duyệt của admin xem được camera.
- Backend/AI chạy trong Docker lại cố đọc `rtsp://127.0.0.1:4747/live` ở bên trong container.
- iVCam không publish stream từ trình duyệt admin sang backend nên `trigger-snapshot` trả `503 Camera RTSP frame is unavailable`.
- Nút điểm danh cũ chỉ chụp một lần từ RTSP, không có video realtime cho thiết bị giáo viên.

## 3. Thiết kế mới

### 3.1. Nguồn camera

| Nguồn | Giá trị lưu nội bộ | Cách xử lý |
|---|---|---|
| Webcam máy tính/điện thoại | `browser://camera` | FE xin quyền `getUserMedia`, chụp JPEG từ video và gửi BE |
| Camera IP | `rtsp://...` | AI service đọc frame RTSP như trước |
| iVCam/placeholder cũ trong DB | URL iVCam/`127.0.0.1:4747`/`127.0.0.1:8554` | Tương thích ngược, được xử lý như webcam trình duyệt |

Admin chọn **Webcam máy tính / điện thoại (Browser)**. Không cần nhập IP hoặc RTSP.

### 3.2. Luồng điểm danh webcam

```text
Giảng viên mở ca học
        ↓
FE xin quyền webcam trên thiết bị hiện tại
        ↓
Video hiển thị realtime trên trang
        ↓
Mỗi 2 giây khi session LIVE_NOW, FE chụp 1 JPEG
        ↓
BE nhận multipart image tại trigger-snapshot
        ↓
BE gọi AI /recognitions với roster của đúng lớp
        ↓
AI trả faces, score, pose, bbox, evidence
        ↓
BE ghi attendance/evidence và phát Socket.IO
        ↓
FE hiển thị BBox, sĩ số, người lạ và trạng thái
```

FE không gửi frame mới khi request trước chưa xong. Khi toàn bộ roster đã được xác nhận, vòng lặp realtime tự dừng để giảm tải. Giảng viên vẫn có thể bấm quét thủ công.

## 4. Thay đổi theo file

### Backend

- `backend/src/utils/camera-source.ts`: định nghĩa `browser://camera` và nhận diện URL iVCam cũ.
- `backend/src/services/classroom.service.ts`: nhận cấu hình webcam, ping webcam không giả lập RTSP, trả `cameraMode` an toàn cho FE.
- `backend/src/services/teacher-session.service.ts`: bỏ capture RTSP tự động với nguồn browser; thêm `captureImage`, dùng chung pipeline recognition/roster/cosine/evidence với RTSP; thêm tra cứu phiên theo mã môn.
- `backend/src/controllers/teacher-session.controller.ts`: cùng endpoint nhận JSON RTSP hoặc multipart `image` từ webcam.
- `backend/src/routes/teacher.routes.ts`: thêm `uploadMedia.single('image')` cho `trigger-snapshot`; thêm route tra cứu mã môn.

### Frontend

- `frontend/src/components/admin/AdminClassrooms.tsx`: thay lựa chọn iVCam bằng **Webcam máy tính / điện thoại (Browser)** và lưu sentinel `browser://camera`.
- `frontend/src/components/teacher/TeacherScan.tsx`: mở webcam bằng `getUserMedia`, lật ảnh theo chiều ngang giống enrollment, gửi frame realtime, hiển thị BBox và dừng khi roster đủ.
- `frontend/src/utils/api.ts`: thêm helper gửi `FormData` nhưng vẫn giữ Bearer token và interceptor refresh.
- `frontend/src/types/index.ts`: thêm `cameraMode` và kiểu dữ liệu tra cứu phiên.
- `frontend/src/index.css`: thêm kiểu video realtime.

## 5. API contract gửi BE/QA

### Điểm danh bằng webcam

```http
POST /api/v1/teacher/sessions/{session_id}/trigger-snapshot
Authorization: Bearer <teacher_token>
Content-Type: multipart/form-data

image=<attendance-webcam.jpg>
```

Response dùng contract cũ của `trigger-snapshot`:

```json
{
  "success": true,
  "data": {
    "capturedAt": "2026-08-31T10:00:00.000Z",
    "detectedFacesCount": 2,
    "matched": 1,
    "unknown": 1,
    "counts": { "total": 40, "present": 1, "late": 0, "absent": 0, "truant": 0 },
    "framePreview": "base64-jpeg",
    "frameWidth": 1280,
    "frameHeight": 720,
    "faces": [
      {
        "result": "MATCHED",
        "studentCode": "SV001",
        "fullName": "Nguyễn Văn A",
        "score": 0.82,
        "bbox": { "x": 220, "y": 100, "width": 160, "height": 190 }
      }
    ]
  }
}
```

JSON không có `image` vẫn được hỗ trợ cho phòng dùng RTSP:

```http
POST /api/v1/teacher/sessions/{session_id}/trigger-snapshot
Authorization: Bearer <teacher_token>
Content-Type: application/json
```

### Tra cứu phiên bằng mã môn

```http
GET /api/v1/teacher/sessions/resolve?courseCode=AI202
Authorization: Bearer <teacher_token>
```

Teacher chỉ nhận các phiên thuộc môn mình phụ trách; admin nhận toàn bộ. FE chọn phiên đầu tiên phù hợp rồi dùng `session_id` cho các thao tác start/capture/end.

## 6. Điều kiện chạy

- Desktop dùng `localhost` được phép camera.
- Điện thoại truy cập từ xa phải dùng HTTPS; Cloudflare Tunnel đáp ứng điều kiện này.
- Người dùng phải cấp quyền camera cho đúng trình duyệt.
- Webcam browser thuộc thiết bị giáo viên, không phải stream dùng chung cho nhiều giáo viên.
- Không lưu video liên tục. Chỉ lưu evidence crop/frame theo kết quả nhận diện và quy tắc hiện tại.

## 7. Checklist QA

1. Admin chọn webcam browser, lưu phòng, kiểm tra trạng thái Online.
2. Teacher mở phiên, cấp quyền camera, thấy video trực tiếp.
3. Bấm **Điểm danh ngay**, kiểm tra request multipart không bị `503` hoặc `413`.
4. Kiểm tra response có `faces`, `score`, `bbox`, `counts`; FE vẽ đúng BBox.
5. Người ngoài roster phải là `UNKNOWN_PERSON`, xuất hiện trong danh sách người lạ.
6. Xác nhận nhiều frame không tạo request chồng nhau; roster đủ thì vòng lặp dừng.
7. Kết thúc phiên tạo frame cuối với webcam và chốt attendance.
8. RTSP camera cũ vẫn gọi JSON capture bình thường.

## 8. Giới hạn của bản demo

Chu kỳ 2 giây là realtime theo kiểu lấy mẫu, không phải truyền WebRTC liên tục. Đây là lựa chọn phù hợp cho demo một camera, giảm tải và tận dụng pipeline AI hiện có. Khi triển khai nhiều phòng, cần chuyển sang worker/queue và nguồn RTSP/WebRTC dùng chung thay vì mở webcam browser cho từng phòng.
