import React, { forwardRef, useState, useEffect } from 'react';
import { ref as dbRef, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import { DEFAULT_PRINT_CONFIG } from './catalogos/PrintFormatEditor';

// Formateador de moneda configurable (maneja espacio tras C$ y decimales)
export const formatMoney = (amount, cfg, isPU = false) => {
  const num = Number(amount || 0);
  const decimals = isPU ? (cfg?.decimales_pu !== false ? 2 : 0) : 2;
  const formattedNumber = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  const space = (cfg?.mostrar_espacio_moneda !== false) ? ' ' : '';
  return `C$${space}${formattedNumber}`;
};


export const renderCustodyItemBadge = (item, sale) => {
  if (!sale?.mercancia_pendiente || item?.type === 'servicio') return null;
  const pnd = item?.cantidad_pendiente;
  const ent = item?.cantidad_entregada_inicial;
  if (pnd === undefined && ent === undefined) return null;

  if (pnd === 0) {
    return (
      <span className="text-[8px] font-bold text-emerald-800 bg-emerald-100/90 px-1 py-0.2 rounded ml-1 print:border print:border-black">
        ✓ Entregado
      </span>
    );
  }
  if (pnd > 0 && ent > 0) {
    return (
      <span className="text-[8px] font-bold text-amber-900 bg-amber-100/90 px-1 py-0.2 rounded ml-1 print:border print:border-black">
        ({ent} ent. / {pnd} pend.)
      </span>
    );
  }
  return (
    <span className="text-[8px] font-bold text-blue-900 bg-blue-100/90 px-1 py-0.2 rounded ml-1 print:border print:border-black">
      [PENDIENTE: {pnd}]
    </span>
  );
};

export const getDividerClass = (style) => {
  switch (style) {
    case 'puntos':
      return 'border-b border-black border-dotted';
    case 'solido':
      return 'border-b border-black border-solid';
    case 'doble':
      return 'border-b-2 border-black border-double';
    case 'guiones':
    default:
      return 'border-b border-black border-dashed';
  }
};

const TicketPrinter = forwardRef(({ sale, isPreview = false, customConfig = null }, forwardedRef) => {
  const [dbConfig, setDbConfig] = useState(DEFAULT_PRINT_CONFIG);

  useEffect(() => {
    if (customConfig) return;
    const configRef = dbRef(rtdb, 'configuracion/formatos_impresion');
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

  const subtotalBruto = sale.items?.reduce((sum, item) => sum + ((Number(item.precio_unitario || item.price) || 0) * (Number(item.cantidad || item.qty) || 1)), 0) || sale.total;
  const totalDescuentos = sale.items?.reduce((sum, item) => sum + (Number(item.descuento) || 0), 0) || (sale.descuento_total || 0);

  const fontSizeClass = cfg.tamano_letra === 'compacta' 
    ? 'text-[10px]' 
    : cfg.tamano_letra === 'grande' 
      ? 'text-[12px]' 
      : 'text-[11px]';

  const dividerClass = getDividerClass(cfg.estilo_divisor);
  const headerAlign = cfg.alineacion_cabecera === 'izquierda' ? 'text-left' : 'text-center';
  const estiloItems = cfg.estilo_items || 'dos_lineas';
  const skuPos = cfg.posicion_sku || 'arriba';

  const containerClasses = isPreview 
    ? `p-3 bg-white text-gray-900 font-mono ${fontSizeClass} leading-tight border border-gray-200 rounded-lg shadow-inner ${is58mm ? 'max-w-[270px]' : 'max-w-[340px]'} mx-auto select-none`
    : `p-3 bg-white text-black font-mono ${fontSizeClass} leading-tight w-[${printWidth}] min-h-[90mm] mx-auto`;

  return (
    <div ref={forwardedRef} className={containerClasses} style={{ width: isPreview ? '100%' : printWidth }}>
      {/* CABECERA COMERCIAL */}
      <div className={`${headerAlign} pb-2 ${dividerClass} space-y-0.5`}>
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
      <div className={`py-2 ${dividerClass} text-[10px] space-y-0.5`}>
        <div className="flex justify-between">
          <span><strong>FACTURA:</strong></span>
          <span className="font-bold">{sale.numero_factura || (sale.id?.startsWith('-') ? 'FACTURA' : sale.id)}</span>
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
          <div className={`flex justify-between text-purple-950 font-bold ${dividerClass} pt-1 mt-1`}>
            <span>REGALÍA:</span>
            <span className="truncate max-w-[170px] text-right">{sale.regalia}</span>
          </div>
        )}
      </div>

      {/* ================= DETALLE DE ARTÍCULOS ================= */}

      {/* FORMATO 1: DETALLADO EN 2 LÍNEAS (MÁXIMA SEPARACIÓN ENTRE P.U. Y TOTAL) */}
      {estiloItems === 'dos_lineas' && (
        <div className="my-2 divide-y divide-gray-200 divide-dashed">
          <div className={`flex justify-between text-[10px] font-bold pb-1 ${dividerClass}`}>
            <span>Descripción del Artículo</span>
            <span>Importe</span>
          </div>
          {sale.items?.map((item, index) => {
            const hasDesc = cfg.mostrar_descuentos && (Number(item.descuento) || 0) > 0;
            const itemCode = item.codigo_visible || item.sku || item.codigo || (item.type !== 'servicio' ? item.id_producto : null);
            const qty = Number(item.cantidad || item.qty) || 1;
            const pu = Number(item.precio_unitario || item.price) || 0;
            const sub = Number(item.subtotal != null ? item.subtotal : (qty * pu)) || 0;

            return (
              <div key={index} className="py-1.5 space-y-0.5">
                {/* LÍNEA 1: Código y Nombre completo del producto */}
                <div className="leading-snug">
                  {cfg.mostrar_codigo_producto && itemCode && skuPos === 'arriba' && (
                    <span className="font-bold text-[9px] text-gray-700 block">[{itemCode}]</span>
                  )}
                  {cfg.mostrar_codigo_producto && itemCode && skuPos === 'junto' && (
                    <span className="font-bold text-[9px] text-gray-700 mr-1">[{itemCode}]</span>
                  )}
                  <span className="font-medium text-gray-900">{item.nombre || item.name || item.id_producto}</span>
                  {renderCustodyItemBadge(item, sale)}
                  {cfg.mostrar_codigo_producto && itemCode && skuPos === 'abajo' && (
                    <span className="text-[8px] text-gray-500 block font-mono">SKU: {itemCode}</span>
                  )}
                </div>

                {/* LÍNEA 2: Cantidad × P.U. a la izquierda, Total a la derecha */}
                <div className="flex justify-between items-baseline text-[10px] pt-0.5">
                  <div className="text-gray-700">
                    <span className="font-bold text-black">{qty}</span>
                    <span className="text-gray-400 mx-1">×</span>
                    <span className="text-gray-800 font-mono">{formatMoney(pu, cfg, true)}</span>
                    {hasDesc && (
                      <span className="text-[9px] text-red-600 font-bold ml-1.5">
                        (-{formatMoney(item.descuento, cfg)})
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-black text-right whitespace-nowrap pl-3 font-mono">
                    {formatMoney(sub, cfg)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FORMATO 2: TABLA CLÁSICA EN COLUMNAS CON SEPARACIÓN AMPLIA */}
      {estiloItems === 'columnas_separadas' && (
        <table className="w-full text-[10px] my-2 border-collapse">
          <thead>
            <tr className={dividerClass}>
              <th className="text-left py-0.5 w-[10%]">Cant</th>
              <th className="text-left py-0.5 w-[42%]">Descripción</th>
              <th className="text-right py-0.5 w-[24%] px-1 whitespace-nowrap">P.U.</th>
              {cfg.separacion_precios === 'barra' && (
                <th className="w-[4%] text-center text-gray-400 font-normal">│</th>
              )}
              <th className={`text-right py-0.5 w-[24%] whitespace-nowrap ${cfg.separacion_precios === 'amplia' ? 'pl-3' : 'pl-1'}`}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 divide-dashed">
            {sale.items?.map((item, index) => {
              const hasDesc = cfg.mostrar_descuentos && (Number(item.descuento) || 0) > 0;
              const itemCode = item.codigo_visible || item.sku || item.codigo || (item.type !== 'servicio' ? item.id_producto : null);
              const qty = Number(item.cantidad || item.qty) || 1;
              const pu = Number(item.precio_unitario || item.price) || 0;
              const sub = Number(item.subtotal != null ? item.subtotal : (qty * pu)) || 0;

              return (
                <tr key={index} className="py-1">
                  <td className="py-1 align-top text-left font-bold">{qty}</td>
                  <td className="py-1 align-top pr-1 leading-snug">
                    <div>
                      {cfg.mostrar_codigo_producto && itemCode && skuPos === 'arriba' && (
                        <span className="font-bold text-[9px] text-gray-700 block">[{itemCode}]</span>
                      )}
                      {cfg.mostrar_codigo_producto && itemCode && skuPos === 'junto' && (
                        <span className="font-bold text-[9px] text-gray-700 mr-1">[{itemCode}]</span>
                      )}
                      <span>{item.nombre || item.name || item.id_producto}</span>
                      {renderCustodyItemBadge(item, sale)}
                      {cfg.mostrar_codigo_producto && itemCode && skuPos === 'abajo' && (
                        <span className="text-[8px] text-gray-500 block font-mono">SKU: {itemCode}</span>
                      )}
                    </div>
                    {hasDesc && (
                      <div className="text-[9px] text-red-600 font-bold">
                        Desc: -{formatMoney(item.descuento, cfg)}
                      </div>
                    )}
                  </td>
                  <td className="py-1 align-top text-right whitespace-nowrap px-1 text-gray-800 font-mono">
                    {formatMoney(pu, cfg, true)}
                  </td>
                  {cfg.separacion_precios === 'barra' && (
                    <td className="py-1 align-top text-center text-gray-300 font-normal select-none">│</td>
                  )}
                  <td className={`py-1 align-top text-right font-bold whitespace-nowrap text-black font-mono ${cfg.separacion_precios === 'amplia' ? 'pl-3' : 'pl-1'}`}>
                    {formatMoney(sub, cfg)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* FORMATO 3: COMPACTO (1 LÍNEA CON P.U. EN SUBTEXTO) */}
      {estiloItems === 'compacto' && (
        <div className="my-2 divide-y divide-gray-200 divide-dashed">
          {sale.items?.map((item, index) => {
            const hasDesc = cfg.mostrar_descuentos && (Number(item.descuento) || 0) > 0;
            const itemCode = item.codigo_visible || item.sku || item.codigo || (item.type !== 'servicio' ? item.id_producto : null);
            const qty = Number(item.cantidad || item.qty) || 1;
            const pu = Number(item.precio_unitario || item.price) || 0;
            const sub = Number(item.subtotal != null ? item.subtotal : (qty * pu)) || 0;

            return (
              <div key={index} className="py-1 text-[10px]">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1 leading-snug">
                    <span className="font-bold mr-1">{qty}×</span>
                    {cfg.mostrar_codigo_producto && itemCode && (
                      <span className="font-bold text-[9px] text-gray-600 mr-1">[{itemCode}]</span>
                    )}
                    <span>{item.nombre || item.name || item.id_producto}</span>
                    {renderCustodyItemBadge(item, sale)}
                    <div className="text-[9px] text-gray-500 font-mono">
                      P.U.: {formatMoney(pu, cfg, true)}
                      {hasDesc && (
                        <span className="text-red-600 font-bold ml-1">
                          (Desc: -{formatMoney(item.descuento, cfg)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="font-bold text-black text-right whitespace-nowrap pl-2 font-mono">
                    {formatMoney(sub, cfg)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TOTALES */}
      <div className={`${dividerClass} pt-1.5 space-y-1 text-[10px]`}>
        {cfg.mostrar_descuentos && totalDescuentos > 0 && (
          <>
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-mono">{formatMoney(subtotalBruto, cfg)}</span>
            </div>
            <div className="flex justify-between text-red-700 font-bold">
              <span>Descuento Otorgado:</span>
              <span className="font-mono">-{formatMoney(totalDescuentos, cfg)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between text-xs font-black border-t border-black pt-1">
          <span>TOTAL A PAGAR:</span>
          <span className="font-mono">{formatMoney(sale.total, cfg)}</span>
        </div>

        {/* Facturación en Dólares si aplica */}
        {sale.moneda === 'USD' && (
          <div className="flex justify-between text-[10px] text-gray-800 font-bold">
            <span>TOTAL EN USD:</span>
            <span className="font-mono">${Number(sale.total_usd || (sale.total / (sale.tipo_cambio || 36.624))).toFixed(2)} USD (T.C. {sale.tipo_cambio || '36.62'})</span>
          </div>
        )}

        {/* DETALLE DE PAGO EN EFECTIVO Y VUELTO */}
        {(sale.monto_recibido != null && Number(sale.monto_recibido) > 0) && (
          <div className="pt-1 mt-1 border-t border-black border-dotted text-[9.5px] space-y-0.5">
            <div className="flex justify-between">
              <span>RECIBIDO:</span>
              <span className="font-mono font-bold">
                {sale.pago_en_dolares
                  ? `$${Number(sale.monto_recibido_usd || 0).toFixed(2)} USD (${formatMoney(sale.monto_recibido, cfg)})`
                  : formatMoney(sale.monto_recibido, cfg)}
              </span>
            </div>
            <div className="flex justify-between font-black text-black">
              <span>CAMBIO / VUELTO:</span>
              <span className="font-mono">{formatMoney(sale.cambio || 0, cfg)}</span>
            </div>
          </div>
        )}

        {/* RÉGIMEN CUOTA FIJA (NICARAGUA) */}
        <div className="text-[7.5px] text-center text-gray-600 pt-0.5">
          Régimen Cuota Fija • No retiene ni traslada IVA a consumidor final
        </div>
      </div>

      
      {/* SECCIÓN MERCANCÍA EN CUSTODIA / PENDIENTE DE RETIRO */}
      {(sale.mercancia_pendiente || sale.codigo_entrega || sale.items?.some(it => (it.cantidad_pendiente || 0) > 0)) && (
        <div className="my-2 p-1.5 border-2 border-black border-dashed text-center space-y-1 bg-gray-50/50 print:bg-white">
          <div className="font-black text-[10px] tracking-wide uppercase">
            ★ MERCANCÍA EN CUSTODIA ★
          </div>
          <div className="font-bold text-[9px] font-mono">
            EXPEDIENTE: {sale.codigo_entrega || 'PENDIENTE DE RETIRO'}
          </div>
          <p className="text-[8px] leading-tight text-gray-800">
            {sale.items?.some(it => (it.cantidad_pendiente || 0) > 0 && (it.cantidad_entregada_inicial || 0) > 0)
              ? 'Entrega Parcial en Mostrador • Saldo Resguardado en Bodega'
              : 'Mercancía resguardada para retiro o instalación posterior'}
          </p>

          {sale.items?.some(it => it.cantidad_pendiente !== undefined) && (
            <div className="text-[8.5px] text-left border-t border-black border-dotted pt-1 mt-1 space-y-0.5">
              <div className="font-bold text-[8px] text-gray-700 uppercase flex justify-between pb-0.5">
                <span>Artículo</span>
                <span>Estado Entrega</span>
              </div>
              {sale.items.filter(it => it.type !== 'servicio').map((it, idx) => {
                const pnd = it.cantidad_pendiente !== undefined ? it.cantidad_pendiente : it.cantidad;
                const ent = it.cantidad_entregada_inicial !== undefined ? it.cantidad_entregada_inicial : (it.cantidad - pnd);
                return (
                  <div key={idx} className="flex justify-between items-baseline text-[8px] leading-tight">
                    <span className="truncate max-w-[155px] font-medium">{it.nombre || it.name}</span>
                    <span className="font-mono font-bold whitespace-nowrap pl-1">
                      {pnd > 0 ? (ent > 0 ? `${ent} ent. / ${pnd} pend.` : `${pnd} PEND`) : `${ent} ENT`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[7.5px] italic text-gray-700 pt-0.5 border-t border-black border-dotted">
            Conserve este comprobante para retirar o instalar en taller sus repuestos pendientes.
          </p>
        </div>
      )}

      {/* PIE DE TICKET */}
      <div className={`text-center text-[9px] mt-3 pt-2 ${dividerClass} space-y-1`}>
        {cfg.mensaje_agradecimiento && (
          <p className="font-bold text-[10px]">{cfg.mensaje_agradecimiento}</p>
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

