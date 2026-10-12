import React, { forwardRef, useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import { DEFAULT_PRINT_CONFIG } from './catalogos/PrintFormatEditor';

const TicketPrinter = forwardRef(({ sale, isPreview = false, customConfig = null }, ref) => {
  const [dbConfig, setDbConfig] = useState(DEFAULT_PRINT_CONFIG);

  useEffect(() => {
    if (customConfig) return;
    const configRef = ref(rtdb, 'configuracion/formatos_impresion');
    const unsub = onValue(configRef, (snap) => {
      if (snap.exists()) {
        setDbConfig({ ...DEFAULT_PRINT_CONFIG, ...snap.val() });
      } else {
        setDbConfig(DEFAULT_PRINT_CONFIG);
      }
    });
    return () => unsub();
  }, [customConfig]);

  if (!sale) return null;

  const cfg = customConfig || dbConfig;
  const is58mm = cfg.ancho_papel === '58mm';
  const printWidth = is58mm ? '58mm' : '80mm';

  const subtotalBruto = sale.items?.reduce((sum, item) => sum + (item.precio_unitario * (item.cantidad || 1)), 0) || sale.total;
  const totalDescuentos = sale.items?.reduce((sum, item) => sum + (item.descuento || 0), 0) || (sale.descuento_total || 0);

  const containerClasses = isPreview 
    ? `p-3 bg-white text-gray-900 font-mono text-[11px] leading-tight border border-gray-200 rounded-lg shadow-inner ${is58mm ? 'max-w-[270px]' : 'max-w-[340px]'} mx-auto select-none`
    : `p-3 bg-white text-black font-mono text-[11px] leading-tight w-[${printWidth}] min-h-[90mm] mx-auto`;

  return (
    <div ref={ref} className={containerClasses} style={{ width: isPreview ? '100%' : printWidth }}>
      {/* CABECERA COMERCIAL */}
      <div className="text-center pb-2 border-b border-black border-dashed space-y-0.5">
        <h2 className="font-black text-sm uppercase tracking-tight">{cfg.nombre_comercial || 'TALLER EL MINGO'}</h2>
        {cfg.eslogan && <p className="text-[10px] font-bold">{cfg.eslogan}</p>}
        {cfg.ruc && <p className="text-[9px]">RUC: {cfg.ruc}</p>}
        {cfg.telefono && <p className="text-[9px]">Tel: {cfg.telefono}</p>}
        {cfg.direccion && <p className="text-[9px]">{cfg.direccion}</p>}
        
        {cfg.mostrar_sucursal && (
          <p className="text-[10px] font-semibold pt-0.5">
            Sucursal: {sale.sucursal_nombre || (sale.sucursal === 'SUC-01' ? 'Principal (SUC-01)' : sale.sucursal === 'SUC-02' ? 'Norte (SUC-02)' : (sale.sucursal || 'Principal'))}
          </p>
        )}
        {sale.multisucursal_id && (
          <p className="text-[9px] font-bold text-gray-800">★ Venta Multisucursal: {sale.multisucursal_id}</p>
        )}
      </div>

      {/* METADATOS FACTURA */}
      <div className="py-2 border-b border-black border-dashed text-[10px] space-y-0.5">
        <div className="flex justify-between">
          <span><strong>FACTURA:</strong></span>
          <span className="font-bold">{sale.numero_factura || sale.id?.substring(0, 8)}</span>
        </div>
        <div className="flex justify-between">
          <span>FECHA:</span>
          <span>{sale.fecha ? new Date(sale.fecha).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : new Date().toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>CLIENTE:</span>
          <span className="font-bold truncate max-w-[170px]">{sale.nombre_cliente || 'CLIENTE DE MOSTRADOR'}</span>
        </div>
        {cfg.mostrar_cliente_cedula && sale.cliente_cedula && (
          <div className="flex justify-between">
            <span>CÉDULA:</span>
            <span>{sale.cliente_cedula}</span>
          </div>
        )}
        {cfg.mostrar_cajero && (sale.cajero || sale.usuario) && (
          <div className="flex justify-between">
            <span>CAJERO:</span>
            <span className="truncate max-w-[170px]">{sale.cajero || sale.usuario}</span>
          </div>
        )}
        {cfg.mostrar_mecanico && sale.nombre_mecanico && (
          <div className="flex justify-between text-purple-900 font-semibold">
            <span>MECÁNICO:</span>
            <span className="font-bold truncate max-w-[170px]">{sale.nombre_mecanico}</span>
          </div>
        )}
        {cfg.mostrar_metodo_pago && (
          <div className="flex justify-between">
            <span>PAGO:</span>
            <span className="font-bold">{sale.metodo_pago || 'Efectivo'}</span>
          </div>
        )}
        {cfg.mostrar_regalias && sale.regalia && (
          <div className="flex justify-between text-purple-950 font-bold border-t border-black border-dotted pt-1 mt-1">
            <span>REGALÍA:</span>
            <span className="truncate max-w-[170px] text-right">{sale.regalia}</span>
          </div>
        )}
      </div>

      {/* DETALLE ITEMS */}
      <table className="w-full text-[10px] my-2">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-0.5 w-6">Cant</th>
            <th className="text-left py-0.5">Descripción</th>
            <th className="text-right py-0.5">P.U.</th>
            <th className="text-right py-0.5">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 divide-dashed">
          {sale.items?.map((item, index) => {
            const hasDesc = cfg.mostrar_descuentos && (item.descuento || 0) > 0;
            const itemCode = item.codigo_visible || item.sku || item.codigo || (item.type !== 'servicio' ? item.id_producto : null);
            return (
              <tr key={index} className="py-1">
                <td className="py-1 align-top">{item.cantidad}</td>
                <td className="py-1 align-top pr-1">
                  <div>
                    {cfg.mostrar_codigo_producto && itemCode && (
                      <span className="font-bold text-[9px] text-gray-700 block">[{itemCode}]</span>
                    )}
                    {item.nombre || item.name || item.id_producto}
                  </div>
                  {hasDesc && (
                    <div className="text-[9px] text-red-600 font-bold">
                      Desc: -C$ {Number(item.descuento).toFixed(2)}
                    </div>
                  )}
                </td>
                <td className="py-1 align-top text-right whitespace-nowrap">
                  C${Number(item.precio_unitario || item.price).toFixed(0)}
                </td>
                <td className="py-1 align-top text-right font-bold whitespace-nowrap">
                  C${Number(item.subtotal).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* TOTALES */}
      <div className="border-t border-black border-dashed pt-1.5 space-y-1 text-[10px]">
        {cfg.mostrar_descuentos && totalDescuentos > 0 && (
          <>
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>C$ {subtotalBruto.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-red-700 font-bold">
              <span>Descuento:</span>
              <span>-C$ {totalDescuentos.toFixed(2)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between text-xs font-black border-t border-black pt-1">
          <span>TOTAL A PAGAR:</span>
          <span>C$ {Number(sale.total).toFixed(2)}</span>
        </div>
      </div>

      {/* PIE DE TICKET */}
      <div className="text-center text-[9px] mt-3 pt-2 border-t border-black border-dashed space-y-1">
        {cfg.mensaje_agradecimiento && (
          <p className="font-bold">{cfg.mensaje_agradecimiento}</p>
        )}
        {cfg.terminos_garantia && (
          <p className="text-[8px] leading-tight text-gray-800">{cfg.terminos_garantia}</p>
        )}
        {cfg.mensaje_despedida && (
          <p className="opacity-60 text-[8px] pt-0.5">{cfg.mensaje_despedida}</p>
        )}
      </div>
    </div>
  );
});

export default TicketPrinter;
