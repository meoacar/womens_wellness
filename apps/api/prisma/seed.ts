import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { seedCommunity } from './seed-community';
import { seedAstrology } from './seed-astrology';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user with explicit admin role
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@wellness.local' },
    update: {
      isAdmin: true,
    },
    create: {
      email: 'admin@wellness.local',
      password: await hash('admin123', 10),
      isAdmin: true,
      profile: {
        create: {
          displayName: 'Admin User',
          timezone: 'Europe/Istanbul',
        },
      },
      subscription: {
        create: {
          status: 'ACTIVE',
          tier: 'YEARLY',
          startDate: new Date(),
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          aiMessagesLimit: 1000,
          aiMessagesUsed: 0,
          quotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      },
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create free user
  const freeUser = await prisma.user.upsert({
    where: { email: 'free@wellness.local' },
    update: {},
    create: {
      email: 'free@wellness.local',
      password: await hash('free123', 10),
      profile: {
        create: {
          displayName: 'Free User',
          timezone: 'Europe/Istanbul',
          heightCm: 165,
          weightKg: 60,
        },
      },
      subscription: {
        create: {
          status: 'FREE',
          aiMessagesLimit: 100,
          aiMessagesUsed: 0,
          quotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      },
      usageQuota: {
        create: {
          monthKey: new Date().toISOString().slice(0, 7), // YYYY-MM
          aiRequests: 0,
          limit: 100,
          resetsAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      },
    },
  });

  console.log('✅ Created free user:', freeUser.email);

  // Create premium user
  const premiumUser = await prisma.user.upsert({
    where: { email: 'premium@wellness.local' },
    update: {},
    create: {
      email: 'premium@wellness.local',
      password: await hash('premium123', 10),
      profile: {
        create: {
          displayName: 'Premium User',
          timezone: 'Europe/Istanbul',
          heightCm: 170,
          weightKg: 65,
        },
      },
      subscription: {
        create: {
          status: 'ACTIVE',
          tier: 'MONTHLY',
          startDate: new Date(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
          aiMessagesLimit: 1000,
          aiMessagesUsed: 0,
          quotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      },
      usageQuota: {
        create: {
          monthKey: new Date().toISOString().slice(0, 7),
          aiRequests: 0,
          limit: 1000,
          resetsAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      },
    },
  });

  console.log('✅ Created premium user:', premiumUser.email);

  // Create model policies
  const freePolicy = await prisma.modelPolicy.upsert({
    where: { plan_provider: { plan: 'free', provider: 'openai' } },
    update: {},
    create: {
      plan: 'free',
      provider: 'openai',
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1024,
      toolsEnabledJson: ['get_user_metrics', 'get_quota'],
    },
  });

  console.log('✅ Created free model policy:', freePolicy.id);

  const premiumPolicy = await prisma.modelPolicy.upsert({
    where: { plan_provider: { plan: 'premium', provider: 'anthropic' } },
    update: {},
    create: {
      plan: 'premium',
      provider: 'anthropic',
      modelName: 'claude-3-5-sonnet-20241022',
      temperature: 0.8,
      maxTokens: 4096,
      toolsEnabledJson: [
        'get_user_metrics',
        'log_water',
        'get_next_period_prediction',
        'create_reminder',
        'get_quota',
      ],
    },
  });

  console.log('✅ Created premium model policy:', premiumPolicy.id);

  // Create feature flags
  const coreFlags = [
    { key: 'maintenance_mode', valueJson: false },
    { key: 'partner_mode_enabled', valueJson: true },
    { key: 'community_enabled', valueJson: true },
    { key: 'astrology_enabled', valueJson: true },
  ];

  for (const flag of coreFlags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: flag,
    });
  }

  console.log('✅ Created feature flags');

  // Create educational articles
  const articles = [
    // Menstrual Health Articles
    {
      titleTr: 'Menstrüel Siklusunuzu Anlamak: Kapsamlı Rehber',
      titleEn: 'Understanding Your Menstrual Cycle: A Comprehensive Guide',
      excerpt: 'Menstrüel siklusunuzun fazlarını öğrenin ve vücudunuzla daha iyi bağlantı kurun.',
      contentTr: `# Menstrüel Siklus Nedir?

Menstrüel siklus, kadın vücudunun her ay gebeliğe hazırlanma sürecidir. Bu doğal süreç, hormonların karmaşık etkileşimi ile düzenlenir ve ortalama 28 gün sürer, ancak 21-35 gün arası tamamen normaldir.

## Siklusun Fazları

### 1. Menstrüasyon Fazı (Gün 1-5)
Adet kanaması ile başlar. Rahim iç tabakası (endometrium) dökülür. Bu dönemde enerji seviyeniz düşük olabilir.

### 2. Foliküler Faz (Gün 1-13)
Yumurtalıklar yeni bir yumurta hazırlar. Östrojen seviyeleri yükselir, enerji ve ruh haliniz iyileşir.

### 3. Ovulasyon (Gün 14)
Yumurta serbest bırakılır. En verimli dönemdir. Bazı kadınlar hafif ağrı hissedebilir.

### 4. Luteal Faz (Gün 15-28)
Progesteron yükselir. PMS semptomları bu dönemde ortaya çıkabilir.

## Siklusunuzu Neden Takip Etmelisiniz?

- Verimli günlerinizi bilirsiniz
- PMS semptomlarını öngörebilirsiniz
- Düzensizlikleri fark edersiniz
- Sağlık sorunlarını erken tespit edersiniz

## İpuçları

- Düzenli uyku alın
- Dengeli beslenin
- Stresi yönetin
- Düzenli egzersiz yapın`,
      contentEn: `# What is the Menstrual Cycle?

The menstrual cycle is the female body's monthly process of preparing for pregnancy. This natural process is regulated by complex hormonal interactions and typically lasts 28 days, though 21-35 days is completely normal.

## Phases of the Cycle

### 1. Menstruation Phase (Days 1-5)
Begins with menstrual bleeding. The uterine lining (endometrium) sheds. Energy levels may be low during this time.

### 2. Follicular Phase (Days 1-13)
Ovaries prepare a new egg. Estrogen levels rise, improving energy and mood.

### 3. Ovulation (Day 14)
The egg is released. This is the most fertile period. Some women may feel mild pain.

### 4. Luteal Phase (Days 15-28)
Progesterone rises. PMS symptoms may appear during this period.

## Why Track Your Cycle?

- Know your fertile days
- Predict PMS symptoms
- Notice irregularities
- Detect health issues early

## Tips

- Get regular sleep
- Eat balanced meals
- Manage stress
- Exercise regularly`,
      category: 'menstrual_health',
      tags: ['cycle', 'period', 'basics', 'hormones'],
      author: 'Dr. Ayşe Yılmaz',
      readTimeMin: 8,
      priority: 100,
      imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400',
    },
    {
      titleTr: 'Ağrılı Adet Dönemleri ile Başa Çıkma',
      titleEn: 'Coping with Painful Periods',
      excerpt: 'Dismenore (ağrılı adet) ile başa çıkma yöntemleri ve ne zaman doktora gitmeniz gerektiği.',
      contentTr: `# Ağrılı Adet Nedir?

Dismenore olarak bilinen ağrılı adet, birçok kadının yaşadığı yaygın bir sorundur. Ağrı genellikle alt karında hissedilir ve sırta, bacaklara yayılabilir.

## Ağrı Türleri

### Primer Dismenore
- Organik bir neden yoktur
- Genellikle gençlerde görülür
- Prostaglandin hormonundan kaynaklanır

### Sekonder Dismenore
- Altta yatan bir sağlık sorunu vardır
- Endometriozis, miyom gibi durumlar
- Mutlaka doktor kontrolü gerekir

## Evde Uygulayabileceğiniz Yöntemler

1. **Sıcak Uygulama**: Karın bölgesine sıcak su torbası
2. **Hafif Egzersiz**: Yürüyüş, yoga
3. **Masaj**: Karın bölgesine dairesel masaj
4. **Bitkisel Çaylar**: Papatya, zencefil çayı
5. **Ağrı Kesici**: İbuprofen gibi NSAID'ler

## Ne Zaman Doktora Gitmelisiniz?

- Ağrı günlük aktiviteleri engelliyor
- Ağrı giderek artıyor
- 25 yaşından sonra başladı
- Ateş, bulantı eşlik ediyor
- Ağrı kesiciler yardımcı olmuyor`,
      contentEn: `# What are Painful Periods?

Dysmenorrhea, or painful periods, is a common problem many women experience. Pain is usually felt in the lower abdomen and can radiate to the back and legs.

## Types of Pain

### Primary Dysmenorrhea
- No organic cause
- Usually seen in young women
- Caused by prostaglandin hormone

### Secondary Dysmenorrhea
- Underlying health condition
- Conditions like endometriosis, fibroids
- Requires medical attention

## Home Remedies

1. **Heat Application**: Hot water bottle on abdomen
2. **Light Exercise**: Walking, yoga
3. **Massage**: Circular massage on abdomen
4. **Herbal Teas**: Chamomile, ginger tea
5. **Pain Relievers**: NSAIDs like ibuprofen

## When to See a Doctor?

- Pain interferes with daily activities
- Pain is increasing
- Started after age 25
- Accompanied by fever, nausea
- Pain relievers don't help`,
      category: 'menstrual_health',
      tags: ['pain', 'dysmenorrhea', 'treatment'],
      author: 'Dr. Mehmet Demir',
      readTimeMin: 6,
      priority: 95,
      imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
    },

    // Pregnancy Articles
    {
      titleTr: 'Hamileliğin İlk Trimesteri: Ne Beklemeli?',
      titleEn: 'First Trimester of Pregnancy: What to Expect',
      excerpt: 'Hamileliğin ilk 12 haftasında yaşanacak değişiklikler ve öneriler.',
      contentTr: `# İlk Trimester (Hafta 1-12)

Hamileliğin ilk üç ayı, bebeğinizin temel organlarının oluştuğu kritik bir dönemdir. Bu dönemde vücudunuz büyük değişiklikler yaşar.

## Yaygın Semptomlar

- **Sabah Bulantısı**: Günün her saatinde olabilir
- **Yorgunluk**: Aşırı yorgunluk hissi
- **Sık İdrara Çıkma**: Hormonlar nedeniyle
- **Hassas Göğüsler**: Dokunmada hassasiyet
- **Ruh Hali Değişiklikleri**: Hormonal dalgalanmalar

## Beslenme Önerileri

### Alınması Gerekenler
- Folik asit (günde 400-800 mcg)
- Demir takviyesi
- Bol su (günde 8-10 bardak)
- Protein açısından zengin gıdalar

### Kaçınılması Gerekenler
- Çiğ et ve balık
- Yumuşak peynirler
- Kafein (sınırlı)
- Alkol (kesinlikle yok)

## Doktor Kontrolleri

İlk trimesterde en az 2 kontrol önerilir:
- 6-8. hafta: İlk ultrason
- 11-13. hafta: NT taraması

## Egzersiz

Hafif egzersizler güvenlidir:
- Yürüyüş
- Yüzme
- Hamile yogası
- Kegel egzersizleri`,
      contentEn: `# First Trimester (Weeks 1-12)

The first three months of pregnancy are a critical period when your baby's basic organs form. Your body undergoes major changes during this time.

## Common Symptoms

- **Morning Sickness**: Can occur any time of day
- **Fatigue**: Extreme tiredness
- **Frequent Urination**: Due to hormones
- **Tender Breasts**: Sensitivity to touch
- **Mood Changes**: Hormonal fluctuations

## Nutrition Recommendations

### What to Take
- Folic acid (400-800 mcg daily)
- Iron supplement
- Plenty of water (8-10 glasses daily)
- Protein-rich foods

### What to Avoid
- Raw meat and fish
- Soft cheeses
- Caffeine (limited)
- Alcohol (absolutely none)

## Doctor Visits

At least 2 checkups recommended in first trimester:
- Week 6-8: First ultrasound
- Week 11-13: NT screening

## Exercise

Light exercises are safe:
- Walking
- Swimming
- Prenatal yoga
- Kegel exercises`,
      category: 'pregnancy',
      tags: ['first_trimester', 'symptoms', 'nutrition'],
      author: 'Dr. Zeynep Kaya',
      readTimeMin: 10,
      priority: 90,
      imageUrl: 'https://images.unsplash.com/photo-1493894473891-10fc1e5dbd22?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1493894473891-10fc1e5dbd22?w=400',
    },

    // Nutrition Articles
    {
      titleTr: 'Döngünüze Göre Beslenme',
      titleEn: 'Eating According to Your Cycle',
      excerpt: 'Her faz için özel beslenme önerileri ile hormonlarınızı destekleyin.',
      contentTr: `# Döngü Bazlı Beslenme

Menstrüel siklusunuzun farklı fazlarında vücudunuzun farklı besin ihtiyaçları vardır.

## Menstrüasyon Fazı (Gün 1-5)
- Demir: Kırmızı et, ıspanak
- C Vitamini: Demir emilimini artırır
- Omega-3: İltihap azaltır

## Foliküler Faz (Gün 6-13)
- Protein: Yumurta, tavuk
- Sebzeler: Brokoli, lahana
- Tam tahıllar: Enerji için

## Ovulasyon (Gün 14-16)
- Antioksidanlar: Meyveler
- Lif: Hormon dengesini destekler
- Kalsiyum: Süt ürünleri

## Luteal Faz (Gün 17-28)
- Magnezyum: PMS'i azaltır
- B6 Vitamini: Ruh halini iyileştirir
- Kompleks karbonhidratlar: Kan şekerini dengeler`,
      contentEn: `# Cycle-Based Nutrition

Your body has different nutritional needs during different phases of your menstrual cycle.

## Menstruation Phase (Days 1-5)
- Iron: Red meat, spinach
- Vitamin C: Enhances iron absorption
- Omega-3: Reduces inflammation

## Follicular Phase (Days 6-13)
- Protein: Eggs, chicken
- Vegetables: Broccoli, cabbage
- Whole grains: For energy

## Ovulation (Days 14-16)
- Antioxidants: Fruits
- Fiber: Supports hormone balance
- Calcium: Dairy products

## Luteal Phase (Days 17-28)
- Magnesium: Reduces PMS
- Vitamin B6: Improves mood
- Complex carbs: Balances blood sugar`,
      category: 'nutrition',
      tags: ['diet', 'cycle', 'hormones'],
      author: 'Dyt. Elif Şahin',
      readTimeMin: 7,
      priority: 85,
    },

    // Exercise Articles
    {
      titleTr: 'Dönem Sırasında Egzersiz',
      titleEn: 'Exercise During Your Period',
      excerpt: 'Adet döneminde hangi egzersizleri yapabilirsiniz ve faydaları nelerdir?',
      contentTr: `# Adet Döneminde Egzersiz Yapabilir miyim?

Evet! Aslında hafif egzersiz, adet ağrılarını azaltabilir ve ruh halinizi iyileştirebilir.

## Önerilen Egzersizler

### Hafif Kardio
- Yürüyüş (20-30 dakika)
- Hafif koşu
- Bisiklet

### Yoga ve Esneme
- Çocuk pozu
- Kedi-inek pozu
- Kelebek pozu

### Düşük Yoğunluklu Antrenman
- Pilates
- Hafif ağırlık çalışması

## Faydaları

- Endorfin salgılanır (doğal ağrı kesici)
- Krampları azaltır
- Şişkinliği giderir
- Ruh halini iyileştirir
- Enerji verir

## Kaçınılması Gerekenler

- Aşırı yoğun antrenmanlar
- Ters pozisyonlar (tartışmalı)
- Kendinizi zorlamak

## Dinleyin Vücudunuzu

Her kadın farklıdır. Kendinizi kötü hissediyorsanız, dinlenin.`,
      contentEn: `# Can I Exercise During My Period?

Yes! In fact, light exercise can reduce period pain and improve your mood.

## Recommended Exercises

### Light Cardio
- Walking (20-30 minutes)
- Light jogging
- Cycling

### Yoga and Stretching
- Child's pose
- Cat-cow pose
- Butterfly pose

### Low-Intensity Training
- Pilates
- Light weight training

## Benefits

- Releases endorphins (natural pain reliever)
- Reduces cramps
- Relieves bloating
- Improves mood
- Provides energy

## What to Avoid

- Extremely intense workouts
- Inverted positions (debatable)
- Pushing yourself too hard

## Listen to Your Body

Every woman is different. If you feel unwell, rest.`,
      category: 'exercise',
      tags: ['period', 'workout', 'pain_relief'],
      author: 'Antrenör Selin Yıldız',
      readTimeMin: 5,
      priority: 80,
    },

    // Mental Health Articles
    {
      titleTr: 'PMS ve Ruh Sağlığı',
      titleEn: 'PMS and Mental Health',
      excerpt: 'Premenstrüel sendrom semptomlarını anlamak ve yönetmek.',
      contentTr: `# PMS Nedir?

Premenstrüel sendrom (PMS), adet öncesi dönemde yaşanan fiziksel ve duygusal semptomlardır.

## Duygusal Semptomlar

- Irritabilite (sinirlilik)
- Anksiyete
- Depresif ruh hali
- Ağlama nöbetleri
- Konsantrasyon güçlüğü

## Başa Çıkma Yöntemleri

### Yaşam Tarzı Değişiklikleri
- Düzenli uyku (7-9 saat)
- Dengeli beslenme
- Kafeini azaltın
- Alkol ve tuzdan kaçının

### Stres Yönetimi
- Meditasyon
- Derin nefes egzersizleri
- Yoga
- Günlük tutma

### Sosyal Destek
- Sevdiklerinizle konuşun
- Destek gruplarına katılın
- Profesyonel yardım alın

## Ne Zaman Yardım Almalı?

PMDD (Premenstrüel Disforik Bozukluk) daha ciddidir:
- Günlük yaşamı ciddi etkiler
- İlişkilere zarar verir
- İş performansını düşürür

Bir psikolog veya psikiyatriste danışın.`,
      contentEn: `# What is PMS?

Premenstrual syndrome (PMS) refers to physical and emotional symptoms experienced before menstruation.

## Emotional Symptoms

- Irritability
- Anxiety
- Depressed mood
- Crying spells
- Difficulty concentrating

## Coping Methods

### Lifestyle Changes
- Regular sleep (7-9 hours)
- Balanced diet
- Reduce caffeine
- Avoid alcohol and salt

### Stress Management
- Meditation
- Deep breathing exercises
- Yoga
- Journaling

### Social Support
- Talk to loved ones
- Join support groups
- Seek professional help

## When to Seek Help?

PMDD (Premenstrual Dysphoric Disorder) is more serious:
- Severely affects daily life
- Damages relationships
- Reduces work performance

Consult a psychologist or psychiatrist.`,
      category: 'mental_health',
      tags: ['pms', 'mood', 'anxiety'],
      author: 'Psikolog Dr. Deniz Arslan',
      readTimeMin: 6,
      priority: 88,
    },

    // Sleep Articles
    {
      titleTr: 'Uyku ve Hormonal Denge',
      titleEn: 'Sleep and Hormonal Balance',
      excerpt: 'Kaliteli uykunun menstrüel sağlığınıza etkileri.',
      contentTr: `# Uyku Neden Önemli?

Uyku, hormonal dengeniz için kritik öneme sahiptir. Yetersiz uyku, döngü düzensizliklerine neden olabilir.

## Uyku ve Hormonlar

### Melatonin
- Uyku hormonu
- Karanlıkta salgılanır
- Döngüyü düzenler

### Kortizol
- Stres hormonu
- Uykusuzlukta artar
- Döngüyü bozabilir

## İyi Uyku İçin İpuçları

### Uyku Hijyeni
- Aynı saatte yatın ve kalkın
- Yatak odası serin ve karanlık olsun
- Ekranlardan uzak durun (1 saat önce)
- Rahat yatak ve yastık

### Gece Rutini
- Sıcak duş
- Kitap okuma
- Meditasyon
- Bitkisel çay (papatya, melisa)

### Kaçınılması Gerekenler
- Kafein (öğleden sonra)
- Ağır yemekler (akşam)
- Alkol
- Yoğun egzersiz (akşam)

## Döngü ve Uyku

Farklı fazlarda uyku ihtiyacınız değişebilir:
- Menstrüasyon: Daha fazla uyku
- Ovulasyon: Daha az uyku ihtiyacı
- Luteal faz: Uyku kalitesi düşebilir`,
      contentEn: `# Why is Sleep Important?

Sleep is critical for your hormonal balance. Insufficient sleep can cause cycle irregularities.

## Sleep and Hormones

### Melatonin
- Sleep hormone
- Released in darkness
- Regulates cycle

### Cortisol
- Stress hormone
- Increases with sleep deprivation
- Can disrupt cycle

## Tips for Good Sleep

### Sleep Hygiene
- Go to bed and wake up at same time
- Keep bedroom cool and dark
- Avoid screens (1 hour before)
- Comfortable bed and pillow

### Night Routine
- Warm shower
- Reading
- Meditation
- Herbal tea (chamomile, lemon balm)

### What to Avoid
- Caffeine (afternoon)
- Heavy meals (evening)
- Alcohol
- Intense exercise (evening)

## Cycle and Sleep

Sleep needs may vary in different phases:
- Menstruation: More sleep needed
- Ovulation: Less sleep needed
- Luteal phase: Sleep quality may decrease`,
      category: 'sleep',
      tags: ['sleep', 'hormones', 'health'],
      author: 'Dr. Can Öztürk',
      readTimeMin: 7,
      priority: 82,
    },

    // Hydration Articles
    {
      titleTr: 'Su İçmenin Kadın Sağlığına Faydaları',
      titleEn: 'Benefits of Hydration for Women\'s Health',
      excerpt: 'Yeterli su tüketiminin hormonal dengeye ve döngü sağlığına etkileri.',
      contentTr: `# Hidrasyon ve Kadın Sağlığı

Su, vücudunuzun en temel ihtiyacıdır ve hormonal dengeniz için kritiktir.

## Günlük Su İhtiyacı

- Genel kural: Vücut ağırlığı x 30-35 ml
- Örnek: 60 kg = 1.8-2.1 litre
- Egzersiz yapıyorsanız: +500 ml
- Sıcak havalarda: +500-1000 ml

## Faydaları

### Hormonal Denge
- Toksinlerin atılımını destekler
- Hormon üretimini optimize eder
- Döngü düzenini korur

### Adet Dönemi
- Şişkinliği azaltır
- Krampları hafifletir
- Baş ağrısını önler

### Genel Sağlık
- Cildi iyileştirir
- Enerji verir
- Sindirim sistemini destekler

## Su İçme İpuçları

1. Sabah kalktığınızda 1 bardak
2. Her öğün öncesi 1 bardak
3. Yanınızda su şişesi taşıyın
4. Hatırlatıcı kurun
5. Meyve ve sebze tüketin

## Dehidrasyon Belirtileri

- Koyu renkli idrar
- Kuru dudaklar
- Baş ağrısı
- Yorgunluk
- Baş dönmesi`,
      contentEn: `# Hydration and Women's Health

Water is your body's most basic need and critical for hormonal balance.

## Daily Water Needs

- General rule: Body weight x 30-35 ml
- Example: 60 kg = 1.8-2.1 liters
- If exercising: +500 ml
- In hot weather: +500-1000 ml

## Benefits

### Hormonal Balance
- Supports toxin elimination
- Optimizes hormone production
- Maintains cycle regularity

### Menstrual Period
- Reduces bloating
- Eases cramps
- Prevents headaches

### General Health
- Improves skin
- Provides energy
- Supports digestive system

## Hydration Tips

1. 1 glass upon waking
2. 1 glass before each meal
3. Carry water bottle
4. Set reminders
5. Consume fruits and vegetables

## Dehydration Signs

- Dark colored urine
- Dry lips
- Headache
- Fatigue
- Dizziness`,
      category: 'hydration',
      tags: ['water', 'health', 'hormones'],
      author: 'Dyt. Burcu Aydın',
      readTimeMin: 5,
      priority: 78,
    },

    // Fertility Articles
    {
      titleTr: 'Doğurganlığı Artırma Yolları',
      titleEn: 'Ways to Boost Fertility',
      excerpt: 'Doğal yollarla doğurganlığınızı destekleyin.',
      contentTr: `# Doğurganlık ve Yaşam Tarzı

Doğurganlık, birçok faktörden etkilenir. Sağlıklı yaşam tarzı değişiklikleri büyük fark yaratabilir.

## Beslenme

### Tüketilmesi Gerekenler
- Folik asit: Yeşil yapraklı sebzeler
- Omega-3: Balık, ceviz
- Antioksidanlar: Meyveler
- Protein: Yumurta, baklagiller

### Kaçınılması Gerekenler
- Trans yağlar
- Aşırı kafein
- Alkol
- İşlenmiş gıdalar

## Yaşam Tarzı

### Sağlıklı Kilo
- Çok zayıf veya kilolu olmak etkileyebilir
- BMI 18.5-24.9 ideal
- Dengeli beslenme ve egzersiz

### Stres Yönetimi
- Kronik stres hormonal dengeyi bozar
- Meditasyon ve yoga
- Yeterli uyku
- Hobi edinme

### Zararlı Alışkanlıklar
- Sigara bırakın
- Alkol sınırlayın
- Çevresel toksinlerden kaçının

## Ovulasyon Takibi

- Bazal vücut ısısı
- Ovulasyon testleri
- Servikal mukus gözlemi
- Döngü takip uygulamaları

## Ne Zaman Yardım Almalı?

- 35 yaş altı: 1 yıl deneme sonrası
- 35 yaş üstü: 6 ay deneme sonrası
- Bilinen sağlık sorunları varsa: Hemen`,
      contentEn: `# Fertility and Lifestyle

Fertility is affected by many factors. Healthy lifestyle changes can make a big difference.

## Nutrition

### What to Consume
- Folic acid: Green leafy vegetables
- Omega-3: Fish, walnuts
- Antioxidants: Fruits
- Protein: Eggs, legumes

### What to Avoid
- Trans fats
- Excessive caffeine
- Alcohol
- Processed foods

## Lifestyle

### Healthy Weight
- Being too thin or overweight can affect
- BMI 18.5-24.9 ideal
- Balanced diet and exercise

### Stress Management
- Chronic stress disrupts hormonal balance
- Meditation and yoga
- Adequate sleep
- Hobbies

### Harmful Habits
- Quit smoking
- Limit alcohol
- Avoid environmental toxins

## Ovulation Tracking

- Basal body temperature
- Ovulation tests
- Cervical mucus observation
- Cycle tracking apps

## When to Seek Help?

- Under 35: After 1 year of trying
- Over 35: After 6 months of trying
- If known health issues: Immediately`,
      category: 'fertility',
      tags: ['fertility', 'conception', 'ovulation'],
      author: 'Dr. Emre Yılmaz',
      readTimeMin: 8,
      priority: 75,
    },

    // Sexual Health Articles
    {
      titleTr: 'Cinsel Sağlık ve İletişim',
      titleEn: 'Sexual Health and Communication',
      excerpt: 'Sağlıklı cinsel yaşam için iletişim ve bilgi.',
      contentTr: `# Cinsel Sağlık

Cinsel sağlık, genel sağlığınızın önemli bir parçasıdır ve açık iletişim gerektirir.

## İletişimin Önemi

### Partner ile Konuşma
- İhtiyaçlarınızı ifade edin
- Sınırlarınızı belirleyin
- Dinleyin ve anlayışlı olun
- Yargılamadan konuşun

### Doktor ile İletişim
- Düzenli kontroller
- Sorularınızı sorun
- Endişelerinizi paylaşın
- Tarama testleri

## Cinsel Sağlık Kontrolleri

### Düzenli Testler
- PAP smear (25 yaş üstü)
- HPV testi
- Cinsel yolla bulaşan hastalık taraması
- Meme muayenesi

### Ne Sıklıkla?
- PAP smear: 3 yılda bir
- Meme muayenesi: Yılda bir
- Kendi kendine muayene: Ayda bir

## Korunma Yöntemleri

- Kondom: Hem gebelik hem hastalık
- Doğum kontrol hapı
- RIA (Rahim içi araç)
- Diğer hormonsal yöntemler

## Yaygın Sorunlar

### Ağrı
- Vajinal kuruluk
- Enfeksiyonlar
- Endometriozis
- Mutlaka doktora danışın

### Libido Değişiklikleri
- Hormonal değişiklikler
- Stres
- İlaçlar
- İlişki sorunları`,
      contentEn: `# Sexual Health

Sexual health is an important part of your overall health and requires open communication.

## Importance of Communication

### Talking with Partner
- Express your needs
- Set boundaries
- Listen and be understanding
- Talk without judgment

### Communication with Doctor
- Regular checkups
- Ask questions
- Share concerns
- Screening tests

## Sexual Health Checkups

### Regular Tests
- PAP smear (over 25)
- HPV test
- STD screening
- Breast examination

### How Often?
- PAP smear: Every 3 years
- Breast exam: Annually
- Self-examination: Monthly

## Protection Methods

- Condom: Both pregnancy and disease
- Birth control pill
- IUD (Intrauterine device)
- Other hormonal methods

## Common Issues

### Pain
- Vaginal dryness
- Infections
- Endometriosis
- Consult doctor

### Libido Changes
- Hormonal changes
- Stress
- Medications
- Relationship issues`,
      category: 'sexual_health',
      tags: ['sexual_health', 'communication', 'protection'],
      author: 'Dr. Aylin Koç',
      readTimeMin: 9,
      priority: 70,
    },
  ];

  console.log('📝 Creating educational articles...');

  for (const article of articles) {
    const articleId = `article-${article.category}-${articles.indexOf(article) + 1}`;
    await prisma.educationalArticle.upsert({
      where: { id: articleId },
      update: {},
      create: {
        id: articleId,
        ...article,
        isActive: true,
        publishedAt: new Date(),
      },
    });
    console.log(`  ✅ Created: ${article.titleTr}`);
  }

  console.log('✅ Created all educational articles');

  // Seed Q&A Badges
  console.log('🏅 Seeding Q&A badges...');

  const badges = [
    // Başlangıç Rozetleri
    {
      key: 'first_question',
      nameTr: 'İlk Soru',
      nameEn: 'First Question',
      description: 'İlk sorunuzu sordunuz!',
      requirement: { type: 'questions_asked', count: 1 },
      iconUrl: '🎯',
    },
    {
      key: 'first_answer',
      nameTr: 'İlk Cevap',
      nameEn: 'First Answer',
      description: 'İlk cevabınızı verdiniz!',
      requirement: { type: 'answers_given', count: 1 },
      iconUrl: '💬',
    },
    {
      key: 'first_best_answer',
      nameTr: 'İlk En İyi Cevap',
      nameEn: 'First Best Answer',
      description: 'İlk en iyi cevabınızı aldınız!',
      requirement: { type: 'best_answers', count: 1 },
      iconUrl: '⭐',
    },
    // Soru Rozetleri
    {
      key: 'curious_mind',
      nameTr: 'Meraklı Zihin',
      nameEn: 'Curious Mind',
      description: '10 soru sordunuz',
      requirement: { type: 'questions_asked', count: 10 },
      iconUrl: '🤔',
    },
    {
      key: 'question_master',
      nameTr: 'Soru Ustası',
      nameEn: 'Question Master',
      description: '50 soru sordunuz',
      requirement: { type: 'questions_asked', count: 50 },
      iconUrl: '🎓',
    },
    // Cevap Rozetleri
    {
      key: 'helpful_member',
      nameTr: 'Yardımsever Üye',
      nameEn: 'Helpful Member',
      description: '10 cevap verdiniz',
      requirement: { type: 'answers_given', count: 10 },
      iconUrl: '🤝',
    },
    {
      key: 'knowledge_sharer',
      nameTr: 'Bilgi Paylaşan',
      nameEn: 'Knowledge Sharer',
      description: '50 cevap verdiniz',
      requirement: { type: 'answers_given', count: 50 },
      iconUrl: '📚',
    },
    {
      key: 'expert_contributor',
      nameTr: 'Uzman Katkıcı',
      nameEn: 'Expert Contributor',
      description: '100 cevap verdiniz',
      requirement: { type: 'answers_given', count: 100 },
      iconUrl: '👨‍⚕️',
    },
    // En İyi Cevap Rozetleri
    {
      key: 'rising_star',
      nameTr: 'Yükselen Yıldız',
      nameEn: 'Rising Star',
      description: '5 en iyi cevap aldınız',
      requirement: { type: 'best_answers', count: 5 },
      iconUrl: '🌟',
    },
    {
      key: 'trusted_advisor',
      nameTr: 'Güvenilir Danışman',
      nameEn: 'Trusted Advisor',
      description: '10 en iyi cevap aldınız',
      requirement: { type: 'best_answers', count: 10 },
      iconUrl: '💎',
    },
    {
      key: 'community_expert',
      nameTr: 'Topluluk Uzmanı',
      nameEn: 'Community Expert',
      description: '25 en iyi cevap aldınız',
      requirement: { type: 'best_answers', count: 25 },
      iconUrl: '👑',
    },
    // Oy Rozetleri
    {
      key: 'upvote_beginner',
      nameTr: 'Beğeni Başlangıcı',
      nameEn: 'Upvote Beginner',
      description: '10 upvote aldınız',
      requirement: { type: 'upvotes_received', count: 10 },
      iconUrl: '👍',
    },
    {
      key: 'popular_contributor',
      nameTr: 'Popüler Katkıcı',
      nameEn: 'Popular Contributor',
      description: '50 upvote aldınız',
      requirement: { type: 'upvotes_received', count: 50 },
      iconUrl: '🔥',
    },
    {
      key: 'highly_valued',
      nameTr: 'Çok Değerli',
      nameEn: 'Highly Valued',
      description: '100 upvote aldınız',
      requirement: { type: 'upvotes_received', count: 100 },
      iconUrl: '💯',
    },
    // İtibar Rozetleri
    {
      key: 'reputation_100',
      nameTr: '100 İtibar',
      nameEn: '100 Reputation',
      description: '100 itibar puanına ulaştınız',
      requirement: { type: 'total_points', count: 100 },
      iconUrl: '🥉',
    },
    {
      key: 'reputation_500',
      nameTr: '500 İtibar',
      nameEn: '500 Reputation',
      description: '500 itibar puanına ulaştınız',
      requirement: { type: 'total_points', count: 500 },
      iconUrl: '🥈',
    },
    {
      key: 'reputation_1000',
      nameTr: '1000 İtibar',
      nameEn: '1000 Reputation',
      description: '1000 itibar puanına ulaştınız',
      requirement: { type: 'total_points', count: 1000 },
      iconUrl: '🥇',
    },
    // Özel Rozetler
    {
      key: 'early_adopter',
      nameTr: 'Erken Katılan',
      nameEn: 'Early Adopter',
      description: 'Q&A topluluğunun ilk üyelerinden birisiniz',
      requirement: { type: 'special', count: 1 },
      iconUrl: '🚀',
    },
    {
      key: 'supportive_member',
      nameTr: 'Destekleyici Üye',
      nameEn: 'Supportive Member',
      description: '50 yorum yaptınız',
      requirement: { type: 'comments_made', count: 50 },
      iconUrl: '💭',
    },
    {
      key: 'active_voter',
      nameTr: 'Aktif Oylayıcı',
      nameEn: 'Active Voter',
      description: '100 oy kullandınız',
      requirement: { type: 'votes_cast', count: 100 },
      iconUrl: '🗳️',
    },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { key: badge.key },
      update: {},
      create: badge,
    });
    console.log(`  ✅ Created badge: ${badge.nameTr}`);
  }

  console.log('✅ Q&A badges seeded successfully!');
  await seedCommunity();
  await seedAstrology();
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
