import { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import type { DailyMicroCardItem } from './DailyMicroCardsDeck';

interface StoryShareModalProps {
  visible: boolean;
  card: DailyMicroCardItem | null;
  onClose: () => void;
}

export function StoryShareModal({ visible, card, onClose }: StoryShareModalProps) {
  const storyRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  if (!card) return null;

  const handleShareImage = async () => {
    if (!storyRef.current || sharing) return;
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Bilgi', 'Bu cihazda görsel paylaşımı desteklenmiyor.');
        return;
      }

      const uri = await captureRef(storyRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Kadın Atlası Hikayeni Paylaş',
      });
    } catch {
      Alert.alert('Hata', 'Görsel hazırlanırken bir sorun oluştu.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.topRow}>
            <Text style={styles.modalTitle}>Hikaye Kartı Önizleme</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>

          {/* 9:16 Story Canvas */}
          <View style={styles.canvasWrap}>
            <View ref={storyRef} collapsable={false} style={styles.storyFrame}>
              <LinearGradient
                colors={[card.gradientFrom || '#EC4899', card.gradientTo || '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.storyGradient}
              >
                <View style={styles.orbTop} />
                <View style={styles.orbBottom} />

                <View style={styles.storyHeader}>
                  <View style={styles.brandPill}>
                    <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                    <Text style={styles.brandText}>KADIN ATLASI</Text>
                  </View>
                  <View style={styles.tagPill}>
                    <Text style={styles.tagText}>{card.badge}</Text>
                  </View>
                </View>

                <View style={styles.storyCenter}>
                  <View style={styles.mascotCircle}>
                    <Image
                      source={require('../../../assets/images/mascots/Morning.png')}
                      style={styles.mascotImg}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.storyTitle}>{card.title}</Text>
                  <Text style={styles.storyBody}>{card.body}</Text>
                </View>

                <View style={styles.storyFooter}>
                  <Text style={styles.footerDomain}>kadinatlasi.com</Text>
                  <Text style={styles.footerSub}>
                    Döngü · Wellness · NOVA AI
                  </Text>
                </View>
              </LinearGradient>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
            onPress={handleShareImage}
            disabled={sharing}
            activeOpacity={0.88}
          >
            {sharing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="share-social" size={18} color="#FFFFFF" />
                <Text style={styles.shareBtnText}>
                  Instagram / WhatsApp&apos;ta Paylaş
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 16,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasWrap: {
    alignItems: 'center',
  },
  storyFrame: {
    width: 252,
    height: 448,
    borderRadius: 24,
    overflow: 'hidden',
  },
  storyGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
    position: 'relative',
  },
  orbTop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  orbBottom: {
    position: 'absolute',
    bottom: -50,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  storyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tagPill: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  storyCenter: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  mascotCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  mascotImg: {
    width: 68,
    height: 68,
  },
  storyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 26,
  },
  storyBody: {
    color: 'rgba(255,255,255,0.94)',
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  storyFooter: {
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.22)',
  },
  footerDomain: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  footerSub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DB2777',
    borderRadius: 14,
    paddingVertical: 14,
  },
  shareBtnDisabled: {
    opacity: 0.6,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
});
