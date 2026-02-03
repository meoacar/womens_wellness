# 🎨 Admin Panel Deployment - Next.js Standalone

**Framework**: Next.js 14 + Refine + Ant Design
**Build Mode**: Standalone (Self-contained)
**Runtime**: Node.js 20

---

## 📦 Next.js Standalone Nedir?

Next.js'in **standalone** modu, uygulamanızı tek bir klasörde, tüm bağımlılıklarıyla birlikte paketler. Docker'a gerek kalmadan çalıştırabilirsiniz.

### Avantajları:
- ✅ Tüm dependencies dahil
- ✅ Küçük boyut (~50MB)
- ✅ Hızlı başlatma
- ✅ PM2 ile uyumlu
- ✅ Docker'a gerek yok

---

## 🏗️ Build Süreci

### 1. Next.js Config (Zaten Yapıldı)

```javascript
// apps/admin/next.config.js
module.exports = {
  output: 'standalone', // Bu satır önemli!
  // ... diğer ayarlar
}
```

### 2. Build Komutu

```bash
# Monorepo root'tan
pnpm build

# Veya sadece admin
cd apps/admin
pnpm build
```

### 3. Build Çıktısı

Build sonrası şu klasör yapısı oluşur:

```
apps/admin/
├── .next/
│   ├── standalone/          # ← Standalone build (PM2 için)
│   │   ├── apps/
│   │   │   └── admin/
│   │   │       ├── server.js    # ← Ana server dosyası
│   │   │       └── package.json
│   │   ├── node_modules/    # Sadece gerekli dependencies
│   │   └── package.json
│   ├── static/              # Static assets
│   └── ...
└── public/                  # Public files
```

---

## 🚀 PM2 ile Çalıştırma

### Standalone Server Nasıl Çalışır?

```bash
# Standalone server'ı direkt çalıştır
node apps/admin/.next/standalone/apps/admin/server.js

# Port ve hostname belirt
PORT=3000 HOSTNAME=0.0.0.0 node apps/admin/.next/standalone/apps/admin/server.js
```

### PM2 Ecosystem Config

```javascript
// ecosystem.config.js
{
  name: 'admin',
  script: './apps/admin/.next/standalone/apps/admin/server.js',
  cwd: '/root/womens_wellness',
  env: {
    NODE_ENV: 'production',
    PORT: 3000,
    HOSTNAME: '0.0.0.0',
    NEXT_PUBLIC_API_BASE_URL: 'https://kadinatlasi.com',
  },
}
```

### PM2 Komutları

```bash
# Başlat
pm2 start ecosystem.config.js --only admin

# Restart
pm2 restart admin

# Logları izle
pm2 logs admin

# Durum
pm2 info admin
```

---

## 📁 Static Files

Standalone build, static ve public dosyaları otomatik kopyalamaz. Manuel kopyalamamız gerekiyor:

### Build Sonrası Kopyalama

```bash
# Public files
cp -r apps/admin/public apps/admin/.next/standalone/apps/admin/

# Static files
cp -r apps/admin/.next/static apps/admin/.next/standalone/apps/admin/.next/
```

### Otomatik Script

```bash
# build-admin.sh
#!/bin/bash

echo "Building admin panel..."
cd apps/admin
pnpm build

echo "Copying static files..."
cp -r public .next/standalone/apps/admin/
cp -r .next/static .next/standalone/apps/admin/.next/

echo "Admin panel build complete!"
```

---

## 🌐 Nginx Yapılandırması

### Admin Panel için Nginx Config

```nginx
# /etc/nginx/sites-available/kadinatlasi

server {
    listen 80;
    server_name admin.kadinatlasi.com;

    # Static files (Next.js)
    location /_next/static/ {
        alias /root/womens_wellness/apps/admin/.next/static/;
        expires 1y;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    # Public files
    location /public/ {
        alias /root/womens_wellness/apps/admin/public/;
        expires 1y;
        access_log off;
    }

    # Proxy to Next.js server
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔧 Environment Variables

### Build Time vs Runtime

Next.js'te iki tür environment variable var:

#### 1. Build Time (NEXT_PUBLIC_*)
```bash
# Build sırasında kodun içine gömülür
NEXT_PUBLIC_API_BASE_URL=https://kadinatlasi.com
```

**Önemli**: Build sonrası değiştirilemez!

#### 2. Runtime (Server-side)
```bash
# Server çalışırken okunur
DATABASE_URL=...
API_KEY=...
```

### Production Build için

```bash
# Build öncesi
export NEXT_PUBLIC_API_BASE_URL=https://kadinatlasi.com
pnpm build

# Veya .env.production dosyası
cat > apps/admin/.env.production << EOF
NEXT_PUBLIC_API_BASE_URL=https://kadinatlasi.com
NODE_ENV=production
EOF
```

---

## 📊 Admin Panel Özellikleri

### Mevcut Sayfalar

1. **Dashboard** (`/`)
   - Genel istatistikler
   - Kullanıcı, abonelik, engagement metrikleri
   - Grafik ve chart'lar

2. **AI Analytics** (`/ai-analytics`)
   - En çok sorulan sorular
   - Popüler konular
   - Sohbet trendleri
   - Kullanıcı engagement

3. **User Segmentation** (`/user-segmentation`)
   - Predefined segmentler
   - Özel filtreler
   - Kullanıcı listesi
   - Toplu işlemler (UI)

4. **Financial Dashboard** (`/financial-dashboard`)
   - MRR (Monthly Recurring Revenue)
   - Churn rate
   - Gelir trendleri
   - Abonelik metrikleri

5. **Users** (`/users`)
   - Kullanıcı listesi
   - Profil görüntüleme
   - Durum değiştirme

6. **Model Policies** (`/model-policies`)
   - AI model yapılandırması
   - Plan bazlı ayarlar

7. **Feature Flags** (`/feature-flags`)
   - Özellik açma/kapama
   - Kill switch'ler

8. **Quotas** (`/quotas`)
   - Kullanıcı kotaları
   - Kullanım istatistikleri

9. **Reminders** (`/reminders`)
   - Hatırlatıcı listesi
   - Zamanlama bilgileri

10. **Audit Logs** (`/audit-logs`)
    - Admin işlem geçmişi
    - Güvenlik takibi

11. **Q&A Management** (`/qna`)
    - Soru-cevap moderasyonu
    - İçerik yönetimi

### Login

```
URL: https://admin.kadinatlasi.com/login
Email: admin@wellness.local
Password: admin123
```

---

## 🎨 UI/UX

### Ant Design Components

Admin panel Ant Design 5.x kullanıyor:

- **Layout**: Sidebar + Header
- **Tables**: Filtreleme, sıralama, pagination
- **Forms**: Validation, error handling
- **Charts**: @ant-design/charts (G2Plot)
- **Icons**: @ant-design/icons

### Responsive Design

- ✅ Desktop (1920x1080)
- ✅ Laptop (1366x768)
- ✅ Tablet (768x1024)
- ⚠️ Mobile (kısmen - admin panel için optimize değil)

---

## 🔐 Authentication

### JWT Token Flow

1. Login → API'ye POST `/auth/login`
2. API → JWT token döner
3. Token → localStorage'a kaydedilir
4. Her istek → `Authorization: Bearer <token>` header'ı

### Refine Auth Provider

```typescript
// apps/admin/src/providers/authProvider.ts
export const authProvider = {
  login: async ({ email, password }) => {
    // API'ye login isteği
    const response = await axios.post('/auth/login', { email, password });
    localStorage.setItem('token', response.data.accessToken);
    return { success: true };
  },
  logout: async () => {
    localStorage.removeItem('token');
    return { success: true };
  },
  check: async () => {
    const token = localStorage.getItem('token');
    return { authenticated: !!token };
  },
  // ...
};
```

---

## 📈 Performance

### Build Boyutu

```
Admin Panel Build:
- Standalone: ~50MB
- Static files: ~5MB
- Total: ~55MB
```

### Runtime Performance

- **Cold start**: ~2 saniye
- **Hot reload**: ~500ms
- **Memory**: ~150-200MB
- **CPU**: ~5-10% (idle)

### Optimization

```javascript
// next.config.js
{
  swcMinify: true,           // SWC minification
  compress: true,            // Gzip compression
  poweredByHeader: false,    // Security
  generateEtags: true,       // Caching
}
```

---

## 🧪 Test

### Local Test

```bash
# Build
pnpm build

# Test standalone
cd apps/admin/.next/standalone
PORT=3000 node apps/admin/server.js

# Browser'da aç
open http://localhost:3000
```

### Production Test

```bash
# Sunucuda
pm2 logs admin

# Browser'da
https://admin.kadinatlasi.com

# Health check
curl -I https://admin.kadinatlasi.com
```

---

## 🔄 Update Workflow

### Kod Değişikliği Sonrası

```bash
# 1. Local'de test et
pnpm dev:admin

# 2. Commit ve push
git add .
git commit -m "feat: admin panel update"
git push origin chatbot

# 3. Sunucuda pull
ssh root@31.97.34.163
cd /root/womens_wellness
git pull origin chatbot

# 4. Rebuild
pnpm build

# 5. Static files kopyala
cd apps/admin
cp -r public .next/standalone/apps/admin/
cp -r .next/static .next/standalone/apps/admin/.next/
cd ../..

# 6. PM2 restart
pm2 restart admin

# 7. Test
curl -I https://admin.kadinatlasi.com
```

---

## 🆘 Troubleshooting

### Admin Panel Açılmıyor

```bash
# PM2 durumu
pm2 status admin

# Logları kontrol et
pm2 logs admin --lines 100

# Port kontrolü
lsof -i :3000

# Manuel başlat (debug)
cd apps/admin/.next/standalone
PORT=3000 node apps/admin/server.js
```

### Static Files Yüklenmiyor

```bash
# Static files var mı?
ls -la apps/admin/.next/standalone/apps/admin/public/
ls -la apps/admin/.next/standalone/apps/admin/.next/static/

# Nginx config test
nginx -t

# Nginx restart
systemctl restart nginx
```

### API Bağlantı Hatası

```bash
# Environment variable kontrol
pm2 env admin | grep NEXT_PUBLIC_API_BASE_URL

# API çalışıyor mu?
curl https://kadinatlasi.com/healthz

# CORS ayarları
# API'de CORS_ORIGINS'e admin domain'i ekle
```

### Build Hatası

```bash
# Dependencies temizle
rm -rf node_modules apps/admin/node_modules
pnpm install

# Cache temizle
rm -rf apps/admin/.next

# Rebuild
pnpm build
```

---

## 💡 Best Practices

### 1. Environment Variables

```bash
# Build time variables (.env.production)
NEXT_PUBLIC_API_BASE_URL=https://kadinatlasi.com

# Runtime variables (PM2 ecosystem)
NODE_ENV=production
PORT=3000
```

### 2. Static Files

```bash
# Her build sonrası kopyala
cp -r apps/admin/public apps/admin/.next/standalone/apps/admin/
cp -r apps/admin/.next/static apps/admin/.next/standalone/apps/admin/.next/
```

### 3. PM2 Monitoring

```bash
# Düzenli kontrol
pm2 monit

# Log rotation
pm2 install pm2-logrotate
```

### 4. Nginx Caching

```nginx
# Static files için aggressive caching
location /_next/static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## 📚 Kaynaklar

- [Next.js Standalone](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [Refine Documentation](https://refine.dev/docs/)
- [Ant Design](https://ant.design/)
- [PM2 Documentation](https://pm2.keymetrics.io/)

---

**Özet**: Admin panel Next.js standalone mode ile build edilir, PM2 ile çalıştırılır, Nginx ile serve edilir. Docker'a gerek yok! 🎉

**Hazırlayan**: Kiro AI Assistant
**Tarih**: 3 Şubat 2026
