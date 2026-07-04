# O corepack lê a versão do pnpm fixada no campo "packageManager" do
# package.json — build reprodutível, sem depender de pnpm global na máquina.

# Estágio 1: compila o TypeScript (precisa das devDependencies).
FROM node:20-slim AS build

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json ./
RUN pnpm install --frozen-lockfile

COPY src ./src
RUN pnpm run build

# Estágio 2: imagem final só com dependências de produção + JS compilado.
FROM node:20-slim

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist ./dist

CMD ["node", "dist/index.js"]
