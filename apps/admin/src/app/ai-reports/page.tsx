'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { FlagOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '@/providers/dataProvider';

interface AiReport {
  id: string;
  userId: string;
  conversationId?: string | null;
  messageId?: string | null;
  messageContent: string;
  reason: string;
  description?: string | null;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
  moderatorNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  user?: {
    id: string;
    email: string;
    username?: string | null;
  };
  reviewer?: {
    id: string;
    email: string;
    username?: string | null;
  } | null;
}

const STATUS_COLOR: Record<AiReport['status'], string> = {
  PENDING: 'orange',
  REVIEWED: 'blue',
  RESOLVED: 'green',
  DISMISSED: 'default',
};

const STATUS_LABEL: Record<AiReport['status'], string> = {
  PENDING: 'Beklemede',
  REVIEWED: 'İncelendi',
  RESOLVED: 'Çözüldü',
  DISMISSED: 'Reddedildi',
};

export default function AiReportsPage() {
  const [reports, setReports] = useState<AiReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selected, setSelected] = useState<AiReport | null>(null);
  const [nextStatus, setNextStatus] = useState<AiReport['status']>('REVIEWED');
  const [moderatorNote, setModeratorNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/ai-reports', {
        params: statusFilter ? { status: statusFilter } : undefined,
      });
      setReports(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'AI bildirimleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  const handleSaveReview = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiClient.patch(`/admin/ai-reports/${selected.id}`, {
        status: nextStatus,
        moderatorNote: moderatorNote.trim() || undefined,
      });
      message.success('Bildirim durumu güncellendi');
      setSelected(null);
      await loadReports();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <FlagOutlined />
            <span>NOVA AI Yanıt Bildirimleri</span>
          </Space>
        }
        extra={
          <Space>
            <Select
              allowClear
              placeholder="Durum filtrele"
              style={{ width: 170 }}
              value={statusFilter || undefined}
              onChange={(val) => setStatusFilter(val || '')}
              options={[
                { value: 'PENDING', label: 'Beklemede' },
                { value: 'REVIEWED', label: 'İncelendi' },
                { value: 'RESOLVED', label: 'Çözüldü' },
                { value: 'DISMISSED', label: 'Reddedildi' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={loadReports}>
              Yenile
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          dataSource={reports}
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: 'Tarih',
              dataIndex: 'createdAt',
              width: 150,
              render: (v: string) => new Date(v).toLocaleString('tr-TR'),
            },
            {
              title: 'Kullanıcı',
              dataIndex: 'user',
              width: 190,
              render: (u: AiReport['user']) => u?.email || u?.username || '-',
            },
            {
              title: 'Neden',
              dataIndex: 'reason',
              width: 210,
            },
            {
              title: 'AI Yanıtı',
              dataIndex: 'messageContent',
              render: (text: string) => (
                <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                  {text}
                </Typography.Paragraph>
              ),
            },
            {
              title: 'Durum',
              dataIndex: 'status',
              width: 120,
              render: (s: AiReport['status']) => (
                <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>
              ),
            },
            {
              title: 'İşlem',
              width: 110,
              render: (_: any, row: AiReport) => (
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    setSelected(row);
                    setNextStatus(row.status === 'PENDING' ? 'REVIEWED' : row.status);
                    setModeratorNote(row.moderatorNote || '');
                  }}
                >
                  İncele
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="NOVA AI Bildirimini İncele"
        open={Boolean(selected)}
        onCancel={() => setSelected(null)}
        onOk={handleSaveReview}
        confirmLoading={saving}
        okText="Kaydet"
        cancelText="Kapat"
        width={680}
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Typography.Text strong>Bildiren: </Typography.Text>
              <Typography.Text>{selected.user?.email || selected.userId}</Typography.Text>
            </div>
            <div>
              <Typography.Text strong>Neden: </Typography.Text>
              <Typography.Text>{selected.reason}</Typography.Text>
            </div>
            {selected.description && (
              <div>
                <Typography.Text strong>Kullanıcı Açıklaması: </Typography.Text>
                <Typography.Paragraph style={{ marginTop: 4 }}>
                  {selected.description}
                </Typography.Paragraph>
              </div>
            )}
            <div>
              <Typography.Text strong>Bildirilen NOVA Yanıtı:</Typography.Text>
              <Card size="small" style={{ marginTop: 6, maxHeight: 220, overflow: 'auto' }}>
                <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {selected.messageContent}
                </Typography.Paragraph>
              </Card>
            </div>
            <div>
              <Typography.Text strong>Durum:</Typography.Text>
              <Select
                style={{ width: '100%', marginTop: 6 }}
                value={nextStatus}
                onChange={(v) => setNextStatus(v)}
                options={[
                  { value: 'PENDING', label: 'Beklemede' },
                  { value: 'REVIEWED', label: 'İncelendi' },
                  { value: 'RESOLVED', label: 'Çözüldü' },
                  { value: 'DISMISSED', label: 'Reddedildi' },
                ]}
              />
            </div>
            <div>
              <Typography.Text strong>Moderatör Notu:</Typography.Text>
              <Input.TextArea
                rows={3}
                style={{ marginTop: 6 }}
                value={moderatorNote}
                onChange={(e) => setModeratorNote(e.target.value)}
                placeholder="İnceleme veya aksiyon notu..."
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}
