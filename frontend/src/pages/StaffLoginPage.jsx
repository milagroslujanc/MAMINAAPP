import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  clearStaffSession,
  getStaffSession,
  homeForRole,
  setStaffSession,
} from '../auth';

/**
 * Login de personal.
 * expectedRole: 'admin' | 'mesero' | 'cocina'
 */
export default function StaffLoginPage({ expectedRole }) {
  const navigate = useNavigate();
  const defaultUser =
    expectedRole === 'mesero' ? 'mesero' : expectedRole === 'cocina' ? 'cocina' : 'admin';
  const [username, setUsername] = useState(defaultUser);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const existing = getStaffSession();
      if (!existing?.token) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        const data = await api.me();
        const role = data.admin?.role;
        if (!cancelled) {
          navigate(homeForRole(role), { replace: true });
        }
      } catch {
        clearStaffSession();
        if (!cancelled) setChecking(false);
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.login(username, password);
      const role = data.admin?.role;
      setStaffSession(data);

      if (expectedRole === 'admin' && role === 'mesero') {
        navigate('/mesero/mesas', { replace: true });
        return;
      }
      if (expectedRole === 'admin' && role === 'cocina') {
        navigate('/cocina/pedidos', { replace: true });
        return;
      }
      if (expectedRole === 'mesero' && role === 'admin') {
        navigate('/admin/panel', { replace: true });
        return;
      }
      if (expectedRole === 'mesero' && role === 'cocina') {
        navigate('/cocina/pedidos', { replace: true });
        return;
      }
      if (expectedRole === 'cocina' && role === 'admin') {
        navigate('/admin/panel', { replace: true });
        return;
      }
      if (expectedRole === 'cocina' && role === 'mesero') {
        navigate('/mesero/mesas', { replace: true });
        return;
      }

      navigate(homeForRole(role), { replace: true });
    } catch (err) {
      setError(err.message || 'Datos incorrectos');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <section className="center-card">
        <p className="muted">Verificando sesión…</p>
      </section>
    );
  }

  const copy =
    {
      mesero: {
        eyebrow: 'Acceso mesero',
        muted: 'Gestión de pedidos de clientes.',
      },
      cocina: {
        eyebrow: 'Acceso cocina',
        muted: 'Lista de pedidos para preparación.',
      },
      admin: {
        eyebrow: 'Panel administrativo',
        muted: 'Acceso total: menú, mesas y pedidos.',
      },
    }[expectedRole] || {
      eyebrow: 'Panel administrativo',
      muted: 'Acceso total: menú, mesas y pedidos.',
    };

  return (
    <section className="center-card admin-login">
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>Iniciar sesión</h1>
      <p className="muted">{copy.muted}</p>

      <form onSubmit={handleSubmit} className="login-form">
        <label>
          Usuario
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className="alert">{error}</div>}
        <button type="submit" className="btn primary large" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </section>
  );
}
