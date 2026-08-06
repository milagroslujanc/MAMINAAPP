# Etapa 1: build de Vite
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
# Variables de build (VITE_*); Vite también lee .env si existe
COPY .env* ./
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Etapa 2: servir estáticos + proxy /api
FROM nginx:1.27-alpine

LABEL project="La Mamina" \
      service="frontend"

# Plantilla: la imagen oficial de nginx sustituye ${PORT} al arrancar
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Docker Compose: 80 | Railway inyecta su propio PORT
ENV PORT=80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
