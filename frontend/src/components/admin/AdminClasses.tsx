import { useDeferredValue, useState } from "react";
import { Card, Table, Tag, Input, Select, Row, Col, Statistic, Progress, Button, Form, InputNumber, message } from "antd";
import {
  SearchOutlined,
  BookOutlined,
  AppstoreOutlined,
  TeamOutlined,
  VideoCameraOutlined,
  ClockCircleOutlined,
  WifiOutlined,
  DisconnectOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";

// =============================================================================
// Admin: Classes & Course Structure (Master - Detail Nested Table)
// =============================================================================

export interface CourseChildRow {
  id: string;
  key: string;
  isCourse: boolean;
  courseCode: string;
  courseName: string;
  classCode: string;
  teacherName: string;
  teacherEmail?: string;
  totalStudents: number;
  schedule: string;
  scheduleSlots?: Array<{
    dayOfWeek: number;
    dayName: string;
    startTime: string;
    endTime: string;
    periodStart?: number | null;
    periodEnd?: number | null;
    periodLabel?: string | null;
    roomCode: string;
  }>;
  classroom: string;
  cameraStatus: "ONLINE" | "OFFLINE" | "MAINTENANCE";
  cameraFps: number;
  cameraLatency: number;
  rtspUrl?: string;
  completedSessions: number;
  totalSessions: number;
  attendanceRate: number;
  todayStatus: "LIVE" | "UPCOMING" | "IDLE";
  semester?: string;
}

export interface CourseParentRow {
  id: string;
  key: string;
  isCourse: boolean;
  courseCode: string;
  courseName: string;
  credits: number;
  totalClasses: number;
  totalStudents: number;
  totalSessions: number;
  children?: CourseChildRow[];
}

export interface AdminClassesResponse {
  kpis: {
    totalCourses: number;
    totalClasses: number;
    totalEnrollments: number;
    liveClasses: number;
  };
  semesters: string[];
  items: CourseParentRow[];
}

type CourseOption = { id: string; courseCode: string; courseName: string };
type UserOption = { id: string; userCode: string; fullName: string };
type CourseClassOption = { id: string; classCode: string; course: CourseOption };
type PagedUsers = { items: UserOption[] };
type ClassroomOption = { id: string; roomCode: string; building: string; floor: number; cameraStatus: string };
type ClassroomListResponse = { items: ClassroomOption[] };

const studyPeriodOptions = [
  [1, "Ca 1 · 07:00–07:50"],
  [2, "Ca 2 · 07:55–08:45"],
  [3, "Ca 3 · 08:50–09:40"],
  [4, "Ca 4 · 09:50–10:40"],
  [5, "Ca 5 · 10:45–11:35"],
  [6, "Ca 6 · 11:40–12:30"],
  [7, "Ca 7 · 13:30–14:20"],
  [8, "Ca 8 · 14:25–15:15"],
  [9, "Ca 9 · 15:20–16:10"],
  [10, "Ca 10 · 16:20–17:10"],
  [11, "Ca 11 · 17:15–18:05"],
  [12, "Ca 12 · 18:20–19:10"],
  [13, "Ca 13 · 19:15–20:05"],
].map(([value, label]) => ({ value, label: String(label) }));

function normalizeSelectSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN");
}

function filterSelectOption(input: string, option?: { label?: unknown }) {
  return normalizeSelectSearch(option?.label).includes(normalizeSelectSearch(input));
}

function AdminAcademicCreateCards() {
  const [courseForm] = Form.useForm();
  const [classForm] = Form.useForm();
  const [enrollmentForm] = Form.useForm();
  const queryClient = useQueryClient();
  const [courseSearch, setCourseSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [classroomSearch, setClassroomSearch] = useState("");
  const deferredCourseSearch = useDeferredValue(courseSearch);
  const deferredTeacherSearch = useDeferredValue(teacherSearch);
  const deferredStudentSearch = useDeferredValue(studentSearch);
  const deferredClassSearch = useDeferredValue(classSearch);
  const coursesQuery = useQuery<CourseOption[]>({
    queryKey: ["admin-courses-options", deferredCourseSearch],
    queryFn: () => api.get(`/admin/courses?search=${encodeURIComponent(deferredCourseSearch)}`) as Promise<CourseOption[]>,
  });
  const teachersQuery = useQuery<PagedUsers>({
    queryKey: ["admin-teacher-options", deferredTeacherSearch],
    queryFn: () => api.get(`/admin/users?role=TEACHER&limit=100&search=${encodeURIComponent(deferredTeacherSearch)}`) as Promise<PagedUsers>,
  });
  const studentsQuery = useQuery<PagedUsers>({
    queryKey: ["admin-student-options", deferredStudentSearch],
    queryFn: () => api.get(`/admin/users?role=STUDENT&limit=100&search=${encodeURIComponent(deferredStudentSearch)}`) as Promise<PagedUsers>,
  });
  const classesQuery = useQuery<CourseClassOption[]>({
    queryKey: ["admin-course-class-options", deferredClassSearch],
    queryFn: () => api.get(`/admin/course-classes?search=${encodeURIComponent(deferredClassSearch)}`) as Promise<CourseClassOption[]>,
  });
  const classroomsQuery = useQuery<ClassroomListResponse>({
    queryKey: ["admin-classroom-options"],
    queryFn: () => api.get("/admin/classrooms?page=1&limit=100") as Promise<ClassroomListResponse>,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-classes"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-courses-options"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-course-class-options"] });
  };

  const createCourse = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post("/admin/courses", values),
    onSuccess: () => {
      message.success("Đã thêm môn học.");
      courseForm.resetFields();
      refresh();
    },
  });
  const createClass = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post("/admin/course-classes", values),
    onSuccess: () => {
      message.success("Đã tạo lớp học phần.");
      classForm.resetFields();
      refresh();
    },
  });
  const enrollStudent = useMutation({
    mutationFn: (values: { courseClassId: string; studentId: string }) => api.post(`/admin/course-classes/${values.courseClassId}/enrollments`, { studentId: values.studentId }),
    onSuccess: () => {
      message.success("Đã xếp sinh viên vào lớp.");
      enrollmentForm.resetFields();
      refresh();
    },
  });

  const courseOptions = coursesQuery.data ?? [];
  const teacherOptions = teachersQuery.data?.items ?? [];
  const studentOptions = studentsQuery.data?.items ?? [];
  const classOptions = classesQuery.data ?? [];
  const classroomOptions = classroomsQuery.data?.items ?? [];

  return (
    <div className="admin-create-grid">
      <Card title="Thêm môn học" className="admin-create-card">
        <Form form={courseForm} layout="vertical" onFinish={(values) => createCourse.mutate(values)}>
          <Form.Item name="courseCode" label="Mã môn" rules={[{ required: true, message: "Nhập mã môn." }]}>
            <Input placeholder="VD: INT101" />
          </Form.Item>
          <Form.Item name="courseName" label="Tên môn" rules={[{ required: true, message: "Nhập tên môn." }]}>
            <Input placeholder="VD: Nhập môn Trí tuệ nhân tạo" />
          </Form.Item>
          <Form.Item name="credits" label="Số tín chỉ" initialValue={3} rules={[{ required: true, message: "Nhập số tín chỉ." }]}>
            <InputNumber min={1} max={10} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="totalSessions" label="Tổng số buổi" initialValue={15}>
            <InputNumber min={1} max={60} style={{ width: "100%" }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={createCourse.isPending}>Thêm môn</Button>
        </Form>
      </Card>

      <Card title="Tạo lớp học phần" className="admin-create-card">
        <Form form={classForm} layout="vertical" onFinish={(values) => createClass.mutate(values)}>
          <Form.Item name="courseId" label="Môn" rules={[{ required: true, message: "Chọn môn học." }]}>
            <Select
              showSearch
              onSearch={setCourseSearch}
              onChange={() => setCourseSearch("")}
              placeholder="Tìm theo mã hoặc tên môn"
              optionFilterProp="label"
              filterOption={filterSelectOption}
              options={courseOptions.map((course) => ({ value: course.id, label: `${course.courseCode} · ${course.courseName}` }))}
            />
          </Form.Item>
          <Form.Item name="teacherId" label="Giảng viên" rules={[{ required: true, message: "Chọn giảng viên." }]}>
            <Select
              showSearch
              onSearch={setTeacherSearch}
              onChange={() => setTeacherSearch("")}
              placeholder="Tìm theo mã hoặc tên giảng viên"
              optionFilterProp="label"
              filterOption={filterSelectOption}
              options={teacherOptions.map((teacher) => ({ value: teacher.id, label: `${teacher.userCode} · ${teacher.fullName}` }))}
            />
          </Form.Item>
          <Form.Item name="classCode" label="Mã lớp học phần" rules={[{ required: true, message: "Nhập mã lớp." }]}>
            <Input placeholder="VD: INT101-01" />
          </Form.Item>
          <div className="admin-create-inline-fields">
            <Form.Item name="semester" label="Học kỳ" rules={[{ required: true, message: "Nhập học kỳ." }]}>
              <Input placeholder="HK1" />
            </Form.Item>
            <Form.Item name="academicYear" label="Năm học" rules={[{ required: true, message: "Nhập năm học." }]}>
              <Input placeholder="2026-2027" />
            </Form.Item>
          </div>
          <div className="admin-create-section-title">Lịch buổi đầu</div>
          <div className="admin-create-inline-fields">
            <Form.Item name="classroomId" label="Phòng học" rules={[{ required: true, message: "Chọn phòng học." }]}>
              <Select
                showSearch
                onSearch={setClassroomSearch}
                onChange={() => setClassroomSearch("")}
                placeholder="Tìm theo mã phòng hoặc tòa nhà"
                optionFilterProp="label"
                filterOption={filterSelectOption}
                options={classroomOptions.map((classroom) => ({ value: classroom.id, label: `${classroom.roomCode} · ${classroom.building} · Tầng ${classroom.floor}` }))}
                notFoundContent={classroomSearch ? "Không tìm thấy phòng học" : "Chưa có phòng học"}
              />
            </Form.Item>
            <Form.Item name="sessionDate" label="Ngày học" rules={[{ required: true, message: "Chọn ngày học." }]}>
              <Input type="date" />
            </Form.Item>
          </div>
          <div className="admin-create-inline-fields">
            <Form.Item name="periodStart" label="Từ ca" rules={[{ required: true, message: "Chọn ca bắt đầu." }]}>
              <Select showSearch optionFilterProp="label" filterOption={filterSelectOption} options={studyPeriodOptions} placeholder="Chọn ca bắt đầu" />
            </Form.Item>
            <Form.Item name="periodEnd" label="Đến ca" rules={[{ required: true, message: "Chọn ca kết thúc." }]}>
              <Select showSearch optionFilterProp="label" filterOption={filterSelectOption} options={studyPeriodOptions} placeholder="Chọn ca kết thúc" />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" block loading={createClass.isPending}>Tạo lớp học phần</Button>
        </Form>
      </Card>

      <Card title="Xếp sinh viên" className="admin-create-card">
        <Form form={enrollmentForm} layout="vertical" onFinish={(values) => enrollStudent.mutate(values)}>
          <Form.Item name="courseClassId" label="Lớp học phần" rules={[{ required: true, message: "Chọn lớp học phần." }]}>
            <Select
              showSearch
              onSearch={setClassSearch}
              onChange={() => setClassSearch("")}
              placeholder="Tìm theo mã lớp hoặc môn"
              optionFilterProp="label"
              filterOption={filterSelectOption}
              options={classOptions.map((courseClass) => ({ value: courseClass.id, label: `${courseClass.classCode} · ${courseClass.course.courseCode} - ${courseClass.course.courseName}` }))}
            />
          </Form.Item>
          <Form.Item name="studentId" label="Sinh viên" rules={[{ required: true, message: "Chọn sinh viên." }]}>
            <Select
              showSearch
              onSearch={setStudentSearch}
              onChange={() => setStudentSearch("")}
              placeholder="Tìm theo mã hoặc tên sinh viên"
              optionFilterProp="label"
              filterOption={filterSelectOption}
              options={studentOptions.map((student) => ({ value: student.id, label: `${student.userCode} · ${student.fullName}` }))}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={enrollStudent.isPending}>Thêm vào lớp</Button>
        </Form>
      </Card>
    </div>
  );
}

export function AdminClasses() {
  const [search, setSearch] = useState("");
  const [semester, setSemester] = useState("ALL");
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const { data, isLoading, refetch } = useQuery<AdminClassesResponse>({
    queryKey: ["admin-classes", search, semester],
    queryFn: () =>
      api.get(`/admin/classes?search=${search}&semester=${semester}`) as Promise<AdminClassesResponse>,
  });

  const kpis = data?.kpis;
  const items = data?.items ?? [];
  const semesters = data?.semesters ?? [];

  // Toggle Mở rộng / Thu gọn toàn bộ
  const handleToggleExpandAll = () => {
    if (expandedRowKeys.length > 0) {
      setExpandedRowKeys([]);
    } else {
      setExpandedRowKeys(items.map((item) => item.key));
    }
  };

  // 1. Tiêu đề Bảng Mẹ (Dành riêng cho Học phần / Môn học)
  const parentColumns = [
    {
      title: "Mã HP",
      dataIndex: "courseCode",
      key: "courseCode",
      width: 120,
      render: (code: string) => (
        <Tag color="blue" className="font-mono font-bold text-xs py-0.5 px-2">
          {code}
        </Tag>
      ),
    },
    {
      title: "Tên học phần",
      dataIndex: "courseName",
      key: "courseName",
      render: (name: string) => <span className="font-bold text-slate-800 text-sm">{name}</span>,
    },
    {
      title: "Số tín chỉ",
      dataIndex: "credits",
      key: "credits",
      width: 120,
      render: (credits: number) => (
        <Tag color="cyan" className="font-medium">
          {credits} Tín chỉ
        </Tag>
      ),
    },
    {
      title: "Số lớp mở",
      dataIndex: "totalClasses",
      key: "totalClasses",
      width: 150,
      render: (count: number) => (
        <Tag color="geekblue" className="font-semibold">
          {count} Lớp học phần
        </Tag>
      ),
    },
    {
      title: "Tổng số sinh viên",
      dataIndex: "totalStudents",
      key: "totalStudents",
      width: 160,
      render: (students: number) => (
        <Tag color="purple" className="font-semibold">
          👥 {students} Sinh viên
        </Tag>
      ),
    },
    {
      title: "Số buổi / Kỳ",
      dataIndex: "totalSessions",
      key: "totalSessions",
      width: 130,
      render: (sessions: number) => (
        <span className="text-slate-600 font-medium text-xs">{sessions || 15} buổi</span>
      ),
    },
  ];

  // 2. Tiêu đề Bảng Con (Dành riêng cho Lớp học phần khi bung ra)
  const childColumns = [
    {
      title: "Mã lớp",
      dataIndex: "classCode",
      key: "classCode",
      width: 130,
      render: (code: string) => (
        <Tag color="geekblue" className="font-mono font-bold text-xs">
          {code}
        </Tag>
      ),
    },
    {
      title: "Giảng viên phụ trách",
      key: "teacher",
      width: 180,
      render: (_: unknown, r: CourseChildRow) => (
        <div>
          <div className="font-semibold text-slate-800 text-xs">{r.teacherName}</div>
          {r.teacherEmail && (
            <div className="text-[11px] text-slate-400 font-mono">{r.teacherEmail}</div>
          )}
        </div>
      ),
    },
    {
      title: "Sĩ số",
      dataIndex: "totalStudents",
      key: "totalStudents",
      width: 90,
      render: (total: number) => (
        <span className="font-bold text-slate-700 text-xs flex items-center gap-1">
          <TeamOutlined className="text-blue-500" />
          {total} SV
        </span>
      ),
    },
    {
      title: "Lịch học & Ca học",
      dataIndex: "schedule",
      key: "schedule",
      width: 180,
      render: (schedule: string) => (
        <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
          <ClockCircleOutlined className="text-slate-400" />
          <span>{schedule}</span>
        </div>
      ),
    },
    {
      title: "Phòng học & Tòa",
      dataIndex: "classroom",
      key: "classroom",
      width: 170,
      render: (room: string) => (
        <span className="text-xs font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
          {room}
        </span>
      ),
    },
    {
      title: "Camera IP",
      key: "camera",
      width: 140,
      render: (_: unknown, r: CourseChildRow) =>
        r.cameraStatus === "ONLINE" ? (
          <Tag icon={<WifiOutlined />} color="success" className="font-semibold text-[11px]">
            🟢 Online ({r.cameraLatency}ms)
          </Tag>
        ) : (
          <Tag icon={<DisconnectOutlined />} color="error" className="font-semibold text-[11px]">
            🔴 Offline
          </Tag>
        ),
    },
    {
      title: "Tiến độ",
      key: "progress",
      width: 130,
      render: (_: unknown, r: CourseChildRow) => {
        const pct = Math.min(100, Math.round((r.completedSessions / (r.totalSessions || 15)) * 100));
        return (
          <div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-0.5">
              <span>{r.completedSessions}/{r.totalSessions} buổi</span>
              <span>{pct}%</span>
            </div>
            <Progress percent={pct} size="small" showInfo={false} strokeColor="#2563eb" />
          </div>
        );
      },
    },
    {
      title: "Chuyên cần",
      dataIndex: "attendanceRate",
      key: "attendanceRate",
      width: 110,
      render: (rate: number) => {
        const color = rate >= 90 ? "success" : rate >= 75 ? "warning" : "error";
        return (
          <Tag color={color} className="font-bold text-xs">
            {rate > 0 ? `${rate}%` : "Chưa có"}
          </Tag>
        );
      },
    },
    {
      title: "Trạng thái hôm nay",
      dataIndex: "todayStatus",
      key: "todayStatus",
      width: 140,
      render: (status: string) => {
        switch (status) {
          case "LIVE":
            return (
              <Tag
                color="success"
                className="animate-pulse font-bold text-xs"
                style={{ background: "#dcfce7", color: "#15803d", borderColor: "#86efac" }}
              >
                🟢 Đang diễn ra
              </Tag>
            );
          case "UPCOMING":
            return (
              <Tag
                color="purple"
                className="font-semibold text-xs"
                style={{ background: "#f3e8ff", color: "#7e22ce", borderColor: "#d8b4fe" }}
              >
                🟣 Sắp diễn ra
              </Tag>
            );
          default:
            return <Tag color="default" className="text-slate-400 text-xs">⚪ Chưa đến ca</Tag>;
        }
      },
    },
  ];

  // Hàm render Bảng Con lồng bên trong mỗi môn học (Màu nền nổi bật & phân biệt rõ ràng)
  const expandedRowRender = (course: CourseParentRow) => {
    const childrenData = course.children ?? [];
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
          border: "1px solid #7dd3fc",
          borderLeft: "6px solid #0284c7",
          borderRadius: 10,
          padding: "16px 20px",
          margin: "10px 0",
          boxShadow: "0 6px 16px rgba(2, 132, 199, 0.1)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Tag
              color="geekblue"
              className="text-xs font-bold uppercase tracking-wider px-3 py-1 m-0 shadow-sm"
              style={{ background: "#0284c7", color: "#ffffff", borderColor: "#0284c7" }}
            >
              <AppstoreOutlined className="mr-1.5" />
              Danh sách Lớp học phần: [{course.courseCode}] {course.courseName}
            </Tag>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#0369a1",
              background: "#ffffff",
              padding: "4px 12px",
              borderRadius: 20,
              border: "1px solid #bae6fd",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            📊 Tổng số: {childrenData.length} lớp học phần
          </span>
        </div>
        <Table
          columns={childColumns as any}
          dataSource={childrenData}
          pagination={false}
          size="small"
          rowKey="key"
          bordered
          className="rounded-lg overflow-hidden shadow-sm"
          style={{ background: "#ffffff" }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <AdminAcademicCreateCards />
      {/* 4 Thẻ KPI Real-time */}
      {kpis && (
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}>
            <Card className="kpi-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic
                title={<span className="text-xs uppercase font-bold tracking-wider text-slate-500">Tổng học phần</span>}
                value={kpis.totalCourses}
                prefix={<BookOutlined style={{ color: "#2563eb" }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="kpi-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic
                title={<span className="text-xs uppercase font-bold tracking-wider text-slate-500">Tổng lớp học phần</span>}
                value={kpis.totalClasses}
                prefix={<AppstoreOutlined style={{ color: "#7c3aed" }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="kpi-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic
                title={<span className="text-xs uppercase font-bold tracking-wider text-slate-500">Sinh viên đăng ký</span>}
                value={kpis.totalEnrollments}
                prefix={<TeamOutlined style={{ color: "#059669" }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="kpi-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic
                title={<span className="text-xs uppercase font-bold tracking-wider text-slate-500">Lớp đang học lúc này</span>}
                value={kpis.liveClasses}
                valueStyle={{ color: "#16a34a", fontWeight: 700 }}
                prefix={<VideoCameraOutlined style={{ color: "#16a34a" }} />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Main Master Table Card */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <AppstoreOutlined className="text-blue-600" />
            <span className="font-bold text-base text-slate-800">Quản lý Học phần & Lớp học</span>
          </div>
        }
        extra={
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Tìm mã HP, tên môn, giảng viên, mã lớp..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 280 }}
            />
            <Select value={semester} onChange={setSemester} style={{ width: 160 }}>
              <Select.Option value="ALL">Tất cả học kỳ</Select.Option>
              {semesters.map((s) => (
                <Select.Option key={s} value={s}>
                  {s}
                </Select.Option>
              ))}
            </Select>
            <Button onClick={handleToggleExpandAll}>
              {expandedRowKeys.length > 0 ? "Thu gọn tất cả" : "Mở rộng tất cả"}
            </Button>
            <Button icon={<SyncOutlined />} onClick={() => refetch()} />
          </div>
        }
      >
        <Table
          columns={parentColumns as any}
          dataSource={items}
          rowKey="key"
          loading={isLoading}
          pagination={false}
          size="middle"
          expandable={{
            expandedRowRender,
            expandedRowKeys,
            onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
            rowExpandable: (record) => !!record.children && record.children.length > 0,
          }}
        />
      </Card>
    </div>
  );
}
