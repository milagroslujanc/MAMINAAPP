import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api';

export default function EntrancePage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [pendingTable, setPendingTable] = useState(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await api.getTables();
      setTables(Array.isArray(data) ? data : []);
      if (!Array.isArray(data)) {
        setError('El API no devolvió la lista de mesas. Revisa VITE_API_URL y que el backend esté arriba.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!pendingTable) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') setPendingTable(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pendingTable]);

  async function confirmSelect() {
    if (!pendingTable) return;
    const table = pendingTable;
    setPendingTable(null);
    setBusyId(table.id);
    setError('');
    try {
      const result = await api.selectTable(table.id);
      setSelected({
        title: `Mesa ${result.table.number}`,
        qrUrl: result.qrUrl,
        subtitle: 'Escanea el QR con tu celular para abrir el menú',
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleTakeaway() {
    setBusyId('takeaway');
    setError('');
    try {
      const result = await api.takeaway();
      setSelected({
        title: 'Pedido para llevar',
        qrUrl: result.qrUrl,
        subtitle: 'Escanea el QR para armar tu pedido desde el celular',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRelease(tableId) {
    try {
      await api.releaseTable(tableId);
      if (selected) setSelected(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="entrance">
      <div className="entrance-hero">
        <p className="eyebrow">Pantalla de recepción · Sprint 1</p>
        <h1>Elige tu mesa</h1>
        <p className="lede">
          Selecciona una mesa libre o pide para llevar. Al confirmar, el sistema genera un código
          QR único para abrir el menú digital.
        </p>
      </div>

      {error && <div className="alert">{error}</div>}
      {loading && <p className="muted">Cargando mesas…</p>}

      <div className="tables-grid">
        {tables.map((table) => (
          <button
            key={table.id}
            type="button"
            className={`table-tile ${table.status}`}
            disabled={table.status === 'ocupada' || busyId === table.id}
            onClick={() => table.status !== 'ocupada' && setPendingTable(table)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (table.status === 'ocupada') handleRelease(table.id);
            }}
          >
            <span className="table-num">Mesa {table.number}</span>
            <span className="table-meta">{table.capacity} pers.</span>
            <span className="table-status">{table.status}</span>
          </button>
        ))}
      </div>

      <div className="takeaway-row">
        <button
          type="button"
          className="btn primary large"
          disabled={busyId === 'takeaway'}
          onClick={handleTakeaway}
        >
          Pedir para llevar
        </button>
        <p className="hint">Clic derecho en una mesa ocupada la libera (demo recepción).</p>
      </div>

      {pendingTable && (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingTable(null)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar mesa"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>¿Confirmar Mesa {pendingTable.number}?</h2>
            <p className="muted">
              La mesa pasará a ocupada y se generará un QR único para el menú.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setPendingTable(null)}>
                Cancelar
              </button>
              <button type="button" className="btn primary" onClick={confirmSelect}>
                Confirmar selección
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="qr-panel" role="dialog" aria-label="Código QR">
          <button type="button" className="qr-close" onClick={() => setSelected(null)}>
            Cerrar
          </button>
          <h2>{selected.title}</h2>
          <p>{selected.subtitle}</p>
          <div className="qr-box">
            <QRCodeSVG value={selected.qrUrl} size={220} level="M" includeMargin />
          </div>
          <a className="qr-link" href={selected.qrUrl} target="_blank" rel="noreferrer">
            Abrir menú en este dispositivo
          </a>
        </div>
      )}
    </section>
  );
}
