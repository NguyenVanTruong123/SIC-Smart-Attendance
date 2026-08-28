import { useState } from "react";
import { Card, Table, Tag, Row, Col, Statistic, Input, DatePicker, Modal, Descriptions, Image, Typography } from "antd";
import { SearchOutlined, EyeOutlined, AuditOutlined, SwapOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";
import { statusLabels, type AttendanceStatus, type AuditRecord, type AuditKpis, type AuditDetail, type Pagination } from "@/types";

const { Text } = Typography;
const { RangePicker } = DatePicker;

// =============================================================================
// Admin: Audit Logs — GET /api/v1/admin/audit-logs (§3.3)
// =============================================================================

interface AuditListResponse {
  kpis: AuditKpis;
  items: AuditRecord[];
  pagination?: Pagination;
}

export function AdminAuditLogs() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<AuditListResponse>({
    queryKey: ["admin-audit-logs", search, page],
    queryFn: () =>
      api.get(`/admin/audit-logs?student_code=${search}&page=${page}&limit=15`) as Promise<AuditListResponse>,
  });

  const { data: detail } = useQuery<AuditDetail>({
    queryKey: ["admin-audit-detail", detailId],
    queryFn: () => api.get(`/admin/audit-logs/${detailId}`) as Promise<AuditDetail>,
    enabled: !!detailId,
  });

  const kpis = data?.kpis;

  const columns = [
    {
      title: "Thời gian",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 160,
      render: (t: string) => new Date(t).toLocaleString("vi-VN"),
    },
    { title: "Người thực hiện", dataIndex: "actorName", key: "actorName", width: 160 },
    {
      title: "Sinh viên",
      key: "student",
      render: (_: unknown, r: AuditRecord) => (
        <div>
          <Text strong>{r.studentCode}</Text>
          <br />
          <Text type="secondary" className="text-xs">{r.studentName}</Text>
        </div>
      ),
    },
    { title: "Lớp HP", dataIndex: "courseClassName", key: "courseClassName", ellipsis: true },
    {
      title: "Thay đổi",
      key: "change",
      width: 200,
      render: (_: unknown, r: AuditRecord) => (
        <div className="flex items-center gap-2">
          <Tag className={`status-tag-${r.oldStatus}`}>{statusLabels[r.oldStatus]}</Tag>
          <SwapOutlined />
          <Tag className={`status-tag-${r.newStatus}`}>{statusLabels[r.newStatus]}</Tag>
        </div>
      ),
    },
    {
      title: "",
      key: "action",
      width: 70,
      render: (_: unknown, r: AuditRecord) => (
        <a onClick={() => setDetailId(r.id)}>
          <EyeOutlined /> Chi tiết
        </a>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {kpis && (
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8}>
            <Card className="kpi-card">
              <Statistic title="Tổng can thiệp thủ công" value={kpis.totalOverrides} prefix={<AuditOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card className="kpi-card">
              <Statistic title="Sửa → Có mặt" value={kpis.overridesToPresent} valueStyle={{ color: "#10b981" }} />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card className="kpi-card">
              <Statistic title="Sửa → Có phép" value={kpis.overridesToExcused} valueStyle={{ color: "#0284c7" }} />
            </Card>
          </Col>
        </Row>
      )}

      {/* Main Table */}
      <Card
        title="Nhật ký vết can thiệp thủ công"
        extra={
          <Input
            placeholder="Tìm theo MSSV..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
        }
      >
        <Table
          columns={columns}
          dataSource={data?.items ?? []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: 15,
            total: data?.pagination?.totalItems,
            onChange: setPage,
          }}
          size="middle"
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Chi tiết bản ghi vết"
        open={!!detailId}
        onCancel={() => setDetailId(null)}
        footer={null}
        width={600}
      >
        {detail && (
          <>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Thời gian">{new Date(detail.timestamp).toLocaleString("vi-VN")}</Descriptions.Item>
              <Descriptions.Item label="Người thực hiện">{detail.actor.name} ({detail.actor.role})</Descriptions.Item>
              <Descriptions.Item label="Sinh viên">{detail.student.name} ({detail.student.code})</Descriptions.Item>
              <Descriptions.Item label="Lớp">{detail.student.class}</Descriptions.Item>
              <Descriptions.Item label="Ca học">{detail.session.room} · {detail.session.time}</Descriptions.Item>
              <Descriptions.Item label="Thay đổi">
                <Tag className={`status-tag-${detail.change.from}`}>{statusLabels[detail.change.from]}</Tag>
                {" → "}
                <Tag className={`status-tag-${detail.change.to}`}>{statusLabels[detail.change.to]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Lý do" span={2}>{detail.reason}</Descriptions.Item>
            </Descriptions>
            {detail.cctvClassroomSnapshotUrl && (
              <div className="mt-4">
                <Text strong>Ảnh CCTV bằng chứng:</Text>
                <br />
                <Image src={detail.cctvClassroomSnapshotUrl} width={300} alt="CCTV Evidence" className="mt-2" />
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
