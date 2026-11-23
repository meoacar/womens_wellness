export interface ChangelogSection {
  heading: string;
  items: Array<{ category: string; text: string }>;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  badgeTr: string;
  badgeEn: string;
  isMajor: boolean;
  isLatest?: boolean;
  titleTr: string;
  titleEn: string;
  summaryTr: string;
  summaryEn: string;
  sectionsTr: ChangelogSection[];
  sectionsEn: ChangelogSection[];
}

export const LATEST_APP_VERSION = '1.4.0';

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '1.4.0',
    date: '22 Kasım 2026',
    badgeTr: 'Büyük Güncelleme',
    badgeEn: 'Major Release',
    isMajor: true,
    isLatest: true,
    titleTr: 'Günün Eğlenceli Mikro-Kartları & 9:16 Hikâye Paylaşımı',
    titleEn: 'Daily Fun Micro-Cards & 9:16 Shareable Story Cards',
    summaryTr:
      'Döngü ve yaşam evrenize göre kişiselleştirilen samimi/bilimsel günlük mikro-kartlar, tek dokunuşla Instagram/WhatsApp hikâye paylaşımı ve bildirim tekilleştirme iyileştirmeleri yayınlandı.',
    summaryEn:
      'Launched personalized daily micro-cards with Fun/Scientific tone switcher, 9:16 Instagram/WhatsApp Story card sharing, and notification deduplication.',
    sectionsTr: [
      {
        heading: 'Günün Kartları & Hikâye Paylaşımı',
        items: [
          { category: 'Ana Sayfa', text: 'Sağa-sola kaydırılabilir "Günün Kartları" destesi ve "Samimi" / "Bilimsel" ses tonu seçimi eklendi.' },
          { category: 'Paylaşım', text: 'Her mikro-kart için 9:16 dikey PNG görsel üreten Instagram / WhatsApp Hikâye paylaşım ekranı eklendi.' },
          { category: 'Admin', text: 'Admin paneline "Günün Mikro-Kartları" yönetim ekranı (ekleme, düzenleme, ton ve faz seçimi) eklendi.' },
        ],
      },
      {
        heading: 'Taşınabilir Veri Yedeği & Bildirim İyileştirmeleri',
        items: [
          { category: 'Yedekleme', text: 'Ayarlar > Verilerim bölümüne "Yedeğimi E-postama Gönder" (JSON ekli e-posta yedeği) ve "Yedek Dosyasından Geri Yükle" özellikleri eklendi; JSON dışa aktarma dosya sistemi hatası giderildi.' },
          { category: 'Bildirim', text: 'Aynı saatte gelen çift regl destek bildirimleri cihaz ve sunucu tarafında tekilleştirildi.' },
          { category: 'API', text: '/qna/reputation/me oturum doğrulama hatası giderildi.' },
        ],
      },
      {
        heading: 'Topluluk Deneyimi, Güvenlik & AI Moderasyon',
        items: [
          { category: 'Topluluk', text: 'Premium üyelerin isminin yanında PRO rozeti gösterimi, konu açarken ve cevap verirken haftalık resim ekleme hakkı (ücretsiz üyelere haftada 2, Premium üyelere haftada 5 resim; her hafta otomatik sıfırlanır) eklendi.' },
          { category: 'Topluluk', text: 'Alt menüdeki Topluluk sekmesine okunmamış bildirim rozeti (badge), cevap gönderildiğinde anlık liste yenileme, koyu tema uyumlu "İlgili Sorular" kartı ve klavye hizalama düzeltmesi eklendi.' },
          { category: 'Güvenlik', text: 'Toplulukta Kullanıcı Engelleme, içerik gizleme ve Ayarlar > Engellenen Kullanıcılar yönetim ekranı eklendi.' },
          { category: 'NOVA AI', text: 'Sohbet ekranından doğrudan AI yanıtlarını bildirme akışı ve Admin Panelinde inceleme ekranı yayınlandı.' },
        ],
      },
      {
        heading: 'Gizlilik, Hesap Silme, Takvim & Biyometrik Kilit',
        items: [
          { category: 'Takvim', text: 'Henüz gelmemiş ileri tarihlere regl başlatma, bitiş uzatma ve günlük kayıt eklenmesi hem uygulama hem API tarafında engellendi.' },
          { category: 'Güvenlik', text: 'Parmak İzi / Face ID biyometrik kilit açılış penceresinin soğuk başlatmada otomatik açılması sağlandı.' },
          { category: 'Topluluk', text: 'Soru detay ekranındaki "Öne Çıkan" rozeti yazılı etiketle netleştirildi.' },
          { category: 'Hesap Silme', text: 'Web üzerinde doğrudan "Hesabımı ve Verilerimi Silmek İstiyorum" (/hesap-silme) talep sayfası ve iletişim formu seçeneği eklendi.' },
          { category: 'Gizlilik', text: 'Gizlilik politikası gerçek ödeme (doğrudan Apple/Google mağaza doğrulaması) ve 7 günlük yedek döngüsü / cascade silme davranışıyla uyumlu hale getirildi.' },
          { category: 'Sağlık', text: 'Health Connect izin kontrolleri Adım ve Uyku için ayrı ayrı yapılandırıldı ve gizlilik politikası intent yönlendirmesi eklendi.' },
        ],
      },
    ],
    sectionsEn: [
      {
        heading: 'Daily Cards & Story Sharing',
        items: [
          { category: 'Home', text: 'Added swipeable "Daily Cards" deck with "Friendly" / "Scientific" tone switcher.' },
          { category: 'Sharing', text: 'Added 9:16 vertical PNG Story card generator for Instagram & WhatsApp sharing.' },
          { category: 'Admin', text: 'Added Admin Panel management for daily micro-cards across phases and tones.' },
        ],
      },
      {
        heading: 'Portable Data Backup & Stability',
        items: [
          { category: 'Backup', text: 'Added "Send Backup to My Email" (JSON email attachment) and "Restore from Backup File" in Settings, plus fixed JSON file export.' },
          { category: 'Notifications', text: 'Deduplicated period-support notifications across device and server.' },
          { category: 'API', text: 'Fixed /qna/reputation/me session resolution.' },
        ],
      },
      {
        heading: 'Community Experience, Safety & AI Moderation',
        items: [
          { category: 'Community', text: 'Added inline PRO badge next to Premium members\' names, plus weekly image upload quota (2/week for free, 5/week for Premium members, auto-resetting every week) for questions and answers.' },
          { category: 'Community', text: 'Added unread notification badge on the Community tab, instant answer refresh, dark-mode Related Questions card, and keyboard avoidance fix.' },
          { category: 'Safety', text: 'Added User Blocking across Community feeds/threads and the Blocked Users management screen.' },
          { category: 'NOVA AI', text: 'Added in-chat AI response reporting and an Admin Panel review queue.' },
        ],
      },
      {
        heading: 'Privacy, Account Deletion, Calendar & Biometric Lock',
        items: [
          { category: 'Calendar', text: 'Prevented logging period dates or daily entries on future dates across both mobile UI and API.' },
          { category: 'Security', text: 'Fixed Fingerprint / Face ID biometric prompt auto-triggering on cold app launch.' },
          { category: 'Community', text: 'Added a clear "Featured" label badge on the question detail header.' },
          { category: 'Account Deletion', text: 'Added dedicated web account & data deletion page (/hesap-silme) and contact form option.' },
          { category: 'Privacy', text: 'Aligned Privacy Policy with direct App Store/Google Play receipt verification, cascade deletion, and 7-day rolling backup rotation.' },
          { category: 'Health', text: 'Scoped Health Connect permission checks per record type (Steps & SleepSession) and wired privacy rationale intents.' },
        ],
      },
    ],
  },
  {
    version: '1.1.0 – 1.3.0',
    date: '21 Kasım 2026',
    badgeTr: 'Büyük Güncelleme Paketi',
    badgeEn: 'Major Release Bundle',
    isMajor: true,
    titleTr: 'Anne & Bebek, Yeni Ana Sayfa, Topluluk Yenilemesi & Sağlık Entegrasyonları',
    titleEn: 'Postpartum & Baby Care, Streamlined Home, Community Redesign & Health Sync',
    summaryTr:
      '21 Kasım günü yayınlanan üç büyük sürüm tek çatı altında: Topluluk & XP sistemi, yenilenen Ana Sayfa ve Hamilelik ekranı, Anne & Bebek modülü, Health Connect ve Biyometrik Kilit.',
    summaryEn:
      'Three major releases shipped on November 21: Community & XP rewards, redesigned Home & Pregnancy screens, Postpartum & Baby Care, Health Connect, and Biometric Lock.',
    sectionsTr: [
      {
        heading: 'Topluluk Yenilemesi, XP Sistemi & Hukuki Şeffaflık (v1.3.0)',
        items: [
          { category: 'Topluluk', text: 'Soru sorma ekranı baştan tasarlandı; günlük/aylık limitler, karakter kuralları, kategoriler ve anonimlik admin panelinden yönetilebilir hale getirildi.' },
          { category: 'Gamification', text: 'Topluluk puanları artık doğrudan Gamification XP kazandırıyor; topluluk kotası ve Kullanım İstatistikleri senkronize edildi.' },
          { category: 'KVKK & Profil', text: 'Kayıt formuna KVKK linkleri, abonelik sayfalarına Ön Bilgilendirme & Abonelik Koşulları ve profil isminin yanına Premium rozeti eklendi.' },
        ],
      },
      {
        heading: 'Sadeleştirilmiş Ana Sayfa, Hamilelik & NOVA AI (v1.2.0)',
        items: [
          { category: 'Ana Sayfa', text: 'Alt bölüm "Günlük Rutin" ve "Keşfet & Astroloji" sekmeleriyle sadeleştirildi; döngü günü Takvim ile birebir eşitlendi.' },
          { category: 'Hamilelik', text: 'Gradient hero kartı, 40 haftalık ilerleme çubuğu ve 2 sütunlu araç ızgarası ile modern tasarım yayınlandı.' },
          { category: 'NOVA & SEO', text: 'NOVA uzun yanıt desteği (yarıda kesilme çözümü) ve web sitesine OpenGraph, JSON-LD ile App Links (.well-known) eklendi.' },
        ],
      },
      {
        heading: 'Anne & Bebek (Lohusalık), Health Connect & Biyometrik Kilit (v1.1.0)',
        items: [
          { category: 'Anne & Bebek', text: 'Emzirme/biberon, bez, uyku, büyüme ve T.C. Sağlık Bakanlığı aşı takvimi modülü ile Admin takip ekranı eklendi.' },
          { category: 'Sağlık & Rapor', text: 'Google Health Connect senkronizasyonu ve doktor muayeneleri için tek dokunuşla PDF sağlık raporu dışa aktarma eklendi.' },
          { category: 'Güvenlik', text: 'PIN kilidine ek olarak Parmak İzi / Yüz Tanıma ile hızlı kilit açma eklendi.' },
        ],
      },
    ],
    sectionsEn: [
      {
        heading: 'Community Redesign, XP System & Compliance (v1.3.0)',
        items: [
          { category: 'Community', text: 'Redesigned Ask Question screen; limits, character rules, categories, and anonymity are configurable from Admin Panel.' },
          { category: 'Gamification', text: 'Community points now award Gamification XP; fixed quota sync and Usage Statistics.' },
          { category: 'Compliance & Profile', text: 'Added KVKK links on signup, Subscription Pre-Information on paywalls, and Profile Premium badge.' },
        ],
      },
      {
        heading: 'Streamlined Home, Pregnancy & NOVA AI (v1.2.0)',
        items: [
          { category: 'Home', text: 'Added segmented lower tabs ("Daily Routine" / "Discover & Astrology") and synchronized cycle day with Calendar.' },
          { category: 'Pregnancy', text: 'Redesigned Pregnancy tracker with gradient hero, 40-week progress bar, and 2-column tool grid.' },
          { category: 'NOVA & SEO', text: 'Fixed truncated NOVA replies and added OpenGraph, JSON-LD, and .well-known App Links.' },
        ],
      },
      {
        heading: 'Postpartum & Baby Care, Health Connect & Biometric Lock (v1.1.0)',
        items: [
          { category: 'Postpartum', text: 'Added feeding, diaper, sleep, growth, and vaccination tracking with Admin monitoring.' },
          { category: 'Health & PDF', text: 'Added Google Health Connect sync and one-tap PDF doctor health report export.' },
          { category: 'Security', text: 'Added Biometric (Fingerprint / Face ID) unlock alongside SHA-256 local PIN.' },
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '19 Kasım 2026',
    badgeTr: 'İlk Sürüm',
    badgeEn: 'Initial Release',
    isMajor: true,
    titleTr: 'Kadın Atlası İlk Kararlı Yayın',
    titleEn: 'Kadın Atlası Initial Stable Release',
    summaryTr:
      'Regl ve yumurtlama takibi, NOVA AI asistanı, günlük wellness hedefleri, adım sayacı, Google ile giriş ve KVKK uyumlu altyapı ile ilk yayın.',
    summaryEn:
      'Initial release with cycle & ovulation tracking, NOVA AI assistant, daily wellness goals, step counter, Google Sign-In, and KVKK compliance.',
    sectionsTr: [
      {
        heading: 'Temel Platform & Güvenlik',
        items: [
          { category: 'Giriş & Güvenlik', text: 'Google OAuth ile hızlı giriş, yerel SHA-256 PIN kilidi ve e-posta doğrulama altyapısı.' },
          { category: 'Adım Sayacı', text: 'Arka plan adım sayacı servisi ve gece yarısı (TRT) otomatik sıfırlama.' },
          { category: 'Bildirimler', text: 'Şeffaf bildirim izin penceresi ve özelleştirilebilir hatırlatıcılar.' },
        ],
      },
    ],
    sectionsEn: [
      {
        heading: 'Core Platform & Security',
        items: [
          { category: 'Auth & Security', text: 'Google OAuth sign-in, instant local SHA-256 PIN unlock, and SMTP email delivery.' },
          { category: 'Step Counter', text: 'Foreground step tracking service with automatic midnight reset.' },
          { category: 'Notifications', text: 'Transparent notification consent flow and customizable reminders.' },
        ],
      },
    ],
  },
];
