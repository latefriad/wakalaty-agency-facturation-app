FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source
COPY src ./src

EXPOSE 4000

CMD ["node", "src/server.js"]
