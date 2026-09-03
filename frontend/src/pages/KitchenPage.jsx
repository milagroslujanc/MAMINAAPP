import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { clearStaffSession, homeForRole } from '../auth';

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function KitchenPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState('');
  const knownIds = useRef(new Set());

  const load = useCallback(async () => {
    try {
      const data = await api.getKitchenOrders();
      const list = Array.isArray(data) ? data : [];
      setOrders(list);
      knownIds.current = new Set(list.map((o) => o.id));
      setError(Array.isArray(data) ? '' : 'Respuesta inválida del API de cocina');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const me = await api.me();
        if (!['admin', 'cocina'].includes(me.admin?.role)) {
          navigate(homeForRole(me.admin?.role), { replace: true });
          return;
        }
        if (!cancelled) setReady(true);
      } catch {
        clearStaffSession();
        navigate('/cocina', { replace: true });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!ready) return undefined;

    load();

    const es = new EventSource(api.kitchenStreamUrl());
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'order' && payload.order) {
          const order = { ...payload.order, is_new: true };
          setOrders((prev) => {
            if (prev.some((o) => o.id === order.id)) return prev;
            return [...prev, order];
          });
          if (!knownIds.current.has(order.id)) {
            knownIds.current.add(order.id);
            setFlash(`Nuevo pedido #${order.id}`);
            window.setTimeout(() => setFlash(''), 4000);
          }
        }
        if (payload.type === 'order_cancelled' && payload.orderId) {
          setOrders((prev) => prev.filter((o) => o.id !== payload.orderId));
          knownIds.current.delete(payload.orderId);
          setSelected((cur) => (cur?.id === payload.orderId ? null : cur));
          setFlash(`Pedido #${payload.orderId} cancelado`);
          window.setTimeout(() => setFlash(''), 4000);
        }
        if (payload.type === 'order_updated' && payload.orderId) {
          load();
          setFlash(`Pedido #${payload.orderId} actualizado`);
          window.setTimeout(() => setFlash(''), 4000);
          setSelected((cur) => {
            if (cur?.id === payload.orderId) {
              api
                .getKitchenOrder(payload.orderId)
                .then((detail) => {
                  if (detail.status === 'entregado') setSelected(null);
                  else setSelected(detail);
                })
                .catch(() => setSelected(null));
            }
            return cur;
          });
        }
      } catch {
        /* ignore malformed SSE */
      }
    };

    const poll = setInterval(load, 15000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [load, ready]);

  async function openDetail(orderId) {
    try {
      const detail = await api.getKitchenOrder(orderId);
      setSelected(detail);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function markPreparing() {
    if (!selected || !['pendiente', 'listo'].includes(selected.status)) return;
    try {
      const detail = await api.updateKitchenOrderStatus(selected.id, 'en_preparacion');
      setSelected(detail);
      setFlash(
        selected.status === 'listo'
          ? `Pedido #${selected.id} vuelto a preparación`
          : `Pedido #${selected.id} en preparación`
      );
      window.setTimeout(() => setFlash(''), 4000);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function markReady() {
    if (!selected || selected.status !== 'en_preparacion') return;
    try {
      const detail = await api.updateKitchenOrderStatus(selected.id, 'listo');
      setSelected(detail);
      setFlash(`Pedido #${selected.id} listo`);
      window.setTimeout(() => setFlash(''), 4000);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    clearStaffSession();
    navigate('/cocina');
  }

  if (!ready) {
    return (
      <section className="center-card">
        <p className="muted">Verificando sesión de cocina…</p>
      </section>
    );
  }

  return (
    <section className="kitchen">
      <div className="kitchen-header">
        <div>
          <p className="eyebrow">Gestión de cocina</p>
          <h1>Lista de pedidos</h1>
          <p className="muted">
            {live ? 'Pedidos para cocina' : 'Reconectando… (respaldo cada 15 s)'}
          </p>
        </div>
        <div className="admin-actions">
          <button type="button" className="btn" onClick={load}>
            Refrescar
          </button>
          <button type="button" className="btn" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {flash && <div className="alert ok kitchen-flash">{flash}</div>}

      <div className="kitchen-layout">
        <div className="order-board">
          {!orders.length && <p className="muted">Sin pedidos activos.</p>}
          {orders.map((order) => (
            <button
              key={order.id}
              type="button"
              className={`order-card ${order.is_new ? 'is-new' : ''}`}
              onClick={() => openDetail(order.id)}
            >
              <div className="order-card-top">
                <strong>#{order.id}</strong>
                {order.is_new && <span className="badge-nuevo">Nuevo</span>}
              </div>
              <p>
                {order.order_type === 'llevar'
                  ? 'Para llevar'
                  : `Mesa ${order.table_number ?? '—'}`}
              </p>
              <p className="muted">{formatTime(order.created_at)}</p>
              <p className="status-pill">{order.status.replace('_', ' ')}</p>
              <p>S/ {Number(order.total).toFixed(2)}</p>
            </button>
          ))}
        </div>

        <div className="order-detail">
          {!selected && <p className="muted">Selecciona un pedido para ver el detalle.</p>}
          {selected && (
            <>
              <h2>Pedido #{selected.id}</h2>
              <p>
                Destino:{' '}
                {selected.order_type === 'llevar'
                  ? 'Para llevar'
                  : `Mesa ${selected.table_number}`}
              </p>
              <p className="muted">{formatTime(selected.created_at)}</p>
              <ul className="detail-items">
                {selected.items.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>
                        {item.quantity}× {item.product_name}
                      </strong>
                      <span>S/ {(item.unit_price * item.quantity).toFixed(2)}</span>
                    </div>
                    {item.special_notes && (
                      <p className="note-highlight">Nota: {item.special_notes}</p>
                    )}
                  </li>
                ))}
              </ul>
              {selected.notes && <p>Observación general: {selected.notes}</p>}
              {selected.status === 'pendiente' && (
                <button type="button" className="btn small" onClick={markPreparing}>
                  Marcar como en preparación
                </button>
              )}
              {selected.status === 'en_preparacion' && (
                <button type="button" className="btn small" onClick={markReady}>
                  Marcar como listo
                </button>
              )}
              {selected.status === 'listo' && (
                <button type="button" className="btn small" onClick={markPreparing}>
                  Volver a preparación
                </button>
              )}
              <p className="total-row">
                <span>Total</span>
                <strong>S/ {Number(selected.total).toFixed(2)}</strong>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
