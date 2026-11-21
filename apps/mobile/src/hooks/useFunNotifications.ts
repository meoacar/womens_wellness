import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
    getOsNotificationPermissionStatus,
    syncFunLocalNotifications,
} from '@/services/notificationEngine';
import { FunNotification } from '@/types/funNotifications';
import { FunNotificationService } from '@/services/funNotificationService';
import { syncPeriodNotifications } from '@/services/periodNotificationSync';
import { useFunNotificationStore } from '@/store/funNotificationStore';

interface UseFunNotificationsOptions {
    streakDay?: number;
    dataEntryCount?: number;
    cycleDay?: number;
    isPeriodWeek?: boolean;
    lastDataEntryHours?: number;
    autoShow?: boolean;
}

export function useFunNotifications(options: UseFunNotificationsOptions = {}) {
    const [currentNotification, setCurrentNotification] = useState<FunNotification | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [periodPoolVersion, setPeriodPoolVersion] = useState(0);
    const { preferences } = useFunNotificationStore();

    // İzin kontrolü
    useEffect(() => {
        checkPermission();

        // Uygulama ön plana geldiğinde izni yeniden kontrol et
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                checkPermission();
            }
        });

        return () => {
            subscription?.remove();
        };
    }, []);

    const checkPermission = async () => {
        try {
            const perm = await getOsNotificationPermissionStatus();
            setHasPermission(perm.granted);
            if (perm.granted && preferences.enabled) {
                syncFunLocalNotifications().catch(() => {});
            }
        } catch (error) {
            console.error('İzin kontrolü hatası:', error);
            setHasPermission(false);
        }
    };

    useEffect(() => {
        let mounted = true;
        syncPeriodNotifications({
            cycleDay: options.cycleDay,
            isPeriodWeek: options.isPeriodWeek,
            scheduleLocal: hasPermission,
        })
            .then(() => {
                if (mounted) {
                    setPeriodPoolVersion((v) => v + 1);
                }
            })
            .catch(() => {});
        return () => {
            mounted = false;
        };
    }, [options.cycleDay, options.isPeriodWeek, hasPermission]);

    useEffect(() => {
        if (__DEV__) {
            console.log('[useFunNotifications] autoShow:', options.autoShow);
            console.log('[useFunNotifications] preferences.enabled:', preferences.enabled);
            console.log('[useFunNotifications] hasPermission:', hasPermission);
        }

        if (!options.autoShow || !preferences.enabled) {
            if (__DEV__) {
                console.log('[useFunNotifications] Skipping - conditions not met');
            }
            return;
        }

        if (hasPermission) {
            syncFunLocalNotifications().catch(() => {});
        }

        // Günlük limit kontrolü (sadece ilk gösterimde)
        // Kapatma sonrası gösterimde limit kontrolü yapma
        const canShow = FunNotificationService.canShowDailyNotification();
        if (__DEV__) {
            console.log('[useFunNotifications] Can show daily:', canShow);
        }

        // İlk bildirim için limit kontrolü yap
        // Ama eğer zaten bir bildirim varsa (kapatma sonrası), limit kontrolü yapma
        if (!canShow && !currentNotification) {
            if (__DEV__) {
                console.log('[useFunNotifications] Daily limit reached, skipping');
            }
            return;
        }

        // En uygun bildirimi seç
        const notification = FunNotificationService.selectBestNotification({
            streakDay: options.streakDay,
            dataEntryCount: options.dataEntryCount,
            isPeriodWeek: options.isPeriodWeek,
            lastDataEntryHours: options.lastDataEntryHours,
        });

        if (__DEV__) {
            console.log('[useFunNotifications] Selected notification:', notification?.id);
        }

        if (notification) {
            setCurrentNotification(notification);
            FunNotificationService.markAsShown(notification.id);
        }
    }, [
        options.streakDay,
        options.dataEntryCount,
        options.isPeriodWeek,
        options.lastDataEntryHours,
        options.autoShow,
        preferences.enabled,
        hasPermission,  // İzin değiştiğinde tekrar kontrol et
        periodPoolVersion,
    ]);

    const dismissNotification = () => {
        const dismissedId = currentNotification?.id;

        if (__DEV__) {
            console.log('[useFunNotifications] Dismissing notification:', dismissedId);
            console.log('[useFunNotifications] Options:', options);
        }

        // Mevcut bildirimi cooldown'a al
        if (currentNotification) {
            FunNotificationService.markAsShown(currentNotification.id);
        }

        // Önce state'i temizle
        setCurrentNotification(null);

        // Hemen başka bir bildirim bul ve göster (kapatılan hariç)
        setTimeout(() => {
            const nextNotification = FunNotificationService.selectBestNotification({
                streakDay: options.streakDay,
                dataEntryCount: options.dataEntryCount,
                isPeriodWeek: options.isPeriodWeek,
                lastDataEntryHours: options.lastDataEntryHours,
                excludeId: dismissedId,  // Kapatılan bildirimi hariç tut
            });

            if (__DEV__) {
                console.log('[useFunNotifications] Next notification:', nextNotification?.id);
            }

            if (nextNotification) {
                setCurrentNotification(nextNotification);
                FunNotificationService.markAsShown(nextNotification.id);
            }
        }, 300); // 300ms sonra yeni bildirim göster (animasyon için)
    };

    const showNotification = (notification: FunNotification) => {
        setCurrentNotification(notification);
        FunNotificationService.markAsShown(notification.id);
    };

    const getStreakNotification = (streakDay: number) => {
        return FunNotificationService.getStreakNotification(streakDay);
    };

    const getAchievementNotification = (dataEntryCount: number) => {
        return FunNotificationService.getAchievementNotification(dataEntryCount);
    };

    const getPeriodSupportNotification = () => {
        return FunNotificationService.getPeriodSupportNotification();
    };

    const getRandomMotivationNotification = () => {
        return FunNotificationService.getRandomMotivationNotification();
    };

    return {
        currentNotification,
        dismissNotification,
        showNotification,
        getStreakNotification,
        getAchievementNotification,
        getPeriodSupportNotification,
        getRandomMotivationNotification,
        canShowDaily: FunNotificationService.canShowDailyNotification(),
        hasPermission,
        checkPermission,
    };
}
