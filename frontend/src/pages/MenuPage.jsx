import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const CART_KEY = 'mamina_cart';
const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_preparacion: 'En preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem('mamina_session') || 'null');
  } catch {
    return null;
  }
}

function loadCart() {
  try {
    return JSON.parse(sessionStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MenuPage() {
  const [session] = useState(loadSession);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState(loadCart);
  const [activeOrder, setActiveOrder] = useState(null);
  const [selectedTab, setSelectedTab] = useState('menu');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sending, setSending] = useState(false);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    api
      .getMenu()
      .then((data) => setMenu(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message));
    loadActiveOrder();
  }, []);

  useEffect(() => {
    if (selectedTab === 'status') {
      loadActiveOrder();
    }
  }, [selectedTab]);

  useEffect(() => {
    sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const count = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  async function loadActiveOrder() {
    if (!session?.sessionToken) return;
    try {
      const order = await api.getActiveOrder(session.sessionToken);
      setActiveOrder(order);
      setError('');
    } catch (err) {
      if (err.message === 'Pedido no encontrado') {
        setActiveOrder(null);
      } else {
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
          price: product.price,
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
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, specialNotes } : i)));
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  async function sendOrder() {
    if (!session?.sessionToken) {
      setError('No hay sesión activa. Escanea el QR desde recepción.');
      return;
    }
    if (!cart.length) return;

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
      sessionStorage.removeItem(CART_KEY);
      setSuccess(
        result.isNewOrder
          ? `Pedido #${result.orderId} enviado a cocina. Total S/ ${Number(result.total).toFixed(2)}`
          : `Ítems agregados al pedido #${result.orderId}. Total acumulado S/ ${Number(result.total).toFixed(2)}`
      );
      setShowCart(false);
      setCart([]);
      sessionStorage.removeItem(CART_KEY);
      loadActiveOrder();
      const fresh = await api.getMenu();
      setMenu(fresh);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (!session) {
    return (
      <section className="center-card">
        <h1>Sin sesión de mesa</h1>
        <p>Escanea el QR de la pantalla de entrada para vincular tu mesa.</p>
        <Link className="btn" to="/">
          Ir a recepción
        </Link>
      </section>
    );
  }

  return (
    <section className="menu-page">
      <div className="menu-header">
        <div>
          <p className="eyebrow">Menú digital</p>
          <h1>La Mamina</h1>
          <p className="muted">
            {session.orderType === 'llevar'
              ? 'Pedido para llevar'
              : `Mesa ${session.tableNumber ?? '—'}`}
          </p>
        </div>
        <button type="button" className="cart-fab" onClick={() => setShowCart(true)}>
          Carrito · {count}
          <span>S/ {total.toFixed(2)}</span>
        </button>
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
            <h2>Estado de tu pedido</h2>
            <button type="button" className="btn small" onClick={loadActiveOrder}>
              Actualizar
            </button>
          </div>
          {activeOrder ? (
            <div className="status-card">
              <p className="eyebrow">Pedido #{activeOrder.id}</p>
              <p className="status-pill">{STATUS_LABELS[activeOrder.status] || activeOrder.status}</p>
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
            <p className="muted">Aún no tienes un pedido activo.</p>
          )}
        </section>
      )}

      {showCart && (
        <aside className="cart-drawer">
          <div className="cart-head">
            <h2>Tu pedido</h2>
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
                  <button type="button" className="linkish" onClick={() => removeItem(item.productId)}>
                    Eliminar
                  </button>
                </div>
                <div className="qty-row">
                  <button type="button" onClick={() => updateQty(item.productId, item.quantity - 1)}>
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => updateQty(item.productId, item.quantity + 1)}>
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
