FROM node:20-alpine AS builder
WORKDIR /app

# Copiar estructura del monorepo necesaria
COPY package*.json ./
COPY packages/types ./packages/types
COPY apps/backend/package*.json ./apps/backend/

# Instalar todas las dependencias del workspace
RUN npm install

# Copiar código fuente y prisma
COPY apps/backend ./apps/backend

# Generar Prisma client y compilar
WORKDIR /app/apps/backend
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Copiar node_modules hoisted (raíz del monorepo)
COPY --from=builder /app/node_modules ./node_modules
# Copiar packages/types para el symlink del workspace
COPY --from=builder /app/packages ./packages
# Copiar dist compilado y prisma
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/main"]
