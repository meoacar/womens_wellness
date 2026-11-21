import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useTheme } from '@/hooks/useTheme';
import { usePremium } from '@/hooks/usePremium';
import { UpgradePrompt } from '@/components/premium/UpgradePrompt';
import { metricsService } from '@/services/api';

const { cacheDirectory, writeAsStringAsync } = FileSystem as any;

export default function HealthReportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { isPremium } = usePremium();
  const [days, setDays] = useState<30 | 90>(30);
  const [refreshing, setRefreshing] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptFeature, setPromptFeature] = useState({
    feature: 'Klinik Doktor Raporu',
    description:
      '90 günlük uzun dönem analizi ve doktora sunulabilir yazdırılabilir klinik rapor çıktısını Premium ile aç.',
  });

  const { data: report, isLoading, refetch } = useQuery<any>({
    queryKey: ['healthReport', days],
    queryFn: () => metricsService.getHealthReport(days),
  });

  const styles = createStyles(theme);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleShare = async () => {
    if (!report?.shareText) {
      Alert.alert('Rapor Hazır Değil', 'Lütfen raporun yüklenmesini bekleyin.');
      return;
    }
    try {
      await Share.share({
        title: `Sağlık Özeti (Son ${days} Gün)`,
        message: report.shareText,
      });
    } catch {
      Alert.alert('Hata', 'Paylaşım penceresi açılamadı.');
    }
  };

  const handleExportClinicReport = async () => {
    if (!isPremium) {
      setPromptFeature({
        feature: 'Yazdırılabilir Klinik Rapor (.html / PDF)',
        description:
          'Jinekolog veya doktor randevuna götürebileceğin düzenli klinik rapor çıktısını Premium ile indir.',
      });
      setPromptVisible(true);
      return;
    }
    if (!report || !cacheDirectory) {
      Alert.alert('Rapor Hazır Değil', 'Lütfen raporun yüklenmesini bekleyin.');
      return;
    }
    try {
      const topSymptomsHtml = (report.symptomsAndMood?.topSymptoms || [])
        .map((s: any) => `<li>${s.name} (${s.count} gün)</li>`)
        .join('') || '<li>Kayıt yok</li>';
      const topMoodsHtml = (report.symptomsAndMood?.topMoods || [])
        .map((m: any) => `<li>${m.name} (${m.count} gün)</li>`)
        .join('') || '<li>Kayıt yok</li>';

      const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Kadın Atlası - Klinik Sağlık Özeti</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1f2937; padding: 28px; max-width: 720px; margin: 0 auto; }
  h1 { color: #db2777; font-size: 22px; margin-bottom: 4px; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  .card h2 { font-size: 15px; margin: 0 0 10px; color: #111827; }
  .grid { display: flex; gap: 16px; }
  .stat { flex: 1; background: #fdf2f8; border-radius: 8px; padding: 10px; }
  .stat-val { font-size: 18px; font-weight: 700; color: #db2777; }
  .stat-lbl { font-size: 12px; color: #6b7280; }
</style>
</head>
<body>
  <h1>Kadın Atlası — Doktor & Klinik Sağlık Özeti</h1>
  <div class="meta">Son ${days} Gün · Oluşturulma: ${new Date().toLocaleDateString('tr-TR')}</div>
  <div class="card">
    <h2>Döngü İstatistikleri (Son 6 Ay)</h2>
    <div class="grid">
      <div class="stat"><div class="stat-val">${report.cycles?.avgCycleLengthDays ?? '—'} gün</div><div class="stat-lbl">Ortalama Döngü</div></div>
      <div class="stat"><div class="stat-val">${report.cycles?.avgPeriodDurationDays ?? '—'} gün</div><div class="stat-lbl">Ortalama Kanama</div></div>
      <div class="stat"><div class="stat-val">${report.cycles?.recordedCount ?? 0}</div><div class="stat-lbl">Kayıtlı Döngü</div></div>
    </div>
  </div>
  <div class="card">
    <h2>Öne Çıkan Semptomlar (${days} Gün)</h2>
    <ul>${topSymptomsHtml}</ul>
    <h2>Ruh Hali Dağılımı</h2>
    <ul>${topMoodsHtml}</ul>
  </div>
  <div class="card">
    <h2>Wellness Ortalamaları</h2>
    <p>Günlük Ortalama Su: <strong>${report.wellness?.avgDailyWaterMl ?? 0} / ${report.wellness?.waterTargetMl ?? 2000} ml</strong></p>
    <p>Ortalama Uyku: <strong>${report.wellness?.avgSleepHours ?? '—'} saat</strong></p>
    <p>Ortalama Adım: <strong>${report.wellness?.avgDailySteps ?? '—'}</strong></p>
  </div>
</body>
</html>`;

      const canShare = await Sharing.isAvailableAsync();
      try {
        const { uri } = await Print.printToFileAsync({ html });
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Klinik Sağlık Raporu (PDF)',
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Hazır', 'PDF raporu oluşturuldu.');
        }
      } catch {
        const fileUri = `${cacheDirectory}kadin-atlasi-klinik-rapor-${days}gun.html`;
        await writeAsStringAsync(fileUri, html);
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'text/html',
            dialogTitle: 'Yazdırılabilir Klinik Rapor',
          });
        } else {
          Alert.alert('Hazır', 'Rapor oluşturuldu.');
        }
      }
    } catch {
      Alert.alert('Hata', 'Klinik rapor dosyası oluşturulamadı.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sağlık & Doktor Raporu</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareHeaderBtn}>
          <Ionicons name="share-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Period Filter */}
        <View style={styles.periodRow}>
          {([30, 90] as const).map((option) => {
            const locked90 = option === 90 && !isPremium;
            return (
              <TouchableOpacity
                key={option}
                style={[styles.periodBtn, days === option && styles.periodBtnActive]}
                onPress={() => {
                  if (locked90) {
                    setPromptFeature({
                      feature: '90 Günlük Uzun Dönem Klinik Analiz',
                      description:
                        'Son 3 aylık döngü, semptom ve wellness trendlerini görmek için Premium üyeliği 7 gün ücretsiz dene.',
                    });
                    setPromptVisible(true);
                    return;
                  }
                  setDays(option);
                }}
              >
                <Text style={[styles.periodBtnText, days === option && styles.periodBtnTextActive]}>
                  Son {option} Gün {locked90 ? '👑' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading && !report ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Sağlık raporun hazırlanıyor...</Text>
          </View>
        ) : report ? (
          <View style={styles.content}>
            {/* Share & Clinic Print CTA */}
            <View style={{ gap: 8 }}>
              <TouchableOpacity style={styles.shareBanner} onPress={handleShare}>
                <View style={styles.shareBannerLeft}>
                  <Text style={styles.shareBannerTitle}>Doktor Ziyareti Özeti Hazır 📋</Text>
                  <Text style={styles.shareBannerSub}>
                    Döngü, semptom ve wellness ortalamalarını tek dokunuşla paylaş.
                  </Text>
                </View>
                <View style={styles.sharePill}>
                  <Text style={styles.sharePillText}>Metin Paylaş</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareBanner, { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.35)' }]}
                onPress={handleExportClinicReport}
              >
                <View style={styles.shareBannerLeft}>
                  <Text style={styles.shareBannerTitle}>
                    Yazdırılabilir Klinik Rapor 📄 {!isPremium ? '👑' : ''}
                  </Text>
                  <Text style={styles.shareBannerSub}>
                    Doktor muayenesi için düzenli HTML/PDF çıktı olarak kaydet veya yazdır.
                  </Text>
                </View>
                <View style={[styles.sharePill, { backgroundColor: '#8B5CF6' }]}>
                  <Text style={styles.sharePillText}>
                    {isPremium ? 'Dışa Aktar' : 'Premium'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Cycles Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🌸 Döngü Özeti (Son 6 Ay)</Text>
              <View style={styles.gridRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {report.cycles?.avgCycleLengthDays ? `${report.cycles.avgCycleLengthDays} gün` : '—'}
                  </Text>
                  <Text style={styles.metricLabel}>Ort. Döngü</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {report.cycles?.avgPeriodDurationDays ? `${report.cycles.avgPeriodDurationDays} gün` : '—'}
                  </Text>
                  <Text style={styles.metricLabel}>Ort. Kanama</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>{report.cycles?.recordedCount ?? 0}</Text>
                  <Text style={styles.metricLabel}>Kayıtlı Döngü</Text>
                </View>
              </View>
              {report.cycles?.lastPeriodStart && (
                <Text style={styles.metaNote}>
                  Son adet başlangıcı:{' '}
                  {new Date(report.cycles.lastPeriodStart).toLocaleDateString('tr-TR')}
                </Text>
              )}
            </View>

            {/* Symptoms & Mood Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🩺 Semptom & Ruh Hali ({days} Gün)</Text>
              <Text style={styles.metaNote}>
                Toplam Check-in Günü: {report.symptomsAndMood?.checkinDays ?? 0}
                {report.symptomsAndMood?.avgCrampsLevel != null
                  ? ` • Ort. Kramp: ${report.symptomsAndMood.avgCrampsLevel}/5`
                  : ''}
              </Text>

              <Text style={styles.subLabel}>En Sık Belirtiler</Text>
              {report.symptomsAndMood?.topSymptoms?.length > 0 ? (
                <View style={styles.chipsWrap}>
                  {report.symptomsAndMood.topSymptoms.map((s: any) => (
                    <View key={s.name} style={styles.chip}>
                      <Text style={styles.chipText}>
                        {s.name} ({s.count})
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyNote}>Bu aralıkta semptom kaydı bulunmuyor.</Text>
              )}

              <Text style={[styles.subLabel, { marginTop: 12 }]}>Ruh Hali Dağılımı</Text>
              {report.symptomsAndMood?.topMoods?.length > 0 ? (
                <View style={styles.chipsWrap}>
                  {report.symptomsAndMood.topMoods.map((m: any) => (
                    <View key={m.name} style={styles.chip}>
                      <Text style={styles.chipText}>
                        {m.name} ({m.count})
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyNote}>Bu aralıkta ruh hali kaydı bulunmuyor.</Text>
              )}
            </View>

            {/* Wellness Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>💧 Wellness & Alışkanlıklar ({days} Gün)</Text>
              <View style={styles.wellnessList}>
                <View style={styles.wellnessRow}>
                  <Text style={styles.wellnessLabel}>💧 Günlük Ortalama Su</Text>
                  <Text style={styles.wellnessVal}>
                    {report.wellness?.avgDailyWaterMl ?? 0} / {report.wellness?.waterTargetMl ?? 2000} ml
                  </Text>
                </View>
                <View style={styles.wellnessRow}>
                  <Text style={styles.wellnessLabel}>🎯 Su Hedefine Ulaşılan Gün</Text>
                  <Text style={styles.wellnessVal}>{report.wellness?.waterGoalMetDays ?? 0} gün</Text>
                </View>
                <View style={styles.wellnessRow}>
                  <Text style={styles.wellnessLabel}>🌙 Ortalama Uyku</Text>
                  <Text style={styles.wellnessVal}>
                    {report.wellness?.avgSleepHours ? `${report.wellness.avgSleepHours} saat` : '—'}
                  </Text>
                </View>
                <View style={styles.wellnessRow}>
                  <Text style={styles.wellnessLabel}>👟 Ortalama Adım</Text>
                  <Text style={styles.wellnessVal}>
                    {report.wellness?.avgDailySteps
                      ? `${report.wellness.avgDailySteps.toLocaleString('tr-TR')} adım`
                      : '—'}
                  </Text>
                </View>
                <View style={[styles.wellnessRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.wellnessLabel}>🧘‍♀️ Meditasyon & Nefes</Text>
                  <Text style={styles.wellnessVal}>
                    {report.wellness?.totalMeditationMin ?? 0} dk ({report.wellness?.meditationSessions ?? 0} seans)
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <UpgradePrompt
        visible={promptVisible}
        onClose={() => setPromptVisible(false)}
        feature={promptFeature.feature}
        description={promptFeature.description}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backBtn: { padding: 4 },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.text,
    },
    shareHeaderBtn: { padding: 4 },
    container: { flex: 1 },
    periodRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 14,
    },
    periodBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    periodBtnActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    periodBtnText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    periodBtnTextActive: {
      color: '#FFFFFF',
    },
    loadingBox: {
      paddingVertical: 60,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    content: {
      padding: 16,
      gap: 14,
    },
    shareBanner: {
      backgroundColor: `${theme.colors.primary}15`,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: `${theme.colors.primary}40`,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    shareBannerLeft: { flex: 1 },
    shareBannerTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
    },
    shareBannerSub: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 3,
      lineHeight: 17,
    },
    sharePill: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    sharePillText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 13,
    },
    card: {
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 12,
    },
    gridRow: {
      flexDirection: 'row',
      gap: 8,
    },
    metricBox: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      padding: 10,
      alignItems: 'center',
    },
    metricValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    metricLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    metaNote: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
    subLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: 10,
      marginBottom: 6,
    },
    chipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipText: {
      fontSize: 12,
      color: theme.colors.text,
      fontWeight: '500',
    },
    emptyNote: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    wellnessList: {
      gap: 2,
    },
    wellnessRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    wellnessLabel: {
      fontSize: 13,
      color: theme.colors.text,
      fontWeight: '500',
    },
    wellnessVal: {
      fontSize: 13,
      color: theme.colors.primary,
      fontWeight: '700',
    },
  });
