'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  HeartOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiClient } from '@/providers/dataProvider';

const { Title, Text, Paragraph } = Typography;

type Tone = 'empathy' | 'pain_relief' | 'self_care' | 'hydration' | 'motivation';
type DayRange = 'all' | 'early_heavy' | 'mid_late';

interface PeriodMessage {
  id: string;
  titleTr: string;
  titleEn: string;
  messageTr: string;
  messageEn: string;
  emoji: string;
  tone: Tone;
  dayRange: DayRange;
  active: boolean;
  order: number;
}

interface PeriodConfig {
  enabled: boolean;
  defaultSendHours: number[];
  maxPerDay: number;
  periodWindowDays: number;
  messages: PeriodMessage[];
  updatedAt: string;
}

interface DispatchRun {
  timestamp: string;
  trigger: 'cron' | 'manual';
  totalActivePeriodUsers: number;
  sent: number;
  queued?: number;
  skippedNoToken: number;
  skippedQuietOrHour: number;
  skippedDailyLimit: number;
  failed: number;
}

interface PeriodStats {
  activePeriodUsersCount: number;
  pushReadyUsersCount: number;
  activeMessagesCount: number;
  totalMessagesCount: number;
  recentRuns: DispatchRun[];
}

const TONE_LABELS: Record<Tone, { label: string; color: string }> = {
  empathy: { label: 'Empati & Yanındayım', color: 'magenta' },
  pain_relief: { label: 'Ağrı & Kramp Rahatlatma', color: 'volcano' },
  self_care: { label: 'Öz Bakım & Dinlenme', color: 'purple' },
  hydration: { label: 'Su & Beslenme', color: 'cyan' },
  motivation: { label: 'Hafif Hareket & Moral', color: 'green' },
};

const RANGE_LABELS: Record<DayRange, { label: string; color: string }> = {
  all: { label: 'Tüm Regl Dönemi (1-7. Gün)', color: 'blue' },
  early_heavy: { label: 'Yoğun Ağrı Günleri (1-3. Gün)', color: 'red' },
  mid_late: { label: 'Toparlanma Günleri (4-7. Gün)', color: 'gold' },
};

const HOUR_OPTIONS = Array.from({ length: 16 }, (_, idx) => {
  const hour = idx + 7;
  return {
    value: hour,
    label: `${String(hour).padStart(2, '0')}:00`,
  };
});

export default function PeriodMessagesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [config, setConfig] = useState<PeriodConfig | null>(null);
  const [stats, setStats] = useState<PeriodStats | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingMsg, setEditingMsg] = useState<PeriodMessage | null>(null);
  const [msgForm] = Form.useForm();

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testMessageId, setTestMessageId] = useState<string | undefined>();
  const [testTarget, setTestTarget] = useState('');
  const [testing, setTesting] = useState(false);
  const [testUsers, setTestUsers] = useState<Array<{ id: string; email: string; displayName?: string; hasToken: boolean }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const loadTestUsers = async (query = '') => {
    setLoadingUsers(true);
    try {
      const res = await apiClient.get(`/admin/users/search?limit=50${query ? `&search=${encodeURIComponent(query)}` : ''}`);
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setTestUsers(
        list.map((u: any) => ({
          id: u.id,
          email: u.email,
          displayName: u.profile?.displayName || u.username || u.email,
          hasToken: Boolean(u.profile?.preferencesJson?.pushToken),
        })),
      );
    } catch {
      // Optional user list fallback
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (testModalOpen && testUsers.length === 0) {
      void loadTestUsers();
    }
  }, [testModalOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/period-notifications/admin');
      setConfig(res.data.config);
      setStats(res.data.stats);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Regl bildirimi ayarları yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const persistConfig = async (nextConfig: PeriodConfig, successText?: string) => {
    setSaving(true);
    try {
      const res = await apiClient.put('/period-notifications/admin', nextConfig);
      setConfig(res.data.config);
      setStats(res.data.stats);
      if (successText) message.success(successText);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Değişiklikler kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingMsg(null);
    msgForm.setFieldsValue({
      emoji: '🤍',
      titleTr: '',
      messageTr: '',
      titleEn: '',
      messageEn: '',
      tone: 'empathy',
      dayRange: 'all',
      active: true,
    });
    setEditModalOpen(true);
  };

  const handleOpenEdit = (record: PeriodMessage) => {
    setEditingMsg(record);
    msgForm.setFieldsValue(record);
    setEditModalOpen(true);
  };

  const handleSaveMessage = async () => {
    if (!config) return;
    try {
      const values = await msgForm.validateFields();
      let updatedMessages: PeriodMessage[];

      if (editingMsg) {
        updatedMessages = config.messages.map((m) =>
          m.id === editingMsg.id
            ? {
                ...m,
                ...values,
                titleEn: values.titleEn?.trim() || values.titleTr.trim(),
                messageEn: values.messageEn?.trim() || values.messageTr.trim(),
              }
            : m,
        );
      } else {
        const newMsg: PeriodMessage = {
          id: `period_${Date.now()}`,
          titleTr: values.titleTr.trim(),
          titleEn: values.titleEn?.trim() || values.titleTr.trim(),
          messageTr: values.messageTr.trim(),
          messageEn: values.messageEn?.trim() || values.messageTr.trim(),
          emoji: values.emoji?.trim() || '💕',
          tone: values.tone || 'empathy',
          dayRange: values.dayRange || 'all',
          active: values.active !== false,
          order: config.messages.length + 1,
        };
        updatedMessages = [...config.messages, newMsg];
      }

      await persistConfig(
        { ...config, messages: updatedMessages },
        editingMsg ? 'Bildirim mesajı güncellendi' : 'Yeni bildirim mesajı eklendi',
      );
      setEditModalOpen(false);
    } catch {
      // Antd form validation errors shown inline
    }
  };

  const handleToggleMessage = async (id: string, active: boolean) => {
    if (!config) return;
    const updatedMessages = config.messages.map((m) =>
      m.id === id ? { ...m, active } : m,
    );
    await persistConfig(
      { ...config, messages: updatedMessages },
      active ? 'Mesaj aktif edildi' : 'Mesaj pasife alındı',
    );
  };

  const handleDeleteMessage = async (id: string) => {
    if (!config) return;
    const updatedMessages = config.messages
      .filter((m) => m.id !== id)
      .map((m, idx) => ({ ...m, order: idx + 1 }));
    await persistConfig({ ...config, messages: updatedMessages }, 'Mesaj silindi');
  };

  const handleMoveOrder = async (index: number, direction: -1 | 1) => {
    if (!config) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= config.messages.length) return;
    const next = [...config.messages];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    const reindexed = next.map((m, i) => ({ ...m, order: i + 1 }));
    await persistConfig({ ...config, messages: reindexed });
  };

  const handleResetDefaults = async () => {
    setSaving(true);
    try {
      const res = await apiClient.post('/period-notifications/admin/reset');
      setConfig(res.data.config);
      setStats(res.data.stats);
      message.success('Varsayılan mesaj havuzu ve ayarlar geri yüklendi');
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Sıfırlama başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleDispatchNow = async () => {
    setDispatching(true);
    try {
      const res = await apiClient.post('/period-notifications/admin/dispatch-now');
      const s = res.data.summary;
      setStats(res.data.stats);
      if (!s || s.totalActivePeriodUsers === 0) {
        message.info(
          'Şu an aktif regl dönemindeki kullanıcı bulunamadı. Belirli bir kullanıcıya denemek için "Test Gönder" butonunu kullanabilirsiniz.',
        );
      } else {
        message.success(
          `Gönderim tamamlandı (${s.totalActivePeriodUsers} kullanıcı): ${s.sent || 0} Expo Push gönderildi, ${s.queued || 0} cihaz bildirim kuyruğuna eklendi.`,
        );
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Toplu gönderim başarısız');
    } finally {
      setDispatching(false);
    }
  };

  const handleSendTest = async () => {
    if (!testTarget.trim()) {
      message.warning('Lütfen hedef kullanıcı seçin veya e-posta/ID girin');
      return;
    }
    setTesting(true);
    try {
      const res = await apiClient.post('/period-notifications/admin/send-test', {
        userIdOrEmail: testTarget.trim(),
        messageId: testMessageId,
      });
      if (res.data.status === 'ok' || res.data.status === 'queued') {
        message.success(
          res.data.message || `Test bildirimi ${res.data.user?.email} kullanıcısına iletildi.`,
        );
      } else if (res.data.status === 'no_push_token') {
        message.info(res.data.message);
      } else {
        message.warning(`Bildirim durumu: ${res.data.receipt?.message || res.data.status}`);
      }
      setTestModalOpen(false);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Test bildirimi gönderilemedi');
    } finally {
      setTesting(false);
    }
  };

  const messageColumns = [
    {
      title: 'Sıra',
      key: 'order',
      width: 90,
      render: (_: any, __: PeriodMessage, idx: number) => (
        <Space size={4}>
          <Text type="secondary">#{idx + 1}</Text>
          <Button
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={idx === 0 || saving}
            onClick={() => handleMoveOrder(idx, -1)}
          />
          <Button
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={!config || idx === config.messages.length - 1 || saving}
            onClick={() => handleMoveOrder(idx, 1)}
          />
        </Space>
      ),
    },
    {
      title: 'Bildirim Önizlemesi',
      key: 'preview',
      render: (_: any, record: PeriodMessage) => (
        <div
          style={{
            background: 'linear-gradient(135deg, #FFF0F5 0%, #FFE4EC 100%)',
            border: '1px solid #FBCFE8',
            borderRadius: 12,
            padding: '10px 14px',
            maxWidth: 460,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>{record.emoji}</span>
            <Text strong style={{ color: '#9D174D' }}>
              {record.titleTr}
            </Text>
          </div>
          <Paragraph style={{ margin: 0, color: '#4B5563', fontSize: 13 }}>
            {record.messageTr}
          </Paragraph>
        </div>
      ),
    },
    {
      title: 'Ton & Dönem',
      key: 'meta',
      width: 240,
      render: (_: any, record: PeriodMessage) => (
        <Space direction="vertical" size={6}>
          <Tag color={TONE_LABELS[record.tone]?.color || 'default'}>
            {TONE_LABELS[record.tone]?.label || record.tone}
          </Tag>
          <Tag color={RANGE_LABELS[record.dayRange]?.color || 'blue'}>
            {RANGE_LABELS[record.dayRange]?.label || record.dayRange}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Durum',
      key: 'active',
      width: 100,
      render: (_: any, record: PeriodMessage) => (
        <Switch
          checked={record.active}
          loading={saving}
          onChange={(checked) => handleToggleMessage(record.id, checked)}
        />
      ),
    },
    {
      title: 'İşlemler',
      key: 'actions',
      width: 150,
      render: (_: any, record: PeriodMessage) => (
        <Space size={6}>
          <Button
            size="small"
            icon={<SendOutlined />}
            title="Test Gönder"
            onClick={() => {
              setTestMessageId(record.id);
              setTestModalOpen(true);
            }}
          />
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenEdit(record)}
          />
          <Popconfirm
            title="Bu bildirim mesajını silmek istediğinize emin misiniz?"
            onConfirm={() => handleDeleteMessage(record.id)}
            okText="Sil"
            cancelText="İptal"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const runColumns = [
    {
      title: 'Tarih',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (val: string) => dayjs(val).format('DD.MM.YYYY HH:mm:ss'),
    },
    {
      title: 'Tetikleyici',
      dataIndex: 'trigger',
      key: 'trigger',
      render: (val: string) => (
        <Tag color={val === 'manual' ? 'purple' : 'blue'}>
          {val === 'manual' ? 'Manuel Gönderim' : 'Saatlik Otomatik Cron'}
        </Tag>
      ),
    },
    {
      title: 'Regldeki Kullanıcı',
      dataIndex: 'totalActivePeriodUsers',
      key: 'totalActivePeriodUsers',
    },
    {
      title: 'Gönderilen (Push / Kuyruk)',
      key: 'sent',
      render: (_: any, r: DispatchRun) => (
        <Space size={4}>
          <Tag color="green">Push: {r.sent || 0}</Tag>
          <Tag color="blue">Kuyruk: {r.queued || 0}</Tag>
        </Space>
      ),
    },
    {
      title: 'Token Yok / Saat Dışı / Limit',
      key: 'skipped',
      render: (_: any, r: DispatchRun) => (
        <Text type="secondary">
          Token yok: {r.skippedNoToken} · Saat/Sessiz: {r.skippedQuietOrHour} · Limit:{' '}
          {r.skippedDailyLimit}
        </Text>
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
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <HeartOutlined style={{ color: '#EC4899', marginRight: 10 }} />
            Regl Dönemi Destek Bildirimleri
          </Title>
          <Text type="secondary">
            Kullanıcı regl dönemindeyken gönderilecek empatik ve çeşitlendirilmiş destek
            bildirimlerini buradan yönetebilirsiniz.
          </Text>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Yenile
          </Button>
          <Button
            icon={<SendOutlined />}
            onClick={() => {
              setTestMessageId(undefined);
              setTestModalOpen(true);
            }}
          >
            Test Gönder
          </Button>
          <Popconfirm
            title="Regl dönemindeki uygun kullanıcılara şimdi bildirim gönderilsin mi?"
            description="Push tokenı olan ve opt-out olmayan aktif regl dönemindeki kullanıcılara 1 adet destek bildirimi gönderilir."
            onConfirm={handleDispatchNow}
            okText="Evet, Gönder"
            cancelText="İptal"
          >
            <Button type="default" loading={dispatching} icon={<BellOutlined />}>
              Şimdi Gönder
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
            Yeni Mesaj Ekle
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="Çift Kanallı Çalışma Mantığı"
        description="Burada düzenlediğiniz mesajlar hem backend saatlik Push servisi üzerinden Expo Push olarak iletilir, hem de mobil uygulama ana sayfasındaki Dönem Kartı ve Yerel Bildirim planlayıcısı tarafından otomatik senkronize edilir."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="Otomatik Sistem"
              value={config?.enabled ? 'Aktif' : 'Duraklatıldı'}
              valueStyle={{ color: config?.enabled ? '#10B981' : '#EF4444' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="Aktif Mesaj Havuzu"
              value={stats?.activeMessagesCount || 0}
              suffix={`/ ${stats?.totalMessagesCount || 0}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="Şu An Regl Döneminde"
              value={stats?.activePeriodUsersCount || 0}
              suffix="kullanıcı"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="Push Token Hazır"
              value={stats?.pushReadyUsersCount || 0}
              suffix="kullanıcı"
            />
          </Card>
        </Col>
      </Row>

      {config && (
        <Card
          title="Zamanlama & Gönderim Kuralları"
          loading={loading}
          style={{ marginBottom: 20 }}
          extra={
            <Popconfirm
              title="Varsayılan mesajlara ve ayarlara dönülsün mü?"
              onConfirm={handleResetDefaults}
              okText="Sıfırla"
              cancelText="İptal"
            >
              <Button size="small" icon={<UndoOutlined />} loading={saving}>
                Varsayılanlara Sıfırla
              </Button>
            </Popconfirm>
          }
        >
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={5}>
              <Space direction="vertical" size={4}>
                <Text strong>Otomatik Gönderim</Text>
                <Switch
                  checked={config.enabled}
                  checkedChildren="Açık"
                  unCheckedChildren="Kapalı"
                  onChange={(enabled) =>
                    persistConfig(
                      { ...config, enabled },
                      enabled
                        ? 'Otomatik regl bildirimleri açıldı'
                        : 'Otomatik regl bildirimleri duraklatıldı',
                    )
                  }
                />
              </Space>
            </Col>

            <Col xs={24} md={9}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text strong>Gün İçi Gönderim Saatleri (Kullanıcı Yerel Saati)</Text>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  options={HOUR_OPTIONS}
                  value={config.defaultSendHours}
                  onChange={(hours) =>
                    setConfig((prev) => (prev ? { ...prev, defaultSendHours: hours } : prev))
                  }
                />
              </Space>
            </Col>

            <Col xs={12} md={4}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text strong>Günlük Max Mesaj</Text>
                <InputNumber
                  min={1}
                  max={5}
                  style={{ width: '100%' }}
                  value={config.maxPerDay}
                  onChange={(val) =>
                    setConfig((prev) =>
                      prev ? { ...prev, maxPerDay: Number(val) || 2 } : prev,
                    )
                  }
                />
              </Space>
            </Col>

            <Col xs={12} md={4}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text strong>Varsayılan Süre (Gün)</Text>
                <InputNumber
                  min={3}
                  max={10}
                  style={{ width: '100%' }}
                  value={config.periodWindowDays}
                  onChange={(val) =>
                    setConfig((prev) =>
                      prev ? { ...prev, periodWindowDays: Number(val) || 6 } : prev,
                    )
                  }
                />
              </Space>
            </Col>

            <Col xs={24} md={2}>
              <Button
                type="primary"
                block
                loading={saving}
                onClick={() => persistConfig(config, 'Zamanlama ayarları kaydedildi')}
              >
                Kaydet
              </Button>
            </Col>
          </Row>
        </Card>
      )}

      <Card title={`Bildirim Mesaj Havuzu (${config?.messages.length || 0})`} style={{ marginBottom: 20 }}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={config?.messages || []}
          columns={messageColumns}
          pagination={false}
        />
      </Card>

      <Card title="Son Gönderim Geçmişi">
        <Table
          rowKey={(r) => `${r.timestamp}-${r.trigger}`}
          loading={loading}
          dataSource={stats?.recentRuns || []}
          columns={runColumns}
          pagination={{ pageSize: 5 }}
          locale={{ emptyText: 'Henüz kayıtlı gönderim yok' }}
        />
      </Card>

      <Modal
        title={editingMsg ? 'Regl Bildirim Mesajını Düzenle' : 'Yeni Regl Bildirim Mesajı Ekle'}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleSaveMessage}
        confirmLoading={saving}
        okText={editingMsg ? 'Güncelle' : 'Ekle'}
        cancelText="İptal"
        width={640}
      >
        <Form form={msgForm} layout="vertical">
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item
                name="emoji"
                label="Emoji"
                rules={[{ required: true, message: 'Emoji girin' }]}
              >
                <Input placeholder="🤍" />
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item
                name="titleTr"
                label="Türkçe Başlık"
                rules={[{ required: true, message: 'Türkçe başlık zorunludur' }]}
              >
                <Input placeholder="Örn: Bugün yalnız değilsin 🤍" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="messageTr"
            label="Türkçe Bildirim Mesajı"
            rules={[{ required: true, message: 'Türkçe mesaj zorunludur' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Örn: Çok ağrın var ama ben senin yanındayım. Derin bir nefes al, bugün kendine izin ver. 💕"
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="tone" label="Mesaj Tonu">
                <Select
                  options={Object.entries(TONE_LABELS).map(([k, v]) => ({
                    value: k,
                    label: v.label,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dayRange" label="Hedef Regl Günü">
                <Select
                  options={Object.entries(RANGE_LABELS).map(([k, v]) => ({
                    value: k,
                    label: v.label,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '8px 0 12px' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              İngilizce Çeviri (Boş bırakılırsa Türkçe metin kullanılır)
            </Text>
          </Divider>

          <Form.Item name="titleEn" label="İngilizce Başlık (Opsiyonel)">
            <Input placeholder="You're not alone today 🤍" />
          </Form.Item>
          <Form.Item name="messageEn" label="İngilizce Mesaj (Opsiyonel)">
            <Input.TextArea rows={2} placeholder="I'm right here with you today. 💕" />
          </Form.Item>

          <Form.Item name="active" label="Aktif" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Test Bildirimi Gönder"
        open={testModalOpen}
        onCancel={() => setTestModalOpen(false)}
        onOk={handleSendTest}
        confirmLoading={testing}
        okText="Gönder"
        cancelText="İptal"
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Text type="secondary">
            Belirli bir kullanıcıya seçili (veya rastgele) regl destek mesajını test push
            olarak gönderin.
          </Text>
          <Select
            showSearch
            allowClear
            style={{ width: '100%' }}
            placeholder="Listeden kullanıcı seçin (veya aşağıya e-posta/ID yazın)"
            loading={loadingUsers}
            filterOption={false}
            onSearch={(val) => void loadTestUsers(val)}
            value={testUsers.some((u) => u.email === testTarget || u.id === testTarget) ? testTarget : undefined}
            onChange={(val) => setTestTarget(val || '')}
            options={testUsers.map((u) => ({
              value: u.email,
              label: `${u.displayName} (${u.email}) ${u.hasToken ? '• Expo Push' : '• Cihaz Kuyruğu'}`,
            }))}
          />
          <Input
            placeholder="Kullanıcı e-postası veya User ID"
            value={testTarget}
            onChange={(e) => setTestTarget(e.target.value)}
          />
          <Select
            allowClear
            style={{ width: '100%' }}
            placeholder="Mesaj seçin (boş bırakılırsa rastgele seçilir)"
            value={testMessageId}
            onChange={(val) => setTestMessageId(val)}
            options={(config?.messages || []).map((m) => ({
              value: m.id,
              label: `${m.emoji} ${m.titleTr}`,
            }))}
          />
        </Space>
      </Modal>
    </div>
  );
}
