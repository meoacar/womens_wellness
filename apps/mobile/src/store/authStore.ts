import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { AuthTokens, AuthUser } from '@/types/auth';
import { queryClient } from '@/lib/queryClient';
import { subscriptionSyncService } from '@/services/subscriptionSync';
import { authEvents } from '@/services/authEvents';
import { api } from '@/services/api';
import { useQnaStore } from '@/store/qnaStore';
import { useQnaInteractionsStore } from '@/store/qnaInteractionsStore';
import { useQnaNotificationStore } from '@/store/qnaNotificationStore';
import { usePregnancyStore } from '@/store/pregnancyStore';
import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { clearLocalPinHash } from '@/utils/pinHash';
// Monitoring imports (will be enabled after package installation)
// import { setUser as setSentryUser, clearUser as clearSentryUser } from '@/lib/sentry';
// import { identifyUser, resetUser, trackEvent, AnalyticsEvents } from '@/lib/posthog';

const STARTUP_TIMEOUT_MS = 5000;
let unsubscribeAuthEvents: (() => void) | null = null;

async function fetchMeWithTimeout(
  accessToken: string,
  timeoutMs = STARTUP_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${getApiBaseUrl()}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function clearClientUserCaches(): Promise<void> {
  queryClient.clear();
  subscriptionSyncService.reset();
  await useQnaStore.getState().clearAll().catch(() => undefined);
  useQnaInteractionsStore.getState().clearAll();
  useQnaNotificationStore.getState().clearUnreadCount();
  usePregnancyStore.getState().clearPregnancy();
  await AsyncStorage.multiRemove([
    'qna-store',
    'qna-interactions-store',
    'qna-notification-store',
    'pregnancyMode',
    '@period_notifications_config_cache',
    '@period_notifications_schedule_sig',
  ]).catch(() => undefined);
}

async function clearStoredAuth(): Promise<void> {
  await clearClientUserCaches();
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('refreshToken');
  await SecureStore.deleteItemAsync('user');
  await SecureStore.deleteItemAsync('pinVerified');
  await SecureStore.deleteItemAsync('pinEnabled');
  await clearLocalPinHash();
  await SecureStore.deleteItemAsync('onboarding_draft').catch(() => undefined);
}

async function persistUserData(freshUserData: AuthUser): Promise<void> {
  await SecureStore.setItemAsync('user', JSON.stringify(freshUserData));
  if (typeof (freshUserData as any)?.pinEnabled === 'boolean') {
    await SecureStore.setItemAsync(
      'pinEnabled',
      (freshUserData as any).pinEnabled ? 'true' : 'false',
    );
    if (!(freshUserData as any).pinEnabled) {
      await SecureStore.deleteItemAsync('pinVerified');
    }
  }
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pinEnabled: boolean;
  isPinUnlocked: boolean;
  forcedLogoutReason: string | null;
  forcedLogoutEmail: string | null;
  forcedLogoutName: string | null;
  clearForcedLogoutReason: () => void;
  setPinStatus: (pinEnabled: boolean, isPinUnlocked?: boolean) => void;
  setAuth: (user: AuthUser, tokens: AuthTokens) => Promise<void>;
  refreshMe: () => Promise<void>;
  clearAuth: () => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  pinEnabled: false,
  isPinUnlocked: false,
  forcedLogoutReason: null,
  forcedLogoutEmail: null,
  forcedLogoutName: null,

  clearForcedLogoutReason: () =>
    set({ forcedLogoutReason: null, forcedLogoutEmail: null, forcedLogoutName: null }),

  setPinStatus: (pinEnabled, isPinUnlocked) =>
    set((prev) => ({
      pinEnabled,
      isPinUnlocked: isPinUnlocked !== undefined ? isPinUnlocked : prev.isPinUnlocked,
      user: prev.user ? ({ ...prev.user, pinEnabled } as AuthUser) : prev.user,
    })),

  setAuth: async (user, tokens) => {
    const isPinOn = Boolean((user as any)?.pinEnabled);
    await SecureStore.setItemAsync('accessToken', tokens.accessToken);
    await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    await SecureStore.setItemAsync('pinEnabled', isPinOn ? 'true' : 'false');

    set({
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isAuthenticated: true,
      pinEnabled: isPinOn,
      isPinUnlocked: true,
      forcedLogoutReason: null,
    });
  },

  refreshMe: async () => {
    const accessToken = await SecureStore.getItemAsync('accessToken');
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    if (!accessToken && !refreshToken) return;

    try {
      let activeAccessToken = accessToken;
      let activeRefreshToken = refreshToken;
      let response = activeAccessToken ? await fetchMeWithTimeout(activeAccessToken) : null;

      if (response && (response.status === 403 || response.status === 401)) {
        const errBody = await response.clone().json().catch(() => ({}));
        if (
          response.status === 403 ||
          errBody?.code === 'ACCOUNT_SUSPENDED' ||
          errBody?.code === 'ACCOUNT_DELETED'
        ) {
          const prevUser = get().user;
          await get().clearAuth();
          set({
            forcedLogoutReason:
              errBody?.message || 'Hesabınız askıya alındı veya oturumunuz sonlandırıldı.',
            forcedLogoutEmail: prevUser?.email || null,
            forcedLogoutName: prevUser?.profile?.displayName || prevUser?.username || null,
          });
          return;
        }
      }

      if (!response || response.status === 401) {
        const refreshRes = await api.refreshSession(STARTUP_TIMEOUT_MS);
        if (refreshRes.ok) {
          activeAccessToken = refreshRes.accessToken;
          activeRefreshToken = refreshRes.refreshToken;
          response = await fetchMeWithTimeout(activeAccessToken);
        } else if (refreshRes.status === 'unauthorized') {
          const prevUser = get().user;
          await get().clearAuth();
          const forcedReason =
            refreshRes.code === 'ACCOUNT_SUSPENDED' ||
            refreshRes.code === 'ACCOUNT_DELETED' ||
            refreshRes.code === 'REFRESH_TOKEN_REUSED'
              ? refreshRes.message || 'Oturumunuz güvenlik nedeniyle sonlandırıldı.'
              : null;
          set({
            forcedLogoutReason: forcedReason,
            forcedLogoutEmail: forcedReason ? prevUser?.email || null : null,
            forcedLogoutName: forcedReason
              ? prevUser?.profile?.displayName || prevUser?.username || null
              : null,
          });
          return;
        } else {
          // Transient network error during refresh; keep local session intact
          return;
        }
      }

      if (response.ok) {
        const freshUserData = await response.json();
        await persistUserData(freshUserData);
        set((prev) => ({
          user: freshUserData,
          accessToken: activeAccessToken,
          refreshToken: activeRefreshToken,
          pinEnabled:
            typeof (freshUserData as any)?.pinEnabled === 'boolean'
              ? (freshUserData as any).pinEnabled
              : prev.pinEnabled,
        }));
      } else if (response.status === 403 || response.status === 401) {
        const errBody = await response.json().catch(() => ({}));
        const prevUser = get().user;
        await get().clearAuth();
        if (
          response.status === 403 ||
          errBody?.code === 'ACCOUNT_SUSPENDED' ||
          errBody?.code === 'ACCOUNT_DELETED'
        ) {
          set({
            forcedLogoutReason:
              errBody?.message || 'Hesabınız askıya alındı veya oturumunuz sonlandırıldı.',
            forcedLogoutEmail: prevUser?.email || null,
            forcedLogoutName: prevUser?.profile?.displayName || prevUser?.username || null,
          });
        }
      }
    } catch {
      // Ignore transient network errors on foreground refresh
    }
  },

  clearAuth: async () => {
    await clearStoredAuth();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      pinEnabled: false,
      isPinUnlocked: false,
    });
  },

  logout: async () => {
    const refreshToken = await SecureStore.getItemAsync('refreshToken').catch(() => null);
    if (refreshToken) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      })
        .catch(() => undefined)
        .finally(() => clearTimeout(timeoutId));
    }

    await clearStoredAuth();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      pinEnabled: false,
      isPinUnlocked: false,
    });
  },

  initialize: async () => {
    if (unsubscribeAuthEvents) {
      unsubscribeAuthEvents();
      unsubscribeAuthEvents = null;
    }

    unsubscribeAuthEvents = authEvents.subscribe(async (payload) => {
      const latestAccessToken = await SecureStore.getItemAsync('accessToken');
      const latestRefreshToken = await SecureStore.getItemAsync('refreshToken');
      const latestUserStr = await SecureStore.getItemAsync('user');

      if (latestAccessToken && latestRefreshToken && latestUserStr) {
        try {
          const parsedUser = JSON.parse(latestUserStr);
          set({
            user: parsedUser,
            accessToken: latestAccessToken,
            refreshToken: latestRefreshToken,
            isAuthenticated: true,
          });
          return;
        } catch {
          // Fall through to logout state if cached user JSON is corrupt
        }
      }

      await clearClientUserCaches();
      const reasonMessage =
        payload?.reason === 'ACCOUNT_SUSPENDED' ||
        payload?.reason === 'ACCOUNT_DELETED' ||
        payload?.reason === 'REFRESH_TOKEN_REUSED'
          ? payload.message || 'Oturumunuz güvenlik nedeniyle sonlandırılmıştır.'
          : null;
      set((prev) => ({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        forcedLogoutReason: reasonMessage,
        forcedLogoutEmail: prev.user?.email || null,
        forcedLogoutName: prev.user?.profile?.displayName || prev.user?.username || null,
      }));
    });

    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      const userStr = await SecureStore.getItemAsync('user');

      if (!refreshToken || !userStr) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      let cachedUser: AuthUser;
      try {
        cachedUser = JSON.parse(userStr);
      } catch {
        await clearStoredAuth();
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      let activeAccessToken = accessToken;
      let activeRefreshToken = refreshToken;

      try {
        let response = activeAccessToken ? await fetchMeWithTimeout(activeAccessToken) : null;

        if (response && (response.status === 403 || response.status === 401)) {
          const errBody = await response.clone().json().catch(() => ({}));
          if (
            response.status === 403 ||
            errBody?.code === 'ACCOUNT_SUSPENDED' ||
            errBody?.code === 'ACCOUNT_DELETED'
          ) {
            await clearStoredAuth();
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isLoading: false,
              isAuthenticated: false,
              forcedLogoutReason:
                errBody?.message || 'Hesabınız askıya alındı veya oturumunuz sonlandırıldı.',
              forcedLogoutEmail: cachedUser?.email || null,
              forcedLogoutName:
                cachedUser?.profile?.displayName || cachedUser?.username || null,
            });
            return;
          }
        }

        // Expired or missing access token: try refreshing with refreshToken before logging out
        if (!response || response.status === 401) {
          const refreshRes = await api.refreshSession(STARTUP_TIMEOUT_MS);

          if (refreshRes.ok) {
            activeAccessToken = refreshRes.accessToken;
            activeRefreshToken = refreshRes.refreshToken;
            try {
              response = await fetchMeWithTimeout(activeAccessToken);
            } catch {
              // Refresh succeeded, /me timed out -> keep user signed in with cached profile
              const storedPin = await SecureStore.getItemAsync('pinEnabled').catch(() => null);
              const isPinOn = Boolean((cachedUser as any)?.pinEnabled) || storedPin === 'true';
              set({
                user: cachedUser,
                accessToken: activeAccessToken,
                refreshToken: activeRefreshToken,
                isAuthenticated: true,
                pinEnabled: isPinOn,
                isLoading: false,
              });
              return;
            }
          } else if (refreshRes.status === 'unauthorized') {
            await clearStoredAuth();
            const forcedReason =
              refreshRes.code === 'ACCOUNT_SUSPENDED' ||
              refreshRes.code === 'ACCOUNT_DELETED' ||
              refreshRes.code === 'REFRESH_TOKEN_REUSED'
                ? refreshRes.message || 'Oturumunuz güvenlik nedeniyle sonlandırıldı.'
                : null;
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isLoading: false,
              isAuthenticated: false,
              forcedLogoutReason: forcedReason,
              forcedLogoutEmail: forcedReason ? cachedUser?.email || null : null,
              forcedLogoutName: forcedReason
                ? cachedUser?.profile?.displayName || cachedUser?.username || null
                : null,
            });
            return;
          } else {
            // Transient network or 5xx error during refresh: preserve stored session
            const storedPin = await SecureStore.getItemAsync('pinEnabled').catch(() => null);
            const isPinOn = Boolean((cachedUser as any)?.pinEnabled) || storedPin === 'true';
            set({
              user: cachedUser,
              accessToken: activeAccessToken,
              refreshToken: activeRefreshToken,
              isAuthenticated: true,
              pinEnabled: isPinOn,
              isLoading: false,
            });
            return;
          }
        }

        if (response.ok) {
          const freshUserData = await response.json();
          await persistUserData(freshUserData);
          const storedPin = await SecureStore.getItemAsync('pinEnabled').catch(() => null);
          const isPinOn =
            typeof (freshUserData as any)?.pinEnabled === 'boolean'
              ? (freshUserData as any).pinEnabled
              : storedPin === 'true';
          set({
            user: freshUserData,
            accessToken: activeAccessToken,
            refreshToken: activeRefreshToken,
            isAuthenticated: true,
            pinEnabled: isPinOn,
            isLoading: false,
          });
        } else if (response.status === 401 || response.status === 403) {
          const errBody = await response.json().catch(() => ({}));
          await clearStoredAuth();
          const suspendedMsg =
            response.status === 403 ||
            errBody?.code === 'ACCOUNT_SUSPENDED' ||
            errBody?.code === 'ACCOUNT_DELETED'
              ? errBody?.message || 'Hesabınız askıya alındı veya oturumunuz sonlandırıldı.'
              : null;
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: false,
            isAuthenticated: false,
            forcedLogoutReason: suspendedMsg,
            forcedLogoutEmail: suspendedMsg ? cachedUser?.email || null : null,
            forcedLogoutName: suspendedMsg
              ? cachedUser?.profile?.displayName || cachedUser?.username || null
              : null,
          });
        } else {
          // Temporary 5xx response from /me: keep cached authenticated session
          const storedPin = await SecureStore.getItemAsync('pinEnabled').catch(() => null);
          const isPinOn = Boolean((cachedUser as any)?.pinEnabled) || storedPin === 'true';
          set({
            user: cachedUser,
            accessToken: activeAccessToken,
            refreshToken: activeRefreshToken,
            isAuthenticated: true,
            pinEnabled: isPinOn,
            isLoading: false,
          });
        }
      } catch (error) {
        // Transient network error or timeout: preserve cached session instead of logging out
        console.warn('Transient error validating session on startup, preserving cached auth:', error);
        const storedPin = await SecureStore.getItemAsync('pinEnabled').catch(() => null);
        const isPinOn = Boolean((cachedUser as any)?.pinEnabled) || storedPin === 'true';
        set({
          user: cachedUser,
          accessToken: activeAccessToken,
          refreshToken: activeRefreshToken,
          isAuthenticated: true,
          pinEnabled: isPinOn,
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      set({ isLoading: false });
    }
  },
}));
