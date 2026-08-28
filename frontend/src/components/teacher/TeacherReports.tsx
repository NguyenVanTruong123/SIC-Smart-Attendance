import { Card, Table, Tag, Row, Col, Statistic, Input, Select, Typography } from "antd";
import { BarChartOutlined, WarningOutlined, RiseOutlined, CalendarOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/utils/api";
import { statusLabels, statusColors, type AttendanceStatus, type ReportKpis, type MatrixStudent } from "@/types";

const { Text } = Typography;

// =============================================================================
// Teacher: Reports Matrix — GET /api/v1/teacher/reports/matrix (§4.2.1)
// =============================================================================

interface MatrixResponse {
  kpis: ReportKpis;
  matrix: MatrixStudent[];
}

export function TeacherReports() {
  const [courseClassId, setCourseClassId] = useState("");
  const [semester, setSemester] = useState("HK1-2026-2027");

  const { data, isLoading } = useQuery<MatrixResponse>({
    queryKey: ["teacher-reports", courseClassId, semester],
    queryFn: () =>
      api.get(`/teacher/reports/matrix?course_class_id=${courseClassId}&semester=${semester}`) as Promise<MatrixResponse>,
    enabled: !!courseClassId,
  });

  const kpis = data?.kpis;
  const matrix = data?.matrix ?? [];

  // Build session columns dynamically (up to 15)
  const maxSessions = Math.max(15, ...matrix.map((m) => m.sessions.length));
  const sessionColumns = Array.from({ length: maxSessions }, (_, i) => ({
    title: `B${i + 1}`,
    key: `session-${i}`,
    width: 52,
    align: "center" as const,
    render: (_: unknown, r: MatrixStudent) => {
      const status = r.sessions[i] as AttendanceStatus | undefined;
      if (!status) return <span className="text-text-muted">—</span>;
      return (
        <Tag
          className={`status-tag-${status}`}
          style={{ padding: "0 4px", fontSize: 11, margin: 0 }}
        >
          {status.charAt(0)}
        </Tag>
      );
    },
  }));

  const columns = [
    {
      title: "MSSV",
      dataIndex: "studentCode",
      key: "studentCode",
      width: 90,
      fixed: "left" as const,
      render: (code: string) => <Text strong>{code}</Text>,
    },
    {
      title: "Họ và tên",
      dataIndex: "fullName",
      key: "fullName",
      width: 160,
      fixed: "left" as const,
    },
    ...sessionColumns,
    {
      title: "Vắng",
      dataIndex: "totalAbsences",
      key: "totalAbsences",
      width: 60,
      fixed: "right" as const,
      render: (n: number) => <Text type={n >= 3 ? "danger" : undefined} strong>{n}</Text>,
    },
    {
      title: "Tỉ lệ %",
      dataIndex: "attendanceRate",
      key: "attendanceRate",
      width: 75,
      fixed: "right" as const,
      render: (rate: number) => (
        <Text strong style={{ color: rate >= 80 ? "#10b981" : rate >= 60 ? "#d97706" : "#dc2626" }}>
          {rate}%
        </Text>
      ),
    },
    {
      title: "Cấm thi",
      dataIndex: "isBannedFromExam",
      key: "isBannedFromExam",
      width: 80,
      fixed: "right" as const,
      render: (banned: boolean) =>
        banned ? (
          <Tag color="error" icon={<WarningOutlined />}>
            CẤM
          </Tag>
        ) : (
          <Tag color="success">OK</Tag>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card size="small">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <Text type="secondary">Mã lớp học phần:</Text>
            <Input
              value={courseClassId}
              onChange={(e) => setCourseClassId(e.target.value)}
              placeholder="VD: INT3401_02"
              style={{ width: 200, marginLeft: 8 }}
            />
          </div>
          <div>
            <Text type="secondary">Học kỳ:</Text>
            <Select
              value={semester}
              onChange={setSemester}
              style={{ width: 180, marginLeft: 8 }}
              options={[
                { value: "HK1-2026-2027", label: "HK1 (2026-2027)" },
                { value: "HK2-2025-2026", label: "HK2 (2025-2026)" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* KPIs */}
      {kpis && (
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}>
            <Card className="kpi-card">
              <Statistic
                title="Tỉ lệ chuyên cần TB"
                value={kpis.averageAttendanceRate}
                suffix="%"
                prefix={<BarChartOutlined />}
                valueStyle={{ color: "#2563eb" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="kpi-card">
              <Statistic
                title="Tăng trưởng"
                value={kpis.growthRate}
                suffix="%"
                prefix={<RiseOutlined />}
                valueStyle={{ color: kpis.growthRate >= 0 ? "#10b981" : "#dc2626" }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="kpi-card">
              <Statistic title="Buổi đã hoàn thành" value={kpis.completedSessions} prefix={<CalendarOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="kpi-card">
              <Statistic
                title="Sinh viên bị cấm thi"
                value={kpis.examBanCount}
                prefix={<WarningOutlined />}
                valueStyle={{ color: kpis.examBanCount > 0 ? "#dc2626" : "#10b981" }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Matrix Table */}
      <Card title="Ma trận điểm danh 15 buổi">
        <div className="mb-3 flex gap-3 flex-wrap">
          {(["PRESENT", "LATE", "ABSENT", "TRUANT", "EXCUSED"] as AttendanceStatus[]).map((s) => (
            <Tag key={s} className={`status-tag-${s}`}>{s.charAt(0)} = {statusLabels[s]}</Tag>
          ))}
        </div>
        <Table
          columns={columns}
          dataSource={matrix}
          rowKey="studentCode"
          loading={isLoading}
          pagination={false}
          scroll={{ x: 1400 }}
          size="small"
          bordered
        />
      </Card>
    </div>
  );
}
