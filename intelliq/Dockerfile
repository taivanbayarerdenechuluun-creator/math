# INTELLIQ production image (PostgreSQL). NOTE: written for deployment but not built in the
# development environment (no Docker available there) - build it once in CI before relying on it.
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Switch the Prisma provider/migrations from SQLite (dev) to PostgreSQL.
RUN npm run db:gen-postgres \
 && cp prisma/postgres/schema.prisma prisma/schema.prisma \
 && rm -rf prisma/migrations \
 && cp -r prisma/postgres/migrations prisma/migrations
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" SESSION_SECRET="build-time-placeholder-build-time-placeholder"
RUN npx prisma generate && npm run build

FROM base AS run
ENV NODE_ENV=production PORT=3000
# Full node_modules are kept on purpose: the entrypoint runs `prisma migrate deploy` and the seed (tsx).
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
RUN mkdir -p storage && chown -R node:node /app
USER node
EXPOSE 3000
# Uploaded images live in /app/storage: mount a volume there, or set STORAGE_DRIVER=s3 (see docs/DEPLOYMENT.md).
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npm start"]
