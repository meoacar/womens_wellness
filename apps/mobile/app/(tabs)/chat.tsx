import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import { useAuthStore } from '@/store/authStore';
import { chatService, quotaService } from '@/services/api';
import { SSEClient } from '@/lib/sse';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/hooks/useTheme';
import { usePremium } from '@/hooks/usePremium';
import { UpgradePrompt } from '@/components/premium/UpgradePrompt';
import { QuotaExceededModal } from '@/components/premium/QuotaExceededModal';
import { useRouter, useLocalSearchParams } from 'expo-router';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isStreaming?: boolean;
}

interface NovaQuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  resetDate?: string;
  percentage: number;
  hasQuota: boolean;
  maxMessageLength: number;
  isNovaEnabled: boolean;
  maintenanceMessage: string;
  systemGreeting: string;
}

const SUGGESTED_PROMPTS = [
  {
    icon: 'water-outline' as const,
    color: '#EC4899',
    text: 'Regl krampları için ne iyi gelir?',
  },
  {
    icon: 'sparkles-outline' as const,
    color: '#8B5CF6',
    text: 'Yumurtlama dönemimi nasıl takip edebilirim?',
  },
  {
    icon: 'nutrition-outline' as const,
    color: '#10B981',
    text: 'PMS döneminde beslenme nasıl olmalı?',
  },
  {
    icon: 'moon-outline' as const,
    color: '#3B82F6',
    text: 'Uyku kalitemi artırmak için 3 öneri ver',
  },
];

export default function ChatScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ prompt?: string }>();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();

  const [conversationId, setConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    if (params?.prompt && typeof params.prompt === 'string') {
      setInputText(params.prompt);
    }
  }, [params?.prompt]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showDoctorCoachUpgrade, setShowDoctorCoachUpgrade] = useState(false);
  const [showQuotaExceeded, setShowQuotaExceeded] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const orbPulse = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbPulse, {
          toValue: 1.07,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(orbPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [orbPulse]);

  const handleCopyMessage = async (id: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1800);
  };
  const sseClient = useRef<SSEClient>(new SSEClient());
  const streamingContentRef = useRef('');

  const { isPremium } = usePremium();

  // Fetch live NOVA quota & admin limits from GET /quota
  const { data: novaQuota, refetch: refetchQuota } = useQuery<NovaQuotaStatus>({
    queryKey: ['nova', 'quota'],
    queryFn: () => quotaService.getStatus() as Promise<NovaQuotaStatus>,
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });

  const maxMessageLength = novaQuota?.maxMessageLength || 500;
  const isNovaEnabled = novaQuota?.isNovaEnabled !== false;
  const isDepleted = novaQuota ? novaQuota.remaining <= 0 : false;
  const isLow = novaQuota ? novaQuota.percentage >= 80 && !isDepleted : false;

  // Load or create conversation ID on mount
  useEffect(() => {
    const loadConversation = async () => {
      try {
        const savedConvId = await AsyncStorage.getItem('currentConversationId');

        if (savedConvId) {
          setConversationId(savedConvId);
          try {
            const history: any = await chatService.getHistory(savedConvId);
            if (history?.messages) {
              const formattedMessages = [...history.messages]
                .reverse()
                .map((msg: any, index: number) => ({
                  id: msg.id || `${msg.role}-${Date.now()}-${index}`,
                  role: msg.role,
                  content: msg.content,
                  createdAt: msg.createdAt,
                }));
              setMessages(formattedMessages);
            }
          } catch {
            // No prior history yet
          }
        } else {
          const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          setConversationId(newId);
          await AsyncStorage.setItem('currentConversationId', newId);
        }
      } catch {
        const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        setConversationId(newId);
      }
    };

    loadConversation();
  }, []);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return chatService.sendMessage(conversationId, content);
    },
    onSuccess: async (response: any) => {
      const newConvId = response?.conversationId;
      if (newConvId && newConvId !== conversationId) {
        setConversationId(newConvId);
        await AsyncStorage.setItem('currentConversationId', newConvId);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      startStreaming(newConvId || conversationId);
    },
    onError: (error: any) => {
      setMessages((prev) => prev.slice(0, -1));
      handleError(error);
    },
  });

  const handleError = (error: any) => {
    const errorMessage = error?.message || 'Bir hata oluştu';

    if (
      errorMessage.toLowerCase().includes('kota') ||
      errorMessage.toLowerCase().includes('quota')
    ) {
      setShowQuotaExceeded(true);
      refetchQuota();
    } else if (
      errorMessage.toLowerCase().includes('network') ||
      errorMessage.toLowerCase().includes('bağlantı') ||
      error?.name === 'TypeError' ||
      error?.name === 'NetworkError'
    ) {
      Alert.alert(
        'Bağlantı Hatası',
        'İnternet bağlantınızı kontrol edin ve tekrar deneyin.',
        [{ text: 'Tamam', style: 'cancel' }]
      );
    } else {
      Alert.alert('Bilgi', errorMessage);
    }
  };

  const startStreaming = async (convId?: string) => {
    const activeConvId = convId || conversationId;
    setIsStreaming(true);
    setStreamingContent('');
    streamingContentRef.current = '';

    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('Oturum bulunamadı');

      const streamUrl = chatService.streamUrl(activeConvId);

      await sseClient.current.stream(streamUrl, token, {
        onToken: (chunk) => {
          streamingContentRef.current += chunk;
          setStreamingContent(streamingContentRef.current);
        },
        onDone: async () => {
          setIsStreaming(false);
          const finalContent = streamingContentRef.current;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempMessage.id
                ? { ...msg, content: finalContent, isStreaming: false }
                : msg
            )
          );
          setStreamingContent('');
          streamingContentRef.current = '';

          // Refresh live quota from server (stream already incremented UsageQuota)
          queryClient.invalidateQueries({ queryKey: ['nova', 'quota'] });
          refetchQuota();
        },
        onError: (error) => {
          setIsStreaming(false);
          setStreamingContent('');
          streamingContentRef.current = '';
          setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
          handleError(error);
        },
      });
    } catch (error: any) {
      setIsStreaming(false);
      setStreamingContent('');
      streamingContentRef.current = '';
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      handleError(error);
    }
  };

  const sendPrompt = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sendMessageMutation.isPending || isStreaming) return;

    if (!isNovaEnabled) {
      Alert.alert(
        'NOVA Bakımda',
        novaQuota?.maintenanceMessage || 'NOVA şu anda bakımdadır.'
      );
      return;
    }

    if (isDepleted) {
      setShowQuotaExceeded(true);
      return;
    }

    if (trimmed.length > maxMessageLength) {
      Alert.alert(
        'Karakter Limiti',
        `Mesajınız en fazla ${maxMessageLength} karakter olabilir.`
      );
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    sendMessageMutation.mutate(trimmed);
  };

  const handleStop = () => {
    sseClient.current.stop();
    setIsStreaming(false);
    setStreamingContent('');
    streamingContentRef.current = '';
    setMessages((prev) =>
      prev.filter((msg) => !msg.isStreaming).map((msg) => ({ ...msg, isStreaming: false }))
    );
  };

  const handleForget = () => {
    Alert.alert(
      'Yeni Sohbet Başlat',
      'Mevcut sohbet geçmişi temizlenecek. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.forgetConversation(conversationId);
              setMessages([]);
              const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
              setConversationId(newId);
              await AsyncStorage.setItem('currentConversationId', newId);
            } catch (error: any) {
              Alert.alert('Hata', error?.message || 'Temizlenemedi');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (isStreaming && streamingContent) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, content: streamingContent } : msg
        )
      );
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    }
  }, [streamingContent, isStreaming]);

  const styles = createStyles(theme);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';

    if (isUser) {
      return (
        <View style={[styles.messageWrapper, styles.userWrapper]}>
          <LinearGradient
            colors={['#EC4899', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userBubble}
          >
            <Text style={styles.userMessageText}>{item.content}</Text>
          </LinearGradient>
        </View>
      );
    }

    return (
      <View style={[styles.messageWrapper, styles.assistantWrapper]}>
        <LinearGradient
          colors={['#EC4899', '#8B5CF6']}
          style={styles.assistantAvatar}
        >
          <Ionicons name="sparkles" size={13} color="#FFFFFF" />
        </LinearGradient>

        <View style={styles.assistantBubble}>
          {item.content ? (
            <>
              <Markdown
                style={{
                  body: {
                    color: theme.colors.text,
                    fontSize: 15,
                    lineHeight: 22,
                    marginTop: 0,
                    marginBottom: 0,
                  },
                  paragraph: { marginTop: 0, marginBottom: 6 },
                  heading1: { fontSize: 17, fontWeight: '800', color: theme.colors.text, marginBottom: 6 },
                  heading2: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
                  heading3: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
                  strong: { fontWeight: '700', color: theme.colors.text },
                  bullet_list: { marginBottom: 6 },
                  ordered_list: { marginBottom: 6 },
                  list_item: { marginBottom: 3 },
                }}
              >
                {item.content}
              </Markdown>
              {!item.isStreaming && (
                <View style={styles.assistantFooter}>
                  <Text style={styles.assistantTag}>NOVA AI</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => handleCopyMessage(item.id, item.content)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={copiedId === item.id ? 'checkmark-outline' : 'copy-outline'}
                      size={13}
                      color={copiedId === item.id ? '#10B981' : theme.colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.copyBtnText,
                        copiedId === item.id && { color: '#10B981' },
                      ]}
                    >
                      {copiedId === item.id ? 'Kopyalandı' : 'Kopyala'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : item.isStreaming ? (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.typingText}>NOVA yanıt hazırlıyor...</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const quotaPct = novaQuota ? Math.min(100, novaQuota.percentage) : 0;
  const quotaBarColor = isDepleted
    ? theme.colors.error
    : isLow
      ? '#F59E0B'
      : theme.colors.primary;

  return (
    <View style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Modern Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerBrand}>
            <LinearGradient
              colors={['#EC4899', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerAvatar}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            </LinearGradient>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.headerTitle}>NOVA</Text>
                {isPremium && (
                  <View
                    style={{
                      backgroundColor: '#FEF3C7',
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#B45309' }}>
                      PRO HAFIZA
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isNovaEnabled ? '#10B981' : '#EF4444' },
                  ]}
                />
              </View>
              <Text style={styles.headerSubtitle}>
                Kişisel kadın sağlığı asistanın
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            {novaQuota && (
              <TouchableOpacity
                style={[
                  styles.quotaBadge,
                  isDepleted && styles.quotaBadgeDepleted,
                  isLow && styles.quotaBadgeLow,
                ]}
                onPress={() => {
                  if (!isPremium) {
                    router.push('/premium' as any);
                  } else {
                    Alert.alert(
                      'Aylık NOVA Kotası',
                      `Kullanılan: ${novaQuota.used} / ${novaQuota.limit}\nKalan: ${novaQuota.remaining} mesaj\nMaks. uzunluk: ${novaQuota.maxMessageLength} karakter`
                    );
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="flash-outline"
                  size={13}
                  color={isDepleted ? '#EF4444' : isLow ? '#D97706' : theme.colors.primary}
                />
                <Text
                  style={[
                    styles.quotaBadgeText,
                    isDepleted && { color: '#EF4444' },
                    isLow && { color: '#D97706' },
                  ]}
                >
                  {novaQuota.remaining}/{novaQuota.limit}
                </Text>
              </TouchableOpacity>
            )}

            {messages.length > 0 && (
              <TouchableOpacity
                onPress={handleForget}
                style={styles.clearButton}
                activeOpacity={0.75}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Thin Quota Progress Strip */}
        {novaQuota && (
          <View style={styles.quotaBarTrack}>
            <View
              style={[
                styles.quotaBarFill,
                { width: `${quotaPct}%`, backgroundColor: quotaBarColor },
              ]}
            />
          </View>
        )}

        {/* Maintenance Banner if disabled from Admin Panel */}
        {!isNovaEnabled && (
          <View style={styles.maintenanceBanner}>
            <Ionicons name="construct-outline" size={16} color="#B45309" />
            <Text style={styles.maintenanceText}>
              {novaQuota?.maintenanceMessage || 'NOVA şu anda bakımdadır.'}
            </Text>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messagesList,
            messages.length === 0 && { flexGrow: 1 },
          ]}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Animated.View style={{ transform: [{ scale: orbPulse }] }}>
                <LinearGradient
                  colors={['#EC4899', '#A855F7', '#6366F1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emptyOrb}
                >
                  <Ionicons name="sparkles" size={34} color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>

              <View style={styles.emptyBadge}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isNovaEnabled ? '#10B981' : '#EF4444' },
                  ]}
                />
                <Text style={styles.emptyBadgeText}>
                  {isNovaEnabled ? 'NOVA AI • Hazır' : 'NOVA Bakımda'}
                </Text>
              </View>

              <Text style={styles.emptyTitle}>Merhaba, ben NOVA ✨</Text>
              <Text style={styles.emptySubtitle}>
                {novaQuota?.systemGreeting ||
                  'Döngün, hamilelik sürecin, su tüketimin veya günlük wellness hedeflerin hakkında bana her şeyi sorabilirsin.'}
              </Text>

              <View style={styles.promptsGrid2Col}>
                {SUGGESTED_PROMPTS.map((p) => (
                  <TouchableOpacity
                    key={p.text}
                    style={styles.promptCard}
                    onPress={() => sendPrompt(p.text)}
                    activeOpacity={0.82}
                  >
                    <View
                      style={[
                        styles.promptIconBox,
                        { backgroundColor: `${p.color}18` },
                      ]}
                    >
                      <Ionicons name={p.icon} size={18} color={p.color} />
                    </View>
                    <Text style={styles.promptCardText} numberOfLines={3}>
                      {p.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.doctorCoachCard}
                onPress={() => {
                  if (!isPremium) {
                    setShowDoctorCoachUpgrade(true);
                    return;
                  }
                  sendPrompt(
                    'Son 14 günlük semptom ve döngü geçmişime bakarak doktor/jinekolog randevumda sormam gereken en önemli 5 soruyu ve bugüne özel bakım planımı hazırla.',
                  );
                }}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.promptIconBox,
                    { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
                  ]}
                >
                  <Ionicons name="medkit-outline" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.promptText}>
                    Doktor Randevusu Soru Listesi & Faz Planım {!isPremium ? '👑' : ''}
                  </Text>
                  <Text style={styles.doctorCoachSub}>
                    Son 14 günlük verilerine göre kişisel özet hazırla
                  </Text>
                </View>
                <Ionicons
                  name={isPremium ? 'arrow-forward' : 'lock-closed-outline'}
                  size={16}
                  color="#D97706"
                />
              </TouchableOpacity>
            </View>
          )}
        />

        {/* Floating Input Bar */}
        <View
          style={[
            styles.inputWrapper,
            { paddingBottom: Math.max(insets.bottom + 64, 72) },
          ]}
        >
          {messages.length > 0 && !isStreaming && isNovaEnabled && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickChipsRow}
            >
              {SUGGESTED_PROMPTS.map((p) => (
                <TouchableOpacity
                  key={p.text}
                  style={styles.quickChip}
                  onPress={() => sendPrompt(p.text)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={p.icon} size={13} color={p.color} />
                  <Text style={styles.quickChipText} numberOfLines={1}>
                    {p.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {inputText.length > maxMessageLength * 0.75 && (
            <Text style={styles.charCount}>
              {inputText.length}/{maxMessageLength}
            </Text>
          )}

          <View style={styles.inputPill}>
            {isStreaming ? (
              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStop}
                activeOpacity={0.85}
              >
                <Ionicons name="stop-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.stopButtonText}>Yanıtı Durdur</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder={
                    isNovaEnabled
                      ? 'NOVA’ya bir soru sor...'
                      : 'NOVA şu anda bakımda'
                  }
                  placeholderTextColor={theme.colors.textLight}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  editable={isNovaEnabled}
                  maxLength={maxMessageLength}
                />
                <TouchableOpacity
                  onPress={() => sendPrompt(inputText)}
                  disabled={
                    !inputText.trim() ||
                    sendMessageMutation.isPending ||
                    !isNovaEnabled
                  }
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={
                      !inputText.trim() ||
                      sendMessageMutation.isPending ||
                      !isNovaEnabled
                        ? [theme.colors.border, theme.colors.border]
                        : ['#EC4899', '#8B5CF6']
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.sendButton}
                  >
                    {sendMessageMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <UpgradePrompt
        visible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="Yüksek NOVA Mesaj Limiti"
        description="Aylık mesaj kotanız doldu. Premium'a geçerek çok daha yüksek aylık NOVA mesaj limitine ulaşabilirsiniz."
      />

      <UpgradePrompt
        visible={showDoctorCoachUpgrade}
        onClose={() => setShowDoctorCoachUpgrade(false)}
        feature="Doktor Soru Listesi & Pro Hafıza"
        description="Son 14 günlük semptom ve döngü verilerine özel doktor randevusu soru listesi ile faz bakım planını Premium ile oluştur."
      />

      <QuotaExceededModal
        visible={showQuotaExceeded}
        onClose={() => setShowQuotaExceeded(false)}
        quota={
          novaQuota
            ? {
                used: novaQuota.used,
                limit: novaQuota.limit,
                remaining: novaQuota.remaining,
                resetDate: novaQuota.resetsAt,
                percentage: novaQuota.percentage,
              }
            : undefined
        }
        isPremium={isPremium}
      />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: theme.colors.backgroundCard,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      gap: 10,
    },
    headerBrand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    headerAvatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.2,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 1,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    quotaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
    },
    quotaBadgeLow: {
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderColor: 'rgba(245, 158, 11, 0.35)',
    },
    quotaBadgeDepleted: {
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderColor: 'rgba(239, 68, 68, 0.35)',
    },
    quotaBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    clearButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quotaBarTrack: {
      height: 2.5,
      width: '100%',
      backgroundColor: theme.colors.border,
    },
    quotaBarFill: {
      height: '100%',
    },
    maintenanceBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(245, 158, 11, 0.14)',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(245, 158, 11, 0.25)',
    },
    maintenanceText: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: '600',
      color: '#B45309',
    },
    messagesList: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 170,
    },
    messageWrapper: {
      marginBottom: 12,
      flexDirection: 'row',
    },
    userWrapper: {
      justifyContent: 'flex-end',
    },
    assistantWrapper: {
      justifyContent: 'flex-start',
      alignItems: 'flex-end',
      gap: 8,
    },
    assistantAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    userBubble: {
      maxWidth: '80%',
      borderRadius: 20,
      borderBottomRightRadius: 6,
      paddingHorizontal: 15,
      paddingVertical: 11,
    },
    assistantBubble: {
      maxWidth: '82%',
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 20,
      borderBottomLeftRadius: 6,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    messageText: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.text,
    },
    userMessageText: {
      fontSize: 15,
      lineHeight: 22,
      color: '#FFFFFF',
      fontWeight: '500',
    },
    assistantFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    assistantTag: {
      fontSize: 10.5,
      fontWeight: '700',
      color: theme.colors.textLight,
      letterSpacing: 0.4,
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    copyBtnText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.colors.textSecondary,
    },
    typingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    typingText: {
      fontSize: 13.5,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingBottom: 40,
      gap: 10,
    },
    emptyOrb: {
      width: 76,
      height: 76,
      borderRadius: 38,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
      shadowColor: '#EC4899',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.32,
      shadowRadius: 16,
      elevation: 8,
    },
    emptyBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
    },
    emptyBadgeText: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    emptyTitle: {
      fontSize: 23,
      fontWeight: '800',
      color: theme.colors.text,
      letterSpacing: -0.3,
    },
    emptySubtitle: {
      fontSize: 13.5,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 10,
      marginBottom: 6,
    },
    promptsGrid2Col: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    promptCard: {
      width: '48.2%',
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 18,
      padding: 13,
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    promptCardText: {
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
      color: theme.colors.text,
    },
    doctorCoachCard: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.45)',
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    doctorCoachSub: {
      fontSize: 11.5,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    promptIconBox: {
      width: 34,
      height: 34,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    promptText: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.colors.text,
    },
    inputWrapper: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 14,
      paddingTop: 8,
      backgroundColor: theme.colors.background,
    },
    quickChipsRow: {
      gap: 8,
      paddingBottom: 8,
    },
    quickChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.backgroundCard,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      maxWidth: 220,
    },
    quickChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
    },
    charCount: {
      fontSize: 11,
      color: theme.colors.textLight,
      textAlign: 'right',
      marginBottom: 4,
      marginRight: 10,
    },
    inputPill: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      backgroundColor: theme.colors.backgroundCard,
      borderRadius: 26,
      paddingLeft: 14,
      paddingRight: 6,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    input: {
      flex: 1,
      paddingVertical: 8,
      fontSize: 15,
      maxHeight: 110,
      color: theme.colors.text,
    },
    sendButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stopButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.error,
      borderRadius: 20,
      paddingVertical: 11,
    },
    stopButtonText: {
      color: '#FFFFFF',
      fontSize: 14.5,
      fontWeight: '700',
    },
  });
