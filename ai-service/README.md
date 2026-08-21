# 🧠 AI Core Service (InsightFace + FAISS + FastAPI)

Dịch vụ AI trích xuất vector khuôn mặt (512D ArcFace), kiểm tra Liveness (chống giả mạo), theo dõi đối tượng (ByteTrack) và so khớp danh tính siêu tốc qua FAISS.

## 🛠️ Công nghệ sử dụng
- **Web Framework:** FastAPI (Python 3.10+) + Uvicorn
- **Computer Vision:** OpenCV (`opencv-python-headless`)
- **Face Recognition:** InsightFace / ArcFace (ONNX Runtime / TensorRT)
- **Vector Search:** FAISS (`faiss-cpu` / `faiss-gpu`)
- **Tracking:** ByteTrack / BoT-SORT

## 🚀 Khởi chạy
```bash
# 1. Tạo môi trường ảo
python -m venv venv
# Windows:
.\venv\Scripts\activate

# 2. Cài đặt thư viện
pip install -r requirements.txt

# 3. Chạy server FastAPI
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
