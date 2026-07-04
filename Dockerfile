# Estágio 1: compila o TypeScript (precisa das devDependencies).
FROM node:20-slim AS build

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Estágio 2: imagem final só com dependências de produção + JS compilado.
FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

CMD ["node", "dist/index.js"]
