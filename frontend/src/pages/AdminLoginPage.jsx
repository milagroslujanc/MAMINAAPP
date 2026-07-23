import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.login(username, password);
      localStorage.setItem('mamina_admin', JSON.stringify(data));
      navigate('/admin/panel');
    } catch (err) {
      setError(err.message || 'Datos incorrectos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="center-card admin-login">
      <p className="eyebrow">Panel administrativo</p>
      <h1>Iniciar sesión</h1>
      <p className="muted">Acceso solo para personal autorizado de La Mamina.</p>

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
      <p className="hint">Demo Sprint 1 → admin / admin123</p>
    </section>
  );
}
