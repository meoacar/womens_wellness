import { Tabs } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

export default function TabLayout() {
  const theme = useTheme();
  const { flags } = useFeatureFlags();
  const insets = useSafeAreaInsets();
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


