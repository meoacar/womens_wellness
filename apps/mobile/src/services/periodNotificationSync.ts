import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { PERIOD_SUPPORT_NOTIFICATIONS } from '@/constants/funNotifications';
import { FunNotification } from '@/types/funNotifications';
import { remindersService } from '@/services/api';
import { FunNotificationService } from '@/services/funNotificationService';
import { useFunNotificationStore } from '@/store/funNotificationStore';

export interface RemotePeriodMessage {
  id: string;
  titleTr: string;
  titleEn: string;
  messageTr: string;
  messageEn: string;
  emoji: string;
  tone: string;
  dayRange?: 'all' | 'early_heavy' | 'mid_late';
  active: boolean;
  order: number;
}

export interface RemotePeriodConfig {
  enabled: boolean;
  defaultSendHours: number[];
  maxPerDay: number;
  periodWindowDays: number;
  messages: RemotePeriodMessage[];
  updatedAt: string;
}

const CACHE_KEY = '@period_notifications_config_cache';
const SCHEDULE_SIG_KEY = '@period_notifications_schedule_sig';

let lastFetchedAt = 0;
let cachedConfig: RemotePeriodConfig | null = null;

function mapRemoteToFunNotifications(
  messages: RemotePeriodMessage[],
): FunNotification[] {
  return messages
    .filter((m) => m.active !== false)
    .map((m) => ({
      id: m.id,
      type: 'PERIOD_SUPPORT',
      titleTr: m.titleTr,
      titleEn: m.titleEn || m.titleTr,
      messageTr: m.messageTr,
      messageEn: m.messageEn || m.messageTr,
      emoji: m.emoji || '💕',
      triggerCondition: { isPeriodWeek: true },
    }));
}

function selectMessagesForDay(
  messages: RemotePeriodMessage[],
  cycleDay: number,
  count: number,
  seedOffset: number,
): RemotePeriodMessage[] {
  const active = messages.filter((m) => m.active !== false);
  if (active.length === 0) return [];

  const filtered = active.filter((m) => {
    if (m.dayRange === 'early_heavy') return cycleDay <= 3;
    if (m.dayRange === 'mid_late') return cycleDay >= 4;
    return true;
  });

  const pool = filtered.length > 0 ? filtered : active;
  const picked: RemotePeriodMessage[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (seedOffset + i) % pool.length;
    picked.push(pool[idx]);
  }
  return picked;
}

export async function loadCachedOrRemotePeriodConfig(
  forceRefresh = false,
): Promise<RemotePeriodConfig | null> {
  const now = Date.now();
  if (!forceRefresh && cachedConfig && now - lastFetchedAt < 5 * 60 * 1000) {
    return cachedConfig;
  }

  try {
    const res = await remindersService.getPeriodSupportMessages();
    if (res && Array.isArray(res.messages)) {
      cachedConfig = res;
      lastFetchedAt = now;
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(res));
      FunNotificationService.setDynamicPeriodNotifications(
        mapRemoteToFunNotifications(res.messages),
      );
      return res;
    }
  } catch {
    // Fallback to persisted AsyncStorage cache below
  }

  if (!cachedConfig) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as RemotePeriodConfig;
        if (parsed && Array.isArray(parsed.messages)) {
          cachedConfig = parsed;
          FunNotificationService.setDynamicPeriodNotifications(
            mapRemoteToFunNotifications(parsed.messages),
          );
          return parsed;
        }
      }
    } catch {
      // Ignore cache read error
    }
  }

  return cachedConfig;
}

async function cancelExistingPeriodSchedules() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => (n.content?.data as any)?.source === 'period_support_sync')
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Ignore errors in environments without notification permissions
  }
}

export async function syncPeriodNotifications(options: {
  cycleDay?: number | null;
  isPeriodWeek?: boolean;
  scheduleLocal?: boolean;
}): Promise<void> {
  const config = await loadCachedOrRemotePeriodConfig();
  if (!options.scheduleLocal) {
    return;
  }

  const { preferences } = useFunNotificationStore.getState();
  const effectiveCycleDay =
    typeof options.cycleDay === 'number' && options.cycleDay > 0
      ? options.cycleDay
      : options.isPeriodWeek
      ? 1
      : 0;

  const windowDays = config?.periodWindowDays || 6;
  const inPeriodWindow =
    effectiveCycleDay >= 1 && effectiveCycleDay <= windowDays;

  const enabled =
    (config ? config.enabled : true) &&
    preferences.enabled &&
    preferences.periodSupportNotifications &&
    inPeriodWindow;

  if (!enabled) {
    const prevSig = await AsyncStorage.getItem(SCHEDULE_SIG_KEY);
    if (prevSig !== 'inactive') {
      await cancelExistingPeriodSchedules();
      await AsyncStorage.setItem(SCHEDULE_SIG_KEY, 'inactive');
    }
    return;
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
  } catch {
    return;
  }

  const sendHours = config?.defaultSendHours?.length
    ? config.defaultSendHours
    : [10, 15, 20];
  const maxPerDay = config?.maxPerDay || 2;
  const remoteMsgs: RemotePeriodMessage[] =
    config?.messages?.length
      ? config.messages
      : PERIOD_SUPPORT_NOTIFICATIONS.map((m, idx) => ({
          id: m.id,
          titleTr: m.titleTr,
          titleEn: m.titleEn,
          messageTr: m.messageTr,
          messageEn: m.messageEn,
          emoji: m.emoji,
          tone: 'empathy',
          dayRange: 'all',
          active: true,
          order: idx + 1,
        }));

  const quietEnabled = (await AsyncStorage.getItem('@quiet_hours_enabled')) === 'true';
  const quietStartRaw = await AsyncStorage.getItem('@quiet_hours_start');
  const quietEndRaw = await AsyncStorage.getItem('@quiet_hours_end');
  const quietStartHour = quietStartRaw ? Number(quietStartRaw.split(':')[0]) : 23;
  const quietEndHour = quietEndRaw ? Number(quietEndRaw.split(':')[0]) : 8;
  const qStart = Number.isFinite(quietStartHour) ? quietStartHour : 23;
  const qEnd = Number.isFinite(quietEndHour) ? quietEndHour : 8;
  const isQuietHour = (h: number) =>
    quietEnabled && (qStart > qEnd ? h >= qStart || h < qEnd : h >= qStart && h < qEnd);

  const discreetMode =
    (await AsyncStorage.getItem('@discreet_period_notifications')) === 'true';
  const todayStr = new Date().toISOString().slice(0, 10);
  const sig = [
    todayStr,
    effectiveCycleDay,
    config?.updatedAt || 'local',
    maxPerDay,
    sendHours.join(','),
    quietEnabled ? `q1:${qStart}-${qEnd}` : 'q0',
    discreetMode ? 'd1' : 'd0',
  ].join('|');

  const prevSig = await AsyncStorage.getItem(SCHEDULE_SIG_KEY);
  if (prevSig === sig) {
    return;
  }

  await cancelExistingPeriodSchedules();

  const now = new Date();
  const remainingDays = Math.min(3, Math.max(1, windowDays - effectiveCycleDay + 1));

  for (let dayOffset = 0; dayOffset < remainingDays; dayOffset++) {
    const targetCycleDay = effectiveCycleDay + dayOffset;
    const validHours = sendHours
      .filter((h) => !isQuietHour(h))
      .slice(0, maxPerDay);

    const msgs = selectMessagesForDay(
      remoteMsgs,
      targetCycleDay,
      validHours.length,
      dayOffset * maxPerDay,
    );

    for (let i = 0; i < validHours.length; i++) {
      const msg = msgs[i];
      if (!msg) continue;

      const triggerDate = new Date(now);
      triggerDate.setDate(now.getDate() + dayOffset);
      triggerDate.setHours(validHours[i], 0, 0, 0);

      if (triggerDate.getTime() <= now.getTime() + 60 * 1000) {
        continue;
      }

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: discreetMode ? 'Kendine küçük bir mola ver 🌸' : msg.titleTr,
            body: discreetMode
              ? 'Bugün bedenine biraz daha özen göster. Detaylar uygulamada.'
              : msg.messageTr,
            sound: 'default',
            data: {
              source: 'period_support_sync',
              type: 'PERIOD_SUPPORT',
              screen: 'home',
              cycleDay: targetCycleDay,
              messageId: msg.id,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            channelId: 'period-support',
            date: triggerDate,
          },
        });
      } catch {
        // Ignore single notification schedule failure on unsupported simulator states
      }
    }
  }

  await AsyncStorage.setItem(SCHEDULE_SIG_KEY, sig);
}
