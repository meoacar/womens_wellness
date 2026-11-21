import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, AppState, AppStateStatus, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from '../src/hooks/useNotifications';
import { useQnaNotificationHandler } from '../src/hooks/useQnaNotificationHandler';
import { useDeepLinking } from '../src/hooks/useDeepLinking';
import { useAuthStore } from '../src/store/authStore';
import { useFunNotificationStore } from '../src/store/funNotificationStore';
import { queryClient } from '../src/lib/queryClient';
import { iapManager } from '../src/services/iap.wrapper';
import { subscriptionSyncService } from '../src/services/subscriptionSync';
import { pedometerSyncService } from '../src/services/pedometerSync';
import { widgetSyncService } from '../src/services/widgetSync';
import {
  getOsNotificationPermissionStatus,
  syncPendingServerNotifications,
} from '../src/services/notificationEngine';
import { AnimatedSplash } from '../src/components/AnimatedSplash';
import { AccountStatusModal } from '../src/components/AccountStatusModal';
import { PinLockView } from '../src/components/PinLockView';
import { NotificationConsentModal } from '../src/components/notifications/NotificationConsentModal';

import { initSentry } from '../src/lib/sentry';
import { userService } from '../src/services/api';

initSentry();

// Forward unhandled mobile runtime errors to backend diagnostics safely
const globalErrorUtils = (globalThis as any)?.ErrorUtils;
if (globalErrorUtils?.getGlobalHandler && globalErrorUtils?.setGlobalHandler) {
  const previousHandler = globalErrorUtils.getGlobalHandler();
  globalErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    try {
      if (useAuthStore.getState().isAuthenticated && error) {
        userService
          .reportClientError({
            message: String(error?.message || error || 'Unhandled Mobile Error'),
            stack: typeof error?.stack === 'string' ? error.stack : undefined,
            level: isFatal ? 'FATAL' : 'ERROR',
            path: 'react-native-runtime',
          })
          .catch(() => {});
      }
    } catch {
      // Never block native error handler
    }
    if (typeof previousHandler === 'function') {
      previousHandler(error, isFatal);
    }
  });
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppContent() {
  // CRITICAL: ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // This prevents "Rendered fewer hooks than expected" error

  // 1. Call all hooks first (unconditionally)
  const { registerForPushNotifications, requestPermissions } = useNotifications();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initialize = useAuthStore((state) => state.initialize);
  const refreshMe = useAuthStore((state) => state.refreshMe);
  const forcedLogoutReason = useAuthStore((state) => state.forcedLogoutReason);
  const forcedLogoutEmail = useAuthStore((state) => state.forcedLogoutEmail);
  const forcedLogoutName = useAuthStore((state) => state.forcedLogoutName);
  const clearForcedLogoutReason = useAuthStore((state) => state.clearForcedLogoutReason);
  const isLoading = useAuthStore((state) => state.isLoading);
  const pinEnabled = useAuthStore((state) => state.pinEnabled);
  const isPinUnlocked = useAuthStore((state) => state.isPinUnlocked);
  const setPinStatus = useAuthStore((state) => state.setPinStatus);
  const router = useRouter();
  const [pinCheckComplete, setPinCheckComplete] = useState(false);
  const backgroundAtRef = useRef<number | null>(null);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [appIsReady, setAppIsReady] = useState(false);
  const [showNotificationConsent, setShowNotificationConsent] = useState(false);
  const [suspendedNotice, setSuspendedNotice] = useState<{
    visible: boolean;
    message: string | null;
    email: string | null;
    name: string | null;
  }>({ visible: false, message: null, email: null, name: null });

  // Initialize QnA notification handler
  useQnaNotificationHandler();

  // Initialize deep linking
  useDeepLinking();

  // 2. All useEffect hooks (unconditionally)

  // Initialize app
  useEffect(() => {
    const prepareApp = async () => {
      try {
        // Hide native splash promptly so AnimatedSplash / app UI never hangs on slow networks
        await SplashScreen.hideAsync().catch(() => {});
        await initialize();
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setAppIsReady(true);
      }
    };

    prepareApp();
  }, [initialize]);

  // Initialize IAP on app start
  useEffect(() => {
    const initIAP = async () => {
      try {
        console.log('[App] Initializing IAP...');
        await iapManager.initialize();
        console.log('[App] IAP initialized successfully');
      } catch (error) {
        console.error('[App] Failed to initialize IAP:', error);
        // IAP initialization failure is not critical
        // App can still function without IAP
      }
    };

    initIAP();

    // Cleanup on unmount
    return () => {
      iapManager.cleanup().catch((error: any) => {
        console.error('[App] IAP cleanup failed:', error);
      });
    };
  }, []);

  // Sync push token & pending notifications only when OS permission is already granted
  useEffect(() => {
    if (!isAuthenticated) return;

    getOsNotificationPermissionStatus()
      .then((info) => {
        if (info.granted) {
          void registerForPushNotifications(false);
          void syncPendingServerNotifications();
        }
      })
      .catch(() => {});

    const pollInterval = setInterval(() => {
      void syncPendingServerNotifications();
    }, 30_000);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncPendingServerNotifications();
      }
    });

    return () => {
      clearInterval(pollInterval);
      appStateSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Sync subscription status & automatic pedometer on app start
  // Requirement 14.1: THE System SHALL abonelik durumunu sunucuda saklar
  // Requirement 14.2: WHEN kullanıcı farklı cihazda oturum açtığında, 
  //                   THE System SHALL abonelik durumunu senkronize eder
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      console.log('[App] Syncing subscription status on app start...');
      subscriptionSyncService.syncSubscriptionStatus().catch((error) => {
        console.error('[App] Failed to sync subscription on start:', error);
      });
      pedometerSyncService.start(true).catch((error) => {
        console.error('[App] Failed to start auto pedometer:', error);
      });
    } else if (!isAuthenticated && !isLoading) {
      pedometerSyncService.stop();
      widgetSyncService.clear();
    }
  }, [isAuthenticated, isLoading]);

  // Handle forced logout (e.g. admin suspended/deleted account mid-session)
  useEffect(() => {
    if (!forcedLogoutReason) return;
    setSuspendedNotice({
      visible: true,
      message: forcedLogoutReason,
      email: forcedLogoutEmail,
      name: forcedLogoutName,
    });
    clearForcedLogoutReason();
    router.replace('/(auth)/signin');
  }, [
    forcedLogoutReason,
    forcedLogoutEmail,
    forcedLogoutName,
    clearForcedLogoutReason,
    router,
  ]);

  // Handle app state changes (foreground/background)
  // Sync subscription & user status when app comes to foreground and re-lock PIN after backgrounding
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background') {
        backgroundAtRef.current = Date.now();
        if (pinEnabled) {
          setPinStatus(true, false);
        }
      } else if (nextAppState === 'active') {
        backgroundAtRef.current = null;
        refreshMe().catch(() => {});
        if (subscriptionSyncService.shouldSync()) {
          console.log('[App] App foregrounded, syncing subscription...');
          subscriptionSyncService.syncSubscriptionStatus().catch((error) => {
            console.error('[App] Failed to sync subscription on foreground:', error);
          });
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, pinEnabled, refreshMe, setPinStatus]);

  // Clear legacy persisted pinVerified on cold start and verify stored pinEnabled flag
  useEffect(() => {
    const checkPinLock = async () => {
      try {
        await SecureStore.deleteItemAsync('pinVerified').catch(() => {});
        if (isAuthenticated && !isLoading) {
          const storedPinEnabled = await SecureStore.getItemAsync('pinEnabled');
          if (storedPinEnabled === 'true' && !pinEnabled) {
            setPinStatus(true);
          }
        }
      } catch (error) {
        console.error('PIN check error:', error);
      } finally {
        if (!isLoading) {
          setPinCheckComplete(true);
        }
      }
    };

    checkPinLock();
  }, [isAuthenticated, isLoading, pinEnabled, setPinStatus]);

  // 3. NOW we can do conditional rendering (after all hooks are called)
  const showLoading = !appIsReady || isLoading || !pinCheckComplete;
  const shouldShowPinGate = !showLoading && isAuthenticated && pinEnabled && !isPinUnlocked;

  // Ask user explicitly before triggering OS notification permission prompt
  useEffect(() => {
    if (showLoading || !isAuthenticated || shouldShowPinGate || showAnimatedSplash) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const info = await getOsNotificationPermissionStatus();
        if (cancelled) return;
        if (info.granted) {
          return;
        }
        const prompted = await AsyncStorage.getItem('@notification_consent_prompted');
        if (!cancelled && prompted !== 'true') {
          setShowNotificationConsent(true);
        }
      } catch {
        // Ignore storage/permission check errors
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showLoading, isAuthenticated, shouldShowPinGate, showAnimatedSplash]);

  // Safely consume Android Widget target route only once navigation Stack & PIN gate are ready
  useEffect(() => {
    if (showLoading || !isAuthenticated || shouldShowPinGate) return;

    const navigateFromWidget = async () => {
      const targetRoute = await widgetSyncService.consumePendingRoute();
      if (targetRoute && targetRoute !== '/(tabs)/home') {
        setTimeout(() => {
          try {
            router.push(targetRoute as any);
          } catch {
            // Ignore navigation errors
          }
        }, 180);
      }
    };

    navigateFromWidget();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        navigateFromWidget();
      }
    });
    return () => sub.remove();
  }, [showLoading, isAuthenticated, shouldShowPinGate, router]);

  return (
    <View style={{ flex: 1 }}>
      {showLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FF69B4" />
        </View>
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      )}
      {shouldShowPinGate && (
        <View style={[StyleSheet.absoluteFillObject, { zIndex: 999 }]}>
          <PinLockView onUnlocked={() => setPinStatus(true, true)} />
        </View>
      )}
      {showAnimatedSplash && (
        <AnimatedSplash
          onAnimationEnd={() => {
            console.log('[Layout] AnimatedSplash ended');
            setShowAnimatedSplash(false);
          }}
        />
      )}
      <AccountStatusModal
        visible={suspendedNotice.visible}
        initialView="suspended"
        reasonMessage={suspendedNotice.message}
        prefillEmail={suspendedNotice.email}
        prefillName={suspendedNotice.name}
        onClose={() =>
          setSuspendedNotice((prev) => ({ ...prev, visible: false }))
        }
      />
      <NotificationConsentModal
        visible={showNotificationConsent}
        onAllow={async () => {
          await AsyncStorage.setItem('@notification_consent_prompted', 'true').catch(() => {});
          setShowNotificationConsent(false);
          const granted = await requestPermissions(true);
          useFunNotificationStore.getState().setEnabled(granted);
        }}
        onDecline={async () => {
          await AsyncStorage.setItem('@notification_consent_prompted', 'true').catch(() => {});
          useFunNotificationStore.getState().setEnabled(false);
          setShowNotificationConsent(false);
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
