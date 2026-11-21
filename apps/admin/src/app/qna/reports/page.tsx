'use client';

import { useTable } from '@refinedev/antd';
import { List } from '@refinedev/antd';
import { Table, Tag, Button, Space, Badge, Tooltip, theme as antdTheme } from 'antd';
import { EyeOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

export default function ReportsList() {
    const router = useRouter();
    const { token } = antdTheme.useToken();
    const { tableProps } = useTable({
        resource: 'qna/moderation/reports',
        syncWithLocation: true,
        sorters: {
            initial: [
                {
                    field: 'createdAt',
                    order: 'desc',
                },
            ],
        },
        // Removed initial filter to show all reports by default
    });

    const columns = [
        {
            title: 'İçerik Türü',
            dataIndex: 'contentType',
            key: 'contentType',
            width: 120,
            filters: [
                { text: 'Soru', value: 'QUESTION' },
                { text: 'Cevap', value: 'ANSWER' },
                { text: 'Yorum', value: 'COMMENT' },
            ],
            render: (type: string) => {
                const labels: Record<string, string> = {
                    QUESTION: 'Soru',
                    ANSWER: 'Cevap',
                    COMMENT: 'Yorum',
                };
                const colors: Record<string, string> = {
                    QUESTION: 'blue',
                    ANSWER: 'green',
                    COMMENT: 'purple',
                };
                return <Tag color={colors[type]}>{labels[type] || type}</Tag>;
            },
        },
        {
            title: 'Sebep',
            dataIndex: 'reason',
            key: 'reason',
            ellipsis: true,
            render: (reason: string) => (
                <Tooltip title={reason}>
                    <span>{reason}</span>
                </Tooltip>
            ),
        },
        {
            title: 'Açıklama',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (description: string) => (
                description ? (
                    <Tooltip title={description}>
                        <span style={{ color: token.colorTextSecondary }}>
                            {description.substring(0, 50)}
                            {description.length > 50 ? '...' : ''}
                        </span>
                    </Tooltip>
                ) : (
                    <span style={{ color: token.colorTextTertiary }}>-</span>
                )
            ),
        },
        {
            title: 'Durum',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            filters: [
                { text: 'Beklemede', value: 'PENDING' },
                { text: 'İncelendi', value: 'REVIEWED' },
                { text: 'Çözüldü', value: 'RESOLVED' },
                { text: 'Reddedildi', value: 'DISMISSED' },
            ],
            render: (status: string) => {
                const colors: Record<string, string> = {
                    PENDING: 'orange',
                    REVIEWED: 'blue',
                    RESOLVED: 'green',
                    DISMISSED: 'default',
                };
                const labels: Record<string, string> = {
                    PENDING: 'Beklemede',
                    REVIEWED: 'İncelendi',
                    RESOLVED: 'Çözüldü',
                    DISMISSED: 'Reddedildi',
                };
                return (
                    <Badge
                        status={status === 'PENDING' ? 'processing' : 'default'}
                        text={
                            <Tag color={colors[status]}>
                                {labels[status] || status}
                            </Tag>
                        }
                    />
                );
            },
        },
        {
            title: 'Raporlayan',
            dataIndex: ['reporter', 'email'],
            key: 'reporter',
            ellipsis: true,
            render: (email: string, record: any) => {
                const username = record.reporter?.username;
                return (
                    <Tooltip title={email}>
                        <span>{username || email || 'Bilinmiyor'}</span>
                    </Tooltip>
                );
            },
        },
        {
            title: 'Rapor Tarihi',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 150,
            sorter: true,
            render: (date: string) => {
                const now = new Date();
                const reportDate = new Date(date);
                const diffHours = Math.floor((now.getTime() - reportDate.getTime()) / (1000 * 60 * 60));

                return (
                    <Tooltip title={dayjs(date).format('DD.MM.YYYY HH:mm:ss')}>
                        <span>
                            {diffHours < 24 && (
                                <WarningOutlined style={{ color: token.colorError, marginRight: 4 }} />
                            )}
                            {dayjs(date).format('DD.MM.YYYY HH:mm')}
                        </span>
                    </Tooltip>
                );
            },
        },
        {
            title: 'İşlemler',
            key: 'actions',
            width: 100,
            fixed: 'right' as const,
            render: (_: any, record: any) => (
                <Button
                    type="primary"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => router.push(`/qna/reports/show/${record.id}`)}
                >
                    İncele
                </Button>
            ),
        },
    ];

    return (
        <List
            title="Soru & Cevap Raporları"
            headerButtons={({ defaultButtons }) => (
                <>
                    {defaultButtons}
                </>
            )}
        >
            <Table
                {...tableProps}
                columns={columns}
                rowKey="id"
                scroll={{ x: 1200 }}
                rowClassName={(record) =>
                    record.status === 'PENDING' ? 'pending-report' : ''
                }
            />
            <style jsx global>{`
                .pending-report > td.ant-table-cell {
                    background-color: ${token.colorWarningBg};
                    color: ${token.colorText};
                }
                .pending-report:hover > td.ant-table-cell,
                .pending-report > td.ant-table-cell-row-hover {
                    background-color: ${token.colorWarningBgHover} !important;
                }
            `}</style>
        </List>
    );
}
