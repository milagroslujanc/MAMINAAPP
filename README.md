# La Mamina — Sprint 1

Sistema web interactivo de pedidos para el restaurante **La Mamina**.

## Stack

- **Frontend:** React + Vite (nginx en Docker)
- **Backend:** Node.js + Express
- **Base de datos:** MySQL 8
- **Orquestación:** Docker Compose

## Historias implementadas (Sprint 1)

| Jira | Historia | Estado | Ruta / endpoint |
|------|----------|--------|-----------------|
| MMN-22 | Selección de mesas + QR (con confirmación) | Done | `/` · `POST /api/tables/:id/select` |
| MMN-1 | Escaneo QR / sesión | Done | `/s/:token` · `GET /api/sessions/:token` |
| MMN-2 | Menú digital + Agotado | Done | `/menu` · `GET /api/menu` |
| MMN-3 | Carrito (agregar / cantidad / eliminar) | Done | `/menu` (drawer + sessionStorage) |
| MMN-13 | Pedidos cocina en tiempo real (SSE) | Done | `/cocina` · `GET /api/kitchen` · `/api/kitchen/stream` |
| MMN-12 | Detalle del pedido + notas | Done | `/cocina` · `GET /api/kitchen/:id` |
| MMN-16 | Login administrador + JWT | Done | `/admin` · `POST /api/auth/login` · `GET /api/auth/me` |

> Persistencia en **MySQL**. El botón **Enviar a cocina** demuestra MMN-13/MMN-12. La HU formal de “confirmar pedido” (MMN-4) pertenece al Sprint 2.

## Requisitos

**Recomendado (Docker):**

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (incluye Docker Compose)

**Alternativa (local):**

- Node.js 18+
- MySQL 8+

## Setup recomendado — Docker

### 1. Variables de entorno (secretos)

Cada frente tiene su propio `.env` (no se sube a git). Copia los ejemplos si aún no existen:

```bash
cp database/.env.example database/.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

| Archivo | Secretos / variables |
|---------|----------------------|
| `database/.env` | `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE` |
| `backend/.env` | `DB_*`, `JWT_SECRET`, `FRONTEND_URL`, `PORT` |
| `frontend/.env` | `VITE_API_URL` (vacío = proxy `/api`) |

> `DB_PASSWORD` en `backend/.env` debe coincidir con `MYSQL_ROOT_PASSWORD` en `database/.env`.

### 2. Levantar todo

```bash
docker compose up --build -d
```

| Servicio | URL / puerto |
|----------|----------------|
| App (frontend) | http://localhost:5173 |
| API (backend) | http://localhost:4000 |
| MySQL | `localhost:3307` (usuario `root`, BD según `database/.env`) |

Credenciales admin (seed automático al arrancar el backend):

- Usuario: `admin`
- Contraseña: `admin123`

### Comandos útiles

```bash
# Ver estado
docker compose ps

# Logs
docker compose logs -f

# Parar contenedores
docker compose down

# Parar y borrar datos de MySQL (volumen)
docker compose down -v

# Reconstruir tras cambios de código
docker compose up --build -d
```

### Qué hace cada Dockerfile

| Carpeta | Imagen | Rol |
|---------|--------|-----|
| `database/` | MySQL 8 + `schema.sql` | Base de datos |
| `backend/` | Node 20 | API + seed idempotente al iniciar |
| `frontend/` | Build Vite + nginx | UI estática; proxy de `/api` → backend |

Con `VITE_API_URL` vacío, el navegador llama a `/api` en el mismo origen y nginx reenvía al servicio `backend`.

En Docker, Compose fuerza `DB_HOST=db` (nombre del servicio) aunque en `backend/.env` tengas `localhost` para desarrollo local.

## Setup alternativo — local (sin Docker)

### 1. Base de datos

Ajusta `backend/.env` (o cópialo desde `.env.example`):

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
```

Luego:

```bash
cd backend
npm install
npm run seed
```

### 2. API

```bash
cd backend
npm run dev
```

API en `http://localhost:4000`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App en `http://localhost:5173`

## Flujo de demo

1. Abrir **Recepción** (`/`) → elegir mesa libre o **Pedir para llevar**.
2. Escanear el QR (o usar el enlace “Abrir menú en este dispositivo”).
3. En el menú, agregar platos al carrito (los agotados están bloqueados).
4. Enviar a cocina.
5. Abrir **Cocina** (`/cocina`) → ver tarjeta “Nuevo” y el detalle con notas.
6. Probar **Admin** (`/admin`) con `admin` / `admin123`.

Tip recepción: clic derecho sobre una mesa ocupada la libera (solo para demos).

## Estructura

```
MaminaApp/
├── docker-compose.yml   # orquesta db + backend + frontend
├── backend/             # Express API (+ Dockerfile, .env)
├── frontend/            # React Vite (+ Dockerfile / nginx, .env)
├── database/            # MySQL (+ Dockerfile, .env, schema.sql)
└── docs/                # documentación del sprint
```
