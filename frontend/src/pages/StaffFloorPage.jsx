import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import StaffAlertsBanner from '../components/StaffAlertsBanner';
import { clearStaffSession } from '../auth';

/**
 * Apertura de mesas e inicio de pedidos sin QR (mesero / admin).
 */
export default function StaffFloorPage({ roleRequired }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [staff, setStaff] = useState(null);
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [ordering, setOrdering] = useState(null);
  const [cart, setCart] = useState([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const list = await api.getFloorTables();
    setTables(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const data = await api.me();
        const role = data.admin?.role || 'admin';

        if (roleRequired === 'admin' && role === 'mesero') {
          navigate('/mesero/mesas', { replace: true });
          return;
        }
        if (roleRequired === 'mesero' && role !== 'mesero' && role !== 'admin') {
          navigate('/mesero', { replace: true });
          return;
        }

        const [floor, menuData] = await Promise.all([api.getFloorTables(), api.getMenu()]);
        if (!cancelled) {
          setStaff(data.admin);
          setTables(Array.isArray(floor) ? floor : []);
          setMenu(Array.isArray(menuData) ? menuData : []);
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

  const products = useMemo(
    () =>
      menu.flatMap((c) =>
        c.products
          .filter((p) => !p.agotado)
          .map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            category: c.name,
          }))
      ),
    [menu]
  );

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  async function openTable(table) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.openFloorTable(table.id);
      setSuccess(result.message);
      setOrdering({
        label: `Mesa ${result.table.number}`,
        sessionToken: result.session.token,
        tableNumber: result.table.number,
      });
      setCart([]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openTakeaway() {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.openFloorTakeaway();
      setSuccess(result.message);
      setOrdering({
        label: 'Para llevar',
        sessionToken: result.session.token,
        tableNumber: null,
      });
      setCart([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startOrderOnOccupied(table) {
    if (!table.sessionToken) {
      setError('La mesa no tiene sesión activa');
      return;
    }
    setOrdering({
      label: `Mesa ${table.number}`,
      sessionToken: table.sessionToken,
      tableNumber: table.number,
    });
    setCart([]);
    setError('');
    setSuccess('');
  }

  function addProduct(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
        },
      ];
    });
  }

  function updateQty(productId, quantity) {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  async function sendOrder() {
    if (!ordering?.sessionToken || !cart.length) return;
    setSending(true);
    setError('');
    try {
      const result = await api.createOrder({
        sessionToken: ordering.sessionToken,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      });
      setSuccess(result.message || `Pedido #${result.orderId} enviado`);
      setCart([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function logout() {
    clearStaffSession();
    navigate(staff?.role === 'mesero' ? '/mesero' : '/admin');
  }

  if (!ready) {
    return (
      <section className="center-card">
        <p className="muted">Cargando mesas…</p>
      </section>
    );
  }

  const pedidosPath = staff?.role === 'admin' ? '/admin/pedidos' : '/mesero/pedidos';
  const panelLink = staff?.role === 'admin' ? '/admin/panel' : null;

  return (
    <section className="staff-floor">
      <div className="admin-menu-header">
        <div>
          <p className="eyebrow">
            {staff?.role === 'mesero' ? 'Mesero' : 'Administrador'} · Salón
          </p>
          <h1>Mesas y pedidos</h1>
          <p className="muted">
            Apertura mesas e inicia pedidos sin escanear QR. Al aperturar, la mesa queda ocupada.
          </p>
        </div>
        <div className="admin-actions">
          {panelLink && (
            <Link className="btn" to={panelLink}>
              Panel
            </Link>
          )}
          <Link className="btn" to={pedidosPath}>
            Pedidos
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

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert ok">{success}</div>}

      <div className="floor-actions">
        <button type="button" className="btn primary" disabled={busy} onClick={openTakeaway}>
          Iniciar pedido para llevar
        </button>
      </div>

      <div className="tables-grid floor-tables">
        {tables.map((table) => (
          <article key={table.id} className={`table-tile ${table.status} floor-tile`}>
            <span className="table-num">Mesa {table.number}</span>
            <span className="table-meta">{table.capacity} pers.</span>
            <span className="table-status">{table.status}</span>
            {table.status === 'libre' ? (
              <button
                type="button"
                className="btn small"
                disabled={busy}
                onClick={() => openTable(table)}
              >
                Aperturar
              </button>
            ) : (
              <button
                type="button"
                className="btn small primary"
                disabled={!table.sessionToken}
                onClick={() => startOrderOnOccupied(table)}
              >
                Tomar pedido
              </button>
            )}
          </article>
        ))}
      </div>

      {ordering && (
        <aside className="floor-order-panel">
          <div className="cart-head">
            <h2>Pedido · {ordering.label}</h2>
            <button type="button" className="linkish" onClick={() => setOrdering(null)}>
              Cerrar
            </button>
          </div>

          <div className="floor-product-list">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                className="floor-product-row"
                onClick={() => addProduct(p)}
              >
                <span>
                  <strong>{p.name}</strong>
                  <em className="muted"> {p.category}</em>
                </span>
                <span>S/ {Number(p.price).toFixed(2)}</span>
              </button>
            ))}
          </div>

          <ul className="cart-list">
            {cart.map((item) => (
              <li key={item.productId}>
                <div className="cart-item-top">
                  <strong>{item.name}</strong>
                </div>
                <div className="qty-row">
                  <button
                    type="button"
                    onClick={() => updateQty(item.productId, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.productId, item.quantity + 1)}
                  >
                    +
                  </button>
                  <em>S/ {(item.price * item.quantity).toFixed(2)}</em>
                </div>
              </li>
            ))}
          </ul>

          <div className="cart-footer">
            <div className="total-row">
              <span>Total</span>
              <strong>S/ {cartTotal.toFixed(2)}</strong>
            </div>
            <button
              type="button"
              className="btn primary large"
              disabled={!cart.length || sending}
              onClick={sendOrder}
            >
              {sending ? 'Enviando…' : 'Enviar a cocina'}
            </button>
          </div>
        </aside>
      )}
    </section>
  );
}
