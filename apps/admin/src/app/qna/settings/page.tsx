'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Button,
  Row,
  Col,
  Typography,
  Space,
  Divider,
  Spin,
  message,
} from 'antd';
import { SaveOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { apiClient } from '@/providers/dataProvider';

const { Title, Text } = Typography;

const CATEGORY_OPTIONS = [
  { label: 'Regl Sağlığı', value: 'MENSTRUAL_HEALTH' },
  { label: 'Hamilelik', value: 'PREGNANCY' },
  { label: 'Doğurganlık', value: 'FERTILITY' },
  { label: 'Beslenme', value: 'NUTRITION' },
  { label: 'Egzersiz', value: 'EXERCISE' },
  { label: 'Ruh Sağlığı', value: 'MENTAL_HEALTH' },
  { label: 'Uyku', value: 'SLEEP' },
  { label: 'Doğum Kontrolü', value: 'CONTRACEPTION' },
  { label: 'PMS', value: 'PMS' },
  { label: 'Menopoz', value: 'MENOPAUSE' },
  { label: 'Cinsel Sağlık', value: 'SEXUAL_HEALTH' },
  { label: 'Genel', value: 'GENERAL' },
];

export default function CommunitySettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/qna/admin/settings');
      form.setFieldsValue(data);
    } catch {
      message.error('Topluluk ayarları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const { data } = await apiClient.put('/qna/admin/settings', values);
      form.setFieldsValue(data);
      message.success('Topluluk ve soru sorma ayarları kaydedildi.');
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Ayarlar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
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
            <SettingOutlined style={{ marginRight: 8 }} />
            Topluluk &amp; Soru Sorma Ayarları
          </Title>
          <Text type="secondary">
            Soru limitleri, başlık/içerik karakter kuralları, anonimlik, kategoriler ve XP ödüllerini yönetin.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadSettings}>
          Yenile
        </Button>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Card title="Genel & Limit Kuralları" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="allowNewQuestions"
                label="Yeni Soru Paylaşımı Açık"
                valuePropName="checked"
              >
                <Switch checkedChildren="Açık" unCheckedChildren="Kapalı" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="allowAnonymous"
                label="Anonim Soru Sormaya İzin Ver"
                valuePropName="checked"
              >
                <Switch checkedChildren="Evet" unCheckedChildren="Hayır" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="dailyQuestionLimit"
                label="Günlük Maksimum Soru"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="freeMonthlyQuestionLimit"
                label="Ücretsiz Aylık Soru Limiti"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={500} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="premiumMonthlyQuestionLimit"
                label="Premium Aylık Soru Limiti"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={1000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Başlık, İçerik & Kategori İnce Ayarları" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Form.Item name="titleMinLength" label="Başlık Min Karakter">
                <InputNumber min={3} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="titleMaxLength" label="Başlık Maks Karakter">
                <InputNumber min={20} max={300} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="contentMinLength" label="İçerik Min Karakter">
                <InputNumber min={5} max={500} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="contentMaxLength" label="İçerik Maks Karakter">
                <InputNumber min={50} max={10000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="maxTags" label="Maksimum Etiket Sayısı">
                <InputNumber min={0} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="enabledCategories" label="Aktif Kategoriler">
                <Select mode="multiple" options={CATEGORY_OPTIONS} placeholder="Kategorileri seçin" />
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="askPageBannerTitle" label="Soru Sayfası Başlığı (Mobil)">
                <Input maxLength={100} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="askPageBannerSubtitle" label="Soru Sayfası Alt Açıklaması (Mobil)">
                <Input maxLength={240} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Topluluk Puanı & Gamification XP Bağlantısı" style={{ marginBottom: 20 }}>
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Form.Item name="pointsPerQuestion" label="Soru Açma Puanı">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="pointsPerAnswer" label="Cevap Yazma Puanı">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item name="pointsPerBestAnswer" label="En İyi Cevap Puanı">
                <InputNumber min={0} max={200} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item
                name="xpPerReputationPoint"
                label="1 Topluluk Puanı = ? XP"
                tooltip="Örn: 1 girilirse kazanılan her topluluk puanı kullanıcıya 1 Gamification XP kazandırır."
              >
                <InputNumber min={0} max={10} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Space>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={saving}
            size="large"
          >
            Ayarları Kaydet
          </Button>
        </Space>
      </Form>
    </div>
  );
}
