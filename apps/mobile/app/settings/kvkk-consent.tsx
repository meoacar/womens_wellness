import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';

export default function KVKKConsentScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { user } = useAuthStore();
    const styles = createStyles(theme);

    // Consent states
    const [dataProcessing, setDataProcessing] = useState(true); // Required
    const [marketingConsent, setMarketingConsent] = useState(false);
    const [analyticsConsent, setAnalyticsConsent] = useState(false);
    const [aiMemoryConsent, setAiMemoryConsent] = useState(false);
    const [thirdPartyConsent, setThirdPartyConsent] = useState(false);
    const [existingPrefs, setExistingPrefs] = useState<Record<string, any>>({});

    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        loadConsentPreferences();
    }, []);

    const loadConsentPreferences = async () => {
        try {
            const localStr = await SecureStore.getItemAsync('kvkkConsents');
            if (localStr) {
                const parsed = JSON.parse(localStr);
                setMarketingConsent(Boolean(parsed.marketingConsent));
                setAnalyticsConsent(Boolean(parsed.analyticsConsent));
                setAiMemoryConsent(Boolean(parsed.aiMemoryConsent));
                setThirdPartyConsent(Boolean(parsed.thirdPartyConsent));
            }

            const meResponse = await api.get<any>('/me');
            const prefs = meResponse?.profile?.preferencesJson || {};
            setExistingPrefs(prefs);
            if (prefs.kvkkConsents) {
                setMarketingConsent(Boolean(prefs.kvkkConsents.marketingConsent));
                setAnalyticsConsent(Boolean(prefs.kvkkConsents.analyticsConsent));
                setAiMemoryConsent(Boolean(prefs.kvkkConsents.aiMemoryConsent));
                setThirdPartyConsent(Boolean(prefs.kvkkConsents.thirdPartyConsent));
            }
        } catch (error) {
            console.warn('Could not load KVKK preferences from server, using cached:', error);
        }
    };

    const handleSave = async () => {
        try {
            const nowIso = new Date().toISOString();
            const kvkkConsents = {
                dataProcessing: true,
                privacyPolicyAccepted: true,
                marketingConsent,
                analyticsConsent,
                aiMemoryConsent,
                thirdPartyConsent,
                version: '1.0',
                source: 'SETTINGS',
                updatedAt: nowIso,
            };
            await SecureStore.setItemAsync('kvkkConsents', JSON.stringify(kvkkConsents));
            await api.patch('/me', {
                preferencesJson: {
                    ...existingPrefs,
                    kvkkConsents,
                },
            });
            setHasChanges(false);
            Alert.alert(
                'Başarılı',
                'KVKK tercihleriniz güncellendi.',
                [{ text: 'Tamam', onPress: () => router.back() }]
            );
        } catch (error) {
            Alert.alert('Hata', 'Tercihler kaydedilirken bir hata oluştu.');
        }
    };

    const handleWithdrawAll = () => {
        Alert.alert(
            'Tüm İzinleri Geri Çek',
            'Tüm isteğe bağlı izinleri geri çekmek istediğinizden emin misiniz? Zorunlu veri işleme devam edecektir.',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Geri Çek',
                    style: 'destructive',
                    onPress: () => {
                        setMarketingConsent(false);
                        setAnalyticsConsent(false);
                        setAiMemoryConsent(false);
                        setThirdPartyConsent(false);
                        setHasChanges(true);
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>‹ Geri</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>KVKK İzinleri</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                <View style={styles.infoBox}>
                    <Text style={styles.infoIcon}>🔒</Text>
                    <Text style={styles.infoTitle}>Kişisel Verileriniz Güvende</Text>
                    <Text style={styles.infoText}>
                        6698 sayılı KVKK kapsamında kişisel verilerinizin işlenmesine ilişkin tercihlerinizi buradan yönetebilirsiniz.
                    </Text>
                </View>

                {/* Required Consent */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Zorunlu İzinler</Text>
                    <Text style={styles.sectionDescription}>
                        Bu izinler uygulamanın temel işlevleri için gereklidir ve devre dışı bırakılamaz.
                    </Text>

                    <ConsentItem
                        title="Temel Veri İşleme"
                        description="Hesap yönetimi, kimlik doğrulama ve temel uygulama işlevleri için gerekli veri işleme."
                        value={dataProcessing}
                        onValueChange={() => { }}
                        disabled={true}
                        required={true}
                    />
                </View>

                {/* Optional Consents */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>İsteğe Bağlı İzinler</Text>
                    <Text style={styles.sectionDescription}>
                        Bu izinleri istediğiniz zaman değiştirebilirsiniz.
                    </Text>

                    <ConsentItem
                        title="Pazarlama İletişimi"
                        description="Yeni özellikler, kampanyalar ve özel teklifler hakkında bildirim almak için."
                        value={marketingConsent}
                        onValueChange={(value) => {
                            setMarketingConsent(value);
                            setHasChanges(true);
                        }}
                    />

                    <ConsentItem
                        title="Analitik ve İyileştirme"
                        description="Uygulama kullanımınızın analiz edilmesi ve hizmetlerimizin iyileştirilmesi için."
                        value={analyticsConsent}
                        onValueChange={(value) => {
                            setAnalyticsConsent(value);
                            setHasChanges(true);
                        }}
                    />

                    <ConsentItem
                        title="AI Hafıza ve Kişiselleştirme"
                        description="AI asistanının sohbet geçmişinizi hatırlayarak daha kişiselleştirilmiş öneriler sunması için."
                        value={aiMemoryConsent}
                        onValueChange={(value) => {
                            setAiMemoryConsent(value);
                            setHasChanges(true);
                        }}
                    />

                    <ConsentItem
                        title="Üçüncü Taraf Entegrasyonlar"
                        description="Takvim senkronizasyonu, sağlık uygulamaları gibi üçüncü taraf hizmetlerle veri paylaşımı."
                        value={thirdPartyConsent}
                        onValueChange={(value) => {
                            setThirdPartyConsent(value);
                            setHasChanges(true);
                        }}
                    />
                </View>

                {/* KVKK Rights */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>KVKK Haklarınız</Text>
                    <View style={styles.rightsContainer}>
                        <RightItem icon="📋" text="Verilerinizin işlenip işlenmediğini öğrenme" />
                        <RightItem icon="📊" text="İşlenme amacını ve uygunluğunu sorgulama" />
                        <RightItem icon="✏️" text="Eksik veya yanlış verilerin düzeltilmesini isteme" />
                        <RightItem icon="🗑️" text="Verilerin silinmesini veya yok edilmesini talep etme" />
                        <RightItem icon="⚖️" text="Otomatik sistemlerle alınan kararlara itiraz etme" />
                        <RightItem icon="💰" text="Hukuka aykırı işleme nedeniyle zararın giderilmesini isteme" />
                    </View>

                    <TouchableOpacity
                        style={[styles.linkButton, { marginBottom: 10 }]}
                        onPress={() => router.push('/kvkk-aydinlatma-metni' as any)}
                    >
                        <Text style={styles.linkButtonText}>KVKK Aydınlatma Metnini Oku →</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={() => router.push('/settings/privacy-policy')}
                    >
                        <Text style={styles.linkButtonText}>Gizlilik Politikasını Oku →</Text>
                    </TouchableOpacity>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={styles.withdrawButton}
                        onPress={handleWithdrawAll}
                    >
                        <Text style={styles.withdrawButtonText}>Tüm İzinleri Geri Çek</Text>
                    </TouchableOpacity>

                    {hasChanges && (
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSave}
                        >
                            <Text style={styles.saveButtonText}>Değişiklikleri Kaydet</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Contact Info */}
                <View style={styles.contactBox}>
                    <Text style={styles.contactTitle}>KVKK Başvuruları</Text>
                    <Text style={styles.contactText}>
                        KVKK Madde 11 kapsamındaki haklarınızı kullanmak için:
                    </Text>
                    <Text style={styles.contactEmail}>kvkk@kadinatlasi.com</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function ConsentItem({
    title,
    description,
    value,
    onValueChange,
    disabled = false,
    required = false,
}: {
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
    required?: boolean;
}) {
    const theme = useTheme();
    return (
        <View style={{
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 12,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            opacity: disabled ? 0.6 : 1,
        }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: theme.spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: theme.colors.text,
                        }}>
                            {title}
                        </Text>
                        {required && (
                            <View style={{
                                backgroundColor: theme.colors.error + '20',
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 4,
                                marginLeft: 8,
                            }}>
                                <Text style={{
                                    fontSize: 11,
                                    fontWeight: '600',
                                    color: theme.colors.error,
                                }}>
                                    ZORUNLU
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={{
                        fontSize: 14,
                        color: theme.colors.textSecondary,
                        lineHeight: 20,
                    }}>
                        {description}
                    </Text>
                </View>
                <Switch
                    value={value}
                    onValueChange={onValueChange}
                    disabled={disabled}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={value ? '#fff' : '#f4f3f4'}
                />
            </View>
        </View>
    );
}

function RightItem({ icon, text }: { icon: string; text: string }) {
    const theme = useTheme();
    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, marginRight: 12 }}>{icon}</Text>
            <Text style={{
                flex: 1,
                fontSize: 14,
                color: theme.colors.textSecondary,
                lineHeight: 20,
            }}>
                {text}
            </Text>
        </View>
    );
}

const createStyles = (theme: any) =>
    StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },
        backButton: {
            padding: theme.spacing.xs,
        },
        backButtonText: {
            fontSize: 24,
            color: theme.colors.primary,
            fontWeight: '600',
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.colors.text,
        },
        headerRight: {
            width: 40,
        },
        container: {
            flex: 1,
        },
        contentContainer: {
            padding: theme.spacing.lg,
            paddingBottom: 40,
        },
        infoBox: {
            backgroundColor: theme.colors.primary + '15',
            borderRadius: 16,
            padding: theme.spacing.lg,
            alignItems: 'center',
            marginBottom: theme.spacing.xl,
            borderWidth: 1,
            borderColor: theme.colors.primary + '30',
        },
        infoIcon: {
            fontSize: 48,
            marginBottom: theme.spacing.sm,
        },
        infoTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: theme.spacing.xs,
            textAlign: 'center',
        },
        infoText: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            lineHeight: 20,
        },
        section: {
            marginBottom: theme.spacing.xl,
        },
        sectionTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: theme.spacing.xs,
        },
        sectionDescription: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.md,
            lineHeight: 20,
        },
        rightsContainer: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 12,
            padding: theme.spacing.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginBottom: theme.spacing.md,
        },
        linkButton: {
            backgroundColor: theme.colors.primary,
            borderRadius: 12,
            padding: theme.spacing.md,
            alignItems: 'center',
        },
        linkButtonText: {
            fontSize: 16,
            fontWeight: '600',
            color: '#fff',
        },
        actionsContainer: {
            marginTop: theme.spacing.lg,
            gap: theme.spacing.md,
        },
        withdrawButton: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 12,
            padding: theme.spacing.md,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.colors.error,
        },
        withdrawButtonText: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.colors.error,
        },
        saveButton: {
            backgroundColor: theme.colors.primary,
            borderRadius: 12,
            padding: theme.spacing.md,
            alignItems: 'center',
        },
        saveButtonText: {
            fontSize: 16,
            fontWeight: '600',
            color: '#fff',
        },
        contactBox: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 12,
            padding: theme.spacing.lg,
            marginTop: theme.spacing.xl,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: 'center',
        },
        contactTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: theme.spacing.xs,
        },
        contactText: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.xs,
        },
        contactEmail: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.colors.primary,
        },
    });
