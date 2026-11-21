import type { Locale, PaywallConfig } from './api';

export const SITE_URL = 'https://kadinatlasi.com';

export const CATEGORY_LABELS: Record<Locale, Record<string, string>> = {
  tr: {
    ALL: 'Tümü',
    menstrual_health: 'Regl Sağlığı',
    pregnancy: 'Hamilelik',
    fertility: 'Doğurganlık',
    nutrition: 'Beslenme',
    exercise: 'Egzersiz',
    fitness: 'Fitness & Hareket',
    mental_health: 'Ruh Sağlığı',
    sleep: 'Uyku',
    hydration: 'Hidrasyon',
    contraception: 'Korunma Yöntemleri',
    pms: 'PMS',
    menopause: 'Menopoz',
    wellness: 'Wellness',
    sexual_health: 'Cinsel Sağlık',
    general: 'Genel',
  },
  en: {
    ALL: 'All',
    menstrual_health: 'Menstrual Health',
    pregnancy: 'Pregnancy',
    fertility: 'Fertility',
    nutrition: 'Nutrition',
    exercise: 'Exercise',
    fitness: 'Fitness',
    mental_health: 'Mental Health',
    sleep: 'Sleep',
    hydration: 'Hydration',
    contraception: 'Contraception',
    pms: 'PMS',
    menopause: 'Menopause',
    wellness: 'Wellness',
    sexual_health: 'Sexual Health',
    general: 'General',
  },
};

const TAG_LABELS_TR: Record<string, string> = {
  cycle: 'döngü',
  period: 'regl',
  basics: 'temel-bilgiler',
  hormones: 'hormonlar',
  cramps: 'kramp',
  pms: 'pms',
  wellness: 'wellness',
  fertility: 'doğurganlık',
  conception: 'gebelik-planlama',
  ovulation: 'yumurtlama',
  pregnancy: 'hamilelik',
  nutrition: 'beslenme',
  iron: 'demir',
  magnesium: 'magnezyum',
  sexual_health: 'cinsel-sağlık',
  communication: 'iletişim',
  protection: 'korunma',
  checkup: 'kontrol',
  mental_health: 'ruh-sağlığı',
  sleep: 'uyku',
  hydration: 'su-tüketimi',
};

export function formatTagLabel(tag: string, locale: Locale): string {
  const normalized = (tag || '').trim();
  if (locale === 'tr') {
    return TAG_LABELS_TR[normalized.toLowerCase()] || normalized;
  }
  return normalized;
}

export function formatCurrencySymbol(currency?: string, symbol?: string): string {
  if (symbol && symbol.trim()) return symbol.trim();
  const code = (currency || 'TRY').toUpperCase();
  if (code === 'TRY') return '₺';
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  if (code === 'GBP') return '£';
  return code;
}

export function getRouteMeta(
  pathname: string,
  locale: Locale,
): { title: string; description: string; canonical: string } {
  const cleanPath = (pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const canonical = cleanPath === '/' ? SITE_URL : `${SITE_URL}${cleanPath}`;

  const routeMap: Record<
    string,
    { tr: { title: string; description: string }; en: { title: string; description: string } }
  > = {
    '/': {
      tr: {
        title: 'Kadın Atlası — Döngü, Hamilelik, Wellness ve NOVA AI Asistanı',
        description:
          'Regl ve yumurtlama takibi, hafta hafta hamilelik rehberi, ücretsiz sağlık hesaplayıcıları ve NOVA AI asistanı ile bütüncül kadın sağlığı platformu.',
      },
      en: {
        title: 'Kadın Atlası — Cycle, Pregnancy, Wellness & NOVA AI Companion',
        description:
          'Holistic women’s health platform featuring period & ovulation tracking, week-by-week pregnancy care, free calculators, and NOVA AI.',
      },
    },
    '/hesaplayicilar': {
      tr: {
        title: 'Sağlık ve Döngü Hesaplayıcıları (Regl, Gebelik, Su, VKİ, Kalori) — Kadın Atlası',
        description:
          'Üyelik gerektirmeyen ücretsiz regl ve yumurtlama günü, gebelik haftası, günlük su ihtiyacı, VKİ (BMI) ve bazal metabolizma (BMR) hesaplayıcıları.',
      },
      en: {
        title: 'Health & Cycle Calculators (Period, Pregnancy, Water, BMI, BMR) — Kadın Atlası',
        description:
          'Instant, registration-free calculators for menstrual cycle & ovulation, pregnancy week, daily water intake, BMI, and calorie needs.',
      },
    },
    '/kesfet': {
      tr: {
        title: 'Keşfet — Bilimsel Kadın Sağlığı Rehberleri ve Makaleler — Kadın Atlası',
        description:
          'Uzman editörler ve tıbbi yayın kurulu tarafından incelenen regl sağlığı, doğurganlık, gebelik, beslenme ve cinsel sağlık rehberleri.',
      },
      en: {
        title: 'Discover — Evidence-Informed Women’s Health Guides & Articles — Kadın Atlası',
        description:
          'Clinically reviewed articles and guides on menstrual health, fertility, pregnancy, nutrition, and sexual wellbeing.',
      },
    },
    '/premium': {
      tr: {
        title: 'Premium Planlar ve Özellik Karşılaştırması — Kadın Atlası',
        description:
          'Aylık 1.000 mesaj NOVA AI Pro sohbeti, 3 aylık döngü projeksiyonu, 90 günlük doktor raporu ve Partner Modu ile Kadın Atlası Premium.',
      },
      en: {
        title: 'Premium Plans & Feature Comparison — Kadın Atlası',
        description:
          'Unlock 1,000 monthly NOVA AI Pro messages, 3-month cycle projections, 90-day clinical doctor reports, and Partner Mode.',
      },
    },
    '/iletisim': {
      tr: {
        title: 'İletişim, Destek ve KVKK Başvuru Formu — Kadın Atlası',
        description:
          'Kadın Atlası destek ekibine ulaşın; uygulama desteği, iş birliği ve 6698 sayılı KVKK kapsamındaki veri taleplerinizi iletin.',
      },
      en: {
        title: 'Contact, Support & Data Protection (KVKK) Requests — Kadın Atlası',
        description:
          'Reach the Kadın Atlası support team for app assistance, partnerships, or KVKK / GDPR data subject requests.',
      },
    },
    '/sayfa/hakkimizda': {
      tr: {
        title: 'Hakkımızda ve Kurumsal Künye — Kadın Atlası',
        description:
          'Kadın Atlası kurumsal kimliği, işletmeci bilgileri, Tıbbi Yayın ve İnceleme Kurulu, bilimsel içerik ilkeleri ve veri etiği taahhüdü.',
      },
      en: {
        title: 'About Us & Corporate Information — Kadın Atlası',
        description:
          'Corporate identity, operator details, Medical Review Board, editorial standards, and data ethics commitment of Kadın Atlası.',
      },
    },
    '/sayfa/gizlilik-politikasi': {
      tr: {
        title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni — Kadın Atlası',
        description:
          '6698 sayılı KVKK uyarınca toplanan sağlık ve döngü verileri, işleme amaçları, NOVA AI veri güvenliği, saklama süreleri ve başvuru haklarınız.',
      },
      en: {
        title: 'Privacy Policy & Data Protection Disclosure — Kadın Atlası',
        description:
          'Full disclosure on health data protection, NOVA AI privacy guardrails, retention schedules, JSON export, and KVKK/GDPR rights.',
      },
    },
    '/sayfa/kvkk-aydinlatma-metni': {
      tr: {
        title: 'KVKK Aydınlatma ve Açık Rıza Metni — Kadın Atlası',
        description:
          'Özel nitelikli sağlık verilerinin işlenmesine ilişkin KVKK Madde 6 ve Madde 10 aydınlatma metni ve açık rıza yönetimi.',
      },
      en: {
        title: 'KVKK Clarification & Explicit Consent Notice — Kadın Atlası',
        description:
          'Information on mandatory vs. explicit-consent health data processing and how to withdraw consent anytime.',
      },
    },
    '/sayfa/kullanim-kosullari': {
      tr: {
        title: 'Kullanım Koşulları ve Yasal Uyarılar — Kadın Atlası',
        description:
          'Kadın Atlası kullanım şartları, tıbbi sorumluluk reddi, NOVA AI mesaj kotaları, topluluk kuralları ve abonelik iptal koşulları.',
      },
      en: {
        title: 'Terms of Service & Medical Disclaimer — Kadın Atlası',
        description:
          'Platform terms of use, medical disclaimer, NOVA AI quota rules, community guidelines, and subscription terms.',
      },
    },
  };

  const entry = routeMap[cleanPath] || routeMap['/'];
  return {
    title: entry[locale].title,
    description: entry[locale].description,
    canonical,
  };
}

export const translations = {
  tr: {
    meta: {
      title: 'Kadın Atlası — Döngü, Hamilelik, Wellness ve NOVA AI Asistanı',
      description:
        'Regl ve yumurtlama takibi, hafta hafta hamilelik rehberi, günlük su ve 4-7-8 nefes egzersizleri ile bütüncül kadın sağlığı platformu.',
    },
    brand: 'Kadın Atlası',
    tagline: 'Döngün, hamileliğin, wellness rutinin ve yapay zeka asistanın NOVA tek uygulamada.',
    nav: {
      home: 'Ana Sayfa',
      calculators: 'Hesaplayıcılar',
      discover: 'Keşfet',
      premium: 'Premium',
      contact: 'İletişim & Destek',
      download: 'Uygulamayı İndir',
      ariaSwitchLang: 'Dili değiştir (İngilizceye geç)',
      ariaThemeLight: 'Açık temaya geç',
      ariaThemeDark: 'Koyu temaya geç',
      ariaMenuOpen: 'Menüyü aç',
      ariaMenuClose: 'Menüyü kapat',
    },
    hero: {
      badge: 'Kadın Sağlığı & Wellness Ekosistemi',
      titleStart: 'Bedenini Tanı,',
      titleHighlight: 'Ritminde Yaşa.',
      subtitle:
        'Regl döngüsü tahminlerinden gebelik takibine, su ve nefes egzersizlerinden 7/24 NOVA AI rehberliğine kadar her anında yanında olan akıllı yol arkadaşın.',
      ctaDownload: 'Ücretsiz İndir (iOS & Android)',
      ctaCalculators: 'Ücretsiz Hesaplayıcıları Dene',
      benefitCalcTitle: 'Ücretsiz Hesaplayıcılar',
      benefitCalcDesc: 'Kayıt gerektirmeyen 5 klinik araç →',
      benefitTrackTitle: 'Günlük Takip',
      benefitTrackDesc: 'Regl, gebelik, su, uyku ve semptom',
      benefitPrivacyTitle: 'Veri Kontrolü Sende',
      benefitPrivacyDesc: 'KVKK uyumlu, JSON indir & sil →',
      syncBadge: 'Cihazlar Arası Senkron',
      syncDesc:
        'Döngü takvimin, günlük su/uyku kayıtların ve NOVA AI sohbetlerin telefonun ile güvenli bulut hesabın arasında otomatik senkronize edilir.',
    },
    features: {
      title: 'Tek Uygulamada Bütüncül Kadın Sağlığı',
      subtitle: 'Her gün 5 saniyelik check-in ile döngünü ve enerjini yakından tanı.',
      items: [
        {
          title: 'Akıllı Regl & Ovulasyon Takvimi',
          desc: 'Son döngülerine göre yüksek doğruluklu regl başlangıcı, yumurtlama ve doğurganlık penceresi tahminleri.',
          mascot: '/images/mascots/penregl.png',
        },
        {
          title: 'Hafta Hafta Hamilelik Modu',
          desc: 'Bebeğin haftalık gelişimi, tekme sayacı, kasılma zamanlayıcısı, doğum planı ve doktor randevu takibi.',
          mascot: '/images/mascots/1.png',
        },
        {
          title: 'NOVA AI Sağlık Asistanı',
          desc: 'Döngü fazına ve belirttiğin semptomlara duyarlı, empatik yapay zeka sohbeti.',
          mascot: '/images/mascots/Morning.png',
        },
        {
          title: 'Su, Adım, Uyku & 4-7-8 Nefes',
          desc: 'Kilona göre kişisel su hedefi, kramp/uyku rahatlatıcı animasyonlu nefes seansları ve doktor özeti raporu.',
          mascot: '/images/mascots/GoodNight.png',
        },
        {
          title: 'Anonim Kadın Topluluğu',
          desc: 'Sorularını güvenle sor, uzman ve topluluk yanıtlarını oyla, deneyim paylaş.',
          mascot: '/images/mascots/5.png',
        },
        {
          title: 'Astroloji & Doğum Haritası',
          desc: 'Günlük, haftalık burç yorumları, kozmik gökyüzü özetleri ve kişisel doğum haritası analizi.',
          mascot: '/images/mascots/6.png',
        },
      ],
    },
    calculators: {
      badge: 'Kayıt Gerektirmez • Anlık Hesaplama',
      title: 'İnteraktif Sağlık Hesaplayıcıları',
      subtitle:
        'Döngü tarihini, hamilelik haftanı, günlük su ihtiyacını ve vücut analizini hemen hesapla.',
      tabs: {
        cycle: 'Regl & Yumurtlama',
        pregnancy: 'Hamilelik Haftası',
        water: 'Günlük Su İhtiyacı',
        bmi: 'BMI İndeksi',
        bmr: 'Kalori (BMR & TDEE)',
      },
      ctaSaveTitle: 'Sonuçlarını Otomatik Takip Etmek İster misin?',
      ctaSaveDesc:
        'Kadın Atlası mobil uygulamasında günlük check-in, akıllı su/ilaç hatırlatıcıları ve doktor raporu seninle.',
    },
    discover: {
      badge: 'Bilimsel & Güvenilir Rehber',
      title: 'Keşfet & Sağlık Kütüphanesi',
      subtitle: 'Kadın sağlığı, regl dönemi, gebelik, beslenme ve ruh sağlığı hakkında güncel içerikler.',
      searchPlaceholder: 'Makale veya konu ara...',
      readTime: 'dk okuma',
      readMore: 'Makaleyi Oku',
      empty: 'Aramana uygun aktif makale bulunamadı.',
      backToList: 'Tüm Makalelere Dön',
      relatedTitle: 'İlgili Makaleler',
    },
    premium: {
      badge: 'Premium Deneyim',
      ctaApp: 'Uygulamada Başlat',
      monthly: 'Aylık Plan',
      yearly: 'Yıllık Plan',
      comparisonTitle: 'Ücretsiz vs Premium Karşılaştırması',
      freeCol: 'Ücretsiz',
      premiumCol: 'Premium',
      trialBadge: 'gün ücretsiz deneme',
      storeNote: 'Abonelikler Apple App Store ve Google Play güvencesiyle mobil uygulama üzerinden yönetilir.',
    },
    contact: {
      badge: 'Destek & İletişim',
      title: 'Bize Ulaşın',
      subtitle:
        'Soruların, iş birliği taleplerin veya uygulama geri bildirimlerin doğrudan destek ekibimize iletilir.',
      name: 'Adınız Soyadınız',
      email: 'E-posta Adresiniz',
      category: 'Kategori',
      subject: 'Konu',
      message: 'Mesajınız',
      send: 'Mesajı Gönder',
      sending: 'Gönderiliyor...',
      successTitle: 'Mesajınız Alındı!',
      successDesc: 'Talebiniz destek ekibimize iletildi. En kısa sürede e-posta ile dönüş yapacağız.',
    },
    downloadModal: {
      title: 'Kadın Atlası’nı Telefonuna İndir',
      subtitle: 'iOS ve Android cihazlarda ücretsiz başla, tüm döngü ve wellness verilerini güvenle sakla.',
      ios: 'App Store’dan İndir',
      android: 'Google Play’den İndir',
      close: 'Pencereyi kapat',
    },
    footer: {
      desc: 'Kadın sağlığı, döngü bilinci, hamilelik ve bütüncül wellness için tasarlanmış güvenli dijital yol arkadaşınız.',
      linksTitle: 'Platform',
      legalTitle: 'Kurumsal & Gizlilik',
      rights: 'Tüm hakları saklıdır.',
      medicalNote:
        'Bu web sitesindeki hesaplayıcılar ve makaleler bilgilendirme amaçlıdır; tıbbi teşhis yerine geçmez.',
    },
  },
  en: {
    meta: {
      title: 'Kadın Atlası — Cycle, Pregnancy, Wellness & NOVA AI Companion',
      description:
        'Holistic women’s health platform featuring period & ovulation tracking, week-by-week pregnancy care, daily hydration, and 4-7-8 breathing.',
    },
    brand: 'Kadın Atlası',
    tagline: 'Your cycle, pregnancy, wellness habits, and NOVA AI assistant in one app.',
    nav: {
      home: 'Home',
      calculators: 'Calculators',
      discover: 'Discover',
      premium: 'Premium',
      contact: 'Contact & Support',
      download: 'Get the App',
      ariaSwitchLang: 'Switch language to Turkish',
      ariaThemeLight: 'Switch to light theme',
      ariaThemeDark: 'Switch to dark theme',
      ariaMenuOpen: 'Open menu',
      ariaMenuClose: 'Close menu',
    },
    hero: {
      badge: 'Women’s Health & Wellness Platform',
      titleStart: 'Know Your Body,',
      titleHighlight: 'Live in Rhythm.',
      subtitle:
        'From smart period & ovulation predictions to pregnancy tracking, hydration, 4-7-8 breathing, and 24/7 NOVA AI guidance.',
      ctaDownload: 'Download Free (iOS & Android)',
      ctaCalculators: 'Try Free Calculators',
      benefitCalcTitle: 'Free Calculators',
      benefitCalcDesc: '5 instant clinical tools, no sign-up →',
      benefitTrackTitle: 'Daily Tracking',
      benefitTrackDesc: 'Period, pregnancy, water & sleep logs',
      benefitPrivacyTitle: 'You Control Your Data',
      benefitPrivacyDesc: 'KVKK/GDPR, JSON export & delete →',
      syncBadge: 'Cross-Device Cloud Sync',
      syncDesc:
        'Your cycle calendar, daily water/sleep logs, and NOVA AI chats stay automatically synced between your phone and secure cloud account.',
    },
    features: {
      title: 'Holistic Women’s Health in One Place',
      subtitle: 'Build a gentle daily habit with 5-second check-ins and cycle-aware guidance.',
      items: [
        {
          title: 'Smart Cycle & Ovulation Calendar',
          desc: 'Moving-average period start, ovulation day, and fertile window predictions.',
          mascot: '/images/mascots/penregl.png',
        },
        {
          title: 'Week-by-Week Pregnancy Mode',
          desc: 'Fetal milestones, kick counter, contraction timer, birth plan, and doctor visits.',
          mascot: '/images/mascots/1.png',
        },
        {
          title: 'NOVA AI Health Companion',
          desc: 'Empathetic AI chat tailored to your cycle phase and logged symptoms.',
          mascot: '/images/mascots/Morning.png',
        },
        {
          title: 'Water, Steps, Sleep & 4-7-8 Breathing',
          desc: 'Weight-based hydration targets, animated relief breathing, and shareable doctor reports.',
          mascot: '/images/mascots/GoodNight.png',
        },
        {
          title: 'Anonymous Women’s Community',
          desc: 'Ask questions privately or openly, vote on helpful answers, and share experiences.',
          mascot: '/images/mascots/5.png',
        },
        {
          title: 'Astrology & Birth Chart',
          desc: 'Daily/weekly horoscopes, cosmic weather overviews, and personal birth chart insights.',
          mascot: '/images/mascots/6.png',
        },
      ],
    },
    calculators: {
      badge: 'No Account Needed • Instant Results',
      title: 'Interactive Health Calculators',
      subtitle: 'Estimate your next cycle, pregnancy week, daily hydration target, BMI, and calories.',
      tabs: {
        cycle: 'Cycle & Ovulation',
        pregnancy: 'Pregnancy Week',
        water: 'Daily Water',
        bmi: 'BMI Index',
        bmr: 'Calories (BMR & TDEE)',
      },
      ctaSaveTitle: 'Want Automatic History & Smart Reminders?',
      ctaSaveDesc:
        'Download Kadın Atlası to save logs, unlock daily check-ins, and export doctor summary reports.',
    },
    discover: {
      badge: 'Evidence-Informed Library',
      title: 'Discover & Health Guides',
      subtitle: 'Curated articles on menstrual wellness, pregnancy care, nutrition, and mindfulness.',
      searchPlaceholder: 'Search articles or topics...',
      readTime: 'min read',
      readMore: 'Read Article',
      empty: 'No active articles matched your search.',
      backToList: 'Back to Articles',
      relatedTitle: 'Related Articles',
    },
    premium: {
      badge: 'Premium Experience',
      ctaApp: 'Start in App',
      monthly: 'Monthly Plan',
      yearly: 'Yearly Plan',
      comparisonTitle: 'Free vs Premium Comparison',
      freeCol: 'Free',
      premiumCol: 'Premium',
      trialBadge: 'days free trial',
      storeNote: 'Subscriptions are securely billed and managed via Apple App Store and Google Play.',
    },
    contact: {
      badge: 'Support & Contact',
      title: 'Get in Touch',
      subtitle:
        'Questions, partnership inquiries, or app feedback go directly to our support inbox.',
      name: 'Full Name',
      email: 'Email Address',
      category: 'Category',
      subject: 'Subject',
      message: 'Message',
      send: 'Send Message',
      sending: 'Sending...',
      successTitle: 'Message Received!',
      successDesc: 'Your inquiry has been logged for our team. We will reply by email soon.',
    },
    downloadModal: {
      title: 'Get Kadın Atlası on Your Phone',
      subtitle: 'Start free on iOS or Android and keep your cycle and wellness data synced securely.',
      ios: 'Download on App Store',
      android: 'Get it on Google Play',
      close: 'Close modal',
    },
    footer: {
      desc: 'Your trusted digital companion for menstrual health, pregnancy care, and holistic wellness.',
      linksTitle: 'Platform',
      legalTitle: 'Company & Legal',
      rights: 'All rights reserved.',
      medicalNote:
        'Calculators and articles on this website are for informational purposes only and do not substitute medical advice.',
    },
  },
};

const PAYWALL_TEXT_EN: Record<string, string> = {
  'Sağlığını 360° Keşfet & Planla': 'Explore & Plan Your Health 360°',
  '3 aylık döngü projeksiyonu, uyku-kramp korelasyonları, doktora özel klinik rapor, Partner Modu ve 10x NOVA AI kapasitesiyle tam kontrol.':
    'Full control with 3-month cycle projections, sleep-cramp correlations, clinical doctor reports, Partner Mode, and 1,000 monthly NOVA AI Pro messages.',
  'Aylık Plan': 'Monthly Plan',
  'Yıllık Plan': 'Yearly Plan',
  'Esnek faturalandırma • İstediğin zaman iptal': 'Flexible billing • Cancel anytime',
  'Aylık ~₺83 • En avantajlı seçenek': '~83 ₺/mo • Best value',
  'EN POPÜLER': 'MOST POPULAR',
  '%17 Tasarruf': 'Save 17%',
  'Gelecek 3 Ay Döngü Projeksiyonu': '3-Month Cycle Projection',
  '90 Günlük Klinik Doktor Raporu': '90-Day Clinical Doctor Report',
  'Partner Modu (Eş Paylaşımı)': 'Partner Mode (Partner Sharing)',
  'Partner Modu & Doğum Haritası': 'Partner Mode & Birth Chart',
  'Uyku & Kramp Korelasyon Analizi': 'Sleep & Cramp Correlation Analysis',
  'Uyku & Kramp Korelasyonu': 'Sleep & Cramp Correlation',
  'Doğum Haritası & Burç Uyumu': 'Birth Chart & Zodiac Compatibility',
  'Doğum Haritası & Uyum': 'Birth Chart & Compatibility',
  'NOVA Pro Hafıza (1.000 mesaj/ay)': 'NOVA Pro Memory (1,000 messages/month)',
  'NOVA Pro Hafıza (1000+ mesaj/ay)': 'NOVA Pro Memory (1,000 messages/month)',
  '3 Aylık Döngü Projeksiyonu': '3-Month Cycle Projection',
  '1 Döngü': '1 Cycle',
  '3 Ay İleriye': '3 Months Ahead',
  'Klinik Doktor Raporu': 'Clinical Doctor Report',
  '30 Gün Metin': '30 Days Text',
  '90 Gün + PDF/HTML': '90 Days + PDF/HTML',
  '1 Özet': '1 Summary',
  'Tam Analiz': 'Full Analysis',
  'NOVA AI Kotası & Uzun Yanıt': 'NOVA AI Quota & Extended Replies',
  '100 mesaj/ay (Temel)': '100 msgs/mo (Basic)',
  '1.000 mesaj/ay (Pro)': '1,000 msgs/mo (Pro)',
  '100 / Temel': '100 msgs/mo (Basic)',
  '1000+ / Pro': '1,000 msgs/mo (Pro)',
  "Premium'u nasıl iptal edebilirim?": 'How can I cancel Premium?',
  "Ayarlar > Abonelik Yönetimi'nden istediğiniz zaman iptal edebilirsiniz. Mevcut dönem sonuna kadar erişiminiz sürer.":
    'You can cancel anytime from Settings > Subscription Management. Access continues until the end of your current billing period.',
  'Farklı cihazlarda kullanabilir miyim?': 'Can I use it across different devices?',
  'Evet, aynı hesapla giriş yaptığınız tüm cihazlarda premium özellikleriniz otomatik aktif olur.':
    'Yes, your Premium features automatically sync across every device signed in with the same account.',
  'Deneme süresi var mı?': 'Is there a free trial?',
  'İlk kez abone olan kullanıcılar 7 günlük ücretsiz deneme süresi boyunca tüm özellikleri deneyimleyebilir.':
    'First-time subscribers can explore all Premium features during a 7-day free trial.',
  'Aylık ve yıllık plan arasındaki fark nedir?': 'What is the difference between Monthly and Yearly plans?',
  'Her iki plan da tüm premium özellikleri içerir. Yıllık plan ile %17 tasarruf sağlarsınız.':
    'Both plans include all Premium features. Choosing the Yearly plan saves 17%.',
  'Ödeme güvenli mi?': 'Are payments secure?',
  'Tüm ödemeler Apple App Store veya Google Play Store altyapısı üzerinden güvenle işlenir.':
    'All payments are securely processed through Apple App Store or Google Play Store.',
};

function trToEn(text?: string): string | undefined {
  if (!text) return text;
  return PAYWALL_TEXT_EN[text] || text;
}

export function localizePaywall(
  paywall: PaywallConfig | null,
  locale: Locale,
): PaywallConfig | null {
  if (!paywall || locale !== 'en') return paywall;

  return {
    ...paywall,
    heroBadge: trToEn(paywall.heroBadge),
    heroTitle: trToEn(paywall.heroTitle) || paywall.heroTitle,
    heroSubtitle: trToEn(paywall.heroSubtitle) || paywall.heroSubtitle,
    plans: {
      MONTHLY: {
        ...paywall.plans.MONTHLY,
        title: trToEn(paywall.plans.MONTHLY.title) || paywall.plans.MONTHLY.title,
        subtitle: trToEn(paywall.plans.MONTHLY.subtitle),
        badge: trToEn(paywall.plans.MONTHLY.badge),
        badgeText: trToEn(paywall.plans.MONTHLY.badgeText),
        savingsText: trToEn(paywall.plans.MONTHLY.savingsText),
        features: (paywall.plans.MONTHLY.features || []).map((f) => trToEn(f) || f),
      },
      YEARLY: {
        ...paywall.plans.YEARLY,
        title: trToEn(paywall.plans.YEARLY.title) || paywall.plans.YEARLY.title,
        subtitle: trToEn(paywall.plans.YEARLY.subtitle),
        badge: trToEn(paywall.plans.YEARLY.badge),
        badgeText: trToEn(paywall.plans.YEARLY.badgeText),
        savingsText: trToEn(paywall.plans.YEARLY.savingsText),
        features: (paywall.plans.YEARLY.features || []).map((f) => trToEn(f) || f),
      },
    },
    comparisonRows: (paywall.comparisonRows || []).map((row) => ({
      ...row,
      title: trToEn(row.title) || row.title,
      freeValue: typeof row.freeValue === 'string' ? trToEn(row.freeValue) || row.freeValue : row.freeValue,
      premiumValue:
        typeof row.premiumValue === 'string' ? trToEn(row.premiumValue) || row.premiumValue : row.premiumValue,
    })),
    faq: (paywall.faq || []).map((item) => ({
      question: trToEn(item.question) || item.question,
      answer: trToEn(item.answer) || item.answer,
    })),
  };
}
