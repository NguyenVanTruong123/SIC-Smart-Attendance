FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate && pnpm install --frozen-lockfile
COPY . .
ARG VITE_ENABLE_DEMO_ACCOUNTS=false
ENV VITE_ENABLE_DEMO_ACCOUNTS=$VITE_ENABLE_DEMO_ACCOUNTS
RUN pnpm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
