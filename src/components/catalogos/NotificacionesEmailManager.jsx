import React, { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { rtdb } from '../../firebase';
import {
  Mail, Send, Save, CheckCircle2, AlertTriangle, Clock,
  Copy, Check, ShieldCheck, Bell, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DEFAULT_EMAIL_CONFIG, notifyMovementByEmail } from '../../utils/emailNotificationService';

const APPS_SCRIPT_SNIPPET = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  MailApp.sendEmail({
    to: data.to || "elmingomecanico@gmail.com",
    subject: data.subject || "Notificación ERP El Mingo",
    body: data.text || "",
    htmlBody: data.html || "",
    name: data.fromName || "ERP Taller El Mingo"
  });
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const EVENTO_OPCIONES = [
  { key: 'entradas', label: 'Entradas / Compras', desc: 'Cada compra o ingreso de mercancía a bodega.' },
  { key: 'salidas', label: 'Salidas / Ventas POS', desc: 'Cada factura emitida en caja (contado, crédito, transferencia).' },
  { key: 'ajustes', label: 'Ajustes de Inventario', desc: 'Entradas o salidas manuales de corrección o mermas.' },
  { key: 'traspasos', label: 'Traspasos entre Sucursales', desc: 'Envíos y traslados de repuestos entre sedes.' },
  { key: 'ordenes_entrega', label: 'Órdenes de Entrega y Custodia', desc: 'Mercancía dejada pendiente de retiro y despachos realizados.' },
  { key: 'cierres_caja', label: 'Cierres de Caja / Arqueos', desc: 'Resumen de efectivo, ventas y diferencias al cerrar turno.' }
];

export default function NotificacionesEmailManager({ user }) {
  const [config, setConfig] = useState(DEFAULT_EMAIL_CONFIG);
  const [logs, setLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    const cfgRef = ref(rtdb, 'configuracion/notificaciones');
    const unsubCfg = onValue(cfgRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setConfig({
          ...DEFAULT_EMAIL_CONFIG,
          ...val,
          eventos: { ...DEFAULT_EMAIL_CONFIG.eventos, ...(val.eventos || {}) }
        });
      }
    });

    const logsRef = ref(rtdb, 'notificaciones_correo');
    const unsubLogs = onValue(logsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.keys(val).map((k) => ({ id: k, ...val[k] }));
        list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        setLogs(list.slice(0, 30));
      } else {
        setLogs([]);
      }
    });

    return () => {
      unsubCfg();
      unsubLogs();
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!config.destinatario.trim() || !config.destinatario.includes('@')) {
      return toast.error('Ingrese un correo destinatario válido.');
    }
    setSaving(true);
    try {
      await set(ref(rtdb, 'configuracion/notificaciones'), {
        ...config,
        destinatario: config.destinatario.trim(),
        webhook_url: (config.webhook_url || '').trim(),
        api_key: (config.api_key || '').trim(),
        actualizado_por: user?.nombre_completo || 'SuperAdmin',
        actualizado_en: new Date().toISOString()
      });
      toast.success('Configuración de notificaciones guardada.');
    } catch (err) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      const res = await notifyMovementByEmail({
        evento: 'prueba',
        titulo: 'Prueba de Conexión de Notificaciones',
        folio: 'TEST-001',
        sucursal: 'Todas las Sedes',
        usuario: user?.nombre_completo || 'SuperAdmin',
        resumen: 'Este es un correo de prueba enviado desde Configuración del Sistema del ERP Taller El Mingo para verificar que las alertas llegan correctamente.',
        items: [
          { nombre: 'Verificación de Entradas / Salidas / Traspasos / Entregas', cantidad: 1, precio: 0 }
        ],
        notas: 'Si recibes este mensaje en elmingomecanico@gmail.com, las notificaciones automáticas están 100% activas.',
        overrideConfig: {
          ...config,
          destinatario: config.destinatario.trim(),
          webhook_url: (config.webhook_url || '').trim(),
          api_key: (config.api_key || '').trim()
        }
      });

      if (res?.ok) {
        toast.success(res.message || `Correo de prueba enviado a ${config.destinatario}`);
      } else if (res?.pendingConfig) {
        toast.error('Falta configurar el enlace de Google Apps Script o la API Key (Resend/Brevo).', { duration: 6000 });
      } else {
        toast.error(res?.message || 'No se pudo enviar el correo de prueba.', { duration: 6000 });
      }
    } catch (err) {
      toast.error('Error al probar envío: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard?.writeText(APPS_SCRIPT_SNIPPET);
    setCopiedScript(true);
    toast.success('Código de Google Apps Script copiado');
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const toggleEvento = (key) => {
    setConfig((prev) => ({
      ...prev,
      eventos: {
        ...prev.eventos,
        [key]: !prev.eventos?.[key]
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <Mail className="text-blue-600" size={20} />
            Notificaciones Automáticas por Correo Electrónico
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Envía alertas detalladas en tiempo real a <strong>{config.destinatario || 'elmingomecanico@gmail.com'}</strong> por cada movimiento crítico del ERP.
          </p>
        </div>

        <label className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(config.habilitado)}
            onChange={(e) => setConfig({ ...config, habilitado: e.target.checked })}
            className="w-4 h-4 accent-blue-600 cursor-pointer"
          />
          <span className="text-xs font-black text-gray-700">
            {config.habilitado ? 'Notificaciones ACTIVAS' : 'Notificaciones PAUSADAS'}
          </span>
        </label>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Destinatario y Proveedor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Correo Destinatario Principal
            </label>
            <input
              type="email"
              required
              value={config.destinatario}
              onChange={(e) => setConfig({ ...config, destinatario: e.target.value })}
              className="w-full border border-gray-200 p-2.5 rounded-xl text-sm font-semibold outline-none focus:border-blue-500"
              placeholder="elmingomecanico@gmail.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Proveedor de Envío (Plan Gratuito)
            </label>
            <select
              value={config.proveedor}
              onChange={(e) => setConfig({ ...config, proveedor: e.target.value })}
              className="w-full border border-gray-200 p-2.5 rounded-xl text-sm font-semibold outline-none focus:border-blue-500 bg-white cursor-pointer"
            >
              <option value="apps_script">Google Apps Script (100% Gratis directo con Gmail)</option>
              <option value="resend">Resend API (3,000 correos/mes gratis)</option>
              <option value="brevo">Brevo API (300 correos/día gratis)</option>
            </select>
          </div>
        </div>

        {/* Credencial según proveedor */}
        {config.proveedor === 'apps_script' ? (
          <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-black text-blue-900 uppercase flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-blue-600" />
                  Conexión Gratuita Directa con Gmail (Google Apps Script)
                </h3>
                <p className="text-xs text-blue-800 mt-1">
                  1) Abre <strong>script.google.com</strong> con la cuenta <strong>elmingomecanico@gmail.com</strong> → Nuevo proyecto.
                  <br />2) Pega el código de abajo, pulsa <strong>Implementar → Nueva implementación → Aplicación web</strong> (Ejecutar como: <em>Yo</em>, Quién tiene acceso: <em>Cualquier persona</em>).
                  <br />3) Copia la URL que termina en <code>/exec</code> y pégala aquí:
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyScript}
                className="shrink-0 bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {copiedScript ? <Check size={14} /> : <Copy size={14} />}
                {copiedScript ? 'Copiado' : 'Copiar Código'}
              </button>
            </div>

            <pre className="bg-gray-900 text-emerald-300 text-[11px] p-3 rounded-xl overflow-x-auto font-mono">
              {APPS_SCRIPT_SNIPPET}
            </pre>

            <div>
              <label className="block text-xs font-bold text-blue-900 uppercase mb-1">
                URL de Aplicación Web de Google Apps Script (/exec)
              </label>
              <input
                type="url"
                value={config.webhook_url || ''}
                onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full border border-blue-300 bg-white p-2.5 rounded-xl text-xs sm:text-sm font-mono outline-none focus:border-blue-600"
              />
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase">
              API Key de {config.proveedor === 'resend' ? 'Resend (re_...)' : 'Brevo (xkeysib-...)'}
            </label>
            <input
              type="password"
              value={config.api_key || ''}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              placeholder={config.proveedor === 'resend' ? 're_xxxxxxxxxxxxx' : 'xkeysib-xxxxxxxxxxxxx'}
              className="w-full border border-slate-300 bg-white p-2.5 rounded-xl text-sm font-mono outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-500">
              También puedes configurarla como variable secreta en Cloudflare Pages (<code>{config.proveedor === 'resend' ? 'RESEND_API_KEY' : 'BREVO_API_KEY'}</code>).
            </p>
          </div>
        )}

        {/* Eventos activos */}
        <div className="space-y-3">
          <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Bell size={14} className="text-blue-600" />
            Movimientos que disparan notificación por correo
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EVENTO_OPCIONES.map((ev) => {
              const checked = config.eventos?.[ev.key] !== false;
              return (
                <label
                  key={ev.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    checked ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-gray-200 opacity-70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEvento(ev.key)}
                    className="w-4 h-4 mt-0.5 accent-blue-600 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-black text-gray-800">{ev.label}</div>
                    <div className="text-[11px] text-gray-500">{ev.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Botones */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md shadow-blue-200 cursor-pointer"
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>

          <button
            type="button"
            disabled={testing}
            onClick={handleSendTest}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-md shadow-emerald-200 cursor-pointer"
          >
            {testing ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
            {testing ? 'Enviando Prueba...' : 'Enviar Correo de Prueba'}
          </button>
        </div>
      </form>

      {/* Bitácora de envíos */}
      <div className="border-t border-gray-100 pt-5 space-y-3">
        <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
          <Clock size={16} className="text-blue-600" />
          Bitácora Reciente de Notificaciones ({logs.length})
        </h3>
        {logs.length === 0 ? (
          <div className="p-6 text-center bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400 font-semibold">
            Aún no hay correos registrados. Pulsa "Enviar Correo de Prueba" o realiza un movimiento en el sistema.
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Fecha / Hora</th>
                  <th className="py-2.5 px-3">Evento</th>
                  <th className="py-2.5 px-3">Folio / Detalle</th>
                  <th className="py-2.5 px-3">Sucursal</th>
                  <th className="py-2.5 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono text-gray-600">
                      {item.timestamp ? new Date(item.timestamp).toLocaleString('es-NI') : item.fecha}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-gray-800 uppercase">{item.evento}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-gray-800">{item.titulo}</div>
                      <div className="text-[10px] text-gray-500">Folio: {item.folio} · {item.usuario}</div>
                    </td>
                    <td className="py-2.5 px-3 text-gray-600">{item.sucursal}</td>
                    <td className="py-2.5 px-3">
                      {item.estado === 'enviado' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                          <CheckCircle2 size={11} /> Enviado
                        </span>
                      ) : item.estado === 'pendiente_config' ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold text-[10px]" title={item.detalle}>
                          <AlertTriangle size={11} /> Falta Configurar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold text-[10px]" title={item.detalle}>
                          <AlertTriangle size={11} /> Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
