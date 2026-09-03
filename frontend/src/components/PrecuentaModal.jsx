function formatDateTime(iso) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function money(value) {
  return `S/ ${Number(value).toFixed(2)}`;
}

/**
 * Precuenta: cabecera + detalle de ítems, con impresión a PDF.
 */
export default function PrecuentaModal({ open, order, onClose }) {
  if (!open || !order) return null;

  const destination =
    order.order_type === 'llevar' ? 'Para llevar' : `Mesa ${order.table_number ?? '—'}`;
  const items = Array.isArray(order.items) ? order.items : [];

  function printPdf() {
    const rows = items
      .map(
        (item) => `<tr>
          <td>${item.quantity}× ${item.product_name}</td>
          <td>${item.special_notes || ''}</td>
          <td>${money(item.unit_price)}</td>
          <td>${money(item.unit_price * item.quantity)}</td>
        </tr>`
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Precuenta pedido #${order.id}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#222}
        h1{font-size:20px;margin:0}
        .muted{color:#666;margin:4px 0 16px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
        th{background:#f3f3f3}
        .total{margin-top:16px;font-size:16px;text-align:right}
        header{border-bottom:2px solid #901020;padding-bottom:10px;margin-bottom:16px}
      </style></head><body>
      <header>
        <h1>La Mamina · Precuenta</h1>
        <p class="muted">Pedido #${order.id} · ${destination} · ${formatDateTime(order.created_at)}</p>
      </header>
      <table>
        <thead><tr><th>Producto</th><th>Nota</th><th>P. unit.</th><th>Subtotal</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4">Sin ítems</td></tr>'}</tbody>
      </table>
      <p class="total"><strong>Total a pagar: ${money(order.total)}</strong></p>
      <script>window.onload=()=>{window.print()}</script>
      </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card precuenta-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="precuenta-header">
          <p className="eyebrow">Precuenta</p>
          <h2>La Mamina</h2>
          <p>
            Pedido #{order.id} · {destination}
          </p>
          <p className="muted">{formatDateTime(order.created_at)}</p>
        </header>

        <ul className="detail-items">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>
                  {item.quantity}× {item.product_name}
                </strong>
                <span>{money(item.unit_price * item.quantity)}</span>
              </div>
              {item.special_notes && <p className="note-highlight">Nota: {item.special_notes}</p>}
            </li>
          ))}
        </ul>
        {order.notes && <p>Observación: {order.notes}</p>}
        <p className="total-row">
          <span>Total a pagar</span>
          <strong>{money(order.total)}</strong>
        </p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn primary" onClick={printPdf}>
            Imprimir PDF
          </button>
        </div>
      </div>
    </div>
  );
}
