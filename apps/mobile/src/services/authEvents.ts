/**
 * Auth Events Service
 *
 * Simple event emitter for auth state changes.
 * Breaks circular dependency between api.ts and authStore.ts.
 */

export interface AuthEventPayload {
  reason?:
    | 'ACCOUNT_SUSPENDED'
    | 'ACCOUNT_DELETED'
    | 'SESSION_EXPIRED'
    | 'REFRESH_TOKEN_REUSED'
    | 'REFRESHED';
  message?: string;
}

type AuthEventListener = (payload?: AuthEventPayload) => void;

class AuthEventsService {
  private listeners: AuthEventListener[] = [];

  /**
   * Subscribe to auth state changes
   */
  subscribe(listener: AuthEventListener): () => void {
    this.listeners.push(listener);

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit auth state change event
   */
  emit(payload?: AuthEventPayload): void {
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error('[AuthEvents] Error in listener:', error);
      }
    });
  }
}

export const authEvents = new AuthEventsService();
