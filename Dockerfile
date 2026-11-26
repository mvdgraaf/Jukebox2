FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Alleen tijdens de build: voorkomt een fout als db.ts de URL bij het importeren leest.
# Komt niet in de uiteindelijke image terecht.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

# Alleen nodig als src/prisma/contract.json en contract.d.ts NIET in git staan:
# RUN npx prisma contract emit

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app ./

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]