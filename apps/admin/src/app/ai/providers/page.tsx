'use client';

import { useTable, List, EditButton, DeleteButton, CreateButton } from '@refinedev/antd';
import { Table, Tag, Space, Switch, Tooltip, Button, Alert, message, Card, Row, Col, Modal, Input } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { HttpError } from '@refinedev/core';
import { apiClient } from '@/providers/dataProvider';

interface AIProvider {
    id: string;
    provider: 'google' | 'openai' | 'anthropic' | 'deepseek';
    apiKey: string;
    modelName: string;
    displayName: string;
    description?: string;
    isActive: boolean;
    priority: number;
    createdAt: string;
    updatedAt: string;
}

const providerInfo = {
    google: { name: 'Google Gemini', icon: '🔷', color: '#4285F4' },
    openai: { name: 'OpenAI', icon: '🤖', color: '#10A37F' },
    anthropic: { name: 'Anthropic', icon: '🧠', color: '#D97757' },
    deepseek: { name: 'DeepSeek', icon: '⚡', color: '#7C3AED' },
};

export default function AIProvidersList() {
    const router = useRouter();
    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [runtimeStatus, setRuntimeStatus] = useState<any>(null);
    const [promptModalOpen, setPromptModalOpen] = useState(false);
    const [promptProvider, setPromptProvider] = useState<string>('google');
    const [testPromptText, setTestPromptText] = useState('Merhaba NOVA, bugün kendimi yorgun hissediyorum, kısa bir öneri verir misin?');
    const [testPromptResult, setTestPromptResult] = useState<string | null>(null);
    const [runningPromptTest, setRunningPromptTest] = useState(false);

    const { tableProps, tableQueryResult } = useTable<AIProvider, HttpError>({
        resource: 'ai-providers',
        syncWithLocation: true,
        meta: {
            // Use provider as ID instead of id
            idField: 'provider',
        },
    });

    const loadRuntimeStatus = useCallback(async () => {
        try {
            const res = await apiClient.get('/ai-providers/runtime/status');
            setRuntimeStatus(res.data);
        } catch {
            // Ignore silently
        }
    }, []);

    useEffect(() => {
        loadRuntimeStatus();
    }, [loadRuntimeStatus]);

    const handleToggleActive = async (provider: string) => {
        try {
            await apiClient.post(`/ai-providers/${provider}/toggle`);
            message.success(`"${provider}" durumu güncellendi`);
            tableQueryResult?.refetch();
            loadRuntimeStatus();
        } catch (err: any) {
            message.error(err?.response?.data?.message || 'Durum güncellenemedi');
        }
    };

    const handleTestConnection = async (provider: string) => {
        setTestingProvider(provider);
        try {
            const res = await apiClient.post(`/ai-providers/${provider}/test`);
            if (res.data?.ok) {
                message.success(`${provider} (${res.data.modelName}) bağlantısı başarılı (${res.data.latencyMs}ms)`);
            } else {
                message.error(`${provider} test hatası: ${res.data?.error || 'Bağlanılamadı'}`);
            }
        } catch (err: any) {
            message.error(err?.response?.data?.message || 'Test çalıştırılamadı');
        } finally {
            setTestingProvider(null);
        }
    };

    const handleRunPromptTest = async () => {
        if (!testPromptText.trim()) return;
        setRunningPromptTest(true);
        setTestPromptResult(null);
        try {
            const res = await apiClient.post(`/ai-providers/${promptProvider}/test`, {
                prompt: testPromptText.trim(),
            });
            if (res.data?.ok) {
                setTestPromptResult(`✅ (${res.data.modelName} • ${res.data.latencyMs}ms):\n\n${res.data.sample}`);
            } else {
                setTestPromptResult(`❌ Hata: ${res.data?.error || 'Yanıt alınamadı'}`);
            }
        } catch (err: any) {
            setTestPromptResult(`❌ Hata: ${err?.response?.data?.message || 'Test başarısız'}`);
        } finally {
            setRunningPromptTest(false);
        }
    };

    const columns = [
        {
            title: 'Sağlayıcı',
            dataIndex: 'provider',
            key: 'provider',
            render: (provider: keyof typeof providerInfo) => {
                const info = providerInfo[provider];
                return (
                    <Space>
                        <span style={{ fontSize: 20 }}>{info?.icon}</span>
                        <span>{info?.name || provider}</span>
                    </Space>
                );
            },
        },
        {
            title: 'Görünen Ad',
            dataIndex: 'displayName',
            key: 'displayName',
        },
        {
            title: 'Model',
            dataIndex: 'modelName',
            key: 'modelName',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: 'API Anahtarı',
            dataIndex: 'apiKey',
            key: 'apiKey',
            render: (key: string) => (
                <Tooltip title="Güvenlik için maskelenmiştir">
                    <code style={{ fontSize: 12 }}>{key}</code>
                </Tooltip>
            ),
        },
        {
            title: 'Durum',
            dataIndex: 'isActive',
            key: 'isActive',
            align: 'center' as const,
            render: (isActive: boolean, record: AIProvider) => (
                <Space>
                    <Switch
                        checked={isActive}
                        size="small"
                        onChange={() => handleToggleActive(record.provider)}
                    />
                    <Tag
                        icon={isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                        color={isActive ? 'success' : 'default'}
                    >
                        {isActive ? 'Aktif' : 'Pasif'}
                    </Tag>
                </Space>
            ),
        },
        {
            title: 'Öncelik',
            dataIndex: 'priority',
            key: 'priority',
            align: 'center' as const,
            render: (priority: number) => (
                <Tag color={priority > 50 ? 'gold' : 'default'}>{priority}</Tag>
            ),
        },
        {
            title: 'İşlemler',
            key: 'actions',
            align: 'center' as const,
            render: (_: any, record: AIProvider) => (
                <Space>
                    <Tooltip title="Bağlantıyı Test Et">
                        <Button
                            size="small"
                            icon={<ThunderboltOutlined />}
                            loading={testingProvider === record.provider}
                            onClick={() => handleTestConnection(record.provider)}
                        />
                    </Tooltip>
                    <EditButton
                        hideText
                        size="small"
                        recordItemId={record.provider}
                        onClick={() => router.push(`/ai/providers/edit/${record.provider}`)}
                    />
                    <DeleteButton hideText size="small" recordItemId={record.provider} />
                </Space>
            ),
        },
    ];

    return (
        <List
            title="AI Sağlayıcı Yönetimi"
            headerButtons={
                <Space>
                    <Button
                        icon={<ThunderboltOutlined />}
                        onClick={() => {
                            setPromptProvider(runtimeStatus?.free?.provider || 'google');
                            setTestPromptResult(null);
                            setPromptModalOpen(true);
                        }}
                    >
                        Canlı NOVA Testi
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={() => { tableQueryResult?.refetch(); loadRuntimeStatus(); }}>
                        Yenile
                    </Button>
                    <CreateButton
                        onClick={() => router.push('/ai/providers/create')}
                    />
                </Space>
            }
        >
            {runtimeStatus && (
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    {(['free', 'premium'] as const).map((planKey) => {
                        const info = runtimeStatus[planKey];
                        if (!info) return null;
                        return (
                            <Col xs={24} md={12} key={planKey}>
                                <Card size="small" title={planKey === 'premium' ? '⭐ Mobil NOVA (Premium Plan)' : '🌱 Mobil NOVA (Ücretsiz Plan)'}>
                                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                        <Space wrap>
                                            <Tag color="blue">{info.provider}</Tag>
                                            <Tag color="geekblue">{info.modelName}</Tag>
                                            <Tag>Temp: {info.temperature}</Tag>
                                            <Tag>Max Tokens: {info.maxTokens}</Tag>
                                        </Space>
                                        {info.warning && (
                                            <Alert type="warning" showIcon message={info.warning} />
                                        )}
                                    </Space>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            )}
            <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="Çalışma Mantığı (Mobil Uygulama Entegrasyonu)"
                description="Mobil uygulamadaki NOVA sohbeti önce kullanıcının planına (Ücretsiz / Premium) ait Model Politikasına, ilgili sağlayıcı aktif değilse buradaki en yüksek öncelikli aktif AI Sağlayıcıya, o da yoksa sunucudaki (.env) yedek Gemini 3.8 Flash anahtarına yönlenir."
            />
            <Table {...tableProps} columns={columns} rowKey="provider" />
            <Modal
                title="NOVA Canlı Yanıt Testi"
                open={promptModalOpen}
                onCancel={() => setPromptModalOpen(false)}
                onOk={handleRunPromptTest}
                okText="Test Gönder"
                cancelText="Kapat"
                confirmLoading={runningPromptTest}
            >
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <Input.TextArea
                        rows={3}
                        value={testPromptText}
                        onChange={(e) => setTestPromptText(e.target.value)}
                        placeholder="NOVA'ya test sorusu yazın..."
                    />
                    {testPromptResult && (
                        <Alert
                            type={testPromptResult.startsWith('✅') ? 'success' : 'error'}
                            message={<pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{testPromptResult}</pre>}
                        />
                    )}
                </Space>
            </Modal>
        </List>
    );
}
