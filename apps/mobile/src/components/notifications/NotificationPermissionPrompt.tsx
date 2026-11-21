import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, AppState, AppStateStatus, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import {
    getOsNotificationPermissionStatus,
    openAppNotificationSettings,
    requestOsNotificationPermission,
} from '@/services/notificationEngine';

interface NotificationPermissionPromptProps {
    onPermissionGranted?: () => void;
    onPermissionDenied?: () => void;
}

export function NotificationPermissionPrompt({
    onPermissionGranted,
    onPermissionDenied
}: NotificationPermissionPromptProps) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        checkPermissionStatus();

        // Uygulama ön plana geldiğinde izni yeniden kontrol et
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
        };
    }, []);

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
            // Kullanıcı ayarlardan dönmüş olabilir, izni yeniden kontrol et
            checkPermissionStatus();
        }
    };

    const checkPermissionStatus = async () => {
        try {
            const info = await getOsNotificationPermissionStatus();
            setPermissionStatus(info.status);

            if (info.granted) {
                onPermissionGranted?.();
            } else if (info.status === 'denied') {
                onPermissionDenied?.();
            }
        } catch (error) {
            console.error('Error checking notification permissions:', error);
        }
    };

    const requestPermission = async () => {
        setIsLoading(true);
        try {
            const res = await requestOsNotificationPermission({ showSettingsPrompt: false });
            setPermissionStatus(res.status);

            if (res.granted) {
                onPermissionGranted?.();
                Alert.alert(
                    'Başarılı! 🎉',
                    'Bildirim izni verildi. Artık önemli güncellemeleri kaçırmayacaksın!',
                    [{ text: 'Tamam' }]
                );
            } else {
                onPermissionDenied?.();
                showSettingsAlert();
            }
        } catch (error) {
            console.error('Error requesting notification permissions:', error);
            Alert.alert(
                'Hata',
                'Bildirim izni alınırken bir hata oluştu. Lütfen tekrar deneyin.',
                [{ text: 'Tamam' }]
            );
        } finally {
            setIsLoading(false);
        }
    };

    const showSettingsAlert = () => {
        Alert.alert(
            'Bildirim İzni Gerekli 🔔',
            'Mizahi bildirimler ve hatırlatmalar alabilmek için bildirim iznine ihtiyacımız var.\n\nAyarlar > Bildirimler\'den izin verebilirsiniz.',
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Ayarları Aç',
                    onPress: openSettings,
                },
            ]
        );
    };

    const openSettings = () => {
        openAppNotificationSettings();
    };

    // Eğer izin verilmişse hiçbir şey gösterme
    if (permissionStatus === 'granted') {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.emoji}>🔔</Text>
                <Text style={styles.title}>
                    {permissionStatus === 'denied'
                        ? 'Bildirim İzni Reddedildi'
                        : 'Bildirimleri Aç'}
                </Text>
                <Text style={styles.description}>
                    {permissionStatus === 'denied'
                        ? 'Mizahi bildirimler ve hatırlatmalar alabilmek için cihaz ayarlarından bildirim iznini açmanız gerekiyor.'
                        : 'Eğlenceli bildirimler, streak hatırlatmaları ve regl dönemi desteği almak ister misin?'}
                </Text>

                {permissionStatus === 'denied' ? (
                    <>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={openSettings}
                        >
                            <Text style={styles.buttonText}>Ayarları Aç</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.refreshButton}
                            onPress={async () => {
                                setIsRefreshing(true);
                                await checkPermissionStatus();
                                setIsRefreshing(false);
                            }}
                            disabled={isRefreshing}
                        >
                            <Text style={styles.refreshButtonText}>
                                {isRefreshing ? '🔄 Kontrol Ediliyor...' : '🔄 İzni Yeniden Kontrol Et'}
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <TouchableOpacity
                        style={styles.button}
                        onPress={requestPermission}
                        disabled={isLoading}
                    >
                        <Text style={styles.buttonText}>
                            {isLoading ? 'İzin İsteniyor...' : 'İzin Ver'}
                        </Text>
                    </TouchableOpacity>
                )}

                {permissionStatus === 'denied' && (
                    <View style={styles.instructionsContainer}>
                        <Text style={styles.instructionsTitle}>Nasıl Açılır? 📱</Text>
                        {Platform.OS === 'ios' ? (
                            <>
                                <Text style={styles.instructionStep}>1. Ayarlar uygulamasını aç</Text>
                                <Text style={styles.instructionStep}>2. Aşağı kaydır ve uygulamayı bul</Text>
                                <Text style={styles.instructionStep}>3. "Bildirimler" seçeneğine dokun</Text>
                                <Text style={styles.instructionStep}>4. "Bildirimlere İzin Ver" anahtarını aç</Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.instructionStep}>1. Ayarlar uygulamasını aç</Text>
                                <Text style={styles.instructionStep}>2. "Uygulamalar" veya "Bildirimler" bölümüne git</Text>
                                <Text style={styles.instructionStep}>3. Uygulamayı bul ve seç</Text>
                                <Text style={styles.instructionStep}>4. "Bildirimlere izin ver" seçeneğini aç</Text>
                            </>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}

const createStyles = (theme: any) => StyleSheet.create({
    container: {
        padding: 16,
    },
    card: {
        backgroundColor: theme.colors.backgroundCard,
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: theme.colors.primary + '20',
    },
    emoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: theme.colors.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    description: {
        fontSize: 15,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    button: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        minWidth: 200,
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    refreshButton: {
        backgroundColor: 'transparent',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginTop: 12,
        borderWidth: 2,
        borderColor: theme.colors.primary,
        minWidth: 200,
        alignItems: 'center',
    },
    refreshButtonText: {
        color: theme.colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    instructionsContainer: {
        marginTop: 24,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border + '30',
        width: '100%',
    },
    instructionsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    instructionStep: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 8,
        paddingLeft: 8,
        lineHeight: 20,
    },
});
