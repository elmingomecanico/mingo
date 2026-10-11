import React, { forwardRef } from 'react';

const CashTicketPrinter = forwardRef(({ data, type = 'cierre', isPreview = false }, ref) => {
  if (!data) return null;

  const containerClasses = isPreview 
    ? "p-4 bg-white text-gray-900 font-mono text-xs border border-gray-200 rounded-lg shadow-inner max-w-[340px] mx-auto select-none"
    : "p-4 bg-white text-black font-mono text-xs w-[80mm] min-h-[100mm] mx-auto";

  // RENDER: COMPROBANTE DE SALIDA / ENTREGA DE EFECTIVO A GERENCIA
  if (type === 'salida') {
    const mov = data;
    return (
      <div ref={ref} className={containerClasses} style={{ width: isPreview ? '100%' : '80mm' }}>
        <div className="text-center pb-2 border-b border-black border-dashed">
          <h2 className="font-black text-base uppercase tracking-tight">TALLER EL MINGO</h2>
          <p className="text-[11px] font-bold">VALE DE ENTREGA / SALIDA DE EFECTIVO</p>
          <p className="text-[10px]">Sucursal: {mov.sucursal || 'Principal (SUC-01)'}</p>
          <p className="text-[10px]">Turno: {mov.numero_turno || mov.id_turno?.substring(0, 8) || 'N/A'}</p>
        </div>

        <div className="py-2 border-b border-black border-dashed text-[11px] space-y-1">
          <div className="flex justify-between">
            <span>FECHA / HORA:</span>
            <span>{mov.fecha ? new Date(mov.fecha).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : new Date().toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>TIPO:</span>
            <span className="font-bold">{mov.tipo || 'Entrega a Gerencia'}</span>
          </div>
          <div className="flex justify-between">
            <span>CAJERO:</span>
            <span className="font-bold truncate max-w-[170px]">{mov.cajero || 'Cajero'}</span>
          </div>
          <div className="flex justify-between">
            <span>AUTORIZADO POR:</span>
            <span className="font-bold truncate max-w-[170px]">{mov.autorizado_por || 'Gerencia'}</span>
          </div>
          <div className="flex justify-between">
            <span>RECIBIDO POR:</span>
            <span className="font-bold truncate max-w-[170px]">{mov.recibido_por || 'Gerencia'}</span>
          </div>
        </div>

        <div className="py-2 border-b border-black border-dashed text-[11px] space-y-1">
          <div className="text-[10px] uppercase font-bold text-gray-700">CONCEPTO / MOTIVO:</div>
          <div className="bg-gray-50 p-1.5 rounded border border-gray-200 text-xs italic">
            "{mov.motivo || 'Retiro de efectivo autorizado por gerencia'}"
          </div>
        </div>

        <div className="py-3 border-b-2 border-black border-dashed text-center">
          <span className="text-xs uppercase font-bold">MONTO RETIRADO:</span>
          <div className="text-2xl font-black tracking-tight mt-1">
            C$ {Number(mov.monto_cordobas || mov.monto || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {mov.moneda === 'USD' && (
            <div className="text-[11px] text-gray-700">
              (${Number(mov.monto).toFixed(2)} USD a T/C {mov.tipo_cambio || 36.62})
            </div>
          )}
        </div>

        {/* FIRMAS DE RESPONSABILIDAD */}
        <div className="pt-8 pb-4 space-y-7 text-[11px] text-center">
          <div>
            <div className="border-t border-black w-44 mx-auto mb-1"></div>
            <p className="font-bold">ENTREGÓ CONFORME</p>
            <p className="text-[10px]">Cajero: {mov.cajero || 'Firma Cajero'}</p>
          </div>
          <div>
            <div className="border-t border-black w-44 mx-auto mb-1"></div>
            <p className="font-bold">RECIBIÓ CONFORME</p>
            <p className="text-[10px]">{mov.recibido_por || 'Firma Gerencia'}</p>
          </div>
        </div>

        <div className="text-center pt-2 border-t border-black border-dashed text-[9px] text-gray-600">
          Documento válido para descargo de efectivo en el cuadre final de caja.
        </div>
      </div>
    );
  }

  // RENDER: ARQUEO Y CIERRE DE CAJA (FINAL)
  const turno = data;
  const dif = Number(turno.diferencia_cordobas || 0);

  return (
    <div ref={ref} className={containerClasses} style={{ width: isPreview ? '100%' : '80mm' }}>
      {/* CABECERA */}
      <div className="text-center pb-2 border-b border-black border-dashed">
        <h2 className="font-black text-base uppercase tracking-tight">TALLER EL MINGO</h2>
        <p className="text-[11px] font-bold">ACTA DE ARQUEO Y CIERRE DE CAJA</p>
        <p className="text-[10px]">Sucursal: {turno.sucursal || 'Principal (SUC-01)'}</p>
        <p className="text-[10px] font-black">TURNO: {turno.numero_turno || turno.id?.substring(0, 8)}</p>
      </div>

      {/* METADATOS TURNO */}
      <div className="py-2 border-b border-black border-dashed text-[11px] space-y-0.5">
        <div className="flex justify-between">
          <span>CAJERO RESPONSABLE:</span>
          <span className="font-bold truncate max-w-[160px]">{turno.cajero_nombre || 'Cajero'}</span>
        </div>
        <div className="flex justify-between">
          <span>APERTURA:</span>
          <span>{turno.fecha_apertura ? new Date(turno.fecha_apertura).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span>CIERRE:</span>
          <span>{turno.fecha_cierre ? new Date(turno.fecha_cierre).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : new Date().toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
      </div>

      {/* CUADRE PRINCIPAL DE EFECTIVO */}
      <div className="py-2 border-b border-black border-dashed text-[11px] space-y-1">
        <div className="font-black uppercase text-center pb-1">LIQUIDACIÓN DE EFECTIVO</div>
        
        <div className="flex justify-between">
          <span>(+) Fondo Inicial de Caja:</span>
          <span className="font-bold font-mono">C$ {Number(turno.total_inicial_cordobas || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-emerald-800">
          <span>(+) Ventas en Efectivo:</span>
          <span className="font-bold font-mono">+ C$ {Number(turno.total_ventas_efectivo || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-red-700">
          <span>(-) Salidas / Entregas a Gerencia:</span>
          <span className="font-bold font-mono">- C$ {Number(turno.total_salidas_efectivo || 0).toFixed(2)}</span>
        </div>

        <div className="flex justify-between border-t border-black pt-1 font-bold">
          <span>(=) EFECTIVO TEÓRICO EN CAJA:</span>
          <span className="font-mono">C$ {Number(turno.efectivo_esperado_cordobas || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-black text-xs pt-0.5">
          <span>(★) EFECTIVO REAL CONTADO:</span>
          <span className="font-mono">C$ {Number(turno.total_contado_cordobas || 0).toFixed(2)}</span>
        </div>

        {/* ESTADO DEL CUADRE */}
        <div className="pt-1.5 text-center">
          {dif === 0 ? (
            <div className="border border-black p-1 font-black uppercase text-xs">
              ✓ CAJA CUADRADA EXACTA (C$ 0.00)
            </div>
          ) : dif > 0 ? (
            <div className="border border-black p-1 font-black uppercase text-xs text-blue-900">
              ▲ SOBRANTE DE EFECTIVO: + C$ {dif.toFixed(2)}
            </div>
          ) : (
            <div className="border border-black p-1 font-black uppercase text-xs text-red-900">
              ▼ FALTANTE DE EFECTIVO: - C$ {Math.abs(dif).toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* VENTAS TOTALES POR MÉTODO */}
      <div className="py-2 border-b border-black border-dashed text-[11px] space-y-0.5">
        <div className="font-bold uppercase text-[10px] text-gray-700 mb-1">TOTAL FACTURADO EN TURNO</div>
        <div className="flex justify-between">
          <span>Ventas Efectivo:</span>
          <span>C$ {Number(turno.total_ventas_efectivo || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Ventas con Tarjeta:</span>
          <span>C$ {Number(turno.total_ventas_tarjeta || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Ventas Transferencia:</span>
          <span>C$ {Number(turno.total_ventas_transferencia || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Ventas al Crédito:</span>
          <span>C$ {Number(turno.total_ventas_credito || 0).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-black border-t border-black pt-1">
          <span>GRAN TOTAL VENDIDO:</span>
          <span>C$ {Number((turno.total_ventas_efectivo || 0) + (turno.total_ventas_tarjeta || 0) + (turno.total_ventas_transferencia || 0) + (turno.total_ventas_credito || 0)).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[10px] text-gray-600">
          <span>Facturas Emitidas:</span>
          <span>{turno.cantidad_facturas || 0}</span>
        </div>
      </div>

      {/* HISTORIAL DE SALIDAS A GERENCIA SI HUBIERON */}
      {Array.isArray(turno.movimientos) && turno.movimientos.length > 0 && (
        <div className="py-2 border-b border-black border-dashed text-[11px] space-y-1">
          <div className="font-bold uppercase text-[10px]">DETALLE ENTREGAS / RETIROS ({turno.movimientos.length})</div>
          {turno.movimientos.map((m, idx) => (
            <div key={idx} className="flex justify-between text-[10px] border-b border-gray-200 pb-0.5">
              <span>{m.recibido_por || 'Gerencia'} ({m.tipo}):</span>
              <span className="font-bold">-C$ {Number(m.monto_cordobas || m.monto).toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* OBSERVACIONES */}
      {turno.observaciones_cierre && (
        <div className="py-2 border-b border-black border-dashed text-[10px]">
          <span className="font-bold uppercase">NOTAS DE CIERRE:</span>
          <p className="italic">{turno.observaciones_cierre}</p>
        </div>
      )}

      {/* FIRMAS */}
      <div className="pt-8 pb-4 space-y-7 text-[11px] text-center">
        <div>
          <div className="border-t border-black w-44 mx-auto mb-1"></div>
          <p className="font-bold">FIRMA DEL CAJERO</p>
          <p className="text-[10px]">{turno.cajero_nombre || 'Cajero'}</p>
        </div>
        <div>
          <div className="border-t border-black w-44 mx-auto mb-1"></div>
          <p className="font-bold">GERENCIA / AUDITORÍA</p>
          <p className="text-[10px]">Recibido y Conforme</p>
        </div>
      </div>

      <div className="text-center pt-2 border-t border-black border-dashed text-[9px] text-gray-600">
        Comprobante de cierre generado por Sistema ERP El Mingo
      </div>
    </div>
  );
});

export default CashTicketPrinter;
