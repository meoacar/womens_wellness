import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Reminder } from '@prisma/client';

@Injectable()
export class ReminderSchedulerService {
  constructor(
    @InjectQueue('reminders')
    private reminderQueue: Queue,
  ) {}

  /**
   * Calculate next run time based on reminder type
   * Implements quiet hours logic per CLAUDE.md §40.2
   */
  calculateNextRun(
    type: string,
    time: string,
    days?: number[],
    customCron?: string,
    timezone = 'Europe/Istanbul',
  ): Date {
    const now = new Date();
    const [rawH, rawM] = (time || '09:00').split(':').map(Number);
    const targetHours = Number.isFinite(rawH) ? Math.min(23, Math.max(0, rawH)) : 9;
    const targetMinutes = Number.isFinite(rawM) ? Math.min(59, Math.max(0, rawM)) : 0;

    // Resolve current local calendar & time parts in user's timezone so UTC container stays accurate
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const part = (k: string) => Number(tzParts.find((p) => p.type === k)?.value || 0);
    const localAsUtcMs = Date.UTC(
      part('year'),
      Math.max(0, part('month') - 1),
      part('day'),
      part('hour') % 24,
      part('minute'),
      part('second'),
    );
    const tzOffsetMs = localAsUtcMs - now.getTime();

    const localNow = new Date(localAsUtcMs);
    const localNext = new Date(
      Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate(),
        targetHours,
        targetMinutes,
        0,
        0,
      ),
    );

    switch (type) {
      case 'DAILY':
        if (localNext <= localNow) {
          localNext.setUTCDate(localNext.getUTCDate() + 1);
        }
        break;

      case 'WEEKLY':
        if (days && days.length > 0) {
          const currentDay = localNow.getUTCDay();
          const sortedDays = [...days].sort((a, b) => a - b);

          if (sortedDays.includes(currentDay) && localNext > localNow) {
            break;
          }

          const nextDay = sortedDays.find((d) => d > currentDay);
          if (nextDay === undefined) {
            const firstDay = sortedDays[0];
            localNext.setUTCDate(localNext.getUTCDate() + (7 - currentDay + firstDay));
          } else {
            localNext.setUTCDate(localNext.getUTCDate() + (nextDay - currentDay));
          }
        }
        break;

      case 'MONTHLY':
        if (days && days.length > 0) {
          const currentDate = localNow.getUTCDate();
          const sortedDays = [...days].sort((a, b) => a - b);

          if (sortedDays.includes(currentDate) && localNext > localNow) {
            break;
          }

          const nextDay = sortedDays.find((d) => d > currentDate);
          if (nextDay === undefined) {
            localNext.setUTCDate(1);
            localNext.setUTCMonth(localNext.getUTCMonth() + 1);
            localNext.setUTCDate(sortedDays[0]);
          } else {
            localNext.setUTCDate(nextDay);
          }
        }
        break;

      case 'CUSTOM':
        return new Date(now.getTime() + 3600000);
    }

    return new Date(localNext.getTime() - tzOffsetMs);
  }

  /**
   * Check if push should be sent based on quiet hours
   * Per CLAUDE.md §40.2
   */
  shouldSendPush(
    now: Date,
    quietHours?: {
      enabled: boolean;
      startHour: number;
      endHour: number;
      timezone: string;
    },
  ): boolean {
    if (!quietHours || !quietHours.enabled) {
      return true;
    }

    const rawHour = Number(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: quietHours.timezone || 'Europe/Istanbul',
      }).format(now),
    );
    const hour = Number.isNaN(rawHour) ? now.getUTCHours() : rawHour % 24;

    // Handle overnight window (e.g., 22:00 - 08:00)
    if (quietHours.startHour > quietHours.endHour) {
      return !(hour >= quietHours.startHour || hour < quietHours.endHour);
    }

    // Regular window (e.g., 08:00 - 22:00)
    return !(hour >= quietHours.startHour && hour < quietHours.endHour);
  }

  async scheduleReminder(reminder: Reminder) {
    const delay = reminder.nextRunAt.getTime() - Date.now();

    await this.reminderQueue.add(
      'send-reminder',
      {
        reminderId: reminder.id,
        userId: reminder.userId,
        payload: reminder.payloadJson,
      },
      {
        jobId: `reminder-${reminder.id}`,
        delay: Math.max(0, delay),
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async cancelReminder(reminderId: string) {
    const jobId = `reminder-${reminderId}`;
    const job = await this.reminderQueue.getJob(jobId);

    if (job) {
      await job.remove();
    }
  }

  async rescheduleReminder(reminder: Reminder) {
    await this.cancelReminder(reminder.id);
    await this.scheduleReminder(reminder);
  }
}
