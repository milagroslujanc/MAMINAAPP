import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import ConfirmModal from '../components/ConfirmModal';
import StaffAlertsBanner from '../components/StaffAlertsBanner';
import { clearStaffSession } from '../auth';

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  finalizado: 'Finalizado',
};

function StatusLabel({ status }) {
  const key = String(status || '');
  return (
    <span className={`status-label status-label--${key}`}>
      {STATUS_LABELS[key] || key.replace(/_/g, ' ')}
    </span>
  );
}

function IconButton({ label, className = '', children, ...props }) {
  return (
    <button type="button" className={`icon-btn ${className}`.trim()} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function IconCancel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 8 8 8M16 8l-8 8" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/**
 * Pedidos del día: activos + historial (solo entregados).
 * Acceso: administrador y mesero.
 */
export default function StaffOrdersPage({ roleRequired }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [staff, setStaff] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [addProductId, setAddProductId] = useState('');
  const [addQty, setAddQty] = useState('1');
  const [addNotes, setAddNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('active');

  const load = useCallback(async () => {
    const list = await api.getAdminOrders();
    setOrders(list);
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      // Admin: catálogo admin. Mesero: menú público activo.
      if (staff?.role === 'admin') {
        const list = await api.getAdminProducts();
        setProducts(list.filter((p) => p.is_active));
      } else {
        const menu = await api.getMenu();
        setProducts(
          menu.flatMap((c) =>
            c.products
              .filter((p) => !p.agotado)
              .map((p) => ({
                id: p.id,
                name: p.name,
                price: p.price,
                category_name: c.name,
              }))
          )
        );
      }
    } catch {
      const menu = await api.getMenu();
      setProducts(
        menu.flatMap((c) =>
          c.products
            .filter((p) => !p.agotado)
            .map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              category_name: c.name,
            }))
        )
      );
    }
  }, [staff?.role]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const data = await api.me();
        const role = data.admin?.role || 'admin';

        if (roleRequired === 'admin' && role === 'mesero') {
          navigate('/mesero/pedidos', { replace: true });
          return;
        }
        if (roleRequired === 'mesero' && role !== 'mesero' && role !== 'admin') {
          navigate('/mesero', { replace: true });
          return;
        }

        await load();
        if (!cancelled) {
          setStaff(data.admin);
          setReady(true);
        }
      } catch {
        clearStaffSession();
        navigate(roleRequired === 'mesero' ? '/mesero' : '/admin', { replace: true });
      }
    }

    init();
    const poll = setInterval(() => {
      load().catch(() => {});
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [load, navigate, roleRequired]);

  useEffect(() => {
    if (ready) loadProducts();
  }, [ready, loadProducts]);

  function logout() {
    clearStaffSession();
    navigate(staff?.role === 'mesero' ? '/mesero' : '/admin');
  }

  async function openOrder(orderId) {
    setError('');
    setSuccess('');
    try {
      const detail = await api.getAdminOrder(orderId);
      setSelected(detail);
      setNotesDraft(detail.notes || '');
      setAddProductId('');
      setAddQty('1');
      setAddNotes('');
    } catch (err) {
      setError(err.message);
    }
  }

  function editable(order) {
    return order && order.status !== 'cancelado' && order.status !== 'entregado' && order.status !== 'finalizado';
  }

  async function saveNotes() {
    if (!selected || !editable(selected)) return;
    setSaving(true);
    setError('');
    try {
      const detail = await api.updateOrderNotes(selected.id, notesDraft);
      setSelected(detail);
      setSuccess(detail.message || 'Notas guardadas');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addItem(e) {
    e.preventDefault();
    if (!selected || !editable(selected) || !addProductId) return;
    setSaving(true);
    setError('');
    try {
      const detail = await api.addOrderItem(selected.id, {
        productId: Number(addProductId),
        quantity: Number(addQty) || 1,
        specialNotes: addNotes || null,
      });
      setSelected(detail);
      setSuccess(detail.message || 'Ítem agregado');
      setAddProductId('');
      setAddQty('1');
      setAddNotes('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeQty(item, quantity) {
    if (!selected || !editable(selected)) return;
    setSaving(true);
    setError('');
    try {
      const detail = await api.updateOrderItem(selected.id, item.id, { quantity });
      setSelected(detail);
      setSuccess(detail.message || 'Cantidad actualizada');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeItemNotes(item, specialNotes) {
    if (!selected || !editable(selected)) return;
    setSaving(true);
    setError('');
    try {
      const detail = await api.updateOrderItem(selected.id, item.id, { specialNotes });
      setSelected(detail);
      setSuccess(detail.message || 'Nota del ítem actualizada');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function askRemoveItem(item) {
    setConfirm({
      type: 'remove-item',
      item,
      title: 'Quitar ítem',
      message: `¿Quitar "${item.product_name}" del pedido #${selected.id}?`,
      confirmLabel: 'Quitar',
    });
  }

  function askCancel(order) {
    setConfirm({
      type: 'cancel-order',
      order,
      title: 'Cancelar pedido',
      message: `¿Cancelar el pedido #${order.id}? Se retirará de cocina y no se cobrará.`,
      confirmLabel: 'Cancelar pedido',
    });
  }

  function askFinishOrder(order) {
    setConfirm({
      type: 'finish-order',
      order,
      title: 'Terminar pedido',
      message: `¿Terminar el pedido #${order.id}? Se marcará como entregado, se liberará la mesa (si aplica), se cerrará la sesión del cliente y pasará al historial.`,
      confirmLabel: 'Terminar pedido',
    });
  }

  async function runConfirm() {
    if (!confirm) return;
    const action = confirm;
    setConfirm(null);
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      if (action.type === 'cancel-order') {
        const result = await api.cancelAdminOrder(action.order.id);
        setSuccess(result.message);
        if (selected?.id === action.order.id) setSelected(null);
      }
      if (action.type === 'finish-order') {
        const result = await api.closeAdminOrderSession(action.order.id);
        setSuccess(result.message || 'Pedido terminado');
        if (selected?.id === action.order.id) setSelected(null);
      }
      if (action.type === 'remove-item') {
        const detail = await api.removeOrderItem(selected.id, action.item.id);
        setSuccess(detail.message || 'Ítem eliminado');
        if (detail.status === 'cancelado') {
          setSelected(null);
        } else {
          setSelected(detail);
        }
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return (
      <section className="center-card">
        <p className="muted">Cargando pedidos…</p>
      </section>
    );
  }

  const activeOrders = orders.filter(
    (order) => order.status !== 'entregado' && order.status !== 'cancelado'
  );
  const historyOrders = orders.filter(
    (order) => order.status === 'entregado' || order.status === 'cancelado'
  );
  const visibleOrders = view === 'active' ? activeOrders : historyOrders;
  const panelLink = staff?.role === 'admin' ? '/admin/panel' : null;
  const salonPath = staff?.role === 'admin' ? '/admin/salon' : '/mesero/mesas';
  const pedidosPath = staff?.role === 'admin' ? '/admin/pedidos' : '/mesero/pedidos';
  const canEdit = editable(selected);

  return (
    <section className="staff-orders">
      <div className="admin-menu-header">
        <div>
          <p className="eyebrow">
            {staff?.role === 'mesero' ? 'Mesero' : 'Administrador'} · Pedidos del día
          </p>
          <h1>Gestión de pedidos</h1>
          <p className="muted">
            Revisa órdenes, edita ítems/notas o cancela si el cliente se retira.
          </p>
        </div>
        <div className="admin-actions">
          {panelLink && (
            <Link className="btn" to={panelLink}>
              Volver al panel
            </Link>
          )}
          <Link className="btn" to={salonPath}>
            Salón
          </Link>
          <button type="button" className="btn" onClick={load}>
            Refrescar
          </button>
          <button type="button" className="btn" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <StaffAlertsBanner pedidosPath={pedidosPath} />

      <div className="menu-tabs">
        <button
          type="button"
          className={`tab-button ${view === 'active' ? 'active' : ''}`}
          onClick={() => setView('active')}
        >
          Activos ({activeOrders.length})
        </button>
        <button
          type="button"
          className={`tab-button ${view === 'history' ? 'active' : ''}`}
          onClick={() => setView('history')}
        >
          Historial ({historyOrders.length})
        </button>
      </div>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert ok">{success}</div>}

      <div className="orders-layout">
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Hora</th>
                <th>Mesa / Destino</th>
                <th>Estado</th>
                <th>Total</th>
                <th>Cobro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!visibleOrders.length && (
                <tr>
                  <td colSpan={7} className="muted">
                    {view === 'active'
                      ? 'No hay pedidos activos que requieran atención.'
                      : 'No hay pedidos en el historial aún.'}
                  </td>
                </tr>
              )}
              {visibleOrders.map((order) => (
                <tr
                  key={order.id}
                  className={`${order.status === 'cancelado' ? 'row-cancelled' : ''} ${
                    selected?.id === order.id ? 'row-selected' : ''
                  }`}
                >
                  <td>
                    <strong>{order.id}</strong>
                  </td>
                  <td>{formatTime(order.created_at)}</td>
                  <td>
                    {order.order_type === 'llevar'
                      ? 'Para llevar'
                      : `Mesa ${order.table_number ?? '—'}`}
                  </td>
                  <td className="status-cell">
                    <StatusLabel status={order.status} />
                  </td>
                  <td>S/ {Number(order.total).toFixed(2)}</td>
                  <td>{order.charged ? 'Sí' : 'No'}</td>
                  <td>
                    <div className="orders-actions">
                      {view === 'active' && (
                        <>
                          <IconButton label="Editar pedido" onClick={() => openOrder(order.id)}>
                            <IconEdit />
                          </IconButton>
                          <IconButton
                            label="Cancelar pedido"
                            className="danger"
                            onClick={() => askCancel(order)}
                          >
                            <IconCancel />
                          </IconButton>
                          <button
                            type="button"
                            className="btn small"
                            disabled={saving}
                            onClick={() => askFinishOrder(order)}
                          >
                            Terminar pedido
                          </button>
                        </>
                      )}
                      {view === 'history' && (
                        <IconButton label="Ver pedido" onClick={() => openOrder(order.id)}>
                          <IconEdit />
                        </IconButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="order-edit-panel">
          {!selected && <p className="muted">Selecciona un pedido para editarlo.</p>}
          {selected && (
            <>
              <div className="cart-head">
                <h2>Pedido #{selected.id}</h2>
                <button type="button" className="linkish" onClick={() => setSelected(null)}>
                  Cerrar
                </button>
              </div>
              <p className="muted order-edit-meta">
                {selected.order_type === 'llevar'
                  ? 'Para llevar'
                  : `Mesa ${selected.table_number ?? '—'}`}{' '}
                · <StatusLabel status={selected.status} /> · S/ {Number(selected.total).toFixed(2)}
              </p>

              {canEdit && (
                <button
                  type="button"
                  className="btn small"
                  disabled={saving}
                  onClick={() => askFinishOrder(selected)}
                >
                  Terminar pedido
                </button>
              )}

              <label>
                Notas generales del pedido
                <textarea
                  rows={3}
                  value={notesDraft}
                  disabled={!canEdit || saving}
                  onChange={(e) => setNotesDraft(e.target.value)}
                />
              </label>
              {canEdit && (
                <button
                  type="button"
                  className="btn small"
                  disabled={saving}
                  onClick={saveNotes}
                >
                  Guardar notas
                </button>
              )}

              <h3>Ítems</h3>
              <ul className="edit-items">
                {(selected.items || []).map((item) => (
                  <li key={item.id}>
                    <div className="cart-item-top">
                      <strong>{item.product_name}</strong>
                      <span>S/ {(item.unit_price * item.quantity).toFixed(2)}</span>
                    </div>
                    {canEdit ? (
                      <>
                        <div className="qty-row">
                          <button
                            type="button"
                            disabled={saving || item.quantity <= 1}
                            onClick={() => changeQty(item, item.quantity - 1)}
                          >
                            −
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => changeQty(item, item.quantity + 1)}
                          >
                            +
                          </button>
                          <IconButton
                            label="Quitar ítem"
                            className="danger"
                            disabled={saving}
                            onClick={() => askRemoveItem(item)}
                          >
                            <IconTrash />
                          </IconButton>
                        </div>
                        <input
                          type="text"
                          placeholder="Nota del ítem (ej. sin ají)"
                          defaultValue={item.special_notes || ''}
                          disabled={saving}
                          onBlur={(e) => {
                            const value = e.target.value;
                            if ((item.special_notes || '') !== value) {
                              changeItemNotes(item, value);
                            }
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <p className="muted">Cantidad: {item.quantity}</p>
                        {item.special_notes && (
                          <p className="note-highlight">Nota: {item.special_notes}</p>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>

              {canEdit && (
                <form className="add-item-form" onSubmit={addItem}>
                  <h3>Agregar plato</h3>
                  <label>
                    Producto
                    <select
                      value={addProductId}
                      onChange={(e) => setAddProductId(e.target.value)}
                      required
                    >
                      <option value="">Seleccionar…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — S/ {Number(p.price).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-row-2">
                    <label>
                      Cantidad
                      <input
                        type="number"
                        min="1"
                        value={addQty}
                        onChange={(e) => setAddQty(e.target.value)}
                      />
                    </label>
                    <label>
                      Nota
                      <input
                        type="text"
                        value={addNotes}
                        onChange={(e) => setAddNotes(e.target.value)}
                        placeholder="Opcional"
                      />
                    </label>
                  </div>
                  <button type="submit" className="btn primary" disabled={saving || !addProductId}>
                    Agregar al pedido
                  </button>
                </form>
              )}
            </>
          )}
        </aside>
      </div>

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </section>
  );
}
