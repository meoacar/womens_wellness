import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface WellnessTileProps {
  icon?: string;
  ionicon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: string;
  target?: string;
  percentage?: number;
  accentColor?: string;
  gradientColors?: readonly [string, string];
  onPress?: () => void;
  actions?: React.ReactNode;
  emptyState?: string;
  isEmpty?: boolean;
}

export const WellnessTile: React.FC<WellnessTileProps> = ({
  icon,
  ionicon,
  title,
  subtitle,
  value,
  target,
  percentage,
  accentColor,
  gradientColors,
  onPress,
  actions,
  emptyState,
  isEmpty = false,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);

  const accent = accentColor || theme.colors.primary;
  const resolvedGradient: readonly [string, string] =
    gradientColors ||
    (theme.isDark
      ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']
      : ['#FFFFFF', '#F8FAFC']);

  const pctClamped =
    percentage !== undefined && percentage >= 0 ? Math.min(percentage, 100) : undefined;

  return (
    <TouchableOpacity
      style={s.outerTouch}
      onPress={onPress}
      activeOpacity={onPress ? 0.82 : 1}
      disabled={!onPress}
    >
      <LinearGradient
        colors={resolvedGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.tile, { borderColor: `${accent}30` }]}
      >
        <View style={s.header}>
          <View style={s.titleRow}>
            <View style={[s.iconHalo, { backgroundColor: `${accent}1A` }]}>
              {ionicon ? (
                <Ionicons name={ionicon} size={18} color={accent} />
              ) : (
                <Text style={s.icon}>{icon || '✨'}</Text>
              )}
            </View>
            <View style={s.titleContainer}>
              <Text style={s.title} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={s.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {pctClamped !== undefined && !isEmpty ? (
              <View style={[s.pctPill, { backgroundColor: `${accent}18` }]}>
                <Text style={[s.pctPillText, { color: accent }]}>
                  {pctClamped >= 100 ? '✓' : `%${pctClamped}`}
                </Text>
              </View>
            ) : (
              <Ionicons
                name="chevron-forward"
                size={14}
                color={theme.colors.textLight}
              />
            )}
          </View>
        </View>

        {isEmpty ? (
          <View style={s.content}>
            <View style={s.emptyContainer}>
              <Text style={s.emptyText}>{emptyState}</Text>
            </View>
            {actions && <View style={s.actions}>{actions}</View>}
          </View>
        ) : (
          <View style={s.content}>
            {pctClamped !== undefined && (
              <View style={s.progressContainer}>
                <View style={s.progressBar}>
                  <View
                    style={[
                      s.progressFill,
                      {
                        width: `${pctClamped}%`,
                        backgroundColor: pctClamped >= 100 ? '#10B981' : accent,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <View style={s.valueRow}>
              <Text style={s.value} numberOfLines={1}>
                {value}
              </Text>
              {target && (
                <Text style={s.target} numberOfLines={1}>
                  {target}
                </Text>
              )}
            </View>

            {actions && <View style={s.actions}>{actions}</View>}
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    outerTouch: {
      flex: 1,
    },
    tile: {
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      minHeight: 168,
      flex: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.isDark ? 0.2 : 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    header: {
      marginBottom: 10,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconHalo: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      fontSize: 17,
    },
    titleContainer: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text,
    },
    subtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
    pctPill: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
    },
    pctPillText: {
      fontSize: 10.5,
      fontWeight: '800',
    },
    content: {
      flex: 1,
      justifyContent: 'space-between',
    },
    progressContainer: {
      marginBottom: 8,
    },
    progressBar: {
      height: 6,
      backgroundColor: theme.isDark
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(15,23,42,0.07)',
      borderRadius: 999,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
    },
    valueRow: {
      marginBottom: 6,
    },
    value: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    target: {
      fontSize: 11.5,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingVertical: 6,
    },
    emptyText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 16,
    },
    actions: {
      marginTop: 4,
    },
  });
