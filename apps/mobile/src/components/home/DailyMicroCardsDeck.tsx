import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';
import { useTheme } from '@/hooks/useTheme';
import { StoryShareModal } from './StoryShareModal';

const TONE_STORAGE_KEY = '@daily_micro_card_tone';

export interface DailyMicroCardItem {
  id: string;
  phase: string;
  tone: 'fun' | 'scientific';
  badge: string;
  title: string;
  body: string;
  novaPrompt: string;
  gradientFrom: string;
  gradientTo: string;
  icon: string;
}

interface DailyMicroCardsDeckProps {
  phase?: string;
  isAuthenticated: boolean;
}

export function DailyMicroCardsDeck({
  phase,
  isAuthenticated,
}: DailyMicroCardsDeckProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const [tone, setTone] = useState<'fun' | 'scientific'>('fun');
  const [shareCard, setShareCard] = useState<DailyMicroCardItem | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(TONE_STORAGE_KEY)
      .then((val) => {
        if (val === 'scientific' || val === 'fun') {
          setTone(val);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleTone = (nextTone: 'fun' | 'scientific') => {
    setTone(nextTone);
    AsyncStorage.setItem(TONE_STORAGE_KEY, nextTone).catch(() => {});
  };

  const { data: cards } = useQuery<DailyMicroCardItem[]>({
    queryKey: ['home', 'daily-cards', phase || 'GENERAL', tone],
    queryFn: () =>
      api.get<DailyMicroCardItem[]>(
        `/home/daily-cards?phase=${encodeURIComponent(phase || 'GENERAL')}&tone=${tone}`,
      ),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  if (!cards || cards.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles" size={16} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Günün Kartları</Text>
        </View>

        <View style={styles.toneTrack}>
          <TouchableOpacity
            style={[styles.toneBtn, tone === 'fun' && styles.toneBtnActive]}
            onPress={() => handleToggleTone('fun')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.toneText,
                tone === 'fun' && styles.toneTextActive,
              ]}
            >
              Samimi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toneBtn,
              tone === 'scientific' && styles.toneBtnActive,
            ]}
            onPress={() => handleToggleTone('scientific')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.toneText,
                tone === 'scientific' && styles.toneTextActive,
              ]}
            >
              Bilimsel
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsScroll}
        decelerationRate="fast"
        snapToInterval={292}
      >
        {cards.map((card) => (
          <LinearGradient
            key={card.id}
            colors={[card.gradientFrom || '#EC4899', card.gradientTo || '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.cardOrb} />
            <View style={styles.cardTop}>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>{card.badge}</Text>
              </View>
              <Ionicons
                name={(card.icon as any) || 'sparkles-outline'}
                size={18}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.cardBodyWrap}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {card.title}
              </Text>
              <Text style={styles.cardBody} numberOfLines={3}>
                {card.body}
              </Text>
            </View>

            <View style={styles.cardFooterRow}>
              <TouchableOpacity
                style={styles.novaBtn}
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/chat',
                    params: { initialPrompt: card.novaPrompt },
                  })
                }
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={13} color="#FFFFFF" />
                <Text style={styles.novaBtnText}>NOVA&apos;ya Sor</Text>
                <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sharePillBtn}
                onPress={() => setShareCard(card)}
                activeOpacity={0.85}
              >
                <Ionicons name="share-social-outline" size={14} color="#FFFFFF" />
                <Text style={styles.novaBtnText}>Hikaye</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        ))}
      </ScrollView>

      <StoryShareModal
        visible={Boolean(shareCard)}
        card={shareCard}
        onClose={() => setShareCard(null)}
      />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      marginBottom: 14,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.text,
    },
    toneTrack: {
      flexDirection: 'row',
      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
      borderRadius: 999,
      padding: 2,
    },
    toneBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    toneBtnActive: {
      backgroundColor: theme.colors.primary,
    },
    toneText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    toneTextActive: {
      color: '#FFFFFF',
    },
    cardsScroll: {
      paddingHorizontal: 20,
      gap: 12,
    },
    card: {
      width: 280,
      minHeight: 164,
      borderRadius: 22,
      padding: 16,
      justifyContent: 'space-between',
      overflow: 'hidden',
      position: 'relative',
    },
    cardOrb: {
      position: 'absolute',
      top: -24,
      right: -24,
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    badgePill: {
      backgroundColor: 'rgba(255,255,255,0.22)',
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    cardBodyWrap: {
      marginBottom: 12,
    },
    cardTitle: {
      color: '#FFFFFF',
      fontSize: 15.5,
      fontWeight: '800',
      marginBottom: 4,
    },
    cardBody: {
      color: 'rgba(255,255,255,0.92)',
      fontSize: 12.5,
      lineHeight: 17.5,
    },
    cardFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    novaBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(0,0,0,0.22)',
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
    },
    sharePillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(255,255,255,0.22)',
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
    },
    novaBtnText: {
      color: '#FFFFFF',
      fontSize: 11.5,
      fontWeight: '700',
    },
  });
