import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Banner de alertas para mesero/admin (ej. cliente solicita terminar pedido).
 */
export default function StaffAlertsBanner({ pedidosPath = '/mesero/pedidos' }) {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await api.getStaffAlerts();
      setAlerts(Array.isArray(list) ? list : []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 8000);

    let es;
    try {
      es = new EventSource(api.staffAlertsStreamUrl());
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'alert' && payload.alert) {
            setAlerts((prev) => {
              if (prev.some((a) => a.id === payload.alert.id)) return prev;
              return [...prev, payload.alert];
            });
          }
          if (payload.type === 'alert_attended' && payload.id) {
            setAlerts((prev) => prev.filter((a) => a.id !== payload.id));
          }
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* EventSource unavailable */
    }

    return () => {
      clearInterval(poll);
      es?.close();
    };
  }, [load]);

  async function attend(id) {
    try {
      await api.attendStaffAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  if (!alerts.length && !error) return null;

  return (
    <div className="staff-alerts" role="status">
      {error && <div className="alert">{error}</div>}
      {alerts.map((alert) => (
        <div key={alert.id} className="staff-alert-card">
          <div>
            <p className="eyebrow">Solicitud del cliente</p>
            <strong>
              {alert.table_number != null
                ? `Mesa ${alert.table_number}`
                : 'Para llevar'}{' '}
              · Pedido #{alert.order_id}
            </strong>
            <p className="muted">
              Quiere terminar el pedido · {formatTime(alert.created_at)} · S/{' '}
              {Number(alert.total).toFixed(2)}
            </p>
          </div>
          <div className="staff-alert-actions">
            <Link className="btn small" to={pedidosPath}>
              Ir a pedidos
            </Link>
            <button type="button" className="btn small primary" onClick={() => attend(alert.id)}>
              Atendida
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
