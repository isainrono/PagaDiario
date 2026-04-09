# Prompt de inicio — Monopoly Companion

> Copia este prompt completo y pégalo en Claude Code, Cursor o cualquier agente de codificación.
> Cubre la Fase 0 completa: monorepo, backend, frontend e infraestructura lista para arrancar.

---

## PROMPT

Eres un desarrollador senior especializado en React Native, NestJS y arquitecturas en tiempo real. Vamos a construir desde cero el proyecto **Monopoly Companion**.

---

### Qué es el proyecto

Una aplicación móvil companion para el juego de mesa Monopoly clásico. La app NO reemplaza el tablero físico: los jugadores siguen usando el tablero y los dados de verdad. El jugador activo ingresa el resultado de sus dados en la app, y esta gestiona la posición, el dinero, las propiedades y las reglas en tiempo real, sincronizando el estado entre todos los móviles.

- 2 a 8 jugadores por partida.
- Sin login ni registro. Acceso por nombre + código de sala de 6 caracteres.
- Tres modos de dinero: digital, físico o híbrido.
- Solo para uso entre amigos. No es una plataforma pública.
- Se despliega en un VPS propio con dominio usando Docker Compose.

---

### Stack tecnológico

**Frontend**
- Expo SDK (última versión estable) con React Native y TypeScript
- Zustand para gestión de estado
- Expo Router para navegación

**Backend**
- NestJS con TypeScript
- Prisma ORM
- PostgreSQL 16
- Redis 7
- Socket.io (@nestjs/websockets)

**Infraestructura**
- Docker + Docker Compose
- Nginx como reverse proxy
- Certbot para SSL

---

### Lo que debes crear ahora (Fase 0)

Crea la estructura completa del proyecto. Todo debe funcionar al final: el backend debe levantar, conectar a PostgreSQL y Redis, y responder a una petición de health check. La app móvil debe compilar sin errores.

---

#### 1. Monorepo

Estructura raíz del proyecto:

```
monopoly-companion/
├── apps/
│   ├── backend/          ← NestJS
│   └── mobile/           ← Expo
├── packages/
│   └── types/            ← tipos TypeScript compartidos entre backend y mobile
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── nginx/
│   ├── nginx.conf
│   └── nginx.dev.conf
├── .gitignore
├── package.json          ← workspace root (npm workspaces)
└── README.md
```

Configura npm workspaces en el `package.json` raíz.

---

#### 2. Backend (apps/backend)

Inicializa un proyecto NestJS con TypeScript. Estructura de módulos:

```
apps/backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── partidas/
│   │   ├── partidas.module.ts
│   │   ├── partidas.service.ts
│   │   ├── partidas.controller.ts
│   │   └── partidas.dto.ts
│   ├── jugadores/
│   │   ├── jugadores.module.ts
│   │   ├── jugadores.service.ts
│   │   └── jugadores.dto.ts
│   ├── gateway/
│   │   └── game.gateway.ts      ← WebSocket gateway (esqueleto vacío por ahora)
│   └── health/
│       └── health.controller.ts ← GET /health → { status: 'ok' }
├── prisma/
│   └── schema.prisma
├── Dockerfile
├── .env
└── package.json
```

**Dependencias a instalar:**
```
@nestjs/core @nestjs/common @nestjs/platform-express
@nestjs/websockets @nestjs/platform-socket.io socket.io
@prisma/client prisma
ioredis
class-validator class-transformer
@nestjs/config
```

**Schema de Prisma** — crea este schema exacto en `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Partida {
  id            String         @id @default(cuid())
  codigo        String         @unique
  estado        EstadoPartida  @default(ESPERANDO)
  modoMonetario ModoMonetario  @default(DIGITAL)
  turnoActual   Int            @default(0)
  creadaEn      DateTime       @default(now())
  actualizadaEn DateTime       @updatedAt

  jugadores     Jugador[]
  propiedades   Propiedad[]
  transacciones Transaccion[]
  subastas      Subasta[]
}

model Jugador {
  id             String        @id @default(cuid())
  partidaId      String
  partida        Partida       @relation(fields: [partidaId], references: [id])
  nombre         String
  ficha          Ficha
  posicion       Int           @default(0)
  saldo          Int           @default(1500)
  enCarcel       Boolean       @default(false)
  turnosEnCarcel Int           @default(0)
  cartaSalida    Boolean       @default(false)
  eliminado      Boolean       @default(false)
  ordenTurno     Int
  creadoEn       DateTime      @default(now())

  propiedades    Propiedad[]
  transacciones  Transaccion[]
  pujas          Puja[]
}

model Propiedad {
  id            String   @id @default(cuid())
  partidaId     String
  partida       Partida  @relation(fields: [partidaId], references: [id])
  propietarioId String?
  propietario   Jugador? @relation(fields: [propietarioId], references: [id])
  casilla       Int
  casas         Int      @default(0)
  hotel         Boolean  @default(false)
  hipotecada    Boolean  @default(false)
}

model Transaccion {
  id        String          @id @default(cuid())
  partidaId String
  partida   Partida         @relation(fields: [partidaId], references: [id])
  jugadorId String
  jugador   Jugador         @relation(fields: [jugadorId], references: [id])
  tipo      TipoTransaccion
  monto     Int
  concepto  String
  creadaEn  DateTime        @default(now())
}

model Subasta {
  id        String   @id @default(cuid())
  partidaId String
  partida   Partida  @relation(fields: [partidaId], references: [id])
  casilla   Int
  estado    String   @default("ACTIVA")
  expiraEn  DateTime
  ganadorId String?
  montoPuja Int?
  creadaEn  DateTime @default(now())

  pujas     Puja[]
}

model Puja {
  id        String   @id @default(cuid())
  subastaId String
  subasta   Subasta  @relation(fields: [subastaId], references: [id])
  jugadorId String
  jugador   Jugador  @relation(fields: [jugadorId], references: [id])
  monto     Int
  creadaEn  DateTime @default(now())
}

enum EstadoPartida {
  ESPERANDO
  EN_CURSO
  FINALIZADA
}

enum ModoMonetario {
  DIGITAL
  FISICO
  HIBRIDO
}

enum Ficha {
  PERRO
  SOMBRERO
  COCHE
  BARCO
  DEDAL
  CARRETILLA
  CABALLO
  PLANCHA
}

enum TipoTransaccion {
  SALARIO
  ALQUILER
  COMPRA
  IMPUESTO
  CARTA
  HIPOTECA
  CONSTRUCCION
  SUBASTA
  NEGOCIACION
  BANCARROTA
}
```

**PrismaService** — crea un servicio que extienda `PrismaClient` y maneje `onModuleInit` y `enableShutdownHooks`.

**ConfigModule** — configura `@nestjs/config` con validación de variables de entorno:
```
DATABASE_URL      string, requerida
REDIS_URL         string, requerida
PORT              number, default 3000
CORS_ORIGIN       string, requerida
NODE_ENV          string, default 'development'
```

**main.ts** — habilita CORS usando `CORS_ORIGIN` del entorno. Habilita `ValidationPipe` global. El servidor escucha en `PORT`.

**Dockerfile del backend:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main"]
```

---

#### 3. Package de tipos compartidos (packages/types)

Crea un paquete TypeScript con los tipos compartidos entre backend y frontend:

```typescript
// packages/types/src/index.ts

export type Ficha =
  | 'PERRO' | 'SOMBRERO' | 'COCHE' | 'BARCO'
  | 'DEDAL' | 'CARRETILLA' | 'CABALLO' | 'PLANCHA';

export type EstadoPartida = 'ESPERANDO' | 'EN_CURSO' | 'FINALIZADA';
export type ModoMonetario = 'DIGITAL' | 'FISICO' | 'HIBRIDO';

export interface Jugador {
  id: string;
  nombre: string;
  ficha: Ficha;
  posicion: number;
  saldo: number;
  enCarcel: boolean;
  turnosEnCarcel: number;
  cartaSalida: boolean;
  eliminado: boolean;
  ordenTurno: number;
}

export interface Propiedad {
  id: string;
  casilla: number;
  propietarioId: string | null;
  casas: number;
  hotel: boolean;
  hipotecada: boolean;
}

export interface Transaccion {
  id: string;
  tipo: string;
  monto: number;
  concepto: string;
  creadaEn: string;
}

export interface GameState {
  partidaId: string;
  estado: EstadoPartida;
  turnoActual: number;
  jugadorActivoId: string;
  dobles: number;
  jugadores: Record<string, {
    posicion: number;
    saldo: number;
    enCarcel: boolean;
    turnosEnCarcel: number;
    cartaSalida: boolean;
    eliminado: boolean;
  }>;
  casas: number;
  hoteles: number;
  subastaActiva: SubastaActiva | null;
}

export interface SubastaActiva {
  subastaId: string;
  casilla: number;
  expiraEn: number;
  pujas: { jugadorId: string; monto: number }[];
}

// Eventos Socket.io (cliente → servidor)
export interface EventosCliente {
  'partida:unirse': { codigo: string; jugadorId: string };
  'turno:dados': { partidaId: string; dado1: number; dado2: number };
  'propiedad:comprar': { partidaId: string; casilla: number };
  'propiedad:rechazar': { partidaId: string; casilla: number };
  'subasta:pujar': { subastaId: string; monto: number };
  'turno:terminar': { partidaId: string };
}

// Eventos Socket.io (servidor → cliente)
export interface EventosServidor {
  'partida:estado': GameState;
  'tablero:movimiento': {
    jugadorId: string;
    posicionAnterior: number;
    posicionNueva: number;
    dado1: number;
    dado2: number;
    dobles: boolean;
  };
  'turno:cambio': { jugadorActivoId: string; turnoNumero: number };
  'economia:transaccion': {
    jugadorId: string;
    tipo: string;
    monto: number;
    concepto: string;
    saldoNuevo: number;
  };
  'error:accion': { codigo: string; mensaje: string };
}
```

---

#### 4. Frontend (apps/mobile)

Inicializa un proyecto Expo con TypeScript y Expo Router.

```
apps/mobile/
├── app/
│   ├── _layout.tsx           ← root layout
│   ├── index.tsx             ← pantalla de bienvenida
│   └── juego/
│       └── _layout.tsx       ← Tab Bar (esqueleto vacío)
├── src/
│   ├── stores/
│   │   ├── gameStore.ts
│   │   └── socketStore.ts
│   ├── services/
│   │   ├── api.service.ts    ← base URL + fetch wrapper
│   │   └── socket.service.ts ← Socket.io client
│   └── constants/
│       └── config.ts         ← API_URL, SOCKET_URL desde env
├── .env
├── app.json
└── package.json
```

**gameStore.ts** — crea el store de Zustand con el estado inicial vacío. Usa los tipos de `@monopoly/types`.

**socketStore.ts** — crea el store de Zustand para la conexión Socket.io. Incluye `conectar`, `desconectar` y `emitir`.

**socket.service.ts** — instancia de `socket.io-client` con reconexión automática habilitada.

**api.service.ts** — wrapper de fetch con base URL configurable y manejo de errores.

**index.tsx** — pantalla de bienvenida con dos botones: "Crear partida" y "Unirse a partida". Sin funcionalidad real por ahora, solo la estructura visual.

**constants/config.ts:**
```typescript
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:3000';
```

---

#### 5. Docker Compose

**docker-compose.yml** (desarrollo):

```yaml
version: "3.9"

services:
  backend:
    build:
      context: ./apps/backend
    container_name: monopoly_backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://monopoly:${DB_PASSWORD}@postgres:5432/monopoly
      REDIS_URL: redis://redis:6379
      PORT: 3000
      CORS_ORIGIN: ${CORS_ORIGIN}
      NODE_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - internal

  postgres:
    image: postgres:16-alpine
    container_name: monopoly_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: monopoly
      POSTGRES_USER: monopoly
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U monopoly"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - internal

  redis:
    image: redis:7-alpine
    container_name: monopoly_redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - internal

volumes:
  postgres_data:
  redis_data:

networks:
  internal:
    driver: bridge
```

---

#### 6. Variables de entorno

**.env.example** en la raíz:
```env
# Base de datos
DB_PASSWORD=cambia_esta_password

# Backend
PORT=3000
CORS_ORIGIN=http://localhost:8081
NODE_ENV=development
DATABASE_URL=postgresql://monopoly:cambia_esta_password@localhost:5432/monopoly
REDIS_URL=redis://localhost:6379

# Frontend (Expo)
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_SOCKET_URL=http://localhost:3000
```

Crea `.env` copiando `.env.example` con valores de desarrollo.
Añade `.env` al `.gitignore`.

---

#### 7. Nginx (nginx/nginx.conf)

Configuración lista para producción:

```nginx
events {}

http {
  upstream backend {
    server backend:3000;
  }

  server {
    listen 80;
    server_name TU_DOMINIO;

    location /.well-known/acme-challenge/ {
      root /var/www/certbot;
    }

    location / {
      return 301 https://$host$request_uri;
    }
  }

  server {
    listen 443 ssl;
    server_name TU_DOMINIO;

    ssl_certificate     /etc/letsencrypt/live/TU_DOMINIO/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/TU_DOMINIO/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location /api/ {
      proxy_pass http://backend;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
      proxy_pass http://backend;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_read_timeout 86400;
    }
  }
}
```

---

#### 8. README.md

Crea un README claro con:
- Descripción del proyecto en 3 líneas.
- Requisitos: Node 20+, Docker, Expo CLI.
- Cómo arrancar en desarrollo:
  ```bash
  cp .env.example .env
  docker compose up -d postgres redis
  cd apps/backend && npx prisma migrate dev
  cd apps/backend && npm run start:dev
  cd apps/mobile && npx expo start
  ```
- Estructura del monorepo.
- Enlace a los archivos de contexto de los agentes.

---

### Criterio de éxito

Cuando termines, debo poder ejecutar estos comandos y que funcionen sin errores:

```bash
# 1. Levantar infraestructura
docker compose up -d postgres redis

# 2. Migrar base de datos
cd apps/backend
npx prisma migrate dev --name init

# 3. Arrancar backend
npm run start:dev
# → El servidor levanta en puerto 3000
# → GET http://localhost:3000/health → { "status": "ok" }

# 4. Arrancar mobile (otra terminal)
cd apps/mobile
npx expo start
# → La app compila sin errores TypeScript
# → La pantalla de bienvenida se muestra con los dos botones
```

---

### Convenciones que debes seguir en todo el proyecto

- TypeScript estricto en todos los archivos (`strict: true`).
- Sin `any` explícito. Si no sabes el tipo exacto, usa `unknown`.
- Nombres de archivos: `kebab-case.ts` para servicios y módulos, `PascalCase.tsx` para componentes React.
- Imports absolutos configurados en los `tsconfig.json` de cada app.
- Comentarios solo cuando el código no se explica solo. No comentarios obvios.
- Cada módulo de NestJS exporta solo lo que otros módulos necesitan. Sin exports innecesarios.

---

### Lo que NO debes hacer ahora

- No implementes lógica de juego (turnos, movimiento, propiedades). Eso es Fase 2 en adelante.
- No implementes el WebSocket gateway más allá del esqueleto vacío.
- No añadas librerías de UI todavía (sin NativeWind, sin UI kits). Solo estructura.
- No configures CI/CD. No es prioridad en Fase 0.

---

Empieza creando la estructura del monorepo y ve construyendo de arriba hacia abajo. Muéstrame el contenido de cada archivo al crearlo.
