import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, AppState, AppStateStatus, Alert } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useFunNotificationStore } from '@/store/funNotificationStore';
import { remindersService } from '@/services/api';
import {
    getOsNotificationPermissionStatus,
    loadLocalNotificationSettings,
    registerPushTokenWithBackend,
    requestOsNotificationPermission,
    saveLocalNotificationSettings,
    sendFunTestLocalNotification,
    syncFunLocalNotifications,
} from '@/services/notificationEngine';
import { NotificationPermissionPrompt } from '../notifications/NotificationPermissionPrompt';

export function FunNotificationSettings() {
    const theme = useTheme();
    const styles = createStyles(theme);
    const [hasPermission, setHasPermission] = useState(false);
    const {
        preferences,
        setEnabled,
        setStreakNotifications,
        setMotivationNotifications,
        setAchievementNotifications,
        setRandomNotifications,
        setPeriodSupportNotifications,
        setFrequency
    } = useFunNotificationStore();

    useEffect(() => {
        checkPermission();

        // Uygulama ön plana geldiğinde izni yeniden kontrol et
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, []);

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
            // Kullanıcı ayarlardan dönmüş olabilir
            checkPermission();
        }
    };

    const checkPermission = async () => {
        try {
            const perm = await getOsNotificationPermissionStatus();
            setHasPermission(perm.granted);
        } catch (error) {
            console.error('İzin kontrolü hatası:', error);
            setHasPermission(false);
        }
    };

    useEffect(() => {
        syncFunLocalNotifications().catch(() => {});
        loadLocalNotificationSettings()
            .then((local) => {
                if (local.funNotifications !== preferences.enabled) {
                    return saveLocalNotificationSettings({
                        ...local,
                        funNotifications: preferences.enabled,
                        periodReminders: preferences.periodSupportNotifications,
                    });
                }
            })
            .catch(() => {});

        if (useAuthStore.getState().isAuthenticated) {
            remindersService
                .updateNotificationPreferences({
                    funNotifications: preferences.enabled,
                    periodReminders: preferences.periodSupportNotifications,
                })
                .catch(() => {});
        }
    }, [
        hasPermission,
        preferences.enabled,
        preferences.frequency,
        preferences.motivationNotifications,
        preferences.randomNotifications,
        preferences.periodSupportNotifications,
    ]);

    const handleSendFunTest = async () => {
        const chosen = await sendFunTestLocalNotification();
        if (chosen) {
            setHasPermission(true);
            Alert.alert('Test Bildirimi Gönderildi', `${chosen.titleTr}\n${chosen.messageTr}`);
        }
    };

    const handlePermissionGranted = () => {
        setHasPermission(true);
        // İzin verildiğinde bildirimleri otomatik aç
        if (!preferences.enabled) {
            setEnabled(true);
        }
    };

    const handlePermissionDenied = () => {
        setHasPermission(false);
        // İzin reddedildiğinde bildirimleri kapat
        if (preferences.enabled) {
            setEnabled(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Mizahi Bildirimler 😊</Text>

            {/* İzin yoksa prompt göster */}
            {!hasPermission && (
                <NotificationPermissionPrompt
                    onPermissionGranted={handlePermissionGranted}
                    onPermissionDenied={handlePermissionDenied}
                />
            )}

            {/* Ana Anahtar */}
            <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Mizahi Bildirimleri Aç</Text>
                    <Text style={styles.settingDescription}>
                        {!hasPermission
                            ? 'Önce bildirim iznini vermelisiniz'
                            : 'Eğlenceli ve motive edici mesajlar al'}
                    </Text>
                </View>
                <Switch
                    value={hasPermission && preferences.enabled}
                    onValueChange={async (value) => {
                        if (!hasPermission && value) {
                            const req = await requestOsNotificationPermission({ showSettingsPrompt: true });
                            if (req.granted) {
                                setHasPermission(true);
                                setEnabled(true);
                                registerPushTokenWithBackend().catch(() => {});
                            } else {
                                setHasPermission(false);
                                setEnabled(false);
                            }
                        } else if (hasPermission) {
                            setEnabled(value);
                        }
                    }}
                    trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                    thumbColor={theme.colors.backgroundCard}
                />
            </View>

            <TouchableOpacity
                style={styles.testFunButton}
                onPress={handleSendFunTest}
                activeOpacity={0.85}
            >
                <Text style={styles.testFunButtonText}>
                    🎭 Şimdi Test Mizah Bildirimi Gönder
                </Text>
            </TouchableOpacity>

            {preferences.enabled && (
                <>
                    {/* Bildirim Türleri */}
                    <View style={styles.section}>
                        <Text style={styles.subsectionTitle}>Bildirim Türleri</Text>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>🔥 Streak Bildirimleri</Text>
                                <Text style={styles.settingDescription}>
                                    3, 7, 30 gün gibi önemli günlerde
                                </Text>
                            </View>
                            <Switch
                                value={preferences.streakNotifications}
                                onValueChange={setStreakNotifications}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={theme.colors.backgroundCard}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>💪 Motivasyon Mesajları</Text>
                                <Text style={styles.settingDescription}>
                                    Günlük hatırlatmalar ve teşvikler
                                </Text>
                            </View>
                            <Switch
                                value={preferences.motivationNotifications}
                                onValueChange={setMotivationNotifications}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={theme.colors.backgroundCard}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>🎮 Başarı Bildirimleri</Text>
                                <Text style={styles.settingDescription}>
                                    50, 100 veri girişi gibi başarılar
                                </Text>
                            </View>
                            <Switch
                                value={preferences.achievementNotifications}
                                onValueChange={setAchievementNotifications}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={theme.colors.backgroundCard}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>✨ Rastgele Mesajlar</Text>
                                <Text style={styles.settingDescription}>
                                    Su içmeyi unutma gibi eğlenceli hatırlatmalar
                                </Text>
                            </View>
                            <Switch
                                value={preferences.randomNotifications}
                                onValueChange={setRandomNotifications}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={theme.colors.backgroundCard}
                            />
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>💕 Regl Dönemi Desteği</Text>
                                <Text style={styles.settingDescription}>
                                    Regl zamanında özel motivasyon mesajları
                                </Text>
                            </View>
                            <Switch
                                value={preferences.periodSupportNotifications}
                                onValueChange={setPeriodSupportNotifications}
                                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                                thumbColor={theme.colors.backgroundCard}
                            />
                        </View>
                    </View>

                    {/* Sıklık Ayarı */}
                    <View style={styles.section}>
                        <Text style={styles.subsectionTitle}>Bildirim Sıklığı</Text>
                        <Text style={styles.frequencyDescription}>
                            Günde kaç bildirim almak istersin?
                        </Text>

                        <View style={styles.frequencyButtons}>
                            <TouchableOpacity
                                style={[
                                    styles.frequencyButton,
                                    preferences.frequency === 'low' && styles.frequencyButtonActive
                                ]}
                                onPress={() => setFrequency('low')}
                            >
                                <Text style={[
                                    styles.frequencyButtonText,
                                    preferences.frequency === 'low' && styles.frequencyButtonTextActive
                                ]}>
                                    Az (1/gün)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.frequencyButton,
                                    preferences.frequency === 'medium' && styles.frequencyButtonActive
                                ]}
                                onPress={() => setFrequency('medium')}
                            >
                                <Text style={[
                                    styles.frequencyButtonText,
                                    preferences.frequency === 'medium' && styles.frequencyButtonTextActive
                                ]}>
                                    Orta (2-3/gün)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.frequencyButton,
                                    preferences.frequency === 'high' && styles.frequencyButtonActive
                                ]}
                                onPress={() => setFrequency('high')}
                            >
                                <Text style={[
                                    styles.frequencyButtonText,
                                    preferences.frequency === 'high' && styles.frequencyButtonTextActive
                                ]}>
                                    Çok (4-5/gün)
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            )}
        </View>
    );
}

const createStyles = (theme: any) => StyleSheet.create({
    container: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: 16,
    },
    subsectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 12,
    },
    section: {
        marginTop: 24,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border + '30',
    },
    settingInfo: {
        flex: 1,
        marginRight: 16,
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: theme.colors.text,
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        lineHeight: 18,
    },
    frequencyDescription: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 12,
    },
    frequencyButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    frequencyButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: theme.colors.backgroundCard,
        borderWidth: 2,
        borderColor: theme.colors.border,
        alignItems: 'center',
    },
    frequencyButtonActive: {
        backgroundColor: theme.colors.primary + '20',
        borderColor: theme.colors.primary,
    },
    frequencyButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.colors.textSecondary,
    },
    frequencyButtonTextActive: {
        color: theme.colors.primary,
        fontWeight: '600',
    },
    testFunButton: {
        marginTop: 10,
        backgroundColor: theme.colors.primary,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    testFunButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
});
