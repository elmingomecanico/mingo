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
      </div>

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

