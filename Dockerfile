FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json server.mjs ./
RUN npm ci
COPY public ./public
COPY src ./src
COPY scripts/build-assets.mjs ./scripts/build-assets.mjs
RUN npm run build:assets
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.mjs"]
