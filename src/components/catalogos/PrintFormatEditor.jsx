import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { rtdb } from '../../firebase';
import { 
  Printer, Save, RotateCcw, Check, Eye, FileText, 
  Settings, CheckSquare, Square, Building2, Phone, 
  MapPin, Hash, Sparkles, ShieldCheck, LayoutGrid,
  Columns, AlignLeft, AlignCenter, Split, CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import TicketPrinter from '../TicketPrinter';

export const DEFAULT_PRINT_CONFIG = {
  nombre_comercial: 'TALLER EL MINGO',
  eslogan: 'Servicios Mecánicos y Repuestos',
  ruc: 'J0310000284751',
  telefono: '+505 8888-8888 / 7777-7777',
  direccion: 'Managua, Nicaragua',
  ancho_papel: '80mm', // '80mm' | '58mm'
  tamano_letra: 'normal', // 'compacta' | 'normal' | 'grande'
  
  // Opciones de Ubicación y Diseño de Artículos / Precios
  estilo_items: 'dos_lineas', // 'dos_lineas' | 'columnas_separadas' | 'compacto'
  separacion_precios: 'amplia', // 'amplia' | 'barra' | 'estandar'
  posicion_sku: 'arriba', // 'arriba' | 'junto' | 'abajo' | 'oculto'
  alineacion_cabecera: 'centro', // 'centro' | 'izquierda'
  estilo_divisor: 'guiones', // 'guiones' | 'puntos' | 'solido' | 'doble'
  mostrar_espacio_moneda: true, // "C$ 1,429.00"
  decimales_pu: true, // 2 decimales en P.U.
  
  // Toggles de Metadatos
  mostrar_sucursal: true,
  mostrar_cajero: true,
  mostrar_mecanico: true,
  mostrar_cliente_cedula: false,
  mostrar_codigo_producto: true,
  mostrar_descuentos: true,
  mostrar_regalias: true,
  mostrar_metodo_pago: true,
  mostrar_total_letras: false,
  
  // Mensajes de Pie
  mensaje_agradecimiento: '¡GRACIAS POR SU PREFERENCIA!',
  terminos_garantia: 'Garantía de repuestos de 30 días con su factura. No se aceptan cambios en partes eléctricas.',
  mensaje_despedida: 'Impreso por Sistema Taller El Mingo'
};

const demoSale = {
  id: 'DEMO-0001',
  numero_factura: 'M-0001',
  fecha: new Date().toISOString(),
  sucursal: 'SUC-01',
  sucursal_nombre: 'Repuestos El Mingo',
  nombre_cliente: 'Santos Rayo',
  cliente_cedula: '001-120590-0023K',
  cajero: 'Administrador del Sistema',
  nombre_mecanico: 'Reynaldo Taleno',
  metodo_pago: 'Crédito',
  regalia: 'Cambio de aceite gratis',
  multisucursal_id: 'MS-MVALNTR1',
  items: [
    {
      id_producto: 'PROD-0001',
      codigo_visible: 'PROD-0001',
      nombre: 'Llanta Delantera Doble propósito 2/75/18 Super Run',
      cantidad: 1,
      precio_unitario: 1429.00,
      descuento: 0,
      subtotal: 1429.00
    },
    {
      id_producto: 'PROD-0042',
      codigo_visible: 'PROD-0042',
      nombre: 'Aceite 20W50 4T Castrol Actevo',
      cantidad: 2,
      precio_unitario: 250.00,
      descuento: 30.00,
      subtotal: 470.00
    }
  ],
  descuento_total: 30.00,
  total: 1899.00
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

  const handlePrintTest = useReactToPrint({
    contentRef: previewRef,
    documentTitle: `Prueba_Ticket_${config.ancho_papel || '80mm'}`,
    pageStyle: `@page { size: ${config.ancho_papel === '58mm' ? '58mm' : '80mm'} auto; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; } .no-print, button { display: none !important; } }`
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ENCABEZADO (No se imprime) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm no-print print:hidden">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Printer className="text-blue-600" size={24} />
            Editor de Formatos Imprimibles (Tickets y Facturas)
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Personaliza el encabezado, la separación de precios (P.U. vs Total), estilos de línea y qué campos mostrar u ocultar.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Restablecer valores originales"
          >
            <RotateCcw size={15} /> Restablecer
          </button>

          <button
            type="button"
            onClick={() => handlePrintTest()}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
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
        <div className="lg:col-span-7 space-y-5 no-print print:hidden">

          {/* SECCIÓN 1: DISEÑO Y UBICACIÓN DE ARTÍCULOS Y PRECIOS (P.U. VS TOTAL) */}
          <div className="bg-white p-5 rounded-2xl border-2 border-blue-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Columns size={18} className="text-blue-600" />
                1. Ubicación y Separación de Artículos y Precios (P.U. vs Total)
              </h3>
              <span className="text-[10px] font-black uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                Visualización
              </span>
            </div>

            {/* Selector de Estilo de Artículos */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase">
                Estilo de Presentación de los Artículos en el Ticket
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Opción 1: Dos Líneas */}
                <div
                  onClick={() => setConfig({ ...config, estilo_items: 'dos_lineas' })}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all select-none flex flex-col justify-between ${
                    config.estilo_items === 'dos_lineas'
                      ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-gray-900">En 2 Líneas</span>
                      {config.estilo_items === 'dos_lineas' && (
                        <CheckCircle2 size={16} className="text-blue-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      Nombre arriba a lo ancho. Cant × P.U. a la izquierda y Total a la derecha.
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 mt-2 bg-emerald-50 px-1.5 py-0.5 rounded inline-block w-fit">
                    ★ Recomendado
                  </span>
                </div>

                {/* Opción 2: Columnas Separadas */}
                <div
                  onClick={() => setConfig({ ...config, estilo_items: 'columnas_separadas' })}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all select-none flex flex-col justify-between ${
                    config.estilo_items === 'columnas_separadas'
                      ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-gray-900">Tabla en Columnas</span>
                      {config.estilo_items === 'columnas_separadas' && (
                        <CheckCircle2 size={16} className="text-blue-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      Tabla clásica: Cant | Descripción | P.U. | Total con espaciado amplio.
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-gray-600 mt-2 bg-gray-100 px-1.5 py-0.5 rounded inline-block w-fit">
                    Tradicional
                  </span>
                </div>

                {/* Opción 3: Compacto */}
                <div
                  onClick={() => setConfig({ ...config, estilo_items: 'compacto' })}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all select-none flex flex-col justify-between ${
                    config.estilo_items === 'compacto'
                      ? 'border-blue-600 bg-blue-50/60 shadow-xs'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-gray-900">Modo Compacto</span>
                      {config.estilo_items === 'compacto' && (
                        <CheckCircle2 size={16} className="text-blue-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-snug">
                      1 línea por producto con P.U. integrado como subtexto discreto.
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-purple-700 mt-2 bg-purple-50 px-1.5 py-0.5 rounded inline-block w-fit">
                    Ahorro Papel
                  </span>
                </div>
              </div>
            </div>

            {/* Separación de Precios y Divisor (Especial para modo tabla o 2 líneas) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Separador entre P.U. y Total (Modo Tabla)
                </label>
                <select
                  value={config.separacion_precios || 'amplia'}
                  onChange={e => setConfig({ ...config, separacion_precios: e.target.value })}
                  className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="amplia">Espacio Amplio (Sin pegarse)</option>
                  <option value="barra">Barra Vertical Separadora (│)</option>
                  <option value="estandar">Espaciado Estándar</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Ubicación del Código / SKU del Producto
                </label>
                <select
                  value={config.posicion_sku || 'arriba'}
                  onChange={e => setConfig({ ...config, posicion_sku: e.target.value })}
                  className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="arriba">Arriba del Nombre [PROD-0001]</option>
                  <option value="junto">Junto al Nombre ([PROD-0001] Llanta...)</option>
                  <option value="abajo">Abajo en letra pequeña (SKU: ...)</option>
                </select>
              </div>
            </div>

            {/* Opciones de Formato Numérico */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-gray-100">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={config.mostrar_espacio_moneda !== false}
                  onChange={e => setConfig({ ...config, mostrar_espacio_moneda: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Separar símbolo con espacio (ej: <strong>C$ 1,429.00</strong>)</span>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={config.decimales_pu !== false}
                  onChange={e => setConfig({ ...config, decimales_pu: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Mostrar 2 decimales en P.U. (ej: <strong>C$ 1,429.00</strong>)</span>
              </label>
            </div>
          </div>

          {/* SECCIÓN 2: CABECERA COMERCIAL DE LA EMPRESA */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-gray-800 border-b pb-2.5 flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              2. Cabecera Comercial de la Empresa
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

          {/* SECCIÓN 3: FORMATO DEL PAPEL, LÍNEAS Y CABECERA */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-gray-800 border-b pb-2.5 flex items-center gap-2">
              <Settings size={16} className="text-emerald-600" />
              3. Dimensiones de Papel, Estilo de Líneas y Alineación
            </h3>

            {/* Selector de Ancho de Papel */}
            <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Ancho del Papel de la Impresora</span>
                <span className="text-[11px] text-gray-500">80mm para impresoras de mostrador o 58mm para portátiles.</span>
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

            {/* Estilo de Líneas y Alineación */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Líneas Divisoras
                </label>
                <select
                  value={config.estilo_divisor || 'guiones'}
                  onChange={e => setConfig({ ...config, estilo_divisor: e.target.value })}
                  className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="guiones">Guiones ( - - - - )</option>
                  <option value="puntos">Puntos ( · · · · )</option>
                  <option value="solido">Línea Sólida ( ──── )</option>
                  <option value="doble">Línea Doble ( ════ )</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Alineación Cabecera
                </label>
                <select
                  value={config.alineacion_cabecera || 'centro'}
                  onChange={e => setConfig({ ...config, alineacion_cabecera: e.target.value })}
                  className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="centro">Centrada</option>
                  <option value="izquierda">Alineada a la Izquierda</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Tamaño de Fuente
                </label>
                <select
                  value={config.tamano_letra || 'normal'}
                  onChange={e => setConfig({ ...config, tamano_letra: e.target.value })}
                  className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="compacta">Compacta (Ahorro)</option>
                  <option value="normal">Normal (Estándar)</option>
                  <option value="grande">Grande (Legible)</option>
                </select>
              </div>
            </div>

            {/* Cuadrícula de Toggles de Campos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-gray-100">
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

          {/* SECCIÓN 4: PIE DE TICKET Y POLÍTICAS DE GARANTÍA */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-gray-800 border-b pb-2.5 flex items-center gap-2">
              <ShieldCheck size={16} className="text-purple-600" />
              4. Mensaje de Despedida y Términos de Garantía
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
          <div className="bg-gray-900 p-3 sm:p-4 rounded-2xl shadow-xl space-y-3 print:bg-white print:p-0 print:shadow-none">
            
            <div className="flex items-center justify-between text-white border-b border-gray-800 pb-2 no-print print:hidden">
              <span className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 text-blue-300">
                <Eye size={16} /> Vista Previa en Vivo ({config.ancho_papel})
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono font-bold">
                Papel Térmico
              </span>
            </div>

            {/* SIMULADOR EXACTO EN VIVO USANDO TICKETPRINTER */}
            <div className="overflow-x-auto flex justify-center py-2 bg-gray-950/50 rounded-xl p-2 print:bg-white print:p-0">
              <TicketPrinter
                ref={previewRef}
                sale={demoSale}
                isPreview={true}
                customConfig={config}
              />
            </div>

            <p className="text-[10px] text-gray-400 text-center no-print print:hidden">
              Cualquier cambio de estilo, separación o texto se refleja de inmediato en el simulador. Al hacer clic en <strong>"Guardar Formato"</strong> se aplicará a todas las impresiones físicas de la empresa.
            </p>

          </div>
        </div>

      </div>

    </div>
  );
}

