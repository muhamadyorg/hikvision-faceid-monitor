#!/bin/bash
set -e

# ─────────────────────────────────────────────
#  Hikvision FaceID Monitor — avtomatik deploy
# ─────────────────────────────────────────────

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

ok()   { echo -e "${GREEN}✔ $1${RESET}"; }
info() { echo -e "${YELLOW}→ $1${RESET}"; }
err()  { echo -e "${RED}✘ $1${RESET}"; exit 1; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║  Hikvision FaceID — Deploy skripti       ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""

# ── 1. To'g'ri papkada ekanligini tekshirish ──
if [ ! -f "docker-compose.yml" ]; then
  err "Bu skriptni loyiha papkasidan ishga tushiring: cd ~/hikvision-faceid-monitor && bash deploy.sh"
fi
ok "Papka to'g'ri: $(pwd)"

# ── 2. Docker o'rnatish (agar yo'q bo'lsa) ──
if ! command -v docker &>/dev/null; then
  info "Docker topilmadi — o'rnatilmoqda..."
  curl -fsSL https://get.docker.com | bash
  ok "Docker o'rnatildi"
else
  ok "Docker mavjud: $(docker --version | cut -d' ' -f3 | tr -d ',')"
fi

if ! docker compose version &>/dev/null 2>&1; then
  info "Docker Compose o'rnatilmoqda..."
  apt-get install -y docker-compose-plugin 2>/dev/null || \
  curl -SL "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-linux-x86_64" \
    -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose
  ok "Docker Compose o'rnatildi"
else
  ok "Docker Compose mavjud"
fi

# ── 3. Parollar ──
DB_PASS="hkv_$(openssl rand -hex 12)"
SESSION_SECRET="$(openssl rand -base64 48 | tr -d '\n')"

SUDO_USER="sudo"
SUDO_PASS="sudo123"
ADMIN_USER="admin"
ADMIN_PASS="admin123"
WORKER_USER="user"
WORKER_PASS="user123"

# ── 4. .env fayl yaratish ──
info ".env fayl yaratilmoqda..."
cat > .env <<ENV
DATABASE_URL=postgresql://hikvision:${DB_PASS}@db:5432/hikvision_db
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=5000

SUDO_USERNAME=${SUDO_USER}
SUDO_PASSWORD=${SUDO_PASS}
ADMIN_USERNAME=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASS}
WORKER_USERNAME=${WORKER_USER}
WORKER_PASSWORD=${WORKER_PASS}
ENV
ok ".env fayl tayyor"

# ── 5. docker-compose.yml ni parol bilan yangilash ──
info "docker-compose.yml yangilanmoqda..."
cat > docker-compose.yml <<COMPOSE
version: "3.8"

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: hikvision_db
      POSTGRES_USER: hikvision
      POSTGRES_PASSWORD: ${DB_PASS}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hikvision -d hikvision_db"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build: .
    ports:
      - "5000:5000"
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://hikvision:${DB_PASS}@db:5432/hikvision_db
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

volumes:
  postgres_data:
COMPOSE
ok "docker-compose.yml tayyor"

# ── 6. Eski containerlarni to'xtatish ──
info "Eski containerlar to'xtatilmoqda..."
docker compose down 2>/dev/null || true

# ── 7. Image yaratish ──
info "Docker image yaratilmoqda (5-15 daqiqa)..."
docker compose build
ok "Image yaratildi"

# ── 8. Ishga tushirish ──
info "Containerlar ishga tushirilmoqda..."
docker compose up -d
ok "Containerlar ishga tushdi"

# ── 9. Tayyor bo'lishini kutish ──
info "Ilova tayyor bo'lishini kutmoqdamiz..."
ATTEMPTS=0
MAX=30
until curl -sf http://localhost:5000 > /dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [ $ATTEMPTS -ge $MAX ]; then
    echo ""
    echo -e "${RED}30 soniya ichida ilova javob bermadi. Loglarni tekshiring:${RESET}"
    echo "  docker compose logs app --tail=30"
    exit 1
  fi
  printf "."
  sleep 2
done
echo ""
ok "Ilova ishga tushdi!"

# ── 10. Muvaffaqiyat xabari ──
SERVER_IP=$(curl -sf https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║           TAYYOR! Muvaffaqiyatli!            ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Kirish manzili:${RESET}  http://${SERVER_IP}:5000"
echo ""
echo -e "  ${BOLD}Loginlar:${RESET}"
echo -e "    Sudo   → ${SUDO_USER} / ${SUDO_PASS}"
echo -e "    Admin  → ${ADMIN_USER} / ${ADMIN_PASS}"
echo -e "    Ishchi → ${WORKER_USER} / ${WORKER_PASS}"
echo ""
echo -e "  ${BOLD}Foydali buyruqlar:${RESET}"
echo -e "    Loglar:       docker compose logs -f app"
echo -e "    To'xtatish:   docker compose down"
echo -e "    Qayta start:  docker compose restart app"
echo ""
echo -e "  ${YELLOW}Nginx + SSL uchun README.md ga qarang.${RESET}"
echo ""
