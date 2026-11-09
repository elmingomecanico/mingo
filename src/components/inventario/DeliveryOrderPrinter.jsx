import React from 'react';
import { Printer, X, CheckCircle2, Package, ShieldCheck, MapPin, Phone, Building2 } from 'lucide-react';
import logoIcon from '../../assets/logo-icon.jpg';

export default function DeliveryOrderPrinter({ isOpen, onClose, record, despacho }) {
  if (!isOpen || !record || !despacho) return null;

  const handlePrint = () => {
    window.print();
  };

  const fechaFormateada = new Date(despacho.fecha || Date.now()).toLocaleString('es-NI', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Botones de acción flotantes (OCULTOS AL IMPRIMIR) */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 print:hidden">
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
        >
          <Printer size={15} /> Imprimir Comprobante
        </button>
        <button
          onClick={onClose}
          className="bg-slate-900/80 hover:bg-slate-900 text-white p-2.5 rounded-xl shadow-lg transition-all cursor-pointer"
          title="Cerrar vista previa"
        >
          <X size={16} />
        </button>
      </div>

      {/* CONTENEDOR IMPRIMIBLE (SOLO ESTO SE MUESTRA AL IMPRIMIR) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 overflow-hidden print:border-none print:shadow-none print:p-2 print:max-w-none print:w-full">
        {/* ENCABEZADO OFICIAL */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <img
              src={logoIcon}
              alt="Taller El Mingo"
              className="w-14 h-14 rounded-full border-2 border-blue-900 object-cover"
            />
            <div>
              <h1 className="text-xl font-black text-slate-950 uppercase tracking-tight leading-none">
                Taller El Mingo
              </h1>
              <p className="text-xs text-slate-600 font-bold mt-0.5">
                Repuestos, Mantenimiento & Mecánica Especializada
              </p>
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500 mt-1">
                <span className="flex items-center gap-1">
                  <MapPin size={11} className="text-blue-600" /> Sucursal: {record.sucursal || 'Principal'}
                </span>
                <span className="flex items-center gap-1">
                  <Phone size={11} className="text-emerald-600" /> Tel: +505 8294 3669
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="inline-block bg-blue-950 text-white text-[11px] font-black px-3 py-1 rounded-lg uppercase tracking-wider mb-1">
              Comprobante de Entrega
            </div>
            <p className="font-mono text-sm font-black text-blue-950 block">
              N° {despacho.id_despacho}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              Ref. Expediente: {record.codigo_visible}
            </p>
          </div>
        </div>

        {/* METADATOS DE CLIENTE Y ENTREGA */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-4 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Cliente / Titular</span>
            <span className="font-black text-slate-900 block truncate">{record.cliente_nombre}</span>
            {record.cliente_telefono && (
              <span className="text-[11px] text-slate-500 font-mono">{record.cliente_telefono}</span>
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Persona que Retira</span>
            <span className="font-black text-slate-900 block truncate">{despacho.recibido_por}</span>
            {despacho.cedula_recibe && (
              <span className="text-[11px] text-slate-500 font-mono">Cédula: {despacho.cedula_recibe}</span>
            )}
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Fecha y Hora de Entrega</span>
            <span className="font-bold text-slate-800">{fechaFormateada}</span>
            <span className="text-[10px] text-slate-500 block truncate">Despachó: {despacho.despachado_por}</span>
          </div>

          {record.id_venta_origen && (
            <div className="sm:col-span-3 pt-1 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-bold">
                Documento de Venta / Factura de Origen: <strong className="text-blue-900">{record.id_venta_origen}</strong>
              </span>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 size={12} /> Mercancía Previamente Facturada y Liquidada
              </span>
            </div>
          )}
        </div>

        {/* TABLA DE PRODUCTOS ENTREGADOS EN ESTE ACTO */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden mb-4">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">N°</th>
                <th className="py-2.5 px-3">Código / SKU</th>
                <th className="py-2.5 px-3">Descripción del Repuesto</th>
                <th className="py-2.5 px-3 text-center">Entregado Hoy</th>
                <th className="py-2.5 px-3 text-right">Saldo Pendiente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {(despacho.items_despachados || []).map((it, idx) => (
                <tr key={it.id_producto || idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{it.codigo_visible || it.id_producto}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{it.nombre}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded-md">
                      {it.cantidad_despachada} uds
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold">
                    {it.saldo_pendiente > 0 ? (
                      <span className="text-amber-700">{it.saldo_pendiente} uds por retirar</span>
                    ) : (
                      <span className="text-emerald-600 font-black">0 (Completado)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* OBSERVACIONES */}
        {despacho.observaciones && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6 text-xs text-slate-700">
            <span className="font-bold block text-[10px] uppercase text-slate-400 mb-0.5">Observaciones de Entrega:</span>
            <p className="italic">{despacho.observaciones}</p>
          </div>
        )}

        {/* FIRMAS DE CONFORMIDAD */}
        <div className="grid grid-cols-2 gap-8 pt-8 mt-4 border-t border-slate-300 text-center text-xs">
          <div>
            <div className="h-14 flex items-end justify-center">
              <span className="font-bold text-slate-800">{despacho.despachado_por}</span>
            </div>
            <div className="border-t border-slate-800 pt-1">
              <p className="font-black text-slate-900 uppercase text-[11px]">Entregado / Despachado por</p>
              <p className="text-[10px] text-slate-500">Bodega / Taller El Mingo</p>
            </div>
          </div>

          <div>
            <div className="h-14 flex items-end justify-center">
              <span className="font-bold text-slate-800">{despacho.recibido_por}</span>
            </div>
            <div className="border-t border-slate-800 pt-1">
              <p className="font-black text-slate-900 uppercase text-[11px]">Recibido Conforme (Cliente)</p>
              <p className="text-[10px] text-slate-500">
                Firma y Cédula: {despacho.cedula_recibe || '________________________'}
              </p>
            </div>
          </div>
        </div>

        {/* PIE DE PÁGINA IMPRESIÓN */}
        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-mono">
          <span>Taller El Mingo ERP • Control de Mercancía en Custodia y Entrega</span>
          <span>Impreso el {new Date().toLocaleString('es-NI')}</span>
        </div>
      </div>
    </div>
  );
}
