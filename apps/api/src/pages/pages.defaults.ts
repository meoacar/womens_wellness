export interface DefaultPageDefinition {
  slug: string;
  aliases: string[];
  titleTr: string;
  titleEn: string;
  sortOrder: number;
  isActive: boolean;
  contentTr: string;
  contentEn: string;
}

export const DEFAULT_LEGAL_PAGES: DefaultPageDefinition[] = [
  {
    slug: 'hakkimizda',
    aliases: ['about', 'about-us', 'kurumsal'],
    titleTr: 'Hakkımızda ve Kurumsal Künye',
    titleEn: 'About Us & Corporate Information',
    sortOrder: 1,
    isActive: true,
    contentTr: `## 1. Kurumsal Kimlik ve İşletmeci Bilgileri

**Kadın Atlası** (\`kadinatlasi.com\` web platformu ve iOS / Android mobil uygulamaları), kadınların döngü sağlığı, doğurganlık, gebelik takibi ve bütünsel yaşam alışkanlıklarını bilimsel rehberlik ve yüksek veri gizliliği standartlarıyla yönetebilmesi amacıyla geliştirilmiş dijital sağlık ve wellness platformudur.

- **Platform ve Marka Adı:** Kadın Atlası (Women's Wellness Companion)
- **İşletmeci / Veri Sorumlusu:** Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi
- **Merkez Lokasyon:** İstanbul, Türkiye
- **Genel İletişim ve Destek E-postası:** destek@kadinatlasi.com
- **KVKK ve Veri Koruma Başvuru E-postası:** kvkk@kadinatlasi.com
- **Hukuki Bildirim ve İş Birliği:** hukuk@kadinatlasi.com
- **Resmi Web İletişim Kanalı:** [kadinatlasi.com/iletisim](https://kadinatlasi.com/iletisim)

## 2. Misyonumuz ve Vizyonumuz

Kadın sağlığına dair güvenilir, anlaşılır ve bilimsel dayanaklı bilgiye erişimi demokratikleştirmek için çalışıyoruz. Amacımız; regl döngüsü, ovulasyon, doğurganlık penceresi, gebelik süreci, su tüketimi, uyku düzeni ve ruhsal denge takibini tek bir reklamsız, güvenli ve empatik ekosistemde birleştirmektir.

Kadın Atlası, kullanıcılarının beden okuryazarlığını artırırken mahremiyetten ödün vermeyen bir teknoloji mimarisi sunar.

## 3. Ekibimiz ve Tıbbi Yayın & İnceleme Kurulu

Platformumuzdaki sağlık hesaplayıcıları, döngü algoritmaları ve Keşfet kütüphanesindeki rehber içerikler multidisipliner bir ekip tarafından hazırlanmakta ve denetlenmektedir:

- **Kadın Hastalıkları, Doğum ve Üreme Endokrinolojisi Editörlüğü (Dr. Ayşe Yılmaz):** Menstrüel döngü fizyolojisi, ovulasyon, doğurganlık penceresi, gebelik haftası hesaplamaları ve pelvik sağlık içeriklerinin klinik rehberlere uygunluğunu denetler.
- **Beslenme ve Diyetetik Editörlüğü (Uzm. Dyt. Elif Kaya):** Döngü fazlarına göre beslenme, demir ve mikro besin gereksinimleri, gebelik beslenmesi ve hidrasyon rehberlerini hazırlar.
- **Klinik Psikoloji ve Cinsel Sağlık Danışmanlığı (Uzm. Psk. Zeynep Demir):** PMS/PMDD, hormonal duygu durum değişimleri, stres yönetimi, uyku hijyeni ve cinsel sağlık içeriklerini inceler.
- **Kadın Atlası Tıbbi Yayın & İnceleme Kurulu:** Yayınlanan tüm içeriklerin uluslararası kılavuzlarla (**ACOG** – Amerikan Kadın Hastalıkları ve Doğum Uzmanları Koleji, **WHO** – Dünya Sağlık Örgütü, **NHS** – Birleşik Krallık Ulusal Sağlık Servisi, **NIH/NICHD**) uyumluluğunu 6 aylık periyotlarla gözden geçirir.
- **Yazılım Mühendisliği ve Veri Güvenliği Ekibi:** Altyapı güvenliği, şifreleme, KVKK/GDPR uyumluluğu ve NOVA AI yapay zeka güvenlik katmanlarını yönetir.

## 4. Bilimsel İçerik ve Editöryal İlkelerimiz

1. **Kanıta Dayalı Kaynakça:** Keşfet kütüphanemizdeki her sağlık rehberinde yazar bilgisi, uzmanlık alanı, tıbbi inceleme kurulu onayı, son inceleme tarihi ve doğrulama yapılabilen birincil bilimsel kaynak bağlantıları açıkça sunulur.
2. **Tıbbi Teşhis Sınırının Korunması:** Kadın Atlası bir tıbbi cihaz değildir; sunulan hiçbir içerik, hesaplama veya NOVA AI yanıtı hekim muayenesi, tanı veya tedavisinin yerini tutmaz.
3. **Ticari Bağımsızlık:** İçeriklerimiz ilaç firmaları veya reklam ağları tarafından finanse edilmez; editöryal bağımsızlık esastır.

## 5. Veri Etiği ve Mahremiyet Taahhüdümüz

Sağlık ve döngü verileri en hassas kişisel veri kategorisindedir. Bu bilinçle:

- Sağlık kayıtlarınızı üçüncü taraf reklam ağlarına veya veri simsarlarına **asla satmayız ve pazarlama amacıyla paylaşmayız**.
- Verilerinizi kendi cihazınıza **JSON formatında tek tıkla indirme** ve hesabınızı **kalıcı olarak silme** hakkını uygulama içinde self-servis olarak sunarız.
- Yapay zeka asistanımız **NOVA AI** ile yaptığınız görüşmeleri genel yapay zeka modellerini eğitmek için kullanmayız.`,
    contentEn: `## 1. Corporate Identity & Operator Information

**Kadın Atlası** (\`kadinatlasi.com\` web platform and iOS / Android mobile applications) is a digital health and wellness platform engineered to help women manage menstrual health, fertility, pregnancy tracking, and holistic daily habits with evidence-informed guidance and strict data privacy standards.

- **Platform & Brand Name:** Kadın Atlası (Women's Wellness Companion)
- **Operator / Data Controller:** Kadın Atlası Digital Health & Wellness Technologies Management
- **Headquarters:** Istanbul, Turkey
- **General Support Email:** destek@kadinatlasi.com
- **Privacy & Data Protection (KVKK / GDPR) Email:** kvkk@kadinatlasi.com
- **Legal Inquiries:** hukuk@kadinatlasi.com
- **Official Web Contact Form:** [kadinatlasi.com/iletisim](https://kadinatlasi.com/iletisim)

## 2. Our Mission & Vision

We work to make reliable, accessible, and science-informed women's health knowledge available to everyone. Our mission is to unite menstrual cycle tracking, ovulation and fertility insights, pregnancy milestones, hydration, sleep, and emotional wellbeing within an ad-free, privacy-first ecosystem.

## 3. Our Team & Medical Review Board

Our calculators, cycle algorithms, and educational guides are authored and reviewed by a multidisciplinary team:

- **OB/GYN & Reproductive Endocrinology Editorial (Dr. Ayşe Yılmaz):** Reviews menstrual physiology, ovulation, fertility windows, pregnancy calculations, and pelvic health content against clinical guidelines.
- **Nutrition & Dietetics Editorial (Uzm. Dyt. Elif Kaya):** Leads cycle-synced nutrition, micronutrient needs, maternal nutrition, and hydration guidance.
- **Clinical Psychology & Sexual Wellbeing Advisory (Uzm. Psk. Zeynep Demir):** Reviews PMS/PMDD, hormonal mood shifts, stress management, sleep hygiene, and sexual health guides.
- **Kadın Atlası Medical Review Board:** Audits all educational articles every 6 months against international clinical references (**ACOG**, **WHO**, **NHS**, **NIH/NICHD**).
- **Software Engineering & Data Security Team:** Maintains encryption, isolated database architecture, KVKK/GDPR compliance, and NOVA AI safety guardrails.

## 4. Editorial & Scientific Standards

1. **Verifiable Citations:** Every guide displays its author, specialty, reviewing board, review date, and direct links to primary clinical sources.
2. **Clear Medical Disclaimer:** Kadın Atlası is not a medical device; no content, calculator, or NOVA AI response replaces professional medical diagnosis or treatment.
3. **Editorial Independence:** Our educational library is free from third-party advertising sponsorship.

## 5. Data Ethics & Privacy Commitment

- We **never sell** your personal health or cycle records to advertisers or data brokers.
- You have full self-service control to **export your data as JSON** or **permanently delete your account** directly inside the mobile app.
- Conversations with **NOVA AI** are never used to train public foundation models.`,
  },
  {
    slug: 'gizlilik-politikasi',
    aliases: ['privacy-policy', 'privacy', 'gizlilik'],
    titleTr: 'Gizlilik Politikası ve KVKK Aydınlatma Metni',
    titleEn: 'Privacy Policy & Data Protection Disclosure',
    sortOrder: 2,
    isActive: true,
    contentTr: `## 1. Veri Sorumlusu ve Kapsam

Bu Gizlilik Politikası ve Kişisel Verilerin Korunması Aydınlatma Metni, **6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK")** Madde 10 ile Avrupa Birliği Genel Veri Koruma Tüzüğü ("GDPR") ilkeleri uyarınca, **Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi** ("Kadın Atlası" veya "Veri Sorumlusu") tarafından \`kadinatlasi.com\` web sitesi ve Kadın Atlası mobil uygulamalarını kullanan ziyaretçi ve üyelerimizi bilgilendirmek amacıyla hazırlanmıştır.

- **Veri Sorumlusu:** Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi (İstanbul, Türkiye)
- **KVKK ve Veri Koruma Başvuru E-postası:** kvkk@kadinatlasi.com
- **Genel Destek E-postası:** destek@kadinatlasi.com
- **Online Başvuru Kanalı:** [kadinatlasi.com/iletisim](https://kadinatlasi.com/iletisim) (*"KVKK / Veri Talebi"* kategorisi)

## 2. Toplanan Kişisel Veriler ve Kategorileri

Platformumuzu kullanım şeklinize bağlı olarak aşağıdaki veri kategorileri işlenmektedir:

### 2.1. Kimlik ve İletişim Verileri
- Ad, soyad, rumuz (kullanıcı adı), e-posta adresi, doğum tarihi, profil fotoğrafı (isteğe bağlı).
- İletişim ve destek formları üzerinden paylaştığınız ad, e-posta ve mesaj içerikleri.

### 2.2. Özel Nitelikli Kişisel Veriler (Sağlık ve Döngü Verileri – KVKK m. 6)
Yalnızca **açık rızanız** doğrultusunda ve kişisel takibinizi sağlamak amacıyla işlenen veriler:
- **Menstrüel Döngü Verileri:** Son adet tarihi (SAT), döngü uzunluğu, kanama süresi, kanama yoğunluğu, tahmini ovulasyon ve doğurganlık penceresi kayıtları.
- **Gebelik Takibi Verileri:** Gebelik modu başlangıç tarihi, tahmini doğum tarihi, bebek hareket (tekme) sayaçları, kasılma kayıtları, hastane çantası ve doğum planı notları.
- **Günlük Wellness ve Vücut Metrikleri:** Semptom kayıtları (ağrı, kramp, akıntı vb.), ruh hali ve enerji düzeyi, günlük su tüketimi, adım sayısı, uyku süresi, meditasyon geçmişi, boy (cm) ve kilo (kg) değerleri.

### 2.3. Yapay Zeka (NOVA AI) Etkileşim Verileri
- NOVA AI sohbet asistanına gönderdiğiniz sorular, sohbet oturumu geçmişi, aylık kota kullanım sayacı (Ücretsiz planda 100 mesaj/ay, Premium planda 1.000 mesaj/ay) ve açık rıza vermeniz halinde kişiselleştirme tercihleri.

### 2.4. İşlem Güvenliği, Cihaz ve Abonelik Verileri
- Tek yönlü şifrelenmiş parola özeti (\`bcrypt\` hash) ve uygulama içi PIN kilidi doğrulama durumu.
- IP adresi, cihaz modeli, işletim sistemi sürümü, uygulama sürümü, oturum belirteçleri (JWT), hata kayıtları ve KVKK açık rıza onay zaman damgaları.
- Premium üyeliklerde Apple App Store veya Google Play Store tarafından sağlanan anonim abonelik doğrulama makbuzları (**kredi kartı bilgileriniz tarafımızca görülmez ve saklanmaz**).

### 2.5. Web Sitesi Hesaplayıcıları ve Çerez/Yerel Depolama Verileri
- Web sitemizdeki (\`kadinatlasi.com/hesaplayicilar\`) Regl, Gebelik, Su, VKİ ve BMH hesaplayıcılarına girdiğiniz değerler **yalnızca anlık sonucu ekranda göstermek için** işlenir; herhangi bir kullanıcı profiliyle ilişkilendirilerek veritabanına kaydedilmez.
- Web sitesinde yalnızca dil tercihi (\`web_locale\`) ve tema tercihi (\`theme\`) için zorunlu işlevsel çerez/yerel depolama kullanılır; üçüncü taraf reklam takip çerezi kullanılmaz.

## 3. Kişisel Verilerin İşlenme Amaçları ve Hukuki Sebepleri

Verileriniz KVKK Madde 5 ve Madde 6 kapsamında aşağıdaki amaçlar ve hukuki sebeplerle işlenir:

- **Sözleşmenin Kurulması ve İfası (KVKK m. 5/2-c):** Kullanıcı hesabının oluşturulması, verilerin cihazlar arası senkronize edilmesi, topluluk soru-cevap hizmetinin sunulması, Premium abonelik ve kota haklarının tanımlanması.
- **Hukuki Yükümlülüklerin Yerine Getirilmesi ve Bir Hakkın Tesisi (KVKK m. 5/2-ç ve m. 5/2-e):** Bilgi güvenliği kayıtlarının tutulması, yetkili makam taleplerinin karşılanması, KVKK ve destek başvurularının yanıtlanması.
- **İlgili Kişinin Açık Rızası (KVKK m. 6/2 ve m. 5/1):** Özel nitelikli sağlık ve döngü verilerinizin işlenmesi, kişiselleştirilmiş döngü/ovulasyon analizlerinin üretilmesi, doktor raporu çıktısı hazırlanması, NOVA AI hafıza kişiselleştirmesi ve isteğe bağlı bildirimlerin gönderilmesi. Açık rızanızı mobil uygulamada **Profilim > KVKK İzinleri** menüsünden dilediğiniz an geri çekebilirsiniz.

## 4. Yapay Zeka (NOVA AI) Hizmetleriyle Veri İşleme İlkeleri

Sağlık verilerinizin yapay zeka ile işlenmesinde en sıkı gizlilik kuralları uygulanır:

1. **Amaçla Sınırlı İletim:** NOVA AI sohbet ekranında yazdığınız mesajlar, yalnızca size anlık yanıt üretebilmek amacıyla TLS 1.2/1.3 şifreli bağlantı üzerinden kurumsal yapay zeka altyapı sağlayıcısına (**Google Gemini API**) iletilir.
2. **Model Eğitimi Yasağı:** Kişisel sağlık kayıtlarınız ve NOVA AI sohbet içerikleriniz, üçüncü taraf genel yapay zeka modellerinin eğitilmesi (training) amacıyla **kesinlikle kullanılmaz**.
3. **Kimliksizleştirme:** Yapay zeka servisine yapılan teknik çağrılarda e-posta adresiniz, tam adınız veya şifreniz paylaşılmaz.
4. **AI Hafıza Kontrolü:** Mobil uygulamada *Profilim > KVKK İzinleri > AI Hafıza ve Kişiselleştirme* izni kapalı olduğunda sohbet geçmişiniz kalıcı profil hafızasında işlenmez.

## 5. Kişisel Verilerin Aktarılması ve Üçüncü Taraflar

- **Satmama ve Reklam Yasağı:** Sağlık, döngü ve gebelik verileriniz hiçbir koşulda reklam ağlarına, veri simsarlarına (data brokers), sigorta şirketlerine veya üçüncü taraflara **satılmaz, kiralanmaz ve reklam hedeflemesi amacıyla paylaşılmaz**.
- Verileriniz yalnızca hizmetin teknik olarak çalışması için gerekli olduğu ölçüde ve KVKK m. 8–9 güvenlik tedbirleriyle:
  1. **Barındırma ve Sunucu Altyapısı:** Güvenlik duvarı arkasında izole edilmiş veritabanı ve uygulama sunucusu sağlayıcısı,
  2. **Yapay Zeka Yanıt Motoru:** Yalnızca NOVA AI sohbet özelliğini kullandığınızda yanıt üretimi için kurumsal Google Gemini API servisi,
  3. **Ödeme ve Abonelik Doğrulama:** Yalnızca abonelik durumunu doğrulamak amacıyla Apple App Store, Google Play Store ve RevenueCat altyapısı (sağlık verisi aktarılmaz),
  4. **Yasal Zorunluluk:** Kanunen yetkili mahkeme ve kamu kurumlarının bağlayıcı kararları kapsamında aktarılabilir.

## 6. Veri Saklama Süreleri ve İmha Politikası

- **Aktif Üyelik Süresince:** Hesap ve sağlık/döngü verileriniz, üyeliğiniz devam ettiği ve açık rızanız yürürlükte olduğu sürece saklanır.
- **Hesap Silme Talebi Sonrasında:** Mobil uygulama içinden (**Profilim > Hesabı Sil**) veya \`kvkk@kadinatlasi.com\` üzerinden hesabınızı sildiğinizde, tüm sağlık, döngü, gebelik ve sohbet verileriniz aktif üretim veritabanından **derhal** silinir; şifreli felaket kurtarma yedeklerinden ise **en geç 30 (otuz) gün** içinde kalıcı olarak imha edilir.
- **İletişim ve Destek Kayıtları:** Başvurunun çözümlenmesinden itibaren olası hukuki uyuşmazlık zamanaşımı süresi boyunca (azami 3 yıl) saklanır.
- **Trafik ve Abonelik Kayıtları:** 5651 sayılı Kanun uyarınca trafik logları **2 yıl**, elektronik ticaret ve abonelik/fatura kayıtları ilgili vergi ve ticaret mevzuatı uyarınca **10 yıl** süreyle izole olarak saklanır ve süre sonunda resen imha edilir.

## 7. Veri Güvenliği Tedbirleri ve Self-Servis Veri Kontrolü

Verilerinizin güvenliği için uygulanan başlıca teknik ve idari tedbirler:
- **Şifreli İletim ve Saklama:** Tüm web ve mobil API trafiği **TLS 1.2 / 1.3 (HTTPS)** ile şifrelenir; parolalar \`bcrypt\` algoritmasıyla hash'lenir.
- **İzole Veritabanı Ağı:** PostgreSQL veritabanı ve Redis önbellek katmanı dış internete tamamen kapalıdır; yalnızca uygulama içi özel ağdan erişilebilir.
- **Uygulama İçi PIN Kilidi:** Mobil uygulamada *Profilim > PIN Kilidi* özelliğiyle uygulama ekranınızı üçüncü kişilere karşı kilitleyebilirsiniz.
- **Verilerimi İndir (JSON):** Mobil uygulamada *Profilim > Veri ve Gizlilik > Verilerimi İndir (JSON)* butonuyla tüm kişisel ve sağlık verilerinizi yapılandırılmış JSON dosyası olarak cihazınıza indirebilirsiniz.
- **Hesabı Kalıcı Sil:** Mobil uygulamada *Profilim > Hesabı Sil* adımıyla tüm verilerinizi tek dokunuşla silebilirsiniz.

## 8. KVKK Madde 11 Kapsamındaki Haklarınız ve Başvuru Yöntemi

KVKK'nın 11. maddesi uyarınca Veri Sorumlusuna başvurarak;
1. Kişisel verilerinizin işlenip işlenmediğini öğrenme,
2. İşlenmişse buna ilişkin bilgi talep etme,
3. İşlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,
4. Yurt içinde veya yurt dışında kişisel verilerin aktarıldığı üçüncü kişileri bilme,
5. Eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme,
6. KVKK m. 7 şartları çerçevesinde kişisel verilerin silinmesini veya yok edilmesini isteme,
7. Düzeltme, silme ve yok edilme işlemlerinin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme,
8. İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,
9. Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.

### Başvuru Kanalları ve Yanıt Süresi
KVKK kapsamındaki tüm soru ve taleplerinizi:
- **E-posta ile:** Kayıtlı e-posta adresinizden **kvkk@kadinatlasi.com** adresine,
- **Web Formu ile:** [kadinatlasi.com/iletisim](https://kadinatlasi.com/iletisim) sayfasından *"KVKK / Veri Talebi"* kategorisini seçerek,
- **Mobil Uygulama İçinden:** *Profilim > Destek Ekibiyle İletişim* menüsünden iletebilirsiniz.

Başvurularınız KVKK Madde 13 uyarınca talebin niteliğine göre en kısa sürede ve **en geç 30 (otuz) gün** içinde ücretsiz olarak sonuçlandırılır.`,
    contentEn: `## 1. Data Controller & Scope

This Privacy Policy and Data Protection Disclosure is prepared in accordance with **Article 10 of the Turkish Personal Data Protection Law No. 6698 ("KVKK")** and **GDPR** principles by **Kadın Atlası Digital Health & Wellness Technologies Management** ("Kadın Atlası" or "Data Controller") for visitors and users of \`kadinatlasi.com\` and the Kadın Atlası mobile applications.

- **Data Controller:** Kadın Atlası Digital Health & Wellness Technologies Management (Istanbul, Turkey)
- **Privacy & Data Protection Officer Email:** kvkk@kadinatlasi.com
- **General Support Email:** destek@kadinatlasi.com
- **Web Contact Portal:** [kadinatlasi.com/iletisim](https://kadinatlasi.com/iletisim) (*"KVKK / Data Request"* category)

## 2. Categories of Personal & Health Data Collected

### 2.1. Identity & Account Data
- First name, last name, username, email address, date of birth, optional profile avatar, and messages submitted via support forms.

### 2.2. Special Categories of Health Data (KVKK Art. 6 / GDPR Art. 9)
Processed strictly based on your **explicit consent** to provide personal tracking:
- **Menstrual Cycle Data:** Last menstrual period (LMP) date, cycle length, period duration, flow intensity, ovulation and fertility window logs.
- **Pregnancy Tracking Data:** Pregnancy start/due date, kick counter logs, contraction timer logs, hospital bag checklist, and birth plan notes.
- **Daily Wellness & Body Metrics:** Symptom logs, mood and energy levels, daily water intake, step counts, sleep duration, meditation history, height (cm), and weight (kg).

### 2.3. Artificial Intelligence (NOVA AI) Interaction Data
- Messages sent to the NOVA AI companion, conversation history, monthly message quota counters (100 messages/month on Free, 1,000 messages/month on Premium), and optional AI memory preferences.

### 2.4. Security, Device & Subscription Data
- One-way hashed password (\`bcrypt\`), in-app PIN lock status, IP address, device model, OS version, JWT session tokens, error logs, and explicit consent timestamps.
- Anonymous subscription receipts provided by Apple App Store or Google Play Store (**we never see or store your credit card numbers**).

### 2.5. Web Calculators & Cookies
- Inputs entered into our public web calculators (\`kadinatlasi.com/hesaplayicilar\`) are calculated ephemerally and are **not saved** to a user profile.
- Our website uses only strictly necessary functional storage (\`web_locale\` and \`theme\`) and no third-party ad-tracking cookies.

## 3. Purposes & Legal Bases for Processing

- **Performance of a Contract (KVKK Art. 5/2-c / GDPR Art. 6(1)(b)):** Account creation, cloud sync, community Q&A, and Premium subscription management.
- **Legal Obligations & Legitimate Security Interests (KVKK Art. 5/2-ç, 5/2-e):** Information security auditing and responding to official data subject requests.
- **Explicit Consent (KVKK Art. 6/2 / GDPR Art. 9(2)(a)):** Processing sensitive health and cycle data, generating doctor health reports, NOVA AI memory personalization, and optional reminders. You can withdraw consent anytime via **Profile > KVKK Consents** in the mobile app.

## 4. Artificial Intelligence (NOVA AI) Processing Principles

1. **Purpose-Limited Transmission:** Messages sent to NOVA AI are transmitted over encrypted TLS 1.2/1.3 connections to our enterprise AI provider (**Google Gemini API**) solely to generate your response.
2. **No Foundation Model Training:** Your personal health logs and chat history are **never used to train** public third-party AI models.
3. **De-identification:** Your email address, real name, and password are excluded from AI inference requests.
4. **User-Controlled AI Memory:** You can toggle *AI Memory & Personalization* on or off anytime under *Profile > KVKK Consents*.

## 5. Data Sharing & Third-Party Service Providers

- **Strict No-Sale Policy:** We **never sell, rent, or share** your health, cycle, or pregnancy data with advertising networks, data brokers, or insurance companies.
- Data is shared strictly on a need-to-operate basis with: (a) Isolated cloud hosting infrastructure, (b) Enterprise Google Gemini API during active NOVA AI chat sessions, (c) Apple App Store / Google Play / RevenueCat for subscription status verification (no health data shared), and (d) Competent judicial authorities when legally mandated.

## 6. Data Retention Schedule & Deletion Policy

- **Active Accounts:** Retained while your account remains active.
- **Upon Account Deletion:** When you delete your account via **Profile > Delete Account** or by emailing \`kvkk@kadinatlasi.com\`, all health, cycle, pregnancy, and chat records are **immediately deleted** from the production database and permanently purged from encrypted backups within **30 days**.
- **Security & Financial Logs:** Traffic logs are retained for 2 years (Law No. 5651) and subscription invoice records for up to 10 years under statutory tax laws before automatic destruction.

## 7. Security Measures & Self-Service Controls

- **TLS 1.2/1.3 Encryption** in transit, \`bcrypt\` password hashing, private internal-only database (\`PostgreSQL\`) and cache (\`Redis\`) networking, in-app PIN lock, and admin audit logs.
- **Download My Data (JSON):** Export all your data anytime via *Profile > Data & Privacy > Download My Data (JSON)*.
- **Delete Account:** Permanently erase your account anytime via *Profile > Delete Account*.

## 8. Your Rights (KVKK Art. 11 / GDPR) & How to Contact Us

You have the right to learn whether your data is processed, request information, learn the purpose of processing and third-party recipients, request rectification or erasure, object to automated profiling, and claim compensation for unlawful processing.

Submit requests via **kvkk@kadinatlasi.com**, our [Web Contact Form](https://kadinatlasi.com/iletisim), or in-app Support. All requests are answered free of charge within **30 days**.`,
  },
  {
    slug: 'kvkk-aydinlatma-metni',
    aliases: ['kvkk', 'kvkk-consent', 'acik-riza-metni'],
    titleTr: 'KVKK Aydınlatma ve Açık Rıza Metni',
    titleEn: 'KVKK Clarification & Explicit Consent Notice',
    sortOrder: 3,
    isActive: true,
    contentTr: `## 1. Aydınlatma Metninin Amacı ve Veri Sorumlusu

Bu metin, **6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK")** Madde 10 ("Veri Sorumlusunun Aydınlatma Yükümlülüğü") ve Madde 6 ("Özel Nitelikli Kişisel Verilerin İşlenme Şartları") kapsamında, **Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi** tarafından kullanıcılarımızın açık rıza tercihlerini tam bilgi sahibi olarak yönetebilmesi amacıyla hazırlanmıştır.

- **Veri Sorumlusu:** Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi
- **KVKK Başvuru Adresi:** kvkk@kadinatlasi.com
- **Web Başvuru Formu:** [kadinatlasi.com/iletisim](https://kadinatlasi.com/iletisim)

## 2. Zorunlu Temel Veri İşleme ile Açık Rızaya Tabi İşlemlerin Ayrımı

Kadın Atlası uygulamasında veri işleme süreçleri **Zorunlu (Temel Hizmet)** ve **İsteğe Bağlı (Açık Rıza)** olarak ikiye ayrılır:

### 2.1. Zorunlu Temel Veri İşleme (KVKK m. 5/2-c, 5/2-ç)
Üyelik sözleşmesinin kurulması ve hesap güvenliğinin sağlanması için zorunludur:
- E-posta adresi, kullanıcı adı, şifrelenmiş parola ve temel oturum güvenliği kayıtları.

### 2.2. Açık Rızaya Tabi Özel Nitelikli Sağlık Verisi İşleme (KVKK m. 6/2)
Kullanıcının uygulama içinde kendi iradesiyle girdiği:
- Regl başlangıç/bitiş tarihleri, döngü uzunluğu, ovulasyon ve doğurganlık penceresi verileri,
- Gebelik takibi verileri (SAT, tahmini doğum tarihi, tekme/kasılma sayaçları),
- Günlük semptom, ruh hali, su, uyku, adım ve boy/kilo kayıtları.
Bu veriler yalnızca kişisel takvim tahminlerinin yapılması ve kullanıcının kendi sağlık raporunu oluşturabilmesi amacıyla işlenir.

### 2.3. İsteğe Bağlı Ek Açık Rıza Kalemleri
Mobil uygulamada **Profilim > KVKK İzinleri** ekranından ayrı ayrı açıp kapatabileceğiniz izinler:
1. **AI Hafıza ve Kişiselleştirme İzni:** NOVA AI asistanının geçmiş sohbet bağlamınızı hatırlayarak size özel yanıtlar üretmesi.
2. **Analitik ve Hizmet İyileştirme İzni:** Uygulama performansının ve ekran deneyiminin anonim istatistiklerle iyileştirilmesi.
3. **Pazarlama ve Bilgilendirme İletişimi İzni:** Yeni özellikler, kampanyalar ve dönemsel wellness bültenleri hakkında bildirim gönderilmesi.
4. **Üçüncü Taraf Cihaz/Takvim Entegrasyonu İzni:** Kullanıcının kendi cihazındaki sağlık/takvim uygulamalarıyla senkronizasyon yapılması.

## 3. Açık Rızanın Geri Çekilmesi ve Veri Silme Hakkı

Vermiş olduğunuz açık rızayı hiçbir gerekçe göstermeksizin dilediğiniz zaman geri çekebilirsiniz:
- **Uygulama İçinden Anlık Yönetim:** *Profilim > Veri ve Gizlilik > KVKK İzinleri* ekranındaki anahtarları kapatabilir veya **"Tüm İzinleri Geri Çek"** butonunu kullanabilirsiniz.
- **Verileri İndirme:** *Profilim > Veri ve Gizlilik > Verilerimi İndir (JSON)* seçeneğiyle tüm kayıtlarınızı dışa aktarabilirsiniz.
- **Hesabı ve Verileri Kalıcı Silme:** *Profilim > Hesabı Sil* butonuyla veya **kvkk@kadinatlasi.com** adresine e-posta göndererek tüm verilerinizin silinmesini sağlayabilirsiniz.`,
    contentEn: `## 1. Purpose & Data Controller

This notice is prepared under **Articles 6 and 10 of the Turkish Personal Data Protection Law No. 6698 ("KVKK")** by **Kadın Atlası Digital Health & Wellness Technologies Management** so users can make informed explicit consent choices regarding their personal and health data.

- **Data Controller:** Kadın Atlası Digital Health & Wellness Technologies Management
- **KVKK Contact Email:** kvkk@kadinatlasi.com
- **Web Request Form:** [kadinatlasi.com/iletisim](https://kadinatlasi.com/iletisim)

## 2. Mandatory vs. Consent-Based Data Processing

### 2.1. Mandatory Core Account Processing (KVKK Art. 5/2-c)
Required to create and secure your account: email address, username, hashed password, and security logs.

### 2.2. Explicit Consent for Sensitive Health Data (KVKK Art. 6/2)
Covers menstrual cycle dates, ovulation/fertility logs, pregnancy tracking metrics, daily symptoms, mood, water, sleep, steps, and height/weight entered voluntarily by the user to generate personal cycle predictions and health reports.

### 2.3. Granular Optional Consents
Managed individually anytime under **Profile > KVKK Consents** in the mobile app:
1. **AI Memory & Personalization:** Allows NOVA AI to remember prior context for tailored wellness responses.
2. **Analytics & Service Improvement:** Anonymized usage metrics to improve app stability.
3. **Marketing Communications:** Optional notifications about new features and offers.
4. **Third-Party Calendar/Health Sync:** Optional synchronization with device health/calendar services.

## 3. Withdrawing Consent & Deleting Data

You may withdraw your consent at any time without penalty:
- **In-App Controls:** Toggle individual permissions off or tap **"Withdraw All Consents"** under *Profile > KVKK Consents*.
- **Data Portability:** Export all records via *Profile > Download My Data (JSON)*.
- **Permanent Account Deletion:** Delete your account immediately via *Profile > Delete Account* or by contacting **kvkk@kadinatlasi.com**.`,
  },
  {
    slug: 'kullanim-kosullari',
    aliases: ['terms-of-service', 'terms', 'kosullar'],
    titleTr: 'Kullanım Koşulları ve Yasal Uyarılar',
    titleEn: 'Terms of Service & Medical Disclaimer',
    sortOrder: 4,
    isActive: true,
    contentTr: `## 1. Taraflar, Konu ve Kapsam

Bu Kullanım Koşulları ("Koşullar"), **Kadın Atlası Dijital Sağlık ve Wellness Teknolojileri Yönetimi** ("Kadın Atlası") tarafından sunulan \`kadinatlasi.com\` web sitesi ve Kadın Atlası mobil uygulamalarını ("Platform") kullanan tüm ziyaretçi ve kayıtlı kullanıcılar ("Kullanıcı") arasındaki kullanım şartlarını, hak ve yükümlülükleri düzenler.

Platforma erişim sağlayarak veya üye olarak bu Koşulları okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan etmiş olursunuz.

## 2. Tıbbi Sorumluluk Reddi (Önemli Yasal Uyarı)

- **Tıbbi Cihaz Değildir:** Kadın Atlası web sitesi, mobil uygulaması, döngü/ovulasyon/gebelik hesaplayıcıları, Keşfet makaleleri ve NOVA AI yapay zeka asistanı **yalnızca genel bilgilendirme, farkındalık ve kişisel wellness takibi** amacıyla sunulmaktadır; hiçbir şekilde **tıbbi teşhis, tanı, tedavi veya doğum kontrol yöntemi (kontrasepsiyon)** yerine geçmez.
- **Tahminlerin İstatistiksel Niteliği:** Regl döngüsü, doğurganlık penceresi, ovulasyon günü ve tahmini doğum tarihi hesaplamaları standart klinik formüllere (Naegele kuralı, Mifflin-St Jeor vb.) dayalı istatistiksel tahminlerdir. Stres, hormonal değişimler veya sağlık durumları nedeniyle gerçek döngü tarihleri farklılık gösterebilir.
- **Uzman Hekime Danışma Zorunluluğu:** Herhangi bir sağlık sorununuzda, geciken veya düzensiz kanamalarda, gebelik şüphesinde veya ilaç kullanımı öncesinde mutlaka bir **Kadın Hastalıkları ve Doğum Uzmanına** veya yetkili sağlık kuruluşuna başvurunuz.
- **Acil Durumlar:** Tıbbi acil durumlarda Platformu kullanmayınız; derhal **112 Acil Çağrı Merkezi**'ni arayınız veya en yakın sağlık kuruluşuna başvurunuz.

## 3. Üyelik, Yaş Sınırı ve Hesap Güvenliği

- **Yaş Sınırı:** Platforma üye olmak ve sağlık verisi işleme açık rızası vermek için **en az 18 yaşında** olmanız gerekmektedir.
- **Bilgi Doğruluğu ve Güvenlik:** Hesap oluştururken güncel bir e-posta adresi tanımlamak ve parolanızın gizliliğini korumak sizin sorumluluğunuzdadır. Uygulama içi PIN kilidi özelliğini aktif etmeniz önerilir.
- **Kişisel Kullanım:** Üyelik hesabınız kişiye özeldir; ticari amaçla kullanılamaz veya üçüncü kişilere devredilemez.

## 4. NOVA AI Yapay Zeka Asistanı ve Kota Koşulları

- **Bilgilendirme Amaçlı Sohbet:** NOVA AI, kadın sağlığı ve günlük wellness konularında empatik ve bilgilendirici yanıtlar üretmek üzere tasarlanmış bir yapay zeka asistanıdır; hekim veya psikolog değildir.
- **Aylık Mesaj Kotaları:**
  - **Ücretsiz Plan:** Aylık **100 mesaj** NOVA AI sohbet hakkı içerir.
  - **Premium Plan (Aylık / Yıllık):** Aylık **1.000 mesaj** NOVA AI Pro sohbet hakkı ve gelişmiş kişiselleştirilmiş içgörüler içerir.
- Aylık kotalar her fatura/takvim dönemi başında otomatik olarak yenilenir. Otomatik bot/script ile kötüye kullanım tespit edilmesi halinde sistem güvenliği için hız sınırlaması (rate limit) uygulanır.

## 5. Topluluk (Soru & Cevap) Kuralları ve Moderasyon

Platform içerisindeki Topluluk alanında soru soran ve yanıt paylaşan kullanıcılar aşağıdaki kurallara uymakla yükümlüdür:
1. Diğer kullanıcılara reçeteli ilaç, dozaj veya tıbbi müdahale önerisinde bulunulması kesinlikle yasaktır.
2. Hakaret, nefret söylemi, taciz, yanıltıcı sağlık iddiası, reklam veya spam içeren paylaşımlar yapılamaz.
3. Kişisel telefon numarası, açık adres veya üçüncü kişilere ait mahrem veriler paylaşılmamalıdır.
4. Kadın Atlası moderasyon ekibi, topluluk kurallarına aykırı içerikleri kaldırma ve kural ihlali yapan hesapları askıya alma hakkını saklı tutar.

## 6. Premium Abonelik, Ücretlendirme ve İptal Koşulları

- **Paket ve Fiyatlandırma:** Kadın Atlası Premium; **Aylık Plan (99 ₺ / ay)** ve **Yıllık Plan (799 ₺ / yıl – 7 gün ücretsiz deneme dahil)** seçenekleriyle sunulur. Güncel fiyatlar satın alma ekranında açıkça gösterilir.
- **Ödeme ve Otomatik Yenileme:** Satın alma işlemleri Apple App Store veya Google Play Store hesabınız üzerinden gerçekleştirilir. Abonelikler, mevcut dönem bitiminden en az 24 saat önce iptal edilmediği sürece seçilen periyotta otomatik olarak yenilenir.
- **İptal İşlemi:** Aboneliğinizi dilediğiniz zaman iOS cihazınızda *Ayarlar > Apple Kimliği > Abonelikler* veya Android cihazınızda *Google Play Store > Ödemeler ve Abonelikler* menüsünden iptal edebilirsiniz. İptal işlemi mevcut fatura döneminin sonunda geçerli olur; dönem sonuna kadar Premium haklarınız devam eder.
- **İade Politikası:** Uygulama mağazası üzerinden yapılan ödemelerin iade süreçleri ilgili mağazanın (Apple App Store / Google Play Store) iade kurallarına tabidir.

## 7. Fikri Mülkiyet Hakları

Platformda yer alan Kadın Atlası markası, maskot tasarımları, arayüz bileşenleri, Keşfet makaleleri, yazılım kodları ve grafikler Kadın Atlası'nın mülkiyetindedir; yazılı izin olmaksızın kopyalanamaz, çoğaltılamaz ve ticari amaçla kullanılamaz.

## 8. Sorumluluğun Sınırlandırılması ve Hizmet Değişiklikleri

Kadın Atlası, Platformun kesintisiz ve güvenli çalışması için gerekli tüm teknik önlemleri alır; ancak internet altyapısı kesintileri, mücbir sebepler veya kullanıcının tıbbi uyarıları dikkate almamasından doğabilecek doğrudan veya dolaylı sonuçlardan sorumlu tutulamaz.

## 9. Uygulanacak Hukuk, Yetkili Mahkeme ve İletişim

Bu Kullanım Koşulları **Türkiye Cumhuriyeti kanunlarına** tabidir. Koşulların uygulanmasından doğabilecek uyuşmazlıklarda **İstanbul (Çağlayan) Mahkemeleri ve İcra Daireleri** yetkilidir.

- **Destek ve İletişim E-postası:** destek@kadinatlasi.com
- **Hukuki Bildirimler:** hukuk@kadinatlasi.com
- **KVKK Başvuruları:** kvkk@kadinatlasi.com
- **Web İletişim Formu:** [kadinatlasi.com/iletisim](https://kadinatlasi.com/iletisim)`,
    contentEn: `## 1. Parties & Scope

These Terms of Service ("Terms") govern the access and use of the \`kadinatlasi.com\` website and Kadın Atlası mobile applications ("Platform") operated by **Kadın Atlası Digital Health & Wellness Technologies Management** ("Kadın Atlası"). By accessing or registering on the Platform, you agree to these Terms.

## 2. Medical Disclaimer (Important Legal Notice)

- **Not a Medical Device:** Kadın Atlası, its cycle/ovulation/pregnancy calculators, educational library, and NOVA AI assistant are provided **solely for informational, educational, and personal wellness tracking purposes**. They do **not** constitute medical advice, diagnosis, treatment, or contraception.
- **Statistical Estimates:** Cycle predictions, fertility windows, ovulation dates, and estimated due dates are statistical calculations based on standard formulas (Naegele's rule, Mifflin-St Jeor, etc.) and may vary in practice.
- **Consult a Physician:** Always consult a qualified OB/GYN or healthcare professional regarding any medical condition, irregular bleeding, pregnancy care, or medication.
- **Emergencies:** Do not use the Platform for medical emergencies; call **112** or your local emergency number immediately.

## 3. Eligibility (18+) & Account Security

- You must be **at least 18 years old** to create an account and consent to health data processing.
- You are responsible for maintaining the confidentiality of your password and in-app PIN lock.

## 4. NOVA AI Assistant & Fair Quota Policy

- **Informational Companion:** NOVA AI provides supportive wellness information and is not a licensed physician or therapist.
- **Monthly Message Quotas:**
  - **Free Plan:** Includes **100 NOVA AI messages per month**.
  - **Premium Plan (Monthly / Yearly):** Includes **1,000 NOVA AI Pro messages per month** plus personalized cycle and wellness insights.
- Quotas reset automatically each billing/calendar cycle.

## 5. Community (Q&A) Guidelines & Moderation

Users participating in Community Q&A must:
1. Never prescribe medications or clinical treatments to other users.
2. Refrain from harassment, hate speech, misinformation, spam, or commercial promotion.
3. Protect personal privacy and avoid posting phone numbers or physical addresses.
4. Kadın Atlası reserves the right to remove violating content and suspend offending accounts.

## 6. Premium Subscriptions, Billing & Cancellation

- **Plans & Pricing:** Monthly Premium (**99 ₺ / month**) and Yearly Premium (**799 ₺ / year**, including a 7-day free trial).
- **Auto-Renewal & Cancellation:** Subscriptions are billed through Apple App Store or Google Play Store and renew automatically unless canceled at least 24 hours before the end of the current period via your device's Store Subscription Settings. Refunds are governed by Apple App Store and Google Play Store policies.

## 7. Intellectual Property

All trademarks, mascot artwork, UI designs, educational articles, and software code on the Platform belong to Kadın Atlası and may not be copied or redistributed without permission.

## 8. Governing Law & Contact Information

These Terms are governed by the laws of the **Republic of Turkey**, with jurisdiction vested in the **Courts of Istanbul**.

- **General Support:** destek@kadinatlasi.com
- **Legal Notices:** hukuk@kadinatlasi.com
- **Privacy & KVKK Requests:** kvkk@kadinatlasi.com
- **Web Contact Form:** [kadinatlasi.com/iletisim](https://kadinatlasi.com/iletisim)`,
  },
];

export const SLUG_ALIAS_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const def of DEFAULT_LEGAL_PAGES) {
    map[def.slug] = def.slug;
    for (const alias of def.aliases) {
      map[alias] = def.slug;
    }
  }
  return map;
})();
