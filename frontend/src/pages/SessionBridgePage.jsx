import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

export default function SessionBridgePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function resolve() {
      try {
        const data = await api.resolveSession(token);
        if (!active) return;
        sessionStorage.setItem(
          'mamina_session',
          JSON.stringify({
            sessionToken: data.sessionToken,
            tableId: data.tableId,
            tableNumber: data.tableNumber,
            orderType: data.orderType,
          })
        );
        navigate('/menu', { replace: true });
      } catch (err) {
        if (active) setError(err.message);
      }
    }

    resolve();
    return () => {
      active = false;
    };
  }, [token, navigate]);

  if (error) {
    return (
      <section className="center-card">
        <h1>QR no válido</h1>
        <p>{error}</p>
        <a className="btn" href="/">
          Volver a recepción
        </a>
      </section>
    );
  }

  return (
    <section className="center-card">
      <h1>Abriendo tu menú…</h1>
      <p className="muted">Vinculando la sesión con tu mesa.</p>
    </section>
  );
}
