import { Platform } from 'react-native';

let cachedAppVersion: string | null = null;

function resolveAppVersion(): string {
  if (cachedAppVersion) return cachedAppVersion;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appJson = require('../../app.json');
    const version = appJson?.expo?.version || '1.0.0';
    const buildNum =
      Platform.OS === 'android'
        ? appJson?.expo?.android?.versionCode
        : appJson?.expo?.ios?.buildNumber;
    cachedAppVersion = buildNum ? `${version} (${buildNum})` : String(version);
  } catch {
    cachedAppVersion = '1.0.0';
  }
  return cachedAppVersion;
}

export function getClientTelemetryHeaders(): Record<string, string> {
  const constants = (Platform.constants || {}) as Record<string, any>;

  let deviceModel = 'Bilinmeyen Cihaz';
  if (Platform.OS === 'android') {
    const manufacturer = constants.Manufacturer || constants.Brand || '';
    const model = constants.Model || '';
    const combined = `${manufacturer} ${model}`.trim();
    deviceModel = combined || 'Android Cihaz';
  } else if (Platform.OS === 'ios') {
    const idiom = constants.interfaceIdiom === 'pad' ? 'iPad' : 'iPhone';
    deviceModel = constants.Model || idiom;
  } else if (Platform.OS === 'web') {
    deviceModel = 'Web';
  }

  let osVersion = `${Platform.OS} ${Platform.Version}`;
  if (Platform.OS === 'android') {
    const release = constants.Release ? `Android ${constants.Release}` : 'Android';
    osVersion = Platform.Version ? `${release} (API ${Platform.Version})` : release;
  } else if (Platform.OS === 'ios') {
    const sysName = constants.systemName || 'iOS';
    const osVer = constants.osVersion || String(Platform.Version || '');
    osVersion = `${sysName} ${osVer}`.trim();
  }

  return {
    'X-Device-Model': deviceModel.slice(0, 120),
    'X-OS-Version': osVersion.slice(0, 120),
    'X-App-Version': resolveAppVersion().slice(0, 60),
    'X-Platform': Platform.OS,
  };
}
