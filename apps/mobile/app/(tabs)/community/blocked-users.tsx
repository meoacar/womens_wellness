import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useBlockedUsers, useUnblockUser } from '@/hooks/useQna';
import { OptimizedAvatar } from '@/components/qna';

export default function BlockedUsersScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { data: blockedUsers = [], isLoading, refetch } = useBlockedUsers();
    const unblockMutation = useUnblockUser();

    const handleUnblock = (targetUserId: string, displayName: string) => {
        Alert.alert(
            'Engeli Kaldır',
            `${displayName} adlı kullanıcının engelini kaldırmak istediğinize emin misiniz?`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Engeli Kaldır',
                    onPress: async () => {
                        try {
                            await unblockMutation.mutateAsync(targetUserId);
                            await refetch();
                        } catch (error: any) {
                            Alert.alert('Hata', error?.message || 'Engel kaldırılamadı');
                        }
                    },
                },
            ],
        );
    };

    const styles = createStyles(theme);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Engellenen Kullanıcılar</Text>
                <View style={{ width: 38 }} />
            </View>

            {isLoading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={blockedUsers}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={
                        blockedUsers.length === 0 ? styles.emptyContainer : styles.listContent
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <View style={styles.emptyIconWrap}>
                                <Ionicons
                                    name="shield-checkmark-outline"
                                    size={36}
                                    color={theme.colors.primary}
                                />
                            </View>
                            <Text style={styles.emptyTitle}>Engellenen Kullanıcı Yok</Text>
                            <Text style={styles.emptyDesc}>
                                Toplulukta engellediğiniz kullanıcılar burada listelenir. Engellediğiniz kişilerin içerikleri size gösterilmez.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <OptimizedAvatar
                                imageUrl={item.profilePictureUrl ?? undefined}
                                displayName={item.displayName}
                                size={42}
                            />
                            <View style={styles.info}>
                                <Text style={styles.name} numberOfLines={1}>
                                    {item.displayName}
                                </Text>
                                <Text style={styles.date}>
                                    {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.unblockBtn}
                                onPress={() => handleUnblock(item.blockedUserId, item.displayName)}
                                disabled={unblockMutation.isPending}
                            >
                                <Text style={styles.unblockText}>Engeli Kaldır</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
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
            backgroundColor: theme.colors.backgroundCard,
        },
        backBtn: {
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.backgroundSecondary,
        },
        headerTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.colors.text,
        },
        centerBox: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        listContent: {
            padding: 16,
            gap: 12,
        },
        emptyContainer: {
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
        },
        emptyBox: {
            alignItems: 'center',
        },
        emptyIconWrap: {
            width: 68,
            height: 68,
            borderRadius: 34,
            backgroundColor: theme.colors.primary + '15',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
        },
        emptyTitle: {
            fontSize: 17,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 6,
        },
        emptyDesc: {
            fontSize: 13,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            lineHeight: 19,
        },
        card: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            borderRadius: 14,
            backgroundColor: theme.colors.backgroundCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 12,
        },
        info: {
            flex: 1,
        },
        name: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.colors.text,
        },
        date: {
            fontSize: 12,
            color: theme.colors.textSecondary,
            marginTop: 2,
        },
        unblockBtn: {
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: theme.colors.primary + '18',
        },
        unblockText: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.colors.primary,
        },
    });
