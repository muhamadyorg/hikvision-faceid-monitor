# Hikvision FaceID Monitoring Tizimi

Hikvision kameralaridan real vaqtda keldi/ketti ma'lumotlarini qayd etish, davomat hisoboti va guruh boshqaruvi uchun professional monitoring tizimi (Uzbek tilida).

**GitHub:** https://github.com/muhamadyorg/hikvision-faceid-monitor

---

## Kirish ma'lumotlari

Birinchi marta ishga tushirishdan oldin `.env` faylida quyidagi o'zgaruvchilarni o'rnating:

```env
SUDO_PASSWORD=kuchli_parol_bu_yerga
ADMIN1_PASSWORD=admin_ofis_paroli
ADMIN2_PASSWORD=admin_ombor_paroli
WORKER_PASSWORD=ishchilar_paroli
```

| Rol | Login | Parol |
|-----|-------|-------|
| **Sudo** | `sudo` | `.env` → `SUDO_PASSWORD` |
| **Admin (Ofis)** | `admin_ofis` | `.env` → `ADMIN1_PASSWORD` |
| **Admin (Ombor)** | `admin_ombor` | `.env` → `ADMIN2_PASSWORD` |
| **Ishchi** | `ali_v` va boshqalar | `.env` → `WORKER_PASSWORD` |

> Parollarni `.env` da o'rnatmasangiz, standart `changeme_*` parollar ishlatiladi — ularni **albatta** o'zgartiring!

---

## Imkoniyatlar

- Real-time keldi/ketti kuzatuvi (WebSocket)
- Rol asosida kirish: sudo / admin / ishchi
- Guruh va smena boshqaruvi
- Takrorlanmaslik: kunlik birinchi kirish/chiqish alohida belgilanadi
- Dam olish kunlari boshqaruvi
- Davomat hisoboti (chop etish/PDF)
- PWA — mobil qurilmaga o'rnatish
- Yagona sessiya: boshqa qurilmadan kirilsa, eski sessiya o'chiriladi

---

## Hikvision kamerani ulash

Kamera `POST /api/events` manziliga quyidagi formatda so'rov yuborishi kerak:

```json
{
  "device_id": "kirish_eshigi",
  "user_id": "1001",
  "event_type": "enter",
  "timestamp": "2024-01-15T08:30:00"
}
```

| Maydon | Tavsif |
|--------|--------|
| `device_id` | Kamera identifikatori |
| `user_id` | Hikvision FaceID tizimidagi xodim ID raqami |
| `event_type` | `enter` yoki `exit` |
| `timestamp` | ISO 8601 (ixtiyoriy) |

---

## aPanel + Docker bilan VPS ga joylash

### Umumiy ko'rinish

```
Internet → Nginx (80/443) → Docker container (port 5000)
                                    ↓
                             PostgreSQL (port 5432)
```

---

### 1-qadam: VPS serverda Docker o'rnatish

**Ubuntu 22.04 / Debian 12 uchun:**

```bash
# Tizimni yangilash
apt update && apt upgrade -y

# Docker o'rnatish (eng oson usul)
curl -fsSL https://get.docker.com | bash

# Docker Compose o'rnatish
apt install -y docker-compose-plugin

# Docker ishga tushganini tekshirish
docker --version
docker compose version
```

---

### 2-qadam: Kodni serverga yuklash

```bash
# Git o'rnatish
apt install -y git

# Papka yaratish
mkdir -p /opt/hikvision
cd /opt/hikvision

# GitHub dan yuklash
git clone https://github.com/muhamadyorg/hikvision-faceid-monitor .
```

---

### 3-qadam: Muhit o'zgaruvchilarini sozlash

```bash
cd /opt/hikvision

# .env fayl yaratish (.env.example dan nusxa)
cp .env.example .env

# Faylni tahrirlash
nano .env
```

`.env` fayl ichida quyidagilarni o'zgartiring:

```env
DATABASE_URL=postgresql://hikvision:KUCHLI_PAROL_BU_YERGA@db:5432/hikvision_db
SESSION_SECRET=KAMIDA_32_BELGILI_TASODIFIY_KALIT_BU_YERGA
NODE_ENV=production
PORT=5000
```

> **Muhim:** `KUCHLI_PAROL_BU_YERGA` o'rniga haqiqiy kuchli parol yozing. `SESSION_SECRET` uchun kamida 32 ta tasodifiy belgi ishlating.

Tasodifiy kalit yaratish:
```bash
openssl rand -base64 32
```

---

### 4-qadam: docker-compose.yml ni sozlash

`docker-compose.yml` faylini oching va `POSTGRES_PASSWORD` va `DATABASE_URL` ni `.env` dagi parol bilan moslashtiring:

```bash
nano docker-compose.yml
```

```yaml
version: "3.8"

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: hikvision_db
      POSTGRES_USER: hikvision
      POSTGRES_PASSWORD: KUCHLI_PAROL_BU_YERGA    # .env dagi bilan bir xil!
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hikvision -d hikvision_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    ports:
      - "5000:5000"
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://hikvision:KUCHLI_PAROL_BU_YERGA@db:5432/hikvision_db
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
```

---

### 5-qadam: Docker image yaratish va ishga tushirish

```bash
cd /opt/hikvision

# Image yaratish (5-15 daqiqa ketadi)
docker compose build

# Ishga tushirish (background rejimida)
docker compose up -d

# Loglarni ko'rish
docker compose logs -f app
```

Muvaffaqiyatli ishga tushganda logda:
```
>>> Ma'lumotlar bazasini tekshirish...
>>> Ilova ishga tushirilmoqda...
[express] serving on port 5000
```

---

### 6-qadam: aPanel da Nginx sozlash

**Variant A: aPanel (HestiaCP/ISPmanager) orqali**

1. aPanel ga kiring → **Web** → **Qo'shish**
2. Domain: `sizning-domen.uz`
3. **Proxy Template** ni tanlang: `nginx-proxy` yoki `reverse-proxy`
4. Proxy port: `5000`
5. SSL: Let's Encrypt avtomatik

**Variant B: Nginx ni qo'lda sozlash**

```bash
# nginx.conf faylini nusxa oling
cp /opt/hikvision/nginx.conf /etc/nginx/sites-available/hikvision

# Faylni tahrirlang - domain nomini o'zgartiring
nano /etc/nginx/sites-available/hikvision
```

```nginx
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
```

```bash
# Saytni yoqish
ln -s /etc/nginx/sites-available/hikvision /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

### 7-qadam: SSL (HTTPS) o'rnatish

```bash
# Certbot o'rnatish
apt install -y certbot python3-certbot-nginx

# SSL sertifikat olish
certbot --nginx -d sizning-domen.uz -d www.sizning-domen.uz

# Avtomatik yangilash (har 90 kunda)
systemctl enable certbot.timer
```

---

### 8-qadam: Demo ma'lumotlarni yuklash (ixtiyoriy)

```bash
# Ishchi konteyner ichiga kirish
docker compose exec app sh

# Seed (demo ma'lumotlar)
npx tsx server/seed.ts

# Konteynerdan chiqish
exit
```

---

## Xodim qo'shish tartibi

1. Hikvision qurilmasida xodimning **user_id** raqamini belgilang (masalan: `1001`)
2. Tizimga **admin** yoki **sudo** sifatida kiring
3. **Ishchilar** → "Xodim qo'shish"
4. `FaceID raqami: 1001`, `To'liq ismi: Xodim Ismi` kiriting
5. Guruhni tanlang → Saqlang
6. Endi qurilmadan o'tganda xodim ismi hisobotda ko'rinadi

---

## Yangilash

```bash
cd /opt/hikvision

# Yangi kodni yuklash
git pull

# Qayta build va ishga tushirish
docker compose build
docker compose up -d

# Loglarni kuzating
docker compose logs -f app
```

---

## Muammolarni hal qilish

**Container ishlamayapti:**
```bash
docker compose logs app --tail=50
docker compose ps
```

**Baza ulanishi yo'q:**
```bash
docker compose exec app sh -c "node -e \"const {Pool}=require('pg');new Pool({connectionString:process.env.DATABASE_URL}).query('SELECT 1').then(()=>console.log('OK')).catch(e=>console.error(e.message))\""
```

**Port band:**
```bash
ss -tlnp | grep 5000
```

**Konteyner ichida buyruq:**
```bash
docker compose exec app sh
```

**Barcha konteynerlarni to'xtatish:**
```bash
docker compose down
```

**Bazani to'liq tozalash (diqqat — ma'lumotlar o'chadi!):**
```bash
docker compose down -v
docker compose up -d
```

---

## Tizim arxitekturasi

```
client/          → React + TypeScript (frontend)
server/          → Express.js (backend API)
shared/schema.ts → Drizzle ORM schema (umumiy)
Dockerfile       → Docker image
docker-compose.yml → Container orchestration
nginx.conf       → Nginx konfiguratsiya namunasi
```

**Bazalar:**

| Jadval | Maqsad |
|--------|--------|
| `users` | Foydalanuvchilar (sudo/admin/worker) |
| `groups` | Guruhlar |
| `group_admins` | Guruhga tayinlangan adminlar |
| `group_workers` | Guruhdagi ishchilar |
| `shifts` | Smenalar (kungi/tungi) |
| `holidays` | Dam olish kunlari |
| `events` | FaceID hodisalari |
| `notification_configs` | Guruh bildirishnoma sozlamalari |
| `user_sessions` | Yagona sessiya nazorati |
