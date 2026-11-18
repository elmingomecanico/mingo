import { ref, get, push, set } from 'firebase/database';
import { rtdb } from '../firebase';

export const DEFAULT_EMAIL_CONFIG = {
  habilitado: true,
  destinatario: 'elmingomecanico@gmail.com',
  proveedor: 'apps_script', // 'apps_script' | 'resend' | 'brevo'
  webhook_url: '',
  api_key: '',
  remitente_nombre: 'ERP Taller El Mingo',
  eventos: {
    entradas: true,
    salidas: true,
    ajustes: true,
    traspasos: true,
    ordenes_entrega: true,
    cierres_caja: true
  }
};

const EVENT_LABELS = {
  entradas: { label: 'Entrada / Compra', color: '#059669', badgeBg: '#ecfdf5' },
  salidas: { label: 'Salida / Venta POS', color: '#2563eb', badgeBg: '#eff6ff' },
  ajustes: { label: 'Ajuste de Inventario', color: '#d97706', badgeBg: '#fffbeb' },
  traspasos: { label: 'Traspaso entre Sucursales', color: '#7c3aed', badgeBg: '#f5f3ff' },
  ordenes_entrega: { label: 'Orden de Entrega / Custodia', color: '#0891b2', badgeBg: '#ecfeff' },
  cierres_caja: { label: 'Cierre de Caja', color: '#be123c', badgeBg: '#fff1f2' },
  prueba: { label: 'Correo de Prueba', color: '#1d4ed8', badgeBg: '#eff6ff' }
};

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMovementHtml({ evento, titulo, folio, sucursal, usuario, clienteOProveedor, monto, resumen, items = [], notas = '', fechaStr }) {
  const meta = EVENT_LABELS[evento] || EVENT_LABELS.prueba;

  const itemsRows = (items || []).slice(0, 30).map((it) => {
    const nombre = escapeHtml(it.nombre || it.name || it.descripcion || 'Artículo');
    const cant = escapeHtml(it.cantidad ?? it.qty ?? 1);
    const sub = it.subtotal !== undefined
      ? `C$ ${Number(it.subtotal || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`
      : (it.precio !== undefined ? `C$ ${Number(it.precio || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}` : '-');
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;">${nombre}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;font-weight:bold;color:#111827;">${cant}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;color:#374151;">${sub}</td>
      </tr>`;
  }).join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background:#f9fafb;padding:20px;border-radius:16px;">
    <div style="background:#1e3a8a;color:#ffffff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#93c5fd;font-weight:bold;">ERP Taller y Repuestos El Mingo</div>
      <h2 style="margin:6px 0 0 0;font-size:20px;">${escapeHtml(titulo || meta.label)}</h2>
    </div>
    <div style="background:#ffffff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
      <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:${meta.badgeBg};color:${meta.color};font-weight:bold;font-size:12px;margin-bottom:16px;">
        ${escapeHtml(meta.label)}
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px;">
        ${folio ? `<tr><td style="padding:5px 0;color:#6b7280;width:160px;"><strong>Folio / Referencia:</strong></td><td style="padding:5px 0;color:#111827;font-weight:bold;">${escapeHtml(folio)}</td></tr>` : ''}
        <tr><td style="padding:5px 0;color:#6b7280;"><strong>Fecha y Hora:</strong></td><td style="padding:5px 0;color:#111827;">${escapeHtml(fechaStr)}</td></tr>
        ${sucursal ? `<tr><td style="padding:5px 0;color:#6b7280;"><strong>Sucursal:</strong></td><td style="padding:5px 0;color:#111827;">${escapeHtml(sucursal)}</td></tr>` : ''}
        ${usuario ? `<tr><td style="padding:5px 0;color:#6b7280;"><strong>Responsable:</strong></td><td style="padding:5px 0;color:#111827;">${escapeHtml(usuario)}</td></tr>` : ''}
        ${clienteOProveedor ? `<tr><td style="padding:5px 0;color:#6b7280;"><strong>Cliente / Proveedor:</strong></td><td style="padding:5px 0;color:#111827;">${escapeHtml(clienteOProveedor)}</td></tr>` : ''}
        ${monto !== undefined && monto !== null ? `<tr><td style="padding:5px 0;color:#6b7280;"><strong>Monto Total:</strong></td><td style="padding:5px 0;color:#059669;font-weight:bold;font-size:15px;">C$ ${Number(monto || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      </table>

      ${resumen ? `<div style="background:#f3f4f6;padding:12px 14px;border-radius:8px;font-size:13px;color:#374151;margin-bottom:16px;">${escapeHtml(resumen)}</div>` : ''}

      ${itemsRows ? `
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Detalle</th>
              <th style="padding:8px 10px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Cant.</th>
              <th style="padding:8px 10px;text-align:right;font-size:11px;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>` : ''}

      ${notas ? `<p style="font-size:12px;color:#6b7280;border-top:1px solid #f3f4f6;padding-top:12px;margin:0;"><strong>Observaciones:</strong> ${escapeHtml(notas)}</p>` : ''}
    </div>
    <p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:14px;">
      Notificación automática generada por ERP Taller El Mingo (https://mingo-wnm.pages.dev)
    </p>
  </div>`;
}

export async function getEmailNotificationConfig() {
  try {
    const snap = await get(ref(rtdb, 'configuracion/notificaciones'));
    if (snap.exists()) {
      const val = snap.val();
      return {
        ...DEFAULT_EMAIL_CONFIG,
        ...val,
        eventos: {
          ...DEFAULT_EMAIL_CONFIG.eventos,
          ...(val.eventos || {})
        }
      };
    }
  } catch (err) {
    console.warn('No se pudo leer configuracion/notificaciones:', err);
  }
  return { ...DEFAULT_EMAIL_CONFIG };
}

/**
 * Envía notificación por correo de un movimiento del ERP (no bloqueante).
 * Siempre guarda trazabilidad en `notificaciones_correo` de Firebase RTDB.
 */
export async function notifyMovementByEmail(payload = {}) {
  const {
    evento = 'prueba',
    titulo = 'Movimiento ERP',
    folio = '',
    sucursal = '',
    usuario = 'Sistema',
    clienteOProveedor = '',
    monto = null,
    resumen = '',
    items = [],
    notas = '',
    overrideConfig = null
  } = payload;

  try {
    const cfg = overrideConfig || (await getEmailNotificationConfig());
    if (!overrideConfig) {
      if (!cfg.habilitado) return { skipped: true };
      if (evento !== 'prueba' && cfg.eventos && cfg.eventos[evento] === false) {
        return { skipped: true };
      }
    }

    const destinatario = (cfg.destinatario || 'elmingomecanico@gmail.com').trim();
    const ahora = new Date();
    const fechaIso = ahora.toISOString();
    const fechaStr = ahora.toLocaleString('es-NI', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const meta = EVENT_LABELS[evento] || EVENT_LABELS.prueba;
    const subject = `[El Mingo ERP] ${meta.label}${folio ? ` #${folio}` : ''} — ${titulo}`;
    const html = buildMovementHtml({
      evento,
      titulo,
      folio,
      sucursal,
      usuario,
      clienteOProveedor,
      monto,
      resumen,
      items,
      notas,
      fechaStr
    });
    const text = `${subject}\nFecha: ${fechaStr}\nSucursal: ${sucursal}\nResponsable: ${usuario}\n${resumen}`;

    let result = { ok: false, pendingConfig: false, message: 'No se pudo conectar con /api/send-email' };
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: destinatario,
          subject,
          html,
          text,
          fromName: cfg.remitente_nombre || 'ERP Taller El Mingo',
          provider: cfg.proveedor || 'apps_script',
          webhookUrl: cfg.webhook_url || '',
          apiKey: cfg.api_key || ''
        })
      });
      if (res.ok) {
        result = await res.json();
      } else {
        result = { ok: false, message: `HTTP ${res.status} en /api/send-email` };
      }
    } catch (fetchErr) {
      result = { ok: false, message: fetchErr?.message || 'Error de red en /api/send-email' };
    }

    const estado = result.ok ? 'enviado' : (result.pendingConfig ? 'pendiente_config' : 'error');

    // Registrar en bitácora de Firebase para verificación gerencial
    try {
      await set(push(ref(rtdb, 'notificaciones_correo')), {
        fecha: new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 10),
        timestamp: fechaIso,
        evento,
        titulo,
        folio: folio || '-',
        sucursal: sucursal || '-',
        usuario: usuario || 'Sistema',
        destinatario,
        monto: monto !== null && monto !== undefined ? Number(monto) : null,
        estado,
        proveedor: result.provider || cfg.proveedor || 'sin_configurar',
        detalle: result.message || ''
      });
    } catch (logErr) {
      console.warn('Error registrando bitácora de correo:', logErr);
    }

    return result;
  } catch (err) {
    console.warn('Error en notifyMovementByEmail:', err);
    return { ok: false, message: err?.message || 'Error inesperado' };
  }
}
