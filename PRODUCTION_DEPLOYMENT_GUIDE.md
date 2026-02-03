# 🚀 Production Deployment Guide - Kadın Atlası

**Tarih**: 3 Şubat 2026
**Durum**: Sunucu Temizlendi - Sıfırdan Kurulum Hazır

---

## 📊 Proje Durumu

### ✅ Tamamlanan Özellikler
- **Backend API**: NestJS + PostgreSQL + Redis
- **Mobile App**: Expo React Native (iOS/Android)
- **Admin Panel**: Next.js + Refine + Ant Design
- **AI Chat**: Google Gemini entegrasyonu
- **Q&A Community**: Soru-cevap platformu
- **Period Tracking**: Adet takibi ve tahmin
- **Water Tracking**: Su takibi
- **Reminders**: Hatırlatıcılar
- **Push Notifications**: Bildirimler
- **Subscription**: Abonelik sistemi (IAP hazır)

### ✅ Yeni Eklenen Admin Panel Özellikleri (2 Şubat 2026)
1. **AI Chat Analytics** - Sohbet metrikleri, popüler konular
2. **User Segmentation** - Kullanıcı segmentasyonu ve filtreleme
3. **Financial Dashboard** - MRR, churn rate, gelir analizi

### ⚠️ Bilinen TODO'lar (Kritik Değil)
- İngilizce çeviriler (şu an sadece Türkçe)
- Bazı admin özellikleri placeholder (notification gönderimi)
- Apple/Google webhook signature verification (mock data)
- Bazı metrikler hesaplanmıyor (avg session time, response time)

---

## 🏗️ Sunucu Durumu

### Mevcut Durum
- **IP**: 31.97.34.163
- **Domain**: kadinatlasi.com, admin.kadinatlasi.com
- **Disk**: %9 kullanım (44GB boş)
- **Docker**: Temizlendi
- **Proje**: Silindi

### Gereksinimler
- Docker & Docker Compose
- Git
- Node.js 20+ (Docker içinde)
- PostgreSQL (Supabase veya local)
- Redis (Upstash veya local)

---

## 🚀 Deployment Adımları

### 1. Environment Variables Hazırlığı

Önce local'de `.env.production` dosyalarını hazırla:

#### `apps/api/.env.production`
```bash
# Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Redis (Upstash)
REDIS_URL=redis://default:[PASSWORD]@[HOST].upstash.io:6379

# JWT Secrets (Generate with: openssl rand -hex 32)
JWT_SECRET=<your-secret-here>
JWT_REFRESH_SECRET=<your-secret-here>

# AI Provider (Gemini - Free tier)
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSyC...

# Google OAuth (Optional)
GOOGLE_OAUTH_CLIENT_ID_IOS=...
GOOGLE_OAUTH_CLIENT_ID_ANDROID=...
GOOGLE_OAUTH_CLIENT_ID_WEB=...

# Expo Push (Optional)
EXPO_ACCESS_TOKEN=...

# CORS
CORS_ORIGINS=https://kadinatlasi.com,https://admin.kadinatlasi.com

# Environment
NODE_ENV=production
PORT=4000
```

#### `apps/admin/.env.production`
```bash
NEXT_PUBLIC_API_BASE_URL=https://kadinatlasi.com
NODE_ENV=production
```

#### `apps/mobile/.env.production`
```bash
EXPO_PUBLIC_API_URL=https://kadinatlasi.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
```

### 2. Sunucuya Bağlan ve Proje Klonla

```bash
# Sunucuya bağlan
ssh root@31.97.34.163

# Proje dizinine git
cd /root

# Projeyi klonla
git clone https://github.com/meoacar/womens_wellness.git
cd womens_wellness

# Chatbot branch'ine geç
git checkout chatbot
```

### 3. Environment Dosyalarını Kopyala

```bash
# API
cp apps/api/.env.example apps/api/.env.production
nano apps/api/.env.production  # Düzenle

# Admin
cp apps/admin/.env.example apps/admin/.env.production
nano apps/admin/.env.production  # Düzenle

# Mobile (optional, build için gerekli)
cp apps/mobile/.env.example apps/mobile/.env.production
nano apps/mobile/.env.production  # Düzenle
```

### 4. Docker Compose ile Deploy

```bash
# Docker Compose dosyasını kontrol et
cat docker-compose.prod.yml

# Servisleri başlat (ilk kez - build yapacak)
docker-compose -f docker-compose.prod.yml up -d --build

# Logları takip et
docker-compose -f docker-compose.prod.yml logs -f

# Durum kontrol
docker-compose -f docker-compose.prod.yml ps
```

### 5. Database Migration

```bash
# API container'ına gir
docker exec -it wellness-api sh

# Migration çalıştır
cd apps/api
pnpm prisma migrate deploy

# Seed data (optional)
pnpm prisma db seed

# Çık
exit
```

### 6. Health Check

```bash
# API health check
curl http://localhost:4000/healthz

# Nginx üzerinden
curl http://kadinatlasi.com/healthz

# Admin panel
curl -I http://admin.kadinatlasi.com
```

---

## 🔧 Docker Compose Yapılandırması

### Servisler

1. **postgres** - PostgreSQL database (local)
2. **redis** - Redis cache (local)
3. **api** - NestJS API (port 4000)
4. **admin** - Next.js admin panel (port 3000)
5. **astrology** - Python astrology service (port 5000)
6. **nginx** - Reverse proxy (port 80, 443)

### Nginx Yapılandırması

- `kadinatlasi.com` → API (port 4000)
- `admin.kadinatlasi.com` → Admin Panel (port 3000)
- HTTP only (SSL sertifikaları sonra eklenecek)

---

## 📱 Mobile App Build

### Android APK

```bash
# Local'de
cd apps/mobile

# Development build
eas build --profile development --platform android

# Production build
eas build --profile production --platform android

# APK indir ve test et
```

### iOS IPA

```bash
# Local'de
cd apps/mobile

# Development build
eas build --profile development --platform ios

# Production build
eas build --profile production --platform ios

# TestFlight'a yükle
```

---

## 🔐 SSL Sertifikası (Let's Encrypt)

```bash
# Sunucuda
apt-get update
apt-get install certbot

# Nginx'i durdur
docker-compose -f docker-compose.prod.yml stop nginx

# Sertifika al
certbot certonly --standalone -d kadinatlasi.com -d admin.kadinatlasi.com

# Sertifikaları kopyala
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/kadinatlasi.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/kadinatlasi.com/privkey.pem nginx/ssl/

# docker-compose.prod.yml'de nginx config'i değiştir
# nginx-http.conf yerine nginx.conf kullan

# Nginx'i başlat
docker-compose -f docker-compose.prod.yml up -d nginx
```

---

## 🧪 Test Senaryoları

### API Test
```bash
# Health check
curl https://kadinatlasi.com/healthz

# Register
curl -X POST https://kadinatlasi.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","firstName":"Test","lastName":"User"}'

# Login
curl -X POST https://kadinatlasi.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

### Admin Panel Test
1. https://admin.kadinatlasi.com/login
2. Login: `admin@wellness.local` / `admin123`
3. Dashboard'u kontrol et
4. AI Analytics'i aç
5. User Segmentation'ı aç
6. Financial Dashboard'u aç

### Mobile App Test
1. APK'yı telefona yükle
2. Kayıt ol
3. Giriş yap
4. Su ekle
5. Adet döngüsü ekle
6. AI ile sohbet et
7. Hatırlatıcı oluştur
8. Push notification test et

---

## 📊 Monitoring

### Docker Logs
```bash
# Tüm loglar
docker-compose -f docker-compose.prod.yml logs -f

# Sadece API
docker-compose -f docker-compose.prod.yml logs -f api

# Sadece Admin
docker-compose -f docker-compose.prod.yml logs -f admin

# Sadece Nginx
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Resource Usage
```bash
# Container stats
docker stats

# Disk usage
df -h

# Docker disk usage
docker system df
```

### Database
```bash
# Supabase dashboard
https://app.supabase.com/project/[PROJECT]/editor

# Local PostgreSQL
docker exec -it wellness-db psql -U wellness -d wellness
```

---

## 🔄 Update Deployment

```bash
# Sunucuda
cd /root/womens_wellness

# Yeni kodu çek
git pull origin chatbot

# Rebuild ve restart
docker-compose -f docker-compose.prod.yml up -d --build

# Logları kontrol et
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 🆘 Troubleshooting

### Container Başlamıyor
```bash
# Logları kontrol et
docker-compose -f docker-compose.prod.yml logs api

# Container'ı yeniden başlat
docker-compose -f docker-compose.prod.yml restart api

# Container'ı sil ve yeniden oluştur
docker-compose -f docker-compose.prod.yml up -d --force-recreate api
```

### Database Bağlantı Hatası
```bash
# DATABASE_URL'i kontrol et
docker exec -it wellness-api env | grep DATABASE_URL

# PostgreSQL'e bağlan
docker exec -it wellness-db psql -U wellness -d wellness

# Migration durumunu kontrol et
docker exec -it wellness-api sh -c "cd apps/api && pnpm prisma migrate status"
```

### Nginx 502 Bad Gateway
```bash
# API çalışıyor mu?
docker ps | grep wellness-api

# API health check
curl http://localhost:4000/healthz

# Nginx config test
docker exec -it wellness-nginx nginx -t

# Nginx restart
docker-compose -f docker-compose.prod.yml restart nginx
```

### Disk Dolu
```bash
# Disk kullanımı
df -h

# Docker temizliği
docker system prune -a -f --volumes

# Log dosyalarını temizle
docker-compose -f docker-compose.prod.yml logs --tail=0 -f > /dev/null
```

---

## 📈 Performans Optimizasyonu

### Database
- Index'leri kontrol et
- Slow query'leri analiz et
- Connection pool ayarlarını optimize et

### Redis
- Cache hit rate'i kontrol et
- TTL ayarlarını optimize et
- Memory kullanımını izle

### API
- Response time'ları ölç
- N+1 query'leri düzelt
- Pagination ekle

### Nginx
- Gzip compression aktif
- Static file caching
- Rate limiting

---

## 💰 Maliyet Tahmini

### Minimum (Free Tier)
- Supabase: $0 (500MB, 2GB transfer)
- Upstash: $0 (10K commands/day)
- Gemini API: $0 (15 req/min)
- Sunucu: Mevcut (31.97.34.163)
- **Toplam**: $0/ay

### Starter (100-1000 kullanıcı)
- Supabase Pro: $25/ay
- Upstash: $5/ay
- Gemini API: $20/ay
- Sunucu: Mevcut
- **Toplam**: $50/ay

### Growth (1000-10000 kullanıcı)
- Database: $50/ay (DigitalOcean)
- Redis: $30/ay (AWS ElastiCache)
- AI: $100/ay (OpenAI + Claude)
- Sunucu: $50/ay (AWS ECS)
- CDN: $20/ay (Cloudflare)
- **Toplam**: $250/ay

---

## 🎯 Sonraki Adımlar

### Bugün
1. [ ] Environment variables hazırla
2. [ ] Sunucuya deploy et
3. [ ] Health check yap
4. [ ] Admin panel test et

### Bu Hafta
1. [ ] SSL sertifikası ekle
2. [ ] Mobile app build yap
3. [ ] Test kullanıcılarıyla test et
4. [ ] Bug fix'ler

### Gelecek Hafta
1. [ ] Google Play'e yükle
2. [ ] App Store'a yükle
3. [ ] Beta test başlat
4. [ ] Feedback topla

---

## 📞 Destek

### Dokümantasyon
- `README.md` - Genel proje bilgisi
- `ADMIN_PANEL_ROADMAP.md` - Admin panel özellikleri
- `ADMIN_PANEL_FEATURES_COMPLETE.md` - Yeni özellikler
- `READY_FOR_PRODUCTION.md` - Production checklist

### Linkler
- **GitHub**: https://github.com/meoacar/womens_wellness
- **Supabase**: https://app.supabase.com
- **Upstash**: https://console.upstash.com
- **Expo**: https://expo.dev

---

**Hazırlayan**: Kiro AI Assistant
**Tarih**: 3 Şubat 2026
**Durum**: Deployment'a hazır! 🚀
