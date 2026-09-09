import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { clearStaffSession, homeForRole } from '../auth';

const sections = [
  { label: 'Inicio', to: '/admin/panel/inicio', end: true },
  { label: 'Pedidos', to: '/admin/panel/pedidos' },
  { label: 'Menú', to: '/admin/panel/menu' },
  { label: 'Mesas', to: '/admin/panel/mesas' },
  { label: 'Salón sin QR', to: '/admin/panel/salon' },
  { label: 'Control de acceso', to: '/admin/panel/acceso' },
];

export default function AdminLayout() {
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

  if (checking || !admin) {
    return (
      <section className="admin-loading" aria-live="polite">
        <p className="muted">Verificando sesión…</p>
      </section>
    );
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <img src="/mamina.png" alt="La Mamina" className="brand-logo" width="40" height="40" />
          <span className="brand-text">La Mamina</span>
        </div>

        <nav className="admin-nav" aria-label="Navegación del administrador">
          <NavLink
            to={sections[0].to}
            end={sections[0].end}
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
          >
            {sections[0].label}
          </NavLink>
          <p className="admin-nav-heading">Gestión</p>
          {sections.slice(1).map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              {section.label}
            </NavLink>
          ))}
        </nav>

        <button type="button" className="admin-logout" onClick={logout}>
          Cerrar sesión
        </button>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <span className="admin-role">Administrador</span>
        </header>
        <main className="admin-page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
