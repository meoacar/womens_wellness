import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

export interface StatusPillProps {
  icon?: string;
  ionicon?: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  subtitle?: string;
  badgeText?: string;
  accentColor?: string;
  gradientColors?: readonly [string, string];
  progressPct?: number;
  featured?: boolean;
  onPress?: () => void;
}

export function StatusPill({
  icon,
  ionicon,
  title,
  value,
  subtitle,
  badgeText,
  accentColor,
  gradientColors,
  progressPct,
  featured = false,
  onPress,
}: StatusPillProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const primaryAccent = accentColor || theme.colors.primary;
  const resolvedGradient: readonly [string, string] =
    gradientColors ||
    (theme.isDark
      ? ['rgba(236, 72, 153, 0.14)', 'rgba(147, 51, 234, 0.08)']
      : ['#FFF7FB', '#FFFFFF']);

  return (
    <TouchableOpacity
      style={[styles.wrapper, featured && styles.wrapperFeatured]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <LinearGradient
        colors={resolvedGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.container,
          featured && styles.containerFeatured,
          { borderColor: `${primaryAccent}33` },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.leftTitleGroup}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: `${primaryAccent}1A` },
              ]}
            >
              {ionicon ? (
                <Ionicons name={ionicon} size={17} color={primaryAccent} />
              ) : (
                <Text style={styles.emojiIcon}>{icon || '✨'}</Text>
              )}
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </View>

          <View style={styles.rightMeta}>
            {badgeText ? (
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: `${primaryAccent}18` },
                ]}
              >
                <Text
                  style={[styles.badgeText, { color: primaryAccent }]}
                  numberOfLines={1}
                >
                  {badgeText}
                </Text>
              </View>
            ) : null}
            <Ionicons
              name="chevron-forward"
              size={15}
              color={theme.colors.textLight}
            />
          </View>
        </View>

        <View style={featured ? styles.featuredBody : undefined}>
          <Text style={[styles.value, { color: theme.colors.text }]} numberOfLines={1}>
            {value}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {typeof progressPct === 'number' && (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, Math.max(4, progressPct))}%`,
                  backgroundColor: primaryAccent,
                },
              ]}
            />
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      minWidth: 0,
    },
    wrapperFeatured: {
      flex: undefined,
      width: '100%',
    },
    container: {
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.isDark ? 0.2 : 0.05,
      shadowRadius: 10,
      elevation: 2,
      gap: 10,
    },
    containerFeatured: {
      padding: 16,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    leftTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    iconBadge: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiIcon: {
      fontSize: 16,
    },
    title: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      flex: 1,
    },
    rightMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    badgePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      maxWidth: 96,
    },
    badgeText: {
      fontSize: 10.5,
      fontWeight: '800',
    },
    featuredBody: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 10,
    },
    value: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    progressTrack: {
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(15,23,42,0.07)',
      overflow: 'hidden',
      marginTop: 2,
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
  });
