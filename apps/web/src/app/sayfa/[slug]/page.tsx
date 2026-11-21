import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { CmsPageClient } from '@/components/CmsPageClient';
import { publicApi, type CmsPage, type Locale } from '@/lib/api';
import { SITE_URL, getRouteMeta } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const DEFAULT_FALLBACKS: Record<
  string,
  { titleTr: string; titleEn: string; contentTr: string; contentEn: string }
> = {
  hakkimizda: {
    titleTr: 'Hakkımızda ve Kurumsal Künye',
    titleEn: 'About Us & Corporate Information',
    contentTr: `## 1. Kurumsal Kimlik ve İşletmeci Bilgileri

**Kadın Atlası** (\`kadinatlasi.com\` web platformu ve iOS / Android mobil uygulamaları), kadınların döngü sağlığı, doğurganlık, gebelik takibi ve bütünsel yaşam alışkanlıklarını bilimsel rehberlik ve yüksek veri gizliliği standartlarıyla yönetebilmesi amacıyla geliştirilmiş dijital sağlık ve wellness platformudur.

- **Platform ve Marka Adı:** Kadın Atlası (Women's Wellness Companion)
- **İşletmeci / Veri Sorumlusu:** Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi
- **Merkez Lokasyon:** İstanbul, Türkiye
- **Genel İletişim ve Destek E-postası:** destek@kadinatlasi.com
- **KVKK ve Veri Koruma Başvuru E-postası:** kvkk@kadinatlasi.com
- **Hukuki Bildirim ve İş Birliği:** hukuk@kadinatlasi.com
- **Resmi Web İletişim Kanalı:** [kadinatlasi.com/iletisim](https://kadinatlasi.com/iletisim)

## 2. Ekibimiz ve Tıbbi Yayın & İnceleme Kurulu

- **Kadın Hastalıkları, Doğum ve Üreme Endokrinolojisi Editörlüğü (Dr. Ayşe Yılmaz)**
- **Beslenme ve Diyetetik Editörlüğü (Uzm. Dyt. Elif Kaya)**
- **Klinik Psikoloji ve Cinsel Sağlık Danışmanlığı (Uzm. Psk. Zeynep Demir)**
- **Kadın Atlası Tıbbi Yayın & İnceleme Kurulu:** Yayınlanan tüm içeriklerin ACOG, WHO, NHS ve NIH/NICHD kılavuzlarıyla uyumluluğunu 6 aylık periyotlarla denetler.`,
    contentEn: `## 1. Corporate Identity & Operator Information

**Kadın Atlası** (\`kadinatlasi.com\` and mobile apps) is a digital health and wellness platform operated by **Kadın Atlası Digital Health & Wellness Technologies Management** (Istanbul, Turkey).

- **General Support:** destek@kadinatlasi.com
- **Privacy & KVKK Requests:** kvkk@kadinatlasi.com
- **Legal Inquiries:** hukuk@kadinatlasi.com`,
  },
  'gizlilik-politikasi': {
    titleTr: 'Gizlilik Politikası ve KVKK Aydınlatma Metni',
    titleEn: 'Privacy Policy & Data Protection Disclosure',
    contentTr: `## 1. Veri Sorumlusu ve Kapsam

6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") Madde 10 uyarınca Veri Sorumlusu **Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi**'dir (İletişim: kvkk@kadinatlasi.com).

## 2. Toplanan Kişisel ve Sağlık Verileri

- **Kimlik ve Hesap Bilgileri:** Ad, soyad, kullanıcı adı, e-posta, doğum tarihi.
- **Özel Nitelikli Sağlık Verileri (KVKK m. 6):** Açık rızanızla girdiğiniz regl döngüsü tarihleri, ovulasyon/doğurganlık kayıtları, gebelik takibi, semptom, su, uyku, adım ve boy/kilo verileri.
- **NOVA AI Etkileşim Verileri:** Sohbet mesajları ve kota sayaçları (genel yapay zeka modeli eğitiminde kullanılmaz).

## 3. Saklama Süresi, Veri Taşınabilirliği ve Silme

Hesabınızı uygulama içinden (*Profilim > Hesabı Sil*) sildiğinizde verileriniz aktif sistemlerden derhal, şifreli yedeklerden en geç **30 gün** içinde kalıcı olarak silinir. *Profilim > Verilerimi İndir (JSON)* menüsünden tüm verilerinizi indirebilirsiniz.`,
    contentEn: `## 1. Data Controller & Scope

Prepared under KVKK Article 10 and GDPR principles by **Kadın Atlası Digital Health & Wellness Technologies Management** (Contact: kvkk@kadinatlasi.com).

## 2. Collected Data, AI Processing & Retention

Health and cycle logs are processed strictly with explicit consent, never sold to advertisers, and never used to train public AI models. Deleted accounts are purged immediately from active databases and within 30 days from encrypted backups.`,
  },
  'kvkk-aydinlatma-metni': {
    titleTr: 'KVKK Aydınlatma ve Açık Rıza Metni',
    titleEn: 'KVKK Clarification & Explicit Consent Notice',
    contentTr: `## 1. Aydınlatma Metni ve Açık Rıza Yönetimi

6698 sayılı KVKK Madde 6 ve Madde 10 kapsamında özel nitelikli sağlık verilerinizin işlenmesine ilişkin açık rıza tercihlerinizi mobil uygulamada **Profilim > KVKK İzinleri** ekranından dilediğiniz zaman yönetebilir veya geri çekebilirsiniz. Başvuru: kvkk@kadinatlasi.com.`,
    contentEn: `## 1. KVKK Clarification & Explicit Consent

Manage or withdraw your explicit consent choices for health data and AI memory anytime under **Profile > KVKK Consents** in the mobile app or by contacting kvkk@kadinatlasi.com.`,
  },
  'kullanim-kosullari': {
    titleTr: 'Kullanım Koşulları ve Yasal Uyarılar',
    titleEn: 'Terms of Service & Medical Disclaimer',
    contentTr: `## 1. Tıbbi Sorumluluk Reddi

Kadın Atlası web sitesi, hesaplayıcıları ve NOVA AI asistanı yalnızca bilgilendirme ve kişisel wellness takibi amacı taşır; **tıbbi teşhis, tanı, tedavi veya doğum kontrol yöntemi yerine geçmez**. Acil durumlarda 112'yi arayınız ve sağlık sorunlarınızda uzman hekime danışınız.

## 2. Abonelik, Kota ve İletişim

Ücretsiz planda aylık 100 NOVA AI mesajı, Premium planda (99 ₺/ay veya 799 ₺/yıl) aylık 1.000 NOVA AI mesajı sunulur. İletişim: destek@kadinatlasi.com.`,
    contentEn: `## 1. Medical Disclaimer & Terms

Kadın Atlası provides informational wellness tracking and does not replace medical diagnosis or treatment. Free tier includes 100 NOVA AI messages/month; Premium includes 1,000 messages/month. Contact: destek@kadinatlasi.com.`,
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cookieStore = await cookies();
  const locale: Locale = cookieStore.get('web_locale')?.value === 'en' ? 'en' : 'tr';
  const canonical = `${SITE_URL}/sayfa/${encodeURIComponent(slug)}`;
  const routeDefault = getRouteMeta(`/sayfa/${slug}`, locale);

  try {
    const page = await publicApi.getPageBySlug(slug);
    const pageTitle = locale === 'en' && page.titleEn ? page.titleEn : page.titleTr;
    return {
      title: `${pageTitle} — Kadın Atlası`,
      description: routeDefault.description,
      alternates: {
        canonical,
      },
      openGraph: {
        title: `${pageTitle} — Kadın Atlası`,
        description: routeDefault.description,
        url: canonical,
        siteName: 'Kadın Atlası',
        locale: locale === 'en' ? 'en_US' : 'tr_TR',
        type: 'website',
        images: [{ url: `${SITE_URL}/images/mascots/2.png`, width: 512, height: 512 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${pageTitle} — Kadın Atlası`,
        description: routeDefault.description,
        images: [`${SITE_URL}/images/mascots/2.png`],
      },
    };
  } catch {
    return {
      title: routeDefault.title,
      description: routeDefault.description,
      alternates: {
        canonical,
      },
    };
  }
}

export default async function CmsDynamicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let page: CmsPage | null = null;
  try {
    page = await publicApi.getPageBySlug(slug);
  } catch {
    page = null;
  }

  const fb = DEFAULT_FALLBACKS[slug];
  if (!page && !fb) {
    notFound();
  }

  return (
    <CmsPageClient
      page={page}
      slug={slug}
      fallbackTitleTr={fb?.titleTr}
      fallbackTitleEn={fb?.titleEn}
      fallbackContentTr={fb?.contentTr}
      fallbackContentEn={fb?.contentEn}
    />
  );
}
