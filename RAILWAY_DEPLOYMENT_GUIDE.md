# 🚂 Railway Deployment Guide

**Date**: February 1, 2025
**Status**: Ready to Deploy

---

## ✅ GitHub Push Tamamlandı

**Repo**: https://github.com/alicanates/womens_wellness
**Branch**: chatbot
**Commit**: Production ready with environment setup

---

## 🚀 Railway Deployment - Adım Adım

### Adım 1: Railway Hesabı Aç (2 dakika)

1. **Git**: https://railway.app
2. **"Start a New Project"** veya **"Login"** tıkla
3. **"Login with GitHub"** seç
4. GitHub hesabınla giriş yap
5. Railway'e repo erişimi ver

### Adım 2: Yeni Project Oluştur (1 dakika)

Railway Dashboard'da:

1. **"New Project"** butonuna tıkla
2. **"Deploy from GitHub repo"** seç
3. **"womens_wellness"** repo'sunu seç
4. **Branch**: `chatbot` seç

### Adım 3: Service Ayarları (2 dakika)

Railway otomatik detect edecek ama kontrol et:

1. **Root Directory**: `apps/api` olmalı
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `npm run start`

Eğer otomatik algılamazsa, **Settings** → **Build** kısmından manuel ayarla.

### Adım 4: Environment Variables Ekle (5 dakika)

Railway Dashboard'da:

1. **Variables** sekmesine git
2. **"New Variable"** tıkla
3. **"Add variables"** seç

Şu değişkenleri **tek tek** ekle:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<ROTATED_DB_PASSWORD>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
REDIS_URL=redis://default:<ROTATED_REDIS_PASSWORD>@<UPSTASH_HOST>.upstash.io:6379
JWT_SECRET=<GENERATE_WITH_OPENSSL_RAND_HEX_32>
JWT_REFRESH_SECRET=<GENERATE_WITH_OPENSSL_RAND_HEX_32>
GOOGLE_GENERATIVE_AI_API_KEY=<ROTATED_GEMINI_API_KEY>
CORS_ORIGINS=*
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

**Not**: Her satırı ayrı variable olarak ekle!

### Adım 5: Deploy! (5 dakika)

1. **"Deploy"** butonuna tıkla
2. Build loglarını izle
3. Başarılı olursa **"Deployed"** yazacak
4. **Settings** → **Networking** → **Generate Domain** tıkla
5. Domain'i kopyala (örn: `wellness-api-production.up.railway.app`)

---

## 🧪 Deployment Test

Deploy tamamlandıktan sonra:

### 1. Health Check
```bash
curl https://YOUR-DOMAIN.railway.app/healthz
# Response: {"status":"ok"}
```

### 2. API Info
```bash
curl https://YOUR-DOMAIN.railway.app/
# Response: {"message":"Women's Wellness API","version":"1.0.0"}
```

### 3. Login Test
```bash
curl -X POST https://YOUR-DOMAIN.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@wellness.local","password":"admin123"}'
# Response: {"accessToken":"...","refreshToken":"..."}
```

---

## 📱 Mobile App Güncelleme

API deploy edildikten sonra:

### 1. API URL'i Güncelle

`apps/mobile/.env.production` dosyasını aç:

```bash
# Eski
EXPO_PUBLIC_API_URL=http://localhost:4000

# Yeni (Railway domain'inle değiştir)
EXPO_PUBLIC_API_URL=https://wellness-api-production.up.railway.app
```

### 2. Admin Panel Güncelleme

`apps/admin/.env.production` dosyasını aç:

```bash
# Eski
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Yeni (Railway domain'inle değiştir)
NEXT_PUBLIC_API_BASE_URL=https://wellness-api-production.up.railway.app
```

---

## 🔧 Railway Settings

### Custom Domain (Opsiyonel)

Kendi domain'in varsa:

1. **Settings** → **Networking** → **Custom Domain**
2. Domain ekle (örn: `api.yourapp.com`)
3. DNS ayarlarını yap (CNAME record)
4. SSL otomatik aktif olur

### Environment Variables Güncelleme

CORS için domain ekle:

```bash
# Eski
CORS_ORIGINS=*

# Yeni (production domain'lerinle)
CORS_ORIGINS=https://yourapp.com,https://admin.yourapp.com
```

---

## 💰 Railway Pricing

### Free Tier
- **$5 credit/month** (ücretsiz)
- **500 saat/month** execution time
- **100GB** network egress
- **1GB** memory
- **1 vCPU**

**Yeterli mi?**: Evet! MVP için fazlasıyla yeterli.

### Pro Plan ($20/month)
- **$20 credit/month**
- Unlimited execution time
- 100GB network egress
- 8GB memory
- 8 vCPU

**Ne zaman gerekli?**: 1000+ aktif kullanıcı

---

## 🐛 Troubleshooting

### Build Hatası

Eğer build başarısız olursa:

1. **Logs** sekmesine git
2. Hatayı oku
3. Genelde `package.json` veya `tsconfig.json` sorunu

**Çözüm**:
```bash
# Local'de test et
cd apps/api
npm run build

# Hata varsa düzelt
# Commit & push
git add .
git commit -m "Fix build error"
git push
```

Railway otomatik yeniden deploy eder.

### Runtime Hatası

Eğer deploy başarılı ama API çalışmıyorsa:

1. **Logs** → **Deploy Logs** kontrol et
2. Environment variables doğru mu?
3. Database bağlantısı çalışıyor mu?

**Test**:
```bash
# Database test
curl https://YOUR-DOMAIN.railway.app/healthz

# Eğer 500 error alırsan, logs'a bak
```

### CORS Hatası

Mobil app'ten API'ye istek atarken CORS hatası alırsan:

```bash
# Railway'de CORS_ORIGINS güncelle
CORS_ORIGINS=*

# Veya spesifik domain
CORS_ORIGINS=https://yourapp.com
```

---

## 📊 Monitoring

### Railway Dashboard

- **Metrics**: CPU, Memory, Network kullanımı
- **Logs**: Real-time application logs
- **Deployments**: Deployment history

### External Monitoring (Opsiyonel)

- **Sentry**: Error tracking
- **PostHog**: Analytics
- **UptimeRobot**: Uptime monitoring

---

## ✅ Deployment Checklist

- [ ] Railway hesabı açıldı
- [ ] GitHub repo bağlandı
- [ ] Environment variables eklendi
- [ ] Deploy başarılı
- [ ] Domain generate edildi
- [ ] Health check test edildi
- [ ] Login test edildi
- [ ] Mobile app URL'i güncellendi
- [ ] Admin panel URL'i güncellendi

---

## 🎯 Sonraki Adımlar

### 1. Mobile App Build
```bash
cd apps/mobile
# API URL'i güncelle
eas build --platform ios --profile production
eas build --platform android --profile production
```

### 2. Admin Panel Deploy
```bash
cd apps/admin
# API URL'i güncelle
vercel --prod
```

### 3. Legal Docs Yayınla
```bash
# GitHub Pages veya Vercel
# Privacy Policy, Terms, KVKK
```

---

## 📞 Yardım

### Railway Docs
- https://docs.railway.app

### Railway Discord
- https://discord.gg/railway

### Railway Status
- https://status.railway.app

---

**Hazırlayan**: Kiro AI Assistant
**Durum**: GitHub ✅ | Railway ⏳
**Sonraki**: Railway'de deploy et!

🚂 **Railway'e geçelim!** 🚀
