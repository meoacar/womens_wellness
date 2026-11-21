import type { Locale } from './api';

export interface AuthorProfileInfo {
  name: string;
  roleTr: string;
  roleEn: string;
  bioTr: string;
  bioEn: string;
  reviewerTr: string;
  reviewerEn: string;
}

export interface ScientificReference {
  org: string;
  titleTr: string;
  titleEn: string;
  url: string;
}

const AUTHOR_PROFILES: Record<string, Omit<AuthorProfileInfo, 'name'>> = {
  'Dr. Ayşe Yılmaz': {
    roleTr: 'Kadın Hastalıkları ve Doğum Editoryal Katkıcısı',
    roleEn: 'OB-GYN Editorial Contributor',
    bioTr:
      'Menstrüel döngü fizyolojisi, hormonal ritimler ve koruyucu jinekolojik sağlık konularında kanıta dayalı hasta bilgilendirme içerikleri hazırlar.',
    bioEn:
      'Prepares evidence-informed educational guides on menstrual cycle physiology, hormonal patterns, and preventive gynecological care.',
    reviewerTr: 'Kadın Atlası Tıbbi Yayın & İnceleme Kurulu',
    reviewerEn: 'Kadın Atlası Medical Editorial & Review Board',
  },
  'Dr. Zeynep Kaya': {
    roleTr: 'Kadın Sağlığı ve Ağrı Yönetimi Editoryal Katkıcısı',
    roleEn: 'Women’s Health & Pain Care Contributor',
    bioTr:
      'Primer dismenore, pelvik sağlık ve yaşam tarzı temelli semptom hafifletme yöntemleri üzerine bilimsel rehberler derler.',
    bioEn:
      'Curates clinical guidance on dysmenorrhea, pelvic wellbeing, and evidence-based symptom relief strategies.',
    reviewerTr: 'Kadın Atlası Tıbbi Yayın & İnceleme Kurulu',
    reviewerEn: 'Kadın Atlası Medical Editorial & Review Board',
  },
  'Dr. Emre Yılmaz': {
    roleTr: 'Üreme Sağlığı ve Doğurganlık Editoryal Katkıcısı',
    roleEn: 'Reproductive Health & Fertility Contributor',
    bioTr:
      'Ovulasyon takibi, doğurganlık penceresi ve gebelik planlama süreçlerinde güncel klinik kılavuzları anlaşılır dile çevirir.',
    bioEn:
      'Translates clinical guidelines on ovulation tracking, fertile windows, and preconception care into clear guidance.',
    reviewerTr: 'Kadın Atlası Tıbbi Yayın & İnceleme Kurulu',
    reviewerEn: 'Kadın Atlası Medical Editorial & Review Board',
  },
  'Dyt. Selin Demir': {
    roleTr: 'Beslenme ve Diyetetik Uzmanı (Editoryal Katkıcı)',
    roleEn: 'Registered Dietitian (Editorial Contributor)',
    bioTr:
      'Döngü fazlarına göre mikro besin dengesi, demir/magnezyum desteği ve metabolik wellness konularında pratik beslenme içerikleri üretir.',
    bioEn:
      'Authors practical nutrition guides covering cycle-phase micronutrients, iron/magnesium balance, and metabolic wellbeing.',
    reviewerTr: 'Kadın Atlası Tıbbi Yayın & İnceleme Kurulu',
    reviewerEn: 'Kadın Atlası Medical Editorial & Review Board',
  },
  'Dr. Aylin Koç': {
    roleTr: 'Kadın ve Koruyucu Sağlık Editoryal Katkıcısı',
    roleEn: 'Women’s Preventive Health Contributor',
    bioTr:
      'Rutin jinekolojik taramalar, cinsel sağlık farkındalığı ve koruyucu tıp başlıklarında bilgilendirici rehberler hazırlar.',
    bioEn:
      'Writes preventive health guides focused on routine screenings, sexual wellbeing, and informed patient care.',
    reviewerTr: 'Kadın Atlası Tıbbi Yayın & İnceleme Kurulu',
    reviewerEn: 'Kadın Atlası Medical Editorial & Review Board',
  },
};

export function getAuthorProfile(authorName?: string): AuthorProfileInfo {
  const cleanName = (authorName || 'Kadın Atlası Yayın Ekibi').trim();
  const matched = AUTHOR_PROFILES[cleanName];
  if (matched) {
    return { name: cleanName, ...matched };
  }
  return {
    name: cleanName,
    roleTr: 'Kadın Sağlığı İçerik & Editoryal Katkıcısı',
    roleEn: 'Women’s Health Editorial Contributor',
    bioTr:
      'Kadın Atlası sağlık kütüphanesi için uluslararası klinik kılavuzlar doğrultusunda bilgilendirici içerikler hazırlar.',
    bioEn:
      'Contributes evidence-informed women’s health articles grounded in international clinical guidelines.',
    reviewerTr: 'Kadın Atlası Tıbbi Yayın & İnceleme Kurulu',
    reviewerEn: 'Kadın Atlası Medical Editorial & Review Board',
  };
}

const REFERENCES_BY_CATEGORY: Record<string, ScientificReference[]> = {
  menstrual_health: [
    {
      org: 'ACOG',
      titleTr: 'Adet Döngüsünün Yaşamsal Bir Belirti Olarak Değerlendirilmesi (ACOG)',
      titleEn: 'Menstruation in Girls and Adolescents: Using the Menstrual Cycle as a Vital Sign',
      url: 'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/12/menstruation-in-girls-and-adolescents-using-the-menstrual-cycle-as-a-vital-sign',
    },
    {
      org: 'NHS',
      titleTr: 'Adet Dönemleri ve Menstrüel Siklus Rehberi (NHS)',
      titleEn: 'Periods and the Menstrual Cycle Overview (NHS)',
      url: 'https://www.nhs.uk/conditions/periods/',
    },
    {
      org: 'NIH / NICHD',
      titleTr: 'Menstrüasyon ve Döngü Sağlığı Hakkında Bilgiler (NICHD)',
      titleEn: 'About Menstruation and Cycle Health (NICHD)',
      url: 'https://www.nichd.nih.gov/health/topics/menstruation',
    },
  ],
  fertility: [
    {
      org: 'ACOG',
      titleTr: 'Doğurganlık ve Ovulasyon Değerlendirmesi (ACOG)',
      titleEn: 'Evaluating Infertility and Ovulation (ACOG)',
      url: 'https://www.acog.org/womens-health/faqs/evaluating-infertility',
    },
    {
      org: 'NIH / NICHD',
      titleTr: 'İnfertilite ve Doğurganlık Temelleri (NICHD)',
      titleEn: 'Infertility and Fertility Basics (NICHD)',
      url: 'https://www.nichd.nih.gov/health/topics/infertility',
    },
    {
      org: 'NHS',
      titleTr: 'Gebelik Planlama ve Doğurganlık Penceresi (NHS)',
      titleEn: 'Trying for a Baby and Fertile Window Guidance (NHS)',
      url: 'https://www.nhs.uk/pregnancy/trying-for-a-baby/trying-to-get-pregnant/',
    },
  ],
  nutrition: [
    {
      org: 'WHO',
      titleTr: 'Sağlıklı Beslenme Klinik Bilgi Formu (DSÖ / WHO)',
      titleEn: 'Healthy Diet Fact Sheet (WHO)',
      url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
    },
    {
      org: 'NIH ODS',
      titleTr: 'Demir Beslenme ve Gereksinim Rehberi (NIH)',
      titleEn: 'Iron Dietary Supplement Fact Sheet (NIH ODS)',
      url: 'https://ods.od.nih.gov/factsheets/Iron-Consumer/',
    },
    {
      org: 'NIH ODS',
      titleTr: 'Magnezyum ve Kas/Sinir Desteği Rehberi (NIH)',
      titleEn: 'Magnesium Dietary Supplement Fact Sheet (NIH ODS)',
      url: 'https://ods.od.nih.gov/factsheets/Magnesium-Consumer/',
    },
  ],
  sexual_health: [
    {
      org: 'WHO',
      titleTr: 'Cinsel Sağlık ve Üreme Hakları Çerçevesi (DSÖ / WHO)',
      titleEn: 'Sexual Health Overview (WHO)',
      url: 'https://www.who.int/health-topics/sexual-health',
    },
    {
      org: 'ACOG',
      titleTr: 'Servikal Kanser (Smear ve HPV) Tarama Kılavuzu (ACOG)',
      titleEn: 'Cervical Cancer Screening Guidelines (ACOG)',
      url: 'https://www.acog.org/womens-health/faqs/cervical-cancer-screening',
    },
    {
      org: 'NHS',
      titleTr: 'Servikal Tarama ve Koruyucu Kontroller (NHS)',
      titleEn: 'Cervical Screening Overview (NHS)',
      url: 'https://www.nhs.uk/conditions/cervical-screening/',
    },
  ],
  pregnancy: [
    {
      org: 'WHO',
      titleTr: 'Doğum Öncesi Bakım Önerileri (DSÖ / WHO)',
      titleEn: 'WHO Recommendations on Antenatal Care',
      url: 'https://www.who.int/publications/i/item/9789241549912',
    },
    {
      org: 'NHS',
      titleTr: 'Hafta Hafta Hamilelik Rehberi (NHS)',
      titleEn: 'Your Pregnancy Week by Week (NHS)',
      url: 'https://www.nhs.uk/pregnancy/week-by-week/',
    },
    {
      org: 'ACOG',
      titleTr: 'Gebelikte Fetal Gelişim Süreci (ACOG)',
      titleEn: 'How Your Fetus Grows During Pregnancy (ACOG)',
      url: 'https://www.acog.org/womens-health/faqs/how-your-fetus-grows-during-pregnancy',
    },
  ],
};

export function getCategoryReferences(
  category: string,
  locale: Locale,
): Array<{ org: string; title: string; url: string }> {
  const list = REFERENCES_BY_CATEGORY[category] || REFERENCES_BY_CATEGORY.menstrual_health;
  return list.map((item) => ({
    org: item.org,
    title: locale === 'en' ? item.titleEn : item.titleTr,
    url: item.url,
  }));
}
