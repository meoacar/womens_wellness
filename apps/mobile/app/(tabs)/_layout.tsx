import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useAuthStore } from '@/store/authStore';
import { qnaService } from '@/services/api';

export default function TabLayout() {
  const theme = useTheme();
  const { flags } = useFeatureFlags();
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const { data: unreadData } = useQuery({
    queryKey: ['qna', 'unread-count'],
    queryFn: () => qnaService.getUnreadNotificationCount(),
    enabled: isAuthenticated && flags.community_enabled !== false,
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
  });

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as any;
      if (data?.type === 'qna') {
        queryClient.invalidateQueries({ queryKey: ['qna', 'unread-count'] });
      }
    });
    return () => sub.remove();
  }, [queryClient]);

  const unreadQnaCount = unreadData?.unreadCount ?? 0;
  const bottomInset =
    Platform.OS === 'ios'
      ? Math.max(insets.bottom, 24)
      : Math.max(insets.bottom, 10);
  const tabBarHeight = 60 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textLight,
        headerShown: false,
        tabBarHideOnKeyboard: Platform.OS === 'android',
        tabBarStyle: {
          backgroundColor: theme.colors.backgroundCard,
          borderTopColor: theme.colors.border,
          borderTopWidth: 0.5,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
          ...Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {},
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: focused ? theme.colors.primary + '20' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Text style={{ fontSize: 20 }}>🏠</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Takvim',
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: focused ? theme.colors.primary + '20' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Text style={{ fontSize: 20 }}>📅</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Topluluk',
          href: flags.community_enabled === false ? null : undefined,
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: focused ? theme.colors.primary + '20' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Text style={{ fontSize: 20 }}>👥</Text>
              {unreadQnaCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -3,
                    right: -6,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: '#EF4444',
                    borderWidth: 1.5,
                    borderColor: theme.colors.backgroundCard,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontSize: 10,
                      fontWeight: '800',
                      lineHeight: 12,
                    }}
                  >
                    {unreadQnaCount > 9 ? '9+' : String(unreadQnaCount)}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="qna"
        options={{
          href: null, // Hide old QnA tab
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'NOVA',
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: focused ? theme.colors.primary + '20' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Text style={{ fontSize: 20 }}>✨</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}


