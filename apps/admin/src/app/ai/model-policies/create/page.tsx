'use client';

import { Create, useForm } from '@refinedev/antd';
import { AutoComplete, Form, Input, Select, InputNumber } from 'antd';
import { useList } from '@refinedev/core';

const planOptions = [
    { label: 'Ücretsiz (Free)', value: 'free' },
    { label: 'Premium', value: 'premium' },
];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
    google: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
};

export default function ModelPolicyCreate() {
    const { formProps, saveButtonProps } = useForm({
        resource: 'ai/model-policies',
        action: 'create',
    });

    // Fetch available AI providers
    const { data: providersData } = useList({
        resource: 'ai-providers',
        pagination: { mode: 'off' },
    });

    const providers = providersData?.data || [];

    const activeDbProviders = providers
        .filter((p: any) => p.isActive)
        .map((p: any) => ({
            label: `${getProviderIcon(p.provider)} ${p.displayName}`,
            value: p.provider,
            modelName: p.modelName,
        }));

    const providerOptions =
        activeDbProviders.length > 0
            ? activeDbProviders
            : [
                { label: '🔷 Google Gemini', value: 'google', modelName: 'gemini-3.8-flash' },
                { label: '🤖 OpenAI', value: 'openai', modelName: 'gpt-4o-mini' },
                { label: '🧠 Anthropic', value: 'anthropic', modelName: 'claude-3-5-sonnet-20241022' },
                { label: '⚡ DeepSeek', value: 'deepseek', modelName: 'deepseek-chat' },
            ];

    function getProviderIcon(provider: string) {
        const icons: Record<string, string> = {
            google: '🔷',
            openai: '🤖',
            anthropic: '🧠',
            deepseek: '⚡',
        };
        return icons[provider] || '❓';
    }

    return (
        <Create saveButtonProps={saveButtonProps} title="Yeni Model Politikası Oluştur">
            <Form {...formProps} layout="vertical">
                <Form.Item
                    label="Abonelik Planı"
                    name="plan"
                    rules={[{ required: true, message: 'Lütfen plan seçiniz' }]}
                >
                    <Select
                        size="large"
                        options={planOptions}
                        placeholder="Abonelik planı seçiniz"
                    />
                </Form.Item>

                <Form.Item
                    label="AI Sağlayıcı"
                    name="provider"
                    rules={[{ required: true, message: 'Lütfen sağlayıcı seçiniz' }]}
                >
                    <Select
                        size="large"
                        options={providerOptions}
                        placeholder="AI sağlayıcı seçiniz"
                        onChange={(value) => {
                            // Auto-fill model name from selected provider
                            const selectedProvider =
                                providers.find((p: any) => p.provider === value) ||
                                providerOptions.find((p: any) => p.value === value);
                            if (selectedProvider?.modelName) {
                                formProps.form?.setFieldValue('modelName', selectedProvider.modelName);
                            }
                        }}
                    />
                </Form.Item>

                <Form.Item
                    label="Model Adı"
                    name="modelName"
                    rules={[{ required: true, message: 'Lütfen model adı giriniz' }]}
                >
                    <AutoComplete
                        size="large"
                        placeholder="Örn: gemini-3.8-flash"
                        options={(MODEL_SUGGESTIONS[Form.useWatch('provider', formProps.form) || 'google'] || []).map((m) => ({
                            label: m,
                            value: m,
                        }))}
                    />
                </Form.Item>

                <Form.Item
                    label="Sıcaklık (Temperature)"
                    name="temperature"
                    initialValue={0.7}
                    rules={[{ required: true, message: 'Lütfen sıcaklık değeri giriniz' }]}
                    tooltip="Yaratıcılık seviyesi (0.0 = deterministik, 1.0 = yaratıcı)"
                >
                    <InputNumber
                        size="large"
                        min={0}
                        max={2}
                        step={0.1}
                        style={{ width: '100%' }}
                        placeholder="0.0 - 2.0"
                    />
                </Form.Item>

                <Form.Item
                    label="Maksimum Token"
                    name="maxTokens"
                    initialValue={1024}
                    rules={[{ required: true, message: 'Lütfen maksimum token sayısı giriniz' }]}
                    tooltip="Yanıtta üretilebilecek maksimum token sayısı"
                >
                    <InputNumber
                        size="large"
                        min={1}
                        max={32000}
                        style={{ width: '100%' }}
                        placeholder="1 - 32000"
                    />
                </Form.Item>

                <Form.Item
                    label="Etkin Araçlar (JSON)"
                    name="toolsEnabledJson"
                    initialValue={[]}
                    getValueProps={(value) => ({
                        value: typeof value === 'string' ? value : JSON.stringify(value || []),
                    })}
                    normalize={(value) => {
                        try {
                            return JSON.parse(value);
                        } catch {
                            return value;
                        }
                    }}
                    tooltip="Etkin araçların JSON dizisi (Örn: ['web_search', 'calculator'])"
                >
                    <Input.TextArea
                        rows={3}
                        placeholder='["web_search", "calculator"]'
                    />
                </Form.Item>
            </Form>
        </Create>
    );
}