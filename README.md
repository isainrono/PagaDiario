# Monopoly Companion

App móvil companion para el Monopoly clásico de tablero. Gestiona posición, dinero y propiedades en tiempo real entre todos los jugadores — sin reemplazar el tablero físico.

## Requisitos

- Node 20+
- Docker y Docker Compose
- Expo CLI (`npm install -g expo-cli`)

## Arrancar en desarrollo

```bash
cp .env.example .env
docker compose up -d postgres redis
cd apps/backend && npx prisma migrate dev --name init
cd apps/backend && npm run start:dev
cd apps/mobile && npx expo start
```

## Estructura del monorepo

```
monopoly-companion/
├── apps/
│   ├── backend/      ← NestJS + Prisma + Socket.io
│   └── mobile/       ← Expo React Native
├── packages/
│   └── types/        ← Tipos TypeScript compartidos
├── nginx/            ← Configuración Nginx
└── docker-compose.yml
```

## Agentes de desarrollo

- `.claude/agents/arquitecto.md` — Decisiones de arquitectura y diseño
- `.claude/agents/backend.md` — Backend NestJS y Prisma
- `.claude/agents/realtime.md` — WebSocket gateway y Redis
- `.claude/agents/frontend.md` — Expo React Native
# PagaDiario
