import { NativeModules } from 'react-native';
import * as Linking from 'expo-linking';

function extractHost(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  // Matches http://192.168.1.92:8081, exp://192.168.1.92:8081, or bare 192.168.1.92:8081
  const withoutScheme = rawUrl.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
  const hostPart = withoutScheme.split('/')[0]?.split(':')[0]?.trim();
  if (
    !hostPart ||
    hostPart === 'localhost' ||
    hostPart === '127.0.0.1' ||
    hostPart === '10.0.2.2'
  ) {
    return null;
  }
  return hostPart;
}

let loggedOnce = false;

/**
 * Resolves the API base URL.
 * On physical devices running Expo Go over LAN Wi-Fi, `localhost` points to
 * the phone itself. In Expo SDK 54 (Bridgeless), `Linking.createURL('')` and
 * `SourceCode.getConstants().scriptURL` expose the Metro host IP (e.g. 192.168.1.92).
 */
export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.kadinatlasi.com';
  let resolved = configured;

  if (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    (configured.includes('localhost') || configured.includes('127.0.0.1'))
  ) {
    const candidates: Array<string | undefined | null> = [];

    try {
      candidates.push(Linking.createURL(''));
    } catch {
      // Ignore
    }

    try {
      const sourceCode = (NativeModules as any)?.SourceCode;
      candidates.push(sourceCode?.getConstants?.()?.scriptURL);
      candidates.push(sourceCode?.scriptURL);
    } catch {
      // Ignore
    }

    try {
      const platformConstants = (NativeModules as any)?.PlatformConstants;
      candidates.push(platformConstants?.getConstants?.()?.ServerHost);
      candidates.push(platformConstants?.ServerHost);
    } catch {
      // Ignore
    }

    for (const candidate of candidates) {
      const host = extractHost(candidate);
      if (host) {
        resolved = configured.replace(/localhost|127\.0\.0\.1/, host);
        break;
      }
    }
  }

  if (!loggedOnce) {
    loggedOnce = true;
    console.log('[API] Resolved base URL:', resolved);
  }

  return resolved;
}

export const API_BASE_URL = getApiBaseUrl();
