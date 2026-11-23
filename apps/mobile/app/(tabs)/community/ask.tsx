import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { usePremium } from '@/hooks/usePremium';
import { useCreateQuestion, useQnaQuota } from '@/hooks/useQna';
import { useQnaStore } from '@/store/qnaStore';
import { QuestionCategory } from '@/types/qna';
import { api, qnaService } from '@/services/api';

interface CommunitySettings {
  allowNewQuestions: boolean;
  freeMonthlyQuestionLimit: number;
  premiumMonthlyQuestionLimit: number;
  dailyQuestionLimit: number;
  titleMinLength: number;
  titleMaxLength: number;
  contentMinLength: number;
  contentMaxLength: number;
  maxTags: number;
  allowAnonymous: boolean;
  enabledCategories: QuestionCategory[];
  pointsPerQuestion: number;
  xpPerReputationPoint: number;
  askPageBannerTitle: string;
  askPageBannerSubtitle: string;
}

const DEFAULT_SETTINGS: CommunitySettings = {
  allowNewQuestions: true,
  freeMonthlyQuestionLimit: 5,
  premiumMonthlyQuestionLimit: 20,
  dailyQuestionLimit: 3,
  titleMinLength: 10,
  titleMaxLength: 200,
  contentMinLength: 20,
  contentMaxLength: 3000,
  maxTags: 5,
  allowAnonymous: true,
  enabledCategories: Object.values(QuestionCategory),
  pointsPerQuestion: 5,
  xpPerReputationPoint: 1,
  askPageBannerTitle: 'Topluluğa Sorunu Paylaş',
  askPageBannerSubtitle:
    'Deneyimlerini paylaş, uzmanlardan ve topluluktan destek al. İstersen tamamen anonim sorabilirsin.',
};

const CATEGORY_META: Record<
  QuestionCategory,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  [QuestionCategory.MENSTRUAL_HEALTH]: { label: 'Regl Sağlığı', icon: 'water-outline', color: '#E11D48' },
  [QuestionCategory.PREGNANCY]: { label: 'Hamilelik', icon: 'heart-outline', color: '#EC4899' },
  [QuestionCategory.FERTILITY]: { label: 'Doğurganlık', icon: 'flower-outline', color: '#DB2777' },
  [QuestionCategory.NUTRITION]: { label: 'Beslenme', icon: 'nutrition-outline', color: '#10B981' },
  [QuestionCategory.EXERCISE]: { label: 'Egzersiz', icon: 'barbell-outline', color: '#3B82F6' },
  [QuestionCategory.MENTAL_HEALTH]: { label: 'Ruh Sağlığı', icon: 'sparkles-outline', color: '#8B5CF6' },
  [QuestionCategory.SLEEP]: { label: 'Uyku', icon: 'moon-outline', color: '#6366F1' },
  [QuestionCategory.CONTRACEPTION]: { label: 'Doğum Kontrolü', icon: 'shield-checkmark-outline', color: '#0EA5E9' },
  [QuestionCategory.PMS]: { label: 'PMS', icon: 'pulse-outline', color: '#F59E0B' },
  [QuestionCategory.MENOPAUSE]: { label: 'Menopoz', icon: 'sunny-outline', color: '#F97316' },
  [QuestionCategory.SEXUAL_HEALTH]: { label: 'Cinsel Sağlık', icon: 'heart-half-outline', color: '#BE185D' },
  [QuestionCategory.GENERAL]: { label: 'Genel', icon: 'chatbubble-ellipses-outline', color: '#64748B' },
};

export default function AskQuestionScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  const { draftQuestion, setDraftQuestion, clearDraftQuestion } = useQnaStore();
  const createQuestionMutation = useCreateQuestion();
  const { data: quota, isLoading: quotaLoading } = useQnaQuota();

  const { data: remoteSettings } = useQuery<CommunitySettings>({
    queryKey: ['qna', 'settings'],
    queryFn: () => api.get<CommunitySettings>('/qna/settings'),
    staleTime: 60 * 1000,
  });

  const settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...(remoteSettings || {}) }),
    [remoteSettings],
  );

  const [title, setTitle] = useState(draftQuestion?.title || '');
  const [content, setContent] = useState(draftQuestion?.content || '');
  const [category, setCategory] = useState<QuestionCategory | undefined>(
    draftQuestion?.category,
  );
  const [tags, setTags] = useState<string[]>(draftQuestion?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const { isPremium } = usePremium();
  const maxImages = quota?.imageRemaining ?? (isPremium ? 5 : 2);
  const weeklyImageLimit = quota?.imageLimit ?? (isPremium ? 5 : 2);
  const [isAnonymous, setIsAnonymous] = useState(
    draftQuestion?.isAnonymous || false,
  );
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handlePickImage = async () => {
    if (selectedImages.length >= maxImages) {
      Alert.alert(
        'Haftalık Resim Limiti',
        isPremium
          ? `Bu hafta kalan resim ekleme hakkınız: ${maxImages}/${weeklyImageLimit}. Hafta sonunda sıfırlanır.`
          : `Ücretsiz üyeler haftada en fazla ${weeklyImageLimit} resim ekleyebilir (kalan: ${maxImages}). Hafta sonunda sıfırlanır veya Premium ile haftada 5 resim ekleyebilirsiniz.`,
      );
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin Gerekli', 'Resim seçebilmek için galeri izni vermelisiniz.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setSelectedImages((prev) => [...prev, result.assets[0].uri].slice(0, maxImages));
    }
  };

  const availableCategories = useMemo(
    () =>
      (Object.values(QuestionCategory) as QuestionCategory[]).filter((c) =>
        settings.enabledCategories.includes(c),
      ),
    [settings.enabledCategories],
  );

  const quotaLimit = quota?.limit || settings.freeMonthlyQuestionLimit;
  const quotaRemaining = quota?.remaining ?? quotaLimit;
  const quotaExceeded = quotaRemaining <= 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      if (title || content || category || tags.length > 0) {
        setDraftQuestion({ title, content, category, tags, isAnonymous });
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [title, content, category, tags, isAnonymous, setDraftQuestion]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (!trimmed) return;
    if (tags.length >= settings.maxTags) {
      Alert.alert('Etiket Limiti', `En fazla ${settings.maxTags} etiket ekleyebilirsiniz.`);
      return;
    }
    if (tags.includes(trimmed)) {
      setTagInput('');
      return;
    }
    setTags([...tags, trimmed]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    const tLen = title.trim().length;
    const cLen = content.trim().length;

    if (tLen < settings.titleMinLength) {
      nextErrors.title = `Başlık en az ${settings.titleMinLength} karakter olmalıdır`;
    } else if (tLen > settings.titleMaxLength) {
      nextErrors.title = `Başlık en fazla ${settings.titleMaxLength} karakter olabilir`;
    }

    if (!category) {
      nextErrors.category = 'Lütfen bir kategori seçin';
    }

    if (cLen < settings.contentMinLength) {
      nextErrors.content = `Açıklama en az ${settings.contentMinLength} karakter olmalıdır`;
    } else if (cLen > settings.contentMaxLength) {
      nextErrors.content = `Açıklama en fazla ${settings.contentMaxLength} karakter olabilir`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!settings.allowNewQuestions) {
      Alert.alert('Bilgi', 'Yeni soru paylaşımı geçici olarak durdurulmuştur.');
      return;
    }
    if (quotaExceeded) {
      Alert.alert('Soru Limitiniz Doldu', 'Bu ayki soru sorma hakkınızı kullandınız.');
      return;
    }
    if (!validateForm() || !category) return;

    try {
      let uploadedUrls: string[] | undefined;
      if (selectedImages.length > 0) {
        setIsUploadingImages(true);
        const results = await Promise.all(
          selectedImages.map((uri) => qnaService.uploadImage(uri)),
        );
        uploadedUrls = results.map((r) => r.imageUrl);
        setIsUploadingImages(false);
      }

      await createQuestionMutation.mutateAsync({
        title: title.trim(),
        content: content.trim(),
        category,
        tags,
        isAnonymous: settings.allowAnonymous ? isAnonymous : false,
        imageUrls: uploadedUrls,
      });

      clearDraftQuestion();
      Alert.alert('Yayınlandı', 'Sorunuz toplulukla paylaşıldı.');
      router.back();
    } catch (error: any) {
      setIsUploadingImages(false);
      Alert.alert(
        'Gönderilemedi',
        error?.response?.data?.message || error?.message || 'Soru paylaşılırken bir hata oluştu.',
      );
    }
  };

  const xpReward = Math.round(
    settings.pointsPerQuestion * settings.xpPerReputationPoint,
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Yeni Soru</Text>
          <TouchableOpacity
            style={[
              styles.publishPill,
              (createQuestionMutation.isPending ||
                !settings.allowNewQuestions ||
                quotaExceeded) &&
                styles.publishPillDisabled,
            ]}
            disabled={
              createQuestionMutation.isPending ||
              !settings.allowNewQuestions ||
              quotaExceeded
            }
            onPress={handleSubmit}
          >
            {createQuestionMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.publishPillText}>Paylaş</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Banner */}
          <LinearGradient
            colors={theme.isDark ? ['#5B21B6', '#9D174D'] : ['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Ionicons name="chatbubbles" size={14} color="#FFFFFF" />
                <Text style={styles.heroBadgeText}>Topluluk</Text>
              </View>
              {!quotaLoading && (
                <View style={styles.quotaPill}>
                  <Text style={styles.quotaPillText}>
                    Kalan Hak: {quotaRemaining}/{quotaLimit}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.heroTitle}>{settings.askPageBannerTitle}</Text>
            <Text style={styles.heroSubtitle}>{settings.askPageBannerSubtitle}</Text>
            {settings.pointsPerQuestion > 0 && (
              <View style={styles.rewardRow}>
                <Ionicons name="trophy-outline" size={13} color="#FDE68A" />
                <Text style={styles.rewardText}>
                  +{settings.pointsPerQuestion} Topluluk Puanı
                  {xpReward > 0 ? ` · +${xpReward} XP` : ''}
                </Text>
              </View>
            )}
          </LinearGradient>

          {!settings.allowNewQuestions && (
            <View style={styles.warningCard}>
              <Ionicons name="pause-circle-outline" size={20} color="#D97706" />
              <Text style={styles.warningText}>
                Yeni soru oluşturma şu an yönetici tarafından geçici olarak duraklatılmıştır.
              </Text>
            </View>
          )}

          {/* Category Picker */}
          <View style={styles.card}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Konu Kategorisi</Text>
              <Text style={styles.requiredMark}>Zorunlu</Text>
            </View>
            <View style={styles.categoryWrap}>
              {availableCategories.map((cat) => {
                const meta = CATEGORY_META[cat];
                const selected = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      selected && {
                        backgroundColor: meta.color,
                        borderColor: meta.color,
                      },
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      if (errors.category) {
                        setErrors({ ...errors, category: '' });
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={meta.icon}
                      size={14}
                      color={selected ? '#FFFFFF' : meta.color}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        selected && { color: '#FFFFFF' },
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errors.category ? (
              <Text style={styles.errorText}>{errors.category}</Text>
            ) : null}
          </View>

          {/* Title Input */}
          <View style={styles.card}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Konu Başlığı</Text>
              <Text style={styles.counterText}>
                {title.trim().length}/{settings.titleMaxLength}
              </Text>
            </View>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder={`Kısa ve net bir başlık yazın (min ${settings.titleMinLength} karakter)`}
              placeholderTextColor={theme.colors.textLight}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) setErrors({ ...errors, title: '' });
              }}
              maxLength={settings.titleMaxLength}
            />
            {errors.title ? (
              <Text style={styles.errorText}>{errors.title}</Text>
            ) : null}
          </View>

          {/* Content Input */}
          <View style={styles.card}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Sorunuzun Detayı</Text>
              <Text style={styles.counterText}>
                {content.trim().length}/{settings.contentMaxLength}
              </Text>
            </View>
            <TextInput
              style={[styles.textArea, errors.content && styles.inputError]}
              placeholder={`Durumunuzu detaylandırın (min ${settings.contentMinLength} karakter)...`}
              placeholderTextColor={theme.colors.textLight}
              value={content}
              onChangeText={(text) => {
                setContent(text);
                if (errors.content) setErrors({ ...errors, content: '' });
              }}
              multiline
              textAlignVertical="top"
              maxLength={settings.contentMaxLength}
            />
            {errors.content ? (
              <Text style={styles.errorText}>{errors.content}</Text>
            ) : null}
          </View>

          {/* Tags */}
          {settings.maxTags > 0 && (
            <View style={styles.card}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Etiketler (İsteğe bağlı)</Text>
                <Text style={styles.counterText}>
                  {tags.length}/{settings.maxTags}
                </Text>
              </View>
              <View style={styles.tagInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Örn: regl, uyku, beslenme"
                  placeholderTextColor={theme.colors.textLight}
                  value={tagInput}
                  onChangeText={setTagInput}
                  onSubmitEditing={handleAddTag}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              {tags.length > 0 && (
                <View style={styles.tagsList}>
                  {tags.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={styles.tagPill}
                      onPress={() => handleRemoveTag(t)}
                    >
                      <Text style={styles.tagPillText}>#{t}</Text>
                      <Ionicons name="close-circle" size={14} color={theme.colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Image Picker Card */}
          <View style={styles.imageSectionCard}>
            <View style={styles.imageSectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <Ionicons name="images-outline" size={18} color={theme.colors.primary} />
                <View>
                  <Text style={styles.anonTitle}>Resim Ekle ({selectedImages.length}/{maxImages})</Text>
                  <Text style={styles.anonSubtitle}>
                    {isPremium
                      ? `Haftalık kalan hakkınız: ${maxImages}/${weeklyImageLimit} (her hafta yenilenir)`
                      : `Haftalık ${maxImages}/${weeklyImageLimit} hak · Premium ile haftada 5 resim`}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.pickImageBtn}
                onPress={handlePickImage}
                disabled={selectedImages.length >= maxImages || isUploadingImages}
              >
                <Ionicons name="add" size={16} color={theme.colors.primary} />
                <Text style={styles.pickImageBtnText}>Fotoğraf Seç</Text>
              </TouchableOpacity>
            </View>
            {selectedImages.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: 'row', gap: 10, marginTop: 12 }}
              >
                {selectedImages.map((uri, idx) => (
                  <View key={`${uri}-${idx}`} style={{ position: 'relative' }}>
                    <Image
                      source={{ uri }}
                      style={{ width: 76, height: 76, borderRadius: 12 }}
                    />
                    <TouchableOpacity
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 10,
                      }}
                      onPress={() =>
                        setSelectedImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Anonymous Switch */}
          {settings.allowAnonymous && (
            <View style={styles.anonCard}>
              <View style={styles.anonLeft}>
                <View style={styles.anonIcon}>
                  <Ionicons name="eye-off-outline" size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.anonTitle}>Anonim Olarak Sor</Text>
                  <Text style={styles.anonSubtitle}>
                    Kullanıcı adınız ve profiliniz gizlenir
                  </Text>
                </View>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitBtn,
              (createQuestionMutation.isPending ||
                !settings.allowNewQuestions ||
                quotaExceeded) &&
                styles.submitBtnDisabled,
            ]}
            disabled={
              createQuestionMutation.isPending ||
              !settings.allowNewQuestions ||
              quotaExceeded
            }
            onPress={handleSubmit}
            activeOpacity={0.88}
          >
            {createQuestionMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Soruyu Yayınla</Text>
              </>
            )}
          </TouchableOpacity>
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
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundCard,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
    },
    topTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    publishPill: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      minWidth: 72,
      alignItems: 'center',
    },
    publishPillDisabled: {
      opacity: 0.5,
    },
    publishPillText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
      gap: 14,
    },
    heroCard: {
      borderRadius: 20,
      padding: 16,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    heroBadgeText: {
      color: '#FFFFFF',
      fontSize: 11.5,
      fontWeight: '700',
    },
    quotaPill: {
      backgroundColor: 'rgba(0,0,0,0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    quotaPillText: {
      color: '#FFFFFF',
      fontSize: 11.5,
      fontWeight: '700',
    },
    heroTitle: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 4,
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 12.5,
      lineHeight: 18,
    },
    rewardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    rewardText: {
      color: '#FDE68A',
      fontSize: 12,
      fontWeight: '700',
    },
    warningCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 14,
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    warningText: {
      flex: 1,
      fontSize: 12.5,
      color: theme.colors.text,
      fontWeight: '600',
    },
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    label: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text,
    },
    requiredMark: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    counterText: {
      fontSize: 11.5,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    categoryWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    categoryChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
    },
    input: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
      color: theme.colors.text,
    },
    textArea: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
      color: theme.colors.text,
      minHeight: 130,
    },
    inputError: {
      borderColor: '#EF4444',
    },
    errorText: {
      color: '#EF4444',
      fontSize: 12,
      fontWeight: '600',
      marginTop: 6,
    },
    tagInputRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    addTagBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 10,
    },
    tagPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: theme.isDark ? 'rgba(236,72,153,0.14)' : '#FDF2F8',
    },
    tagPillText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    imageSectionCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    imageSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pickImageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: theme.colors.primary + '18',
    },
    pickImageBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    anonCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    anonLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    anonIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: theme.isDark ? 'rgba(236,72,153,0.14)' : '#FDF2F8',
      alignItems: 'center',
      justifyContent: 'center',
    },
    anonTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
    anonSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 16,
      paddingVertical: 15,
      marginTop: 4,
    },
    submitBtnDisabled: {
      opacity: 0.5,
    },
    submitBtnText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
  });
