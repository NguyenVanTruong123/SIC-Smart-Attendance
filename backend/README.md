# Backend API Service

API REST/WebSocket cho các nghiệp vụ trong backlog BA: RBAC, đào tạo, lịch học, điểm danh, sinh trắc học, import và audit.

## 🛠️ Công nghệ sử dụng
- **Runtime:** Node.js (Express.js / TypeScript)
- **Database & ORM:** PostgreSQL + Prisma ORM
- **Authentication:** JWT (JSON Web Token) + RBAC Middleware
- **Realtime:** Socket.io / WebSocket

## 🚀 Khởi chạy
```bash
# 1. Cài đặt dependencies
pnpm install

# 2. Đồng bộ Prisma Schema
pnpm prisma:generate
pnpm prisma:push

# 3. Chạy môi trường development
pnpm dev
```

File Excel mẫu để test import nằm ở `../data/import-samples/`.
