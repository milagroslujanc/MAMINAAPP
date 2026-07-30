import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import ConfirmModal from '../components/ConfirmModal';

const EMPTY_FORM = {
  categoryId: '',
  name: '',
  description: '',
  price: '',
  imageUrl: '',
  stock: '10',
  isActive: true,
};

export default function AdminMenuPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    const [cats, list] = await Promise.all([api.getAdminCategories(), api.getAdminProducts()]);
    setCategories(cats);
    setProducts(list);
    setForm((prev) => ({
      ...prev,
      categoryId: prev.categoryId || (cats[0] ? String(cats[0].id) : ''),
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await api.me();
        await load();
        if (!cancelled) setReady(true);
      } catch {
        localStorage.removeItem('mamina_admin');
        if (!cancelled) navigate('/admin', { replace: true });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [load, navigate]);

  const visible = useMemo(() => {
    if (filter === 'active') return products.filter((p) => p.is_active);
    if (filter === 'hidden') return products.filter((p) => !p.is_active);
    return products;
  }, [products, filter]);

  function onChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      categoryId: categories[0] ? String(categories[0].id) : '',
    });
    setError('');
    setSuccess('');
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      categoryId: String(product.category_id),
      name: product.name || '',
      description: product.description || '',
      price: String(product.price),
      imageUrl: product.image_url || '',
      stock: String(product.stock ?? 0),
      isActive: Boolean(product.is_active),
    });
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      categoryId: Number(form.categoryId),
      name: form.name,
      description: form.description,
      price: Number(form.price),
      imageUrl: form.imageUrl,
      stock: Number(form.stock),
      isActive: Boolean(form.isActive),
    };

    try {
      if (editingId) {
        const updated = await api.updateAdminProduct(editingId, payload);
        setSuccess(updated.message || 'Plato actualizado');
      } else {
        const created = await api.createAdminProduct(payload);
        setSuccess(created.message || 'Plato agregado');
      }
      await load();
      startCreate();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function askToggle(product) {
    setConfirm({
      type: 'toggle',
      product,
      title: product.is_active ? 'Desactivar plato' : 'Activar plato',
      message: product.is_active
        ? `"${product.name}" desaparecerá del menú de clientes.`
        : `"${product.name}" volverá a mostrarse en el catálogo.`,
      confirmLabel: product.is_active ? 'Desactivar' : 'Activar',
      danger: product.is_active,
    });
  }

  function askDelete(product) {
    setConfirm({
      type: 'delete',
      product,
      title: 'Eliminar plato',
      message: `¿Ocultar "${product.name}" del menú de clientes?`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
  }

  async function runConfirm() {
    if (!confirm?.product) return;
    const { type, product } = confirm;
    setConfirm(null);
    setError('');
    setSuccess('');

    try {
      if (type === 'toggle') {
        const result = await api.setAdminProductActive(product.id, !product.is_active);
        setSuccess(result.message);
      } else if (type === 'delete') {
        const result = await api.deleteAdminProduct(product.id);
        setSuccess(result.message);
        if (editingId === product.id) startCreate();
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!ready) {
    return (
      <section className="center-card">
        <p className="muted">Cargando gestión de menú…</p>
      </section>
    );
  }

  return (
    <section className="admin-menu">
      <div className="admin-menu-header">
        <div>
          <p className="eyebrow">MMN-18 · Panel administrador</p>
          <h1>Gestionar menú</h1>
          <p className="muted">
            Agrega platos, cambia precios o desactiva productos agotados. Los cambios se reflejan al
            instante en el menú de clientes.
          </p>
        </div>
        <div className="admin-actions">
          <Link className="btn" to="/admin/panel">
            Volver al panel
          </Link>
          <Link className="btn" to="/menu">
            Ver menú cliente
          </Link>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert ok">{success}</div>}

      <div className="admin-menu-layout">
        <form className="admin-product-form" onSubmit={handleSubmit}>
          <div className="cart-head">
            <h2>{editingId ? `Editar plato #${editingId}` : 'Nuevo plato'}</h2>
            {editingId && (
              <button type="button" className="linkish" onClick={startCreate}>
                Cancelar edición
              </button>
            )}
          </div>

          <label>
            Categoría
            <select
              value={form.categoryId}
              onChange={(e) => onChange('categoryId', e.target.value)}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Nombre
            <input
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="Ej. Ceviche Clásico"
              required
            />
          </label>

          <label>
            Descripción
            <textarea
              value={form.description}
              onChange={(e) => onChange('description', e.target.value)}
              rows={3}
              placeholder="Descripción corta del plato"
            />
          </label>

          <div className="form-row-2">
            <label>
              Precio (S/)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => onChange('price', e.target.value)}
                required
              />
            </label>
            <label>
              Stock
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) => onChange('stock', e.target.value)}
              />
            </label>
          </div>

          <label>
            Foto (URL)
            <input
              value={form.imageUrl}
              onChange={(e) => onChange('imageUrl', e.target.value)}
              placeholder="https://..."
            />
          </label>

          {form.imageUrl && (
            <div className="admin-image-preview">
              <img src={form.imageUrl} alt="Vista previa" />
            </div>
          )}

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => onChange('isActive', e.target.checked)}
            />
            Visible en el menú de clientes
          </label>

          <button type="submit" className="btn primary large" disabled={saving}>
            {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar plato'}
          </button>
        </form>

        <div className="admin-product-list">
          <div className="cart-head">
            <h2>Platos ({visible.length})</h2>
            <div className="filter-pills">
              <button
                type="button"
                className={`btn small ${filter === 'all' ? 'primary' : ''}`}
                onClick={() => setFilter('all')}
              >
                Todos
              </button>
              <button
                type="button"
                className={`btn small ${filter === 'active' ? 'primary' : ''}`}
                onClick={() => setFilter('active')}
              >
                Visibles
              </button>
              <button
                type="button"
                className={`btn small ${filter === 'hidden' ? 'primary' : ''}`}
                onClick={() => setFilter('hidden')}
              >
                Ocultos
              </button>
            </div>
          </div>

          {!visible.length && <p className="muted">No hay platos en este filtro.</p>}

          <ul className="admin-products">
            {visible.map((product) => (
              <li key={product.id} className={!product.is_active ? 'is-hidden' : ''}>
                <img
                  src={product.image_url || '/mamina.png'}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.src = '/mamina.png';
                  }}
                />
                <div className="admin-product-info">
                  <div className="product-title-row">
                    <strong>{product.name}</strong>
                    {!product.is_active && <span className="badge-agotado">Oculto</span>}
                    {product.is_active && product.agotado && (
                      <span className="badge-agotado">Sin stock</span>
                    )}
                  </div>
                  <p className="muted">
                    {product.category_name} · S/ {Number(product.price).toFixed(2)} · Stock{' '}
                    {product.stock}
                  </p>
                  <p>{product.description}</p>
                  <div className="admin-product-actions">
                    <button type="button" className="btn small" onClick={() => startEdit(product)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => askToggle(product)}
                    >
                      {product.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => askDelete(product)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </section>
  );
}
