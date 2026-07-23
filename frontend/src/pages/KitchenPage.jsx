import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [flash, setFlash] = useState('');
  const knownIds = useRef(new Set());

  const load = useCallback(async () => {
    try {
      const data = await api.getKitchenOrders();
      setOrders(data);
      knownIds.current = new Set(data.map((o) => o.id));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
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
      } catch {
        /* ignore malformed SSE */
      }
    };

    const poll = setInterval(load, 15000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [load]);

  async function openDetail(orderId) {
    try {
      const detail = await api.getKitchenOrder(orderId);
      setSelected(detail);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="kitchen">
      <div className="kitchen-header">
        <div>
          <p className="eyebrow">Gestión de cocina</p>
          <h1>Pedidos en tiempo real</h1>
          <p className="muted">
            {live
              ? 'Conexión en vivo (SSE) · los pedidos aparecen al instante'
              : 'Reconectando… (respaldo cada 15 s)'}
          </p>
        </div>
        <button type="button" className="btn" onClick={load}>
          Refrescar
        </button>
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
