import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ensureAndroidNotificationChannels,
  getOsNotificationPermissionStatus,
  registerPushTokenWithBackend,
  requestOsNotificationPermission,
  syncPendingServerNotifications,
} from '../services/notificationEngine';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface NotificationData {
  screen?: string;
  reminderId?: string;
  [key: string]: any;
}

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [canAskAgain, setCanAskAgain] = useState<boolean>(true);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const router = useRouter();

  const refreshPermissionStatus = useCallback(async () => {
    const info = await getOsNotificationPermissionStatus();
    setPermissionStatus(info.status);
    setCanAskAgain(info.canAskAgain);
    return info.granted;
  }, []);

  // Request OS permissions properly (shows native dialog or opens Settings if permanently blocked)
  const requestPermissions = useCallback(async (showSettingsPrompt = true) => {
    const res = await requestOsNotificationPermission({ showSettingsPrompt });
    setPermissionStatus(res.status);
    setCanAskAgain(res.canAskAgain);
    if (res.granted) {
      const token = await registerPushTokenWithBackend();
      if (token) setExpoPushToken(token);
      await syncPendingServerNotifications().catch(() => {});
    }
    return res.granted;
  }, []);

  // Register for push notifications cleanly (only prompts OS if not denied or explicit)
  const registerForPushNotifications = useCallback(async (forcePrompt = false) => {
    try {
      await ensureAndroidNotificationChannels();
      const status = await getOsNotificationPermissionStatus();
      setPermissionStatus(status.status);
      setCanAskAgain(status.canAskAgain);

      let granted = status.granted;
      if (!granted && (forcePrompt || status.status === 'undetermined')) {
        const res = await requestOsNotificationPermission({
          showSettingsPrompt: forcePrompt,
        });
        granted = res.granted;
        setPermissionStatus(res.status);
        setCanAskAgain(res.canAskAgain);
      }

      if (!granted) return null;

      const token = await registerPushTokenWithBackend();
      if (token) {
        setExpoPushToken(token);
      }
      await syncPendingServerNotifications().catch(() => {});
      return token;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }, []);

  function handleNotificationReceived(_notification: Notifications.Notification) {
    // Foreground display handled by setNotificationHandler
  }

  function handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = (response.notification.request.content.data || {}) as NotificationData;
    if (data.screen) {
      switch (data.screen) {
        case 'reminders':
          router.push('/(tabs)/reminders');
          break;
        case 'calendar':
          router.push('/(tabs)/calendar');
          break;
        case 'chat':
          router.push('/(tabs)/chat');
          break;
        case 'wellness':
        case 'steps':
          router.push('/wellness/steps');
          break;
        case 'home':
        default:
          router.push('/(tabs)/home');
          break;
      }
    }
  }

  async function scheduleLocalNotification(
    title: string,
    body: string,
    data?: NotificationData,
    trigger?: Notifications.NotificationTriggerInput,
  ) {
    try {
      if (!data?.test) {
        const quietEnabled = await AsyncStorage.getItem('@quiet_hours_enabled');
        if (quietEnabled === 'true') {
          const [startRaw, endRaw] = await AsyncStorage.multiGet([
            '@quiet_hours_start',
            '@quiet_hours_end',
          ]);
          const startHour = Number((startRaw?.[1] || '23:00').split(':')[0]);
          const endHour = Number((endRaw?.[1] || '08:00').split(':')[0]);
          const hour = new Date().getHours();
          const inQuiet =
            startHour > endHour
              ? hour >= startHour || hour < endHour
              : hour >= startHour && hour < endHour;
          if (inQuiet) return null;
        }
      }

      await ensureAndroidNotificationChannels();

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
        },
        trigger: trigger || null,
      });
      return id;
    } catch (error) {
      console.error('Error scheduling local notification:', error);
      return null;
    }
  }

  async function cancelNotification(notificationId: string) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // Ignore
    }
  }

  async function getScheduledNotifications() {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch {
      return [];
    }
  }

  useEffect(() => {
    void refreshPermissionStatus();

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void refreshPermissionStatus();
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(
      handleNotificationReceived,
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    return () => {
      appStateSub.remove();
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [refreshPermissionStatus]);

  return {
    expoPushToken,
    permissionStatus,
    canAskAgain,
    refreshPermissionStatus,
    requestPermissions,
    registerForPushNotifications,
    scheduleLocalNotification,
    cancelNotification,
    getScheduledNotifications,
  };
}
