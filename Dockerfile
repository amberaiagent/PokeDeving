# --- PokeDungeon game (Express + static) ---
FROM node:22-alpine
WORKDIR /app

# install only production deps (uses package-lock.json)
COPY package*.json ./
RUN npm ci --omit=dev

# app code
COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
