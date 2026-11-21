import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { userService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { saveLocalPinHash, verifyLocalPinHash } from '@/utils/pinHash';

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['clear', '0', 'back'],
] as const;

interface PinLockViewProps {
  onUnlocked?: () => void;
}

export function PinLockView({ onUnlocked }: PinLockViewProps) {
  const router = useRouter();
  const theme = useTheme();
  const styles = createStyles(theme);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const setPinStatus = useAuthStore((state) => state.setPinStatus);

  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const handleBiometricUnlock = useCallback(async () => {
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Kadın Atlası kilidini aç',
        fallbackLabel: 'PIN Kullan',
        cancelLabel: 'İptal',
      });
      if (res.success) {
        setPinStatus(true, true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (onUnlocked) {
          onUnlocked();
        } else {
          router.replace('/(tabs)/home');
        }
      }
    } catch {
      // Ignore biometric cancellation/errors
    }
  }, [onUnlocked, router, setPinStatus]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const enabled = await SecureStore.getItemAsync('biometricEnabled');
        if (enabled !== 'true') return;
        const [hasHw, enrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
        if (mounted && hasHw && enrolled) {
          setBiometricAvailable(true);
          void handleBiometricUnlock();
        }
      } catch {
        // Ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [handleBiometricUnlock]);

  // Prevent Android hardware back button from bypassing the lock screen
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const verifyPin = useCallback(
    async (pinCode: string) => {
      if (isVerifying || pinCode.length < 4) return;

      try {
        setIsVerifying(true);
        setErrorText(null);
        const userId = user?.id;
        const localCheck = userId
          ? await verifyLocalPinHash(userId, pinCode)
          : 'missing';

        if (localCheck === 'mismatch') {
          throw new Error('INVALID_PIN');
        }

        if (localCheck === 'missing') {
          await userService.verifyPin(pinCode);
          if (userId) {
            void saveLocalPinHash(userId, pinCode);
          }
        }

        setPinStatus(true, true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (onUnlocked) {
          onUnlocked();
        } else {
          router.replace('/(tabs)/home');
        }
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setPin('');

        if (newAttempts >= 5) {
          Alert.alert(
            'Çok Fazla Hatalı Deneme',
            'Güvenlik nedeniyle oturumunuz kapatılacak.',
            [
              {
                text: 'Tamam',
                onPress: async () => {
                  await logout();
                  router.replace('/(auth)/signin');
                },
              },
            ],
          );
        } else {
          setErrorText(`Yanlış PIN. ${5 - newAttempts} deneme hakkınız kaldı.`);
        }
      } finally {
        setIsVerifying(false);
      }
    },
    [attempts, isVerifying, logout, onUnlocked, router, setPinStatus, user?.id],
  );

  // Auto-verify if user enters full 6 digits
  useEffect(() => {
    if (pin.length === 6 && !isVerifying) {
      verifyPin(pin);
    }
  }, [pin, isVerifying, verifyPin]);

  const handleDigitPress = (key: string) => {
    if (isVerifying) return;
    setErrorText(null);
    Haptics.selectionAsync().catch(() => {});

    if (key === 'clear') {
      setPin('');
      return;
    }
    if (key === 'back') {
      setPin((prev) => prev.slice(0, -1));
      return;
    }
    if (pin.length < 6) {
      setPin((prev) => prev + key);
    }
  };

  const handleForgotPin = () => {
    Alert.alert(
      'PIN Kodunu Sıfırla',
      'PIN kodunuzu unuttuysanız güvenlik amacıyla oturumdan çıkış yapıp şifrenizle tekrar giriş yapmalısınız.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/signin');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.lockHalo}>
            <Ionicons name="lock-closed" size={32} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Kadın Atlası</Text>
          <Text style={styles.subtitle}>Devam etmek için PIN kodunuzu girin</Text>
        </View>

        <View style={styles.pinDotsContainer}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const filled = index < pin.length;
            return (
              <View
                key={index}
                style={[
                  styles.pinBox,
                  filled && styles.pinBoxFilled,
                  index >= 4 && !filled && styles.pinBoxOptional,
                ]}
              >
                {filled && <View style={styles.pinInnerDot} />}
              </View>
            );
          })}
        </View>

        {errorText ? (
          <Text style={styles.errorText}>{errorText}</Text>
        ) : (
          <Text style={styles.helperText}>4–6 haneli PIN kodunuz ({pin.length}/6)</Text>
        )}

        <View style={styles.keypad}>
          {KEYPAD_ROWS.map((row, rIdx) => (
            <View key={rIdx} style={styles.keypadRow}>
              {row.map((key) => {
                const isSpecial = key === 'clear' || key === 'back';
                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.65}
                    disabled={isVerifying}
                    onPress={() => handleDigitPress(key)}
                    style={[
                      styles.keypadKey,
                      isSpecial && styles.keypadKeySpecial,
                    ]}
                  >
                    {key === 'back' ? (
                      <Ionicons
                        name="backspace-outline"
                        size={24}
                        color={theme.colors.text}
                      />
                    ) : key === 'clear' ? (
                      <Text style={styles.keypadClearText}>Temizle</Text>
                    ) : (
                      <Text style={styles.keypadDigitText}>{key}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {biometricAvailable && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleBiometricUnlock}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 10,
              marginTop: 4,
            }}
          >
            <Ionicons name="finger-print-outline" size={20} color={theme.colors.primary} />
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.colors.primary }}>
              Parmak İzi / Face ID ile Aç
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={pin.length < 4 || isVerifying}
          onPress={() => verifyPin(pin)}
          style={[
            styles.unlockButton,
            (pin.length < 4 || isVerifying) && styles.unlockButtonDisabled,
          ]}
        >
          {isVerifying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.unlockButtonText}>Kilidi Aç</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleForgotPin}
          style={styles.forgotButton}
          disabled={isVerifying}
        >
          <Text style={styles.forgotText}>PIN'imi Unuttum</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    lockHalo: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: theme.isDark
        ? 'rgba(236,72,153,0.18)'
        : 'rgba(236,72,153,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.text,
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14.5,
      color: theme.colors.textSecondary,
    },
    pinDotsContainer: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    pinBox: {
      width: 42,
      height: 48,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinBoxOptional: {
      borderStyle: 'dashed',
    },
    pinBoxFilled: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.isDark
        ? 'rgba(236,72,153,0.16)'
        : '#FDF2F8',
    },
    pinInnerDot: {
      width: 13,
      height: 13,
      borderRadius: 6.5,
      backgroundColor: theme.colors.primary,
    },
    helperText: {
      fontSize: 12.5,
      color: theme.colors.textSecondary,
      marginBottom: 22,
    },
    errorText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#DC2626',
      marginBottom: 22,
    },
    keypad: {
      width: '100%',
      maxWidth: 320,
      gap: 10,
      marginBottom: 18,
    },
    keypadRow: {
      flexDirection: 'row',
      gap: 10,
    },
    keypadKey: {
      flex: 1,
      height: 54,
      borderRadius: 16,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keypadKeySpecial: {
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB',
    },
    keypadDigitText: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.text,
    },
    keypadClearText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    unlockButton: {
      width: '100%',
      maxWidth: 320,
      height: 50,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    unlockButtonDisabled: {
      opacity: 0.45,
    },
    unlockButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
    forgotButton: {
      padding: 10,
    },
    forgotText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: '600',
    },
  });
