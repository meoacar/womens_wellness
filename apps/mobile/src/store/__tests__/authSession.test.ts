const storeMap = new Map<string, string>();
const asyncStorageMap = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => storeMap.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    storeMap.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    storeMap.delete(key);
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => asyncStorageMap.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    asyncStorageMap.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    asyncStorageMap.delete(key);
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => asyncStorageMap.delete(k));
  }),
}));

const mockQueryClear = jest.fn();
jest.mock('@/lib/queryClient', () => ({
  queryClient: { clear: mockQueryClear },
}));

const mockSubReset = jest.fn();
jest.mock('@/services/subscriptionSync', () => ({
  subscriptionSyncService: { reset: mockSubReset },
}));

jest.mock('@/utils/apiBaseUrl', () => ({
  getApiBaseUrl: () => 'https://api.kadinatlasi.com',
}));

import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useQnaStore } from '@/store/qnaStore';

describe('Mobile session continuity & resilience', () => {
  const cachedUser = {
    id: 'user-1',
    email: 'alice@example.com',
    username: 'alice',
    status: 'ACTIVE',
    pinEnabled: false,
    profile: { displayName: 'Alice' },
  };

  beforeEach(() => {
    storeMap.clear();
    asyncStorageMap.clear();
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      forcedLogoutReason: null,
      forcedLogoutEmail: null,
      forcedLogoutName: null,
    });
  });

  it('refreshes expired access token on startup instead of clearing auth', async () => {
    storeMap.set('accessToken', 'expired-access');
    storeMap.set('refreshToken', 'valid-refresh');
    storeMap.set('user', JSON.stringify(cachedUser));

    const freshUser = { ...cachedUser, profile: { displayName: 'Alice Fresh' } };

    (global.fetch as jest.Mock)
      // First /me with expired access token -> 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        clone: () => ({ json: async () => ({ message: 'Unauthorized' }) }),
        json: async () => ({ message: 'Unauthorized' }),
      })
      // /auth/refresh -> 200 with rotated tokens
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          user: freshUser,
        }),
      })
      // Retry /me with new access token -> 200
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => freshUser,
      });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.accessToken).toBe('new-access');
    expect(state.refreshToken).toBe('new-refresh');
    expect(state.user).toEqual(freshUser);
    expect(storeMap.get('accessToken')).toBe('new-access');
    expect(storeMap.get('refreshToken')).toBe('new-refresh');
  });

  it('preserves cached session on transient network failure during startup', async () => {
    storeMap.set('accessToken', 'some-access');
    storeMap.set('refreshToken', 'valid-refresh');
    storeMap.set('user', JSON.stringify(cachedUser));

    (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.user).toEqual(cachedUser);
    expect(storeMap.get('accessToken')).toBe('some-access');
    expect(storeMap.get('refreshToken')).toBe('valid-refresh');
  });

  it('preserves session when /auth/refresh fails with transient network error after 401', async () => {
    storeMap.set('accessToken', 'expired-access');
    storeMap.set('refreshToken', 'valid-refresh');
    storeMap.set('user', JSON.stringify(cachedUser));

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        clone: () => ({ json: async () => ({ message: 'Unauthorized' }) }),
        json: async () => ({ message: 'Unauthorized' }),
      })
      .mockRejectedValueOnce(new TypeError('Network request failed'));

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(storeMap.get('refreshToken')).toBe('valid-refresh');
  });

  it('clears auth on explicit refresh rejection (e.g. reused/revoked token)', async () => {
    storeMap.set('accessToken', 'expired-access');
    storeMap.set('refreshToken', 'revoked-refresh');
    storeMap.set('user', JSON.stringify(cachedUser));

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        clone: () => ({ json: async () => ({ message: 'Unauthorized' }) }),
        json: async () => ({ message: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          code: 'REFRESH_TOKEN_REUSED',
          message: 'Güvenlik nedeniyle oturumunuz sonlandırıldı.',
        }),
      });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.forcedLogoutReason).toBe('Güvenlik nedeniyle oturumunuz sonlandırıldı.');
    expect(storeMap.has('accessToken')).toBe(false);
    expect(storeMap.has('refreshToken')).toBe(false);
  });

  it('deduplicates concurrent ApiClient 401 refreshes into a single /auth/refresh call', async () => {
    storeMap.set('accessToken', 'expired-access');
    storeMap.set('refreshToken', 'valid-refresh');
    storeMap.set('user', JSON.stringify(cachedUser));

    let refreshCallCount = 0;
    (global.fetch as jest.Mock).mockImplementation(async (url: string, init?: any) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCallCount += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            accessToken: 'fresh-access',
            refreshToken: 'fresh-refresh',
          }),
        };
      }

      if (init?.headers?.Authorization === 'Bearer expired-access') {
        return {
          ok: false,
          status: 401,
          clone: () => ({ json: async () => ({}) }),
          json: async () => ({}),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, endpoint: url }),
      };
    });

    const [r1, r2] = await Promise.all([api.get('/home'), api.get('/cycles')]);
    expect(r1).toEqual({ ok: true, endpoint: 'https://api.kadinatlasi.com/home' });
    expect(r2).toEqual({ ok: true, endpoint: 'https://api.kadinatlasi.com/cycles' });
    expect(refreshCallCount).toBe(1);
  });

  it('clears persisted Q&A drafts, cached questions, and AsyncStorage caches on logout', async () => {
    storeMap.set('accessToken', 'tok');
    storeMap.set('refreshToken', 'ref');
    storeMap.set('user', JSON.stringify(cachedUser));
    storeMap.set('onboarding_draft', '{"firstName":"Alice"}');
    asyncStorageMap.set('qna-store', '{"state":{"draftQuestion":{"title":"Private"}}}');
    asyncStorageMap.set('qna-interactions-store', '{"state":{}}');
    asyncStorageMap.set('pregnancyMode', 'true');

    useQnaStore.getState().setDraftQuestion({
      title: 'Private medical question',
      content: 'Sensitive draft content',
      isAnonymous: true,
    });
    useQnaStore.getState().addRecentlyViewed('q-1');
    useQnaStore.getState().cacheQuestion({ id: 'q-1', title: 'Q1' } as any);

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200 });

    await useAuthStore.getState().logout();

    const qnaState = useQnaStore.getState();
    expect(qnaState.draftQuestion).toBeUndefined();
    expect(qnaState.recentlyViewed).toEqual([]);
    expect(qnaState.cachedQuestions).toEqual({});
    expect(asyncStorageMap.has('qna-store')).toBe(false);
    expect(asyncStorageMap.has('qna-interactions-store')).toBe(false);
    expect(asyncStorageMap.has('pregnancyMode')).toBe(false);
    expect(storeMap.has('onboarding_draft')).toBe(false);
  });
});
