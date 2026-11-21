'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  List,
  EditButton,
  ShowButton,
  DeleteButton,
  CreateButton,
  DateField,
} from '@refinedev/antd';
import {
  Table,
  Space,
  Tag,
  Input,
  Select,
  Button,
  Popconfirm,
  Row,
  Col,
  Card,
  Statistic,
  Tooltip,
  message,
  theme as antdTheme,
} from 'antd';
import type { TablePaginationConfig } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  BellOutlined,
  MailOutlined,
  CheckCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  UserOutlined,
  CrownOutlined,
  SafetyCertificateOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiClient } from '@/providers/dataProvider';
import { BulkSendModal, type BulkSendMode } from '@/components/BulkSendModal';

export default function UserList() {
  const { token } = antdTheme.useToken();
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{
    active: number;
    suspended: number;
    premium: number;
    admin: number;
  }>({ active: 0, suspended: 0, premium: 0, admin: 0 });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [rowActionLoading, setRowActionLoading] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [subFilter, setSubFilter] = useState<string | undefined>();
  const [lifeStageFilter, setLifeStageFilter] = useState<string | undefined>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const [bulkModal, setBulkModal] = useState<{ open: boolean; mode: BulkSendMode }>({
    open: false,
    mode: 'notification',
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: pageSize,
        sortBy,
        sortOrder,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (subFilter) params.subscriptionStatus = subFilter;
      if (lifeStageFilter) params.lifeStage = lifeStageFilter;

      const { data } = await apiClient.get('/admin/users/search', { params });
      setUsers(data?.data || []);
      setTotal(data?.total || 0);
      if (data?.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Kullanıcılar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder, search, statusFilter, subFilter, lifeStageFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSingleStatusToggle = async (record: any) => {
    const nextStatus = record.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    setRowActionLoading(record.id);
    try {
      await apiClient.patch(`/users/${record.id}`, { status: nextStatus });
      message.success(
        nextStatus === 'SUSPENDED'
          ? `${record.email} askıya alındı (mobil oturum geçersiz kılındı)`
          : `${record.email} tekrar aktifleştirildi`,
      );
      fetchUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Durum güncellenemedi');
    } finally {
      setRowActionLoading(null);
    }
  };

  const handleBulkStatus = async (status: 'ACTIVE' | 'SUSPENDED') => {
    if (selectedRowKeys.length === 0) return;
    try {
      const { data } = await apiClient.post('/admin/bulk/update-users', {
        userIds: selectedRowKeys,
        data: { status },
      });
      message.success(`${data?.success ?? selectedRowKeys.length} kullanıcı güncellendi`);
      setSelectedRowKeys([]);
      fetchUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Toplu güncelleme başarısız');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      const { data } = await apiClient.post('/admin/bulk/delete-users', {
        userIds: selectedRowKeys,
      });
      message.success(`${data?.success ?? selectedRowKeys.length} kullanıcı silindi`);
      setSelectedRowKeys([]);
      fetchUsers();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Toplu silme başarısız');
    }
  };

  const handleExportCsv = () => {
    if (users.length === 0) {
      message.warning('Dışa aktarılacak kullanıcı bulunamadı');
      return;
    }
    const headers = [
      'ID',
      'E-posta',
      'Kullanıcı Adı',
      'Görünen Ad',
      'Durum',
      'Yetki',
      'Abonelik',
      'PIN',
      'Son IP',
      'Cihaz Modeli',
      'İşletim Sistemi',
      'Uygulama Sürümü',
      'Son Görülme',
      'Döngü',
      'Sohbet',
      'Hata Kaydı',
      'Kayıt Tarihi',
    ];
    const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csv = [
      headers.map(escapeCsv).join(','),
      ...users.map((u) =>
        [
          u.id,
          u.email,
          u.username || '',
          u.profile?.displayName || '',
          u.status,
          u.isAdmin ? 'Admin' : 'Kullanıcı',
          u.subscription?.status || 'FREE',
          u.pinEnabled ? 'Aktif' : 'Pasif',
          u.lastIpAddress || '',
          u.lastDeviceModel || '',
          u.lastOsVersion || '',
          u.lastAppVersion || '',
          u.lastSeenAt ? dayjs(u.lastSeenAt).format('YYYY-MM-DD HH:mm:ss') : '',
          u._count?.periodCycles ?? 0,
          u._count?.conversations ?? 0,
          u._count?.errorLogs ?? 0,
          dayjs(u.createdAt).format('YYYY-MM-DD HH:mm'),
        ]
          .map(escapeCsv)
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kullanicilar-${dayjs().format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success(`${users.length} kullanıcı CSV olarak indirildi`);
  };

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: any,
    sorter: any,
  ) => {
    setPage(pagination.current || 1);
    setPageSize(pagination.pageSize || 10);
    if (sorter && sorter.field && ['email', 'status', 'createdAt'].includes(sorter.field)) {
      setSortBy(sorter.field);
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    }
  };

  const columns = [
    {
      title: 'Kullanıcı',
      dataIndex: 'email',
      key: 'email',
      sorter: true,
      render: (_: any, record: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {record.profile?.displayName || 'Anonim'}{' '}
            {record.username && (
              <span style={{ color: '#8c8c8c', fontWeight: 400 }}>@{record.username}</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.email}</div>
        </div>
      ),
    },
    {
      title: 'Durum',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      render: (value: string) => {
        const labels: Record<string, string> = {
          ACTIVE: 'Aktif',
          SUSPENDED: 'Askıya Alındı',
          DELETED: 'Silindi',
        };
        return (
          <Tag color={value === 'ACTIVE' ? 'green' : value === 'SUSPENDED' ? 'orange' : 'red'}>
            {labels[value] || value}
          </Tag>
        );
      },
    },
    {
      title: 'Yetki & Güvenlik',
      key: 'flags',
      render: (_: any, record: any) => (
        <Space size={4} wrap>
          <Tag color={record.isAdmin ? 'purple' : 'default'}>
            {record.isAdmin ? 'Admin' : 'Kullanıcı'}
          </Tag>
          {record.pinEnabled && <Tag color="blue">PIN</Tag>}
          {record.pregnancy?.isActive && <Tag color="magenta">Hamile</Tag>}
          {record.profile?.lifeStage === 'POSTPARTUM' && <Tag color="volcano">Anne &amp; Bebek</Tag>}
          {record.profile?.lifeStage === 'FERTILITY' && <Tag color="cyan">Doğurganlık</Tag>}
        </Space>
      ),
    },
    {
      title: 'Abonelik',
      dataIndex: ['subscription', 'status'],
      key: 'subscription',
      render: (value: string, record: any) => {
        const status = value || 'FREE';
        const labels: Record<string, string> = {
          FREE: 'Ücretsiz',
          TRIAL: 'Deneme',
          ACTIVE: 'Premium',
          EXPIRED: 'Süresi Doldu',
          CANCELLED: 'İptal Edildi',
          GRACE_PERIOD: 'Ek Süre',
        };
        return (
          <Space size={4}>
            <Tag color={status === 'ACTIVE' ? 'gold' : status === 'TRIAL' ? 'blue' : 'default'}>
              {labels[status] || status}
            </Tag>
            {record.subscription?.tier && (
              <Tag color="purple">{record.subscription.tier}</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Cihaz / IP / Sürüm',
      key: 'telemetry',
      render: (_: any, record: any) => (
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          <div>
            <strong>IP:</strong>{' '}
            {record.lastIpAddress ? (
              <code>{record.lastIpAddress}</code>
            ) : (
              <span style={{ color: '#8c8c8c' }}>—</span>
            )}
          </div>
          <div style={{ color: '#595959' }}>
            {record.lastDeviceModel || '—'} · {record.lastOsVersion || '—'}
          </div>
          <Space size={4} wrap style={{ marginTop: 2 }}>
            {record.lastAppVersion && <Tag color="geekblue">v{record.lastAppVersion}</Tag>}
            {(record._count?.errorLogs ?? 0) > 0 && (
              <Tag color="red">{record._count.errorLogs} hata</Tag>
            )}
            {(record._count?.refreshTokens ?? 0) > 0 && (
              <Tag color="cyan">{record._count.refreshTokens} JWT</Tag>
            )}
          </Space>
        </div>
      ),
    },
    {
      title: 'Aktivite',
      key: 'activity',
      render: (_: any, record: any) => (
        <span style={{ fontSize: 12, color: '#595959' }}>
          {record._count?.periodCycles ?? 0} döngü · {record._count?.dailyLogs ?? 0} günlük ·{' '}
          {record._count?.conversations ?? 0} NOVA
        </span>
      ),
    },
    {
      title: 'Kayıt Tarihi',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      render: (value: string) => <DateField value={value} format="DD.MM.YYYY" />,
    },
    {
      title: 'İşlemler',
      key: 'actions',
      render: (_: any, record: any) => {
        const isSuspended = record.status === 'SUSPENDED';
        return (
          <Space size={4}>
            <ShowButton hideText size="small" recordItemId={record.id} />
            <EditButton hideText size="small" recordItemId={record.id} />
            <Popconfirm
              title={
                isSuspended
                  ? `${record.email} yeniden aktifleştirilsin mi?`
                  : `${record.email} askıya alınsın mı?`
              }
              description={
                isSuspended
                  ? 'Kullanıcı mobil uygulamaya tekrar giriş yapabilecek.'
                  : 'Mobil oturumu sonlandırılır ve yeniden girişi engellenir.'
              }
              onConfirm={() => handleSingleStatusToggle(record)}
              okText={isSuspended ? 'Aktifleştir' : 'Askıya Al'}
              cancelText="İptal"
            >
              <Tooltip title={isSuspended ? 'Aktifleştir' : 'Askıya Al'}>
                <Button
                  size="small"
                  loading={rowActionLoading === record.id}
                  icon={isSuspended ? <CheckCircleOutlined /> : <StopOutlined />}
                  danger={!isSuspended}
                  type={isSuspended ? 'primary' : 'default'}
                />
              </Tooltip>
            </Popconfirm>
            <DeleteButton
              hideText
              size="small"
              recordItemId={record.id}
              onSuccess={() => fetchUsers()}
            />
          </Space>
        );
      },
    },
  ];

  return (
    <List
      title="Kullanıcılar"
      headerButtons={({ defaultButtons }) => (
        <>
          <CreateButton>Yeni Kullanıcı</CreateButton>
          <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
            CSV İndir
          </Button>
          {defaultButtons}
        </>
      )}
    >
      {/* Live KPI Summary Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable onClick={() => { setStatusFilter(undefined); setSubFilter(undefined); setPage(1); }}>
            <Statistic
              title="Aktif Hesap"
              value={stats.active}
              prefix={<UserOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable onClick={() => { setStatusFilter('SUSPENDED'); setPage(1); }}>
            <Statistic
              title="Askıya Alınan"
              value={stats.suspended}
              prefix={<StopOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable onClick={() => { setSubFilter('ACTIVE'); setStatusFilter('ACTIVE'); setPage(1); }}>
            <Statistic
              title="Premium Üye"
              value={stats.premium}
              prefix={<CrownOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Yönetici (Admin)"
              value={stats.admin}
              prefix={<SafetyCertificateOutlined style={{ color: '#722ed1' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* Search & Filters */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="E-posta, kullanıcı adı, isim veya IP/cihaz ara..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ width: 260 }}
          allowClear
        />
        <Select
          placeholder="Hesap Durumu"
          allowClear
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          style={{ width: 150 }}
          options={[
            { label: 'Aktif', value: 'ACTIVE' },
            { label: 'Askıda', value: 'SUSPENDED' },
            { label: 'Silindi', value: 'DELETED' },
          ]}
        />
        <Select
          placeholder="Abonelik"
          allowClear
          value={subFilter}
          onChange={(val) => {
            setSubFilter(val);
            setPage(1);
          }}
          style={{ width: 150 }}
          options={[
            { label: 'Aktif (Premium)', value: 'ACTIVE' },
            { label: 'Deneme', value: 'TRIAL' },
            { label: 'Ücretsiz', value: 'FREE' },
            { label: 'Süresi Dolmuş', value: 'EXPIRED' },
            { label: 'İptal Edilmiş', value: 'CANCELLED' },
          ]}
        />
        <Select
          placeholder="Yaşam Evresi"
          allowClear
          value={lifeStageFilter}
          onChange={(val) => {
            setLifeStageFilter(val);
            setPage(1);
          }}
          style={{ width: 165 }}
          options={[
            { label: 'Döngü (CYCLE)', value: 'CYCLE' },
            { label: 'Doğurganlık (FERTILITY)', value: 'FERTILITY' },
            { label: 'Hamilelik (PREGNANCY)', value: 'PREGNANCY' },
            { label: 'Anne & Bebek (POSTPARTUM)', value: 'POSTPARTUM' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={fetchUsers}>
          Yenile
        </Button>
      </Space>

      {/* Bulk Action Bar */}
      {selectedRowKeys.length > 0 && (
        <Space
          wrap
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            background: token.colorPrimaryBg,
            border: `1px solid ${token.colorPrimaryBorder}`,
            borderRadius: 10,
            width: '100%',
          }}
        >
          <strong>{selectedRowKeys.length} kullanıcı seçili:</strong>
          <Button
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => handleBulkStatus('ACTIVE')}
          >
            Aktifleştir
          </Button>
          <Button
            size="small"
            icon={<StopOutlined />}
            onClick={() => handleBulkStatus('SUSPENDED')}
          >
            Askıya Al
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<BellOutlined />}
            onClick={() => setBulkModal({ open: true, mode: 'notification' })}
          >
            Bildirim Gönder
          </Button>
          <Button
            size="small"
            icon={<MailOutlined />}
            onClick={() => setBulkModal({ open: true, mode: 'email' })}
          >
            E-posta Gönder
          </Button>
          <Popconfirm
            title={`${selectedRowKeys.length} kullanıcıyı kalıcı olarak silmek istediğinize emin misiniz?`}
            onConfirm={handleBulkDelete}
            okText="Sil"
            cancelText="İptal"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Toplu Sil
            </Button>
          </Popconfirm>
        </Space>
      )}

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        onChange={handleTableChange}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys.map(String)),
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t, range) => `${range[0]}-${range[1]} / ${t} kullanıcı`,
        }}
        scroll={{ x: 1220 }}
      />

      <BulkSendModal
        open={bulkModal.open}
        mode={bulkModal.mode}
        userIds={selectedRowKeys}
        onClose={() => setBulkModal((prev) => ({ ...prev, open: false }))}
        onSuccess={() => setSelectedRowKeys([])}
      />
    </List>
  );
}
