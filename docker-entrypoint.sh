#!/bin/sh
set -e

echo ">>> Ma'lumotlar bazasini tekshirish..."
npm run db:push

echo ">>> Ilova ishga tushirilmoqda..."
exec node dist/index.cjs
