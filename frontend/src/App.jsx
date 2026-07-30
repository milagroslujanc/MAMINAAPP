import { Routes, Route, NavLink } from 'react-router-dom';
import EntrancePage from './pages/EntrancePage.jsx';
import SessionBridgePage from './pages/SessionBridgePage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import KitchenPage from './pages/KitchenPage.jsx';
import StaffLoginPage from './pages/StaffLoginPage.jsx';
import AdminHomePage from './pages/AdminHomePage.jsx';
import AdminMenuPage from './pages/AdminMenuPage.jsx';
import AdminTablesPage from './pages/AdminTablesPage.jsx';
import StaffOrdersPage from './pages/StaffOrdersPage.jsx';

export default function App() {
  return (
    <div className="app-shell">
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
          <Route path="/cocina" element={<KitchenPage />} />

          {/* Administrador */}
          <Route path="/admin" element={<StaffLoginPage expectedRole="admin" />} />
          <Route path="/admin/panel" element={<AdminHomePage />} />
          <Route path="/admin/menu" element={<AdminMenuPage />} />
          <Route path="/admin/mesas" element={<AdminTablesPage />} />
          <Route path="/admin/pedidos" element={<StaffOrdersPage roleRequired="admin" />} />

          {/* Mesero */}
          <Route path="/mesero" element={<StaffLoginPage expectedRole="mesero" />} />
          <Route path="/mesero/pedidos" element={<StaffOrdersPage roleRequired="mesero" />} />
        </Routes>
      </main>
    </div>
  );
}
