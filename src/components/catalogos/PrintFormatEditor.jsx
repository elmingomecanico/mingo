import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { rtdb } from '../../firebase';
import { 
  Printer, Save, RotateCcw, Check, Eye, FileText, 
  Settings, CheckSquare, Square, Building2, Phone, 
  MapPin, Hash, Sparkles, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

export const DEFAULT_PRINT_CONFIG = {
  nombre_comercial: 'TALLER EL MINGO',
  eslogan: 'Servicios Mecánicos y Repuestos',
  ruc: 'J0310000284751',
  telefono: '+505 8888-8888 / 7777-7777',
  direccion: 'Managua, Nicaragua',
  ancho_papel: '80mm', // '80mm' | '58mm'
  tamano_letra: 'normal', // 'compacta' | 'normal' | 'grande'
  mostrar_sucursal: true,
  mostrar_cajero: true,
  mostrar_mecanico: true,
  mostrar_cliente_cedula: false,
  mostrar_codigo_producto: true,
  mostrar_descuentos: true,
  mostrar_regalias: true,
  mostrar_metodo_pago: true,
  mostrar_total_letras: false,
  mensaje_agradecimiento: '¡GRACIAS POR SU PREFERENCIA!',
  terminos_garantia: 'Garantía de repuestos de 30 días con su factura. No se aceptan cambios en partes eléctricas.',
  mensaje_despedida: 'Impreso por Sistema Taller El Mingo'
};

export default function PrintFormatEditor({ user }) {
  const [config, setConfig] = useState(DEFAULT_PRINT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    const configRef = ref(rtdb, 'configuracion/formatos_impresion');
    const unsub = onValue(configRef, (snap) => {
      if (snap.exists()) {
        setConfig({ ...DEFAULT_PRINT_CONFIG, ...snap.val() });
      } else {
        setConfig(DEFAULT_PRINT_CONFIG);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSaving(true);
    try {
      const configRef = ref(rtdb, 'configuracion/formatos_impresion');
      await set(configRef, {
        ...config,
        actualizado_en: new Date().toISOString(),
        actualizado_por: user?.nombre_completo || 'SuperAdmin'
      });
      toast.success('✨ Configuración de formato imprimible guardada exitosamente');
    } catch (err) {
      toast.error('Error al guardar configuración: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('¿Desea restablecer el formato de impresión a los valores predeterminados?')) return;
    setConfig(DEFAULT_PRINT_CONFIG);
    try {
      await set(ref(rtdb, 'configuracion/formatos_impresion'), DEFAULT_PRINT_CONFIG);
      toast.success('Formato de impresión restablecido');
    } catch (err) {
      toast.error('Error al restablecer: ' + err.message);
    }
  };

  const handlePrintTest = () => {
    window.print();
  };

  const is58mm = config.ancho_papel === '58mm';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Printer className="text-blue-600" size={24} />
            Editor de Formatos Imprimibles (Tickets y Facturas)
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Personaliza el encabezado, políticas de garantía y qué campos mostrar u ocultar en los tickets.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-1.5"
            title="Restablecer valores originales"
          >
            <RotateCcw size={15} /> Restablecer
          </button>

          <button
            type="button"
            onClick={handlePrintTest}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Printer size={16} /> Probar Impresión
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Formato'}
          </button>
        </div>
      </div>

      {/* DISPOSICIÓN EN 2 COLUMNAS: FORMULARIO Y VISTA PREVIA EN VIVO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LADO IZQUIERDO: CONTROLES DEL EDITOR */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* SECCIÓN 1: DATOS DE CABECERA COMERCIAL */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-gray-800 border-b pb-2.5 flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              1. Cabecera Comercial de la Empresa
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Nombre Comercial del Negocio *
                </label>
                <input
                  type="text"
                  value={config.nombre_comercial}
                  onChange={e => setConfig({ ...config, nombre_comercial: e.target.value })}
                  className="w-full border p-2.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Eslogan / Giro Comercial
                </label>
                <input
                  type="text"
                  value={config.eslogan}
                  onChange={e => setConfig({ ...config, eslogan: e.target.value })}
                  className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Número RUC / Cédula Fiscal
                </label>
                <input
                  type="text"
                  value={config.ruc}
                  onChange={e => setConfig({ ...config, ruc: e.target.value })}
                  className="w-full border p-2.5 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Teléfonos de Contacto
                </label>
                <input
                  type="text"
                  value={config.telefono}
                  onChange={e => setConfig({ ...config, telefono: e.target.value })}
                  className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Dirección / Ciudad
              </label>
              <input
                type="text"
                value={config.direccion}
                onChange={e => setConfig({ ...config, direccion: e.target.value })}
                className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* SECCIÓN 2: DIMENSIONES Y CAMPOS VISIBLES (TOGGLES) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-gray-800 border-b pb-2.5 flex items-center gap-2">
              <Settings size={16} className="text-emerald-600" />
              2. Dimensiones y Campos a Mostrar u Ocultar
            </h3>

            {/* Selector de Ancho de Papel */}
            <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Ancho del Papel de la Impresora</span>
                <span className="text-[11px] text-gray-500">80mm para impresoras térmicas de mostrador o 58mm para portátiles.</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, ancho_papel: '80mm' })}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${config.ancho_papel === '80mm' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  80 mm
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, ancho_papel: '58mm' })}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${config.ancho_papel === '58mm' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  58 mm
                </button>
              </div>
            </div>

            {/* Cuadrícula de Toggles de Campos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {[
                { key: 'mostrar_sucursal', label: 'Mostrar Nombre de Sucursal' },
                { key: 'mostrar_cajero', label: 'Mostrar Nombre del Cajero' },
                { key: 'mostrar_mecanico', label: 'Mostrar Mecánico Asignado' },
                { key: 'mostrar_codigo_producto', label: 'Mostrar Código/SKU de Artículos' },
                { key: 'mostrar_descuentos', label: 'Mostrar Desglose de Descuentos' },
                { key: 'mostrar_regalias', label: 'Mostrar Regalías u Observaciones' },
                { key: 'mostrar_metodo_pago', label: 'Mostrar Método de Pago (Efectivo/Tarjeta...)' },
                { key: 'mostrar_cliente_cedula', label: 'Mostrar Cédula/RUC del Cliente' }
              ].map(item => (
                <label 
                  key={item.key}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer text-xs font-medium text-gray-700 select-none transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={!!config[item.key]}
                    onChange={e => setConfig({ ...config, [item.key]: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* SECCIÓN 3: PIE DE TICKET Y POLÍTICAS DE GARANTÍA */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-gray-800 border-b pb-2.5 flex items-center gap-2">
              <ShieldCheck size={16} className="text-purple-600" />
              3. Mensaje de Despedida y Términos de Garantía
            </h3>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Mensaje de Agradecimiento
              </label>
              <input
                type="text"
                value={config.mensaje_agradecimiento}
                onChange={e => setConfig({ ...config, mensaje_agradecimiento: e.target.value })}
                className="w-full border p-2.5 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Políticas de Garantía y Devolución
              </label>
              <textarea
                rows={2}
                value={config.terminos_garantia}
                onChange={e => setConfig({ ...config, terminos_garantia: e.target.value })}
                className="w-full border p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Texto legal o términos que respaldan la compra del cliente.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Pie de Página Final
              </label>
              <input
                type="text"
                value={config.mensaje_despedida}
                onChange={e => setConfig({ ...config, mensaje_despedida: e.target.value })}
                className="w-full border p-2.5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
              />
            </div>
          </div>

        </div>

        {/* LADO DERECHO: VISTA PREVIA EN VIVO (SIMULADOR DE TICKET TÉRMICO) */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="bg-gray-800 p-3 sm:p-4 rounded-2xl shadow-xl space-y-3">
            
            <div className="flex items-center justify-between text-white border-b border-gray-700 pb-2">
              <span className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 text-blue-300">
                <Eye size={16} /> Vista Previa en Vivo ({config.ancho_papel})
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono font-bold">
                Papel Térmico
              </span>
            </div>

            {/* SIMULADOR DE TICKET TÉRMICO */}
            <div className="overflow-x-auto flex justify-center py-2">
              <div 
                ref={previewRef}
                style={{ width: is58mm ? '58mm' : '80mm', minWidth: is58mm ? '58mm' : '80mm' }}
                className="bg-white text-black p-4 font-mono text-[11px] shadow-2xl rounded-sm border border-gray-300 space-y-2 select-none"
              >
                {/* CABECERA */}
                <div className="text-center pb-2 border-b border-black border-dashed">
                  <h2 className="font-black text-sm uppercase tracking-tight">
                    {config.nombre_comercial || 'TALLER EL MINGO'}
                  </h2>
                  {config.eslogan && (
                    <p className="text-[10px] font-bold">{config.eslogan}</p>
                  )}
                  {config.ruc && (
                    <p className="text-[9px]">RUC: {config.ruc}</p>
                  )}
                  {config.telefono && (
                    <p className="text-[9px]">Tel: {config.telefono}</p>
                  )}
                  {config.direccion && (
                    <p className="text-[9px]">{config.direccion}</p>
                  )}
                  {config.mostrar_sucursal && (
                    <p className="text-[9px] font-bold mt-1">Sucursal: Principal (SUC-01)</p>
                  )}
                </div>

                {/* METADATOS FACTURA */}
                <div className="py-1.5 border-b border-black border-dashed text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span><strong>FACTURA:</strong></span>
                    <span className="font-bold font-mono">FAC-0001</span>
                  </div>
                  <div className="flex justify-between">
                    <span>FECHA:</span>
                    <span>{new Date().toLocaleDateString('es-NI')} {new Date().toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CLIENTE:</span>
                    <span className="font-bold truncate max-w-[130px]">Juan Carlos Mendoza</span>
                  </div>
                  {config.mostrar_cliente_cedula && (
                    <div className="flex justify-between">
                      <span>CÉDULA/RUC:</span>
                      <span className="font-mono">001-120590-0023K</span>
                    </div>
                  )}
                  {config.mostrar_cajero && (
                    <div className="flex justify-between text-gray-700">
                      <span>CAJERO:</span>
                      <span>María Cajera</span>
                    </div>
                  )}
                  {config.mostrar_mecanico && (
                    <div className="flex justify-between text-gray-700">
                      <span>MECÁNICO:</span>
                      <span>Pedro Mecánico</span>
                    </div>
                  )}
                  {config.mostrar_metodo_pago && (
                    <div className="flex justify-between">
                      <span>PAGO:</span>
                      <span className="font-bold">Efectivo</span>
                    </div>
                  )}
                  {config.mostrar_regalias && (
                    <div className="flex justify-between font-bold border-t border-black border-dotted pt-0.5 mt-0.5">
                      <span>REGALÍA:</span>
                      <span className="truncate max-w-[130px]">Revisión de frenos gratis</span>
                    </div>
                  )}
                </div>

                {/* DETALLE ARTÍCULOS DE EJEMPLO */}
                <table className="w-full text-[10px] my-1">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="text-left py-0.5 w-5">Cant</th>
                      <th className="text-left py-0.5">Descripción</th>
                      <th className="text-right py-0.5">P.U.</th>
                      <th className="text-right py-0.5">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 divide-dashed">
                    <tr>
                      <td className="py-1 align-top">2</td>
                      <td className="py-1 align-top pr-1">
                        <div>Aceite 20W50 4T Castrol</div>
                        {config.mostrar_codigo_producto && (
                          <div className="text-[8px] text-gray-500 font-mono">SKU: PROD-0042</div>
                        )}
                        {config.mostrar_descuentos && (
                          <div className="text-[8px] text-red-600 font-bold">Desc: -C$ 30.00</div>
                        )}
                      </td>
                      <td className="py-1 align-top text-right">C$250</td>
                      <td className="py-1 align-top text-right font-bold">C$470.00</td>
                    </tr>
                    <tr>
                      <td className="py-1 align-top">1</td>
                      <td className="py-1 align-top pr-1">
                        <div>Cambio de Aceite y Filtro</div>
                        {config.mostrar_codigo_producto && (
                          <div className="text-[8px] text-gray-500 font-mono">SKU: SRV-0010</div>
                        )}
                      </td>
                      <td className="py-1 align-top text-right">C$150</td>
                      <td className="py-1 align-top text-right font-bold">C$150.00</td>
                    </tr>
                  </tbody>
                </table>

                {/* TOTALES */}
                <div className="border-t border-black border-dashed pt-1.5 space-y-0.5 text-[10px]">
                  {config.mostrar_descuentos && (
                    <>
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>C$ 650.00</span>
                      </div>
                      <div className="flex justify-between text-red-700 font-bold">
                        <span>Descuento Otorgado:</span>
                        <span>-C$ 30.00</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-xs font-black border-t border-black pt-1">
                    <span>TOTAL A PAGAR:</span>
                    <span>C$ 620.00</span>
                  </div>
                </div>

                {/* PIE Y GARANTÍA */}
                <div className="text-center text-[9px] mt-3 pt-2 border-t border-black border-dashed space-y-1">
                  {config.mensaje_agradecimiento && (
                    <p className="font-bold text-[10px]">{config.mensaje_agradecimiento}</p>
                  )}
                  {config.terminos_garantia && (
                    <p className="text-[8px] leading-tight text-gray-700 italic">
                      {config.terminos_garantia}
                    </p>
                  )}
                  {config.mensaje_despedida && (
                    <p className="opacity-60 text-[8px] pt-0.5">{config.mensaje_despedida}</p>
                  )}
                </div>

              </div>
            </div>

            <p className="text-[10px] text-gray-400 text-center">
              Los cambios se reflejan en vivo en el simulador y se aplican a todas las ventas de mostrador al guardar.
            </p>

          </div>
        </div>

      </div>

    </div>
  );
}
