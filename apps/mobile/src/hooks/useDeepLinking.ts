import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

/**
 * Deep linking hook
 * Handles URL scheme (wellness://) and universal links (https://wellness-companion.app)
 */
export function useDeepLinking() {
    const router = useRouter();

    useEffect(() => {
        // Handle initial URL (app opened via deep link)
        const handleInitialURL = async () => {
            const url = await Linking.getInitialURL();
            if (url) {
                console.log('[DeepLink] Initial URL:', url);
                handleDeepLink(url);
            }
        };

        // Handle URL changes (app already open)
        const subscription = Linking.addEventListener('url', (event) => {
            console.log('[DeepLink] URL received:', event.url);
            handleDeepLink(event.url);
        });

        handleInitialURL();

        return () => {
            subscription.remove();
        };
    }, []);

    /**
     * Parse and handle deep link URL
     */
    const handleDeepLink = (url: string) => {
        try {
            const { hostname, path, queryParams } = Linking.parse(url);

            console.log('[DeepLink] Parsed:', { hostname, path, queryParams });

            // Ignore empty Expo Go launch URLs (exp://127.0.0.1:8081)
            const isExpoGoUrl = url.startsWith('exp://');
            if (isExpoGoUrl && (!path || path === '/' || path === '--/')) {
                return;
            }

            // Remove leading slash or fallback to custom-scheme hostname (e.g. wellness://calendar)
            const rawClean = path && path !== '/' && path !== '--/'
                ? (path.startsWith('/') ? path.slice(1) : path)
                : '';
            const cleanPath =
                rawClean || (hostname && hostname !== 'kadinatlasi.com' ? hostname : '');

            if (!cleanPath) {
                return;
            }

            switch (cleanPath) {
                // Ana ekranlar
                case 'home':
                    router.push('/(tabs)/home');
                    break;

                case 'calendar':
                    router.push('/(tabs)/calendar');
                    break;

                case 'chat':
                    router.push('/(tabs)/chat');
                    break;

                case 'community':
                    router.push('/(tabs)/community');
                    break;

                case 'profile':
                    router.push('/(tabs)/profile');
                    break;

                // Premium
                case 'premium':
                    router.push('/premium');
                    break;

                // Hamilelik
                case 'pregnancy':
                    router.push('/pregnancy');
                    break;

                case 'pregnancy/week':
                    router.push('/pregnancy/week');
                    break;

                case 'pregnancy/appointments':
                    router.push('/pregnancy/appointments');
                    break;

                case 'pregnancy/birth-plan':
                    router.push('/pregnancy/birth-plan');
                    break;

                case 'pregnancy/hospital-bag':
                    router.push('/pregnancy/hospital-bag');
                    break;

                case 'pregnancy/contraction-timer':
                    router.push('/pregnancy/contraction-timer');
                    break;

                // Wellness
                case 'wellness':
                    router.push('/wellness');
                    break;

                case 'wellness/steps':
                    router.push('/wellness/steps');
                    break;

                case 'wellness/meditation':
                    router.push('/wellness/meditation');
                    break;

                case 'wellness/sleep':
                    router.push('/wellness/sleep');
                    break;

                case 'water':
                    router.push('/water');
                    break;

                // Astroloji
                case 'astrology':
                    router.push('/astrology');
                    break;

                // Keşfet
                case 'discover':
                    router.push('/discover');
                    break;

                // Eğlenceli bildirimler
                case 'fun-notifications':
                    router.push('/fun-notifications');
                    break;

                // Gamification
                case 'gamification':
                    router.push('/gamification');
                    break;

                // Metrikler
                case 'metrics':
                    router.push('/metrics');
                    break;

                // Ayarlar
                case 'settings':
                    router.push('/settings');
                    break;

                case 'settings/profile':
                    router.push('/settings/profile');
                    break;

                case 'settings/notifications':
                    router.push('/settings/notifications');
                    break;

                case 'settings/privacy':
                    router.push('/settings/privacy');
                    break;

                case 'settings/about':
                    router.push('/settings/about');
                    break;

                case 'settings/help':
                    router.push('/settings/help');
                    break;

                // Topluluk - Soru detayı
                case 'community/question':
                    if (queryParams?.id) {
                        router.push(`/(tabs)/community/${queryParams.id}`);
                    } else {
                        router.push('/(tabs)/community');
                    }
                    break;

                // Topluluk - Kullanıcı soruları
                case 'community/my-questions':
                    router.push('/(tabs)/community/my-questions');
                    break;

                // Topluluk - Soru sor
                case 'community/ask':
                    router.push('/(tabs)/community/ask');
                    break;

                // Dinamik slug sayfaları (makaleler)
                default:
                    // Eğer path bir slug gibi görünüyorsa
                    if (cleanPath && !cleanPath.includes('/')) {
                        router.push(`/${cleanPath}`);
                    } else {
                        // Bilinmeyen path, ana sayfaya yönlendir
                        console.warn('[DeepLink] Unknown path:', cleanPath);
                        router.push('/(tabs)/home');
                    }
                    break;
            }
        } catch (error) {
            console.error('[DeepLink] Error handling deep link:', error);
            router.push('/(tabs)/home');
        }
    };

    return {
        handleDeepLink,
    };
}
