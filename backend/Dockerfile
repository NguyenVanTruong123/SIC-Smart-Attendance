FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate && pnpm install --frozen-lockfile
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN pnpm prisma:generate && pnpm run build
EXPOSE 5000
CMD ["sh", "-c", "pnpm prisma:migrate || pnpm prisma:push; pnpm start"]
