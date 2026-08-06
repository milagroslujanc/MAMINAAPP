import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import ConfirmModal from '../components/ConfirmModal';
import { clearStaffSession, homeForRole } from '../auth';

const EMPTY_FORM = {
  number: '',
  capacity: '4',
  isActive: true,
};

export default function AdminTablesPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [tables, setTables] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    const list = await api.getAdminTables();
    setTables(list);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const me = await api.me();
        if (me.admin?.role !== 'admin') {
          navigate(homeForRole(me.admin?.role), { replace: true });
          return;
        }
        await load();
        if (!cancelled) setReady(true);
      } catch {
        clearStaffSession();
        if (!cancelled) navigate('/admin', { replace: true });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [load, navigate]);

  const visible = useMemo(() => {
    if (filter === 'active') return tables.filter((t) => t.is_active);
    if (filter === 'hidden') return tables.filter((t) => !t.is_active);
    return tables;
  }, [tables, filter]);

  function onChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setSuccess('');
  }

  function startEdit(table) {
    setEditingId(table.id);
    setForm({
      number: String(table.number),
      capacity: String(table.capacity),
      isActive: Boolean(table.is_active),
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
      number: Number(form.number),
      capacity: Number(form.capacity),
      isActive: Boolean(form.isActive),
    };

    try {
      if (editingId) {
        const updated = await api.updateAdminTable(editingId, payload);
        setSuccess(updated.message || 'Mesa actualizada');
      } else {
        const created = await api.createAdminTable(payload);
        setSuccess(created.message || 'Mesa creada');
      }
      await load();
      startCreate();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function askToggle(table) {
    setConfirm({
      type: 'toggle',
      table,
      title: table.is_active ? 'Desactivar mesa' : 'Activar mesa',
      message: table.is_active
        ? `La mesa ${table.number} dejará de aparecer en recepción y no aceptará nuevos pedidos.`
        : `La mesa ${table.number} volverá a estar disponible en recepción.`,
      confirmLabel: table.is_active ? 'Desactivar' : 'Activar',
      danger: table.is_active,
    });
  }

  function askDelete(table) {
    setConfirm({
      type: 'delete',
      table,
      title: 'Eliminar mesa',
      message: `¿Eliminar la mesa ${table.number} del salón? Quedará desactivada y no podrá recibir nuevos pedidos.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
  }

  async function runConfirm() {
    if (!confirm?.table) return;
    const { type, table } = confirm;
    setConfirm(null);
    setError('');
    setSuccess('');

    try {
      if (type === 'toggle') {
        const result = await api.setAdminTableActive(table.id, !table.is_active);
        setSuccess(result.message);
      } else if (type === 'delete') {
        const result = await api.deleteAdminTable(table.id);
        setSuccess(result.message);
        if (editingId === table.id) startCreate();
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!ready) {
    return (
      <section className="center-card">
        <p className="muted">Cargando gestión de mesas…</p>
      </section>
    );
  }

  return (
    <section className="admin-menu">
      <div className="admin-menu-header">
        <div>
          <p className="eyebrow">MMN-19 · Panel administrador</p>
          <h1>Gestionar mesas</h1>
          <p className="muted">
            Registra el número y capacidad de cada mesa. Desactiva o elimina las que están en
            mantenimiento para que no reciban nuevos pedidos.
          </p>
        </div>
        <div className="admin-actions">
          <Link className="btn" to="/admin/panel">
            Volver al panel
          </Link>
          <Link className="btn" to="/">
            Ver recepción
          </Link>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert ok">{success}</div>}

      <div className="admin-menu-layout">
        <form className="admin-product-form" onSubmit={handleSubmit}>
          <div className="cart-head">
            <h2>{editingId ? `Editar mesa #${editingId}` : 'Nueva mesa'}</h2>
            {editingId && (
              <button type="button" className="linkish" onClick={startCreate}>
                Cancelar edición
              </button>
            )}
          </div>

          <div className="form-row-2">
            <label>
              Número
              <input
                type="number"
                min="1"
                step="1"
                value={form.number}
                onChange={(e) => onChange('number', e.target.value)}
                placeholder="Ej. 14"
                required
              />
            </label>
            <label>
              Capacidad
              <input
                type="number"
                min="1"
                step="1"
                value={form.capacity}
                onChange={(e) => onChange('capacity', e.target.value)}
                required
              />
            </label>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => onChange('isActive', e.target.checked)}
            />
            Habilitada para recibir clientes
          </label>

          <button type="submit" className="btn primary large" disabled={saving}>
            {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear mesa'}
          </button>
        </form>

        <div className="admin-product-list">
          <div className="cart-head">
            <h2>Mesas ({visible.length})</h2>
            <div className="filter-pills">
              <button
                type="button"
                className={`btn small ${filter === 'all' ? 'primary' : ''}`}
                onClick={() => setFilter('all')}
              >
                Todas
              </button>
              <button
                type="button"
                className={`btn small ${filter === 'active' ? 'primary' : ''}`}
                onClick={() => setFilter('active')}
              >
                Activas
              </button>
              <button
                type="button"
                className={`btn small ${filter === 'hidden' ? 'primary' : ''}`}
                onClick={() => setFilter('hidden')}
              >
                Desactivadas
              </button>
            </div>
          </div>

          {!visible.length && <p className="muted">No hay mesas en este filtro.</p>}

          <ul className="admin-tables">
            {visible.map((table) => (
              <li key={table.id} className={!table.is_active ? 'is-hidden' : ''}>
                <div className="admin-table-badge">
                  <strong>{table.number}</strong>
                  <span>{table.capacity} pers.</span>
                </div>
                <div className="admin-product-info">
                  <div className="product-title-row">
                    <strong>Mesa {table.number}</strong>
                    {!table.is_active && <span className="badge-agotado">Desactivada</span>}
                    {table.is_active && table.status === 'ocupada' && (
                      <span className="badge-nuevo">Ocupada</span>
                    )}
                    {table.is_active && table.status === 'libre' && (
                      <span className="badge-nuevo" style={{ background: 'rgba(61,122,74,0.15)', color: '#2f7d4a' }}>
                        Libre
                      </span>
                    )}
                  </div>
                  <p className="muted">Capacidad: {table.capacity} personas</p>
                  <div className="admin-product-actions">
                    <button type="button" className="btn small" onClick={() => startEdit(table)}>
                      Editar
                    </button>
                    <button type="button" className="btn small" onClick={() => askToggle(table)}>
                      {table.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button type="button" className="btn small" onClick={() => askDelete(table)}>
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
