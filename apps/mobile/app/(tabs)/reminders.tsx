import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
  Modal,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { remindersService } from '@/services/api';
import {
  loadLocalNotificationSettings,
  saveLocalNotificationSettings,
  syncLocalRemindersSchedule,
  syncPendingServerNotifications,
} from '@/services/notificationEngine';
import { useAuthStore } from '@/store/authStore';
import { useNotifications } from '@/hooks/useNotifications';
import { useTheme } from '@/hooks/useTheme';

interface Reminder {
  id: string;
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  payloadJson: {
    title: string;
    message: string;
    time: string;
    days?: number[];
  };
  active: boolean;
  nextRunAt: string;
}

type FilterKey = 'ALL' | 'ACTIVE' | 'DAILY' | 'OTHER';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_HEIGHT = 48;

const SMART_TEMPLATES = [
  {
    key: 'water',
    icon: 'water-outline' as const,
    color: '#0EA5E9',
    title: 'Su Hatırlatıcısı',
    message: 'Bir bardak su içme zamanı! Günlük hedefine yaklaş.',
    type: 'DAILY' as const,
    time: '14:00',
  },
  {
    key: 'checkin',
    icon: 'sparkles-outline' as const,
    color: '#8B5CF6',
    title: 'Akşam Check-in',
    message: 'Bugün nasıl hissettin? Serini korumak için check-in yap.',
    type: 'DAILY' as const,
    time: '20:30',
  },
  {
    key: 'vitamin',
    icon: 'medkit-outline' as const,
    color: '#EC4899',
    title: 'Takviye & Vitamin',
    message: 'Günlük vitamin veya takviyeni almayı unutma.',
    type: 'DAILY' as const,
    time: '09:30',
  },
  {
    key: 'sleep',
    icon: 'moon-outline' as const,
    color: '#6366F1',
    title: 'Uyku & 4-7-8 Nefes',
    message: 'Ekranları bırak ve 5 dakikalık rahatlama nefesine başla.',
    type: 'DAILY' as const,
    time: '22:30',
  },
  {
    key: 'stretch',
    icon: 'body-outline' as const,
    color: '#10B981',
    title: 'Kısa Esneme',
    message: 'Omuzlarını gevşet ve birkaç dakika hareket et.',
    type: 'DAILY' as const,
    time: '16:00',
  },
];

const QUICK_TIMES = ['08:30', '12:00', '18:00', '21:30'];

const WEEK_DAYS_ORDERED = [
  { value: 1, short: 'Pzt', label: 'Pazartesi' },
  { value: 2, short: 'Sal', label: 'Salı' },
  { value: 3, short: 'Çar', label: 'Çarşamba' },
  { value: 4, short: 'Per', label: 'Perşembe' },
  { value: 5, short: 'Cum', label: 'Cuma' },
  { value: 6, short: 'Cmt', label: 'Cumartesi' },
  { value: 0, short: 'Paz', label: 'Pazar' },
];

function stepHour(timeStr: string, delta: number): string {
  const hour = Number(timeStr.split(':')[0]);
  const safeHour = Number.isFinite(hour) ? hour : 23;
  const nextHour = (safeHour + delta + 24) % 24;
  return `${String(nextHour).padStart(2, '0')}:00`;
}

function getReminderVisual(title: string): {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
} {
  const lower = (title || '').toLowerCase();
  if (lower.includes('su') || lower.includes('water')) {
    return { icon: 'water-outline', color: '#0EA5E9' };
  }
  if (
    lower.includes('vitamin') ||
    lower.includes('takviye') ||
    lower.includes('ilaç')
  ) {
    return { icon: 'medkit-outline', color: '#EC4899' };
  }
  if (
    lower.includes('uyku') ||
    lower.includes('nefes') ||
    lower.includes('gece')
  ) {
    return { icon: 'moon-outline', color: '#6366F1' };
  }
  if (lower.includes('check') || lower.includes('nova') || lower.includes('ruh')) {
    return { icon: 'sparkles-outline', color: '#8B5CF6' };
  }
  if (lower.includes('adet') || lower.includes('regl') || lower.includes('döngü')) {
    return { icon: 'calendar-outline', color: '#F43F5E' };
  }
  if (lower.includes('esneme') || lower.includes('hareket') || lower.includes('yürüyüş')) {
    return { icon: 'body-outline', color: '#10B981' };
  }
  return { icon: 'notifications-outline', color: '#EC4899' };
}

function formatNextRunRelative(dateStr: string): string {
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return 'Planlandı';

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins <= 0) return 'Yakında';
  if (diffMins < 60) return `${diffMins} dk sonra`;

  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours} saat sonra`;

  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(target);
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'DAILY':
      return 'Günlük';
    case 'WEEKLY':
      return 'Haftalık';
    case 'MONTHLY':
      return 'Aylık';
    case 'CUSTOM':
      return 'Özel';
    default:
      return type;
  }
}

function getDaysLabel(type: string, days?: number[]) {
  if (!days || days.length === 0) return '';
  if (type === 'WEEKLY') {
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return days.map((d) => dayNames[d] ?? d).join(', ');
  }
  if (type === 'MONTHLY') {
    return `Ayın ${days.join(', ')}. günü`;
  }
  return '';
}

export default function RemindersScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [quietHoursExpanded, setQuietHoursExpanded] = useState(false);
  const [quietStart, setQuietStart] = useState('23:00');
  const [quietEnd, setQuietEnd] = useState('08:00');
  const [creatingTemplateKey, setCreatingTemplateKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const {
    expoPushToken,
    permissionStatus,
    requestPermissions,
    scheduleLocalNotification,
  } = useNotifications();

  useEffect(() => {
    AsyncStorage.multiGet([
      '@quiet_hours_enabled',
      '@quiet_hours_start',
      '@quiet_hours_end',
    ]).then((entries) => {
      const map = Object.fromEntries(entries);
      if (map['@quiet_hours_enabled'] !== null) {
        setQuietHoursEnabled(map['@quiet_hours_enabled'] === 'true');
      }
      if (map['@quiet_hours_start']) setQuietStart(map['@quiet_hours_start']);
      if (map['@quiet_hours_end']) setQuietEnd(map['@quiet_hours_end']);
    });

    if (isAuthenticated) {
      remindersService
        .getNotificationPreferences()
        .then((prefs: any) => {
          if (prefs?.quietHours) {
            const q = prefs.quietHours;
            const resolvedStart =
              typeof q.start === 'string' && q.start
                ? q.start
                : typeof q.startHour === 'number'
                ? `${String(q.startHour).padStart(2, '0')}:00`
                : null;
            const resolvedEnd =
              typeof q.end === 'string' && q.end
                ? q.end
                : typeof q.endHour === 'number'
                ? `${String(q.endHour).padStart(2, '0')}:00`
                : null;
            if (typeof q.enabled === 'boolean') {
              setQuietHoursEnabled(q.enabled);
              AsyncStorage.setItem('@quiet_hours_enabled', q.enabled ? 'true' : 'false').catch(() => {});
            }
            if (resolvedStart) {
              setQuietStart(resolvedStart);
              AsyncStorage.setItem('@quiet_hours_start', resolvedStart).catch(() => {});
            }
            if (resolvedEnd) {
              setQuietEnd(resolvedEnd);
              AsyncStorage.setItem('@quiet_hours_end', resolvedEnd).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const syncQuietHoursToSettings = async (
    enabledVal: boolean,
    startStr: string,
    endStr: string,
  ) => {
    const startHour = Number(startStr.split(':')[0]);
    const endHour = Number(endStr.split(':')[0]);
    const safeStart = Number.isFinite(startHour) ? startHour : 23;
    const safeEnd = Number.isFinite(endHour) ? endHour : 8;
    const localSettings = await loadLocalNotificationSettings();
    await saveLocalNotificationSettings({
      ...localSettings,
      quietHours: {
        enabled: enabledVal,
        startHour: safeStart,
        endHour: safeEnd,
      },
    });
    return { startHour: safeStart, endHour: safeEnd };
  };

  const handleToggleQuietHours = async (val: boolean) => {
    setQuietHoursEnabled(val);
    const { startHour, endHour } = await syncQuietHoursToSettings(val, quietStart, quietEnd);
    remindersService
      .updateNotificationPreferences({
        quietHours: { enabled: val, start: quietStart, end: quietEnd, startHour, endHour },
      })
      .catch(() => {});
  };

  const updateQuietHour = async (which: 'start' | 'end', next: string) => {
    const nextStart = which === 'start' ? next : quietStart;
    const nextEnd = which === 'end' ? next : quietEnd;
    if (which === 'start') {
      setQuietStart(next);
    } else {
      setQuietEnd(next);
    }
    const { startHour, endHour } = await syncQuietHoursToSettings(
      quietHoursEnabled,
      nextStart,
      nextEnd,
    );
    remindersService
      .updateNotificationPreferences({
        quietHours: {
          enabled: quietHoursEnabled,
          start: nextStart,
          end: nextEnd,
          startHour,
          endHour,
        },
      })
      .catch(() => {});
  };

  const {
    data: rawReminders,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => remindersService.getReminders(),
    enabled: isAuthenticated,
  });

  const reminders: Reminder[] = useMemo(
    () => (Array.isArray(rawReminders) ? (rawReminders as Reminder[]) : []),
    [rawReminders]
  );

  useEffect(() => {
    if (!isAuthenticated || permissionStatus !== 'granted') return;
    syncLocalRemindersSchedule(reminders as any).catch(() => {});
  }, [isAuthenticated, permissionStatus, reminders, quietHoursEnabled, quietStart, quietEnd]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      remindersService.toggleReminder(id, active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remindersService.deleteReminder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });

  const testPushMutation = useMutation({
    mutationFn: () => remindersService.testPush(),
    onSuccess: async (data: any) => {
      if (data?.status === 'queued') {
        await syncPendingServerNotifications().catch(() => {});
        Alert.alert('Başarılı', 'Sunucu test bildirimi cihaz senkronizasyonu ile iletildi!');
      } else {
        Alert.alert('Başarılı', 'Sunucu üzerinden push test bildirimi gönderildi!');
      }
    },
    onError: () => {
      Alert.alert(
        'Bilgi',
        'Sunucu push bildirimi şu an gönderilemedi; cihaz içi yerel bildirim aktif.'
      );
    },
  });

  const handleAddTemplate = async (tpl: (typeof SMART_TEMPLATES)[number]) => {
    setCreatingTemplateKey(tpl.key);
    try {
      if (permissionStatus !== 'granted') {
        await requestPermissions(true);
      }
      await remindersService.createReminder({
        type: tpl.type,
        title: tpl.title,
        message: tpl.message,
        time: tpl.time,
        active: true,
      });
      await queryClient.invalidateQueries({ queryKey: ['reminders'] });
      Alert.alert('Eklendi', `${tpl.title} (${tpl.time}) oluşturuldu.`);
    } catch (err: any) {
      Alert.alert('Hata', err?.message || 'Şablon eklenemedi.');
    } finally {
      setCreatingTemplateKey(null);
    }
  };

  const handleEnablePermissions = async () => {
    const granted = await requestPermissions(true);
    if (granted) {
      await syncLocalRemindersSchedule(reminders as any).catch(() => {});
      await syncPendingServerNotifications().catch(() => {});
      Alert.alert(
        'Bildirimler Açıldı',
        'Harika! Hatırlatmaların ve destek bildirimlerin zamanında cihazına ulaşacak.'
      );
    }
  };

  const handleTestNotification = async () => {
    if (permissionStatus !== 'granted') {
      const granted = await requestPermissions(true);
      if (!granted) {
        return;
      }
    }

    await scheduleLocalNotification(
      'Kadın Atlası Bildirim Testi',
      'Harika! Hatırlatmaların zamanında ulaşmaya hazır.',
      { screen: 'reminders', test: true }
    );

    Alert.alert(
      'Yerel Bildirim Gönderildi',
      'Sunucu üzerinden anlık test bildirimi de göndermek ister misin?',
      [
        { text: 'Tamam', style: 'cancel' },
        {
          text: expoPushToken ? 'Sunucu Push Testi' : 'Sunucu Testi Gönder',
          onPress: () => testPushMutation.mutate(),
        },
      ]
    );
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      'Hatırlatıcıyı Sil',
      `"${title}" hatırlatıcısını silmek istediğinden emin misin?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(id),
        },
      ]
    );
  };

  const openCreateModal = () => {
    setEditingReminder(null);
    setShowFormModal(true);
  };

  const openEditModal = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setShowFormModal(true);
  };

  const activeCount = useMemo(
    () => reminders.filter((r) => r.active).length,
    [reminders]
  );

  const filteredReminders = useMemo(() => {
    const base = reminders.filter((r) => {
      if (activeFilter === 'ACTIVE') return r.active;
      if (activeFilter === 'DAILY') return r.type === 'DAILY';
      if (activeFilter === 'OTHER') return r.type !== 'DAILY';
      return true;
    });

    return [...base].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      const timeA = a.payloadJson?.time || '99:99';
      const timeB = b.payloadJson?.time || '99:99';
      return timeA.localeCompare(timeB);
    });
  }, [reminders, activeFilter]);

  const filterOptions: { key: FilterKey; label: string; count: number }[] = [
    { key: 'ALL', label: 'Tümü', count: reminders.length },
    { key: 'ACTIVE', label: 'Aktif', count: activeCount },
    {
      key: 'DAILY',
      label: 'Günlük',
      count: reminders.filter((r) => r.type === 'DAILY').length,
    },
    {
      key: 'OTHER',
      label: 'Haftalık/Aylık',
      count: reminders.filter((r) => r.type !== 'DAILY').length,
    },
  ];

  const styles = createStyles(theme);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Hero Card */}
        <LinearGradient
          colors={
            theme.isDark ? ['#2A1836', '#1B1429'] : ['#FFF0F7', '#F5EEFF']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleCol}>
              <Text style={styles.heroEyebrow}>RUTİN & TAKİP</Text>
              <Text style={styles.heroTitle}>Hatırlatıcılar</Text>
            </View>

            <View style={styles.heroActions}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.testBtn}
                onPress={handleTestNotification}
                disabled={testPushMutation.isPending}
              >
                <Ionicons
                  name="notifications-outline"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.testBtnText}>Test</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.85} onPress={openCreateModal}>
                <LinearGradient
                  colors={['#EC4899', '#9333EA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.newBtn}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.newBtnText}>Yeni Ekle</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero Stats & Permission Pill */}
          <View style={styles.heroStatsRow}>
            <View style={styles.statChip}>
              <View style={[styles.statDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.statChipText}>{activeCount} Aktif</Text>
            </View>

            <View style={styles.statChip}>
              <Ionicons
                name="layers-outline"
                size={13}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.statChipText}>{reminders.length} Toplam</Text>
            </View>

            {permissionStatus === 'granted' ? (
              <View style={[styles.statChip, styles.statChipOk]}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={theme.colors.success}
                />
                <Text style={styles.statChipOkText}>Bildirim Açık</Text>
              </View>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleEnablePermissions}
                style={[styles.statChip, styles.statChipWarn]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={14}
                  color="#D97706"
                />
                <Text style={styles.statChipWarnText}>İzni Aç</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* Smart 1-Tap Templates */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hızlı Rutin Şablonları</Text>
            <Text style={styles.sectionSub}>Tek dokunuşla ekle</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.templatesRow}
          >
            {SMART_TEMPLATES.map((tpl) => {
              const isBusy = creatingTemplateKey === tpl.key;
              const alreadyExists = reminders.some(
                (r) =>
                  r.payloadJson?.title
                    ?.toLowerCase()
                    .includes(tpl.title.toLowerCase())
              );

              return (
                <TouchableOpacity
                  key={tpl.key}
                  activeOpacity={0.82}
                  style={[
                    styles.templateCard,
                    alreadyExists && styles.templateCardAdded,
                  ]}
                  onPress={() => handleAddTemplate(tpl)}
                  disabled={Boolean(creatingTemplateKey)}
                >
                  <View style={styles.templateTopRow}>
                    <View
                      style={[
                        styles.templateIconBox,
                        { backgroundColor: `${tpl.color}18` },
                      ]}
                    >
                      <Ionicons name={tpl.icon} size={18} color={tpl.color} />
                    </View>
                    <Text style={styles.templateTimeBadge}>{tpl.time}</Text>
                  </View>

                  <Text style={styles.templateTitle} numberOfLines={1}>
                    {tpl.title}
                  </Text>

                  <View style={styles.templateActionRow}>
                    {isBusy ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                      />
                    ) : alreadyExists ? (
                      <>
                        <Ionicons
                          name="checkmark-circle"
                          size={13}
                          color={theme.colors.success}
                        />
                        <Text style={styles.templateAddedText}>Eklendi</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons
                          name="add-circle-outline"
                          size={14}
                          color={theme.colors.primary}
                        />
                        <Text style={styles.templateAddText}>Ekle</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Collapsible Quiet Hours Card */}
        <View style={styles.quietCard}>
          <View style={styles.quietTopRow}>
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.quietInfoTouch}
              onPress={() => setQuietHoursExpanded((prev) => !prev)}
            >
              <View style={styles.quietIconBox}>
                <Ionicons name="moon-outline" size={18} color="#8B5CF6" />
              </View>
              <View style={styles.quietTextCol}>
                <View style={styles.quietTitleLine}>
                  <Text style={styles.quietTitle}>Sessiz Saatler</Text>
                  <View style={styles.quietRangePill}>
                    <Text style={styles.quietRangeText}>
                      {quietStart} – {quietEnd}
                    </Text>
                  </View>
                  <Ionicons
                    name={quietHoursExpanded ? 'chevron-up' : 'chevron-down'}
                    size={15}
                    color={theme.colors.textSecondary}
                  />
                </View>
                <Text style={styles.quietSub}>
                  {quietHoursEnabled
                    ? 'Uyku saatlerinde bildirimler sessize alınır'
                    : 'Sessiz saat koruması kapalı'}
                </Text>
              </View>
            </TouchableOpacity>

            <Switch
              value={quietHoursEnabled}
              onValueChange={handleToggleQuietHours}
              trackColor={{
                false: theme.isDark ? '#3F3F46' : '#E5E7EB',
                true: theme.colors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          {quietHoursExpanded && (
            <View style={styles.quietExpandedBox}>
              <View style={styles.quietStepper}>
                <Text style={styles.quietStepperLabel}>Başlangıç</Text>
                <View style={styles.quietStepperRow}>
                  <TouchableOpacity
                    style={styles.stepMiniBtn}
                    onPress={() =>
                      updateQuietHour('start', stepHour(quietStart, -1))
                    }
                  >
                    <Ionicons name="remove" size={15} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.quietStepperVal}>{quietStart}</Text>
                  <TouchableOpacity
                    style={styles.stepMiniBtn}
                    onPress={() =>
                      updateQuietHour('start', stepHour(quietStart, 1))
                    }
                  >
                    <Ionicons name="add" size={15} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.quietStepper}>
                <Text style={styles.quietStepperLabel}>Bitiş</Text>
                <View style={styles.quietStepperRow}>
                  <TouchableOpacity
                    style={styles.stepMiniBtn}
                    onPress={() => updateQuietHour('end', stepHour(quietEnd, -1))}
                  >
                    <Ionicons name="remove" size={15} color={theme.colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.quietStepperVal}>{quietEnd}</Text>
                  <TouchableOpacity
                    style={styles.stepMiniBtn}
                    onPress={() => updateQuietHour('end', stepHour(quietEnd, 1))}
                  >
                    <Ionicons name="add" size={15} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {filterOptions.map((opt) => {
            const selected = activeFilter === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.8}
                onPress={() => setActiveFilter(opt.key)}
                style={[styles.filterPill, selected && styles.filterPillActive]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    selected && styles.filterPillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                <View
                  style={[
                    styles.filterCountBadge,
                    selected && styles.filterCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterCountText,
                      selected && styles.filterCountTextActive,
                    ]}
                  >
                    {opt.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Reminders List */}
        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Hatırlatıcılar yükleniyor...</Text>
          </View>
        ) : filteredReminders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name="notifications-off-outline"
                size={30}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {reminders.length === 0
                ? 'Henüz hatırlatıcın yok'
                : 'Bu filtrede hatırlatıcı yok'}
            </Text>
            <Text style={styles.emptySubtext}>
              {reminders.length === 0
                ? 'Yukarıdaki şablonlardan tek dokunuşla ekleyebilir veya kendi hatırlatıcını oluşturabilirsin.'
                : 'Farklı bir filtre seçerek tüm hatırlatıcılarını görüntüleyebilirsin.'}
            </Text>
            {reminders.length === 0 && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openCreateModal}
                style={styles.emptyCtaWrap}
              >
                <LinearGradient
                  colors={['#EC4899', '#9333EA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.emptyCtaGradient}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyCtaText}>İlk Hatırlatıcıyı Ekle</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.remindersList}>
            {filteredReminders.map((reminder) => {
              const payload = reminder.payloadJson || {
                title: 'Hatırlatıcı',
                message: '',
                time: '09:00',
              };
              const visual = getReminderVisual(payload.title);
              const daysLabel = getDaysLabel(reminder.type, payload.days);

              return (
                <View
                  key={reminder.id}
                  style={[
                    styles.reminderCard,
                    !reminder.active && styles.reminderCardPaused,
                  ]}
                >
                  <View style={styles.reminderTopRow}>
                    <View
                      style={[
                        styles.reminderIconBox,
                        { backgroundColor: `${visual.color}16` },
                      ]}
                    >
                      <Ionicons
                        name={visual.icon}
                        size={20}
                        color={visual.color}
                      />
                    </View>

                    <View style={styles.reminderMetaCol}>
                      <Text
                        style={[
                          styles.reminderTitle,
                          !reminder.active && styles.reminderTitlePaused,
                        ]}
                        numberOfLines={1}
                      >
                        {payload.title}
                      </Text>

                      <View style={styles.reminderBadgesRow}>
                        <View style={styles.timeBadge}>
                          <Ionicons
                            name="time-outline"
                            size={12}
                            color={theme.colors.primary}
                          />
                          <Text style={styles.timeBadgeText}>
                            {payload.time}
                          </Text>
                        </View>

                        <View style={styles.freqBadge}>
                          <Text style={styles.freqBadgeText}>
                            {getTypeLabel(reminder.type)}
                            {daysLabel ? ` • ${daysLabel}` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Switch
                      value={reminder.active}
                      onValueChange={() =>
                        toggleMutation.mutate({
                          id: reminder.id,
                          active: !reminder.active,
                        })
                      }
                      trackColor={{
                        false: theme.isDark ? '#3F3F46' : '#E5E7EB',
                        true: theme.colors.primary,
                      }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {payload.message ? (
                    <Text style={styles.reminderMessage}>{payload.message}</Text>
                  ) : null}

                  <View style={styles.reminderFooter}>
                    <View style={styles.nextRunPill}>
                      <Ionicons
                        name={
                          reminder.active
                            ? 'alarm-outline'
                            : 'pause-circle-outline'
                        }
                        size={13}
                        color={
                          reminder.active
                            ? theme.colors.success
                            : theme.colors.textLight
                        }
                      />
                      <Text style={styles.nextRunText}>
                        {reminder.active
                          ? `Sonraki: ${formatNextRunRelative(reminder.nextRunAt)}`
                          : 'Duraklatıldı'}
                      </Text>
                    </View>

                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        style={styles.cardActionBtn}
                        onPress={() => openEditModal(reminder)}
                      >
                        <Ionicons
                          name="create-outline"
                          size={15}
                          color={theme.colors.textSecondary}
                        />
                        <Text style={styles.cardEditText}>Düzenle</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.75}
                        style={styles.cardActionBtn}
                        onPress={() => handleDelete(reminder.id, payload.title)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={15}
                          color={theme.colors.error}
                        />
                        <Text style={styles.cardDeleteText}>Sil</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {showFormModal && (
        <ReminderFormModal
          initialReminder={editingReminder}
          onClose={() => {
            setShowFormModal(false);
            setEditingReminder(null);
          }}
          onSuccess={() => {
            setShowFormModal(false);
            setEditingReminder(null);
            queryClient.invalidateQueries({ queryKey: ['reminders'] });
          }}
        />
      )}
    </SafeAreaView>
  );
}

// Time Picker Wheel Component
function TimePickerWheel({
  value,
  onChange,
}: {
  value: string;
  onChange: (time: string) => void;
}) {
  const theme = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [hour, minute] = value.split(':').map((n) => Number(n) || 0);
  const [selectedHour, setSelectedHour] = useState(hour);
  const [selectedMinute, setSelectedMinute] = useState(minute);

  useEffect(() => {
    const [h, m] = value.split(':').map((n) => Number(n) || 0);
    setSelectedHour(h);
    setSelectedMinute(m);
  }, [value]);

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const styles = createStyles(theme);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  useEffect(() => {
    if (showPicker) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [showPicker]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setShowPicker(false));
  };

  const handleConfirm = () => {
    const formattedTime = `${String(selectedHour).padStart(2, '0')}:${String(
      selectedMinute
    ).padStart(2, '0')}`;
    onChange(formattedTime);
    handleClose();
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.timePickerButton}
        onPress={() => setShowPicker(true)}
      >
        <View style={styles.timePickerLeft}>
          <Ionicons
            name="time-outline"
            size={20}
            color={theme.colors.primary}
          />
          <Text style={styles.timePickerButtonText}>{value}</Text>
        </View>
        <Text style={styles.timePickerChangeText}>Saati Değiştir</Text>
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade">
        <View style={styles.pickerModalOverlay}>
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={handleClose}
          />
          <Animated.View
            style={[
              styles.pickerContainer,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={handleClose}>
                <Text style={styles.pickerCancelText}>İptal</Text>
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>Saat Seç</Text>
              <TouchableOpacity onPress={handleConfirm}>
                <Text style={styles.pickerConfirmText}>Tamam</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.wheelContainer}>
              <ScrollPicker
                items={hours}
                selectedValue={selectedHour}
                onValueChange={setSelectedHour}
                formatter={(val) => String(val).padStart(2, '0')}
              />
              <Text style={styles.wheelSeparator}>:</Text>
              <ScrollPicker
                items={minutes}
                selectedValue={selectedMinute}
                onValueChange={setSelectedMinute}
                formatter={(val) => String(val).padStart(2, '0')}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function ScrollPicker({
  items,
  selectedValue,
  onValueChange,
  formatter = (val) => String(val),
}: {
  items: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  formatter?: (value: number) => string;
}) {
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [initialized, setInitialized] = useState(false);
  const styles = createStyles(theme);

  useEffect(() => {
    if (!initialized && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: selectedValue * ITEM_HEIGHT,
          animated: false,
        });
        setInitialized(true);
      }, 80);
    }
  }, [initialized, selectedValue]);

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    if (index >= 0 && index < items.length && items[index] !== selectedValue) {
      onValueChange(items[index]);
    }
  };

  return (
    <View style={styles.scrollPickerContainer}>
      <View style={styles.scrollPickerHighlight} />
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScroll}
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT * 2,
        }}
      >
        {items.map((item) => (
          <View key={item} style={styles.scrollPickerItem}>
            <Text
              style={[
                styles.scrollPickerItemText,
                item === selectedValue && styles.scrollPickerItemTextSelected,
              ]}
            >
              {formatter(item)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

interface ReminderFormModalProps {
  initialReminder: Reminder | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ReminderFormModal({
  initialReminder,
  onClose,
  onSuccess,
}: ReminderFormModalProps) {
  const theme = useTheme();
  const isEditing = Boolean(initialReminder);

  const [type, setType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>(
    initialReminder && initialReminder.type !== 'CUSTOM'
      ? initialReminder.type
      : 'DAILY'
  );
  const [title, setTitle] = useState(
    initialReminder?.payloadJson?.title || ''
  );
  const [message, setMessage] = useState(
    initialReminder?.payloadJson?.message || ''
  );
  const [time, setTime] = useState(
    initialReminder?.payloadJson?.time || '09:00'
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(
    initialReminder?.payloadJson?.days || []
  );

  const createMutation = useMutation({
    mutationFn: (payload: {
      type: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      title: string;
      message: string;
      time: string;
      days?: number[];
      active: boolean;
    }) => remindersService.createReminder(payload),
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      Alert.alert('Hata', error?.message || 'Hatırlatıcı oluşturulamadı');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      title: string;
      message: string;
      time: string;
      days?: number[];
    }) =>
      remindersService.updateReminder(payload.id, {
        title: payload.title,
        message: payload.message,
        time: payload.time,
        days: payload.days,
      }),
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      Alert.alert('Hata', error?.message || 'Hatırlatıcı güncellenemedi');
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const toggleDay = (dayVal: number) => {
    if (selectedDays.includes(dayVal)) {
      setSelectedDays(selectedDays.filter((d) => d !== dayVal));
    } else {
      setSelectedDays([...selectedDays, dayVal].sort((a, b) => a - b));
    }
  };

  const handleSave = () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen başlık ve mesaj alanlarını doldur.');
      return;
    }

    if (type !== 'DAILY' && selectedDays.length === 0) {
      Alert.alert('Gün Seçimi', 'Lütfen en az bir gün seç.');
      return;
    }

    if (isEditing && initialReminder) {
      updateMutation.mutate({
        id: initialReminder.id,
        title: title.trim(),
        message: message.trim(),
        time,
        days: type === 'DAILY' ? undefined : selectedDays,
      });
    } else {
      createMutation.mutate({
        type,
        title: title.trim(),
        message: message.trim(),
        time,
        days: type === 'DAILY' ? undefined : selectedDays,
        active: true,
      });
    }
  };

  const styles = createStyles(theme);

  return (
    <Modal visible transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetOverlay}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {isEditing ? 'Hatırlatıcıyı Düzenle' : 'Yeni Hatırlatıcı'}
            </Text>
            <TouchableOpacity
              style={styles.sheetCloseBtn}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Frequency */}
            <Text style={styles.fieldLabel}>Sıklık</Text>
            {isEditing ? (
              <View style={styles.lockedFreqBadge}>
                <Ionicons
                  name="repeat-outline"
                  size={15}
                  color={theme.colors.primary}
                />
                <Text style={styles.lockedFreqText}>
                  {getTypeLabel(initialReminder?.type || type)} hatırlatıcı
                </Text>
              </View>
            ) : (
              <View style={styles.typeSelector}>
                {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.8}
                    style={[
                      styles.typeChip,
                      type === option && styles.typeChipActive,
                    ]}
                    onPress={() => {
                      setType(option);
                      setSelectedDays([]);
                    }}
                    disabled={isSubmitting}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        type === option && styles.typeChipTextActive,
                      ]}
                    >
                      {getTypeLabel(option)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Inline Weekly Day Picker */}
            {type === 'WEEKLY' && (
              <View style={styles.inlineDaysBlock}>
                <View style={styles.daysLabelRow}>
                  <Text style={styles.fieldLabelNoMargin}>Hangi günler?</Text>
                  <View style={styles.dayShortcuts}>
                    <TouchableOpacity
                      onPress={() => setSelectedDays([1, 2, 3, 4, 5])}
                    >
                      <Text style={styles.dayShortcutText}>Hafta içi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setSelectedDays([0, 6])}
                    >
                      <Text style={styles.dayShortcutText}>Hafta sonu</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.weekGrid}>
                  {WEEK_DAYS_ORDERED.map((day) => {
                    const selected = selectedDays.includes(day.value);
                    return (
                      <TouchableOpacity
                        key={day.value}
                        activeOpacity={0.8}
                        onPress={() => toggleDay(day.value)}
                        style={[
                          styles.weekDayPill,
                          selected && styles.weekDayPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.weekDayText,
                            selected && styles.weekDayTextActive,
                          ]}
                        >
                          {day.short}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Inline Monthly Day Picker */}
            {type === 'MONTHLY' && (
              <View style={styles.inlineDaysBlock}>
                <Text style={styles.fieldLabel}>Ayın hangi günleri?</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.monthStrip}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => {
                    const selected = selectedDays.includes(dayNum);
                    return (
                      <TouchableOpacity
                        key={dayNum}
                        activeOpacity={0.8}
                        onPress={() => toggleDay(dayNum)}
                        style={[
                          styles.monthDayCircle,
                          selected && styles.monthDayCircleActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.monthDayText,
                            selected && styles.monthDayTextActive,
                          ]}
                        >
                          {dayNum}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Time + Quick Presets */}
            <Text style={styles.fieldLabel}>Saat</Text>
            <View style={styles.quickTimesRow}>
              {QUICK_TIMES.map((preset) => {
                const active = time === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    activeOpacity={0.8}
                    onPress={() => setTime(preset)}
                    style={[
                      styles.quickTimeChip,
                      active && styles.quickTimeChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickTimeText,
                        active && styles.quickTimeTextActive,
                      ]}
                    >
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TimePickerWheel value={time} onChange={setTime} />

            {/* Title */}
            <Text style={styles.fieldLabel}>Başlık</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Örn. Su içmeyi unutma"
              placeholderTextColor={theme.colors.textLight}
              value={title}
              onChangeText={setTitle}
              editable={!isSubmitting}
            />

            {/* Message */}
            <Text style={styles.fieldLabel}>Mesaj</Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              placeholder="Örn. Bugünkü su hedefini tamamla"
              placeholderTextColor={theme.colors.textLight}
              value={message}
              onChangeText={setMessage}
              editable={!isSubmitting}
              multiline
            />

            {/* Primary Save Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleSave}
              disabled={isSubmitting}
              style={styles.saveCtaWrap}
            >
              <LinearGradient
                colors={['#EC4899', '#9333EA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveCtaGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveCtaText}>
                    {isEditing ? 'Değişiklikleri Kaydet' : 'Hatırlatıcı Oluştur'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 34,
      gap: 14,
    },
    heroCard: {
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 14,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    heroTitleCol: {
      flex: 1,
    },
    heroEyebrow: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.9,
      color: theme.colors.primary,
      marginBottom: 2,
    },
    heroTitle: {
      fontSize: 25,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    heroActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    testBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 14,
    },
    testBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 14,
    },
    newBtnText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    heroStatsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },
    statDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    statChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.text,
    },
    statChipOk: {
      borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    statChipOkText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.success,
    },
    statChipWarn: {
      borderColor: 'rgba(245, 158, 11, 0.4)',
    },
    statChipWarnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#D97706',
    },
    sectionBlock: {
      gap: 10,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
    },
    sectionSub: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    templatesRow: {
      gap: 10,
      paddingRight: 4,
    },
    templateCard: {
      width: 144,
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 18,
      padding: 13,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 9,
    },
    templateCardAdded: {
      borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    templateTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    templateIconBox: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    templateTimeBadge: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    templateTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
    },
    templateActionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    templateAddText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    templateAddedText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.success,
    },
    quietCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    quietTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    quietInfoTouch: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    quietIconBox: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: 'rgba(139, 92, 246, 0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    quietTextCol: {
      flex: 1,
      gap: 2,
    },
    quietTitleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    quietTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text,
    },
    quietRangePill: {
      backgroundColor: theme.isDark ? '#27272A' : '#F3F4F6',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 7,
    },
    quietRangeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    quietSub: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    quietExpandedBox: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    quietStepper: {
      flex: 1,
      backgroundColor: theme.isDark ? '#121215' : '#F9FAFB',
      borderRadius: 14,
      padding: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      gap: 6,
    },
    quietStepperLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    quietStepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    stepMiniBtn: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quietStepperVal: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text,
    },
    filtersRow: {
      gap: 8,
      paddingVertical: 2,
    },
    filterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 14,
    },
    filterPillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterPillText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    filterPillTextActive: {
      color: '#FFFFFF',
    },
    filterCountBadge: {
      backgroundColor: theme.isDark ? '#27272A' : '#F3F4F6',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 8,
    },
    filterCountBadgeActive: {
      backgroundColor: 'rgba(255,255,255,0.22)',
    },
    filterCountText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    filterCountTextActive: {
      color: '#FFFFFF',
    },
    loadingCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 20,
      padding: 28,
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    loadingText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    emptyState: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 22,
      padding: 28,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 8,
    },
    emptyIconCircle: {
      width: 60,
      height: 60,
      borderRadius: 20,
      backgroundColor: theme.isDark
        ? 'rgba(255, 105, 180, 0.14)'
        : '#FCE7F3',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.text,
    },
    emptySubtext: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 19,
    },
    emptyCtaWrap: {
      marginTop: 8,
      borderRadius: 16,
      overflow: 'hidden',
    },
    emptyCtaGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    emptyCtaText: {
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    remindersList: {
      gap: 12,
    },
    reminderCard: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 20,
      padding: 15,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 10,
    },
    reminderCardPaused: {
      opacity: 0.72,
    },
    reminderTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
    },
    reminderIconBox: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reminderMetaCol: {
      flex: 1,
      gap: 4,
    },
    reminderTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
    },
    reminderTitlePaused: {
      color: theme.colors.textSecondary,
    },
    reminderBadgesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    timeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: theme.isDark
        ? 'rgba(255, 105, 180, 0.14)'
        : '#FCE7F3',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    timeBadgeText: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    freqBadge: {
      backgroundColor: theme.isDark ? '#121215' : '#F3F4F6',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    freqBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    reminderMessage: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 19,
    },
    reminderFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    nextRunPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    nextRunText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    cardActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
    },
    cardEditText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    cardDeleteText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.error,
    },
    // Bottom Sheet Form Modal
    sheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.48)',
    },
    sheetBackdrop: {
      flex: 1,
    },
    sheetContainer: {
      backgroundColor: theme.colors.backgroundCard,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 28,
      maxHeight: SCREEN_HEIGHT * 0.88,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
      alignSelf: 'center',
      marginBottom: 12,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
    },
    sheetCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: theme.isDark ? '#27272A' : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      marginTop: 12,
      marginBottom: 7,
    },
    fieldLabelNoMargin: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    lockedFreqBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      backgroundColor: theme.isDark ? '#121215' : '#FCE7F3',
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
    },
    lockedFreqText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    typeSelector: {
      flexDirection: 'row',
      gap: 8,
    },
    typeChip: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 14,
      backgroundColor: theme.isDark ? '#121215' : '#F9FAFB',
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    typeChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    typeChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    typeChipTextActive: {
      color: '#FFFFFF',
    },
    inlineDaysBlock: {
      marginTop: 12,
    },
    daysLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    dayShortcuts: {
      flexDirection: 'row',
      gap: 10,
    },
    dayShortcutText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    weekGrid: {
      flexDirection: 'row',
      gap: 6,
    },
    weekDayPill: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: theme.isDark ? '#121215' : '#F9FAFB',
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    weekDayPillActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    weekDayText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    weekDayTextActive: {
      color: '#FFFFFF',
    },
    monthStrip: {
      gap: 6,
      paddingVertical: 2,
    },
    monthDayCircle: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.isDark ? '#121215' : '#F9FAFB',
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthDayCircleActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    monthDayText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    monthDayTextActive: {
      color: '#FFFFFF',
    },
    quickTimesRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    quickTimeChip: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 11,
      backgroundColor: theme.isDark ? '#121215' : '#F3F4F6',
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    quickTimeChipActive: {
      backgroundColor: theme.isDark
        ? 'rgba(255, 105, 180, 0.18)'
        : '#FCE7F3',
      borderColor: theme.colors.primary,
    },
    quickTimeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    quickTimeTextActive: {
      color: theme.colors.primary,
    },
    timePickerButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.isDark ? '#121215' : '#F9FAFB',
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: 15,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    timePickerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    timePickerButtonText: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
    },
    timePickerChangeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    textInput: {
      backgroundColor: theme.isDark ? '#121215' : '#F9FAFB',
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: 15,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.colors.text,
    },
    multilineInput: {
      minHeight: 84,
      textAlignVertical: 'top',
    },
    saveCtaWrap: {
      marginTop: 18,
      borderRadius: 18,
      overflow: 'hidden',
    },
    saveCtaGradient: {
      height: 54,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveCtaText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    // Wheel Picker Modal
    pickerModalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.48)',
    },
    pickerBackdrop: {
      flex: 1,
    },
    pickerContainer: {
      backgroundColor: theme.colors.backgroundCard,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingBottom: 30,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    pickerCancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    pickerTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    pickerConfirmText: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.primary,
    },
    wheelContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      height: ITEM_HEIGHT * 5,
      paddingHorizontal: 40,
    },
    wheelSeparator: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.colors.text,
      marginHorizontal: 10,
    },
    scrollPickerContainer: {
      flex: 1,
      height: ITEM_HEIGHT * 5,
      position: 'relative',
    },
    scrollPickerHighlight: {
      position: 'absolute',
      top: ITEM_HEIGHT * 2,
      left: 0,
      right: 0,
      height: ITEM_HEIGHT,
      backgroundColor: theme.isDark
        ? 'rgba(255, 105, 180, 0.14)'
        : '#FCE7F3',
      borderRadius: 12,
    },
    scrollPickerItem: {
      height: ITEM_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollPickerItemText: {
      fontSize: 20,
      color: theme.colors.textLight,
      fontWeight: '600',
    },
    scrollPickerItemTextSelected: {
      fontSize: 24,
      color: theme.colors.primary,
      fontWeight: '800',
    },
  });
