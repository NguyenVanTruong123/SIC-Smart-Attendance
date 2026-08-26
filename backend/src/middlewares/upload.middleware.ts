import multer from 'multer';
import { Request } from 'express';

// 1. Cấu hình lưu trữ file trong bộ nhớ RAM (Memory Storage) để xử lý nhanh
const storage = multer.memoryStorage();

// 2. Bộ lọc chỉ cho phép tải lên file Excel (.xlsx, .xls, .csv)
const excelFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv', // .csv
  ];

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    file.originalname.match(/\.(xlsx|xls|csv)$/i)
  ) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file định dạng Excel (.xlsx, .xls, .csv)!'));
  }
};

// 3. Khởi tạo Multer Middleware với giới hạn dung lượng 10MB
export const uploadExcel = multer({
  storage,
  fileFilter: excelFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // Tối đa 10MB
  },
});
