import React, { useState, useEffect } from 'react';
import { DollarSign, Save, RefreshCw, Calendar, ShieldCheck, Info } from 'lucide-react';
import { ref, onValue, update } from 'firebase/database';
import { rtdb } from '../../firebase';
import toast from 'react-hot-toast';

export default function ExchangeRateManager({ user }) {
  const [tasa, setTasa] = useState('36.6240');
  const [fechaActualizacion, setFechaActualizacion] = useState('');
  const [actualizadoPor, setActualizadoPor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const tcRef = ref(rtdb, 'configuracion/tasa_cambio');
    const unsub = onValue(tcRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        if (typeof val === 'object' && val !== null) {
          setTasa(val.valor?.toString() || '36.6240');
          setFechaActualizacion(val.fecha_actualizacion || '');
          setActualizadoPor(val.actualizado_por || '');
        } else {
          setTasa(val?.toString() || '36.6240');
        }
      }
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const num = parseFloat(tasa);
    if (!num || num <= 0) {
      return toast.error('Ingrese una tasa de cambio válida mayor a 0');
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const userName = user?.nombre_completo || user?.nombre || 'Administrador';
      await update(ref(rtdb, 'configuracion/tasa_cambio'), {
        valor: num,
        fecha_actualizacion: now,
        actualizado_por: userName
      });
      setFechaActualizacion(now);
      setActualizadoPor(userName);
      toast.success(`Tasa de cambio actualizada: 1 USD = C$ ${num.toFixed(4)}`);
    } catch (err) {
      toast.error('Error al guardar tasa de cambio: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
          <DollarSign className="text-emerald-600" />
          Moneda y Tasa de Cambio (USD / NIO)
        </h2>
        <p className="text-xs text-gray-500">
          Configuración de la tasa de cambio oficial para cobros en dólares, arqueos de caja y equivalencias monetarias.
        </p>
      </div>

      <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
        <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
        <div>
          <span className="font-bold block text-sm mb-1">Régimen Monetario y Legal:</span>
          Todas las transacciones, inventarios, compras y contabilidad del ERP se registran y custodian con base contable en <strong>Córdobas (C$)</strong> conforme a las leyes de la República de Nicaragua. La tasa de cambio oficial se utiliza de manera dinámica para permitir el ingreso de pagos en dólares, devuelto exacto en córdobas o dólares, y adaptación ágil a modificaciones futuras en la legislación financiera.
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-gray-50/60 border border-gray-200 p-5 rounded-2xl space-y-4 max-w-xl">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
            Tasa de Cambio Oficial (Córdobas por 1 Dólar)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-3 text-gray-400 font-bold text-sm">
              C$
            </span>
            <input
              type="number"
              step="0.0001"
              min="1"
              value={tasa}
              onChange={(e) => setTasa(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-xl text-lg font-black text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              placeholder="36.6240"
              required
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Ejemplo: 36.6240 (Tasa de referencia Banco Central de Nicaragua)
          </p>
        </div>

        {fechaActualizacion && (
          <div className="bg-white p-3 rounded-xl border border-gray-100 text-xs text-gray-600 space-y-1">
            <div className="flex items-center gap-1.5 font-medium">
              <Calendar size={13} className="text-blue-500" />
              <span>Última modificación: <strong>{new Date(fechaActualizacion).toLocaleString('es-NI')}</strong></span>
            </div>
            {actualizadoPor && (
              <div className="flex items-center gap-1.5 text-gray-500">
                <ShieldCheck size={13} className="text-emerald-600" />
                <span>Modificado por: <strong>{actualizadoPor}</strong></span>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || loading}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-2.5 px-5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          {saving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
          <span>Guardar Tasa de Cambio</span>
        </button>
      </form>
    </div>
  );
}
