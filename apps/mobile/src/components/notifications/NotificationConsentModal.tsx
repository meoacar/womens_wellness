import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface NotificationConsentModalProps {
  visible: boolean;
  onAllow: () => Promise<void> | void;
  onDecline: () => Promise<void> | void;
}

export function NotificationConsentModal({
  visible,
  onAllow,
  onDecline,
}: NotificationConsentModalProps) {
  const theme = useTheme();
  const [submitting, setSubmitting] = useState(false);

  const handleAllow = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onAllow();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (submitting) return;
    await onDecline();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDecline}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.backgroundCard,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <LinearGradient
            colors={['#EC4899', '#9333EA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Ionicons name="notifications" size={28} color="#FFFFFF" />
          </LinearGradient>

          <Text style={[styles.title, { color: theme.colors.text }]}>
            Bildirimlere İzin Ver
          </Text>

          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Döngü tahminleri, su/ilaç hatırlatıcıları ve önemli sağlık uyarıları
            için cihaz bildirim iznine ihtiyacımız var.
          </Text>

          <View
            style={[
              styles.privacyBox,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(16, 185, 129, 0.12)'
                  : '#ECFDF5',
              },
            ]}
          >
            <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            <Text style={[styles.privacyText, { color: theme.colors.textSecondary }]}>
              Kilit ekranında hassas sağlık detayların gizli tutulur. İstediğin
              zaman Ayarlar'dan kapatabilirsin.
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            disabled={submitting}
            onPress={handleAllow}
            style={styles.allowBtnWrap}
          >
            <LinearGradient
              colors={['#EC4899', '#9333EA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.allowBtn}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.allowBtnText}>Onayla ve İzin Ver</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.75}
            disabled={submitting}
            onPress={handleDecline}
            style={styles.declineBtn}
          >
            <Text style={[styles.declineBtnText, { color: theme.colors.textSecondary }]}>
              Şimdi Değil
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 26,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  privacyBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    marginBottom: 20,
  },
  privacyText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  allowBtnWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  allowBtn: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  allowBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
  },
  declineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
