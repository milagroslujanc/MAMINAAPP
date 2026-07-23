# 6.2 Primer ciclo de desarrollo — Cierre Sprint 1

**Proyecto:** Sistema Web Interactivo de Pedidos — La Mamina (MMN)  
**Sprint:** MMN Sprint 1  
**Duración:** 16 de julio de 2026 → 30 de julio de 2026  
**Fecha de cierre técnico:** 23 de julio de 2026  
**Equipo:** Milagros Lujan Chambi · Sebastián Arista Serna  

> Todas las historias del Sprint 1 están **implementadas y cerradas** en código (29/29 SP).  
> La Review/Retro formales quedan calendarizadas el **30/07**; el incremento ya está listo para demo.

---

## Estado en Jira (al cierre técnico 23/07)

| Clave | Historia | SP | Estado |
|-------|----------|----|--------|
| MMN-22 | HU-00 Selección de mesas | 5 | **Done** |
| MMN-1 | HU-01 Escaneo de QR | 3 | **Done** |
| MMN-2 | HU-02 Visualizar menú digital | 5 | **Done** |
| MMN-3 | HU-03 Agregar producto al carrito | 5 | **Done** |
| MMN-13 | HU-09 Visualización de pedidos (Cocina) | 5 | **Done** |
| MMN-12 | HU-10 Detalles del pedido (Cocina) | 3 | **Done** |
| MMN-16 | HU-13 Autenticación de Administrador | 3 | **Done** |
| **Total** | | **29 SP** | **100% Done** |

Historias fuera del Sprint 1 (Sprint 2/3): MMN-4, MMN-5, MMN-9, MMN-10, MMN-11, MMN-14, MMN-15, MMN-17, MMN-18, MMN-19, MMN-20.

---

## Qué actualizar en Jira

1. Fechas del sprint: **16/07/2026 – 30/07/2026** + Sprint Goal (abajo).
2. Marcar **Done** las 7 historias con comentario de cierre.
3. Completar subtareas técnicas (todas Done).
4. Capturar tablero (todo en Finalizado) + burndown en 0 SP.

### Comentarios sugeridos por historia

| Clave | Comentario |
|-------|------------|
| MMN-22 | Confirmación de mesa libre → ocupada + QR único; opción “Pedir para llevar”; persistencia MySQL. |
| MMN-1 | Escaneo `/s/:token` abre menú y asocia sesión a mesa. |
| MMN-2 | Menú por categorías; platos sin stock con badge “Agotado” y Agregar deshabilitado. |
| MMN-3 | Carrito con agregar, cantidad, eliminar, total en vivo y persistencia en sessionStorage. |
| MMN-13 | Tablero cocina con SSE (`/api/kitchen/stream`), badge “Nuevo” y aviso al llegar pedido. |
| MMN-12 | Detalle con plato, cantidad, mesa/llevar y notas especiales resaltadas. |
| MMN-16 | Login con mensaje “Datos incorrectos”; panel protegido vía JWT (`GET /api/auth/me`). |

### Subtareas (todas Done)

**MMN-22** — UI recepción · API estados · mesas + para llevar · QR · confirmación de selección  
**MMN-1** — Endpoint sesión · redirección menú · vínculo mesa↔sesión  
**MMN-2** — Categorías · UI móvil · stock / Agotado  
**MMN-3** — Agregar · cantidades/subtotal · eliminar · pruebas flujo  
**MMN-13** — Tablero · recepción pedidos · tiempo real SSE / etiqueta Nuevo  
**MMN-12** — Vista detalle · notas resaltadas · pruebas  
**MMN-16** — Login · validación backend · protección JWT de rutas  

---

# Texto para el informe Word — Sección 6.2

## 6.2 Primer ciclo de desarrollo

El primer ciclo de desarrollo corresponde al **MMN Sprint 1** (16–30 de julio de 2026). Su propósito fue construir el flujo base de atención: selección de mesa, acceso por QR, menú digital, carrito, cocina en tiempo real y autenticación del administrador.

Al **23 de julio de 2026** el equipo cerró técnicamente las **7 historias (29 SP)**. La inspección formal (Sprint Review y Retrospective) se realiza el **30 de julio de 2026** con el incremento desplegable vía Docker Compose.

---

### 6.2.1 Planificación (Sprint Planning)

La reunión de Sprint Planning se realizó el **16 de julio de 2026**.

#### Sprint Goal

> Habilitar el flujo inicial de atención del cliente en salón (selección de mesa, acceso por QR y consulta del menú digital), el carrito de pedidos, la recepción de órdenes en cocina en tiempo real y el acceso seguro del administrador, de modo que al final del sprint exista un incremento usable del núcleo operativo de La Mamina.

#### Capacidad y compromiso

| Concepto | Valor |
|----------|-------|
| Duración del sprint | 15 días (16/07 – 30/07/2026) |
| Historias comprometidas | 7 |
| Story Points comprometidos | 29 SP |
| Daily Scrum | Todos los días, 21:00 hrs |

#### Sprint Backlog

| ID Jira | HU | Historia | SP | Responsable | Estado final |
|---------|----|----------|----|-------------|--------------|
| MMN-22 | HU-00 | Selección de mesas | 5 | Sebastián Arista | Done |
| MMN-1 | HU-01 | Escaneo de QR | 3 | Sebastián Arista | Done |
| MMN-2 | HU-02 | Menú digital | 5 | Milagros Lujan | Done |
| MMN-3 | HU-03 | Carrito | 5 | Sebastián Arista | Done |
| MMN-13 | HU-09 | Pedidos cocina | 5 | Milagros Lujan | Done |
| MMN-12 | HU-10 | Detalle pedido cocina | 3 | Milagros Lujan | Done |
| MMN-16 | HU-13 | Auth administrador | 3 | Milagros Lujan | Done |

---

### 6.2.2 Ejecución (Daily Scrum)

#### Registro resumido (16 – 23 julio)

| Fecha | Avance |
|-------|--------|
| 16–17/07 | Planning; UI mesas; estructura menú |
| 18–19/07 | QR/sesión; menú + Agotado; login admin |
| 20–21/07 | Done MMN-22,1,2,16; avance carrito y cocina |
| 22–23/07 | Cierre MMN-3, MMN-13 (SSE), MMN-12; persistencia MySQL; JWT en panel; Docker Compose |

#### Estado del tablero al 23/07/2026

| Columna | Historias | SP |
|---------|-----------|----|
| **Finalizado** | MMN-22, MMN-1, MMN-2, MMN-3, MMN-13, MMN-12, MMN-16 | **29** |
| En curso | — | 0 |
| Por hacer | — | 0 |

#### Burndown (cierre)

| Día | Fecha | SP restantes (real) | Evento |
|-----|-------|---------------------|--------|
| 0 | 16/07 | 29 | Planning |
| 4 | 20/07 | 13 | Cierre MMN-22,1,2,16 |
| 5 | 21/07 | 13 | Carrito + cocina en curso |
| 7 | 23/07 | **0** | Cierre técnico total Sprint 1 |

---

### 6.2.3 Inspección y Adaptación (Review & Retrospective)

> Estructura lista para la sesión del **30/07**. Resultados técnicos ya verificables en el incremento.

#### Sprint Review Report

**Fecha:** 30 de julio de 2026  
**Incremento presentado:**
- Recepción: mesas libres/ocupadas, confirmación, QR y “Pedir para llevar”
- Acceso al menú vía QR vinculado a la mesa
- Menú por categorías con “Agotado”
- Carrito (agregar / cantidad / eliminar / total)
- Cocina en tiempo real (SSE) con badge “Nuevo”
- Detalle de pedido con notas especiales resaltadas
- Login admin + panel protegido por JWT
- Despliegue unificado: `docker compose up --build -d`

| Historia | Resultado Review (propuesta) | Observación |
|----------|------------------------------|-------------|
| MMN-22 | Aceptada | Confirmación + QR |
| MMN-1 | Aceptada | Sesión por token |
| MMN-2 | Aceptada | Agotados bloqueados |
| MMN-3 | Aceptada | Totales y eliminar |
| MMN-13 | Aceptada | SSE al instante |
| MMN-12 | Aceptada | Notas resaltadas |
| MMN-16 | Aceptada | “Datos incorrectos” + JWT |

**Ajustes para Sprint 2:** MMN-4 (confirmar pedido formal), MMN-14/15 (estados cocina), MMN-18/19 (gestión menú/mesas).

#### Sprint Retrospective Log (borrador)

| Qué salió bien | Qué mejorar | Acciones Sprint 2 |
|----------------|-------------|-------------------|
| Flujo completo demoable en Docker | Adelantar contrato de API pedidos | Spike MMN-4 día 1 |
| Persistencia MySQL unificada | Evidencias de prueba más tempranas | Checklist DoD en Planning |
| SSE para cocina sin recarga manual | Worklog diario más constante | Recordatorio post-Daily |

---

## Checklist de cierre

### En Jira
- [x] Código de las 7 historias listo
- [ ] Marcar las 7 historias **Done** en el tablero
- [ ] Capturar tablero + burndown en 0
- [ ] Completar Review/Retro el 30/07

### En el producto
- [x] API persistente en MySQL
- [x] Confirmación de mesa (MMN-22)
- [x] Carrito completo (MMN-3)
- [x] Cocina SSE (MMN-13)
- [x] Detalle + notas (MMN-12)
- [x] JWT en panel admin (MMN-16)
- [x] Docker Compose (db + backend + frontend)

### Flujo de aceptación (demo)

1. Recepción → confirmar mesa libre → QR  
2. Abrir QR → menú con categorías y agotados  
3. Carrito: agregar, cambiar cantidad, eliminar, nota especial  
4. Enviar a cocina → aparece al instante en `/cocina` con “Nuevo”  
5. Abrir detalle → ver nota resaltada  
6. Admin: password incorrecta → “Datos incorrectos”; login OK → panel  

---

## Mapeo Word ↔ Jira (Sprint 1)

| HU Word | Clave Jira | En Sprint 1 |
|---------|------------|-------------|
| HU-00 Mesas | MMN-22 | Sí · Done |
| HU-01 QR | MMN-1 | Sí · Done |
| HU-02 Menú | MMN-2 | Sí · Done |
| HU-03 Carrito | MMN-3 | Sí · Done |
| HU-09 Pedidos cocina | MMN-13 | Sí · Done |
| HU-10 Detalle cocina | MMN-12 | Sí · Done |
| HU-13 Auth admin | MMN-16 | Sí · Done |
