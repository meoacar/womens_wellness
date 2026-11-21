export interface ClientTelemetry {
  ipAddress?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  userAgent?: string;
  platform?: string;
}

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, 200) : undefined;
}

export function normalizeIp(rawIp?: string): string | undefined {
  if (!rawIp) return undefined;
  const first = rawIp.split(',')[0]?.trim();
  if (!first) return undefined;
  return first.replace(/^::ffff:/i, '').slice(0, 100);
}

function parseUserAgentSummary(userAgent?: string): {
  deviceModel?: string;
  osVersion?: string;
} {
  if (!userAgent) return {};

  let osVersion: string | undefined;
  const androidMatch = userAgent.match(/Android\s+([\d.]+)/i);
  const iosMatch = userAgent.match(/(?:iPhone|iPad|CPU)\s+OS\s+([\d_]+)/i);
  const macMatch = userAgent.match(/Mac OS X\s+([\d_]+)/i);
  const winMatch = userAgent.match(/Windows NT\s+([\d.]+)/i);

  if (androidMatch) {
    osVersion = `Android ${androidMatch[1]}`;
  } else if (iosMatch) {
    osVersion = `iOS ${iosMatch[1].replace(/_/g, '.')}`;
  } else if (macMatch) {
    osVersion = `macOS ${macMatch[1].replace(/_/g, '.')}`;
  } else if (winMatch) {
    osVersion = `Windows ${winMatch[1]}`;
  }

  let deviceModel: string | undefined;
  if (/iPhone/i.test(userAgent)) {
    deviceModel = 'iPhone';
  } else if (/iPad/i.test(userAgent)) {
    deviceModel = 'iPad';
  } else if (/Android/i.test(userAgent)) {
    const paren = userAgent.match(/\(([^)]+)\)/)?.[1];
    const parts = paren?.split(';').map((s) => s.trim()) || [];
    const candidate = parts.find(
      (p) =>
        p &&
        !/^(Linux|U|Android|wv)$/i.test(p) &&
        !/^Android\s/i.test(p) &&
        !/^[a-z]{2}(-[A-Za-z]{2})?$/.test(p),
    );
    deviceModel = candidate ? candidate.replace(/\s+Build\/.*$/i, '').trim() : 'Android Cihaz';
  } else if (/Expo|okhttp/i.test(userAgent)) {
    deviceModel = 'Mobil Uygulama';
  } else if (/Mozilla|Chrome|Safari|Firefox|Edg/i.test(userAgent)) {
    deviceModel = 'Web Tarayıcı';
  }

  return { deviceModel, osVersion };
}

export function extractClientTelemetry(req: any): ClientTelemetry {
  if (!req) return {};
  const headers = req.headers || {};

  const forwarded = normalizeHeader(headers['x-forwarded-for']);
  const cfIp = normalizeHeader(headers['cf-connecting-ip']);
  const realIp = normalizeHeader(headers['x-real-ip']);
  const ipAddress = normalizeIp(
    forwarded || cfIp || realIp || req.ip || req.socket?.remoteAddress,
  );

  const userAgent = normalizeHeader(headers['user-agent']);
  const parsedUa = parseUserAgentSummary(userAgent);

  const deviceModel = normalizeHeader(headers['x-device-model']) || parsedUa.deviceModel;
  const osVersion = normalizeHeader(headers['x-os-version']) || parsedUa.osVersion;
  const appVersion = normalizeHeader(headers['x-app-version']);
  const platform = normalizeHeader(headers['x-platform']);

  return {
    ipAddress,
    deviceModel,
    osVersion,
    appVersion,
    userAgent: userAgent?.slice(0, 300),
    platform,
  };
}
