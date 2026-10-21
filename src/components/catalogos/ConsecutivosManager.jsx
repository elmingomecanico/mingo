import React, { useState, useEffect } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { rtdb } from '../../firebase';
import { 
  Hash, Save, RotateCcw, Sparkles, FileText, Package, 
  Wrench, ShieldCheck, CheckCircle2, AlertCircle, Info, Lock, ArrowRightLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

export const DEFAULT_CONSECUTIVOS = {
  ventas: {
    prefijo: 'FAC-',
    siguiente_numero: 1,
    digitos_relleno: 4,
    incluir_prefijo_sucursal: false,
    descripcion: 'Formato correlativo para tickets y facturas de venta POS'
  },
  productos: {
    prefijo: 'PROD-',
    siguiente_numero: 1,
    digitos_relleno: 4,
    permitir_edicion_libre: true,
    descripcion: 'Código visible comercial/SKU para productos y repuestos'
  },
  servicios: {
    prefijo: 'SRV-',
    siguiente_numero: 1,
    digitos_relleno: 4,
    permitir_edicion_libre: true,
    descripcion: 'Código visible para servicios y mano de obra del taller'
  },
  ordenes_taller: {
    prefijo: 'OT-',
    siguiente_numero: 1,
    digitos_relleno: 4,
    incluir_prefijo_sucursal: false,
    descripcion: 'Número correlativo para órdenes de trabajo en taller'
  },
  traspasos: {
    prefijo: 'TRAS-',
    siguiente_numero: 1,
    digitos_relleno: 4,
    permitir_edicion_libre: true,
    descripcion: 'Correlativo y código de remisión para traslados de inventario entre sucursales'
  }
};

export const formatConsecutive = (config, currentNum = null) => {
  if (!config) return '';
  const num = currentNum !== null ? currentNum : (config.siguiente_numero || 1);
  const pad = Number(config.digitos_relleno) || 4;
  const numStr = num.toString().padStart(pad, '0');
  const pref = config.prefijo !== undefined ? config.prefijo : '';
  return `${pref}${numStr}`;
};

export default function ConsecutivosManager({ user }) {
  const [config, setConfig] = useState(DEFAULT_CONSECUTIVOS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const consRef = ref(rtdb, 'configuracion/consecutivos');
    const unsub = onValue(consRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setConfig({
          ventas: { ...DEFAULT_CONSECUTIVOS.ventas, ...(val.ventas || {}) },
          productos: { ...DEFAULT_CONSECUTIVOS.productos, ...(val.productos || {}) },
          servicios: { ...DEFAULT_CONSECUTIVOS.servicios, ...(val.servicios || {}) },
          ordenes_taller: { ...DEFAULT_CONSECUTIVOS.ordenes_taller, ...(val.ordenes_taller || {}) },
          traspasos: { ...DEFAULT_CONSECUTIVOS.traspasos, ...(val.traspasos || {}) }
        });
      } else {
        setConfig(DEFAULT_CONSECUTIVOS);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSaving(true);
    try {
      const consRef = ref(rtdb, 'configuracion/consecutivos');
      await set(consRef, {
        ...config,
        actualizado_en: new Date().toISOString(),
        actualizado_por: user?.nombre_completo || 'SuperAdmin'
      });

      // Sincronizar el contador de ventas en RTDB si el SuperAdmin modificó de dónde arranca
      if (config.ventas?.siguiente_numero) {
        await set(ref(rtdb, 'counters/ventas'), Number(config.ventas.siguiente_numero) - 1);
      }

      toast.success('✨ Configuración de folios y consecutivos guardada exitosamente');
    } catch (err) {
      toast.error('Error al guardar consecutivos: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('¿Desea restablecer las reglas de numeración a los valores estándar?')) return;
    setConfig(DEFAULT_CONSECUTIVOS);
    try {
      await set(ref(rtdb, 'configuracion/consecutivos'), DEFAULT_CONSECUTIVOS);
      toast.success('Reglas de folios restablecidas');
    } catch (err) {
      toast.error('Error al restablecer: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Hash className="text-blue-600" size={24} />
            Configuración de Folios, Facturas y Códigos Visibles
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Define prefijos (letras/símbolos), de dónde empieza el consecutivo y el formato visual de cada documento.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={15} /> Restablecer
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Reglas'}
          </button>
        </div>
      </div>

      {/* NOTA AUDITABLE */}
      <div className="bg-blue-50/80 p-4 rounded-2xl border border-blue-100 flex items-start gap-3 text-xs text-blue-900">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-black block">Garantía de Unicidad e Integridad de Base de Datos:</span>
          <p className="text-blue-800 leading-relaxed">
            Cada producto, factura, orden y movimiento conserva siempre su <strong>UUID interno irrepetible en la base de datos</strong>. Lo que tú defines aquí es el <strong>código visible al público</strong> (impreso en facturas, etiquetas y mostrado a clientes y cajeros), con total libertad para utilizar letras, guiones, símbolos o solo números.
          </p>
        </div>
      </div>

      {/* GRID DE LAS 4 ENTIDADES DE CONSECUTIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* BLOQUE 1: FACTURAS DE VENTA POS */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600" size={18} />
              1. Facturas y Tickets de Venta (POS)
            </h3>
            <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">
              Próximo: {formatConsecutive(config.ventas)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Prefijo / Texto / Símbolo
                </label>
                <input
                  type="text"
                  placeholder="Ej: FAC-, F#, 001-"
                  value={config.ventas.prefijo}
                  onChange={e => setConfig({
                    ...config,
                    ventas: { ...config.ventas, prefijo: e.target.value }
                  })}
                  className="w-full border p-2.5 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Letras o símbolos iniciales (o dejar en blanco)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Consecutivo Inicial / Actual *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={config.ventas.siguiente_numero}
                  onChange={e => setConfig({
                    ...config,
                    ventas: { ...config.ventas, siguiente_numero: Math.max(1, parseInt(e.target.value) || 1) }
                  })}
                  className="w-full border p-2.5 rounded-xl text-sm font-mono font-black text-blue-700 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">Desde qué número empieza a contar</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Relleno de Ceros (Dígitos)
                </label>
                <select
                  value={config.ventas.digitos_relleno}
                  onChange={e => setConfig({
                    ...config,
                    ventas: { ...config.ventas, digitos_relleno: parseInt(e.target.value) }
                  })}
                  className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-bold outline-none"
                >
                  <option value="3">3 dígitos (ej: 001)</option>
                  <option value="4">4 dígitos (ej: 0001)</option>
                  <option value="5">5 dígitos (ej: 00001)</option>
                  <option value="6">6 dígitos (ej: 000001)</option>
                  <option value="8">8 dígitos (ej: 00000001)</option>
                </select>
              </div>

              <div className="pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!config.ventas.incluir_prefijo_sucursal}
                    onChange={e => setConfig({
                      ...config,
                      ventas: { ...config.ventas, incluir_prefijo_sucursal: e.target.checked }
                    })}
                    className="rounded text-blue-600"
                  />
                  <span>Incluir prefijo de sucursal (ej: SUC01-FAC-0001)</span>
                </label>
              </div>
            </div>

            {/* Muestra previa en vivo */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs flex justify-between items-center">
              <span className="font-bold text-gray-500">Ejemplo de cómo saldrá la factura:</span>
              <span className="font-mono text-base font-black text-blue-900 bg-white px-3 py-1 rounded-lg border shadow-xs">
                {formatConsecutive(config.ventas)}
              </span>
            </div>
          </div>
        </div>

        {/* BLOQUE 2: CÓDIGOS VISIBLES DE PRODUCTOS Y REPUESTOS */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <Package className="text-emerald-600" size={18} />
              2. Códigos Visibles de Productos y Repuestos (SKU)
            </h3>
            <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
              Próximo: {formatConsecutive(config.productos)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Prefijo / Texto / Símbolo
                </label>
                <input
                  type="text"
                  placeholder="Ej: PROD-, REP#, ART-"
                  value={config.productos.prefijo}
                  onChange={e => setConfig({
                    ...config,
                    productos: { ...config.productos, prefijo: e.target.value }
                  })}
                  className="w-full border p-2.5 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-gray-400 mt-0.5">O déjalo vacío si solo quieres números (ej: 1001)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Consecutivo Inicial / Actual *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={config.productos.siguiente_numero}
                  onChange={e => setConfig({
                    ...config,
                    productos: { ...config.productos, siguiente_numero: Math.max(1, parseInt(e.target.value) || 1) }
                  })}
                  className="w-full border p-2.5 rounded-xl text-sm font-mono font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Relleno de Ceros (Dígitos)
                </label>
                <select
                  value={config.productos.digitos_relleno}
                  onChange={e => setConfig({
                    ...config,
                    productos: { ...config.productos, digitos_relleno: parseInt(e.target.value) }
                  })}
                  className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-bold outline-none"
                >
                  <option value="3">3 dígitos (ej: 001)</option>
                  <option value="4">4 dígitos (ej: 0001)</option>
                  <option value="5">5 dígitos (ej: 00001)</option>
                  <option value="6">6 dígitos (ej: 000001)</option>
                </select>
              </div>

              <div className="pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!config.productos.permitir_edicion_libre}
                    onChange={e => setConfig({
                      ...config,
                      productos: { ...config.productos, permitir_edicion_libre: e.target.checked }
                    })}
                    className="rounded text-emerald-600"
                  />
                  <span>Permitir digitar código libre manual en inventario</span>
                </label>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs flex justify-between items-center">
              <span className="font-bold text-gray-500">Ejemplo de código visible generado:</span>
              <span className="font-mono text-base font-black text-emerald-900 bg-white px-3 py-1 rounded-lg border shadow-xs">
                {formatConsecutive(config.productos)}
              </span>
            </div>
          </div>
        </div>

        {/* BLOQUE 3: CÓDIGOS VISIBLES DE SERVICIOS */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <Wrench className="text-purple-600" size={18} />
              3. Códigos Visibles de Servicios y Mano de Obra
            </h3>
            <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">
              Próximo: {formatConsecutive(config.servicios)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Prefijo / Símbolo
                </label>
                <input
                  type="text"
                  placeholder="Ej: SRV-, MEC#, MO-"
                  value={config.servicios.prefijo}
                  onChange={e => setConfig({
                    ...config,
                    servicios: { ...config.servicios, prefijo: e.target.value }
                  })}
                  className="w-full border p-2.5 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Consecutivo Inicial *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={config.servicios.siguiente_numero}
                  onChange={e => setConfig({
                    ...config,
                    servicios: { ...config.servicios, siguiente_numero: Math.max(1, parseInt(e.target.value) || 1) }
                  })}
                  className="w-full border p-2.5 rounded-xl text-sm font-mono font-black text-purple-700 outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs flex justify-between items-center">
              <span className="font-bold text-gray-500">Ejemplo de código de servicio:</span>
              <span className="font-mono text-base font-black text-purple-900 bg-white px-3 py-1 rounded-lg border shadow-xs">
                {formatConsecutive(config.servicios)}
              </span>
            </div>
          </div>
        </div>

        {/* BLOQUE 4: ÓRDENES DE TRABAJO (TALLER) */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <Sparkles className="text-amber-600" size={18} />
              4. Órdenes de Trabajo de Mecánica (Taller)
            </h3>
            <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
              Próximo: {formatConsecutive(config.ordenes_taller)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Prefijo / Símbolo
                </label>
                <input
                  type="text"
                  placeholder="Ej: OT-, ORD#"
                  value={config.ordenes_taller.prefijo}
                  onChange={e => setConfig({
                    ...config,
                    ordenes_taller: { ...config.ordenes_taller, prefijo: e.target.value }
                  })}
                  className="w-full border p-2.5 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Consecutivo Inicial *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={config.ordenes_taller.siguiente_numero}
                  onChange={e => setConfig({
                    ...config,
                    ordenes_taller: { ...config.ordenes_taller, siguiente_numero: Math.max(1, parseInt(e.target.value) || 1) }
                  })}
                  className="w-full border p-2.5 rounded-xl text-sm font-mono font-black text-amber-700 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs flex justify-between items-center">
              <span className="font-bold text-gray-500">Ejemplo de número de orden:</span>
              <span className="font-mono text-base font-black text-amber-900 bg-white px-3 py-1 rounded-lg border shadow-xs">
                {formatConsecutive(config.ordenes_taller)}
              </span>
            </div>
          </div>
        </div>

        {/* BLOQUE 5: TRASPASOS ENTRE SUCURSALES */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <ArrowRightLeft className="text-emerald-600" size={18} />
              5. Traspasos de Inventario entre Sucursales
            </h3>
            <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
              Próximo: {formatConsecutive(config.traspasos)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Prefijo / Siglas
                </label>
                <input
                  type="text"
                  placeholder="Ej: TRAS-, T-, o en blanco"
                  value={config.traspasos?.prefijo ?? 'TRAS-'}
                  onChange={e => setConfig({
                    ...config,
                    traspasos: { ...(config.traspasos || DEFAULT_CONSECUTIVOS.traspasos), prefijo: e.target.value }
                  })}
                  className="w-full border p-2.5 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">Puedes poner TRAS-, T- o dejarlo vacío para sin prefijo</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Consecutivo Inicial *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={config.traspasos?.siguiente_numero || 1}
                  onChange={e => setConfig({
                    ...config,
                    traspasos: { ...(config.traspasos || DEFAULT_CONSECUTIVOS.traspasos), siguiente_numero: Math.max(1, parseInt(e.target.value) || 1) }
                  })}
                  className="w-full border p-2.5 rounded-xl text-sm font-mono font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">Número correlativo de arranque</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Relleno de Ceros
                </label>
                <select
                  value={config.traspasos?.digitos_relleno || 4}
                  onChange={e => setConfig({
                    ...config,
                    traspasos: { ...(config.traspasos || DEFAULT_CONSECUTIVOS.traspasos), digitos_relleno: parseInt(e.target.value) || 4 }
                  })}
                  className="w-full border p-2.5 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value={1}>Sin ceros (1, 2, 3...)</option>
                  <option value={2}>2 dígitos (01, 02...)</option>
                  <option value={3}>3 dígitos (001, 002...)</option>
                  <option value={4}>4 dígitos (0001, 0002...)</option>
                  <option value={5}>5 dígitos (00001...)</option>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Formato visual de numeración</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={config.traspasos?.permitir_edicion_libre !== false}
                  onChange={e => setConfig({
                    ...config,
                    traspasos: { ...(config.traspasos || DEFAULT_CONSECUTIVOS.traspasos), permitir_edicion_libre: e.target.checked }
                  })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                Permitir al usuario modificar o personalizar el código al momento de traspasar
              </label>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs flex justify-between items-center">
              <span className="font-bold text-emerald-900">Ejemplo de número de traspaso generado:</span>
              <span className="font-mono text-base font-black text-emerald-950 bg-white px-3 py-1 rounded-lg border border-emerald-300 shadow-xs">
                {formatConsecutive(config.traspasos || DEFAULT_CONSECUTIVOS.traspasos)}
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
