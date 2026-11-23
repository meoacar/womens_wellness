import * as SecureStore from 'expo-secure-store';
import type { AuthResponse, AuthTokens } from '@/types/auth';
import type {
  Subscription,
  Product,
  Transaction,
  Quota,
  UsageStats,
  PurchaseRequest,
  RestoreRequest,
  PremiumPaywallConfig,
} from '@/types/subscription';
import { authEvents, type AuthEventPayload } from './authEvents';
import { getApiBaseUrl } from '@/utils/apiBaseUrl';
import { getClientTelemetryHeaders } from '@/utils/clientTelemetry';

export type RefreshSessionResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | {
      ok: false;
      status: 'unauthorized' | 'network_error';
      code?: AuthEventPayload['reason'];
      message?: string;
    };

class ApiClient {
  private refreshPromise: Promise<RefreshSessionResult> | null = null;

  private get baseURL(): string {
    return getApiBaseUrl();
  }

  private async clearLocalAuth(payload?: AuthEventPayload): Promise<void> {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
    await SecureStore.deleteItemAsync('pinVerified');
    await SecureStore.deleteItemAsync('pinEnabled');
    authEvents.emit(payload);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    includeAuth = true,
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const telemetryHeaders = getClientTelemetryHeaders();
    const headers: HeadersInit = {
      ...telemetryHeaders,
    };

    // Only add Authorization header if needed
    if (includeAuth) {
      const token = await SecureStore.getItemAsync('accessToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // Only add Content-Type if there's a body
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // Immediately terminate session if account is suspended or deleted
    if (includeAuth && (response.status === 403 || response.status === 401)) {
      const cloned = response.clone();
      const bodyErr = await cloned.json().catch(() => ({}));
      if (bodyErr?.code === 'ACCOUNT_SUSPENDED' || bodyErr?.code === 'ACCOUNT_DELETED') {
        const msg =
          bodyErr.message ||
          (bodyErr.code === 'ACCOUNT_SUSPENDED'
            ? 'Hesabınız yönetici tarafından askıya alınmıştır.'
            : 'Hesabınız kapatılmış veya silinmiştir.');
        await this.clearLocalAuth({ reason: bodyErr.code, message: msg });
        throw new Error(msg);
      }
    }

    // Only attempt token refresh for authenticated endpoints
    if (response.status === 401 && includeAuth) {
      // Token expired, try single-flight refresh
      const refreshResult = await this.refreshSession();
      if (refreshResult.ok) {
        // Retry request with new token
        const retryHeaders: HeadersInit = {
          ...getClientTelemetryHeaders(),
        };
        retryHeaders['Authorization'] = `Bearer ${refreshResult.accessToken}`;
        if (options.body) {
          retryHeaders['Content-Type'] = 'application/json';
        }

        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...retryHeaders,
            ...options.headers,
          },
        });
        if (!retryResponse.ok) {
          const error = await retryResponse.json().catch(() => ({}));
          if (
            retryResponse.status === 401 ||
            error?.code === 'ACCOUNT_SUSPENDED' ||
            error?.code === 'ACCOUNT_DELETED'
          ) {
            await this.clearLocalAuth({
              reason: error?.code || 'SESSION_EXPIRED',
              message: error?.message,
            });
          }
          throw new Error(error.message || `HTTP ${retryResponse.status}`);
        }
        return retryResponse.json();
      } else if (refreshResult.status === 'unauthorized') {
        const reason = refreshResult.code || 'SESSION_EXPIRED';
        const message =
          refreshResult.message || 'Oturum süresi doldu. Lütfen tekrar giriş yapın.';
        await this.clearLocalAuth({ reason, message });
        throw new Error(message);
      } else {
        throw new Error(
          refreshResult.message || 'Sunucuya bağlanılamadı. Lütfen bağlantınızı kontrol edin.',
        );
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err: any = new Error(error.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.code = error.code;
      throw err;
    }

    return response.json();
  }

  async get<T>(endpoint: string, includeAuth = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, includeAuth);
  }

  async post<T>(endpoint: string, data?: any, includeAuth = true): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      includeAuth,
    );
  }

  async patch<T>(endpoint: string, data: any, includeAuth = true): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
      includeAuth,
    );
  }

  async delete<T>(endpoint: string, includeAuth = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, includeAuth);
  }

  public async refreshSession(timeoutMs?: number): Promise<RefreshSessionResult> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh(timeoutMs).finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async performRefresh(timeoutMs?: number): Promise<RefreshSessionResult> {
    const controller = timeoutMs ? new AbortController() : null;
    const timeoutId =
      controller && timeoutMs
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
        return { ok: false, status: 'unauthorized', code: 'SESSION_EXPIRED' };
      }

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientTelemetryHeaders(),
        },
        body: JSON.stringify({ refreshToken }),
        signal: controller?.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
          return {
            ok: false,
            status: 'unauthorized',
            code: err?.code || 'SESSION_EXPIRED',
            message: err?.message,
          };
        }

        // 5xx or temporary gateway errors must not log the user out
        return {
          ok: false,
          status: 'network_error',
          message: err?.message || `HTTP ${response.status}`,
        };
      }

      const tokens: AuthTokens = await response.json();
      if (!tokens?.accessToken || !tokens?.refreshToken) {
        return {
          ok: false,
          status: 'network_error',
          message: 'Geçersiz yenileme yanıtı.',
        };
      }

      await SecureStore.setItemAsync('accessToken', tokens.accessToken);
      await SecureStore.setItemAsync('refreshToken', tokens.refreshToken);
      authEvents.emit({ reason: 'REFRESHED' });

      return {
        ok: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch {
      // Transient network error / timeout: never treat as invalid credentials
      return {
        ok: false,
        status: 'network_error',
        message: 'Ağ hatası nedeniyle oturum yenilenemedi.',
      };
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}

export const api = new ApiClient();

// Auth endpoints
export const authService = {
  register: (data: {
    email: string;
    password: string;
    username: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string; // ISO date string
    kvkkConsents?: {
      acceptPrivacy?: boolean;
      privacyAcceptedAt?: string;
      aiMemoryOptIn?: boolean;
      aiMemoryAcceptedAt?: string;
      version?: string;
      source?: string;
    };
  }) => api.post<AuthResponse>('/auth/register', data, false),

  login: (data: { identifier: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data, false),

  googleLogin: (idToken: string) =>
    api.post<AuthResponse>('/auth/google', { idToken }, false),

  forgotPassword: (data: { email: string }) =>
    api.post<{ message: string }>('/auth/forgot-password', data, false),

  resetPassword: (data: { token: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/reset-password', data, false),

  verifyResetToken: (token: string) =>
    api.get<{ isValid: boolean }>(`/auth/verify-reset-token?token=${token}`, false),
};

export const publicSupportService = {
  submitTicket: (data: {
    name: string;
    email: string;
    category?: string;
    subject: string;
    message: string;
  }) =>
    api.post<{ success: boolean; id: string; ticketCode?: string; createdAt: string }>(
      '/support/public/contact',
      data,
      false,
    ),
};

// User endpoints
export const userService = {
  getMe: () => api.get('/me'),
  updateMe: (data: any) => api.patch('/me', data),
  updateUsername: (username: string) => api.patch('/me/username', { username }),
  checkUsernameAvailability: (username: string) => api.get(`/users/check-username?username=${encodeURIComponent(username)}`, false),
  deleteMe: () => api.delete('/me'),
  exportMyData: () => api.get('/me/export'),
  reportClientError: (payload: {
    message: string;
    stack?: string;
    path?: string;
    level?: string;
    metadataJson?: any;
  }) => api.post<{ logged: boolean }>('/me/client-error', payload).catch(() => ({ logged: false })),
  getRetentionOffer: () =>
    api.get<{
      banner: {
        id: string;
        ruleId: string;
        title: string;
        body: string;
        incentive: 'none' | 'trial_offer' | 'nova_bonus' | 'quick_checkin';
        ctaScreen: 'home' | 'calendar' | 'chat' | 'premium';
        createdAt: string;
      } | null;
    }>('/me/retention-offer'),
  ackRetentionOffer: (action: 'dismiss' | 'claim') =>
    api.post<{ success: boolean; action: string; bonusGranted: number }>(
      '/me/retention-offer/ack',
      { action },
    ),

  uploadProfilePicture: async (fileUri: string): Promise<{ profilePictureUrl: string }> => {
    const token = await SecureStore.getItemAsync('accessToken');

    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    // Create form data
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'profile.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri: fileUri,
      name: filename,
      type,
    } as any);

    // Upload with multipart/form-data
    // Note: Don't set Content-Type header - it will be set automatically with boundary
    const response = await fetch(`${getApiBaseUrl()}/me/profile-picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.message || error.error || `Upload failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.json();
  },

  // PIN Management
  getPinStatus: () => api.get<{ pinEnabled: boolean }>('/me/pin-status'),

  setupPin: (pin: string) =>
    api.post<{ success: boolean; message: string }>('/me/pin/setup', { pin }),

  verifyPin: (pin: string) =>
    api.post<{ success: boolean; message: string }>('/me/pin/verify', { pin }),

  disablePin: (pin: string) =>
    api.post<{ success: boolean; message: string }>('/me/pin/disable', { pin }),

  changePin: (oldPin: string, newPin: string) =>
    api.patch<{ success: boolean; message: string }>('/me/pin/change', { oldPin, newPin }),

  // Password Management
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<{ success: boolean; message: string }>('/me/password', { currentPassword, newPassword }),
};

// Metrics endpoints
export const metricsService = {
  getMetrics: () => api.get('/metrics'),

  getHealthReport: (days: number = 30) => api.get<any>(`/metrics/health-report?days=${days}`),

  calculateBMI: (data: { heightCm: number; weightKg: number }) =>
    api.post('/metrics/bmi', data),

  calculateBMR: (data: {
    heightCm: number;
    weightKg: number;
    ageYears: number;
    sex: 'male' | 'female';
    activityLevel?: string;
  }) => api.post('/metrics/bmr', data),

  calculateWater: (data: {
    weightKg: number;
    activity?: string;
    climate?: string;
  }) => {
    console.log('Sending water calculation request:', data);
    return api.post('/metrics/water/calculate', data);
  },
};

// Water endpoints
export const waterService = {
  getLogs: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return api.get(`/water${query ? `?${query}` : ''}`);
  },

  logWater: (data: { amountMl: number; loggedAt?: string }) =>
    api.post('/water', data),

  getTodayTotal: () => api.get('/water/today'),

  getStats: (days?: number) =>
    api.get(`/water/stats${days ? `?days=${days}` : ''}`),
};

// Steps types
export interface StepsLog {
  id: string;
  userId: string;
  steps: number;
  source: 'manual' | 'pedometer';
  loggedAt: string;
}

export interface StepsTodayResponse {
  date: string;
  totalSteps: number;
  logs: StepsLog[];
}

export interface StepsStatsResponse {
  days: number;
  totalSteps: number;
  avgSteps: number;
  dailyTotals: Record<string, number>;
  logCount: number;
}

// Steps endpoints
export const stepsService = {
  getLogs: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return api.get<StepsLog[]>(`/steps${query ? `?${query}` : ''}`);
  },

  logSteps: (data: { steps: number; loggedAt?: string; source?: 'manual' | 'pedometer' }) =>
    api.post<StepsLog>('/steps', data),

  getTodayTotal: () => api.get<StepsTodayResponse>('/steps/today'),

  getStats: (days?: number) =>
    api.get<StepsStatsResponse>(`/steps/stats${days ? `?days=${days}` : ''}`),
};

// Chat endpoints
export const chatService = {
  getConversations: () => api.get('/chat/conversations'),

  getHistory: (conversationId: string) =>
    api.get(`/chat/${conversationId}/history`),

  sendMessage: (conversationId: string, content: string) =>
    api.post(`/chat/${conversationId}/message`, { content }),

  forgetConversation: (conversationId: string) =>
    api.post(`/chat/${conversationId}/forget`, {}),

  // SSE streaming handled separately in component
  streamUrl: (conversationId: string) =>
    `${getApiBaseUrl()}/chat/${conversationId}/stream`,

  // Report AI response (Google Play AI-generated content policy)
  reportMessage: (data: {
    messageId?: string;
    conversationId?: string;
    messageContent: string;
    reason: string;
    description?: string;
  }) => api.post<{ success: boolean; reportId: string; message: string }>('/chat/report', data),
};

// Quota endpoints
export const quotaService = {
  getStatus: () => api.get('/quota'),
};

// Cycles endpoints
export const cyclesService = {
  getCycles: (limit?: number) =>
    api.get(`/cycles${limit ? `?limit=${limit}` : ''}`),

  getCycle: (id: string) => api.get(`/cycles/${id}`),

  createCycle: (data: {
    startDate: string;
    endDate?: string;
    symptoms?: {
      flow: 'light' | 'moderate' | 'heavy';
      cramps: 0 | 1 | 2 | 3 | 4 | 5;
      mood: string[];
      physical: string[];
      notes?: string;
    };
    notes?: string;
  }) => api.post('/cycles', data),

  updateCycle: (
    id: string,
    data: {
      startDate?: string;
      endDate?: string | null;
      symptoms?: any;
      notes?: string;
    },
  ) => api.patch(`/cycles/${id}`, data),

  deleteCycle: (id: string) => api.delete(`/cycles/${id}`),

  deleteAllCycles: () => api.delete('/cycles'),

  getPrediction: () => api.get('/cycles/prediction'),

  getCalendar: (year: number, month: number) =>
    api.get(`/cycles/calendar?year=${year}&month=${month}`),

  getStats: () => api.get('/cycles/stats'),

  getPatternInsights: () =>
    api.get<{
      totalLogsAnalyzed: number;
      cycleHistory: Array<{
        startDate: string;
        cycleLength: number;
        periodLength: number | null;
      }>;
      upcoming3Cycles: Array<{
        cycleNumber: number;
        startDate: string;
        endDate: string;
        ovulationDate: string;
        fertileStart: string;
        fertileEnd: string;
      }>;
      topPrePeriodSymptoms: Array<{ name: string; count: number }>;
      topSymptoms: Array<{ name: string; count: number }>;
      topMoods: Array<{ name: string; count: number }>;
      sleepCrampCorrelation: {
        avgGoodSleepCramps: number | null;
        avgLowSleepCramps: number | null;
        sampleCount: number;
      };
      avgWaterMl: number;
      insights: Array<{
        id: string;
        icon: string;
        title: string;
        description: string;
        tone: 'pink' | 'purple' | 'teal' | 'amber';
      }>;
    }>('/cycles/insights/patterns'),

  // Daily Log endpoints
  upsertDailyLog: (data: {
    date: string;
    flow?: 'light' | 'moderate' | 'heavy';
    cramps?: number;
    symptoms?: string[];
    mood?: string[];
    hadSex?: boolean;
    contraception?: string[];
    sexNotes?: string;
    medications?: string[];
    healthNotes?: string;
    attachments?: string[];
  }) => api.post('/cycles/daily-log', data),

  getDailyLog: (date: string) => api.get(`/cycles/daily-log/${date}`),

  getDailyLogs: (startDate: string, endDate: string) =>
    api.get(`/cycles/daily-logs?startDate=${startDate}&endDate=${endDate}`),

  deleteDailyLog: (date: string) => api.delete(`/cycles/daily-log/${date}`),
};

// Pregnancy endpoints
export const pregnancyService = {
  // Pregnancy Profile
  createOrUpdate: (data: {
    lmpDate?: string;
    dueDate?: string;
    doctorNotes?: string;
    isActive?: boolean;
    anonymousMode?: boolean;
  }) => api.post('/pregnancy', data),

  get: () => api.get<any>('/pregnancy'),

  getSummary: () => api.get<{
    gestationalAge: { weeks: number; days: number };
    trimester: number;
    dueDate: string;
    weeklyTip?: string;
  }>('/pregnancy/summary'),

  delete: () => api.delete('/pregnancy'),

  // Kick Counter
  logKick: (data: {
    sessionDate: string;
    kickCount: number;
    durationMin: number;
    notes?: string;
  }) => api.post('/pregnancy/kicks', data),

  getKicks: (limit?: number) =>
    api.get<any[]>(`/pregnancy/kicks${limit ? `?limit=${limit}` : ''}`),

  deleteKick: (id: string) => api.delete(`/pregnancy/kicks/${id}`),

  // Contractions
  logContraction: (data: {
    startTime: string;
    endTime: string;
    durationSec: number;
    intensity?: number;
    notes?: string;
  }) => api.post('/pregnancy/contractions', data),

  getContractions: (hours?: number) =>
    api.get<any[]>(`/pregnancy/contractions${hours ? `?hours=${hours}` : ''}`),

  getContractionsSummary: () => api.get<any>('/pregnancy/contractions/summary'),

  deleteContraction: (id: string) => api.delete(`/pregnancy/contractions/${id}`),

  deleteAllContractions: () => api.delete('/pregnancy/contractions'),

  // Appointments
  createAppointment: (data: {
    appointmentAt: string;
    clinic?: string;
    doctorName?: string;
    notes?: string;
    vitals?: any;
  }) => api.post('/pregnancy/appointments', data),

  getAppointments: () => api.get<any[]>('/pregnancy/appointments'),

  getAppointment: (id: string) => api.get<any>(`/pregnancy/appointments/${id}`),

  updateAppointment: (id: string, data: any) =>
    api.patch(`/pregnancy/appointments/${id}`, data),

  deleteAppointment: (id: string) => api.delete(`/pregnancy/appointments/${id}`),

  // Medications
  addMedication: (data: {
    name: string;
    dosage?: string;
    frequency?: string;
    safetyRating?: string;
    notes?: string;
    startDate?: string;
    endDate?: string;
  }) => api.post('/pregnancy/medications', data),

  getMedications: () => api.get<any[]>('/pregnancy/medications'),

  updateMedication: (id: string, data: any) =>
    api.patch(`/pregnancy/medications/${id}`, data),

  deleteMedication: (id: string) => api.delete(`/pregnancy/medications/${id}`),

  // Birth Plan
  createOrUpdateBirthPlan: (content: any) =>
    api.post('/pregnancy/birth-plan', { content }),

  getBirthPlan: () => api.get<any>('/pregnancy/birth-plan'),

  deleteBirthPlan: () => api.delete('/pregnancy/birth-plan'),

  // Hospital Bag
  addHospitalBagItem: (data: {
    category: string;
    itemName: string;
    sortOrder?: number;
  }) => api.post('/pregnancy/hospital-bag', data),

  getHospitalBagItems: () => api.get<any[]>('/pregnancy/hospital-bag'),

  updateHospitalBagItem: (id: string, data: any) =>
    api.patch(`/pregnancy/hospital-bag/${id}`, data),

  deleteHospitalBagItem: (id: string) => api.delete(`/pregnancy/hospital-bag/${id}`),

  // Notes
  createNote: (data: { title?: string; content: string; tags?: string[] }) =>
    api.post('/pregnancy/notes', data),

  getNotes: () => api.get<any[]>('/pregnancy/notes'),

  getNote: (id: string) => api.get(`/pregnancy/notes/${id}`),

  updateNote: (id: string, data: any) => api.patch(`/pregnancy/notes/${id}`, data),

  deleteNote: (id: string) => api.delete(`/pregnancy/notes/${id}`),

  // Weekly Content
  getWeeklyContent: () => api.get<{
    week: number;
    content: string;
    developmentSummary?: string;
  }>('/pregnancy/weekly-content'),
};

// Reminders endpoints
export const remindersService = {
  getReminders: () => api.get('/reminders'),

  getReminder: (id: string) => api.get(`/reminders/${id}`),

  createReminder: (data: {
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
    title: string;
    message: string;
    time: string; // HH:mm format
    days?: number[]; // 0-6 for WEEKLY, 1-31 for MONTHLY
    customCron?: string;
    active?: boolean;
  }) => api.post('/reminders', data),

  updateReminder: (
    id: string,
    data: {
      title?: string;
      message?: string;
      time?: string;
      days?: number[];
      customCron?: string;
      active?: boolean;
    },
  ) => api.patch(`/reminders/${id}`, data),

  deleteReminder: (id: string) => api.delete(`/reminders/${id}`),

  toggleReminder: (id: string, active: boolean) =>
    api.patch(`/reminders/${id}/toggle`, { active }),

  registerPushToken: (pushToken: string) =>
    api.post('/reminders/push/register', { pushToken }),

  testPush: () => api.post<{ status: string; id?: string; delivery?: string; message?: string }>('/reminders/push/test', {}),

  getNotificationPreferences: () => api.get<any>('/reminders/preferences'),

  updateNotificationPreferences: (data: any) =>
    api.patch<any>('/reminders/preferences', data),

  getPendingPushNotifications: () =>
    api.get<{
      notifications: Array<{
        id: string;
        title: string;
        body: string;
        data?: Record<string, any>;
        createdAt: string;
      }>;
    }>('/reminders/push/pending'),

  ackPendingPushNotifications: (ids: string[]) =>
    api.post<{ acknowledged: number }>('/reminders/push/ack', { ids }),

  getPeriodSupportMessages: () =>
    api.get<{
      enabled: boolean;
      defaultSendHours: number[];
      maxPerDay: number;
      periodWindowDays: number;
      messages: Array<{
        id: string;
        titleTr: string;
        titleEn: string;
        messageTr: string;
        messageEn: string;
        emoji: string;
        tone: string;
        dayRange: 'all' | 'early_heavy' | 'mid_late';
        active: boolean;
        order: number;
      }>;
      updatedAt: string;
    }>('/period-notifications/active'),
};

export const partnerService = {
  createInvite: () =>
    api.post<{ code: string; expiresAt: string; message: string }>('/partner/invite', {}),
  acceptInvite: (code: string) =>
    api.post<{ connected: boolean; link: any }>('/partner/accept', { code }),
  getStatus: () =>
    api.get<{
      connected: boolean;
      link: {
        partnerUserId: string;
        partnerDisplayName: string;
        role: 'owner' | 'partner';
        connectedAt: string;
      } | null;
      partnerSummary: {
        ownerDisplayName: string;
        cycleDay: number | null;
        phaseTitle: string;
        daysUntilNextPeriod: number | null;
        supportTip: string;
        privacyNote: string;
      } | null;
    }>('/partner/status'),
  unlink: () => api.delete<{ connected: boolean }>('/partner/link'),
};

export const featureFlagsService = {
  getPublicFlags: () => api.get<Record<string, any>>('/feature-flags/public'),
};

// Home endpoints
export const homeService = {
  getSnapshot: (locale: string = 'tr') =>
    api.get<{
      user: {
        displayName: string;
        profilePictureUrl?: string;
        lifeStage?: string;
      };
      streak: {
        current: number;
        longest: number;
        startDate?: string;
      };
      todaySnapshot: {
        cycleDay?: number;
        cyclePhase?: {
          phase: 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL';
          title: string;
          summary: string;
          nutritionTip: string;
          exerciseTip: string;
          novaPrompt: string;
          color: string;
        };
        nextPeriodEstimate?: {
          date: string;
          confidence: 'low' | 'medium' | 'high';
        };
        fertilityWindow?: {
          start: number;
          end: number;
        };
        ovulationEstimate?: string;
        pregnancy?: {
          weeks: number;
          days: number;
          dueDate: string;
        };
        waterProgress: {
          current: number;
          target: number;
          logs: number;
        };
        remindersToday: number;
        dataEntriesCount?: number;
      };
      wellnessTiles?: {
        steps: {
          today: number;
          goal: number;
          percentage: number;
          source: string;
        } | null;
        meditation: {
          todayMin: number;
          goalMin: number;
          percentage: number;
          sessions: number;
        } | null;
        sleep: {
          lastNightMin: number;
          goalHours: number;
          percentage: number;
          quality?: string;
        } | null;
      };
      priorityCards: Array<{
        id: string;
        type: 'hydration' | 'cycle_insight' | 'symptom_log' | 'medication' | 'reminder' | 'nova_prompt';
        priority: number;
        data: any;
        isDismissed: boolean;
        isPinned: boolean;
      }>;
      educationalArticles: Array<{
        id: string;
        title: string;
        excerpt: string;
        category: string;
        tags: string[];
        imageUrl?: string;
        thumbnailUrl?: string;
        readTimeMin: number;
        publishedAt: string;
        isSaved: boolean;
        isViewed: boolean;
      }>;
    }>(`/home/snapshot?locale=${locale}`),

  dismissCard: (cardId: string, days: number = 7) =>
    api.post('/home/cards/dismiss', { cardId, days }),

  pinCard: (cardId: string) =>
    api.post('/home/cards/pin', { cardId }),

  unpinCard: (cardId: string) =>
    api.post('/home/cards/unpin', { cardId }),

  setVisiblePills: (pillIds: string[]) =>
    api.post('/home/pills/set-visible', { pillIds }),
};

// Wellness endpoints
export const wellnessService = {
  // Steps
  getSteps: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return api.get<any[]>(`/wellness/v1/steps${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getTodaySteps: () => api.get<any>('/wellness/v1/steps/today'),

  logSteps: (data: { date: string; count: number; source?: string; isManual?: boolean }) =>
    api.post('/wellness/v1/steps', data),

  deleteSteps: (date: string) => api.delete(`/wellness/v1/steps/${date}`),

  // Meditation
  getMeditation: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return api.get<any[]>(`/wellness/v1/meditation${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getTodayMeditation: () => api.get<any>('/wellness/v1/meditation/today'),

  logMeditation: (data: {
    date: string;
    durationMin: number;
    type?: 'breath' | 'guided' | 'custom';
    source?: string;
    isManual?: boolean;
  }) => api.post('/wellness/v1/meditation', data),

  deleteMeditation: (sessionId: string) => api.delete(`/wellness/v1/meditation/${sessionId}`),

  // Sleep
  getSleep: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return api.get<any[]>(`/wellness/v1/sleep${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getLastNightSleep: () => api.get('/wellness/v1/sleep/last-night'),

  logSleep: (data: {
    sleepDate: string;
    durationMin: number;
    quality?: 'good' | 'medium' | 'poor';
    source?: string;
    isManual?: boolean;
    notes?: string;
  }) => api.post('/wellness/v1/sleep', data),

  deleteSleep: (date: string) => api.delete(`/wellness/v1/sleep/${date}`),

  // Preferences
  getPreferences: () => api.get<{
    id: string;
    userId: string;
    stepsGoal: number;
    meditationGoalMin: number;
    sleepGoalHours: number;
    tilesEnabled: {
      steps: boolean;
      meditation: boolean;
      sleep: boolean;
      water: boolean;
    };
    notificationsJson: any;
  }>('/wellness/v1/preferences'),

  updatePreferences: (data: {
    stepsGoal?: number;
    meditationGoalMin?: number;
    sleepGoalHours?: number;
    tilesEnabled?: any;
    notificationsJson?: any;
  }) => api.post('/wellness/v1/preferences', data),

  // Summary (for Home screen)
  getSummary: () => api.get<{
    steps: {
      today: number;
      goal: number;
      percentage: number;
      source: string;
    } | null;
    meditation: {
      todayMin: number;
      goalMin: number;
      percentage: number;
      sessions: number;
    } | null;
    sleep: {
      lastNightMin: number;
      goalHours: number;
      percentage: number;
      quality?: string;
    } | null;
  }>('/wellness/v1/summary'),
};

// Discover types
export interface ArticleCardDto {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  imageUrl?: string;
  thumbnailUrl?: string;
  readTimeMin: number;
  publishedAt: string;
  isSaved: boolean;
  isViewed: boolean;
}

export interface ArticleDetailDto extends ArticleCardDto {
  content: string;
  author?: string;
  relatedArticles: ArticleCardDto[];
}

export interface PaginatedArticlesDto {
  articles: ArticleCardDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface UserContentPreferencesDto {
  categoryWeights: Record<string, number>;
  favoriteCategories: string[];
  showPregnancyContent: boolean;
  showCycleContent: boolean;
}

export interface UpdatePreferencesDto {
  categoryWeights?: Record<string, number>;
  showPregnancyContent?: boolean;
  showCycleContent?: boolean;
}

// Discover endpoints
export const discoverService = {
  // Get personalized articles for home screen
  getHomeFeed: (locale: string = 'tr', limit: number = 5) =>
    api.get<ArticleCardDto[]>(`/discover/home-feed?locale=${locale}&limit=${limit}`),

  // Get all articles with filters
  getArticles: (params: {
    category?: string;
    search?: string;
    locale?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)])
    ).toString();
    return api.get<PaginatedArticlesDto>(`/discover/articles${query ? `?${query}` : ''}`);
  },

  // Get single article detail
  getArticle: (id: string, locale: string = 'tr') =>
    api.get<ArticleDetailDto>(`/discover/articles/${id}?locale=${locale}`),

  // Get saved articles
  getSavedArticles: (locale: string = 'tr') =>
    api.get<ArticleCardDto[]>(`/discover/saved?locale=${locale}`),

  // Toggle save/unsave article
  toggleSave: (id: string) =>
    api.post<{ saved: boolean }>(`/discover/articles/${id}/save`),

  // Track article view
  trackView: (id: string, readTimeMs?: number) =>
    api.post<{ success: boolean }>(`/discover/articles/${id}/view`,
      readTimeMs !== undefined ? { readTimeMs } : undefined
    ),

  // Track article share
  trackShare: (id: string) =>
    api.post<{ success: boolean }>(`/discover/articles/${id}/share`),

  // Get user preferences
  getPreferences: () =>
    api.get<UserContentPreferencesDto>('/discover/preferences'),

  // Update user preferences
  updatePreferences: (data: UpdatePreferencesDto) =>
    api.patch<UserContentPreferencesDto>('/discover/preferences', data),
};

// Subscription endpoints
export const subscriptionService = {
  // Get subscription status
  getStatus: () =>
    api.get<Subscription>('/subscription/status'),

  // Get available products
  getProducts: (platform: 'ios' | 'android') =>
    api.get<Product[]>(`/subscription/products?platform=${platform}`),

  // Process purchase
  processPurchase: (data: PurchaseRequest) =>
    api.post<Subscription>('/subscription/purchase', data),

  // Restore purchases
  restorePurchases: (data: RestoreRequest) =>
    api.post<Subscription>('/subscription/restore', data),

  // Cancel subscription
  cancelSubscription: () =>
    api.post<{ success: boolean }>('/subscription/cancel'),

  // Get transactions
  getTransactions: () =>
    api.get<Transaction[]>('/subscription/transactions'),

  // Get quota
  getQuota: () =>
    api.get<Quota>('/subscription/quota'),

  // Increment quota
  incrementQuota: () =>
    api.post<Quota>('/subscription/quota/increment'),

  // Get usage stats
  getUsageStats: () =>
    api.get<UsageStats>('/subscription/usage-stats'),

  // Get live paywall config
  getPaywallConfig: () =>
    api.get<PremiumPaywallConfig>('/subscription/paywall-config'),

  // Get live paywall config for unauthenticated onboarding
  getPublicPaywallConfig: () =>
    api.get<PremiumPaywallConfig>('/subscription/public/paywall-config', false),
};

import type {
  Question,
  Answer,
  QuestionComment,
  AnswerComment,
  CreateQuestionDto,
  UpdateQuestionDto,
  CreateAnswerDto,
  UpdateAnswerDto,
  CreateCommentDto,
  VoteDto,
  VoteResult,
  ReportContentDto,
  QuestionFilters,
  PaginatedQuestions,
  UserReputation,
  ReputationDetail,
  Badge,
  UserBadge,
  Leaderboard,
  QnaMetrics,
  ShareMetadata,
  QnaQuota,
} from '@/types/qna';

// QnA endpoints
export const qnaService = {
  // Questions
  getQuestions: (filters: QuestionFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.tags?.length) params.append('tags', filters.tags.join(','));
    if (filters.status) params.append('status', filters.status);
    if (filters.sort) params.append('sort', filters.sort);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    return api.get<PaginatedQuestions>(`/qna/questions${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getQuestion: (id: string) =>
    api.get<Question>(`/qna/questions/${id}`),

  createQuestion: (data: CreateQuestionDto) =>
    api.post<Question>('/qna/questions', data),

  updateQuestion: (id: string, data: UpdateQuestionDto) =>
    api.patch<Question>(`/qna/questions/${id}`, data),

  deleteQuestion: (id: string) =>
    api.delete<{ success: boolean }>(`/qna/questions/${id}`),

  getMyQuestions: (page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    return api.get<PaginatedQuestions>(`/qna/questions/my${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getFavoriteQuestions: (page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    return api.get<PaginatedQuestions>(`/qna/questions/favorites${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getFollowingQuestions: (page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    return api.get<PaginatedQuestions>(`/qna/questions/following${params.toString() ? `?${params.toString()}` : ''}`);
  },

  // Answers
  getAnswers: (questionId: string, sort?: 'best' | 'votes' | 'recent') => {
    const params = new URLSearchParams();
    if (sort) params.append('sort', sort);
    return api.get<Answer[]>(`/qna/questions/${questionId}/answers${params.toString() ? `?${params.toString()}` : ''}`);
  },

  createAnswer: (questionId: string, data: CreateAnswerDto) =>
    api.post<Answer>(`/qna/questions/${questionId}/answers`, data),

  updateAnswer: (id: string, data: UpdateAnswerDto) =>
    api.patch<Answer>(`/qna/answers/${id}`, data),

  deleteAnswer: (id: string) =>
    api.delete<{ success: boolean }>(`/qna/answers/${id}`),

  markBestAnswer: (questionId: string, answerId: string) =>
    api.post<{ success: boolean }>(`/qna/questions/${questionId}/answers/${answerId}/mark-best`, {}),

  getMyAnswers: (page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    return api.get<Answer[]>(`/qna/answers/my${params.toString() ? `?${params.toString()}` : ''}`);
  },

  // Votes
  voteAnswer: (answerId: string, data: VoteDto) =>
    api.post<VoteResult>(`/qna/answers/${answerId}/vote`, data),

  removeVote: (answerId: string) =>
    api.delete<{ success: boolean }>(`/qna/answers/${answerId}/vote`),

  getUserVote: (answerId: string) =>
    api.get<{ voteType: string | null }>(`/qna/answers/${answerId}/vote`),

  // Comments
  createQuestionComment: (questionId: string, data: CreateCommentDto) =>
    api.post<QuestionComment>(`/qna/questions/${questionId}/comments`, data),

  getQuestionComments: (questionId: string) =>
    api.get<QuestionComment[]>(`/qna/questions/${questionId}/comments`),

  createAnswerComment: (answerId: string, data: CreateCommentDto) =>
    api.post<AnswerComment>(`/qna/answers/${answerId}/comments`, data),

  getAnswerComments: (answerId: string) =>
    api.get<AnswerComment[]>(`/qna/answers/${answerId}/comments`),

  deleteComment: (id: string) =>
    api.delete<{ success: boolean }>(`/qna/comments/${id}`),

  // Interactions
  favoriteQuestion: (questionId: string) =>
    api.post<{ success: boolean }>(`/qna/questions/${questionId}/favorite`, {}),

  unfavoriteQuestion: (questionId: string) =>
    api.delete<{ success: boolean }>(`/qna/questions/${questionId}/favorite`),

  followQuestion: (questionId: string) =>
    api.post<{ success: boolean }>(`/qna/questions/${questionId}/follow`, {}),

  unfollowQuestion: (questionId: string) =>
    api.delete<{ success: boolean }>(`/qna/questions/${questionId}/follow`),

  followUser: (userId: string) =>
    api.post<{ success: boolean }>(`/qna/users/${userId}/follow`, {}),

  unfollowUser: (userId: string) =>
    api.delete<{ success: boolean }>(`/qna/users/${userId}/follow`),

  getUserFollowers: (userId: string) =>
    api.get<Array<{ id: string; username: string; displayName: string; profilePictureUrl?: string }>>(`/qna/users/${userId}/followers`),

  getUserFollowing: (userId: string) =>
    api.get<Array<{ id: string; username: string; displayName: string; profilePictureUrl?: string }>>(`/qna/users/${userId}/following`),

  // Reputation
  getMyReputation: () =>
    api.get<ReputationDetail>('/qna/reputation/me'),

  getUserReputation: (userId: string) =>
    api.get<ReputationDetail>(`/qna/reputation/${userId}`),

  getLeaderboard: (page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    return api.get<Leaderboard>(`/qna/reputation/leaderboard${params.toString() ? `?${params.toString()}` : ''}`);
  },

  getAllBadges: () =>
    api.get<Badge[]>('/qna/reputation/badges'),

  getMyBadges: () =>
    api.get<UserBadge[]>('/qna/reputation/my-badges'),

  // Moderation
  reportContent: (data: ReportContentDto) =>
    api.post<{ success: boolean }>('/qna/moderation/report', data),

  // Sharing
  getShareLink: (questionId: string) =>
    api.get<{ shareUrl: string }>(`/qna/questions/${questionId}/share-link`),

  getShareMetadata: (questionId: string) =>
    api.get<ShareMetadata>(`/qna/questions/${questionId}/share-metadata`),

  trackShare: (questionId: string) =>
    api.post<{ success: boolean }>(`/qna/questions/${questionId}/track-share`, {}),

  // Analytics (admin/stats)
  getMetrics: () =>
    api.get<QnaMetrics>('/qna/analytics/overview'),

  // Quota
  getQuota: () =>
    api.get<QnaQuota>('/qna/questions/quota/status'),

  // Notifications unread badge
  getUnreadNotificationCount: () =>
    api.get<{ unreadCount: number }>('/qna/notifications/unread-count'),

  markNotificationsRead: () =>
    api.post<{ unreadCount: number }>('/qna/notifications/mark-read', {}),

  // User blocking (Google Play UGC compliance)
  blockUser: (targetUserId: string, reason?: string) =>
    api.post<{ success: boolean; message: string }>(`/qna/moderation/block/${targetUserId}`, { reason }),

  unblockUser: (targetUserId: string) =>
    api.delete<{ success: boolean; message: string }>(`/qna/moderation/block/${targetUserId}`),

  getBlockedUsers: () =>
    api.get<Array<{
      id: string;
      blockedUserId: string;
      displayName: string;
      profilePictureUrl?: string | null;
      reason?: string | null;
      createdAt: string;
    }>>('/qna/moderation/blocked-users'),

  uploadImage: async (fileUri: string): Promise<{ imageUrl: string }> => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) {
      throw new Error('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
    }
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'community-image.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri: fileUri,
      name: filename,
      type,
    } as any);

    const response = await fetch(`${getApiBaseUrl()}/qna/questions/upload-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.message || 'Resim yüklenemedi');
    }

    return response.json();
  },
};

// Pages endpoints
export const pagesService = {
  // Get all pages
  getPages: (isActive?: boolean) => {
    const params = isActive !== undefined ? `?isActive=${isActive}` : '';
    return api.get<Array<{
      id: string;
      slug: string;
      titleTr: string;
      titleEn?: string;
      contentTr: string;
      contentEn?: string;
      isActive: boolean;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    }>>(`/pages${params}`, false); // Public endpoint, no auth needed
  },

  // Get page by slug
  getPageBySlug: (slug: string) =>
    api.get<{
      id: string;
      slug: string;
      titleTr: string;
      titleEn?: string;
      contentTr: string;
      contentEn?: string;
      isActive: boolean;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    }>(`/pages/slug/${slug}`, false), // Public endpoint, no auth needed

  getBySlug: (slug: string) => pagesService.getPageBySlug(slug),
};

// Admin Panel endpoints
export const adminService = {
  // Dashboard
  getDashboardStats: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<{
      users: {
        total: number;
        active: number;
        new: number;
        growth: number;
      };
      subscriptions: {
        total: number;
        active: number;
        revenue: number;
        growth: number;
      };
      engagement: {
        dailyActive: number;
        weeklyActive: number;
        monthlyActive: number;
        avgSessionTime: number;
      };
      content: {
        questions: number;
        answers: number;
        articles: number;
        conversations: number;
      };
    }>(`/admin/dashboard/stats${query}`);
  },

  // Charts
  getUserGrowthChart: (days: number = 30) =>
    api.get<{
      labels: string[];
      datasets: Array<{
        label: string;
        data: number[];
        backgroundColor?: string;
        borderColor?: string;
      }>;
    }>(`/admin/charts/user-growth?days=${days}`),

  getRevenueChart: (days: number = 30) =>
    api.get<{
      labels: string[];
      datasets: Array<{
        label: string;
        data: number[];
        backgroundColor?: string;
        borderColor?: string;
      }>;
    }>(`/admin/charts/revenue?days=${days}`),

  // Bulk Operations
  bulkUpdateUsers: (userIds: string[], data: { status?: string; isAdmin?: boolean }) =>
    api.post<{
      success: number;
      failed: number;
      errors: string[];
    }>('/admin/bulk/update-users', { userIds, data }),

  bulkDeleteUsers: (userIds: string[]) =>
    api.post<{
      success: number;
      failed: number;
      errors: string[];
    }>('/admin/bulk/delete-users', { userIds }),

  bulkSendNotifications: (userIds: string[], notification: { title: string; body: string }) =>
    api.post<{
      success: number;
      failed: number;
      errors: string[];
    }>('/admin/bulk/send-notifications', { userIds, notification }),

  // Advanced Search
  searchUsers: (filters: {
    search?: string;
    status?: string;
    subscriptionStatus?: string;
    createdAfter?: string;
    createdBefore?: string;
    lastLoginAfter?: string;
    lastLoginBefore?: string;
    hasSubscription?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    return api.get<{
      data: Array<any>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/admin/users/search?${params.toString()}`);
  },

  // User Impersonation
  impersonateUser: (userId: string) =>
    api.post<{
      user: any;
      impersonationToken: string;
    }>(`/admin/impersonate/${userId}`, {}),

  // System Health
  getSystemHealth: () =>
    api.get<{
      status: string;
      database: {
        connected: boolean;
        responseTime: number;
      };
      users: {
        total: number;
        active: number;
      };
      errors: {
        rate: number;
        threshold: number;
      };
      timestamp: string;
    }>('/admin/system/health'),
};

export type LifeStage = 'CYCLE' | 'FERTILITY' | 'PREGNANCY' | 'POSTPARTUM';

export const postpartumService = {
  getOverview: () =>
    api.get<{
      lifeStage: LifeStage;
      baby: {
        id: string;
        name: string;
        birthDate: string;
        gender?: string | null;
        birthWeightGr?: number | null;
        birthHeightCm?: number | null;
        notes?: string | null;
      } | null;
      todaySummary: {
        feedingsCount: number;
        feedingMinutes: number;
        formulaMl: number;
        diapersCount: number;
        sleepMinutes: number;
      };
      feedings: Array<any>;
      diapers: Array<any>;
      sleeps: Array<any>;
      growthLogs: Array<any>;
      vaccines: Array<{
        id: string;
        vaccineCode: string;
        title: string;
        dueMonth: number;
        administeredAt?: string | null;
        notes?: string | null;
      }>;
    }>('/postpartum/overview'),

  getLifeStage: () => api.get<{ lifeStage: LifeStage }>('/postpartum/life-stage'),

  updateLifeStage: (lifeStage: LifeStage) =>
    api.patch<{ lifeStage: LifeStage }>('/postpartum/life-stage', { lifeStage }),

  upsertBaby: (data: {
    name: string;
    birthDate: string;
    gender?: string;
    birthWeightGr?: number;
    birthHeightCm?: number;
    notes?: string;
  }) => api.post<any>('/postpartum/baby', data),

  logFeeding: (data: {
    type: 'BREAST_LEFT' | 'BREAST_RIGHT' | 'PUMP' | 'FORMULA';
    durationSec?: number;
    amountMl?: number;
    startedAt?: string;
    notes?: string;
  }) => api.post<any>('/postpartum/feedings', data),

  deleteFeeding: (id: string) => api.delete<any>(`/postpartum/feedings/${id}`),

  logDiaper: (data: { type: 'WET' | 'DIRTY' | 'BOTH'; loggedAt?: string; notes?: string }) =>
    api.post<any>('/postpartum/diapers', data),

  deleteDiaper: (id: string) => api.delete<any>(`/postpartum/diapers/${id}`),

  logSleep: (data: { durationMin: number; startedAt?: string; endedAt?: string; notes?: string }) =>
    api.post<any>('/postpartum/sleeps', data),

  deleteSleep: (id: string) => api.delete<any>(`/postpartum/sleeps/${id}`),

  logGrowth: (data: {
    weightKg?: number;
    heightCm?: number;
    headCm?: number;
    measuredAt?: string;
    notes?: string;
  }) => api.post<any>('/postpartum/growth', data),

  deleteGrowth: (id: string) => api.delete<any>(`/postpartum/growth/${id}`),

  toggleVaccine: (id: string, data: { administered: boolean; administeredAt?: string; notes?: string }) =>
    api.patch<any>(`/postpartum/vaccines/${id}`, data),
};
