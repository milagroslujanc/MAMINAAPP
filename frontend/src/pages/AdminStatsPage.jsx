import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { clearStaffSession, homeForRole } from '../auth';

function formatMoney(value) {
  const amount = Number(value);
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
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

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getTrend(current, previous) {
  const currentValue = safeNumber(current);
  const previousValue = Number(previous);
  if (!Number.isFinite(previousValue)) return 'same';
  if (currentValue > previousValue) return 'up';
  if (currentValue < previousValue) return 'down';
  return 'same';
}

function TrendIndicator({ current, previous }) {
  const trend = getTrend(current, previous);
  const labels = { up: 'Subió', down: 'Bajó', same: 'Igual' };
  const icons = { up: '↑', down: '↓', same: '→' };
  return (
    <span className={`trend-indicator trend-${trend}`}>
      <span className="trend-icon" aria-hidden="true">{icons[trend]}</span>
      {labels[trend]}
    </span>
  );
}

function formatPercentChange(current, previous) {
  const currentValue = safeNumber(current);
  const previousValue = safeNumber(previous);
  if (previousValue === 0) return null;
  return ((currentValue - previousValue) / previousValue) * 100;
}

function PeriodSummary({ title, current, previous, formatValue }) {
  const change = formatPercentChange(current, previous);
  const trend = getTrend(current, previous);
  return (
    <article className="period-summary-card">
      <p className="stat-label">{title}</p>
      <p className="period-summary-value">{formatValue(current)}</p>
      {change === null ? (
        <p className="period-summary-note">Sin datos del período anterior</p>
      ) : (
        <p className={`period-summary-note trend-${trend}`}>
          <span className="trend-icon" aria-hidden="true">{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
          {change === 0 ? 'Igual que antes' : `${Math.abs(change).toFixed(1)}% vs. período anterior`}
        </p>
      )}
    </article>
  );
}

function StatCard({ title, value, current, previous, icon, active, onClick }) {
  const Tag = onClick ? 'button' : 'article';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`stat-card ${onClick ? 'stat-card-button' : ''} ${active ? 'is-active' : ''}`}
      onClick={onClick}
    >
      <div className="stat-card-heading">
        <span className="stat-icon" aria-hidden="true">{icon}</span>
        <p className="stat-label">{title}</p>
      </div>
      <p className="stat-value">{value}</p>
      <TrendIndicator current={current} previous={previous} />
    </Tag>
  );
}

function SalesPeriodChart({ period, sales, monthlySales }) {
  const today = new Date();
  const salesMap = new Map((sales || []).map((item) => [
    String(item.date).slice(0, 10),
    safeNumber(item.total),
  ]));
  const days = period === 'month'
    ? Array.from({ length: Math.max(5, monthlySales?.length || 0) }, (_, index) => ({
        key: `week-${index + 1}`,
        label: `Sem. ${index + 1}`,
        total: safeNumber(monthlySales?.find((item) => item.week === index + 1)?.total),
        isToday: false,
      }))
    : Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index);
        return {
          key: toInputDate(date),
          label: date.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', ''),
          total: salesMap.get(toInputDate(date)) || 0,
          isToday: index === 6,
        };
      });
  const max = Math.max(1, ...days.map((day) => day.total));

  const width = 720;
  const height = 220;
  const pad = { top: 16, right: 12, bottom: 28, left: 44 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const barGroup = chartW / days.length;
  const barW = Math.max(28, barGroup * 0.55);

  return (
    <section className="stat-section sales-histogram-section">
      <div className="section-header">
        <p className="eyebrow">{period === 'month' ? 'Este mes' : 'Últimos días'}</p>
        <h2>{period === 'month' ? 'Ventas de este mes' : 'Ventas de los últimos 7 días'}</h2>
        <p className="muted">
          {period === 'month'
            ? 'Las ventas están agrupadas por semanas para verlo con claridad.'
            : 'Hoy está resaltado para que puedas encontrarlo rápidamente.'}
        </p>
      </div>
      <div className="histogram-legend">
        <span className="legend-seven-days">Ventas</span>
        {period === 'sevenDays' && <span className="legend-today">Hoy</span>}
      </div>
      <div className="histogram-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="sales-histogram" role="img">
          <title>{period === 'month' ? 'Ventas de este mes' : 'Ventas de los últimos 7 días'}</title>
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
          {days.map((day, index) => {
            const barHeight = (day.total / max) * chartH;
            const x = pad.left + index * barGroup + barGroup / 2;
            return (
              <g key={day.key}>
                <rect
                  x={x - barW / 2}
                  y={pad.top + chartH - barHeight}
                  width={barW}
                  height={barHeight}
                  className={day.isToday ? 'hist-bar-today' : 'hist-bar-seven-days'}
                />
                <text x={x} y={height - 8} textAnchor="middle" className="hist-axis">
                  {day.isToday ? 'Hoy' : day.label}
                </text>
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
  const [salesPeriod, setSalesPeriod] = useState('sevenDays');
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
        clearStaffSession('admin');
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
      </section>
    );
  }

  const selectedPeriod = salesPeriod === 'month'
    ? stats.periods?.currentMonth
    : stats.periods?.last7Days;
  const previousPeriod = salesPeriod === 'month'
    ? stats.periods?.previousMonth
    : stats.periods?.previous7Days;

  return (
    <section className="admin-stats-page">
      <div className="admin-menu-header">
        <div>
              <p className="eyebrow">Resumen sencillo</p>
              <h1>¿Cómo va el negocio hoy?</h1>
          <p className="muted">
                Aquí puedes ver rápidamente cómo estuvo el día en ventas, pedidos y clientes.
          </p>
        </div>
      </div>

          <section className="today-sales-card" aria-labelledby="today-sales-title">
            <div>
              <p className="eyebrow">Lo más importante</p>
              <h2 id="today-sales-title">Ventas de hoy</h2>
              <p className="today-sales-value">{formatMoney(stats.daily.revenue)}</p>
              {Number.isFinite(Number(stats.yesterday?.revenue)) ? (
                <p className={`today-sales-comparison trend-${getTrend(stats.daily.revenue, stats.yesterday.revenue)}`}>
                  {getTrend(stats.daily.revenue, stats.yesterday.revenue) === 'up' && (
                    <span className="trend-icon" aria-hidden="true">↑</span>
                  )}
                  {getTrend(stats.daily.revenue, stats.yesterday.revenue) === 'down' && (
                    <span className="trend-icon" aria-hidden="true">↓</span>
                  )}
                  {getTrend(stats.daily.revenue, stats.yesterday.revenue) === 'up' &&
                    `Hoy vendiste más que ayer (ayer: ${formatMoney(stats.yesterday.revenue)})`}
                  {getTrend(stats.daily.revenue, stats.yesterday.revenue) === 'down' &&
                    `Hoy vendiste menos que ayer (ayer: ${formatMoney(stats.yesterday.revenue)})`}
                  {getTrend(stats.daily.revenue, stats.yesterday.revenue) === 'same' &&
                    (safeNumber(stats.daily.revenue) === 0
                      ? 'Sin ventas hoy ni ayer'
                      : 'Igual que ayer')}
                </p>
              ) : (
                <p className="today-sales-comparison">Todavía no hay datos de ayer para comparar.</p>
              )}
            </div>
            <button
              type="button"
              className="btn primary today-sales-detail"
              onClick={() => openSalesWithPreset('today')}
            >
              Ver detalle de hoy
            </button>
          </section>

      <div className="admin-stats-grid">
            <StatCard
              title="Ventas"
              value={formatMoney(stats.daily.revenue)}
              current={stats.daily.revenue}
              previous={stats.yesterday?.revenue}
              icon="$"
            />
            <StatCard
              title="Pedidos"
              value={safeNumber(stats.daily.completedOrders)}
              current={stats.daily.completedOrders}
              previous={stats.yesterday?.completedOrders}
              icon="#"
            />
            <StatCard
              title="Clientes"
              value={safeNumber(stats.daily.clients)}
              current={stats.daily.clients}
              previous={stats.yesterday?.clients}
              icon="♥"
            />
      </div>

          <section className="sales-period-section">
            <div className="sales-period-tabs" role="tablist" aria-label="Período de ventas">
              <button
                type="button"
                role="tab"
                aria-selected={salesPeriod === 'sevenDays'}
                className={`tab-button ${salesPeriod === 'sevenDays' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('sevenDays')}
              >
                7 días
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={salesPeriod === 'month'}
                className={`tab-button ${salesPeriod === 'month' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('month')}
              >
                Este mes
              </button>
            </div>

            <SalesPeriodChart
              period={salesPeriod}
              sales={stats.salesLast7Days}
              monthlySales={stats.salesCurrentMonthByWeek}
            />

            <div className="period-summary-grid">
              <PeriodSummary
                title="Total de ventas"
                current={selectedPeriod?.totalSales}
                previous={previousPeriod?.totalSales}
                formatValue={formatMoney}
              />
              <PeriodSummary
                title="Pedidos completados"
                current={selectedPeriod?.completedOrders}
                previous={previousPeriod?.completedOrders}
                formatValue={(value) => String(safeNumber(value))}
              />
            </div>
          </section>

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
