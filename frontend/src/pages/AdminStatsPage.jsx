import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { clearStaffSession, homeForRole } from '../auth';

function formatMoney(value) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    maximumFractionDigits: 2,
  }).format(value);
}

function StatCard({ title, value, subtitle }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{title}</p>
      <p className="stat-value">{value}</p>
      {subtitle && <p className="stat-subtitle">{subtitle}</p>}
    </article>
  );
}

export default function AdminStatsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const me = await api.me();
        if (me.admin?.role !== 'admin') {
          navigate(homeForRole(me.admin?.role), { replace: true });
          return;
        }
        const data = await api.getAdminStats();
        if (!cancelled) {
          setStats(data);
          setLoading(false);
        }
      } catch (err) {
        clearStaffSession();
        if (!cancelled) {
          setError(err.message || 'No se pudieron cargar las estadísticas');
          setLoading(false);
        }
      }
    }

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (loading) {
    return (
      <section className="center-card">
        <p className="muted">Cargando estadísticas…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="center-card">
        <div className="alert">{error}</div>
        <Link className="btn" to="/admin/panel">
          Volver al panel
        </Link>
      </section>
    );
  }

  return (
    <section className="admin-stats-page">
      <div className="admin-menu-header">
        <div>
          <p className="eyebrow">Estadísticas administrativas</p>
          <h1>Visión general</h1>
          <p className="muted">
            Ingresos, pedidos completados y clientes que escanearon QR en el día, mes y año.
          </p>
        </div>
        <div className="admin-actions">
          <Link className="btn" to="/admin/panel">
            Volver al panel
          </Link>
          <Link className="btn" to="/admin/pedidos">
            Ver pedidos
          </Link>
        </div>
      </div>

      <div className="admin-stats-grid">
        <section className="stat-section">
          <div className="section-header">
            <p className="eyebrow">Ingresos</p>
            <h2>Ventas entregadas</h2>
          </div>
          <div className="stat-grid">
            <StatCard title="Hoy" value={formatMoney(stats.daily.revenue)} />
            <StatCard title="Este mes" value={formatMoney(stats.monthly.revenue)} />
            <StatCard title="Este año" value={formatMoney(stats.yearly.revenue)} />
          </div>
        </section>

        <section className="stat-section">
          <div className="section-header">
            <p className="eyebrow">Pedidos completados</p>
            <h2>Pedidos entregados</h2>
          </div>
          <div className="stat-grid">
            <StatCard title="Hoy" value={stats.daily.completedOrders} />
            <StatCard title="Este mes" value={stats.monthly.completedOrders} />
            <StatCard title="Este año" value={stats.yearly.completedOrders} />
          </div>
        </section>

        <section className="stat-section">
          <div className="section-header">
            <p className="eyebrow">Clientes QR</p>
            <h2>Clientes que escanearon el QR</h2>
          </div>
          <div className="stat-grid">
            <StatCard title="Hoy" value={stats.daily.clients} subtitle="Clientes únicos" />
            <StatCard title="Este mes" value={stats.monthly.clients} subtitle="Clientes únicos" />
            <StatCard title="Este año" value={stats.yearly.clients} subtitle="Clientes únicos" />
          </div>
        </section>
      </div>
    </section>
  );
}
