# La Mamina — Sprint 1

Sistema web interactivo de pedidos para el restaurante **La Mamina**.

## Stack

- **Frontend:** React + Vite (nginx en Docker)
- **Backend:** Node.js + Express
- **Base de datos:** MySQL 8
- **Orquestación:** Docker Compose

## Perfiles y URLs

Cada perfil tiene su propia URL (el topbar solo muestra la marca; no hay menú cruzado de perfiles).

| Perfil | URL base | Acceso | Credenciales demo |
|--------|----------|--------|-------------------|
| **Cliente / Recepción** | http://localhost:5173/ | Selección de mesa + QR | — |
| **Cliente / Menú** | http://localhost:5173/menu | Vía QR (`/s/:token`) | — |
| **Cocina** | http://localhost:5173/cocina | Pedidos en tiempo real | — |
| **Administrador** | http://localhost:5173/admin | Menú, mesas, pedidos (todo) | `admin` / `admin123` |
| **Mesero** | http://localhost:5173/mesero | Solo gestión de pedidos | `mesero` / `mesero123` |

Rutas útiles del administrador (tras login):

- Panel: `/admin/panel`
- Pedidos: `/admin/pedidos`
- Menú: `/admin/menu`
- Mesas: `/admin/mesas`

Ruta del mesero (tras login): `/mesero/pedidos`

> Si ya hay sesión de administrador y abres `/admin`, se redirige automáticamente a `/admin/panel`.

## Historias implementadas

| Jira | Historia | Estado | Ruta / endpoint |
|------|----------|--------|-----------------|
| MMN-22 | Selección de mesas + QR (con confirmación) | Done | `/` · `POST /api/tables/:id/select` |
| MMN-1 | Escaneo QR / sesión | Done | `/s/:token` · `GET /api/sessions/:token` |
| MMN-2 | Menú digital + Agotado | Done | `/menu` · `GET /api/menu` |
| MMN-3 | Carrito (agregar / cantidad / eliminar) | Done | `/menu` (drawer + sessionStorage) |
| MMN-13 | Pedidos cocina en tiempo real (SSE) | Done | `/cocina` · `GET /api/kitchen` · `/api/kitchen/stream` |
| MMN-12 | Detalle del pedido + notas | Done | `/cocina` · `GET /api/kitchen/:id` |
| MMN-16 | Login administrador + JWT | Done | `/admin` · `POST /api/auth/login` · `GET /api/auth/me` |
| MMN-18 | Gestionar menú (CRUD platos) | Done | `/admin/menu` · `/api/admin/products` |
| MMN-19 | Gestionar mesas (CRUD) | Done | `/admin/mesas` · `/api/admin/tables` |
| — | Gestionar pedidos + roles admin/mesero | Done | `/admin/pedidos` · `/mesero/pedidos` · `/api/admin/orders` |

> Persistencia en **MySQL**. Menú cliente solo platos **activos**. Recepción solo mesas **activas**. Cancelar un pedido lo saca de cocina y no se cobra.

## Requisitos

**Recomendado (Docker):**

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (incluye Docker Compose)

**Alternativa (local):**

- Node.js 18+
- MySQL 8+

## Setup recomendado — Docker

### 1. Variables de entorno (secretos)

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
| MySQL | `localhost:3307` |

### Comandos útiles

```bash
docker compose ps
docker compose logs -f
docker compose down
docker compose down -v
docker compose up --build -d
```

## Setup alternativo — local (sin Docker)

```bash
# BD
cd backend && npm install && npm run seed

# API
npm run dev   # http://localhost:4000

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Flujo de demo

1. **Cliente:** http://localhost:5173/ → mesa o para llevar → QR → menú → enviar a cocina.
2. **Cocina:** http://localhost:5173/cocina → ver pedido nuevo y detalle.
3. **Admin:** http://localhost:5173/admin → `admin` / `admin123` → pedidos / menú / mesas.
4. **Mesero:** http://localhost:5173/mesero → `mesero` / `mesero123` → cancelar pedido si hace falta.

Tip recepción: clic derecho sobre una mesa ocupada la libera (solo para demos).

## Estructura

```
MaminaApp/
├── docker-compose.yml
├── backend/
├── frontend/
├── database/
└── docs/
```
