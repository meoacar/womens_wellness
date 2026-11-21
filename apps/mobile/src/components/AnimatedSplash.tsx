import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, Animated, StatusBar, Modal } from 'react-native';

interface AnimatedSplashProps {
    onAnimationEnd?: () => void;
}

export function AnimatedSplash({ onAnimationEnd }: AnimatedSplashProps) {
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const hasEnded = useRef(false);
    const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Single function to end animation
    const endAnimation = () => {
        if (hasEnded.current) return;
        hasEnded.current = true;
        if (loadTimerRef.current) {
            clearTimeout(loadTimerRef.current);
            loadTimerRef.current = null;
        }
        console.log('[Splash] Animation ending');

        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            if (onAnimationEnd) {
                onAnimationEnd();
            }
        });
    };

    // Absolute maximum timeout - 4 seconds (extended by +2s)
    useEffect(() => {
        const maxTimeout = setTimeout(() => {
            console.log('[Splash] Max timeout reached');
            endAnimation();
        }, 4000);

        return () => {
            clearTimeout(maxTimeout);
            if (loadTimerRef.current) {
                clearTimeout(loadTimerRef.current);
            }
        };
    }, []);

    return (
        <Modal
            visible
            transparent
            animationType="none"
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
        >
            <Animated.View
                style={[
                    styles.container,
                    { opacity: fadeAnim },
                ]}
            >
                <StatusBar hidden translucent animated />
                <Image
                    source={require('../../assets/images/mascots/scbaby.gif')}
                    style={styles.gif}
                    resizeMode="cover"
                    onError={() => {
                        console.log('[Splash] Image error');
                        endAnimation();
                    }}
                    onLoad={() => {
                        console.log('[Splash] Image loaded');
                        // End after 3 seconds of showing (+2s extended)
                        if (!loadTimerRef.current) {
                            loadTimerRef.current = setTimeout(endAnimation, 3000);
                        }
                    }}
                />
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#5EB5F7',
    },
    gif: {
        width: '100%',
        height: '100%',
    },
});
