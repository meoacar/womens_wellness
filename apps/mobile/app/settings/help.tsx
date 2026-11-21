import { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Alert,
    Modal,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/services/api';

type FAQItem = {
    question: string;
    answer: string;
    category: string;
};

type SupportTicket = {
    id: string;
    category: string;
    subject: string;
    message: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
    adminNote?: string | null;
    createdAt: string;
};

const FAQ_DATA: FAQItem[] = [
    {
        category: 'Genel',
        question: 'Uygulama nasıl kullanılır?',
        answer: 'Ana ekrandan istediğiniz özelliğe tıklayarak başlayabilirsiniz. Regl takibi, hamilelik modu, wellness aktiviteleri ve daha fazlası için ilgili bölümlere gidin.',
    },
    {
        category: 'Genel',
        question: 'Verilerim güvende mi?',
        answer: 'Evet, tüm verileriniz şifrelenmiş olarak saklanır ve sadece sizin erişiminize açıktır. Gizlilik politikamızı inceleyebilirsiniz.',
    },
    {
        category: 'Regl Takibi',
        question: 'Regl döngümü nasıl takip ederim?',
        answer: 'Ana ekrandan "Regl Takvimi" bölümüne girin. Dönem başlangıç ve bitiş tarihlerinizi işaretleyin. Uygulama otomatik olarak bir sonraki döneminizi tahmin edecektir.',
    },
    {
        category: 'Regl Takibi',
        question: 'Semptomlarımı nasıl kaydederim?',
        answer: 'Ana ekrandaki 5 saniyelik Günlük Check-in kartından veya Regl Takvimi içinden ruh halinizi, ağrıları ve diğer belirtileri hızlıca kaydedebilirsiniz.',
    },
    {
        category: 'Hamilelik',
        question: 'Hamilelik modunu nasıl aktif ederim?',
        answer: 'Ayarlar > Hamilelik Modu\'na gidin ve son adet tarihinizi girin. Uygulama otomatik olarak hamilelik haftanızı hesaplayacaktır.',
    },
    {
        category: 'Hamilelik',
        question: 'Randevularımı nasıl eklerim?',
        answer: 'Hamilelik bölümünden "Randevular" sekmesine gidin ve "Yeni Randevu" butonuna tıklayın. Tarih, saat ve notlarınızı ekleyin.',
    },
    {
        category: 'Premium',
        question: 'Premium üyelik ne sağlar?',
        answer: 'Premium üyelikle sınırsız AI sohbet, sınırsız soru sorma, gelişmiş raporlar, özel içerikler ve reklamsız deneyim elde edersiniz.',
    },
    {
        category: 'Premium',
        question: 'Aboneliğimi nasıl iptal ederim?',
        answer: 'iOS: App Store > Hesabınız > Abonelikler. Android: Play Store > Hesap > Abonelikler. Buradan aboneliğinizi yönetebilirsiniz.',
    },
    {
        category: 'Teknik',
        question: 'Uygulama çöküyor, ne yapmalıyım?',
        answer: 'Önce uygulamayı tamamen kapatıp yeniden açmayı deneyin. Sorun devam ederse uygulamayı güncelleyin veya destek ekibimizle iletişime geçin.',
    },
    {
        category: 'Teknik',
        question: 'Verilerimi nasıl yedeklerim?',
        answer: 'Ayarlar > Veri ve Gizlilik > Verileri Senkronize Et. Verileriniz otomatik olarak bulutta yedeklenir.',
    },
];

const QUICK_GUIDES = [
    {
        id: 'cycle',
        title: 'Döngü & Check-in Başlangıcı',
        steps: [
            '1. Ana ekrandaki 5 Saniyelik Check-in kartından bugünkü ruh halini ve belirtilerini seç.',
            '2. Regl Takvimi ekranında dönem tarihlerini işaretleyerek faz tahminlerini aktif et.',
            '3. Döngü Fazı Rehberi kartından o güne özel beslenme/egzersiz önerilerini incele.',
        ],
    },
    {
        id: 'wellness',
        title: 'Su, Uyku, Adım & Nefes Egzersizi',
        steps: [
            '1. Su Takibi ekranında kilona göre hesaplanan günlük hedefe +200ml hızlı butonlarla ulaş.',
            '2. Rahatlama & Meditasyon ekranında kramp/uyku/stres için 4-7-8 Nefes Zamanlayıcısı başlat.',
            '3. Sağlık Raporu bölümünden doktorunla paylaşabileceğin özet raporu oluştur.',
        ],
    },
    {
        id: 'nova',
        title: 'NOVA AI Asistanı & Topluluk',
        steps: [
            '1. NOVA sohbetinde döngü fazına veya belirtilerine göre kişiselleştirilmiş sorular sor.',
            '2. Topluluk Soru & Cevap bölümünde anonim veya açık şekilde diğer üyelerle deneyim paylaş.',
        ],
    },
];

const TICKET_CATEGORIES = ['Genel', 'Hata Bildirimi', 'Abonelik', 'Öneri'];

const STATUS_BADGE: Record<SupportTicket['status'], { label: string; color: string; bg: string }> = {
    OPEN: { label: 'Açık', color: '#DC2626', bg: '#FEE2E2' },
    IN_PROGRESS: { label: 'İnceleniyor', color: '#D97706', bg: '#FEF3C7' },
    RESOLVED: { label: 'Yanıtlandı', color: '#059669', bg: '#D1FAE5' },
};

export default function HelpScreen() {
    const router = useRouter();
    const theme = useTheme();
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('Tümü');

    const [supportModalVisible, setSupportModalVisible] = useState(false);
    const [guideModalVisible, setGuideModalVisible] = useState(false);
    const [ticketCategory, setTicketCategory] = useState('Genel');
    const [ticketSubject, setTicketSubject] = useState('');
    const [ticketMessage, setTicketMessage] = useState('');
    const [submittingTicket, setSubmittingTicket] = useState(false);
    const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);

    const categories = ['Tümü', ...Array.from(new Set(FAQ_DATA.map((item) => item.category)))];

    const filteredFAQ = selectedCategory === 'Tümü'
        ? FAQ_DATA
        : FAQ_DATA.filter((item) => item.category === selectedCategory);

    const toggleExpand = (index: number) => {
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    const loadMyTickets = useCallback(async () => {
        setLoadingTickets(true);
        try {
            const list = await api.get<SupportTicket[]>('/support/my-tickets');
            setMyTickets(Array.isArray(list) ? list : []);
        } catch {
            // Silently ignore if offline/unauthenticated
        } finally {
            setLoadingTickets(false);
        }
    }, []);

    useEffect(() => {
        loadMyTickets();
    }, [loadMyTickets]);

    const openSafeMailto = async (subjectText?: string) => {
        const subjectParam = subjectText ? `?subject=${encodeURIComponent(subjectText)}` : '';
        const url = `mailto:support@womenswellness.app${subjectParam}`;
        try {
            const supported = await Linking.canOpenURL(url);
            if (!supported) {
                Alert.alert(
                    'E-posta Uygulaması Bulunamadı',
                    'Cihazınızda varsayılan e-posta uygulaması ayarlı değil. Uygulama içi destek formunu kullanabilirsiniz.',
                    [
                        { text: 'İptal', style: 'cancel' },
                        { text: 'Destek Formunu Aç', onPress: () => setSupportModalVisible(true) },
                    ],
                );
                return;
            }
            await Linking.openURL(url);
        } catch {
            setSupportModalVisible(true);
        }
    };

    const handleSubmitTicket = async () => {
        if (ticketSubject.trim().length < 3) {
            Alert.alert('Eksik Bilgi', 'Lütfen en az 3 karakterlik bir konu yazın.');
            return;
        }
        if (ticketMessage.trim().length < 10) {
            Alert.alert('Eksik Bilgi', 'Lütfen sorununuzu en az 10 karakter ile açıklayın.');
            return;
        }

        setSubmittingTicket(true);
        try {
            const created = await api.post<SupportTicket>('/support/tickets', {
                category: ticketCategory,
                subject: ticketSubject.trim(),
                message: ticketMessage.trim(),
            });
            setMyTickets((prev) => [created, ...prev]);
            setTicketSubject('');
            setTicketMessage('');
            setSupportModalVisible(false);
            Alert.alert('Talebiniz Alındı', 'Destek ekibimiz talebinizi inceleyip buradan yanıtlayacaktır.');
        } catch (err: any) {
            Alert.alert('Hata', err?.message || 'Talep gönderilemedi, lütfen tekrar deneyin.');
        } finally {
            setSubmittingTicket(false);
        }
    };

    const styles = createStyles(theme);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>‹ Geri</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Yardım Merkezi</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.container}>
                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Hızlı Erişim</Text>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => router.push('/settings/support' as any)}
                    >
                        <Text style={styles.actionIcon}>💬</Text>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>Uygulama İçi Destek Talebi</Text>
                            <Text style={styles.actionDescription}>Sorun bildir, mesaj gönder veya yanıtlarını gör</Text>
                        </View>
                        <Text style={styles.actionArrow}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => openSafeMailto('Destek Talebi')}
                    >
                        <Text style={styles.actionIcon}>📧</Text>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>E-posta Desteği</Text>
                            <Text style={styles.actionDescription}>support@womenswellness.app</Text>
                        </View>
                        <Text style={styles.actionArrow}>›</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => setGuideModalVisible(true)}
                    >
                        <Text style={styles.actionIcon}>📚</Text>
                        <View style={styles.actionContent}>
                            <Text style={styles.actionTitle}>Kullanım Kılavuzu & Rehberler</Text>
                            <Text style={styles.actionDescription}>Adım adım uygulama rehberi</Text>
                        </View>
                        <Text style={styles.actionArrow}>›</Text>
                    </TouchableOpacity>
                </View>

                {/* My Support Tickets */}
                {(myTickets.length > 0 || loadingTickets) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Destek Taleplerim</Text>
                        {loadingTickets ? (
                            <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 12 }} />
                        ) : (
                            myTickets.map((ticket) => {
                                const badge = STATUS_BADGE[ticket.status] || STATUS_BADGE.OPEN;
                                return (
                                    <View key={ticket.id} style={styles.ticketCard}>
                                        <View style={styles.ticketHeader}>
                                            <Text style={styles.ticketSubject}>{ticket.subject}</Text>
                                            <View style={[styles.ticketBadge, { backgroundColor: badge.bg }]}>
                                                <Text style={[styles.ticketBadgeText, { color: badge.color }]}>
                                                    {badge.label}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={styles.ticketCategory}>
                                            {ticket.category} • {new Date(ticket.createdAt).toLocaleDateString('tr-TR')}
                                        </Text>
                                        <Text style={styles.ticketMessage}>{ticket.message}</Text>
                                        {ticket.adminNote ? (
                                            <View style={styles.adminNoteBox}>
                                                <Text style={styles.adminNoteTitle}>Destek Ekibi Yanıtı:</Text>
                                                <Text style={styles.adminNoteText}>{ticket.adminNote}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}

                {/* FAQ Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sık Sorulan Sorular</Text>

                    {/* Category Filter */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoryScroll}
                        contentContainerStyle={styles.categoryScrollContent}
                    >
                        {categories.map((category) => (
                            <TouchableOpacity
                                key={category}
                                style={[
                                    styles.categoryChip,
                                    selectedCategory === category && styles.categoryChipActive,
                                ]}
                                onPress={() => setSelectedCategory(category)}
                            >
                                <Text
                                    style={[
                                        styles.categoryChipText,
                                        selectedCategory === category && styles.categoryChipTextActive,
                                    ]}
                                >
                                    {category}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* FAQ Items */}
                    {filteredFAQ.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.faqItem}
                            onPress={() => toggleExpand(index)}
                        >
                            <View style={styles.faqHeader}>
                                <Text style={styles.faqQuestion}>{item.question}</Text>
                                <Text style={styles.faqIcon}>
                                    {expandedIndex === index ? '−' : '+'}
                                </Text>
                            </View>
                            {expandedIndex === index && (
                                <Text style={styles.faqAnswer}>{item.answer}</Text>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Contact Support */}
                <View style={styles.section}>
                    <View style={styles.supportCard}>
                        <Text style={styles.supportTitle}>Sorunuz mu var?</Text>
                        <Text style={styles.supportText}>
                            Aradığınız cevabı bulamadıysanız, uygulama içinden destek ekibimize mesaj gönderebilirsiniz.
                        </Text>
                        <TouchableOpacity
                            style={styles.supportButton}
                            onPress={() => router.push('/settings/support' as any)}
                        >
                            <Text style={styles.supportButtonText}>Destek & İletişim Sayfasına Git</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* In-App Support Modal */}
            <Modal
                visible={supportModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setSupportModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Destek & Geri Bildirim</Text>
                        <Text style={styles.modalLabel}>Kategori</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                            {TICKET_CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[
                                        styles.categoryChip,
                                        ticketCategory === cat && styles.categoryChipActive,
                                    ]}
                                    onPress={() => setTicketCategory(cat)}
                                >
                                    <Text
                                        style={[
                                            styles.categoryChipText,
                                            ticketCategory === cat && styles.categoryChipTextActive,
                                        ]}
                                    >
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.modalLabel}>Konu</Text>
                        <TextInput
                            style={styles.input}
                            value={ticketSubject}
                            onChangeText={setTicketSubject}
                            placeholder="Örn: Su hedefim güncellenmiyor"
                            placeholderTextColor={theme.colors.textSecondary}
                        />

                        <Text style={styles.modalLabel}>Mesajınız</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={ticketMessage}
                            onChangeText={setTicketMessage}
                            placeholder="Yaşadığınız durumu veya önerinizi detaylı paylaşın..."
                            placeholderTextColor={theme.colors.textSecondary}
                            multiline
                            numberOfLines={4}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalCancelButton]}
                                onPress={() => setSupportModalVisible(false)}
                                disabled={submittingTicket}
                            >
                                <Text style={styles.modalCancelText}>Vazgeç</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.modalSubmitButton]}
                                onPress={handleSubmitTicket}
                                disabled={submittingTicket}
                            >
                                {submittingTicket ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <Text style={styles.modalSubmitText}>Gönder</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Quick Guides Modal */}
            <Modal
                visible={guideModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setGuideModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { maxHeight: '80%' }]}>
                        <Text style={styles.modalTitle}>Kullanım Kılavuzu</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {QUICK_GUIDES.map((guide) => (
                                <View key={guide.id} style={styles.guideBlock}>
                                    <Text style={styles.guideTitle}>{guide.title}</Text>
                                    {guide.steps.map((step, i) => (
                                        <Text key={i} style={styles.guideStep}>
                                            {step}
                                        </Text>
                                    ))}
                                </View>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.supportButton, { marginTop: 12, alignItems: 'center' }]}
                            onPress={() => setGuideModalVisible(false)}
                        >
                            <Text style={styles.supportButtonText}>Kapat</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const createStyles = (theme: any) =>
    StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border,
        },
        backButton: {
            padding: theme.spacing.xs,
        },
        backButtonText: {
            fontSize: 20,
            color: theme.colors.primary,
            fontWeight: '600',
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.colors.text,
        },
        headerRight: {
            width: 40,
        },
        container: {
            flex: 1,
        },
        section: {
            marginTop: theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
        },
        sectionTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: theme.spacing.md,
        },
        actionCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 12,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        actionIcon: {
            fontSize: 28,
            marginRight: theme.spacing.md,
        },
        actionContent: {
            flex: 1,
        },
        actionTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.colors.text,
            marginBottom: 2,
        },
        actionDescription: {
            fontSize: 14,
            color: theme.colors.textSecondary,
        },
        actionArrow: {
            fontSize: 24,
            color: theme.colors.textSecondary,
        },
        ticketCard: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 12,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        ticketHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
        },
        ticketSubject: {
            flex: 1,
            fontSize: 15,
            fontWeight: '700',
            color: theme.colors.text,
        },
        ticketBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 8,
        },
        ticketBadgeText: {
            fontSize: 11,
            fontWeight: '700',
        },
        ticketCategory: {
            fontSize: 12,
            color: theme.colors.textSecondary,
            marginTop: 4,
            marginBottom: 6,
        },
        ticketMessage: {
            fontSize: 13,
            color: theme.colors.text,
            lineHeight: 19,
        },
        adminNoteBox: {
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            backgroundColor: theme.colors.background,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.primary,
        },
        adminNoteTitle: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.colors.primary,
            marginBottom: 2,
        },
        adminNoteText: {
            fontSize: 13,
            color: theme.colors.text,
            lineHeight: 18,
        },
        categoryScroll: {
            marginBottom: theme.spacing.md,
        },
        categoryScrollContent: {
            paddingRight: theme.spacing.lg,
        },
        categoryChip: {
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: 20,
            backgroundColor: theme.colors.backgroundCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginRight: theme.spacing.sm,
        },
        categoryChipActive: {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
        },
        categoryChipText: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.colors.text,
        },
        categoryChipTextActive: {
            color: theme.colors.textOnPrimary,
        },
        faqItem: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 12,
            padding: theme.spacing.md,
            marginBottom: theme.spacing.sm,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        faqHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        faqQuestion: {
            flex: 1,
            fontSize: 16,
            fontWeight: '600',
            color: theme.colors.text,
            marginRight: theme.spacing.sm,
        },
        faqIcon: {
            fontSize: 24,
            fontWeight: '300',
            color: theme.colors.primary,
        },
        faqAnswer: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            lineHeight: 20,
            marginTop: theme.spacing.sm,
            paddingTop: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
        },
        supportCard: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 16,
            padding: theme.spacing.lg,
            marginBottom: theme.spacing.xl,
            borderWidth: 1,
            borderColor: theme.colors.border,
            alignItems: 'center',
        },
        supportTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: theme.spacing.sm,
            textAlign: 'center',
        },
        supportText: {
            fontSize: 14,
            color: theme.colors.textSecondary,
            textAlign: 'center',
            marginBottom: theme.spacing.lg,
            lineHeight: 20,
        },
        supportButton: {
            backgroundColor: theme.colors.primary,
            borderRadius: 12,
            paddingVertical: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
        },
        supportButtonText: {
            color: theme.colors.textOnPrimary,
            fontSize: 16,
            fontWeight: '700',
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            padding: 20,
        },
        modalCard: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        modalTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.colors.text,
            marginBottom: 14,
        },
        modalLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.colors.text,
            marginBottom: 6,
        },
        input: {
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: theme.colors.text,
            fontSize: 14,
            marginBottom: 12,
        },
        textArea: {
            minHeight: 96,
            textAlignVertical: 'top',
        },
        modalActions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 6,
        },
        modalButton: {
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 10,
            minWidth: 96,
            alignItems: 'center',
        },
        modalCancelButton: {
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        modalCancelText: {
            color: theme.colors.text,
            fontWeight: '600',
        },
        modalSubmitButton: {
            backgroundColor: theme.colors.primary,
        },
        modalSubmitText: {
            color: '#FFFFFF',
            fontWeight: '700',
        },
        guideBlock: {
            marginBottom: 14,
            padding: 12,
            borderRadius: 10,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        guideTitle: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.colors.primary,
            marginBottom: 6,
        },
        guideStep: {
            fontSize: 13,
            color: theme.colors.text,
            lineHeight: 19,
            marginBottom: 4,
        },
    });
