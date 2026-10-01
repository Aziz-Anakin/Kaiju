FROM node:24-alpine

WORKDIR /app

ARG DATABASE_URL=postgresql://kaiju:kaiju@postgres:5432/kaiju
ENV DATABASE_URL=${DATABASE_URL}

COPY prisma ./prisma
COPY apps/backend/package.json apps/backend/package-lock.json apps/backend/prisma.config.ts ./apps/backend/

WORKDIR /app/apps/backend
RUN npm ci

COPY apps/backend ./
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]
