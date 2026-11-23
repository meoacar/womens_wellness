import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const DAILY_MICRO_CARDS_FLAG_KEY = 'daily_micro_cards';

export type MicroCardPhase =
  | 'MENSTRUAL'
  | 'FOLLICULAR'
  | 'OVULATION'
  | 'LUTEAL'
  | 'PREGNANCY'
  | 'POSTPARTUM'
  | 'GENERAL';

export type MicroCardTone = 'fun' | 'scientific';

export interface DailyMicroCard {
  id: string;
  phase: MicroCardPhase;
  tone: MicroCardTone;
  badge: string;
  title: string;
  body: string;
  novaPrompt: string;
  gradientFrom: string;
  gradientTo: string;
  icon: string;
  active: boolean;
}

export const DEFAULT_DAILY_MICRO_CARDS: DailyMicroCard[] = [
  {
    id: 'mc-menstrual-fun-1',
    phase: 'MENSTRUAL',
    tone: 'fun',
    badge: 'MOD: BATTANİYE',
    title: 'Bugün dünya dursa yeridir',
    body: 'Kramplar kapıyı çaldıysa suçlu sensin değil, prostaglandinler! Sıcak su torbanı kap, suçsuzsun.',
    novaPrompt: 'Regl dönemindeyim, bugün krampları hafifletecek sıcak içecek ve rahatlatıcı öneriler verir misin?',
    gradientFrom: '#BE185D',
    gradientTo: '#EC4899',
    icon: 'cafe-outline',
    active: true,
  },
  {
    id: 'mc-menstrual-fun-2',
    phase: 'MENSTRUAL',
    tone: 'fun',
    badge: 'TATLI KRİZİ',
    title: 'Bitter çikolata resmi izinlidir',
    body: 'Magnezyum düşüşü canına tak ettiyse %70+ bitter çikolata hem ruhuna hem kaslarına ilaç gibi gelir.',
    novaPrompt: 'Regl döneminde tatlı krizini sağlıklı şekilde nasıl bastırabilirim?',
    gradientFrom: '#9D174D',
    gradientTo: '#F43F5E',
    icon: 'heart-outline',
    active: true,
  },
  {
    id: 'mc-menstrual-sci-1',
    phase: 'MENSTRUAL',
    tone: 'scientific',
    badge: 'MENSTRUAL FAZ',
    title: 'Demir ve C vitamini dengesi',
    body: 'Kanama günlerinde demir kaybını dengelemek için C vitaminiyle birlikte demir açısından zengin öğünler tercih edin.',
    novaPrompt: 'Menstrual fazda demir emilimini artıran örnek bir günlük menü önerir misin?',
    gradientFrom: '#BE185D',
    gradientTo: '#9D174D',
    icon: 'nutrition-outline',
    active: true,
  },
  {
    id: 'mc-follicular-fun-1',
    phase: 'FOLLICULAR',
    tone: 'fun',
    badge: 'ENERJİ YÜKSELİYOR',
    title: 'Süper kahraman modu açılıyor',
    body: 'Östrojen sahneye çıktı, beyin sisin dağılıyor. Ertelediğin o zor işi bugün 20 dakikada halledebilirsin!',
    novaPrompt: 'Foliküler fazdayım, yüksek enerjimi spor ve üretkenlik için nasıl değerlendirebilirim?',
    gradientFrom: '#6D28D9',
    gradientTo: '#8B5CF6',
    icon: 'flash-outline',
    active: true,
  },
  {
    id: 'mc-follicular-sci-1',
    phase: 'FOLLICULAR',
    tone: 'scientific',
    badge: 'FOLİKÜLER FAZ',
    title: 'Kas ve kardiyo verimi yüksek',
    body: 'Östrojen artışıyla insülin duyarlılığı ve toparlanma hızı yükselir; tempolu egzersizler için ideal penceredesiniz.',
    novaPrompt: 'Foliküler faz için ideal egzersiz ve protein dengesi nasıl olmalı?',
    gradientFrom: '#5B21B6',
    gradientTo: '#7C3AED',
    icon: 'barbell-outline',
    active: true,
  },
  {
    id: 'mc-ovulation-fun-1',
    phase: 'OVULATION',
    tone: 'fun',
    badge: 'IŞILTI MODU',
    title: 'Bugün aynaya ekstra gülümse',
    body: 'Ovulasyon zirvesinde sosyal enerjin ve özgüvenin tavan yapar. Sevdiğin bir arkadaşına kahve sözü ver!',
    novaPrompt: 'Ovulasyon dönemindeyim, bugün vücut sinyallerim ve su ihtiyacım hakkında nelere dikkat etmeliyim?',
    gradientFrom: '#059669',
    gradientTo: '#10B981',
    icon: 'sparkles-outline',
    active: true,
  },
  {
    id: 'mc-ovulation-sci-1',
    phase: 'OVULATION',
    tone: 'scientific',
    badge: 'OVULASYON',
    title: 'LH piki ve vücut ısısı',
    body: 'Yumurtlama döneminde bazal vücut ısısı hafifçe artar; gün içinde su ve elektrolit alımını artırmak faydalıdır.',
    novaPrompt: 'Yumurtlama döneminde servikal mukus ve bazal ısı değişimleri nasıl yorumlanır?',
    gradientFrom: '#047857',
    gradientTo: '#059669',
    icon: 'pulse-outline',
    active: true,
  },
  {
    id: 'mc-luteal-fun-1',
    phase: 'LUTEAL',
    tone: 'fun',
    badge: 'PMS KALKANI',
    title: 'Kimseye ani mesaj atma günü',
    body: 'Progesteron yükselirken sabır seviyen biraz kısalabilir. Önemli kararları yarına ertele, bugün kendine nazik ol.',
    novaPrompt: 'Luteal fazda PMS gerginliğini ve şişkinliği azaltmak için bugün ne yapmalıyım?',
    gradientFrom: '#D97706',
    gradientTo: '#F59E0B',
    icon: 'shield-checkmark-outline',
    active: true,
  },
  {
    id: 'mc-luteal-sci-1',
    phase: 'LUTEAL',
    tone: 'scientific',
    badge: 'LUTEAL FAZ',
    title: 'B6 vitamini ve kompleks karbonhidrat',
    body: 'Luteal fazda bazal metabolizma hafifçe hızlanır; tam tahıllar ve B6 vitamini serotonin dengesini destekler.',
    novaPrompt: 'Luteal fazda kan şekerini dengeleyen ara öğün alternatifleri paylaşır mısın?',
    gradientFrom: '#B45309',
    gradientTo: '#D97706',
    icon: 'leaf-outline',
    active: true,
  },
  {
    id: 'mc-pregnancy-fun-1',
    phase: 'PREGNANCY',
    tone: 'fun',
    badge: 'MİNİK MİSAFİR',
    title: 'İki kişilik değil, kaliteli beslenme',
    body: 'Bugün su şişen en yakın arkadaşın olsun. Ayaklarını 15 dakika yukarı kaldır, minik yolcun büyümekle meşgul!',
    novaPrompt: 'Hamileliğimde bugün ödem ve yorgunluğu azaltmak için pratik öneriler verir misin?',
    gradientFrom: '#EC4899',
    gradientTo: '#F43F5E',
    icon: 'heart-circle-outline',
    active: true,
  },
  {
    id: 'mc-postpartum-fun-1',
    phase: 'POSTPARTUM',
    tone: 'fun',
    badge: 'SÜPER ANNE',
    title: 'Mükemmel değil, dinlenmiş anne',
    body: 'Bulaşıklar bekleyebilir ama senin 20 dakikalık şekerlemen bekleyemez. Bugün kendine bir mola hediye et!',
    novaPrompt: 'Lohusalık döneminde uykusuzlukla baş etmek ve süt üretimini desteklemek için öneriler verir misin?',
    gradientFrom: '#7C3AED',
    gradientTo: '#EC4899',
    icon: 'moon-outline',
    active: true,
  },
  {
    id: 'mc-general-fun-1',
    phase: 'GENERAL',
    tone: 'fun',
    badge: 'GÜNÜN NOTU',
    title: 'Omuzlarını aşağı bırak, derin nefes al',
    body: 'Ekran başında çeneni sıktığını fark ettin mi? 10 saniyelik bir esneme bile sinir sistemine "güvendesin" der.',
    novaPrompt: 'Gün ortasında 2 dakikada yapabileceğim kısa bir nefes ve gevşeme egzersizi anlatır mısın?',
    gradientFrom: '#3B82F6',
    gradientTo: '#6366F1',
    icon: 'sunny-outline',
    active: true,
  },
  {
    id: 'mc-general-sci-1',
    phase: 'GENERAL',
    tone: 'scientific',
    badge: 'WELLNESS İPUCU',
    title: 'Sirkadiyen ritim ve sabah ışığı',
    body: 'Uyandıktan sonraki ilk 30 dakika içinde gün ışığı almak kortizol-melatonin döngünüzü düzenleyerek gece uykusunu iyileştirir.',
    novaPrompt: 'Sirkadiyen ritmimi ve gece uyku kalitemi nasıl daha iyi hale getirebilirim?',
    gradientFrom: '#1D4ED8',
    gradientTo: '#3B82F6',
    icon: 'time-outline',
    active: true,
  },
];

@Injectable()
export class DailyCardsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllCards(): Promise<DailyMicroCard[]> {
    const record = await this.prisma.featureFlag.findUnique({
      where: { key: DAILY_MICRO_CARDS_FLAG_KEY },
    });
    const list = (record?.valueJson as any)?.cards;
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    return DEFAULT_DAILY_MICRO_CARDS;
  }

  async saveAllCards(cards: DailyMicroCard[]): Promise<DailyMicroCard[]> {
    const sanitized = (Array.isArray(cards) ? cards : [])
      .filter((c) => c && typeof c.title === 'string' && c.title.trim())
      .map((c, idx) => ({
        id: c.id?.trim() || `mc-custom-${Date.now()}-${idx}`,
        phase: c.phase || 'GENERAL',
        tone: c.tone === 'scientific' ? ('scientific' as const) : ('fun' as const),
        badge: (c.badge || 'GÜNÜN KARTI').trim(),
        title: c.title.trim(),
        body: (c.body || '').trim(),
        novaPrompt: (c.novaPrompt || c.title).trim(),
        gradientFrom: c.gradientFrom || '#EC4899',
        gradientTo: c.gradientTo || '#8B5CF6',
        icon: c.icon || 'sparkles-outline',
        active: c.active !== false,
      }));

    await this.prisma.featureFlag.upsert({
      where: { key: DAILY_MICRO_CARDS_FLAG_KEY },
      update: { valueJson: { cards: sanitized } as any },
      create: {
        key: DAILY_MICRO_CARDS_FLAG_KEY,
        valueJson: { cards: sanitized } as any,
      },
    });
    return sanitized;
  }

  async resetDefaults(): Promise<DailyMicroCard[]> {
    return this.saveAllCards(DEFAULT_DAILY_MICRO_CARDS);
  }

  async getDailyDeck(
    phase?: string,
    tone: MicroCardTone = 'fun',
  ): Promise<DailyMicroCard[]> {
    const all = (await this.getAllCards()).filter((c) => c.active !== false);
    const normalizedPhase = (phase || 'GENERAL').toUpperCase() as MicroCardPhase;

    const phaseMatches = all.filter(
      (c) => c.phase === normalizedPhase && c.tone === tone,
    );
    const generalMatches = all.filter(
      (c) => c.phase === 'GENERAL' && c.tone === tone,
    );
    const anyTonePhase = all.filter((c) => c.phase === normalizedPhase);
    const fallbackPool = all.filter((c) => c.tone === tone);

    const combined: DailyMicroCard[] = [];
    const seen = new Set<string>();
    for (const c of [
      ...phaseMatches,
      ...generalMatches,
      ...anyTonePhase,
      ...fallbackPool,
      ...all,
    ]) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        combined.push(c);
      }
    }

    if (combined.length <= 3) return combined;

    // Deterministic daily rotation
    const now = new Date();
    const dayIndex = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
    const result: DailyMicroCard[] = [];
    for (let i = 0; i < 3; i++) {
      result.push(combined[(dayIndex + i) % combined.length]);
    }
    return result;
  }
}
