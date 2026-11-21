export interface PremiumPlanConfig {
    tier: 'MONTHLY' | 'YEARLY';
    isActive: boolean;
    title: string;
    subtitle: string;
    price: number;
    currency: string;
    currencySymbol: string;
    iosProductId: string;
    androidProductId: string;
    trialDays: number;
    badgeText?: string;
    savingsText?: string;
    features: string[];
}

export interface PremiumBenefitItem {
    id: string;
    icon: string;
    color: string;
    title: string;
    description: string;
    isActive: boolean;
}

export interface PremiumComparisonRow {
    id: string;
    icon: string;
    color: string;
    title: string;
    freeValue: string | boolean;
    premiumValue: string | boolean;
    isActive: boolean;
}

export interface PremiumFaqItem {
    id: string;
    question: string;
    answer: string;
    isActive: boolean;
}

export interface PremiumPaywallConfig {
    heroEyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    heroHighlights: string[];
    trialEnabled: boolean;
    trialTitle: string;
    trialDescription: string;
    ctaButtonText: string;
    ctaTrialButtonText: string;
    ctaFooterNote: string;
    defaultSelectedTier: 'MONTHLY' | 'YEARLY';
    premiumAiMessageLimit: number;
    freeAiMessageLimit: number;
    plans: {
        MONTHLY: PremiumPlanConfig;
        YEARLY: PremiumPlanConfig;
    };
    benefits: PremiumBenefitItem[];
    comparisonRows: PremiumComparisonRow[];
    faqs: PremiumFaqItem[];
    updatedAt?: string;
}

export const PAYWALL_CONFIG_FLAG_KEY = 'premium_paywall_config';

export const DEFAULT_PAYWALL_CONFIG: PremiumPaywallConfig = {
    heroEyebrow: 'KADIN ATLASI PREMIUM',
    heroTitle: "Sağlığını 360° Keşfet & Planla",
    heroSubtitle:
        '3 aylık döngü projeksiyonu, uyku-kramp korelasyonları, doktora özel klinik rapor, Partner Modu ve 10x NOVA AI kapasitesiyle tam kontrol.',
    heroHighlights: ['3 Ay Tahmin', 'Klinik Rapor', 'Partner Modu'],
    trialEnabled: true,
    trialTitle: '7 Gün Ücretsiz Deneme',
    trialDescription:
        'Tüm Premium ayrıcalıklarını ücretsiz dene, memnun kalmazsan tek dokunuşla iptal et.',
    ctaButtonText: "Premium'a Geç",
    ctaTrialButtonText: '7 Gün Ücretsiz Başla',
    ctaFooterNote: 'Otomatik yenilenir • İstediğin zaman iptal edebilirsin',
    defaultSelectedTier: 'YEARLY',
    premiumAiMessageLimit: 1000,
    freeAiMessageLimit: 100,
    plans: {
        YEARLY: {
            tier: 'YEARLY',
            isActive: true,
            title: 'Yıllık Plan',
            subtitle: 'Aylık ~₺83 • En avantajlı seçenek',
            price: 999,
            currency: 'TRY',
            currencySymbol: '₺',
            iosProductId: 'com.wellness.premium.yearly',
            androidProductId: 'premium_yearly',
            trialDays: 7,
            badgeText: 'EN POPÜLER',
            savingsText: '%17 Tasarruf',
            features: [
                'Gelecek 3 Ay Döngü Projeksiyonu',
                '90 Günlük Klinik Doktor Raporu',
                'Partner Modu (Eş Paylaşımı)',
                'Uyku & Kramp Korelasyon Analizi',
                'Doğum Haritası & Burç Uyumu',
                'NOVA Pro Hafıza (1.000 mesaj/ay)',
            ],
        },
        MONTHLY: {
            tier: 'MONTHLY',
            isActive: true,
            title: 'Aylık Plan',
            subtitle: 'Esnek faturalandırma • İstediğin zaman iptal',
            price: 99,
            currency: 'TRY',
            currencySymbol: '₺',
            iosProductId: 'com.wellness.premium.monthly',
            androidProductId: 'premium_monthly',
            trialDays: 7,
            badgeText: '',
            savingsText: '',
            features: [
                'Gelecek 3 Ay Döngü Projeksiyonu',
                '90 Günlük Klinik Doktor Raporu',
                'Partner Modu & Doğum Haritası',
                'NOVA Pro Hafıza (1.000 mesaj/ay)',
            ],
        },
    },
    benefits: [
        {
            id: 'b1',
            icon: 'calendar-outline',
            color: '#EC4899',
            title: '3 Aylık Döngü Projeksiyonu',
            description: 'Tatil, seyahat ve özel günlerini gelecek 3 döngü tahminiyle planla',
            isActive: true,
        },
        {
            id: 'b2',
            icon: 'document-text-outline',
            color: '#3B82F6',
            title: 'Doktora Özel Klinik Rapor',
            description: '90 günlük döngü, semptom ve uyku özetini yazdırılabilir rapor olarak al',
            isActive: true,
        },
        {
            id: 'b3',
            icon: 'heart-half-outline',
            color: '#DB2777',
            title: 'Partner Modu (Eş Paylaşımı)',
            description: 'Eşin yalnızca genel fazını ve destek ipuçlarını gizlilikle takip etsin',
            isActive: true,
        },
        {
            id: 'b4',
            icon: 'bulb-outline',
            color: '#10B981',
            title: 'Uyku & Kramp Korelasyonları',
            description: 'Uyku ve su alışkanlıklarının ağrılarına etkisini verilerle gör',
            isActive: true,
        },
        {
            id: 'b5',
            icon: 'planet-outline',
            color: '#6366F1',
            title: 'Doğum Haritası & Burç Uyumu',
            description: 'Kişisel kozmik haritanı çıkar ve partner uyumunu hesapla',
            isActive: true,
        },
        {
            id: 'b6',
            icon: 'hardware-chip-outline',
            color: '#8B5CF6',
            title: 'NOVA Pro Hafıza (1.000 mesaj/ay)',
            description: 'Semptomlarını hatırlayan 4x uzun ve öncelikli AI sağlık koçu',
            isActive: true,
        },
    ],
    comparisonRows: [
        {
            id: 'c1',
            icon: 'calendar-outline',
            color: '#EC4899',
            title: '3 Aylık Döngü Projeksiyonu',
            freeValue: '1 Döngü',
            premiumValue: '3 Ay İleriye',
            isActive: true,
        },
        {
            id: 'c2',
            icon: 'document-text-outline',
            color: '#3B82F6',
            title: 'Klinik Doktor Raporu',
            freeValue: '30 Gün Metin',
            premiumValue: '90 Gün + PDF/HTML',
            isActive: true,
        },
        {
            id: 'c3',
            icon: 'heart-half-outline',
            color: '#DB2777',
            title: 'Partner Modu (Eş Paylaşımı)',
            freeValue: false,
            premiumValue: true,
            isActive: true,
        },
        {
            id: 'c4',
            icon: 'bulb-outline',
            color: '#10B981',
            title: 'Uyku & Kramp Korelasyonu',
            freeValue: '1 Özet',
            premiumValue: 'Tam Analiz',
            isActive: true,
        },
        {
            id: 'c5',
            icon: 'planet-outline',
            color: '#6366F1',
            title: 'Doğum Haritası & Uyum',
            freeValue: false,
            premiumValue: true,
            isActive: true,
        },
        {
            id: 'c6',
            icon: 'chatbubbles-outline',
            color: '#8B5CF6',
            title: 'NOVA AI Kotası & Uzun Yanıt',
            freeValue: '100 mesaj/ay (Temel)',
            premiumValue: '1.000 mesaj/ay (Pro)',
            isActive: true,
        },
    ],
    faqs: [
        {
            id: 'f1',
            question: "Premium'u nasıl iptal edebilirim?",
            answer:
                "Ayarlar > Abonelik Yönetimi'nden istediğiniz zaman iptal edebilirsiniz. Mevcut dönem sonuna kadar erişiminiz sürer.",
            isActive: true,
        },
        {
            id: 'f2',
            question: 'Farklı cihazlarda kullanabilir miyim?',
            answer:
                'Evet, aynı hesapla giriş yaptığınız tüm cihazlarda premium özellikleriniz otomatik aktif olur.',
            isActive: true,
        },
        {
            id: 'f3',
            question: 'Deneme süresi var mı?',
            answer:
                'İlk kez abone olan kullanıcılar 7 günlük ücretsiz deneme süresi boyunca tüm özellikleri deneyimleyebilir.',
            isActive: true,
        },
        {
            id: 'f4',
            question: 'Aylık ve yıllık plan arasındaki fark nedir?',
            answer:
                'Her iki plan da tüm premium özellikleri içerir. Yıllık plan ile %17 tasarruf sağlarsınız.',
            isActive: true,
        },
        {
            id: 'f5',
            question: 'Ödeme güvenli mi?',
            answer:
                'Tüm ödemeler Apple App Store veya Google Play Store altyapısı üzerinden güvenle işlenir.',
            isActive: true,
        },
    ],
};
