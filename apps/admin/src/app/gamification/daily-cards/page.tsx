'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Typography,
  Popconfirm,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/providers/dataProvider';

const { Title, Text } = Typography;

const PHASE_OPTIONS = [
  { label: 'Menstrual (Regl)', value: 'MENSTRUAL' },
  { label: 'Foliküler', value: 'FOLLICULAR' },
  { label: 'Ovulasyon', value: 'OVULATION' },
  { label: 'Luteal (PMS)', value: 'LUTEAL' },
  { label: 'Hamilelik', value: 'PREGNANCY' },
  { label: 'Anne & Bebek (Lohusalık)', value: 'POSTPARTUM' },
  { label: 'Genel', value: 'GENERAL' },
];

const TONE_OPTIONS = [
  { label: 'Samimi & Eğlenceli', value: 'fun' },
  { label: 'Sade & Bilimsel', value: 'scientific' },
];

export default function DailyMicroCardsPage() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form] = Form.useForm();

  const loadCards = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/home/admin/daily-cards');
      setCards(Array.isArray(data) ? data : []);
    } catch {
      message.error('Mikro-kartlar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, []);

  const persistCards = async (nextCards: any[], successMsg: string) => {
    setSaving(true);
    try {
      const { data } = await apiClient.put('/home/admin/daily-cards', {
        cards: nextCards,
      });
      setCards(Array.isArray(data) ? data : nextCards);
      message.success(successMsg);
    } catch {
      message.error('Kaydetme sırasında hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditingIndex(null);
    form.resetFields();
    form.setFieldsValue({
      phase: 'GENERAL',
      tone: 'fun',
      badge: 'GÜNÜN NOTU',
      gradientFrom: '#EC4899',
      gradientTo: '#8B5CF6',
      icon: 'sparkles-outline',
      active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (record: any, index: number) => {
    setEditingIndex(index);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleModalSave = async (values: any) => {
    const next = [...cards];
    if (editingIndex !== null) {
      next[editingIndex] = { ...next[editingIndex], ...values };
    } else {
      next.unshift({
        id: `mc-custom-${Date.now()}`,
        ...values,
      });
    }
    setModalOpen(false);
    await persistCards(next, editingIndex !== null ? 'Kart güncellendi.' : 'Yeni kart eklendi.');
  };

  const handleDelete = async (index: number) => {
    const next = cards.filter((_, i) => i !== index);
    await persistCards(next, 'Kart silindi.');
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const { data } = await apiClient.post('/home/admin/daily-cards/reset');
      setCards(Array.isArray(data) ? data : []);
      message.success('Varsayılan kart havuzu geri yüklendi.');
    } catch {
      message.error('Varsayılanlar geri yüklenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Faz',
      dataIndex: 'phase',
      key: 'phase',
      render: (phase: string) => <Tag color="purple">{phase}</Tag>,
    },
    {
      title: 'Ses Tonu',
      dataIndex: 'tone',
      key: 'tone',
      render: (tone: string) => (
        <Tag color={tone === 'fun' ? 'magenta' : 'blue'}>
          {tone === 'fun' ? 'Samimi & Eğlenceli' : 'Sade & Bilimsel'}
        </Tag>
      ),
    },
    {
      title: 'Kart',
      key: 'card',
      render: (_: any, record: any) => (
        <div>
          <Text strong>{record.title}</Text>
          <div style={{ fontSize: 12, color: '#666' }}>{record.body}</div>
        </div>
      ),
    },
    {
      title: 'Durum',
      dataIndex: 'active',
      key: 'active',
      render: (active: boolean) => (
        <Tag color={active !== false ? 'green' : 'default'}>
          {active !== false ? 'Aktif' : 'Pasif'}
        </Tag>
      ),
    },
    {
      title: 'İşlemler',
      key: 'actions',
      render: (_: any, record: any, index: number) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record, index)}
          />
          <Popconfirm
            title="Bu kart silinsin mi?"
            onConfirm={() => handleDelete(index)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
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
            Günün Mikro-Kartları
          </Title>
          <Text type="secondary">
            Ana sayfada gösterilen faz-bazlı samimi &amp; bilimsel günlük mikro-kartları yönetin.
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadCards}>
            Yenile
          </Button>
          <Popconfirm
            title="Tüm kartlar varsayılan havuza sıfırlansın mı?"
            onConfirm={handleReset}
          >
            <Button icon={<UndoOutlined />} loading={saving}>
              Varsayılanları Yükle
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Yeni Kart Ekle
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          rowKey="id"
          loading={loading || saving}
          columns={columns}
          dataSource={cards}
          pagination={{ pageSize: 12 }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editingIndex !== null ? 'Mikro-Kart Düzenle' : 'Yeni Mikro-Kart Ekle'}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Kaydet"
        cancelText="İptal"
      >
        <Form form={form} layout="vertical" onFinish={handleModalSave}>
          <Form.Item name="phase" label="Yaşam / Döngü Fazı" rules={[{ required: true }]}>
            <Select options={PHASE_OPTIONS} />
          </Form.Item>
          <Form.Item name="tone" label="Ses Tonu" rules={[{ required: true }]}>
            <Select options={TONE_OPTIONS} />
          </Form.Item>
          <Form.Item name="badge" label="Üst Etiket (Örn: MOD: BATTANİYE)" rules={[{ required: true }]}>
            <Input maxLength={40} />
          </Form.Item>
          <Form.Item name="title" label="Başlık" rules={[{ required: true }]}>
            <Input maxLength={90} />
          </Form.Item>
          <Form.Item name="body" label="Kart Metni" rules={[{ required: true }]}>
            <Input.TextArea rows={3} maxLength={240} />
          </Form.Item>
          <Form.Item name="novaPrompt" label="NOVA'ya Sor İstemi">
            <Input.TextArea rows={2} maxLength={300} />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="gradientFrom" label="Başlangıç Rengi">
              <Input style={{ width: 130 }} />
            </Form.Item>
            <Form.Item name="gradientTo" label="Bitiş Rengi">
              <Input style={{ width: 130 }} />
            </Form.Item>
            <Form.Item name="active" label="Aktif" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
