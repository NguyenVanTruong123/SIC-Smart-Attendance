const xlsx = require('xlsx');
const path = require('path');

const sampleDir = path.join(__dirname, 'sample_data');

// 1. Dữ liệu Sinh viên mới
const studentsData = [
  {
    'MSSV': '21020088',
    'Họ và tên': 'Trần Hoàng Long',
    'Email': '21020088@vnu.edu.vn',
    'Lớp': 'QH-2021-I/CQ-CLC-1',
    'Khoa': 'Công nghệ Thông tin',
    'SĐT': '0988776655'
  },
  {
    'MSSV': '21020099',
    'Họ và tên': 'Lê Thị Mỹ Duyên',
    'Email': '21020099@vnu.edu.vn',
    'Lớp': 'QH-2021-I/CQ-CLC-2',
    'Khoa': 'Khoa học Máy tính',
    'SĐT': '0912345678'
  },
  {
    'MSSV': '21020100',
    'Họ và tên': 'Vũ Minh Tuấn',
    'Email': '21020100@vnu.edu.vn',
    'Lớp': 'QH-2021-I/CQ-CLC-1',
    'Khoa': 'Công nghệ Thông tin',
    'SĐT': '0933445566'
  }
];

const studentWb = xlsx.utils.book_new();
const studentWs = xlsx.utils.json_to_sheet(studentsData);
xlsx.utils.book_append_sheet(studentWb, studentWs, 'Students');
xlsx.writeFile(studentWb, path.join(sampleDir, 'students_test_new.xlsx'));

// 2. Dữ liệu Giảng viên mới
const teachersData = [
  {
    'Mã GV': 'GV008',
    'Họ và tên': 'TS. Phạm Hải Đăng',
    'Email': 'gv.phamhaidang@vnu.edu.vn',
    'Khoa': 'Khoa học Máy tính',
    'SĐT': '0909123456',
    'Học hàm/Học vị': 'Tiến sĩ'
  },
  {
    'Mã GV': 'GV009',
    'Họ và tên': 'ThS. Hoàng Thu Thủy',
    'Email': 'gv.hoangthuthuy@vnu.edu.vn',
    'Khoa': 'Công nghệ Thông tin',
    'SĐT': '0908889999',
    'Học hàm/Học vị': 'Thạc sĩ'
  }
];

const teacherWb = xlsx.utils.book_new();
const teacherWs = xlsx.utils.json_to_sheet(teachersData);
xlsx.utils.book_append_sheet(teacherWb, teacherWs, 'Teachers');
xlsx.writeFile(teacherWb, path.join(sampleDir, 'teachers_test_new.xlsx'));

// 3. Dữ liệu Thời khóa biểu mới
const scheduleData = [
  {
    'Mã môn': 'INT3405',
    'Tên môn học': 'Học sâu và Thị giác máy tính',
    'Số tín chỉ': 3,
    'Mã lớp HP': 'INT3405_01',
    'Học kỳ': 'HK1-2026-2027',
    'Năm học': '2026-2027',
    'Mã GV': 'GV008',
    'Phòng học': 'A2-502',
    'Thời gian bắt đầu': '07:00',
    'Thời gian kết thúc': '09:50',
    'Ngày bắt đầu': '2026-09-01',
    'Số buổi học': 15,
    'Danh sách MSSV': '21020088, 21020099, 21020100'
  },
  {
    'Mã môn': 'INT3406',
    'Tên môn học': 'Kiến trúc Vi dịch vụ và Đám mây',
    'Số tín chỉ': 3,
    'Mã lớp HP': 'INT3406_01',
    'Học kỳ': 'HK1-2026-2027',
    'Năm học': '2026-2027',
    'Mã GV': 'GV009',
    'Phòng học': 'B1-102',
    'Thời gian bắt đầu': '13:00',
    'Thời gian kết thúc': '15:50',
    'Ngày bắt đầu': '2026-09-02',
    'Số buổi học': 15,
    'Danh sách MSSV': '21020088, 21020099'
  }
];

const scheduleWb = xlsx.utils.book_new();
const scheduleWs = xlsx.utils.json_to_sheet(scheduleData);
xlsx.utils.book_append_sheet(scheduleWb, scheduleWs, 'Schedule');
xlsx.writeFile(scheduleWb, path.join(sampleDir, 'schedule_test_new.xlsx'));

console.log('Tạo thành công 3 file test mới trong backend/sample_data:');
console.log('1. students_test_new.xlsx');
console.log('2. teachers_test_new.xlsx');
console.log('3. schedule_test_new.xlsx');
