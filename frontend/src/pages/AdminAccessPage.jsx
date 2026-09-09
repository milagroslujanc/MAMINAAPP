import { useEffect, useState } from 'react';
import { api } from '../api';

export default function AdminAccessPage() {
  const [staffAccess, setStaffAccess] = useState({});
  const [accessError, setAccessError] = useState('');
  const [savingRole, setSavingRole] = useState(null);

  useEffect(() => {
    let cancelled = false;

    api.getStaffAccess()
      .then((access) => {
        if (!cancelled) setStaffAccess(access);
      })
      .catch((err) => {
        if (!cancelled) setAccessError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleAccess(role) {
    const isOpen = !staffAccess[role]?.isOpen;
    setSavingRole(role);
    setAccessError('');
    try {
      const result = await api.setStaffAccess(role, isOpen);
      setStaffAccess((prev) => ({ ...prev, [role]: result }));
    } catch (err) {
      setAccessError(err.message);
    } finally {
      setSavingRole(null);
    }
  }

  return (
    <section className="admin-access-page">
      <div className="admin-menu-header">
        <div>
          <p className="eyebrow">Gestión · Control de acceso</p>
          <h1>Disponibilidad de personal</h1>
          <p className="muted">
            Cierra el acceso para desconectar las sesiones activas de ese rol.
          </p>
        </div>
      </div>

      <div className="staff-access-panel">
        <div className="staff-access-actions">
          {['cocina', 'mesero'].map((role) => {
            const isOpen = staffAccess[role]?.isOpen !== false;
            return (
              <button
                key={role}
                type="button"
                className={`btn ${isOpen ? 'primary' : ''}`}
                aria-pressed={isOpen}
                disabled={savingRole === role}
                onClick={() => toggleAccess(role)}
              >
                {role === 'cocina' ? 'Cocina' : 'Mesero'}: {isOpen ? 'Abierto' : 'Cerrado'}
              </button>
            );
          })}
        </div>
        {accessError && <div className="alert">{accessError}</div>}
      </div>
    </section>
  );
}
