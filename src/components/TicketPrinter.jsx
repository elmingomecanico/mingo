import React, { forwardRef } from 'react';

const TicketPrinter = forwardRef(({ sale, isPreview = false }, ref) => {
  if (!sale) return null;

  const subtotalBruto = sale.items?.reduce((sum, item) => sum + (item.precio_unitario * (item.cantidad || 1)), 0) || sale.total;
  const totalDescuentos = sale.items?.reduce((sum, item) => sum + (item.descuento || 0), 0) || (sale.descuento_total || 0);

  const containerClasses = isPreview 
    ? "p-4 bg-white text-gray-900 font-mono text-xs border border-gray-200 rounded-lg shadow-inner max-w-[340px] mx-auto select-none"
    : "p-4 bg-white text-black font-mono text-xs w-[80mm] min-h-[100mm] mx-auto";

  return (
    <div ref={ref} className={containerClasses} style={{ width: isPreview ? '100%' : '80mm' }}>
      {/* CABECERA COMERCIAL */}
      <div className="text-center pb-2 border-b border-black border-dashed">
        <h2 className="font-black text-base uppercase tracking-tight">TALLER EL MINGO</h2>
        <p className="text-[11px] font-bold">Servicios Mecánicos y Repuestos</p>
        <p className="text-[10px]">RUC: J0310000284751</p>
        <p className="text-[10px]">Teléfono: +505 8888-8888 / 7777-7777</p>
        <p className="text-[10px]">Sucursal: {sale.sucursal || 'Principal (SUC-01)'}</p>
      </div>

      {/* METADATOS FACTURA */}
      <div className="py-2 border-b border-black border-dashed text-[11px] space-y-0.5">
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
        {sale.nombre_mecanico && (
          <div className="flex justify-between text-purple-900">
            <span>MECÁNICO:</span>
            <span className="font-bold truncate max-w-[170px]">{sale.nombre_mecanico}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>PAGO:</span>
          <span className="font-bold">{sale.metodo_pago || 'Efectivo'}</span>
        </div>
      </div>

      {/* DETALLE ITEMS */}
      <table className="w-full text-[11px] my-2">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1 w-6">Cant</th>
            <th className="text-left py-1">Descripción</th>
            <th className="text-right py-1">P.U.</th>
            <th className="text-right py-1">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 divide-dashed">
          {sale.items?.map((item, index) => {
            const hasDesc = (item.descuento || 0) > 0;
            return (
              <tr key={index} className="py-1">
                <td className="py-1 align-top">{item.cantidad}</td>
                <td className="py-1 align-top pr-1">
                  <div>{item.nombre || item.name || item.id_producto}</div>
                  {hasDesc && (
                    <div className="text-[9px] text-red-600 font-bold">
                      Desc: -C$ {Number(item.descuento).toFixed(2)}
                    </div>
                  )}
                </td>
                <td className="py-1 align-top text-right">
                  C${Number(item.precio_unitario || item.price).toFixed(0)}
                </td>
                <td className="py-1 align-top text-right font-bold">
                  C${Number(item.subtotal).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* TOTALES */}
      <div className="border-t border-black border-dashed pt-2 space-y-1 text-[11px]">
        {totalDescuentos > 0 && (
          <>
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>C$ {subtotalBruto.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-red-700 font-bold">
              <span>Descuento Aplicado:</span>
              <span>-C$ {totalDescuentos.toFixed(2)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between text-sm font-black border-t border-black pt-1">
          <span>TOTAL A PAGAR:</span>
          <span>C$ {Number(sale.total).toFixed(2)}</span>
        </div>
      </div>

      {/* PIE DE TICKET */}
      <div className="text-center text-[10px] mt-4 pt-2 border-t border-black border-dashed space-y-0.5">
        <p className="font-bold">¡GRACIAS POR SU PREFERENCIA!</p>
        <p>Garantía de repuestos con su factura</p>
        <p className="opacity-60 text-[9px] pt-1">Impreso por Sistema Taller El Mingo</p>
      </div>
    </div>
  );
});

export default TicketPrinter;
