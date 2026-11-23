import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { userService } from '@/services/api';
import { useTheme } from '@/hooks/useTheme';
import { PremiumBadge } from '@/components/premium/PremiumBadge';
import { usePremium } from '@/hooks/usePremium';
import {
  getZodiacSign,
  parseBirthDateSafe,
  toBirthDateIsoNoon,
  ZODIAC_SIGNS,
} from '@/utils/astrology';
import {
  MASCOT_AVATARS,
  getMascotAvatarUrl,
  getMatchingMascotId,
  resolveAvatarSource,
  type MascotAvatarPreset,
} from '@/utils/avatar';

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const theme = useTheme();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [heightCm, setHeightCm] = useState(165);
  const [weightKg, setWeightKg] = useState(60);
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);
  const [savingAvatarId, setSavingAvatarId] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const { isPremium } = usePremium();

  const { data: userData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => userService.getMe(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (userData) {
      const data = userData as any;
      setFirstName(data?.profile?.firstName || '');
      setLastName(data?.profile?.lastName || '');
      setUsername(data?.username || '');
      setEmail(data?.email || '');
      if (data?.profile?.dateOfBirth) {
        setBirthDate(parseBirthDateSafe(data.profile.dateOfBirth));
      }
      setHeightCm(data?.profile?.heightCm || 165);
      setWeightKg(data?.profile?.weightKg || 60);
      setProfilePictureUri(data?.profile?.profilePictureUrl || null);
    }
  }, [userData]);

  useEffect(() => {
    const currentUsername = (userData as any)?.username;
    if (
      !username ||
      username.toLowerCase() === currentUsername?.toLowerCase() ||
      username.length < 3
    ) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const response = await userService.checkUsernameAvailability(username.toLowerCase());
        setUsernameAvailable((response as any).available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username, userData]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => userService.updateMe(data),
    onSuccess: async (updatedData) => {
      queryClient.setQueryData(['me'], updatedData);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });

      if (user && updatedData) {
        const updatedUser = {
          ...user,
          email: (updatedData as any).email,
          username: (updatedData as any).username,
          profile: (updatedData as any).profile,
        };
        useAuthStore.setState({ user: updatedUser });
        await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
      }
      Alert.alert('Başarılı', 'Profiliniz güncellendi');
      router.back();
    },
    onError: (error: any) => {
      Alert.alert('Hata', error.message || 'Profil güncellenemedi');
    },
  });

  const handleUploadAsset = async (localUri: string) => {
    setProfilePictureUri(localUri);
    try {
      const response = await userService.uploadProfilePicture(localUri);
      setProfilePictureUri(response.profilePictureUrl);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });

      if (user && user.profile) {
        const updatedUser = {
          ...user,
          profile: { ...user.profile, profilePictureUrl: response.profilePictureUrl },
        };
        useAuthStore.setState({ user: updatedUser });
        await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
      }
      Alert.alert('Başarılı', 'Profil fotoğrafı güncellendi');
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Fotoğraf yüklenemedi');
      setProfilePictureUri((userData as any)?.profile?.profilePictureUrl || null);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('İzin Gerekli', 'Galeri erişim izni gerekiyor');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handleUploadAsset(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('İzin Gerekli', 'Kamera erişim izni gerekiyor');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handleUploadAsset(result.assets[0].uri);
    }
  };

  const deleteProfilePicture = () => {
    Alert.alert('Profil Fotoğrafını Sil', 'Profil fotoğrafınızı silmek istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await userService.updateMe({ profilePictureUrl: null });
            setProfilePictureUri(null);
            await queryClient.invalidateQueries({ queryKey: ['me'] });
            await queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });

            if (user && user.profile) {
              const updatedUser = {
                ...user,
                profile: { ...user.profile, profilePictureUrl: undefined },
              };
              useAuthStore.setState({ user: updatedUser });
              await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
            }
            Alert.alert('Başarılı', 'Profil fotoğrafı silindi');
          } catch (error: any) {
            Alert.alert('Hata', error.message || 'Fotoğraf silinemedi');
          }
        },
      },
    ]);
  };

  const handleProfilePicturePress = () => {
    Alert.alert('Profil Fotoğrafı', 'Nasıl güncellemek istersiniz?', [
      { text: 'Galeriden Seç', onPress: pickImage },
      { text: 'Fotoğraf Çek', onPress: takePhoto },
      ...(profilePictureUri
        ? [{ text: 'Fotoğrafı Sil', onPress: deleteProfilePicture, style: 'destructive' as const }]
        : []),
      { text: 'İptal', style: 'cancel' },
    ]);
  };

  const handleSelectMascotAvatar = async (preset: MascotAvatarPreset) => {
    if (savingAvatarId) return;
    const previousUri = profilePictureUri;
    const nextUrl = getMascotAvatarUrl(preset);

    setSavingAvatarId(preset.id);
    setProfilePictureUri(nextUrl);
    try {
      const updatedData = await userService.updateMe({ profilePictureUrl: nextUrl });
      const resolvedUrl =
        (updatedData as any)?.profile?.profilePictureUrl || nextUrl;

      setProfilePictureUri(resolvedUrl);
      if (updatedData) {
        queryClient.setQueryData(['me'], updatedData);
      }
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });

      if (user) {
        const updatedUser = {
          ...user,
          profile: (updatedData as any)?.profile || {
            ...(user.profile || {}),
            profilePictureUrl: resolvedUrl,
          },
        };
        useAuthStore.setState({ user: updatedUser });
        await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
      }
    } catch (error: any) {
      setProfilePictureUri(previousUri);
      Alert.alert('Hata', error?.message || 'Maskot avatarı kaydedilemedi');
    } finally {
      setSavingAvatarId(null);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const currentUsername = (userData as any)?.username;
      if (username && username.toLowerCase() !== currentUsername?.toLowerCase()) {
        if (usernameAvailable === false) {
          Alert.alert('Hata', 'Bu kullanıcı adı zaten kullanılıyor');
          return;
        }

        const normalizedUsername = username.toLowerCase();
        if (!/^[a-z0-9._]+$/.test(normalizedUsername)) {
          Alert.alert(
            'Hata',
            'Kullanıcı adı sadece küçük harf, rakam, nokta ve alt çizgi içerebilir'
          );
          return;
        }
        if (normalizedUsername.length < 3 || normalizedUsername.length > 24) {
          Alert.alert('Hata', 'Kullanıcı adı 3-24 karakter arasında olmalıdır');
          return;
        }

        const usernameResponse = await userService.updateUsername(normalizedUsername);
        queryClient.setQueryData(['me'], usernameResponse);
        await queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] });

        if (user) {
          const updatedUser = {
            ...user,
            username: (usernameResponse as any).username,
            profile: (usernameResponse as any).profile,
          };
          useAuthStore.setState({ user: updatedUser });
          await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
        }
      }

      updateProfileMutation.mutate({
        firstName,
        lastName,
        email,
        dateOfBirth: birthDate ? toBirthDateIsoNoon(birthDate) : null,
        heightCm,
        weightKg,
      });
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Profil güncellenemedi');
    }
  };

  const liveMetrics = useMemo(() => {
    const h = heightCm / 100;
    const bmi = h > 0 ? weightKg / (h * h) : 0;
    const bmiLabel =
      bmi < 18.5
        ? 'Zayıf'
        : bmi < 25
          ? 'Normal'
          : bmi < 30
            ? 'Fazla Kilolu'
            : 'Yüksek';
    const waterTargetMl = Math.round(weightKg * 30);
    const zodiac = birthDate ? ZODIAC_SIGNS[getZodiacSign(birthDate)] : null;
    return { bmi: bmi.toFixed(1), bmiLabel, waterTargetMl, zodiac };
  }, [heightCm, weightKg, birthDate]);

  const currentDisplayName =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : (userData as any)?.profile?.displayName || user?.email?.split('@')[0] || 'Misafir';

  const styles = createStyles(theme);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profili Düzenle</Text>
        <TouchableOpacity
          onPress={handleSaveProfile}
          style={[
            styles.savePill,
            (updateProfileMutation.isPending || usernameAvailable === false || checkingUsername) &&
              styles.savePillDisabled,
          ]}
          disabled={
            updateProfileMutation.isPending || usernameAvailable === false || checkingUsername
          }
          activeOpacity={0.85}
        >
          {updateProfileMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.savePillText}>Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Section */}
        <View style={styles.avatarCard}>
          <TouchableOpacity
            onPress={handleProfilePicturePress}
            style={styles.avatarContainer}
            activeOpacity={0.85}
          >
            {profilePictureUri ? (
              <Image
                source={resolveAvatarSource(profilePictureUri)!}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profilePlaceholderText}>
                  {currentDisplayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraOverlay}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
            {isPremium && (
              <View style={styles.premiumBadgeOverlay}>
                <PremiumBadge size="small" variant="icon" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.avatarNameRow}>
            <Text style={styles.avatarName}>{currentDisplayName}</Text>
            {isPremium && <PremiumBadge size="small" variant="icon" />}
          </View>

          <View style={styles.photoActionsRow}>
            <TouchableOpacity
              onPress={pickImage}
              style={styles.photoActionPill}
              activeOpacity={0.8}
            >
              <Ionicons name="images-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.photoActionText}>Galeriden Seç</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={takePhoto}
              style={styles.photoActionPill}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={14} color={theme.colors.primary} />
              <Text style={styles.photoActionText}>Fotoğraf Çek</Text>
            </TouchableOpacity>

            {profilePictureUri ? (
              <TouchableOpacity
                onPress={deleteProfilePicture}
                style={[styles.photoActionPill, styles.photoRemovePill]}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={14} color={theme.colors.error} />
                <Text style={styles.photoRemoveText}>Kaldır</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Mascot Avatar Presets */}
        <View style={styles.formCard}>
          <View style={styles.mascotHeaderRow}>
            <View>
              <Text style={styles.cardSectionTitle}>Maskot Avatarları</Text>
              <Text style={styles.mascotSubtitle}>
                Fotoğraf yüklemek istemezsen 6 maskotumuzdan birini seç
              </Text>
            </View>
          </View>

          <View style={styles.mascotGrid}>
            {MASCOT_AVATARS.map((preset) => {
              const selected = getMatchingMascotId(profilePictureUri) === preset.id;
              const isSaving = savingAvatarId === preset.id;

              return (
                <TouchableOpacity
                  key={preset.id}
                  activeOpacity={0.82}
                  disabled={Boolean(savingAvatarId)}
                  onPress={() => handleSelectMascotAvatar(preset)}
                  style={[
                    styles.mascotTile,
                    selected && {
                      borderColor: preset.accent,
                      backgroundColor: theme.isDark
                        ? 'rgba(255, 105, 180, 0.1)'
                        : '#FFF5F9',
                    },
                  ]}
                >
                  <View style={styles.mascotAvatarWrap}>
                    <Image source={preset.source} style={styles.mascotAvatarImg} />
                    {isSaving ? (
                      <View style={styles.mascotLoadingOverlay}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    ) : selected ? (
                      <View
                        style={[
                          styles.mascotCheckBadge,
                          { backgroundColor: preset.accent },
                        ]}
                      >
                        <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.mascotLabel,
                      selected && { color: preset.accent, fontWeight: '800' },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Live Health & Zodiac Preview */}
        <View style={styles.previewStrip}>
          <View style={styles.previewTile}>
            <Text style={styles.previewValue}>{liveMetrics.bmi}</Text>
            <Text style={styles.previewLabel}>VKİ ({liveMetrics.bmiLabel})</Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewTile}>
            <Text style={styles.previewValue}>{liveMetrics.waterTargetMl} ml</Text>
            <Text style={styles.previewLabel}>Önerilen Su</Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewTile}>
            <Text style={styles.previewValue}>
              {liveMetrics.zodiac
                ? `${liveMetrics.zodiac.emoji} ${liveMetrics.zodiac.nameTr}`
                : '—'}
            </Text>
            <Text style={styles.previewLabel}>Burç</Text>
          </View>
        </View>

        {/* Personal Info Card */}
        <View style={styles.formCard}>
          <Text style={styles.cardSectionTitle}>Kişisel Bilgiler</Text>

          <View style={styles.nameRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Ad</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Adınız"
                placeholderTextColor={theme.colors.textLight}
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Soyad</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Soyadınız"
                placeholderTextColor={theme.colors.textLight}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Kullanıcı Adı</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="kullaniciadi"
              placeholderTextColor={theme.colors.textLight}
              autoCapitalize="none"
            />
            {username &&
              username.toLowerCase() !== (userData as any)?.username?.toLowerCase() && (
                <View style={styles.usernameStatus}>
                  {checkingUsername && (
                    <Text style={styles.helperText}>Kontrol ediliyor...</Text>
                  )}
                  {!checkingUsername && usernameAvailable === true && (
                    <View style={styles.statusInline}>
                      <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
                      <Text style={styles.successText}>Kullanılabilir</Text>
                    </View>
                  )}
                  {!checkingUsername && usernameAvailable === false && (
                    <View style={styles.statusInline}>
                      <Ionicons name="close-circle" size={14} color={theme.colors.error} />
                      <Text style={styles.errorText}>Bu kullanıcı adı alınmış</Text>
                    </View>
                  )}
                </View>
              )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="E-posta adresiniz"
              placeholderTextColor={theme.colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Doğum Tarihi</Text>
            <DatePickerButton value={birthDate} onChange={setBirthDate} theme={theme} />
          </View>
        </View>

        {/* Body Measurements Card */}
        <View style={styles.formCard}>
          <Text style={styles.cardSectionTitle}>Vücut Ölçüleri</Text>
          <View style={styles.nameRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Boy (cm)</Text>
              <NumberPickerButton
                value={heightCm}
                onChange={setHeightCm}
                min={100}
                max={250}
                unit="cm"
                label="Boy Seçin"
                theme={theme}
              />
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Kilo (kg)</Text>
              <NumberPickerButton
                value={weightKg}
                onChange={setWeightKg}
                min={30}
                max={200}
                unit="kg"
                label="Kilo Seçin"
                theme={theme}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DatePickerButton({
  value,
  onChange,
  theme,
}: {
  value: Date | null;
  onChange: (date: Date) => void;
  theme: any;
}) {
  const { isDarkMode } = useThemeStore();
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value || new Date(2000, 0, 1, 12, 0, 0));

  useEffect(() => {
    if (value) setTempDate(new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0));
  }, [value]);

  const displayText = value
    ? value.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Doğum tarihi seçin';

  const styles = createPickerStyles(theme);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selectedDate) {
        onChange(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 12, 0, 0));
      }
    } else if (selectedDate) {
      setTempDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 12, 0, 0));
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.pickerButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.pickerButtonText}>{displayText}</Text>
        <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
      </TouchableOpacity>

      {Platform.OS === 'ios' && showPicker && (
        <Modal visible={showPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.backdrop}
              activeOpacity={1}
              onPress={() => setShowPicker(false)}
            />
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.cancelText}>İptal</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Doğum Tarihi</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(tempDate);
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.confirmText}>Tamam</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.datePickerWrapper}>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="inline"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  minimumDate={new Date(1900, 0, 1)}
                  locale="tr-TR"
                  themeVariant={isDarkMode ? 'dark' : 'light'}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="calendar"
          onChange={handleDateChange}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
        />
      )}
    </>
  );
}

function NumberPickerButton({
  value,
  onChange,
  min,
  max,
  unit,
  label,
  theme,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit: string;
  label: string;
  theme: any;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value);

  useEffect(() => {
    setSelectedValue(value);
  }, [value]);

  const numbers = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const styles = createPickerStyles(theme);

  return (
    <>
      <TouchableOpacity style={styles.pickerButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.pickerButtonText}>
          {value} {unit}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.colors.textLight} />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
          />
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>{label}</Text>
              <TouchableOpacity
                onPress={() => {
                  onChange(selectedValue);
                  setShowPicker(false);
                }}
              >
                <Text style={styles.confirmText}>Tamam</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.numberPickerScroll}>
              {numbers.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.numberOption,
                    selectedValue === num && styles.numberOptionSelected,
                  ]}
                  onPress={() => setSelectedValue(num)}
                >
                  <Text
                    style={[
                      styles.numberOptionText,
                      selectedValue === num && styles.numberOptionTextSelected,
                    ]}
                  >
                    {num} {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: theme.colors.text,
    },
    savePill: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 18,
      minWidth: 74,
      alignItems: 'center',
    },
    savePillDisabled: {
      opacity: 0.5,
    },
    savePillText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      gap: 14,
    },
    avatarCard: {
      alignItems: 'center',
      paddingVertical: 14,
      gap: 6,
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: 4,
    },
    profileImage: {
      width: 92,
      height: 92,
      borderRadius: 46,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    profilePlaceholder: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: theme.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    profilePlaceholderText: {
      fontSize: 36,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    cameraOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.primary,
      borderWidth: 2,
      borderColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    premiumBadgeOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
    },
    avatarName: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
    },
    avatarNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 12,
    },
    changePhotoText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    photoActionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      marginTop: 4,
    },
    photoActionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 14,
    },
    photoActionText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    photoRemovePill: {
      borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    photoRemoveText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.error,
    },
    mascotHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    mascotSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    mascotGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 10,
    },
    mascotTile: {
      width: '31%',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.background,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      gap: 6,
    },
    mascotAvatarWrap: {
      position: 'relative',
      width: 58,
      height: 58,
    },
    mascotAvatarImg: {
      width: 58,
      height: 58,
      borderRadius: 29,
    },
    mascotLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 29,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    mascotCheckBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.colors.backgroundCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mascotLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
    },
    previewStrip: {
      flexDirection: 'row',
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    previewTile: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    previewDivider: {
      width: 1,
      height: 26,
      backgroundColor: theme.colors.border,
    },
    previewValue: {
      fontSize: 14.5,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    previewLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    formCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 12,
    },
    cardSectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    nameRow: {
      flexDirection: 'row',
      gap: 10,
    },
    formGroup: {
      gap: 6,
    },
    label: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    input: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 15,
      color: theme.colors.text,
    },
    usernameStatus: {
      marginTop: 2,
    },
    statusInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    helperText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    successText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.success,
    },
    errorText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.error,
    },
  });

const createPickerStyles = (theme: any) =>
  StyleSheet.create({
    pickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    pickerButtonText: {
      fontSize: 14.5,
      color: theme.colors.text,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backdrop: {
      flex: 1,
    },
    pickerContainer: {
      backgroundColor: theme.colors.backgroundCard,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 28,
      maxHeight: '65%',
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    pickerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
    },
    cancelText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
    },
    confirmText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    datePickerWrapper: {
      padding: 12,
    },
    numberPickerScroll: {
      paddingHorizontal: 16,
    },
    numberOption: {
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderRadius: 12,
      marginVertical: 2,
      alignItems: 'center',
    },
    numberOptionSelected: {
      backgroundColor: theme.colors.backgroundSecondary,
    },
    numberOptionText: {
      fontSize: 16,
      color: theme.colors.text,
    },
    numberOptionTextSelected: {
      fontWeight: '800',
      color: theme.colors.primary,
    },
  });
