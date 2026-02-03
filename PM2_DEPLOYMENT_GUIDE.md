# 🚀 PM2 Deployment Guide - Docker'sız Kurulum

**Tarih**: 3 Şubat 2026
**Sunucu**: 31.97.34.163
**Domain**: kadinatlasi.com, admin.kadinatlasi.com

---

## 📋 Gereksinimler

- Node.js 20+
- pnpm
- PM2
- Nginx
- PostgreSQL (Supabase)
- Redis (Upstash)

---

## 🔧 Adım 1: Sunucuya Bağlan ve Hazırlık

```bash
# Sunucuya bağlan
ssh root@31.97.34.163

# Node.js 20 kur (eğer yoksa)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# pnpm kur
npm install -g pnpm

# PM2 kur
npm install -g pm2

# Nginx kur (zaten var olabilir)
apt-get install -y nginx

# Versiyonları kontrol et
node --version  # v20.x.x
pnpm --version  # 10.x.x
pm2 --version   # 5.x.x
```

---

## 📦 Adım 2: Projeyi Klonla ve Kur

```bash
# Proje dizinine git
cd /root

# Projeyi klonla (eğer yoksa)
git clone https://github.com/meoacar/womens_wellness.git
cd womens_wellness

# Chatbot branch'ine geç
git checkout chatbot

# Dependencies kur
pnpm install
```

---

## 🔐 Adım 3: Environment Variables

### API Environment (.env.production)

```bash
# API env dosyası oluştur
cat > apps/api/.env.production << 'EOF'
# Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Redis (Upstash)
REDIS_URL=redis://default:[PASSWORD]@[HOST].upstash.io:6379

# JWT Secrets (Generate with: openssl rand -hex 32)
JWT_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here

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
EOF

# Dosyayı düzenle
nano apps/api/.env.production
```

### Admin Environment (.env.production)

```bash
# Admin env dosyası oluştur
cat > apps/admin/.env.production << 'EOF'
NEXT_PUBLIC_API_BASE_URL=https://kadinatlasi.com
NODE_ENV=production
EOF
```

---

## 🏗️ Adım 4: Build

```bash
# Tüm projeyi build et
pnpm build

# Build sonuçlarını kontrol et
ls -la apps/api/dist/
ls -la apps/admin/.next/
```

---

## 🗄️ Adım 5: Database Migration

```bash
# API dizinine git
cd apps/api

# Migration çalıştır
pnpm prisma migrate deploy

# Seed data (optional)
pnpm prisma db seed

# Geri dön
cd ../..
```

---

## 🚀 Adım 6: PM2 ile Başlat

### PM2 Ecosystem Dosyası Oluştur

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'api',
      script: './apps/api/dist/main.js',
      cwd: '/root/womens_wellness',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      env_file: './apps/api/.env.production',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
    },
    {
      name: 'admin',
      script: './apps/admin/.next/standalone/apps/admin/server.js',
      cwd: '/root/womens_wellness',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      error_file: './logs/admin-error.log',
      out_file: './logs/admin-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '300M',
    },
  ],
};
EOF
```

### Log Klasörü Oluştur

```bash
mkdir -p logs
```

### PM2 ile Başlat

```bash
# Uygulamaları başlat
pm2 start ecosystem.config.js

# Durumu kontrol et
pm2 status

# Logları izle
pm2 logs

# Detaylı bilgi
pm2 info api
pm2 info admin
```

### PM2 Startup (Otomatik Başlatma)

```bash
# Sistem başlangıcında otomatik başlat
pm2 startup systemd

# Mevcut durumu kaydet
pm2 save
```

---

## 🌐 Adım 7: Nginx Yapılandırması

### Nginx Config Oluştur

```bash
cat > /etc/nginx/sites-available/kadinatlasi << 'EOF'
# API Server
server {
    listen 80;
    server_name kadinatlasi.com www.kadinatlasi.com;

    client_max_body_size 20M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Admin Panel
server {
    listen 80;
    server_name admin.kadinatlasi.com;

    client_max_body_size 20M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

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
EOF

# Symlink oluştur
ln -sf /etc/nginx/sites-available/kadinatlasi /etc/nginx/sites-enabled/

# Default config'i kaldır (eğer varsa)
rm -f /etc/nginx/sites-enabled/default

# Nginx config test
nginx -t

# Nginx restart
systemctl restart nginx
systemctl status nginx
```

---

## ✅ Adım 8: Test

### Health Check

```bash
# API test
curl http://localhost:4000/healthz
curl http://kadinatlasi.com/healthz

# Admin test
curl -I http://localhost:3000
curl -I http://admin.kadinatlasi.com
```

### PM2 Monitoring

```bash
# Gerçek zamanlı monitoring
pm2 monit

# CPU ve Memory kullanımı
pm2 list

# Logları izle
pm2 logs --lines 50
```

---

## 🔄 Güncelleme (Update)

```bash
# Sunucuda
cd /root/womens_wellness

# Yeni kodu çek
git pull origin chatbot

# Dependencies güncelle (eğer gerekirse)
pnpm install

# Rebuild
pnpm build

# Database migration (eğer varsa)
cd apps/api
pnpm prisma migrate deploy
cd ../..

# PM2 restart
pm2 restart all

# Logları kontrol et
pm2 logs --lines 50
```

---

## 🛠️ PM2 Komutları

### Temel Komutlar

```bash
# Tüm uygulamaları listele
pm2 list

# Belirli bir uygulamayı restart
pm2 restart api
pm2 restart admin

# Tüm uygulamaları restart
pm2 restart all

# Belirli bir uygulamayı durdur
pm2 stop api

# Belirli bir uygulamayı sil
pm2 delete api

# Logları temizle
pm2 flush

# Monitoring
pm2 monit

# Detaylı bilgi
pm2 info api
```

### Log Komutları

```bash
# Tüm logları izle
pm2 logs

# Belirli bir uygulamanın logları
pm2 logs api

# Son 100 satır
pm2 logs --lines 100

# Hataları filtrele
pm2 logs --err

# Log dosyalarını temizle
pm2 flush
```

---

## 🔐 SSL Sertifikası (Let's Encrypt)

```bash
# Certbot kur
apt-get install -y certbot python3-certbot-nginx

# Sertifika al (Nginx otomatik yapılandırır)
certbot --nginx -d kadinatlasi.com -d www.kadinatlasi.com -d admin.kadinatlasi.com

# Otomatik yenileme test
certbot renew --dry-run

# Cron job zaten var (certbot kurulumunda eklenir)
```

---

## 📊 Monitoring ve Logs

### PM2 Plus (Optional - Web Dashboard)

```bash
# PM2 Plus hesabı aç: pm2.io
# Keystone al

# PM2'yi bağla
pm2 link [secret-key] [public-key]

# Web dashboard'dan izle: app.pm2.io
```

### Log Rotation

```bash
# PM2 log rotation modülü kur
pm2 install pm2-logrotate

# Ayarları yapılandır
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

---

## 🆘 Troubleshooting

### Uygulama Başlamıyor

```bash
# Logları kontrol et
pm2 logs api --lines 100

# Environment variables kontrol et
pm2 env api

# Manuel başlat (debug için)
cd apps/api
node dist/main.js
```

### Port Zaten Kullanımda

```bash
# Port'u kullanan process'i bul
lsof -i :4000
lsof -i :3000

# Process'i öldür
kill -9 [PID]

# PM2 restart
pm2 restart all
```

### Memory Leak

```bash
# Memory kullanımını izle
pm2 monit

# Otomatik restart (ecosystem.config.js'de zaten var)
max_memory_restart: '500M'

# Manuel restart
pm2 restart api
```

### Database Bağlantı Hatası

```bash
# DATABASE_URL kontrol et
cat apps/api/.env.production | grep DATABASE_URL

# Prisma client regenerate
cd apps/api
pnpm prisma generate
cd ../..

# PM2 restart
pm2 restart api
```

---

## 📈 Performance Optimization

### PM2 Cluster Mode

```bash
# ecosystem.config.js'de zaten cluster mode aktif
instances: 1,  # CPU core sayısına göre artır
exec_mode: 'cluster',
```

### Nginx Caching

```bash
# /etc/nginx/sites-available/kadinatlasi'ye ekle
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m;

location / {
    proxy_cache my_cache;
    proxy_cache_valid 200 60m;
    proxy_cache_use_stale error timeout http_500 http_502 http_503 http_504;
    # ... diğer proxy ayarları
}
```

---

## 💰 Resource Usage

### Beklenen Kullanım

- **API**: ~200-300MB RAM
- **Admin**: ~150-200MB RAM
- **Nginx**: ~10-20MB RAM
- **Toplam**: ~400-550MB RAM

### Monitoring

```bash
# System resources
htop

# PM2 resources
pm2 list

# Disk usage
df -h

# Memory usage
free -h
```

---

## 🎯 Avantajlar (Docker'a Göre)

✅ **Daha Hızlı**
- Build süresi: ~2 dakika (Docker: ~10 dakika)
- Restart süresi: ~2 saniye (Docker: ~30 saniye)

✅ **Daha Az Kaynak**
- RAM: ~500MB (Docker: ~2GB)
- Disk: ~1GB (Docker: ~5GB)

✅ **Daha Kolay Debug**
- Direkt log dosyaları
- Direkt process access
- Daha az abstraction

✅ **Daha Stabil**
- Container crash yok
- Network issue yok
- Volume mount issue yok

---

## 📝 Checklist

### İlk Kurulum
- [ ] Node.js 20 kuruldu
- [ ] pnpm kuruldu
- [ ] PM2 kuruldu
- [ ] Proje klonlandı
- [ ] Dependencies kuruldu
- [ ] Environment variables ayarlandı
- [ ] Build yapıldı
- [ ] Database migration çalıştırıldı
- [ ] PM2 ile başlatıldı
- [ ] Nginx yapılandırıldı
- [ ] SSL sertifikası alındı
- [ ] Health check başarılı

### Her Güncelleme
- [ ] Git pull
- [ ] pnpm install (eğer gerekirse)
- [ ] pnpm build
- [ ] Database migration (eğer varsa)
- [ ] pm2 restart all
- [ ] Logları kontrol et
- [ ] Health check

---

**Hazırlayan**: Kiro AI Assistant
**Tarih**: 3 Şubat 2026
**Durum**: Production'a hazır! 🚀

**Not**: Docker'dan çok daha basit ve hızlı! 🎉
