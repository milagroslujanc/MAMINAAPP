import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import StaffAlertsBanner from '../components/StaffAlertsBanner';
import { clearStaffSession } from '../auth';

function openTakeOrderWindow(role, sessionToken, label) {
  const base = role === 'admin' ? '/admin/tomar-pedido' : '/mesero/tomar-pedido';
  const url = `${base}?session=${encodeURIComponent(sessionToken)}&label=${encodeURIComponent(label)}`;
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    // Popup bloqueado: navegar en la misma pestaña
    window.location.href = url;
  }
}

/**
 * Apertura de mesas e inicio de pedidos sin QR (mesero / admin).
 * La toma de pedido se abre en una ventana nueva.
 */
export default function StaffFloorPage({ roleRequired }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [staff, setStaff] = useState(null);
  const [tables, setTables] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const list = await api.getFloorTables();
    setTables(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const data = await api.me();
        const role = data.admin?.role || 'admin';

        if (roleRequired === 'admin' && role === 'mesero') {
          navigate('/mesero/mesas', { replace: true });
          return;
        }
        if (roleRequired === 'mesero' && role !== 'mesero' && role !== 'admin') {
          navigate('/mesero', { replace: true });
          return;
        }

        const floor = await api.getFloorTables();
        if (!cancelled) {
          setStaff(data.admin);
          setTables(Array.isArray(floor) ? floor : []);
          setReady(true);
        }
      } catch {
        clearStaffSession();
        navigate(roleRequired === 'mesero' ? '/mesero' : '/admin', { replace: true });
      }
    }

    init();
    const poll = setInterval(() => {
      load().catch(() => {});
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [load, navigate, roleRequired]);

  async function openTable(table) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.openFloorTable(table.id);
      setSuccess(result.message);
      await load();
      openTakeOrderWindow(
        staff?.role || roleRequired,
        result.session.token,
        `Mesa ${result.table.number}`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openTakeaway() {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.openFloorTakeaway();
      setSuccess(result.message);
      openTakeOrderWindow(staff?.role || roleRequired, result.session.token, 'Para llevar');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startOrderOnOccupied(table) {
    if (!table.sessionToken) {
      setError('La mesa no tiene sesión activa');
      return;
    }
    setError('');
    setSuccess('');
    openTakeOrderWindow(
      staff?.role || roleRequired,
      table.sessionToken,
      `Mesa ${table.number}`
    );
  }

  function logout() {
    clearStaffSession();
    navigate(staff?.role === 'mesero' ? '/mesero' : '/admin');
  }

  if (!ready) {
    return (
      <section className="center-card">
        <p className="muted">Cargando mesas…</p>
      </section>
    );
  }

  const pedidosPath = staff?.role === 'admin' ? '/admin/pedidos' : '/mesero/pedidos';
  const panelLink = staff?.role === 'admin' ? '/admin/panel' : null;

  return (
    <section className="staff-floor">
      <div className="admin-menu-header">
        <div>
          <p className="eyebrow">
            {staff?.role === 'mesero' ? 'Mesero' : 'Administrador'} · Salón
          </p>
          <h1>Mesas y pedidos</h1>
          <p className="muted">
            Apertura mesas e inicia pedidos sin escanear QR. “Tomar pedido” abre una ventana nueva.
          </p>
        </div>
        <div className="admin-actions">
          {panelLink && (
            <Link className="btn" to={panelLink}>
              Panel
            </Link>
          )}
          <Link className="btn" to={pedidosPath}>
            Pedidos
          </Link>
          <button type="button" className="btn" onClick={load}>
            Refrescar
          </button>
          <button type="button" className="btn" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <StaffAlertsBanner pedidosPath={pedidosPath} />

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert ok">{success}</div>}

      <div className="floor-actions">
        <button type="button" className="btn primary" disabled={busy} onClick={openTakeaway}>
          Iniciar pedido para llevar
        </button>
      </div>

      <div className="tables-grid floor-tables">
        {tables.map((table) => (
          <article key={table.id} className={`table-tile ${table.status} floor-tile`}>
            <span className="table-num">Mesa {table.number}</span>
            <span className="table-meta">{table.capacity} pers.</span>
            <span className="table-status">{table.status}</span>
            {table.status === 'libre' ? (
              <button
                type="button"
                className="btn small"
                disabled={busy}
                onClick={() => openTable(table)}
              >
                Aperturar
              </button>
            ) : (
              <button
                type="button"
                className="btn small primary"
                disabled={!table.sessionToken}
                onClick={() => startOrderOnOccupied(table)}
              >
                Tomar pedido
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
