import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ConfirmModal from './ConfirmModal';

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
  const [confirmAlert, setConfirmAlert] = useState(null);
  const [saving, setSaving] = useState(false);

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

  async function finishAlertOrder() {
    if (!confirmAlert?.order_id) return;
    const alert = confirmAlert;
    setConfirmAlert(null);
    setSaving(true);
    setError('');
    try {
      await api.closeAdminOrderSession(alert.order_id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id && a.order_id !== alert.order_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!alerts.length && !error && !confirmAlert) return null;

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
            <button
              type="button"
              className="btn small primary"
              disabled={saving}
              onClick={() => setConfirmAlert(alert)}
            >
              Finalizar atención
            </button>
          </div>
        </div>
      ))}
      <ConfirmModal
        open={Boolean(confirmAlert)}
        title="Finalizar atención"
        message={`¿Terminar el pedido #${confirmAlert?.order_id}? Se marcará como entregado, se liberará la mesa (si aplica), se cerrará la sesión del cliente y pasará al historial.`}
        confirmLabel="Finalizar atención"
        onCancel={() => setConfirmAlert(null)}
        onConfirm={finishAlertOrder}
      />
    </div>
  );
}
