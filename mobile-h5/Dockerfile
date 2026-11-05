FROM node:22-alpine AS builder
WORKDIR /app/mobile-h5
COPY mobile-h5/package.json mobile-h5/package-lock.json ./
RUN npm ci
COPY . /app
RUN npm run build
FROM nginx:1.27-alpine
COPY --from=builder /app/mobile-h5/dist /usr/share/nginx/html
COPY mobile-h5/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80
