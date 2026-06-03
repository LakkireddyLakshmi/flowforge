# Single-container build: compiles the React client and runs the engine, which
# serves the client over the same origin. Works on Render, Railway, Fly, or any
# Docker host. The server listens on $PORT (default 3001).
FROM node:22-slim

WORKDIR /app

# install deps first (better layer caching); --include=dev for vite/tsc/tsx
COPY package*.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --include=dev

# build the client
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "start"]
