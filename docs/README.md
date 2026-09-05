# SPAS Documentation Map

## Tài liệu AI

- [Hướng dẫn xây dựng model](./03-ai/AI_MODEL_BUILDING_GUIDE.md): phân tích từng cell Kaggle, script đầy đủ, metric và đóng gói model.
- [Runbook demo AI và hệ thống](./03-ai/AI_DEMO_RUNBOOK.md): chuẩn bị dữ liệu, enrollment, điểm danh, BBox, evidence, xử lý lỗi và QA checklist.

Tài liệu được chia theo luồng BA để dễ review và tìm đúng nguồn:

```text
docs/
├── 01-product/   # BA, acceptance criteria và bảng đối chiếu trạng thái
├── 02-api/       # REST/WebSocket contract giữa Frontend, Backend và AI
├── 03-ai/        # Flow enrollment, recognition, camera và demo AI
├── 04-qa/        # Checklist, gap report và tài liệu kiểm thử lịch sử
└── 05-changelog/ # Những khác biệt giữa main, BA, API doc và bản hiện tại
```

## Nguồn cần ưu tiên

1. BA/Product: [BA final vs current](./01-product/BA_FINAL_VS_CURRENT_IMPLEMENTATION_QA_REPORT.md)
2. API: [API documentation](./02-api/api_documentation.md)
3. AI demo: [AI MVP flow](./03-ai/AI_MVP_DEMO_FLOW.md)
4. Thay đổi code: [Change log](./05-changelog/changes.md)

`04-qa/archive/backend_missing_features.md` là báo cáo lịch sử, chỉ dùng để tham khảo. Khi tài liệu mâu thuẫn với code hoặc BA hiện tại, ưu tiên code đã kiểm tra và hai tài liệu nguồn ở trên.
