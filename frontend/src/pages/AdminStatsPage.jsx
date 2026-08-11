import { useEffect, useMemo, useState } from 'react';
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

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toInputDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function StatCard({ title, value, subtitle, active, onClick }) {
  const Tag = onClick ? 'button' : 'article';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`stat-card ${onClick ? 'stat-card-button' : ''} ${active ? 'is-active' : ''}`}
      onClick={onClick}
    >
      <p className="stat-label">{title}</p>
      <p className="stat-value">{value}</p>
      {subtitle && <p className="stat-subtitle">{subtitle}</p>}
    </Tag>
  );
}

function SalesHistogram({ histogram }) {
  if (!histogram) return null;

  const days = Math.max(histogram.daysInCurrentMonth || 31, histogram.daysInPreviousMonth || 31);
  const currentMap = new Map((histogram.currentMonth || []).map((d) => [d.day, d.total]));
  const previousMap = new Map((histogram.previousMonth || []).map((d) => [d.day, d.total]));

  const max = Math.max(
    1,
    ...Array.from({ length: days }, (_, i) => {
      const day = i + 1;
      return Math.max(currentMap.get(day) || 0, previousMap.get(day) || 0);
    })
  );

  const width = 720;
  const height = 220;
  const pad = { top: 16, right: 12, bottom: 28, left: 44 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const barGroup = chartW / days;
  const barW = Math.max(2, barGroup * 0.35);

  return (
    <section className="stat-section sales-histogram-section">
      <div className="section-header">
        <p className="eyebrow">Comparativo</p>
        <h2>Ventas por día</h2>
        <p className="muted">
          Mes actual ({histogram.currentMonthLabel}) sobre el mes anterior (
          {histogram.previousMonthLabel}).
        </p>
      </div>
      <div className="histogram-legend">
        <span className="legend-current">Mes actual</span>
        <span className="legend-previous">Mes anterior</span>
      </div>
      <div className="histogram-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="sales-histogram" role="img">
          <title>Histograma de ventas diarias</title>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = pad.top + chartH * (1 - t);
            return (
              <g key={t}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y}
                  y2={y}
                  className="hist-grid"
                />
                <text x={pad.left - 8} y={y + 4} textAnchor="end" className="hist-axis">
                  {Math.round(max * t)}
                </text>
              </g>
            );
          })}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const prev = previousMap.get(day) || 0;
            const curr = currentMap.get(day) || 0;
            const x = pad.left + i * barGroup + barGroup / 2;
            const prevH = (prev / max) * chartH;
            const currH = (curr / max) * chartH;
            return (
              <g key={day}>
                <rect
                  x={x - barW - 1}
                  y={pad.top + chartH - prevH}
                  width={barW}
                  height={prevH}
                  className="hist-bar-prev"
                />
                <rect
                  x={x + 1}
                  y={pad.top + chartH - currH}
                  width={barW}
                  height={currH}
                  className="hist-bar-curr"
                />
                {(day === 1 || day % 5 === 0 || day === days) && (
                  <text
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    className="hist-axis"
                  >
                    {day}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

export default function AdminStatsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [salesOpen, setSalesOpen] = useState(false);
  const [preset, setPreset] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sales, setSales] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  const rangePresets = useMemo(() => {
    const today = new Date();
    const startYear = new Date(today.getFullYear(), 0, 1);
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      today: { from: toInputDate(today), to: toInputDate(today) },
      month: { from: toInputDate(startMonth), to: toInputDate(today) },
      year: { from: toInputDate(startYear), to: toInputDate(today) },
    };
  }, []);

  function applyPreset(key) {
    const range = rangePresets[key];
    if (!range) return;
    setPreset(key);
    setFrom(range.from);
    setTo(range.to);
  }

  async function loadSales(rangeFrom = from, rangeTo = to) {
    if (!rangeFrom || !rangeTo) return;
    setSalesLoading(true);
    setSalesError('');
    try {
      const data = await api.getAdminStatsOrders(rangeFrom, rangeTo);
      setSales(data);
    } catch (err) {
      setSalesError(err.message);
      setSales(null);
    } finally {
      setSalesLoading(false);
    }
  }

  function openSalesWithPreset(key) {
    const range = rangePresets[key] || rangePresets.month;
    setSalesOpen(true);
    setPreset(key);
    setFrom(range.from);
    setTo(range.to);
    loadSales(range.from, range.to);
  }

  async function openDetail(orderId) {
    setDetailLoading(true);
    try {
      const data = await api.getAdminOrder(orderId);
      setDetail(data);
    } catch (err) {
      setSalesError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function exportCsv() {
    if (!sales?.orders?.length) return;
    const header = ['id', 'fecha', 'mesa', 'tipo', 'estado', 'total'];
    const lines = sales.orders.map((o) =>
      [
        o.id,
        formatDateTime(o.created_at),
        o.order_type === 'llevar' ? 'Para llevar' : o.table_number ?? '',
        o.order_type,
        o.status,
        Number(o.total).toFixed(2),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = `\uFEFF${header.join(',')}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${sales.from}_${sales.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    if (!sales?.orders) return;
    const rows = sales.orders
      .map(
        (o) => `<tr>
          <td>${o.id}</td>
          <td>${formatDateTime(o.created_at)}</td>
          <td>${o.order_type === 'llevar' ? 'Para llevar' : `Mesa ${o.table_number ?? '—'}`}</td>
          <td>${o.status}</td>
          <td>${formatMoney(o.total)}</td>
        </tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ventas ${sales.from} - ${sales.to}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#222}
        h1{font-size:18px;margin:0 0 8px}
        p{margin:0 0 16px;color:#555}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
        th{background:#f3f3f3}
      </style></head><body>
      <h1>Ventas entregadas</h1>
      <p>Rango ${sales.from} → ${sales.to} · Total ${formatMoney(sales.totalSales)} · ${sales.count} pedidos</p>
      <table><thead><tr><th>#</th><th>Fecha</th><th>Mesa</th><th>Estado</th><th>Total</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">Sin pedidos</td></tr>'}</tbody></table>
      <script>window.onload=()=>{window.print()}</script>
      </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

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

      <SalesHistogram histogram={stats.salesHistogram} />

      <div className="admin-stats-grid">
        <section className="stat-section">
          <div className="section-header">
            <p className="eyebrow">Ingresos</p>
            <h2>Ventas entregadas</h2>
            <p className="muted">Haz clic en un período para explorar el detalle.</p>
          </div>
          <div className="stat-grid">
            <StatCard
              title="Hoy"
              value={formatMoney(stats.daily.revenue)}
              active={salesOpen && preset === 'today'}
              onClick={() => openSalesWithPreset('today')}
            />
            <StatCard
              title="Este mes"
              value={formatMoney(stats.monthly.revenue)}
              active={salesOpen && preset === 'month'}
              onClick={() => openSalesWithPreset('month')}
            />
            <StatCard
              title="Este año"
              value={formatMoney(stats.yearly.revenue)}
              active={salesOpen && preset === 'year'}
              onClick={() => openSalesWithPreset('year')}
            />
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

      {salesOpen && (
        <section className="stat-section sales-explorer">
          <div className="section-header">
            <p className="eyebrow">Detalle de ventas</p>
            <h2>Pedidos entregados por rango</h2>
          </div>

          <div className="sales-filters">
            <div className="menu-tabs sales-presets">
              <button
                type="button"
                className={`tab-button ${preset === 'today' ? 'active' : ''}`}
                onClick={() => {
                  applyPreset('today');
                  loadSales(rangePresets.today.from, rangePresets.today.to);
                }}
              >
                Hoy
              </button>
              <button
                type="button"
                className={`tab-button ${preset === 'month' ? 'active' : ''}`}
                onClick={() => {
                  applyPreset('month');
                  loadSales(rangePresets.month.from, rangePresets.month.to);
                }}
              >
                Este mes
              </button>
              <button
                type="button"
                className={`tab-button ${preset === 'year' ? 'active' : ''}`}
                onClick={() => {
                  applyPreset('year');
                  loadSales(rangePresets.year.from, rangePresets.year.to);
                }}
              >
                Este año
              </button>
            </div>

            <label>
              Desde
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setPreset('custom');
                  setFrom(e.target.value);
                }}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setPreset('custom');
                  setTo(e.target.value);
                }}
              />
            </label>
            <button
              type="button"
              className="btn primary"
              disabled={salesLoading || !from || !to}
              onClick={() => loadSales(from, to)}
            >
              Buscar
            </button>
            <button
              type="button"
              className="btn"
              disabled={!sales?.orders?.length}
              onClick={exportCsv}
            >
              Exportar CSV
            </button>
            <button
              type="button"
              className="btn"
              disabled={!sales?.orders?.length}
              onClick={exportPdf}
            >
              Exportar PDF
            </button>
          </div>

          {salesError && <div className="alert">{salesError}</div>}
          {salesLoading && <p className="muted">Buscando pedidos…</p>}

          {sales && !salesLoading && (
            <>
              <p className="sales-total-banner">
                Total ventas del rango: <strong>{formatMoney(sales.totalSales)}</strong>
                <span className="muted"> · {sales.count} pedidos</span>
              </p>

              <div className="orders-table-wrap">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Fecha y hora</th>
                      <th>Mesa / Destino</th>
                      <th>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {!sales.orders.length && (
                      <tr>
                        <td colSpan={5} className="muted">
                          No hay pedidos entregados en este rango.
                        </td>
                      </tr>
                    )}
                    {sales.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>{order.id}</strong>
                        </td>
                        <td>{formatDateTime(order.created_at)}</td>
                        <td>
                          {order.order_type === 'llevar'
                            ? 'Para llevar'
                            : `Mesa ${order.table_number ?? '—'}`}
                        </td>
                        <td>{formatMoney(order.total)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn small"
                            disabled={detailLoading}
                            onClick={() => openDetail(order.id)}
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {detail && (
        <div className="modal-backdrop" role="presentation" onClick={() => setDetail(null)}>
          <div
            className="modal-card order-detail-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cart-head">
              <h2>Pedido #{detail.id}</h2>
              <button type="button" className="linkish" onClick={() => setDetail(null)}>
                Cerrar
              </button>
            </div>
            <p className="muted">
              {detail.order_type === 'llevar'
                ? 'Para llevar'
                : `Mesa ${detail.table_number ?? '—'}`}{' '}
              · {formatDateTime(detail.created_at)}
            </p>
            <ul className="detail-items">
              {(detail.items || []).map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>
                      {item.quantity}× {item.product_name}
                    </strong>
                    <span>S/ {(item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                  {item.special_notes && (
                    <p className="note-highlight">Nota: {item.special_notes}</p>
                  )}
                </li>
              ))}
            </ul>
            <p className="total-row">
              <span>Total</span>
              <strong>S/ {Number(detail.total).toFixed(2)}</strong>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
