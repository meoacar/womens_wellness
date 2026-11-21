'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Table,
    Button,
    Space,
    Tag,
    Modal,
    Form,
    Input,
    Switch,
    InputNumber,
    message,
    Popconfirm,
    Card,
    Spin,
    Tabs,
    Alert,
    Typography,
    Tooltip,
    Divider,
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    SyncOutlined,
    GlobalOutlined,
    MobileOutlined,
    FileProtectOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiClient } from '@/providers/dataProvider';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

const WEB_URL =
    process.env.NEXT_PUBLIC_WEB_URL ||
    (typeof window !== 'undefined' && window.location.hostname.includes('kadinatlasi.com')
        ? 'https://kadinatlasi.com'
        : 'https://kadinatlasi.com');

interface Page {
    id: string;
    slug: string;
    titleTr: string;
    titleEn?: string;
    contentTr: string;
    contentEn?: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

interface DefaultTemplate {
    slug: string;
    aliases: string[];
    titleTr: string;
    titleEn: string;
    sortOrder: number;
    isActive: boolean;
    contentTr: string;
    contentEn: string;
}

const MOBILE_ROUTE_MAP: Record<string, string> = {
    hakkimizda: 'Ayarlar > Hakkında (/settings/about)',
    'gizlilik-politikasi': 'Ayarlar > Gizlilik Politikası (/settings/privacy-policy)',
    'kvkk-aydinlatma-metni': 'Ayarlar > KVKK İzinleri (/settings/kvkk-consent)',
    'kullanim-kosullari': 'Ayarlar > Kullanım Koşulları (/settings/terms-of-service)',
};

function renderMarkdownPreview(md: string) {
    if (!md || !md.trim()) {
        return <Text type="secondary">Önizlenecek içerik yok.</Text>;
    }
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    return (
        <div
            style={{
                maxHeight: 460,
                overflowY: 'auto',
                padding: '20px 24px',
                background: '#fff',
                border: '1px solid #f0f0f0',
                borderRadius: 12,
                lineHeight: 1.7,
            }}
        >
            {lines.map((raw, idx) => {
                const line = raw.trim();
                if (!line) return <div key={idx} style={{ height: 8 }} />;
                if (line.startsWith('### ')) {
                    return (
                        <h4
                            key={idx}
                            style={{ marginTop: 16, marginBottom: 6, fontWeight: 700, color: '#1f1630' }}
                        >
                            {line.slice(4)}
                        </h4>
                    );
                }
                if (line.startsWith('## ')) {
                    return (
                        <h3
                            key={idx}
                            style={{
                                marginTop: 20,
                                marginBottom: 8,
                                fontWeight: 800,
                                color: '#E91E63',
                                borderBottom: '1px solid #fce7f3',
                                paddingBottom: 4,
                            }}
                        >
                            {line.slice(3)}
                        </h3>
                    );
                }
                if (line.startsWith('# ')) {
                    return (
                        <h2 key={idx} style={{ marginTop: 20, marginBottom: 10, fontWeight: 800 }}>
                            {line.slice(2)}
                        </h2>
                    );
                }
                if (/^[-*•]\s+/.test(line)) {
                    return (
                        <div key={idx} style={{ paddingLeft: 16, marginBottom: 4 }}>
                            • {line.replace(/^[-*•]\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1')}
                        </div>
                    );
                }
                return (
                    <p key={idx} style={{ marginBottom: 8, color: '#374151' }}>
                        {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                    </p>
                );
            })}
        </div>
    );
}

function extractApiErrorMessage(err: any, fallback: string): string {
    const raw = err?.response?.data?.message;
    if (Array.isArray(raw) && raw.length > 0) {
        return raw.join(', ');
    }
    if (typeof raw === 'string' && raw.trim()) {
        return raw;
    }
    return fallback;
}

export default function PagesManagement() {
    const queryClient = useQueryClient();
    const [form] = Form.useForm();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPage, setEditingPage] = useState<Page | null>(null);
    const [previewLang, setPreviewLang] = useState<'tr' | 'en'>('tr');

    const watchedContentTr = Form.useWatch('contentTr', form) || '';
    const watchedContentEn = Form.useWatch('contentEn', form) || '';
    const watchedSlug = Form.useWatch('slug', form) || '';

    // Fetch pages
    const { data: pages, isLoading } = useQuery<Page[]>({
        queryKey: ['pages'],
        queryFn: async () => {
            const { data } = await apiClient.get('/pages/admin/list');
            return data;
        },
    });

    // Fetch default legal templates
    const { data: templates } = useQuery<DefaultTemplate[]>({
        queryKey: ['page-templates'],
        queryFn: async () => {
            const { data } = await apiClient.get('/pages/admin/templates');
            return data;
        },
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (payload: any) => {
            const { data } = await apiClient.post('/pages', payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pages'] });
            message.success('Sayfa oluşturuldu — Web ve Mobil uygulamada yayında');
            handleCloseModal();
        },
        onError: (err: any) => {
            message.error(extractApiErrorMessage(err, 'Sayfa oluşturulamadı'));
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const res = await apiClient.put(`/pages/${id}`, data);
            return res.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pages'] });
            message.success('Sayfa güncellendi — Web ve Mobil uygulamada anında aktif');
            handleCloseModal();
        },
        onError: (err: any) => {
            message.error(extractApiErrorMessage(err, 'Sayfa güncellenemedi'));
        },
    });

    // Restore defaults mutation
    const restoreDefaultsMutation = useMutation({
        mutationFn: async (slug?: string) => {
            const { data } = await apiClient.post('/pages/admin/restore-defaults', {
                slug: slug || 'ALL',
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pages'] });
            message.success('Kapsamlı kurumsal ve hukuki şablonlar başarıyla yüklendi');
        },
        onError: () => {
            message.error('Şablonlar yüklenemedi');
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { data } = await apiClient.delete(`/pages/${id}`);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pages'] });
            message.success('Sayfa başarıyla silindi');
        },
        onError: () => {
            message.error('Sayfa silinemedi');
        },
    });

    const handleOpenModal = (page?: Page) => {
        if (page) {
            setEditingPage(page);
            form.setFieldsValue({
                slug: page.slug,
                titleTr: page.titleTr,
                titleEn: page.titleEn || '',
                contentTr: page.contentTr,
                contentEn: page.contentEn || '',
                isActive: page.isActive,
                sortOrder: page.sortOrder,
            });
        } else {
            setEditingPage(null);
            form.resetFields();
            form.setFieldsValue({
                isActive: true,
                sortOrder: (pages?.length || 0) + 1,
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPage(null);
        form.resetFields();
    };

    const handleLoadTemplateIntoForm = (slugToLoad: string) => {
        const tpl = templates?.find((t) => t.slug === slugToLoad);
        if (!tpl) {
            message.warning('Bu slug için varsayılan şablon bulunamadı');
            return;
        }
        form.setFieldsValue({
            slug: editingPage ? editingPage.slug : tpl.slug,
            titleTr: tpl.titleTr,
            titleEn: tpl.titleEn,
            contentTr: tpl.contentTr,
            contentEn: tpl.contentEn,
            sortOrder: editingPage ? editingPage.sortOrder : tpl.sortOrder,
            isActive: true,
        });
        message.info(`"${tpl.titleTr}" şablonu editöre yüklendi. Kaydetmek için Güncelle/Oluştur butonuna basın.`);
    };

    const insertMarkdownSnippet = (fieldName: 'contentTr' | 'contentEn', snippet: string) => {
        const current = form.getFieldValue(fieldName) || '';
        const separator = current && !current.endsWith('\n') ? '\n\n' : '';
        form.setFieldValue(fieldName, `${current}${separator}${snippet}`);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (editingPage) {
                updateMutation.mutate({ id: editingPage.id, data: values });
            } else {
                createMutation.mutate(values);
            }
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const columns: ColumnsType<Page> = [
        {
            title: 'Sayfa & Bağlantılar (Web + Mobil)',
            key: 'pageInfo',
            render: (_: any, record: Page) => {
                const mobileTarget =
                    MOBILE_ROUTE_MAP[record.slug] || `Mobil Dinamik Sayfa (/${record.slug})`;
                return (
                    <Space direction="vertical" size={4}>
                        <Space>
                            <Text strong style={{ fontSize: 15 }}>
                                {record.titleTr}
                            </Text>
                            {record.titleEn && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    ({record.titleEn})
                                </Text>
                            )}
                        </Space>
                        <Space wrap size={[6, 4]}>
                            <Tag icon={<GlobalOutlined />} color="magenta">
                                /sayfa/{record.slug}
                            </Tag>
                            <Tag icon={<MobileOutlined />} color="purple">
                                {mobileTarget}
                            </Tag>
                        </Space>
                    </Space>
                );
            },
        },
        {
            title: 'İçerik Kapsamı',
            key: 'length',
            render: (_: any, record: Page) => {
                const trWords = (record.contentTr || '').trim().split(/\s+/).filter(Boolean).length;
                const enWords = (record.contentEn || '').trim().split(/\s+/).filter(Boolean).length;
                const isDetailed = trWords >= 120;
                return (
                    <Space direction="vertical" size={2}>
                        <Tag
                            icon={isDetailed ? <CheckCircleOutlined /> : undefined}
                            color={isDetailed ? 'success' : 'warning'}
                        >
                            TR: {trWords} kelime ({record.contentTr?.length || 0} krk)
                        </Tag>
                        <Tag color={enWords >= 80 ? 'blue' : 'default'}>
                            EN: {enWords} kelime ({record.contentEn?.length || 0} krk)
                        </Tag>
                    </Space>
                );
            },
        },
        {
            title: 'Son Güncelleme',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            render: (updatedAt: string) =>
                updatedAt ? new Date(updatedAt).toLocaleString('tr-TR') : '-',
        },
        {
            title: 'Durum',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'default'}>
                    {isActive ? 'Yayında' : 'Pasif'}
                </Tag>
            ),
        },
        {
            title: 'Sıra',
            dataIndex: 'sortOrder',
            key: 'sortOrder',
            width: 70,
        },
        {
            title: 'İşlemler',
            key: 'actions',
            render: (_: any, record: Page) => {
                const hasDefaultTemplate = templates?.some((t) => t.slug === record.slug);
                return (
                    <Space size="small">
                        <Tooltip title="Web Sitesinde Görüntüle">
                            <Button
                                type="text"
                                icon={<EyeOutlined />}
                                onClick={() =>
                                    window.open(`${WEB_URL}/sayfa/${record.slug}`, '_blank')
                                }
                            />
                        </Tooltip>
                        <Tooltip title="Detaylı Düzenle (TR & EN)">
                            <Button
                                type="primary"
                                ghost
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleOpenModal(record)}
                            >
                                Düzenle
                            </Button>
                        </Tooltip>
                        {hasDefaultTemplate && (
                            <Popconfirm
                                title="Varsayılan Hukuki Metni Yükle"
                                description="Bu sayfanın içeriğini standart kapsamlı hukuki metinle güncellemek istiyor musunuz?"
                                onConfirm={() => restoreDefaultsMutation.mutate(record.slug)}
                                okText="Yükle"
                                cancelText="İptal"
                            >
                                <Tooltip title="Standart Hukuki Şablonu Yükle">
                                    <Button
                                        type="text"
                                        icon={<SyncOutlined />}
                                        loading={restoreDefaultsMutation.isPending}
                                    />
                                </Tooltip>
                            </Popconfirm>
                        )}
                        <Popconfirm
                            title="Sayfayı Sil"
                            description="Bu sayfayı silmek istediğinizden emin misiniz?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Sil"
                            cancelText="İptal"
                            okButtonProps={{ danger: true }}
                        >
                            <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                title="Sil"
                            />
                        </Popconfirm>
                    </Space>
                );
            },
        },
    ];

    if (isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" />
            </div>
        );
    }

    const renderMarkdownToolbar = (field: 'contentTr' | 'contentEn') => (
        <Space wrap size="small" style={{ marginBottom: 8 }}>
            <Button
                size="small"
                onClick={() => insertMarkdownSnippet(field, '## Yeni Bölüm Başlığı\nAçıklama metni...')}
            >
                + Ana Bölüm (##)
            </Button>
            <Button
                size="small"
                onClick={() => insertMarkdownSnippet(field, '### Alt Başlık\nDetay metni...')}
            >
                + Alt Başlık (###)
            </Button>
            <Button
                size="small"
                onClick={() =>
                    insertMarkdownSnippet(
                        field,
                        '- **Başlık:** Açıklama maddesi 1\n- **Başlık:** Açıklama maddesi 2',
                    )
                }
            >
                + Madde Listesi (-)
            </Button>
            <Button
                size="small"
                onClick={() =>
                    insertMarkdownSnippet(
                        field,
                        '[İletişim Formu](https://kadinatlasi.com/iletisim)',
                    )
                }
            >
                + Bağlantı Ekle
            </Button>
        </Space>
    );

    return (
        <div>
            <div
                style={{
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                }}
            >
                <div>
                    <h1 style={{ margin: 0 }}>Kurumsal, Gizlilik ve KVKK Sayfa Yönetimi</h1>
                    <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
                        Buradan düzenlediğiniz metinler hem <b>Web Sitesine</b> (<code>kadinatlasi.com/sayfa/...</code> ve Footer) hem de <b>Mobil Uygulamaya</b> (Ayarlar &gt; Gizlilik Politikası, KVKK, Kullanım Koşulları, Hakkında) anında yansır.
                    </Paragraph>
                </div>
                <Space wrap>
                    <Popconfirm
                        title="Tüm Hukuki Şablonları Güncelle"
                        description="Hakkımızda, Gizlilik Politikası, KVKK Aydınlatma Metni ve Kullanım Koşulları sayfalarını kapsamlı varsayılan şablonlarla güncellemek istiyor musunuz?"
                        onConfirm={() => restoreDefaultsMutation.mutate('ALL')}
                        okText="Evet, Güncelle"
                        cancelText="İptal"
                    >
                        <Button
                            icon={<FileProtectOutlined />}
                            loading={restoreDefaultsMutation.isPending}
                        >
                            Varsayılan Hukuki Şablonları Yükle
                        </Button>
                    </Popconfirm>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => handleOpenModal()}
                    >
                        Yeni Sayfa Oluştur
                    </Button>
                </Space>
            </div>

            <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="Web ve Mobil Uygulama Senkronizasyonu Aktif"
                description={
                    <span>
                        Standart yasal sayfalar: <code>hakkimizda</code> (Hakkımızda & Künye),{' '}
                        <code>gizlilik-politikasi</code> (Gizlilik Politikası ve KVKK),{' '}
                        <code>kvkk-aydinlatma-metni</code> (KVKK Aydınlatma ve Açık Rıza),{' '}
                        <code>kullanim-kosullari</code> (Kullanım Koşulları ve Tıbbi Uyarı). Markdown
                        formatında (<code>## Başlık</code>, <code>### Alt Başlık</code>,{' '}
                        <code>- Madde</code>, <code>**Kalın**</code>) dilediğiniz kadar detaylı
                        yazabilirsiniz.
                    </span>
                }
            />

            <Card>
                <Table
                    columns={columns}
                    dataSource={pages}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: 'Henüz sayfa eklenmemiş' }}
                />
            </Card>

            <Modal
                title={
                    editingPage
                        ? `Sayfa Düzenle: ${editingPage.titleTr} (/sayfa/${editingPage.slug})`
                        : 'Yeni Kurumsal / Yasal Sayfa Oluştur'
                }
                open={isModalOpen}
                onOk={handleSubmit}
                onCancel={handleCloseModal}
                width={1040}
                okText={editingPage ? 'Kaydet ve Yayınla (Web + Mobil)' : 'Oluştur ve Yayınla'}
                cancelText="İptal"
                confirmLoading={createMutation.isPending || updateMutation.isPending}
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        isActive: true,
                        sortOrder: 1,
                    }}
                >
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr',
                            gap: 16,
                            alignItems: 'start',
                        }}
                    >
                        <Form.Item
                            label="Slug (URL Anahtarı)"
                            name="slug"
                            rules={[{ required: true, message: 'Slug gereklidir' }]}
                            extra="Örn: hakkimizda, gizlilik-politikasi, kvkk-aydinlatma-metni, kullanim-kosullari"
                        >
                            <Input placeholder="gizlilik-politikasi" />
                        </Form.Item>

                        <Form.Item label="Footer / Menü Sırası" name="sortOrder">
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>

                        <Form.Item label="Yayın Durumu" name="isActive" valuePropName="checked">
                            <Switch checkedChildren="Yayında" unCheckedChildren="Pasif" />
                        </Form.Item>
                    </div>

                    {templates && templates.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            <Space wrap size="small">
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    Hazır Hukuki Şablon Doldur:
                                </Text>
                                {templates.map((tpl) => (
                                    <Button
                                        key={tpl.slug}
                                        size="small"
                                        type={watchedSlug === tpl.slug ? 'primary' : 'default'}
                                        ghost={watchedSlug === tpl.slug}
                                        onClick={() => handleLoadTemplateIntoForm(tpl.slug)}
                                    >
                                        {tpl.titleTr}
                                    </Button>
                                ))}
                            </Space>
                        </div>
                    )}

                    <Divider style={{ margin: '12px 0' }} />

                    <Tabs
                        defaultActiveKey="tr"
                        items={[
                            {
                                key: 'tr',
                                label: `Türkçe İçerik (TR) • ${(watchedContentTr || '').trim().split(/\s+/).filter(Boolean).length} kelime`,
                                children: (
                                    <>
                                        <Form.Item
                                            label="Başlık (Türkçe)"
                                            name="titleTr"
                                            rules={[
                                                { required: true, message: 'Türkçe başlık gereklidir' },
                                            ]}
                                        >
                                            <Input placeholder="Gizlilik Politikası ve KVKK Aydınlatma Metni" />
                                        </Form.Item>

                                        {renderMarkdownToolbar('contentTr')}

                                        <Form.Item
                                            label="Detaylı İçerik (Türkçe - Markdown)"
                                            name="contentTr"
                                            rules={[
                                                { required: true, message: 'Türkçe içerik gereklidir' },
                                            ]}
                                            extra="## ile ana maddeleri, ### ile alt başlıkları, - ile liste maddelerini, **metin** ile kalın vurguları yazabilirsiniz."
                                        >
                                            <TextArea
                                                rows={18}
                                                style={{ fontFamily: 'monospace', fontSize: 13 }}
                                                placeholder="## 1. Veri Sorumlusu ve Kapsam&#10;&#10;Detaylı açıklama..."
                                            />
                                        </Form.Item>
                                    </>
                                ),
                            },
                            {
                                key: 'en',
                                label: `İngilizce İçerik (EN) • ${(watchedContentEn || '').trim().split(/\s+/).filter(Boolean).length} kelime`,
                                children: (
                                    <>
                                        <Form.Item
                                            label="Başlık (İngilizce)"
                                            name="titleEn"
                                        >
                                            <Input placeholder="Privacy Policy & Data Protection Disclosure" />
                                        </Form.Item>

                                        {renderMarkdownToolbar('contentEn')}

                                        <Form.Item
                                            label="Detaylı İçerik (İngilizce - Markdown)"
                                            name="contentEn"
                                            extra="İngilizce dil seçeneğinde (/sayfa/... ve mobil uygulama EN modunda) gösterilir."
                                        >
                                            <TextArea
                                                rows={18}
                                                style={{ fontFamily: 'monospace', fontSize: 13 }}
                                                placeholder="## 1. Data Controller & Scope&#10;&#10;Detailed content..."
                                            />
                                        </Form.Item>
                                    </>
                                ),
                            },
                            {
                                key: 'preview',
                                label: 'Canlı Önizleme (Web & Mobil Görünümü)',
                                children: (
                                    <div>
                                        <Space style={{ marginBottom: 12 }}>
                                            <Button
                                                size="small"
                                                type={previewLang === 'tr' ? 'primary' : 'default'}
                                                onClick={() => setPreviewLang('tr')}
                                            >
                                                Türkçe Önizleme
                                            </Button>
                                            <Button
                                                size="small"
                                                type={previewLang === 'en' ? 'primary' : 'default'}
                                                onClick={() => setPreviewLang('en')}
                                            >
                                                İngilizce Önizleme
                                            </Button>
                                        </Space>
                                        {renderMarkdownPreview(
                                            previewLang === 'tr' ? watchedContentTr : watchedContentEn,
                                        )}
                                    </div>
                                ),
                            },
                        ]}
                    />
                </Form>
            </Modal>
        </div>
    );
}
