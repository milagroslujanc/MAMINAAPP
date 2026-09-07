import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { clearStaffSession, homeForRole } from '../auth';

export default function AdminHomePage() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);
  const [staffAccess, setStaffAccess] = useState({});
  const [accessError, setAccessError] = useState('');
  const [savingRole, setSavingRole] = useState(null);

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
          const access = await api.getStaffAccess();
          if (!cancelled) setStaffAccess(access);
          setChecking(false);
        }
      } catch {
        clearStaffSession('admin');
        if (!cancelled) navigate('/admin', { replace: true });
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function logout() {
    clearStaffSession('admin');
    navigate('/admin');
  }

  async function toggleAccess(role) {
    const isOpen = !staffAccess[role]?.isOpen;
    setSavingRole(role);
    setAccessError('');
    try {
      const result = await api.setStaffAccess(role, isOpen);
      setStaffAccess((prev) => ({ ...prev, [role]: result }));
    } catch (err) {
      setAccessError(err.message);
    } finally {
      setSavingRole(null);
    }
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
      <div className="staff-access-panel">
        <div>
          <p className="eyebrow">Disponibilidad de personal</p>
          <p className="muted">Cierra el acceso para desconectar las sesiones activas de ese rol.</p>
        </div>
        <div className="staff-access-actions">
          {['cocina', 'mesero'].map((role) => {
            const isOpen = staffAccess[role]?.isOpen !== false;
            return (
              <button
                key={role}
                type="button"
                className={`btn ${isOpen ? 'primary' : ''}`}
                aria-pressed={isOpen}
                disabled={savingRole === role}
                onClick={() => toggleAccess(role)}
              >
                {role === 'cocina' ? 'Cocina' : 'Mesero'}: {isOpen ? 'Abierto' : 'Cerrado'}
              </button>
            );
          })}
        </div>
        {accessError && <div className="alert">{accessError}</div>}
      </div>
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
