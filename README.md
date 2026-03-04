# Hikvision FaceID Monitoring Tizimi

Hikvision kameralaridan real vaqtda keldi/ketti ma'lumotlarini qayd etish, davomat hisoboti va guruh boshqaruvi uchun professional monitoring tizimi.

## Kirish ma'lumotlari (demo)

| Rol | Login | Parol |
|-----|-------|-------|
| **Sudo** | `sudo` | `sudo1234` |
| **Admin (Ofis)** | `admin_ofis` | `admin1234` |
| **Admin (Ombor)** | `admin_ombor` | `admin5678` |
| **Ishchi** | `ali_v` | `worker1234` |

## Imkoniyatlar

- **Real-time kuzatuv**: WebSocket orqali jonli keldi/ketti hodisalari
- **Rol asosida kirish**: sudo (to'liq) / admin (tayinlangan guruhlar) / ishchi (o'z ma'lumotlari)
- **Guruh boshqaruvi**: Sudo guruh yaratadi, adminlarni biriktiradi
- **Yagona sessiya**: Boshqa qurilmadan kirilsa, eski sessiya bekor qilinadi
- **Takrorlanmaslik**: Kunlik birinchi kirish/chiqish alohida belgilanadi
- **2 smena tizimi**: Har guruh uchun kungi/tungi smena
- **Dam olish kunlari**: Admin tomonidan boshqariladi, hisobotda ko'rinadi
- **Davomat hisoboti**: Sana bo'yicha chop etish/PDF
- **PWA**: Mobil qurilmaga o'rnatish imkoni
- **Kamera qo'llanmasi**: Bosqichma-bosqich ulash ko'rsatmasi

---

## Hikvision kamerani ulash

Kamera quyidagi formatda `POST /api/events` manziliga so'rov yuborishi kerak:

```json
{
  "device_id": "kirish_eshigi",
  "user_id": "1234",
  "event_type": "enter",
  "timestamp": "2024-01-15T08:30:00"
}
```

| Maydon | Tavsif |
|--------|--------|
| `device_id` | Kamera identifikatori (ixtiyoriy nom) |
| `user_id` | FaceID tizimidagi xodim raqami |
| `event_type` | `enter` yoki `exit` |
| `timestamp` | ISO 8601 format (ixtiyoriy) |

**Test uchun:**
```bash
curl -X POST https://sizning-domen.uz/api/events \
  -H "Content-Type: application/json" \
  -d '{"device_id":"hikvision_1","user_id":"1001","event_type":"enter"}'
```

---

## aPanel bilan o'rnatish

### 1. Server tayyorlash (Ubuntu 22.04)

```bash
apt update && apt upgrade -y

# Node.js 20 o'rnatish
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Tekshirish
node --version   # v20.x.x
npm --version    # 10.x.x
```

### 2. PostgreSQL o'rnatish

```bash
apt install -y postgresql postgresql-contrib
systemctl start postgresql && systemctl enable postgresql

# Baza va foydalanuvchi yaratish
sudo -u postgres psql << 'SQL'
CREATE USER hikvision WITH PASSWORD 'kuchli_parol';
CREATE DATABASE hikvision_db OWNER hikvision;
GRANT ALL PRIVILEGES ON DATABASE hikvision_db TO hikvision;
SQL
```

### 3. Ilovani yuklash

```bash
mkdir -p /var/www/hikvision
cd /var/www/hikvision

# Git orqali
git clone https://github.com/sizning-repo/hikvision .

# Yoki ZIP fayl orqali
# unzip hikvision.zip -d /var/www/hikvision/
```

### 4. O'rnatish

```bash
cd /var/www/hikvision
npm install
npm run build
```

### 5. Muhit o'zgaruvchilari

```bash
cat > /var/www/hikvision/.env << 'ENV'
DATABASE_URL=postgresql://hikvision:kuchli_parol@localhost:5432/hikvision_db
SESSION_SECRET=eng_kamida_32_belgidan_iborat_maxfiy_kalit
NODE_ENV=production
PORT=5000
ENV

chmod 600 /var/www/hikvision/.env
```

### 6. Ma'lumotlar bazasini sozlash

```bash
cd /var/www/hikvision
npm run db:push
```

### 7. PM2 bilan boshqarish

```bash
npm install -g pm2

cd /var/www/hikvision
pm2 start dist/index.js --name hikvision

# Tizim yuklanganda avtomatik ishga tushirish
pm2 startup
pm2 save

# Holat tekshirish
pm2 status
pm2 logs hikvision
```

### 8. Nginx reverse proxy

```bash
apt install -y nginx

cat > /etc/nginx/sites-available/hikvision << 'NGINX'
server {
    listen 80;
    server_name sizning-domen.uz www.sizning-domen.uz;

    # WebSocket uchun (real-time hodisalar)
    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
NGINX

ln -s /etc/nginx/sites-available/hikvision /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 9. SSL sertifikat (HTTPS)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d sizning-domen.uz -d www.sizning-domen.uz

# Avtomatik yangilash
systemctl enable certbot.timer
```

---

## Docker bilan o'rnatish

```bash
# Docker o'rnatish
curl -fsSL https://get.docker.com | bash
apt install -y docker-compose-plugin

# Loyihani yuklash
git clone https://github.com/sizning-repo/hikvision
cd hikvision

# Muhit sozlamalari
cp .env.example .env
nano .env   # DATABASE_URL va SESSION_SECRET ni o'zgartiring

# Ishga tushirish
docker compose up -d

# Bazani sozlash
docker compose exec app npm run db:push

# Loglar
docker compose logs -f
```

**docker-compose.yml namunasi:**
```yaml
version: '3.8'
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: hikvision
      POSTGRES_PASSWORD: kuchli_parol
      POSTGRES_DB: hikvision_db
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: postgresql://hikvision:kuchli_parol@db:5432/hikvision_db
      SESSION_SECRET: maxfiy_kalit
      NODE_ENV: production
    depends_on:
      - db

volumes:
  pgdata:
```

---

## Xodim qo'shish tartibi

1. Hikvision qurilmasiga xodim yuzini va **user_id** raqamini kiriting (masalan: `1001`)
2. Tizimga **admin** sifatida kiring
3. **Ishchilar** sahifasiga o'ting → "Xodim qo'shish" tugmasini bosing
4. `FaceID raqami: 1001`, `To'liq ismi: Xodim Ismi`ni kiriting
5. Kerakli guruhni tanlang va saqlang
6. Endi qurilmadan o'tganda xodim ismi hisobotda ko'rinadi

---

## Yangilash

```bash
cd /var/www/hikvision
git pull
npm install
npm run build
npm run db:push   # Agar schema o'zgargan bo'lsa
pm2 restart hikvision
```

---

## Muammolarni hal qilish

**Ilova ishlamayapti:**
```bash
pm2 logs hikvision --lines 100
```

**Baza ulanishi yo'q:**
```bash
psql $DATABASE_URL -c "SELECT 1"
```

**Port band:**
```bash
lsof -i :5000
kill -9 $(lsof -ti:5000)
```

**Nginx xatosi:**
```bash
nginx -t
tail -f /var/log/nginx/error.log
```

**Sessiya muammosi (kirish imkoni yo'q):**
```bash
# Barcha sessiyalarni tozalash
psql $DATABASE_URL -c "DELETE FROM session; DELETE FROM user_sessions;"
pm2 restart hikvision
```
