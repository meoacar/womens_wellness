import {
    ALL_FUN_NOTIFICATIONS,
    STREAK_NOTIFICATIONS,
    MOTIVATION_NOTIFICATIONS,
    ACHIEVEMENT_NOTIFICATIONS,
    RANDOM_FUN_NOTIFICATIONS,
    PERIOD_SUPPORT_NOTIFICATIONS
} from '@/constants/funNotifications';
import { FunNotification, FunNotificationType } from '@/types/funNotifications';
import { useFunNotificationStore } from '@/store/funNotificationStore';

export class FunNotificationService {
    private static dynamicPeriodNotifications: FunNotification[] | null = null;

    static setDynamicPeriodNotifications(notifications: FunNotification[]): void {
        this.dynamicPeriodNotifications =
            Array.isArray(notifications) && notifications.length > 0
                ? notifications
                : null;
    }

    static getPeriodSupportPool(): FunNotification[] {
        return this.dynamicPeriodNotifications && this.dynamicPeriodNotifications.length > 0
            ? this.dynamicPeriodNotifications
            : PERIOD_SUPPORT_NOTIFICATIONS;
    }

    /**
     * Streak milestone'a göre bildirim al
     */
    static getStreakNotification(streakDay: number): FunNotification | null {
        const notification = STREAK_NOTIFICATIONS.find(
            n => n.triggerCondition?.streakDay === streakDay
        );
        return notification || null;
    }

    /**
     * Veri girişi sayısına göre başarı bildirimi al
     */
    static getAchievementNotification(dataEntryCount: number): FunNotification | null {
        const notification = ACHIEVEMENT_NOTIFICATIONS.find(
            n => n.triggerCondition?.dataEntryCount === dataEntryCount
        );
        return notification || null;
    }

    /**
     * Regl dönemi için rastgele destek mesajı al
     */
    static getPeriodSupportNotification(excludeId?: string): FunNotification | null {
        const { preferences, canShowNotification } = useFunNotificationStore.getState();

        if (!preferences.enabled || !preferences.periodSupportNotifications) {
            return null;
        }

        const pool = this.getPeriodSupportPool();

        // Kapatılan bildirimi hariç tut ve cooldown kontrolü yap
        const availableNotifications = pool.filter(
            n => n.id !== excludeId && canShowNotification(n.id, 1) // 1 saat cooldown (daha kısa)
        );

        if (__DEV__) {
            console.log('[FunNotificationService] Period support - available:', availableNotifications.length);
            console.log('[FunNotificationService] Excluded ID:', excludeId);
        }

        // Eğer cooldown'da hiç bildirim yoksa, excludeId hariç rastgele birini göster
        if (availableNotifications.length === 0) {
            const fallbackNotifications = pool.filter(n => n.id !== excludeId);
            if (fallbackNotifications.length > 0) {
                const randomIndex = Math.floor(Math.random() * fallbackNotifications.length);
                if (__DEV__) {
                    console.log('[FunNotificationService] Using fallback period notification');
                }
                return fallbackNotifications[randomIndex];
            }
            return null;
        }

        const randomIndex = Math.floor(Math.random() * availableNotifications.length);
        return availableNotifications[randomIndex];
    }

    /**
     * Rastgele motivasyon mesajı al
     */
    static getRandomMotivationNotification(): FunNotification | null {
        const { preferences, canShowNotification } = useFunNotificationStore.getState();

        if (!preferences.enabled || !preferences.motivationNotifications) {
            return null;
        }

        const availableNotifications = MOTIVATION_NOTIFICATIONS.filter(
            n => canShowNotification(n.id, 24) // 24 saat cooldown
        );

        const pool =
            availableNotifications.length > 0
                ? availableNotifications
                : MOTIVATION_NOTIFICATIONS;

        if (pool.length === 0) return null;

        const randomIndex = Math.floor(Math.random() * pool.length);
        return pool[randomIndex];
    }

    /**
     * Rastgele eğlenceli mesaj al
     */
    static getRandomFunNotification(): FunNotification | null {
        const { preferences, canShowNotification } = useFunNotificationStore.getState();

        if (!preferences.enabled || !preferences.randomNotifications) {
            return null;
        }

        const availableNotifications = RANDOM_FUN_NOTIFICATIONS.filter(
            n => canShowNotification(n.id, 48) // 48 saat cooldown
        );

        const pool =
            availableNotifications.length > 0
                ? availableNotifications
                : RANDOM_FUN_NOTIFICATIONS;

        if (pool.length === 0) return null;

        const randomIndex = Math.floor(Math.random() * pool.length);
        return pool[randomIndex];
    }

    /**
     * Kullanıcının durumuna göre en uygun bildirimi seç
     */
    static selectBestNotification(context: {
        streakDay?: number;
        dataEntryCount?: number;
        isPeriodWeek?: boolean;
        lastDataEntryHours?: number;
        excludeId?: string;  // Bu bildirimi hariç tut
    }): FunNotification | null {
        const { preferences } = useFunNotificationStore.getState();

        if (__DEV__) {
            console.log('[FunNotificationService] Context:', context);
            console.log('[FunNotificationService] Preferences:', preferences);
        }

        if (!preferences.enabled) {
            if (__DEV__) console.log('[FunNotificationService] Preferences disabled');
            return null;
        }

        // 1. Öncelik: Streak milestone
        if (context.streakDay && preferences.streakNotifications) {
            const streakNotif = this.getStreakNotification(context.streakDay);
            if (streakNotif && streakNotif.id !== context.excludeId) {
                if (__DEV__) console.log('[FunNotificationService] Found streak notification:', streakNotif.id);
                return streakNotif;
            }
        }

        // 2. Öncelik: Achievement milestone
        if (context.dataEntryCount && preferences.achievementNotifications) {
            const achievementNotif = this.getAchievementNotification(context.dataEntryCount);
            if (achievementNotif && achievementNotif.id !== context.excludeId) {
                if (__DEV__) console.log('[FunNotificationService] Found achievement notification:', achievementNotif.id);
                return achievementNotif;
            }
        }

        // 3. Öncelik: Regl dönemi desteği
        if (context.isPeriodWeek && preferences.periodSupportNotifications) {
            const periodNotif = this.getPeriodSupportNotification(context.excludeId);
            if (periodNotif) {
                if (__DEV__) console.log('[FunNotificationService] Found period notification:', periodNotif.id);
                return periodNotif;
            }
        }

        // 4. Öncelik: Motivasyon (eğer uzun süredir veri girişi yapılmadıysa)
        if (context.lastDataEntryHours && context.lastDataEntryHours > 24 && preferences.motivationNotifications) {
            const motivationNotif = this.getRandomMotivationNotification();
            if (motivationNotif && motivationNotif.id !== context.excludeId) {
                if (__DEV__) console.log('[FunNotificationService] Found motivation notification:', motivationNotif.id);
                return motivationNotif;
            }
        }

        // 5. Öncelik: Rastgele eğlenceli mesaj
        if (preferences.randomNotifications) {
            const randomNotif = this.getRandomFunNotification();
            if (randomNotif && randomNotif.id !== context.excludeId) {
                if (__DEV__) console.log('[FunNotificationService] Found random notification:', randomNotif?.id);
                return randomNotif;
            }
        }

        if (__DEV__) console.log('[FunNotificationService] No notification found');
        return null;
    }

    /**
     * Bildirimi gösterildi olarak işaretle
     */
    static markAsShown(notificationId: string): void {
        const { markNotificationShown } = useFunNotificationStore.getState();
        markNotificationShown(notificationId);
    }

    /**
     * Günlük bildirim limitini kontrol et
     */
    static canShowDailyNotification(): boolean {
        const { preferences, lastShownNotifications } = useFunNotificationStore.getState();

        if (!preferences.enabled) return false;

        // Bugün gösterilen bildirimleri say
        const today = new Date().toDateString();
        const todayNotifications = Object.values(lastShownNotifications).filter(timestamp => {
            const notifDate = new Date(timestamp).toDateString();
            return notifDate === today;
        });

        // Frequency'e göre limit belirle
        const limits = {
            low: 3,      // 1 → 3 (daha fazla test için)
            medium: 10,  // 3 → 10
            high: 20     // 5 → 20
        };

        const limit = limits[preferences.frequency];

        if (__DEV__) {
            console.log('[FunNotificationService] Today notifications:', todayNotifications.length);
            console.log('[FunNotificationService] Limit:', limit);
            console.log('[FunNotificationService] Frequency:', preferences.frequency);
        }

        return todayNotifications.length < limit;
    }

    /**
     * Tüm bildirimleri kategoriye göre getir
     */
    static getNotificationsByType(type: FunNotificationType): FunNotification[] {
        if (type === 'PERIOD_SUPPORT') {
            return this.getPeriodSupportPool();
        }
        return ALL_FUN_NOTIFICATIONS.filter(n => n.type === type);
    }
}
