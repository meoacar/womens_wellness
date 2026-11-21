import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { authService } from '@/services/api';
import { useTheme } from '@/hooks/useTheme';
import { AccountStatusModal } from '@/components/AccountStatusModal';

WebBrowser.maybeCompleteAuthSession();

type AuthMode = 'signin' | 'register';

export default function SignInScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { setAuth } = useAuthStore();
  const { data: draftData, loadDraft } = useOnboardingStore();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberedIdentifier, setRememberedIdentifier] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || webClientId;
  const isGoogleEnabled =
    process.env.EXPO_PUBLIC_FEATURE_GOOGLE_AUTH !== 'false' &&
    Boolean(Platform.OS === 'android' ? androidClientId : webClientId || iosClientId);

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    androidClientId: androidClientId || 'unconfigured',
    iosClientId: iosClientId || 'unconfigured',
    webClientId: webClientId || 'unconfigured',
    ...(Platform.OS === 'android' && androidClientId
      ? {
          redirectUri: `com.googleusercontent.apps.${androidClientId.replace('.apps.googleusercontent.com', '')}:/oauthredirect`,
        }
      : {}),
  });

  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    initialView: 'suspended' | 'support';
    reasonMessage: string | null;
  }>({ visible: false, initialView: 'suspended', reasonMessage: null });

  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    loadDraft();
    SecureStore.getItemAsync('lastLoginIdentifier')
      .then((saved) => {
        if (saved) setRememberedIdentifier(saved);
      })
      .catch(() => {});
  }, [loadDraft]);

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'cancel' || googleResponse.type === 'dismiss') {
      setGoogleLoading(false);
      return;
    }
    if (googleResponse.type === 'error') {
      setGoogleLoading(false);
      setInlineError('Google ile giriş başarısız oldu. Lütfen tekrar dene.');
      return;
    }
    if (googleResponse.type === 'success') {
      const idToken =
        googleResponse.authentication?.idToken ||
        (googleResponse.params as any)?.id_token;
      if (!idToken) {
        setGoogleLoading(false);
        setInlineError('Google kimlik doğrulama jetonu alınamadı.');
        return;
      }
      setInlineError(null);
      setGoogleLoading(true);
      authService
        .googleLogin(idToken)
        .then(async (response) => {
          if (response.user?.email) {
            await SecureStore.setItemAsync('lastLoginIdentifier', response.user.email).catch(() => {});
          }
          await SecureStore.setItemAsync('hasSeenWelcome', 'true').catch(() => {});
          await setAuth(response.user, {
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
          });
          router.replace('/(tabs)/home');
        })
        .catch((error: any) => {
          if (
            error?.code === 'ACCOUNT_SUSPENDED' ||
            error?.code === 'ACCOUNT_DELETED' ||
            error?.status === 403
          ) {
            setStatusModal({
              visible: true,
              initialView: 'suspended',
              reasonMessage: error.message || null,
            });
          } else {
            setInlineError(
              error?.message || 'Google ile giriş yapılamadı. Lütfen tekrar dene.',
            );
          }
        })
        .finally(() => {
          setGoogleLoading(false);
        });
    }
  }, [googleResponse, router, setAuth]);

  const handleGooglePress = async () => {
    if (!isGoogleEnabled || !googleRequest || loading || googleLoading) return;
    setInlineError(null);
    setGoogleLoading(true);
    try {
      await promptGoogleAsync();
    } catch {
      setGoogleLoading(false);
      setInlineError('Google oturum penceresi açılamadı.');
    }
  };

  const hasDraft = Boolean(draftData?.firstName || draftData?.email);

  const performLogin = async (loginId: string, loginPass: string) => {
    const cleanId = loginId.trim();
    if (!cleanId || !loginPass) {
      setInlineError('Lütfen e-posta/kullanıcı adı ve şifreni gir.');
      return;
    }

    setInlineError(null);
    setLoading(true);
    try {
      const response = await authService.login({
        identifier: cleanId,
        password: loginPass,
      });
      await SecureStore.setItemAsync('lastLoginIdentifier', cleanId).catch(() => {});
      await SecureStore.setItemAsync('hasSeenWelcome', 'true').catch(() => {});
      await setAuth(response.user, {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      router.replace('/(tabs)/home');
    } catch (error: any) {
      if (
        error?.code === 'ACCOUNT_SUSPENDED' ||
        error?.code === 'ACCOUNT_DELETED' ||
        error?.status === 403
      ) {
        setStatusModal({
          visible: true,
          initialView: 'suspended',
          reasonMessage: error.message || null,
        });
      } else {
        setInlineError(
          error?.message === 'Invalid credentials'
            ? 'E-posta/kullanıcı adı veya şifre hatalı.'
            : error?.message || 'Giriş yapılamadı. Lütfen tekrar dene.',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => performLogin(identifier, password);

  const handleQuickDemo = (demoEmail: string, demoPass: string) => {
    setIdentifier(demoEmail);
    setPassword(demoPass);
    setInlineError(null);
  };

  const handleOpenTour = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/signup');
    }
  };

  const handleStartRegister = async () => {
    await SecureStore.setItemAsync('hasSeenWelcome', 'true').catch(() => {});
    router.push('/(auth)/onboarding/identity');
  };

  const styles = createStyles(theme);
  const canSubmit = Boolean(identifier.trim() && password) && !loading;
  const looksLikeEmail = identifier.includes('@');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Navigation Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={handleOpenTour}
              style={styles.topActionPill}
              activeOpacity={0.75}
              accessibilityLabel="Tanıtıma dön"
            >
              <Ionicons
                name={router.canGoBack() ? 'chevron-back' : 'sparkles-outline'}
                size={16}
                color={theme.colors.text}
              />
              {!router.canGoBack() && (
                <Text style={styles.topActionText}>Tanıtım</Text>
              )}
            </TouchableOpacity>

            <View style={styles.brandPill}>
              <Ionicons name="sparkles" size={12} color={theme.colors.primary} />
              <Text style={styles.brandPillText}>KADIN ATLASI</Text>
            </View>

            <TouchableOpacity
              onPress={() =>
                setStatusModal({
                  visible: true,
                  initialView: 'support',
                  reasonMessage: null,
                })
              }
              style={styles.topActionPill}
              activeOpacity={0.75}
              accessibilityLabel="Destek ekibine ulaş"
            >
              <Ionicons
                name="headset-outline"
                size={16}
                color={theme.colors.primary}
              />
              <Text style={[styles.topActionText, { color: theme.colors.primary }]}>
                Destek
              </Text>
            </TouchableOpacity>
          </View>

          {/* Compact Modern Hero */}
          <LinearGradient
            colors={
              theme.isDark ? ['#2A1836', '#1B1429'] : ['#FFF1F7', '#F3E8FF']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBanner}
          >
            <View style={styles.heroRow}>
              <View style={styles.mascotHalo}>
                <Image
                  source={require('../../assets/images/mascot/6.png')}
                  style={styles.mascot}
                />
              </View>
              <View style={styles.heroTextCol}>
                <Text style={styles.title}>
                  {mode === 'signin' ? 'Tekrar Hoş Geldin' : 'Aramıza Katıl'}
                </Text>
                <Text style={styles.subtitle}>
                  {mode === 'signin'
                    ? 'Döngün, semptomların ve NOVA asistanın seni bekliyor.'
                    : 'Sadece 1 dakikada kişisel döngü ve wellness planını oluştur.'}
                </Text>
              </View>
            </View>

            {/* Segmented Mode Switcher */}
            <View style={styles.segmentedWrap}>
              <TouchableOpacity
                onPress={() => {
                  setMode('signin');
                  setInlineError(null);
                }}
                style={[
                  styles.segmentTab,
                  mode === 'signin' && styles.segmentTabActive,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.segmentTabText,
                    mode === 'signin' && styles.segmentTabTextActive,
                  ]}
                >
                  Giriş Yap
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMode('register');
                  setInlineError(null);
                }}
                style={[
                  styles.segmentTab,
                  mode === 'register' && styles.segmentTabActive,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.segmentTabText,
                    mode === 'register' && styles.segmentTabTextActive,
                  ]}
                >
                  Yeni Hesap
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {mode === 'signin' ? (
            <>
              {/* Remembered Last Identifier Chip */}
              {rememberedIdentifier && identifier !== rememberedIdentifier && (
                <TouchableOpacity
                  onPress={() => {
                    setIdentifier(rememberedIdentifier);
                    setInlineError(null);
                    passwordRef.current?.focus();
                  }}
                  style={styles.rememberChip}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="time-outline"
                    size={15}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.rememberChipText} numberOfLines={1}>
                    Son hesapla devam et:{' '}
                    <Text style={styles.rememberChipEmail}>
                      {rememberedIdentifier}
                    </Text>
                  </Text>
                  <Ionicons
                    name="arrow-forward-circle"
                    size={16}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              )}

              {/* Sign-In Form Card */}
              <View style={styles.formCard}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>E-posta veya Kullanıcı Adı</Text>
                  <View
                    style={[
                      styles.inputShell,
                      focusedField === 'identifier' && styles.inputShellFocused,
                    ]}
                  >
                    <Ionicons
                      name={looksLikeEmail ? 'at-outline' : 'person-outline'}
                      size={18}
                      color={
                        focusedField === 'identifier'
                          ? theme.colors.primary
                          : theme.colors.textLight
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="ornek@email.com veya kullaniciadi"
                      placeholderTextColor={theme.colors.textLight}
                      value={identifier}
                      onChangeText={(val) => {
                        setIdentifier(val);
                        if (inlineError) setInlineError(null);
                      }}
                      onFocus={() => setFocusedField('identifier')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                    {identifier.length > 0 && !loading && (
                      <TouchableOpacity
                        onPress={() => setIdentifier('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color={theme.colors.textLight}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.fieldGroupLast}>
                  <View style={styles.passwordLabelRow}>
                    <Text style={styles.labelNoMargin}>Şifre</Text>
                    <TouchableOpacity
                      onPress={() => router.push('/(auth)/forgot-password')}
                      disabled={loading}
                    >
                      <Text style={styles.forgotText}>Şifremi Unuttum</Text>
                    </TouchableOpacity>
                  </View>

                  <View
                    style={[
                      styles.inputShell,
                      focusedField === 'password' && styles.inputShellFocused,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={
                        focusedField === 'password'
                          ? theme.colors.primary
                          : theme.colors.textLight
                      }
                    />
                    <TextInput
                      ref={passwordRef}
                      style={styles.input}
                      placeholder="Şifren"
                      placeholderTextColor={theme.colors.textLight}
                      value={password}
                      onChangeText={(val) => {
                        setPassword(val);
                        if (inlineError) setInlineError(null);
                      }}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      returnKeyType="done"
                      onSubmitEditing={handleSignIn}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((prev) => !prev)}
                      disabled={loading}
                      style={styles.eyeButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={theme.colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {inlineError && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.errorText}>{inlineError}</Text>
                  </View>
                )}
              </View>

              {/* Primary CTA */}
              <View style={styles.ctaSection}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={handleSignIn}
                  disabled={!canSubmit}
                  style={[styles.ctaWrap, !canSubmit && styles.ctaWrapDisabled]}
                >
                  <LinearGradient
                    colors={
                      canSubmit
                        ? ['#EC4899', '#9333EA']
                        : theme.isDark
                        ? ['#2B2B30', '#2B2B30']
                        : ['#E5E7EB', '#E5E7EB']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.ctaGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Text
                          style={[
                            styles.ctaText,
                            !canSubmit && styles.ctaTextDisabled,
                          ]}
                        >
                          Giriş Yap
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={18}
                          color={canSubmit ? '#FFFFFF' : theme.colors.textLight}
                        />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {isGoogleEnabled && (
                  <>
                    <View style={styles.dividerRow}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>veya</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={!googleRequest || loading || googleLoading}
                      onPress={handleGooglePress}
                      style={styles.googleBtn}
                    >
                      {googleLoading ? (
                        <ActivityIndicator size="small" color={theme.colors.text} />
                      ) : (
                        <>
                          <Ionicons name="logo-google" size={18} color="#DB4437" />
                          <Text style={styles.googleBtnText}>Google ile Devam Et</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {__DEV__ && (
                  <View style={styles.devQuickRow}>
                    <Text style={styles.devQuickLabel}>Hızlı Test:</Text>
                    <TouchableOpacity
                      style={styles.devQuickChip}
                      onPress={() => handleQuickDemo('free@wellness.local', 'free123')}
                    >
                      <Text style={styles.devQuickChipText}>Free Üye</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.devQuickChip}
                      onPress={() => handleQuickDemo('premium@wellness.local', 'premium123')}
                    >
                      <Text style={styles.devQuickChipText}>Premium Üye</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          ) : (
            /* Inline New Account Launch Card */
            <View style={styles.registerCard}>
              {hasDraft && (
                <View style={styles.draftBanner}>
                  <Ionicons name="bookmark" size={14} color="#7C3AED" />
                  <Text style={styles.draftBannerText}>
                    Yarım bıraktığın kayıt taslağı bulundu, kaldığın yerden devam edebilirsin.
                  </Text>
                </View>
              )}

              <View style={styles.benefitItem}>
                <View style={[styles.benefitIcon, { backgroundColor: 'rgba(236,72,153,0.12)' }]}>
                  <Ionicons name="calendar-outline" size={18} color="#EC4899" />
                </View>
                <View style={styles.benefitTextCol}>
                  <Text style={styles.benefitTitle}>Akıllı Döngü & Semptom Takvimi</Text>
                  <Text style={styles.benefitDesc}>
                    Döngü uzunluğuna göre kişiselleşen öngörü ve faz rehberi
                  </Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View style={[styles.benefitIcon, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
                  <Ionicons name="sparkles-outline" size={18} color="#8B5CF6" />
                </View>
                <View style={styles.benefitTextCol}>
                  <Text style={styles.benefitTitle}>NOVA AI Sağlık Asistanı</Text>
                  <Text style={styles.benefitDesc}>
                    Günlük check-in verilerine göre özel öneriler ve 7/24 sohbet
                  </Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View style={[styles.benefitIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
                </View>
                <View style={styles.benefitTextCol}>
                  <Text style={styles.benefitTitle}>Tam Gizlilik & PIN Kilidi</Text>
                  <Text style={styles.benefitDesc}>
                    Gizli kilit ekranı bildirimleri ve şifreli kişisel veri koruması
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleStartRegister}
                style={[styles.ctaWrap, { marginTop: 6 }]}
              >
                <LinearGradient
                  colors={['#EC4899', '#9333EA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}
                >
                  <Text style={styles.ctaText}>
                    {hasDraft ? 'Taslağa Devam Et' : 'Ücretsiz Hesap Oluştur'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom Trust & Support Strip */}
          <View style={styles.footerWrap}>
            <View style={styles.trustRow}>
              <Ionicons name="lock-closed-outline" size={13} color="#10B981" />
              <Text style={styles.trustText}>
                KVKK uyumlu · Verilerin cihazında ve sunucuda şifreli korunur
              </Text>
            </View>

            <TouchableOpacity
              onPress={() =>
                setStatusModal({
                  visible: true,
                  initialView: 'support',
                  reasonMessage: null,
                })
              }
              disabled={loading}
              style={styles.supportPillBtn}
              activeOpacity={0.75}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={14}
                color={theme.colors.primary}
              />
              <Text style={styles.supportLinkText}>
                Giriş yapamıyor musun?{' '}
                <Text style={styles.signUpBold}>Destek Ekibine Ulaş</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AccountStatusModal
        visible={statusModal.visible}
        initialView={statusModal.initialView}
        reasonMessage={statusModal.reasonMessage}
        prefillEmail={identifier.includes('@') ? identifier.trim() : undefined}
        onClose={() =>
          setStatusModal((prev) => ({ ...prev, visible: false }))
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 22,
      justifyContent: 'space-between',
      gap: 14,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topActionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 36,
      paddingHorizontal: 10,
      borderRadius: 14,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    topActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
    },
    brandPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.colors.backgroundCard,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    brandPillText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.9,
      color: theme.colors.primary,
    },
    heroBanner: {
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 14,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    mascotHalo: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.backgroundCard,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 4,
    },
    mascot: {
      width: 48,
      height: 48,
      resizeMode: 'contain',
    },
    heroTextCol: {
      flex: 1,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    segmentedWrap: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: 16,
      backgroundColor: theme.isDark
        ? 'rgba(0,0,0,0.28)'
        : 'rgba(255,255,255,0.8)',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    segmentTab: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentTabActive: {
      backgroundColor: theme.colors.backgroundCard,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    segmentTabText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    segmentTabTextActive: {
      color: theme.colors.primary,
    },
    rememberChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      backgroundColor: theme.isDark ? 'rgba(236,72,153,0.14)' : '#FDF2F8',
      borderWidth: 1,
      borderColor: theme.isDark ? 'rgba(236,72,153,0.35)' : '#FBCFE8',
    },
    rememberChipText: {
      flex: 1,
      fontSize: 12.5,
      color: theme.colors.textSecondary,
    },
    rememberChipEmail: {
      fontWeight: '700',
      color: theme.colors.text,
    },
    formCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    fieldGroup: {
      marginBottom: 14,
    },
    fieldGroupLast: {
      marginBottom: 0,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
    },
    labelNoMargin: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
    passwordLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    forgotText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    inputShell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.isDark ? '#141418' : '#F9FAFB',
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 50,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    inputShellFocused: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.backgroundCard,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
    },
    eyeButton: {
      padding: 2,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.isDark ? 'rgba(220,38,38,0.18)' : '#FEF2F2',
    },
    errorText: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: '600',
      color: theme.isDark ? '#FCA5A5' : '#B91C1C',
    },
    ctaSection: {
      gap: 10,
    },
    ctaWrap: {
      borderRadius: 18,
      overflow: 'hidden',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    },
    ctaWrapDisabled: {
      shadowOpacity: 0,
      elevation: 0,
    },
    ctaGradient: {
      height: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    ctaText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
    ctaTextDisabled: {
      color: theme.colors.textLight,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginVertical: 4,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    dividerText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textLight,
    },
    googleBtn: {
      height: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundCard,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    googleBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    devQuickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingTop: 2,
    },
    devQuickLabel: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.textLight,
    },
    devQuickChip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    devQuickChipText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    registerCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 14,
    },
    draftBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 10,
      borderRadius: 12,
      backgroundColor: 'rgba(124, 58, 237, 0.1)',
    },
    draftBannerText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: '#7C3AED',
      lineHeight: 17,
    },
    benefitItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    benefitIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    benefitTextCol: {
      flex: 1,
    },
    benefitTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
    benefitDesc: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    footerWrap: {
      gap: 8,
      alignItems: 'center',
      paddingTop: 2,
    },
    trustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    trustText: {
      fontSize: 11.5,
      color: theme.colors.textSecondary,
    },
    supportPillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    supportLinkText: {
      fontSize: 12.5,
      color: theme.colors.textSecondary,
    },
    signUpBold: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
  });
