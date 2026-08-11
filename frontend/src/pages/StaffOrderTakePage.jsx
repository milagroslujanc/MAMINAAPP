import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { clearStaffSession, homeForRole } from '../auth';

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Toma de pedido del mesero/admin en ventana dedicada (UI similar al cliente).
 * Query: session, label (opcional)
 */
export default function StaffOrderTakePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionToken = params.get('session') || '';
  const labelParam = params.get('label') || '';

  const [ready, setReady] = useState(false);
  const [staff, setStaff] = useState(null);
  const [session, setSession] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [selectedTab, setSelectedTab] = useState('menu');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sending, setSending] = useState(false);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const me = await api.me();
        if (!['admin', 'mesero'].includes(me.admin?.role)) {
          navigate(homeForRole(me.admin?.role), { replace: true });
          return;
        }
        if (!sessionToken) {
          if (!cancelled) {
            setError('Falta la sesión de la mesa');
            setReady(true);
          }
          return;
        }

        const resolved = await api.resolveSession(sessionToken);
        const [menuData] = await Promise.all([api.getMenu()]);
        if (cancelled) return;

        setStaff(me.admin);
        setSession({
          sessionToken: resolved.sessionToken || sessionToken,
          tableId: resolved.tableId,
          tableNumber: resolved.tableNumber,
          orderType: resolved.orderType,
        });
        setMenu(Array.isArray(menuData) ? menuData : []);
        setReady(true);
      } catch (err) {
        if (err.message === 'No autorizado' || err.message === 'Sesión inválida o expirada') {
          clearStaffSession();
          navigate('/mesero', { replace: true });
          return;
        }
        if (!cancelled) {
          setError(err.message || 'No se pudo abrir la toma de pedido');
          setReady(true);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [navigate, sessionToken]);

  useEffect(() => {
    if (session?.sessionToken) loadActiveOrder();
  }, [session?.sessionToken]);

  useEffect(() => {
    if (selectedTab === 'status' && session?.sessionToken) {
      loadActiveOrder();
    }
  }, [selectedTab, session?.sessionToken]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const count = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  const destinationLabel =
    labelParam ||
    (session?.orderType === 'llevar'
      ? 'Para llevar'
      : `Mesa ${session?.tableNumber ?? '—'}`);

  async function loadActiveOrder() {
    if (!session?.sessionToken) return;
    try {
      const order = await api.getActiveOrder(session.sessionToken);
      setActiveOrder(order);
    } catch (err) {
      if (err.message === 'Pedido no encontrado') {
        setActiveOrder(null);
      } else if (err.message !== 'Sesión inválida') {
        setError(err.message);
      }
    }
  }

  function addToCart(product) {
    if (product.agotado) return;
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
          specialNotes: '',
        },
      ];
    });
    setShowCart(true);
  }

  function updateQty(productId, quantity) {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  function updateNotes(productId, specialNotes) {
    setCart((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, specialNotes } : i))
    );
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  async function sendOrder() {
    if (!session?.sessionToken || !cart.length) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.createOrder({
        sessionToken: session.sessionToken,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          specialNotes: i.specialNotes || null,
        })),
      });
      setCart([]);
      setShowCart(false);
      setSuccess(
        result.isNewOrder
          ? `Pedido #${result.orderId} enviado a cocina. Total S/ ${Number(result.total).toFixed(2)}`
          : `Ítems agregados al pedido #${result.orderId}. Total S/ ${Number(result.total).toFixed(2)}`
      );
      loadActiveOrder();
      const fresh = await api.getMenu();
      setMenu(Array.isArray(fresh) ? fresh : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (!ready) {
    return (
      <section className="center-card">
        <p className="muted">Abriendo toma de pedido…</p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="center-card">
        <h1>No se puede tomar el pedido</h1>
        <p className="muted">{error || 'Sesión de mesa no válida.'}</p>
        <button type="button" className="btn" onClick={() => window.close()}>
          Cerrar ventana
        </button>
      </section>
    );
  }

  const salonPath = staff?.role === 'admin' ? '/admin/salon' : '/mesero/mesas';

  return (
    <section className="menu-page staff-take-order">
      <div className="menu-header">
        <div>
          <p className="eyebrow">
            {staff?.role === 'mesero' ? 'Mesero' : 'Administrador'} · Toma de pedido
          </p>
          <h1>La Mamina</h1>
          <p className="muted">{destinationLabel}</p>
        </div>
        <div className="staff-take-actions">
          <Link className="btn" to={salonPath}>
            Volver al salón
          </Link>
          <button type="button" className="cart-fab" onClick={() => setShowCart(true)}>
            Carrito · {count}
            <span>S/ {total.toFixed(2)}</span>
          </button>
        </div>
      </div>

      <div className="menu-tabs">
        <button
          type="button"
          className={`tab-button ${selectedTab === 'menu' ? 'active' : ''}`}
          onClick={() => setSelectedTab('menu')}
        >
          Menú
        </button>
        <button
          type="button"
          className={`tab-button ${selectedTab === 'status' ? 'active' : ''}`}
          onClick={() => setSelectedTab('status')}
        >
          Estado de Pedido
        </button>
      </div>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert ok">{success}</div>}

      {selectedTab === 'menu' ? (
        menu.map((category) => (
          <div key={category.id} className="category-block">
            <h2>{category.name}</h2>
            <div className="product-list">
              {category.products.map((product) => (
                <article
                  key={product.id}
                  className={`product-row ${product.agotado ? 'agotado' : ''}`}
                >
                  <img src={product.image_url} alt="" loading="lazy" />
                  <div className="product-info">
                    <div className="product-title-row">
                      <h3>{product.name}</h3>
                      {product.agotado && <span className="badge-agotado">Agotado</span>}
                    </div>
                    <p>{product.description}</p>
                    <div className="product-actions">
                      <strong>S/ {Number(product.price).toFixed(2)}</strong>
                      <button
                        type="button"
                        className="btn small"
                        disabled={product.agotado}
                        onClick={() => addToCart(product)}
                      >
                        Agregar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))
      ) : (
        <section className="order-status-panel">
          <div className="status-panel-head">
            <h2>Estado del pedido</h2>
            <button type="button" className="btn small" onClick={loadActiveOrder}>
              Actualizar
            </button>
          </div>
          {activeOrder ? (
            <div className="status-card">
              <p className="eyebrow">Pedido #{activeOrder.id}</p>
              <p className="status-pill">
                {STATUS_LABELS[activeOrder.status] || activeOrder.status}
              </p>
              <p>
                {activeOrder.order_type === 'llevar'
                  ? 'Pedido para llevar'
                  : `Mesa ${activeOrder.table_number ?? '—'}`}
              </p>
              <p className="muted">{formatTime(activeOrder.created_at)}</p>
              <p className="total-row">
                <span>Total</span>
                <strong>S/ {Number(activeOrder.total).toFixed(2)}</strong>
              </p>
            </div>
          ) : (
            <p className="muted">Aún no hay un pedido activo para esta mesa.</p>
          )}
        </section>
      )}

      {showCart && (
        <aside className="cart-drawer">
          <div className="cart-head">
            <h2>Pedido · {destinationLabel}</h2>
            <button type="button" onClick={() => setShowCart(false)}>
              Cerrar
            </button>
          </div>

          {!cart.length && <p className="muted">El carrito está vacío.</p>}

          <ul className="cart-list">
            {cart.map((item) => (
              <li key={item.productId}>
                <div className="cart-item-top">
                  <strong>{item.name}</strong>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() => removeItem(item.productId)}
                  >
                    Eliminar
                  </button>
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
                <input
                  type="text"
                  placeholder="Nota especial (ej. sin mayonesa)"
                  value={item.specialNotes}
                  onChange={(e) => updateNotes(item.productId, e.target.value)}
                />
              </li>
            ))}
          </ul>

          <div className="cart-footer">
            <div className="total-row">
              <span>Total</span>
              <strong>S/ {total.toFixed(2)}</strong>
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
