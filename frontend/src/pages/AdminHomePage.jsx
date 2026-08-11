import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { clearStaffSession, homeForRole } from '../auth';

export default function AdminHomePage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        const data = await api.me();
        if (data.admin?.role !== 'admin') {
          navigate(homeForRole(data.admin?.role), { replace: true });
          return;
        }
        if (!cancelled) {
          setAdmin(data.admin);
          setChecking(false);
        }
      } catch {
        clearStaffSession();
        if (!cancelled) navigate('/admin', { replace: true });
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function logout() {
    clearStaffSession();
    navigate('/admin');
  }

  if (checking || !admin) {
    return (
      <section className="center-card">
        <p className="muted">Verificando sesión…</p>
      </section>
    );
  }

  return (
    <section className="center-card">
      <p className="eyebrow">Administrador</p>
      <h1>{admin.fullName || admin.username}</h1>
      <p className="muted">
        Acceso total: menú, mesas y pedidos de clientes.
      </p>
      <div className="admin-actions">
        <Link className="btn" to="/admin/estadisticas">
          Ver estadísticas
        </Link>
        <Link className="btn primary" to="/admin/pedidos">
          Gestionar pedidos
        </Link>
        <Link className="btn primary" to="/admin/salon">
          Salón (mesas sin QR)
        </Link>
        <Link className="btn primary" to="/admin/menu">
          Gestionar menú
        </Link>
        <Link className="btn primary" to="/admin/mesas">
          Gestionar mesas
        </Link>
        <button type="button" className="btn" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </section>
  );
}
