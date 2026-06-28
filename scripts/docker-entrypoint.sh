#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

if [ "${SEED_DATABASE:-true}" = "true" ]; then
  echo "Seeding demo data..."
  npm run db:seed
fi

echo "Starting Next.js..."
exec npm run start
