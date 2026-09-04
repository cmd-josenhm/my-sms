# ---- Étape 1 : build de l'interface (Vite) ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci || npm install
COPY client client
RUN npm run build -w client

# ---- Étape 2 : runtime ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev
COPY --from=build /app/client/dist client/dist
COPY server server
RUN addgroup -S sms && adduser -S sms -G sms && chown -R sms:sms /app
USER sms
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/src/index.js"]
