import React, { forwardRef } from 'react';

const TicketPrinter = forwardRef(({ sale }, ref) => {
  if (!sale) return null;

  return (
    <div className="hidden">
      <div ref={ref} className="p-4 bg-white text-black text-sm font-mono" style={{ width: '80mm', minHeight: '100mm' }}>
        <div className="text-center mb-4 border-b border-black pb-2">
          <h2 className="font-bold text-xl uppercase">Taller El Mingo</h2>
          <p className="text-xs">Servicios Mecánicos y Repuestos</p>
          <p className="text-xs">RUC: J0310000XXXXXX</p>
          <p className="text-xs mt-1">Tel: +505 8888-8888</p>
        </div>

        <div className="mb-4 text-xs">
          <p><strong>Factura:</strong> {sale.numero_factura || sale.id.substring(sale.id.length - 6).toUpperCase()}</p>
          <p><strong>Fecha:</strong> {new Date(sale.fecha).toLocaleString()}</p>
          <p><strong>Sucursal:</strong> {sale.sucursal}</p>
        </div>

        <table className="w-full text-xs mb-4">
          <thead className="border-y border-black">
            <tr>
              <th className="text-left py-1 w-8">Cant</th>
              <th className="text-left py-1">Descripción</th>
              <th className="text-right py-1">SubT</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => (
              <tr key={index} className="border-b border-gray-200 border-dashed">
                <td className="py-1">{item.cantidad}</td>
                <td className="py-1 pr-1">{item.name || item.id_producto}</td>
                <td className="text-right py-1">C${item.subtotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-right font-bold text-lg mb-6 border-t border-black pt-2">
          Total: C${sale.total.toFixed(2)}
        </div>

        <div className="text-center text-xs mt-8">
          <p>¡Gracias por su preferencia!</p>
          <p>Taller El Mingo - Calidad Garantizada</p>
          <p className="mt-2 opacity-50 text-[10px]">Sistema desarrollado por Akasia Nube</p>
        </div>
      </div>
    </div>
  );
});

export default TicketPrinter;
