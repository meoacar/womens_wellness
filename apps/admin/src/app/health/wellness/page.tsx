'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Statistic,
  Row,
  Col,
  Tag,
  Space,
  Input,
  Button,
  Typography,
  message,
} from 'antd';
import {
  HeartOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/providers/dataProvider';

const { Title, Text } = Typography;

export default function WellnessDataPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({
    totalSteps: 0,
    totalMeditation: 0,
    totalSleep: 0,
    totalWater: 0,
    totalDailyLogs: 0,
    totalHealthMetrics: 0,
    activeUsers7d: 0,
    activePushUsersCount: 0,
    todayStepUsersCount: 0,
  });
  const [records, setRecords] = useState<{
    steps: any[];
    water: any[];
    sleep: any[];
    meditation: any[];
    dailyLogs: any[];
    metrics: any[];
  }>({
    steps: [],
    water: [],
    sleep: [],
    meditation: [],
    dailyLogs: [],
    metrics: [],
  });

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 60 };
      if (search.trim()) params.search = search.trim();
      const { data } = await apiClient.get('/wellness/v1/admin/overview', { params });
      if (data?.stats) setStats(data.stats);
      if (data?.records) setRecords(data.records);
    } catch {
      message.error('Wellness ve sağlık verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const renderUserCell = (_: any, record: any) =>
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
    );

  const stepsColumns = [
    { title: 'Kullanıcı', key: 'user', render: renderUserCell },
    {
      title: 'Tarih',
      dataIndex: 'date',
      key: 'date',
      render: (d: string) => dayjs(d).format('DD.MM.YYYY'),
    },
    {
      title: 'Adım Sayısı',
      dataIndex: 'count',
      key: 'count',
      render: (c: number) => <Tag color="blue">{c.toLocaleString('tr-TR')} adım</Tag>,
    },
    {
      title: 'Kaynak',
      dataIndex: 'source',
      key: 'source',
      render: (s: string) => <Tag>{s || 'manual'}</Tag>,
    },
  ];

  const waterColumns = [
    { title: 'Kullanıcı', key: 'user', render: renderUserCell },
    {
      title: 'Tarih & Saat',
      dataIndex: 'loggedAt',
      key: 'loggedAt',
      render: (d: string) => dayjs(d).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Miktar',
      dataIndex: 'amountMl',
      key: 'amountMl',
      render: (ml: number) => <Tag color="cyan">{ml} ml</Tag>,
    },
  ];

  const sleepColumns = [
    { title: 'Kullanıcı', key: 'user', render: renderUserCell },
    {
      title: 'Uyku Tarihi',
      dataIndex: 'sleepDate',
      key: 'sleepDate',
      render: (d: string) => dayjs(d).format('DD.MM.YYYY'),
    },
    {
      title: 'Süre',
      dataIndex: 'durationMin',
      key: 'durationMin',
      render: (min: number) => `${(min / 60).toFixed(1)} saat (${min} dk)`,
    },
    {
      title: 'Kalite',
      dataIndex: 'quality',
      key: 'quality',
      render: (q: string) => {
        if (!q) return '-';
        const color = q === 'good' ? 'green' : q === 'medium' ? 'gold' : 'red';
        const label = q === 'good' ? 'İyi' : q === 'medium' ? 'Orta' : 'Zayıf';
        return <Tag color={color}>{label}</Tag>;
      },
    },
  ];

  const meditationColumns = [
    { title: 'Kullanıcı', key: 'user', render: renderUserCell },
    {
      title: 'Tarih',
      dataIndex: 'date',
      key: 'date',
      render: (d: string) => dayjs(d).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Tür',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => {
        const label = t === 'breath' ? '4-7-8 Nefes' : t === 'guided' ? 'Rehberli' : 'Özel';
        return <Tag color="purple">{label}</Tag>;
      },
    },
    {
      title: 'Süre',
      dataIndex: 'durationMin',
      key: 'durationMin',
      render: (m: number) => <Tag color="green">{m} dk</Tag>,
    },
  ];

  const dailyLogsColumns = [
    { title: 'Kullanıcı', key: 'user', render: renderUserCell },
    {
      title: 'Tarih',
      dataIndex: 'date',
      key: 'date',
      render: (d: string) => dayjs(d).format('DD.MM.YYYY'),
    },
    {
      title: 'Ruh Hali',
      dataIndex: 'mood',
      key: 'mood',
      render: (moods: string[]) =>
        moods?.length ? (
          <Space wrap>
            {moods.map((m) => (
              <Tag key={m} color="purple">{m}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: 'Belirtiler',
      dataIndex: 'symptoms',
      key: 'symptoms',
      render: (syms: string[]) =>
        syms?.length ? (
          <Space wrap>
            {syms.map((s) => (
              <Tag key={s} color="pink">{s}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: 'Not',
      dataIndex: 'healthNotes',
      key: 'healthNotes',
      render: (n: string) => n || '-',
    },
  ];

  const metricsColumns = [
    { title: 'Kullanıcı', key: 'user', render: renderUserCell },
    {
      title: 'Ölçüm Türü',
      dataIndex: 'kind',
      key: 'kind',
      render: (k: string) => <Tag color="geekblue">{k}</Tag>,
    },
    {
      title: 'Sonuç',
      dataIndex: 'valueJson',
      key: 'valueJson',
      render: (v: any) => {
        if (!v) return '-';
        if (v.bmi) return `BMI: ${v.bmi} (${v.category || ''})`;
        if (v.bmr) return `BMR: ${v.bmr} kcal${v.tdee ? ` / TDEE: ${Math.round(v.tdee)}` : ''}`;
        return JSON.stringify(v);
      },
    },
    {
      title: 'Tarih',
      dataIndex: 'measuredAt',
      key: 'measuredAt',
      render: (d: string) => dayjs(d).format('DD.MM.YYYY HH:mm'),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <HeartOutlined style={{ marginRight: 8, color: '#7C3AED' }} />
            Wellness & Günlük Sağlık Verileri
          </Title>
          <Text type="secondary">
            Mobil uygulamadan kaydedilen adım, su, uyku, 4-7-8 nefes, günlük check-in ve vücut ölçüm kayıtları.
          </Text>
        </Col>
        <Col>
          <Space wrap>
            <Input
              placeholder="Kullanıcı e-posta veya kullanıcı adı..."
              prefix={<SearchOutlined />}
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 260 }}
            />
            <Button icon={<ReloadOutlined />} onClick={fetchOverview} loading={loading}>
              Yenile
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={4}>
          <Card>
            <Statistic
              title="Toplam Adım"
              value={stats.totalSteps}
              loading={loading}
              prefix={<ThunderboltOutlined style={{ color: '#3B82F6' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card>
            <Statistic
              title="Toplam Su (ml)"
              value={stats.totalWater}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card>
            <Statistic
              title="Toplam Uyku (saat)"
              value={stats.totalSleep}
              loading={loading}
              prefix={<ClockCircleOutlined style={{ color: '#6366F1' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card>
            <Statistic
              title="Meditasyon / Nefes (dk)"
              value={stats.totalMeditation}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card>
            <Statistic
              title="Günlük Check-in"
              value={stats.totalDailyLogs}
              loading={loading}
              prefix={<CheckCircleOutlined style={{ color: '#10B981' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card>
            <Statistic
              title="Son 7 Gün Aktif Kişi"
              value={stats.activeUsers7d}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card>
            <Statistic
              title="Bugün Adım Kaydı"
              value={stats.todayStepUsersCount}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={4}>
          <Card>
            <Statistic
              title="Push Bildirimi Aktif"
              value={stats.activePushUsersCount}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          defaultActiveKey="steps"
          items={[
            {
              key: 'steps',
              label: `Adım (${records.steps.length})`,
              children: (
                <Table
                  dataSource={records.steps}
                  columns={stepsColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'water',
              label: `Su (${records.water.length})`,
              children: (
                <Table
                  dataSource={records.water}
                  columns={waterColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'sleep',
              label: `Uyku (${records.sleep.length})`,
              children: (
                <Table
                  dataSource={records.sleep}
                  columns={sleepColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'meditation',
              label: `Meditasyon & Nefes (${records.meditation.length})`,
              children: (
                <Table
                  dataSource={records.meditation}
                  columns={meditationColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'dailyLogs',
              label: `Günlük Check-in & Semptom (${records.dailyLogs.length})`,
              children: (
                <Table
                  dataSource={records.dailyLogs}
                  columns={dailyLogsColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'metrics',
              label: `BMI & Vücut Ölçümleri (${records.metrics.length})`,
              children: (
                <Table
                  dataSource={records.metrics}
                  columns={metricsColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
