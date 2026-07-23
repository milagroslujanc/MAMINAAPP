FROM node:20-alpine

WORKDIR /app

LABEL project="La Mamina" \
      service="backend"

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 4000

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
