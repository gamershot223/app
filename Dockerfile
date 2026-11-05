# WORKAI:PLATFORM-OWNED — файл принадлежит платформе WorkAI.
# This file is managed by the WorkAI platform. Do not edit it directly.
#
# По нему платформа собирает и публикует проект. Правка ломает публикацию
# МОЛЧА или ломает её целиком — в обоих случаях причина не видна из кода
# приложения. Зависимости меняются через install_packages, а не здесь.
#
# Multi-stage: Vite production build → nginx static (W4 local publish).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --no-update-notifier
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# Required: без этой строки образ соберётся, но у сайта не станет НИ ОДНОГО
# платформенного маршрута — формы, загрузка файлов, аналитика и оплата
# начнут отдавать index.html вместо ответа, тихо и без ошибок.
COPY nginx-default.conf /etc/nginx/conf.d/default.conf
# Required: dist/ — это то, что кладёт `npm run build` (Vite). Другой путь
# или другая команда сборки = пустой образ и белый экран у посетителя.
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
