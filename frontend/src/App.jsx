import { useEffect } from 'react';
import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import EntrancePage from './pages/EntrancePage.jsx';
import SessionBridgePage from './pages/SessionBridgePage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import KitchenPage from './pages/KitchenPage.jsx';
import StaffLoginPage from './pages/StaffLoginPage.jsx';
import AdminHomePage from './pages/AdminHomePage.jsx';
import AdminStatsPage from './pages/AdminStatsPage.jsx';
import AdminMenuPage from './pages/AdminMenuPage.jsx';
import AdminTablesPage from './pages/AdminTablesPage.jsx';
import StaffOrdersPage from './pages/StaffOrdersPage.jsx';
import StaffFloorPage from './pages/StaffFloorPage.jsx';
import StaffOrderTakePage from './pages/StaffOrderTakePage.jsx';
import { clearStaffSession, getStaffSession } from './auth';
import { api } from './api';

function StaffAccessGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const role = location.pathname.startsWith('/cocina')
      ? 'cocina'
      : location.pathname.startsWith('/mesero')
        ? 'mesero'
        : null;
    const session = role ? getStaffSession(role) : null;
    if (!role || !session?.token) return undefined;

    const stream = new EventSource(api.staffAccessStreamUrl());
    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'access_closed') {
          clearStaffSession(role);
          stream.close();
          navigate(`/${role}`, {
            replace: true,
            state: { message: 'Acceso no disponible' },
          });
        }
      } catch {
        // Ignore malformed keep-alive data.
      }
    };

    return () => stream.close();
  }, [location.pathname, navigate]);

  return null;
}

export default function App() {
  return (
    <div className="app-shell">
      <StaffAccessGuard />
      <header className="topbar">
        <NavLink to="/" className="brand" end>
          <img src="/mamina.png" alt="La Mamina" className="brand-logo" width="40" height="40" />
          <span className="brand-text">La Mamina</span>
        </NavLink>
      </header>

      <main className="main">
        <Routes>
          {/* Cliente */}
          <Route path="/" element={<EntrancePage />} />
          <Route path="/s/:token" element={<SessionBridgePage />} />
          <Route path="/menu" element={<MenuPage />} />

          {/* Cocina */}
          <Route path="/cocina" element={<StaffLoginPage expectedRole="cocina" />} />
          <Route path="/cocina/pedidos" element={<KitchenPage />} />

          {/* Administrador */}
          <Route path="/admin" element={<StaffLoginPage expectedRole="admin" />} />
          <Route path="/admin/panel" element={<AdminHomePage />} />
          <Route path="/admin/estadisticas" element={<AdminStatsPage />} />
          <Route path="/admin/menu" element={<AdminMenuPage />} />
          <Route path="/admin/mesas" element={<AdminTablesPage />} />
          <Route path="/admin/salon" element={<StaffFloorPage roleRequired="admin" />} />
          <Route path="/admin/tomar-pedido" element={<StaffOrderTakePage />} />
          <Route path="/admin/pedidos" element={<StaffOrdersPage roleRequired="admin" />} />

          {/* Mesero */}
          <Route path="/mesero" element={<StaffLoginPage expectedRole="mesero" />} />
          <Route path="/mesero/mesas" element={<StaffFloorPage roleRequired="mesero" />} />
          <Route path="/mesero/tomar-pedido" element={<StaffOrderTakePage />} />
          <Route path="/mesero/pedidos" element={<StaffOrdersPage roleRequired="mesero" />} />
        </Routes>
      </main>
    </div>
  );
}
