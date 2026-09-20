FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV DATABASE_URL="mysql://root:root@mysql:3306/hoobox"
RUN npm run prisma:generate && npm run build \
  && npx --yes esbuild prisma/seed.ts --bundle --platform=node --packages=external --format=esm --outfile=dist/seed.js

FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache netcat-openbsd

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma7.config.ts ./prisma7.config.ts
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3333

ENTRYPOINT ["/entrypoint.sh"]
