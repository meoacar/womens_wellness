'use client';

import { Create, useForm } from '@refinedev/antd';
import { AutoComplete, Form, Input, Select, InputNumber, Switch } from 'antd';

const providerOptions = [
    { label: '🔷 Google Gemini', value: 'google' },
    { label: '🤖 OpenAI', value: 'openai' },
    { label: '🧠 Anthropic', value: 'anthropic' },
    { label: '⚡ DeepSeek', value: 'deepseek' },
];

const modelSuggestions = {
    google: ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
};

export default function AIProviderCreate() {
    const { formProps, saveButtonProps, form } = useForm({
        resource: 'ai-providers',
        action: 'create',
    });

    const selectedProvider = Form.useWatch('provider', form);

    return (
        <Create saveButtonProps={saveButtonProps} title="Yeni AI Sağlayıcı Ekle">
            <Form {...formProps} layout="vertical">
                <Form.Item
                    label="Sağlayıcı (Provider)"
                    name="provider"
                    rules={[{ required: true, message: 'Lütfen bir sağlayıcı seçiniz' }]}
                >
                    <Select
                        size="large"
                        options={providerOptions}
                        placeholder="AI sağlayıcı seçiniz"
                    />
                </Form.Item>

                <Form.Item
                    label="Model Adı"
                    name="modelName"
                    rules={[{ required: true, message: 'Lütfen model adı giriniz' }]}
                >
                    <AutoComplete
                        size="large"
                        placeholder="Model seçin veya yazın (örn: gemini-3.8-flash)"
                        filterOption={(inputValue, option) =>
                            String(option?.value || '')
                                .toLowerCase()
                                .includes(inputValue.toLowerCase())
                        }
                        options={
                            selectedProvider
                                ? modelSuggestions[selectedProvider as keyof typeof modelSuggestions]?.map((m) => ({
                                    label: m,
                                    value: m,
                                }))
                                : []
                        }
                    />
                </Form.Item>

                <Form.Item
                    label="API Anahtarı"
                    name="apiKey"
                    rules={[
                        { required: true, message: 'Lütfen API anahtarı giriniz' },
                        { min: 10, message: 'API anahtarı en az 10 karakter olmalıdır' },
                    ]}
                >
                    <Input.Password size="large" placeholder="API anahtarını giriniz" />
                </Form.Item>

                <Form.Item
                    label="Görünen Ad"
                    name="displayName"
                    rules={[{ required: true, message: 'Lütfen görünen ad giriniz' }]}
                >
                    <Input size="large" placeholder="Örn: Google Gemini 3.8 Flash" />
                </Form.Item>

                <Form.Item label="Açıklama" name="description">
                    <Input.TextArea rows={3} placeholder="İsteğe bağlı açıklama" />
                </Form.Item>

                <Form.Item
                    label="Öncelik"
                    name="priority"
                    initialValue={0}
                    rules={[{ required: true, message: 'Lütfen öncelik giriniz' }]}
                    tooltip="Yüksek öncelikli sağlayıcılar önce kullanılır"
                >
                    <InputNumber
                        size="large"
                        min={0}
                        max={1000}
                        style={{ width: '100%' }}
                        placeholder="0-1000"
                    />
                </Form.Item>

                <Form.Item
                    label="Durum"
                    name="isActive"
                    valuePropName="checked"
                    initialValue={true}
                >
                    <Switch checkedChildren="Aktif" unCheckedChildren="Pasif" />
                </Form.Item>
            </Form>
        </Create>
    );
}
