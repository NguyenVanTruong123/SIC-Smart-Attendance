# ⚙️ Backend Web API Service

Hệ thống API RESTful và WebSocket phục vụ nghiệp vụ điểm danh, phân quyền RBAC, quản lý sinh trắc học và tích hợp CSDL Supabase PostgreSQL.

## 🛠️ Công nghệ sử dụng
- **Runtime:** Node.js (Express.js / TypeScript)
- **Database & ORM:** PostgreSQL (Supabase) + Prisma ORM
- **Authentication:** JWT (JSON Web Token) + RBAC Middleware
- **Cache & Queue:** Redis + BullMQ (Quản lý hàng đợi nhận diện ảnh)
- **Realtime:** Socket.io / WebSocket

## 🚀 Khởi chạy
```bash
# 1. Cài đặt dependencies
npm install

# 2. Đồng bộ Prisma Schema
npx prisma generate
npx prisma db push

# 3. Chạy môi trường development
npm run dev
```
