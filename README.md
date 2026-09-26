# SPAS — Smart Passive Attendance System

Monorepo cho hệ thống điểm danh theo BA: Frontend, Backend, AI và dữ liệu mẫu chạy chung bằng Docker Compose.

## Cấu trúc

```text
SIC-Smart-Attendance/
├── frontend/                 # React + Vite: màn hình Admin, Giảng viên, Sinh viên
├── backend/                  # Express + TypeScript + Prisma: API, RBAC, nghiệp vụ
├── ai-service/               # FastAPI: YOLO face detection, FaceNet embedding, recognition
├── data/import-samples/      # File Excel mẫu để import và demo QA
├── models/                   # Model local, xem models/README.md để tải weights
├── runtime/                  # Evidence/gallery local, bị gitignore
├── docker-compose.yml        # Postgres + Backend + AI + Frontend
└── README.md
```

Các module bám theo backlog BA:

- Admin: tài khoản, môn/lớp học phần, phòng/camera, import và audit.
- Giảng viên: lịch dạy, mở phiên, điểm danh, hậu kiểm và báo cáo.
- Sinh viên: dashboard, lịch học, lịch sử điểm danh, nghỉ phép và enrollment.
- AI: enrollment nhiều ảnh, nhận diện theo roster lớp, BBox và evidence.

## Chạy local

Cần Docker Desktop và Docker Compose v2.

```bash
git clone https://github.com/kienkien05/SIC_AI_Project.git
cd SIC_AI_Project
docker compose up --build
```

Mở `http://127.0.0.1:8600`.

Đặt `face_best.pt` và `facenet_best.pt` vào `models/` trước khi chạy AI. Model không commit lên Git; xem `models/README.md` để tải từ Hugging Face.

## Chạy từng module

```bash
pnpm --dir backend install
pnpm --dir backend dev

pnpm --dir frontend install
pnpm --dir frontend dev
```

Chi tiết biến môi trường và database xem trong `backend/.env.example` và README của từng module.

## Dữ liệu demo

File import mẫu nằm ở `data/import-samples/`. Tạo lại ba file mẫu bằng:

```bash
pnpm --dir backend exec tsx src/scripts/create_sample_excel.ts
```

Seed database:

```bash
pnpm --dir backend seed
```

## Dừng hệ thống

```bash
docker compose down
```
