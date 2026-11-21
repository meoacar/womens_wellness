import { PushService } from './push.service';

describe('PushService', () => {
  const createPrismaMock = () => ({
    user: {
      findUnique: jest.fn(),
    },
    profile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    wellnessPreferences: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  });

  it('normalizes quietHours from string start/end and numeric 0 hour without resetting to 23/8', async () => {
    const prisma = createPrismaMock();
    prisma.profile.findUnique.mockResolvedValue({
      preferencesJson: {},
    });
    prisma.profile.update.mockResolvedValue({});
    prisma.wellnessPreferences.findUnique.mockResolvedValue(null);
    prisma.wellnessPreferences.create.mockResolvedValue({});

    const service = new PushService(prisma as any);

    const result1 = (await service.updateNotificationPreferences('u1', {
      quietHours: { enabled: true, start: '22:00', end: '07:00' } as any,
    })) as any;
    expect(result1.quietHours).toEqual({
      enabled: true,
      startHour: 22,
      endHour: 7,
      start: '22:00',
      end: '07:00',
    });

    const result2 = (await service.updateNotificationPreferences('u1', {
      quietHours: { enabled: true, startHour: 0, endHour: 6 },
    })) as any;
    expect(result2.quietHours).toEqual({
      enabled: true,
      startHour: 0,
      endHour: 6,
      start: '00:00',
      end: '06:00',
    });
  });

  it('queues notification to pendingPushQueue when user has no pushToken', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      profile: {
        timezone: 'Europe/Istanbul',
        preferencesJson: {},
      },
    });
    prisma.profile.update.mockResolvedValue({});

    const service = new PushService(prisma as any);
    const receipt = await service.sendPush(
      'u1',
      {
        to: '',
        title: 'Test',
        body: 'Merhaba',
      },
      { ignoreQuietHours: true },
    );

    expect(receipt.status).toBe('queued');
    expect(receipt.delivery).toBe('device_sync');
    expect(prisma.profile.update).toHaveBeenCalledTimes(1);
  });
});
