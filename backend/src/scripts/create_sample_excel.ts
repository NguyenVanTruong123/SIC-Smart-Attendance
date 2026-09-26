import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const sampleDir = path.join(__dirname, '../../../data/import-samples');
if (!fs.existsSync(sampleDir)) {
  fs.mkdirSync(sampleDir, { recursive: true });
}

// 1. File Sinh viên
const studentsData = [
  {
    'MSSV': '21020001',
    'Họ và tên': 'Nguyễn Văn An',
    'Email': '21020001@vnu.edu.vn',
    'Lớp': '21CNTT1',
    'Khoa': 'Khoa Công Nghệ Thông Tin',
    'SĐT': '0912345678',
  },
  {
    'MSSV': '21020002',
    'Họ và tên': 'Trần Thị Mai',
    'Email': '21020002@vnu.edu.vn',
    'Lớp': '21CNTT1',
    'Khoa': 'Khoa Công Nghệ Thông Tin',
    'SĐT': '0912345679',
  },
  {
    'MSSV': '21020003',
    'Họ và tên': 'Lê Hoàng Nam',
    'Email': '21020003@vnu.edu.vn',
    'Lớp': '21CNTT2',
    'Khoa': 'Khoa Công Nghệ Thông Tin',
    'SĐT': '0912345680',
  },
  {
    'MSSV': '21020004',
    'Họ và tên': 'Phạm Minh Đức',
    'Email': '21020004@vnu.edu.vn',
    'Lớp': '21CNTT2',
    'Khoa': 'Khoa Công Nghệ Thông Tin',
    'SĐT': '0912345681',
  },
  {
    'MSSV': '21020005',
    'Họ và tên': 'Hoàng Thùy Linh',
    'Email': '21020005@vnu.edu.vn',
    'Lớp': '21KT1',
    'Khoa': 'Khoa Kinh Tế',
    'SĐT': '0912345682',
  },
  {
    'MSSV': '21020001', // Cố tình tạo dòng trùng để test cảnh báo
    'Họ và tên': 'Nguyễn Văn An (Trùng)',
    'Email': 'an_trung@vnu.edu.vn',
    'Lớp': '21CNTT1',
    'Khoa': 'Khoa Công Nghệ Thông Tin',
    'SĐT': '0912345678',
  },
];

const wsStudents = xlsx.utils.json_to_sheet(studentsData);
const wbStudents = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wbStudents, wsStudents, 'SinhVien');
xlsx.writeFile(wbStudents, path.join(sampleDir, 'students_sample.xlsx'));

// 2. File Giảng viên
const teachersData = [
  {
    'Mã GV': 'GV001',
    'Họ và tên': 'TS. Nguyễn Văn An',
    'Email': 'gv.nguyenvanan@vnu.edu.vn',
    'Khoa': 'Khoa Công Nghệ Thông Tin',
    'SĐT': '0987654321',
  },
  {
    'Mã GV': 'GV002',
    'Họ và tên': 'ThS. Trần Thị Bình',
    'Email': 'gv.tranthibinh@vnu.edu.vn',
    'Khoa': 'Khoa Công Nghệ Thông Tin',
    'SĐT': '0987654322',
  },
];

const wsTeachers = xlsx.utils.json_to_sheet(teachersData);
const wbTeachers = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wbTeachers, wsTeachers, 'GiangVien');
xlsx.writeFile(wbTeachers, path.join(sampleDir, 'teachers_sample.xlsx'));

// 3. File Thời khóa biểu
const scheduleData = [
  {
    'Mã Môn': 'INT3306',
    'Tên Môn': 'Phát Triển Ứng Dụng Web',
    'Số Tín Chỉ': 3,
    'Mã Lớp HP': 'INT3306_1',
    'Học Kỳ': 'HK1',
    'Năm Học': '2026-2027',
    'Mã GV': 'GV001',
    'Phòng Học': 'A2-301',
    'Thứ': 2,
    'Giờ Bắt Đầu': '07:00',
    'Giờ Kết Thúc': '09:30',
    'Ngày Bắt Đầu': '2026-09-01',
    'Tổng Số Buổi': 15,
    'Danh Sách MSSV': '21020001, 21020002, 21020003',
  },
  {
    'Mã Môn': 'INT3308',
    'Tên Môn': 'Thị Giác Máy Tính & AI',
    'Số Tín Chỉ': 3,
    'Mã Lớp HP': 'INT3308_1',
    'Học Kỳ': 'HK1',
    'Năm Học': '2026-2027',
    'Mã GV': 'GV002',
    'Phòng Học': 'B1-102',
    'Thứ': 4,
    'Giờ Bắt Đầu': '13:00',
    'Giờ Kết Thúc': '15:30',
    'Ngày Bắt Đầu': '2026-09-03',
    'Tổng Số Buổi': 15,
    'Danh Sách MSSV': '21020002, 21020004, 21020005',
  },
];

const wsSchedule = xlsx.utils.json_to_sheet(scheduleData);
const wbSchedule = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wbSchedule, wsSchedule, 'ThoiKhoaBieu');
xlsx.writeFile(wbSchedule, path.join(sampleDir, 'schedule_sample.xlsx'));

console.log('✅ Đã tạo thành công 3 file Excel mẫu trong data/import-samples!');
