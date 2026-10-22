FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/src ./src
COPY --from=web /web/dist ./public
ENV NODE_ENV=production PORT=4000 STATIC_DIR=/app/public
EXPOSE 4000
CMD ["node", "src/index.js"]
