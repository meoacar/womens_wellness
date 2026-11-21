'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Row,
  Col,
  Statistic,
  Input,
  Space,
  Typography,
  message,
} from 'antd';
import {
  ReloadOutlined,
  SearchOutlined,
  SmileOutlined,
  HeartOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/providers/dataProvider';

const { Title, Text } = Typography;

export default function PostpartumList() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({
    totalBabies: 0,
    postpartumUsersCount: 0,
    totalFeedings: 0,
    totalDiapers: 0,
    totalSleeps: 0,
    completedVaccines: 0,
  });

  const fetchPostpartum = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: pageSize };
      if (search.trim()) params.search = search.trim();
      const { data } = await apiClient.get('/postpartum/admin/all', { params });
      setRecords(data?.data || []);
      setTotal(data?.total || 0);
      if (data?.stats) setStats(data.stats);
    } catch {
      message.error('Anne & Bebek kayıtları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchPostpartum();
  }, [fetchPostpartum]);

  const columns = [
    {
      title: 'Kullanıcı',
      key: 'user',
      render: (_: any, record: any) =>
        record.user ? (
          <Button
            type="link"
            style={{ padding: 0 }}
            onClick={() => router.push(`/users/show/${record.user.id}`)}
          >
            {record.user.email}
            {record.user.username ? ` (@${record.user.username})` : ''}
          </Button>
        ) : (
          record.userId
        ),
    },
    {
      title: 'Bebek',
      key: 'baby',
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Doğum: {dayjs(record.birthDate).format('DD.MM.YYYY')}
            {record.gender ? ` · ${record.gender}` : ''}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Yaşam Evresi',
      key: 'lifeStage',
      render: (_: any, record: any) => {
        const stage = record.user?.profile?.lifeStage || 'CYCLE';
        return (
          <Tag color={stage === 'POSTPARTUM' ? 'purple' : 'default'}>
            {stage}
          </Tag>
        );
      },
    },
    {
      title: 'Doğum Ölçümleri',
      key: 'birthStats',
      render: (_: any, record: any) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.birthWeightGr ? `${record.birthWeightGr} g` : '—'} ·{' '}
          {record.birthHeightCm ? `${record.birthHeightCm} cm` : '—'}
        </Text>
      ),
    },
    {
      title: 'Günlük Kayıtlar',
      key: 'counts',
      render: (_: any, record: any) => (
        <Space size={4} wrap>
          <Tag color="pink">{record._count?.feedingLogs ?? 0} beslenme</Tag>
          <Tag color="cyan">{record._count?.diaperLogs ?? 0} bez</Tag>
          <Tag color="blue">{record._count?.sleepLogs ?? 0} uyku</Tag>
          <Tag color="green">{record._count?.growthLogs ?? 0} büyüme</Tag>
        </Space>
      ),
    },
    {
      title: 'Aşı Takvimi',
      key: 'vaccines',
      render: (_: any, record: any) => (
        <Tag color="gold">
          {record.completedVaccinesCount ?? 0} / {record._count?.vaccineRecords ?? 0} tamamlandı
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Anne &amp; Bebek (Lohusalık) Takibi
          </Title>
          <Text type="secondary">
            Bebek profilleri, beslenme/uyku/bez kayıtları ve aşı takvimi özeti
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchPostpartum}>
          Yenile
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Lohusalık Modu Kullanıcı"
              value={stats.postpartumUsersCount}
              prefix={<HeartOutlined style={{ color: '#eb2f96' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Bebek Profili"
              value={stats.totalBabies}
              prefix={<SmileOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Beslenme + Uyku Kaydı"
              value={stats.totalFeedings + stats.totalSleeps}
              prefix={<ClockCircleOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Tamamlanan Aşı"
              value={stats.completedVaccines}
              prefix={<SafetyCertificateOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="Bebek adı, e-posta veya kullanıcı adı ara..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            style={{ width: 300 }}
            allowClear
          />
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={records}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>
    </div>
  );
}
