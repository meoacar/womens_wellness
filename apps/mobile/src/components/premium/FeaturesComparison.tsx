import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import type { PremiumComparisonRow } from '@/types/subscription';

const DEFAULT_ROWS: PremiumComparisonRow[] = [
    { id: 'c1', icon: 'sparkles', color: '#8B5CF6', title: 'AI Modeli', freeValue: 'Temel', premiumValue: 'Gelişmiş', isActive: true },
    { id: 'c2', icon: 'chatbubbles-outline', color: '#3B82F6', title: 'Aylık Mesaj', freeValue: '100', premiumValue: '1000+', isActive: true },
    { id: 'c3', icon: 'flash-outline', color: '#F59E0B', title: 'Yanıt Hızı', freeValue: 'Normal', premiumValue: 'Öncelikli', isActive: true },
    { id: 'c4', icon: 'bulb-outline', color: '#EC4899', title: 'Kişisel İçgörüler', freeValue: false, premiumValue: true, isActive: true },
    { id: 'c5', icon: 'planet-outline', color: '#6366F1', title: 'Derin Astroloji', freeValue: false, premiumValue: true, isActive: true },
    { id: 'c6', icon: 'hardware-chip-outline', color: '#10B981', title: 'Gelişmiş Hafıza', freeValue: false, premiumValue: true, isActive: true },
    { id: 'c7', icon: 'images-outline', color: '#EC4899', title: 'Toplulukta Resim Ekleme', freeValue: 'Haftada 2 Resim', premiumValue: 'Haftada 5 Resim', isActive: true },
    { id: 'c8', icon: 'sparkles', color: '#F59E0B', title: 'Topluluk PRO Üye Rozeti', freeValue: false, premiumValue: true, isActive: true },
];

export function FeaturesComparison({ rows }: { rows?: PremiumComparisonRow[] }) {
    const theme = useTheme();
    const styles = createStyles(theme);
    const activeRows = (rows && rows.length > 0 ? rows : DEFAULT_ROWS).filter(
        (r) => r.isActive !== false,
    );

    if (activeRows.length === 0) return null;

    const renderValue = (value: string | boolean, isPremiumCol: boolean) => {
        if (typeof value === 'boolean') {
            return (
                <Ionicons
                    name={value ? 'checkmark-circle' : 'remove-outline'}
                    size={19}
                    color={value ? '#10B981' : theme.colors.textLight}
                />
            );
        }
        return (
            <Text style={[styles.valueText, isPremiumCol && styles.premiumValueText]}>
                {value}
            </Text>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ücretsiz vs Premium</Text>

            <View style={styles.headerRow}>
                <View style={styles.featureColumn}>
                    <Text style={styles.colLabel}>Özellik</Text>
                </View>
                <View style={styles.planColumn}>
                    <Text style={styles.planHeader}>Standart</Text>
                </View>
                <View style={[styles.planColumn, styles.premiumHeaderBox]}>
                    <Text style={[styles.planHeader, styles.premiumHeader]}>Premium</Text>
                </View>
            </View>

            {activeRows.map((feature, index) => (
                <View
                    key={feature.id || feature.title}
                    style={[
                        styles.featureRow,
                        index === activeRows.length - 1 && styles.featureRowLast,
                    ]}
                >
                    <View style={styles.featureColumn}>
                        <View style={[styles.iconBox, { backgroundColor: `${feature.color || '#8B5CF6'}15` }]}>
                            <Ionicons
                                name={(feature.icon as keyof typeof Ionicons.glyphMap) || 'sparkles'}
                                size={15}
                                color={feature.color || '#8B5CF6'}
                            />
                        </View>
                        <Text style={styles.featureTitle}>{feature.title}</Text>
                    </View>
                    <View style={styles.planColumn}>{renderValue(feature.freeValue, false)}</View>
                    <View style={[styles.planColumn, styles.premiumColumn]}>
                        {renderValue(feature.premiumValue, true)}
                    </View>
                </View>
            ))}
        </View>
    );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
        container: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        title: {
            fontSize: 16.5,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 14,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },
        colLabel: {
            fontSize: 11.5,
            fontWeight: '700',
            color: theme.colors.textLight,
            textTransform: 'uppercase',
        },
        featureRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 11,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },
        featureRowLast: {
            borderBottomWidth: 0,
            paddingBottom: 2,
        },
        featureColumn: {
            flex: 2.1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
        },
        iconBox: {
            width: 28,
            height: 28,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
        },
        planColumn: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 4,
        },
        premiumHeaderBox: {
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderRadius: 8,
        },
        premiumColumn: {
            backgroundColor: 'rgba(139, 92, 246, 0.06)',
            borderRadius: 8,
        },
        planHeader: {
            fontSize: 11,
            color: theme.colors.textSecondary,
            fontWeight: '700',
            textTransform: 'uppercase',
        },
        premiumHeader: {
            color: theme.colors.primary,
        },
        featureTitle: {
            fontSize: 13.5,
            fontWeight: '600',
            color: theme.colors.text,
            flex: 1,
        },
        valueText: {
            fontSize: 12.5,
            color: theme.colors.textSecondary,
            fontWeight: '600',
        },
        premiumValueText: {
            color: theme.colors.primary,
            fontWeight: '700',
        },
    });
