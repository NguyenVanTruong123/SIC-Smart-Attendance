# Model files

Docker Compose mount thư mục này vào AI service ở chế độ chỉ đọc. Hai file weights không được commit lên Git vì `facenet_best.pt` vượt giới hạn file thông thường của GitHub.

Tải model từ [kien0512/SIC-face-models](https://huggingface.co/kien0512/SIC-face-models) và đặt đúng tên:

```text
models/
├── face_best.pt
└── facenet_best.pt
```

Hoặc dùng PowerShell:

```powershell
New-Item -ItemType Directory -Force models
Invoke-WebRequest https://huggingface.co/kien0512/SIC-face-models/resolve/main/face_best.pt -OutFile models/face_best.pt
Invoke-WebRequest https://huggingface.co/kien0512/SIC-face-models/resolve/main/facenet_best.pt -OutFile models/facenet_best.pt
```

Sau đó chạy:

```powershell
docker compose up -d --build
```
