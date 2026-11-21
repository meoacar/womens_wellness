import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const LOCAL_PIN_HASH_KEY = 'localPinHash';

async function computePinDigest(userId: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `kadinatlasi-pin:${userId}:${pin}`,
  );
}

export async function saveLocalPinHash(userId: string, pin: string): Promise<void> {
  if (!userId || !pin) return;
  const digest = await computePinDigest(userId, pin);
  await SecureStore.setItemAsync(LOCAL_PIN_HASH_KEY, `${userId}:${digest}`).catch(() => {});
}

export async function verifyLocalPinHash(
  userId: string,
  pin: string,
): Promise<'match' | 'mismatch' | 'missing'> {
  if (!userId || !pin) return 'missing';
  try {
    const stored = await SecureStore.getItemAsync(LOCAL_PIN_HASH_KEY);
    if (!stored || !stored.startsWith(`${userId}:`)) {
      return 'missing';
    }
    const expected = `${userId}:${await computePinDigest(userId, pin)}`;
    return stored === expected ? 'match' : 'mismatch';
  } catch {
    return 'missing';
  }
}

export async function clearLocalPinHash(): Promise<void> {
  await SecureStore.deleteItemAsync(LOCAL_PIN_HASH_KEY).catch(() => {});
}
