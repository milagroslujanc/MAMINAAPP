import { Routes, Route, NavLink } from 'react-router-dom';
import EntrancePage from './pages/EntrancePage.jsx';
import SessionBridgePage from './pages/SessionBridgePage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import KitchenPage from './pages/KitchenPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import AdminHomePage from './pages/AdminHomePage.jsx';
import AdminMenuPage from './pages/AdminMenuPage.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img src="/mamina.png" alt="La Mamina" className="brand-logo" width="40" height="40" />
          <span className="brand-text">La Mamina</span>
        </NavLink>
        <nav className="nav-links">
          <NavLink to="/">Recepción</NavLink>
          <NavLink to="/cocina">Cocina</NavLink>
          <NavLink to="/admin">Admin</NavLink>
        </nav>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<EntrancePage />} />
          <Route path="/s/:token" element={<SessionBridgePage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/cocina" element={<KitchenPage />} />
          <Route path="/admin" element={<AdminLoginPage />} />
          <Route path="/admin/panel" element={<AdminHomePage />} />
          <Route path="/admin/menu" element={<AdminMenuPage />} />
        </Routes>
      </main>
    </div>
  );
}
