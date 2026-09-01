# SPAS - Smart Passive Attendance System (SIC Project) 🚀

Hệ thống điểm danh thụ động thông minh sử dụng Camera AI nhận diện khuôn mặt và luồng RTSP trong phòng học.

---

## 🏛️ Cấu trúc dự án (Monorepo)

```text
SIC-project/
├── frontend/        # Giao diện Web (React / Vite + TailwindCSS / Ant Design)
├── backend/         # Web API & Quản lý nghiệp vụ (Node.js Express + Prisma ORM)
├── ai-service/      # AI Core Service (Python FastAPI + InsightFace / ArcFace / FAISS)
├── docs/            # Tài liệu dự án, Product Backlog, Schema DB, SRS
├── .gitignore       # Cấu hình chặn file rác, weights nặng và biến môi trường
└── README.md        # Hướng dẫn dự án chung
```

---

## 🌿 Quy tắc làm việc với Git & Jira

### 1. Đặt tên nhánh (Branch Naming)
- **Nhánh chính (Release/Demo):** `main`
- **Nhánh phát triển tích hợp:** `develop`
- **Nhánh tính năng (gắn mã Jira):**
  - Backend: `feature/SPAS-[ID]-ten-tinh-nang` (VD: `feature/SPAS-6-auth-rbac`)
  - Frontend: `feature/SPAS-[ID]-ten-tinh-nang` (VD: `feature/SPAS-12-teacher-schedule`)
  - AI Service: `feature/SPAS-[ID]-ten-tinh-nang` (VD: `feature/SPAS-21-ekyc-liveness`)

### 2. Định dạng Commit (Smart Commit)
```bash
git commit -m "SPAS-[ID]: [Mô tả ngắn gọn nội dung thay đổi]"
```

---

## 🛠️ Hướng dẫn khởi chạy từng module

Chi tiết xem tại thư mục con của từng module:
- [Frontend Guide](./frontend/README.md)
- [Backend Guide](./backend/README.md)
- [AI Service Guide](./ai-service/README.md)
- [Tài liệu đặc tả & CSDL](./docs/README.md)

## 🚀 Chạy toàn bộ hệ thống bằng Docker Compose

Đặt `face_best.pt` và `facenet_best.pt` vào thư mục `models/` (không commit model), sau đó chạy:

```bash
docker compose up --build
```

Mở `http://127.0.0.1:8600`. Tài khoản seed và contract sáu nhóm chức năng xem tại [báo cáo triển khai](./docs/SIX_MODULES_IMPLEMENTATION_REPORT.md).

Môi trường local Docker bật các nút đăng nhập nhanh cho tài khoản demo. Khi triển khai thật, đặt `VITE_ENABLE_DEMO_ACCOUNTS=false` trước khi build frontend.
