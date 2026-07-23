import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function AdminHomePage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const raw = localStorage.getItem('mamina_admin');
      if (!raw) {
        navigate('/admin', { replace: true });
        return;
      }

      try {
        const data = await api.me();
        if (!cancelled) {
          setAdmin(data.admin);
          setChecking(false);
        }
      } catch {
        localStorage.removeItem('mamina_admin');
        if (!cancelled) navigate('/admin', { replace: true });
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function logout() {
    localStorage.removeItem('mamina_admin');
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
      <p className="eyebrow">Bienvenido</p>
      <h1>{admin.fullName || admin.username}</h1>
      <p className="muted">
        Autenticación completada (MMN-16). El dashboard y la gestión de menú/mesas llegan en
        sprints siguientes.
      </p>
      <div className="admin-actions">
        <Link className="btn" to="/">
          Ver recepción
        </Link>
        <Link className="btn" to="/cocina">
          Ver cocina
        </Link>
        <button type="button" className="btn primary" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </section>
  );
}
