import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';
import { useOnboardingStore } from '@/store/onboardingStore';
import {
  IdentitySchema,
  type IdentityInput,
  calculatePasswordStrength,
} from '@/schemas/onboarding';
import { api } from '@/services/api';

const TOTAL_STEPS = 6;
const DEFAULT_PICKER_DATE = new Date(1998, 0, 1, 12, 0, 0);

function getAgeFromDate(date: Date): number {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return Math.max(0, age);
}

export default function IdentityStep() {
  const router = useRouter();
  const theme = useTheme();
  const { data, updateData, completeStep, setCurrentStep } = useOnboardingStore();

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempBirthDate, setTempBirthDate] = useState<Date | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const lastNameRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const initialBirthDate = data.birthDate ? new Date(data.birthDate) : undefined;
  const validInitialBirthDate =
    initialBirthDate && !Number.isNaN(initialBirthDate.getTime())
      ? initialBirthDate
      : undefined;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<IdentityInput>({
    resolver: zodResolver(IdentitySchema),
    mode: 'onChange',
    defaultValues: {
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      username: data.username || '',
      email: data.email || '',
      birthDate: validInitialBirthDate,
      password: data.password || '',
    },
  });

  const password = watch('password') || '';
  const username = watch('username') || '';
  const email = watch('email') || '';
  const passwordStrength = password ? calculatePasswordStrength(password) : null;

  const passwordRules = [
    { label: '8+ karakter', met: password.length >= 8 },
    { label: 'Büyük harf', met: /[A-Z]/.test(password) },
    { label: 'Küçük harf', met: /[a-z]/.test(password) },
    { label: 'Rakam', met: /\d/.test(password) },
  ];

  // Check username availability
  useEffect(() => {
    if (!username || username.length < 3 || errors.username) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const response = await api.get<{ available: boolean }>(
          `/auth/check-username?username=${encodeURIComponent(username)}`,
          false
        );
        setUsernameAvailable(response.available);
      } catch (error) {
        console.error('Username check failed:', error);
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [username, errors.username]);

  // Check email availability
  useEffect(() => {
    if (!email || !email.includes('@') || errors.email) {
      setEmailAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const response = await api.get<{ available: boolean }>(
          `/auth/check-email?email=${encodeURIComponent(email)}`,
          false
        );
        setEmailAvailable(response.available);
      } catch (error) {
        console.error('Email check failed:', error);
        setEmailAvailable(null);
      } finally {
        setCheckingEmail(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [email, errors.email]);

  useEffect(() => {
    setCurrentStep(1);
  }, []);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(auth)/signup');
    }
  };

  const onSubmit = async (formData: IdentityInput) => {
    if (usernameAvailable === false) {
      Alert.alert('Hata', 'Bu kullanıcı adı zaten kullanılıyor.');
      return;
    }

    if (emailAvailable === false) {
      Alert.alert('Hata', 'Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.');
      return;
    }

    await updateData({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      username: formData.username.trim(),
      email: formData.email.trim(),
      birthDate: formData.birthDate,
      password: formData.password,
    });

    completeStep(1);
    router.push('/(auth)/onboarding/period');
  };

  const canContinue =
    isValid && usernameAvailable !== false && emailAvailable !== false;

  const styles = createStyles(theme);

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
          {/* Top Navigation & Progress */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={handleGoBack}
              style={styles.backIconButton}
              activeOpacity={0.75}
              accessibilityLabel="Geri dön"
            >
              <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
            </TouchableOpacity>

            <View style={styles.stepPill}>
              <Text style={styles.stepPillText}>ADIM 1 / {TOTAL_STEPS}</Text>
            </View>

            <View style={styles.topSpacer} />
          </View>

          <View style={styles.progressTrack}>
            <LinearGradient
              colors={['#EC4899', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.progressFill,
                { width: `${(1 / TOTAL_STEPS) * 100}%` },
              ]}
            />
          </View>

          {/* Compact Gradient Hero Header */}
          <LinearGradient
            colors={
              theme.isDark ? ['#2A1836', '#1B1429'] : ['#FFF0F7', '#F5EEFF']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroIconWrap}>
              <Ionicons
                name="person-add-outline"
                size={22}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroTitle}>Profilini Oluşturalım</Text>
              <Text style={styles.heroSubtitle}>
                Kişiselleştirilmiş döngü ve wellness deneyimin için temel
                bilgilerini gir.
              </Text>
            </View>
          </LinearGradient>

          {/* Card 1: Personal Info */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: 'rgba(236, 72, 153, 0.14)' }]}>
                <Ionicons name="person-outline" size={16} color="#EC4899" />
              </View>
              <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
            </View>

            {/* First & Last Name Row */}
            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Ad</Text>
                <Controller
                  control={control}
                  name="firstName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View
                      style={[
                        styles.inputShell,
                        focusedField === 'firstName' && styles.inputShellFocused,
                        errors.firstName && styles.inputShellError,
                      ]}
                    >
                      <TextInput
                        style={styles.input}
                        placeholder="Adın"
                        placeholderTextColor={theme.colors.textLight}
                        value={value}
                        onChangeText={onChange}
                        onFocus={() => setFocusedField('firstName')}
                        onBlur={() => {
                          setFocusedField(null);
                          onBlur();
                        }}
                        returnKeyType="next"
                        onSubmitEditing={() => lastNameRef.current?.focus()}
                      />
                    </View>
                  )}
                />
                {errors.firstName && (
                  <Text style={styles.errorText}>{errors.firstName.message}</Text>
                )}
              </View>

              <View style={styles.halfField}>
                <Text style={styles.label}>Soyad</Text>
                <Controller
                  control={control}
                  name="lastName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View
                      style={[
                        styles.inputShell,
                        focusedField === 'lastName' && styles.inputShellFocused,
                        errors.lastName && styles.inputShellError,
                      ]}
                    >
                      <TextInput
                        ref={lastNameRef}
                        style={styles.input}
                        placeholder="Soyadın"
                        placeholderTextColor={theme.colors.textLight}
                        value={value}
                        onChangeText={onChange}
                        onFocus={() => setFocusedField('lastName')}
                        onBlur={() => {
                          setFocusedField(null);
                          onBlur();
                        }}
                        returnKeyType="next"
                        onSubmitEditing={() => usernameRef.current?.focus()}
                      />
                    </View>
                  )}
                />
                {errors.lastName && (
                  <Text style={styles.errorText}>{errors.lastName.message}</Text>
                )}
              </View>
            </View>

            {/* Birth Date */}
            <View style={styles.fieldGroupLast}>
              <Text style={styles.label}>Doğum Tarihi</Text>
              <Controller
                control={control}
                name="birthDate"
                render={({ field: { onChange, value } }) => {
                  const dateObj =
                    value instanceof Date
                      ? value
                      : value
                      ? new Date(value)
                      : null;
                  const hasValidDate =
                    dateObj && !Number.isNaN(dateObj.getTime());

                  return (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.dateShell,
                          hasValidDate && styles.dateShellActive,
                          errors.birthDate && styles.inputShellError,
                        ]}
                        onPress={() => {
                          setTempBirthDate(dateObj || DEFAULT_PICKER_DATE);
                          setShowDatePicker((prev) =>
                            Platform.OS === 'ios' ? !prev : true
                          );
                        }}
                      >
                        <View style={styles.dateLeft}>
                          <View style={styles.dateIconBox}>
                            <Ionicons
                              name="calendar-outline"
                              size={18}
                              color={
                                hasValidDate
                                  ? theme.colors.primary
                                  : theme.colors.textSecondary
                              }
                            />
                          </View>
                          <View>
                            <Text
                              style={
                                hasValidDate
                                  ? styles.dateValueText
                                  : styles.datePlaceholder
                              }
                            >
                              {hasValidDate
                                ? dateObj.toLocaleDateString('tr-TR', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })
                                : 'Doğum tarihini seç'}
                            </Text>
                            {hasValidDate && (
                              <Text style={styles.ageSubtext}>
                                {getAgeFromDate(dateObj)} yaş
                              </Text>
                            )}
                          </View>
                        </View>

                        <View style={styles.dateActionPill}>
                          <Text style={styles.dateActionText}>
                            {hasValidDate ? 'Değiştir' : 'Seç'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {showDatePicker && (
                        <View style={styles.datePickerContainer}>
                          <DateTimePicker
                            value={
                              tempBirthDate || dateObj || DEFAULT_PICKER_DATE
                            }
                            mode="date"
                            display={
                              Platform.OS === 'ios' ? 'spinner' : 'default'
                            }
                            themeVariant={theme.isDark ? 'dark' : 'light'}
                            textColor={theme.colors.text}
                            accentColor={theme.colors.primary}
                            locale="tr-TR"
                            maximumDate={new Date()}
                            onChange={(_event, selectedDate) => {
                              if (Platform.OS === 'android') {
                                setShowDatePicker(false);
                                if (selectedDate) {
                                  onChange(
                                    new Date(
                                      selectedDate.getFullYear(),
                                      selectedDate.getMonth(),
                                      selectedDate.getDate(),
                                      12,
                                      0,
                                      0
                                    )
                                  );
                                }
                              } else if (selectedDate) {
                                setTempBirthDate(
                                  new Date(
                                    selectedDate.getFullYear(),
                                    selectedDate.getMonth(),
                                    selectedDate.getDate(),
                                    12,
                                    0,
                                    0
                                  )
                                );
                              }
                            }}
                          />
                          {Platform.OS === 'ios' && (
                            <View style={styles.datePickerButtons}>
                              <TouchableOpacity
                                style={[
                                  styles.datePickerButton,
                                  styles.datePickerButtonCancel,
                                ]}
                                onPress={() => {
                                  setShowDatePicker(false);
                                  setTempBirthDate(null);
                                }}
                              >
                                <Text style={styles.datePickerButtonTextCancel}>
                                  İptal
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.datePickerButton,
                                  styles.datePickerButtonSave,
                                ]}
                                onPress={() => {
                                  if (tempBirthDate) {
                                    onChange(tempBirthDate);
                                  }
                                  setShowDatePicker(false);
                                }}
                              >
                                <Text style={styles.datePickerButtonTextSave}>
                                  Kaydet
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  );
                }}
              />
              {errors.birthDate && (
                <Text style={styles.errorText}>{errors.birthDate.message}</Text>
              )}
            </View>
          </View>

          {/* Card 2: Account & Security */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: 'rgba(139, 92, 246, 0.14)' }]}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={16}
                  color="#8B5CF6"
                />
              </View>
              <Text style={styles.sectionTitle}>Hesap & Güvenlik</Text>
            </View>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Kullanıcı Adı</Text>
              <Controller
                control={control}
                name="username"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    style={[
                      styles.inputShell,
                      focusedField === 'username' && styles.inputShellFocused,
                      (errors.username || usernameAvailable === false) &&
                        styles.inputShellError,
                    ]}
                  >
                    <Text style={styles.prefixAt}>@</Text>
                    <TextInput
                      ref={usernameRef}
                      style={styles.input}
                      placeholder="kullaniciadi"
                      placeholderTextColor={theme.colors.textLight}
                      value={value}
                      onChangeText={onChange}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => {
                        setFocusedField(null);
                        onBlur();
                      }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                    {checkingUsername && (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                      />
                    )}
                    {!checkingUsername && usernameAvailable === true && (
                      <View style={styles.statusPillOk}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color={theme.colors.success}
                        />
                        <Text style={styles.statusTextOk}>Müsait</Text>
                      </View>
                    )}
                    {!checkingUsername && usernameAvailable === false && (
                      <View style={styles.statusPillErr}>
                        <Ionicons
                          name="close-circle"
                          size={14}
                          color={theme.colors.error}
                        />
                        <Text style={styles.statusTextErr}>Alınmış</Text>
                      </View>
                    )}
                  </View>
                )}
              />
              {errors.username && (
                <Text style={styles.errorText}>{errors.username.message}</Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>E-posta</Text>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    style={[
                      styles.inputShell,
                      focusedField === 'email' && styles.inputShellFocused,
                      (errors.email || emailAvailable === false) &&
                        styles.inputShellError,
                    ]}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={
                        focusedField === 'email'
                          ? theme.colors.primary
                          : theme.colors.textLight
                      }
                    />
                    <TextInput
                      ref={emailRef}
                      style={styles.input}
                      placeholder="ornek@email.com"
                      placeholderTextColor={theme.colors.textLight}
                      value={value}
                      onChangeText={onChange}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => {
                        setFocusedField(null);
                        onBlur();
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => passwordRef.current?.focus()}
                    />
                    {checkingEmail && (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                      />
                    )}
                    {!checkingEmail && emailAvailable === true && (
                      <View style={styles.statusPillOk}>
                        <Ionicons
                          name="checkmark-circle"
                          size={14}
                          color={theme.colors.success}
                        />
                        <Text style={styles.statusTextOk}>Müsait</Text>
                      </View>
                    )}
                    {!checkingEmail && emailAvailable === false && (
                      <View style={styles.statusPillErr}>
                        <Ionicons
                          name="close-circle"
                          size={14}
                          color={theme.colors.error}
                        />
                        <Text style={styles.statusTextErr}>Kayıtlı</Text>
                      </View>
                    )}
                  </View>
                )}
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email.message}</Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.fieldGroupLast}>
              <Text style={styles.label}>Şifre</Text>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View
                    style={[
                      styles.inputShell,
                      focusedField === 'password' && styles.inputShellFocused,
                      errors.password && styles.inputShellError,
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
                      placeholder="En az 8 karakter"
                      placeholderTextColor={theme.colors.textLight}
                      value={value}
                      onChangeText={onChange}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => {
                        setFocusedField(null);
                        onBlur();
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((prev) => !prev)}
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
                )}
              />

              {passwordStrength && (
                <View style={styles.strengthRow}>
                  <View style={styles.strengthBar}>
                    <View
                      style={[
                        styles.strengthFill,
                        {
                          width: `${(passwordStrength.score / 6) * 100}%`,
                          backgroundColor: passwordStrength.color,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.strengthLabel,
                      { color: passwordStrength.color },
                    ]}
                  >
                    {passwordStrength.label}
                  </Text>
                </View>
              )}

              <View style={styles.rulesWrap}>
                {passwordRules.map((rule) => (
                  <View
                    key={rule.label}
                    style={[
                      styles.ruleChip,
                      rule.met && styles.ruleChipMet,
                    ]}
                  >
                    <Ionicons
                      name={
                        rule.met ? 'checkmark-circle' : 'ellipse-outline'
                      }
                      size={13}
                      color={
                        rule.met
                          ? theme.colors.success
                          : theme.colors.textLight
                      }
                    />
                    <Text
                      style={[
                        styles.ruleChipText,
                        rule.met && styles.ruleChipTextMet,
                      ]}
                    >
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>

              {errors.password && (
                <Text style={styles.errorText}>{errors.password.message}</Text>
              )}
            </View>
          </View>

          {/* Bottom CTA */}
          <View style={styles.ctaSection}>
            <TouchableOpacity
              onPress={handleSubmit(onSubmit)}
              disabled={!canContinue}
              activeOpacity={0.88}
              style={[styles.ctaWrap, !canContinue && styles.ctaWrapDisabled]}
            >
              <LinearGradient
                colors={
                  canContinue
                    ? ['#EC4899', '#9333EA']
                    : theme.isDark
                    ? ['#2B2B30', '#2B2B30']
                    : ['#E5E7EB', '#E5E7EB']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                <Text
                  style={[
                    styles.ctaText,
                    !canContinue && styles.ctaTextDisabled,
                  ]}
                >
                  Devam Et
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={canContinue ? '#FFFFFF' : theme.colors.textLight}
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 24,
      gap: 14,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backIconButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    stepPillText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: theme.colors.primary,
    },
    topSpacer: {
      width: 40,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.isDark ? '#27272A' : '#FCE7F3',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    heroIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: theme.colors.backgroundCard,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    heroTextCol: {
      flex: 1,
      gap: 3,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.2,
    },
    heroSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    sectionCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    sectionDot: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    rowFields: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },
    halfField: {
      flex: 1,
    },
    fieldGroup: {
      marginBottom: 14,
    },
    fieldGroupLast: {
      marginBottom: 2,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 6,
    },
    inputShell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: theme.isDark ? '#121215' : '#F9FAFB',
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: 15,
      paddingHorizontal: 13,
      minHeight: 50,
    },
    inputShellFocused: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.backgroundCard,
    },
    inputShellError: {
      borderColor: theme.colors.error,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
      paddingVertical: 11,
    },
    prefixAt: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    eyeButton: {
      padding: 2,
    },
    statusPillOk: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    statusTextOk: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.success,
    },
    statusPillErr: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    statusTextErr: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.error,
    },
    dateShell: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.isDark ? '#121215' : '#F9FAFB',
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: 15,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 56,
    },
    dateShellActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.backgroundCard,
    },
    dateLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    dateIconBox: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: theme.isDark
        ? 'rgba(255, 105, 180, 0.14)'
        : 'rgba(236, 72, 153, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateValueText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
    },
    datePlaceholder: {
      fontSize: 15,
      color: theme.colors.textLight,
    },
    ageSubtext: {
      fontSize: 12,
      color: theme.colors.primary,
      fontWeight: '600',
      marginTop: 1,
    },
    dateActionPill: {
      backgroundColor: theme.isDark ? '#27272A' : '#FCE7F3',
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 10,
    },
    dateActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    datePickerContainer: {
      marginTop: 10,
      backgroundColor: theme.isDark ? '#121215' : '#F9FAFB',
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 16,
      padding: 8,
      overflow: 'hidden',
    },
    datePickerButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
      paddingHorizontal: 4,
    },
    datePickerButton: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 12,
      alignItems: 'center',
    },
    datePickerButtonCancel: {
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    datePickerButtonSave: {
      backgroundColor: theme.colors.primary,
    },
    datePickerButtonTextCancel: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    datePickerButtonTextSave: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    strengthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 10,
    },
    strengthBar: {
      flex: 1,
      height: 5,
      backgroundColor: theme.isDark ? '#27272A' : '#E5E7EB',
      borderRadius: 3,
      overflow: 'hidden',
    },
    strengthFill: {
      height: '100%',
      borderRadius: 3,
    },
    strengthLabel: {
      fontSize: 12,
      fontWeight: '700',
    },
    rulesWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
    },
    ruleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      backgroundColor: theme.isDark ? '#121215' : '#F3F4F6',
    },
    ruleChipMet: {
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
    },
    ruleChipText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    ruleChipTextMet: {
      color: theme.colors.success,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.error,
      marginTop: 5,
      fontWeight: '500',
    },
    ctaSection: {
      marginTop: 4,
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
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    ctaText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    ctaTextDisabled: {
      color: theme.colors.textLight,
    },
  });
