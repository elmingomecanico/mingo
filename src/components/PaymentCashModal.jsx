import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Coins, CheckCircle2, AlertCircle, X, ArrowRight, Edit3, ShieldCheck } from 'lucide-react';
import { ref, update } from 'firebase/database';
import { rtdb } from '../firebase';
import toast from 'react-hot-toast';

export default function PaymentCashModal({
  isOpen,
  onClose,
  total = 0, // Total en córdobas (C$)
  tipoCambio = 36.6240,
  onConfirm,
  monedaFactura = 'NIO' // 'NIO' | 'USD'
}) {
  const [monedaPago, setMonedaPago] = useState('NIO'); // 'NIO' | 'USD'
  const [montoRecibido, setMontoRecibido] = useState('');
  const [isEditingTc, setIsEditingTc] = useState(false);
  const [tempTc, setTempTc] = useState(tipoCambio.toString());
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMonedaPago(monedaFactura === 'USD' ? 'USD' : 'NIO');
      setMontoRecibido('');
      setIsEditingTc(false);
      setTempTc(tipoCambio.toString());
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, tipoCambio, monedaFactura]);

  if (!isOpen) return null;

  const tc = parseFloat(tempTc) || tipoCambio || 36.6240;
  const totalEnNio = Number(total) || 0;
  const totalEnUsd = Number((totalEnNio / tc).toFixed(2));

  // Cálculo del monto recibido en Córdobas para cuadrar contra el total en NIO
  const numRecibido = parseFloat(montoRecibido) || 0;
  const recibidoEnNio = monedaPago === 'USD' ? Number((numRecibido * tc).toFixed(2)) : numRecibido;
  const cambioEnNio = Number((recibidoEnNio - totalEnNio).toFixed(2));
  const cambioEnUsd = Number((cambioEnNio / tc).toFixed(2));
  const esInsuficiente = totalEnNio > 0 && cambioEnNio < -0.009;

  // Botones de denominaciones rápidas
  const getFastButtons = () => {
    if (monedaPago === 'NIO') {
      const bills = [50, 100, 200, 500, 1000, 2000];
      // Si el total es mayor que un billete, calcular el siguiente billete redondo
      const nextRound = Math.ceil(totalEnNio / 100) * 100;
      const next500 = Math.ceil(totalEnNio / 500) * 500;
      const suggestions = new Set([totalEnNio, nextRound, next500]);
      bills.forEach(b => {
        if (b >= totalEnNio) suggestions.add(b);
      });
      return Array.from(suggestions).filter(v => v > 0).sort((a, b) => a - b).slice(0, 6);
    } else {
      const exactUsd = Math.ceil(totalEnUsd);
      const bills = [5, 10, 20, 50, 100];
      const suggestions = new Set([exactUsd]);
      bills.forEach(b => {
        if (b >= totalEnUsd) suggestions.add(b);
      });
      return Array.from(suggestions).filter(v => v > 0).sort((a, b) => a - b).slice(0, 5);
    }
  };

  const handleFastAmount = (amount) => {
    setMontoRecibido(amount.toString());
    inputRef.current?.focus();
  };

  const handleSaveTipoCambio = async () => {
    const val = parseFloat(tempTc);
    if (!val || val <= 0) {
      return toast.error('Ingrese una tasa de cambio válida');
    }
    try {
      await update(ref(rtdb, 'configuracion/tasa_cambio'), {
        valor: val,
        fecha_actualizacion: new Date().toISOString()
      });
      setIsEditingTc(false);
      toast.success(`Tasa de cambio actualizada a C$ ${val.toFixed(4)}`);
    } catch (err) {
      toast.error('Error al actualizar tasa de cambio: ' + err.message);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (esInsuficiente) {
      return toast.error(`El monto recibido es insuficiente. Faltan C$ ${Math.abs(cambioEnNio).toFixed(2)}`);
    }
    onConfirm({
      montoRecibido: recibidoEnNio,
      cambio: Math.max(0, cambioEnNio),
      pagoEnDolares: monedaPago === 'USD',
      montoRecibidoUsd: monedaPago === 'USD' ? numRecibido : Number((numRecibido / tc).toFixed(2)),
      tipoCambio: tc,
      monedaFactura
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Enter' && !esInsuficiente && (totalEnNio === 0 || numRecibido > 0)) handleSubmit(e);
        }}
      >
        {/* Cabecera del Modal */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <Coins className="text-yellow-300" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Cobro en Efectivo</h2>
              <p className="text-xs text-blue-200">Régimen Cuota Fija (Sin recargo de IVA a consumidor)</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-5 space-y-4">
          
          {/* Tarjeta del Total a Cobrar */}
          <div className="bg-gradient-to-br from-gray-50 to-blue-50/40 p-4 rounded-2xl border border-blue-100 flex justify-between items-center">
            <div>
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Total a Cobrar
              </span>
              <div className="text-3xl font-black text-gray-900 mt-0.5 font-mono">
                C$ {totalEnNio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-xs text-gray-500 font-medium">
                Equivalente: <strong className="text-emerald-700 font-mono">${totalEnUsd.toFixed(2)} USD</strong>
              </span>
            </div>

            {/* Ajuste dinámico de Tasa de Cambio */}
            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                T.C. Oficial
              </span>
              {isEditingTc ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    step="0.0001"
                    value={tempTc}
                    onChange={(e) => setTempTc(e.target.value)}
                    className="w-20 border rounded px-1.5 py-0.5 text-xs font-bold font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTipoCambio}
                    className="bg-blue-600 text-white p-1 rounded hover:bg-blue-700 text-xs"
                    title="Guardar Tasa"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                  <span className="font-mono font-bold text-xs text-gray-700">
                    C$ {tc.toFixed(4)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingTc(true)}
                    className="text-gray-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                    title="Editar Tasa de Cambio"
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
              )}
              <span className="text-[10px] text-gray-400 block mt-0.5">1 USD = C$ {tc.toFixed(2)}</span>
            </div>
          </div>

          {/* Selector de Moneda de Pago: Córdobas o Dólares */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase">
              Moneda en que Paga el Cliente
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMonedaPago('NIO');
                  setMontoRecibido('');
                  inputRef.current?.focus();
                }}
                className={`py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                  monedaPago === 'NIO'
                    ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-200'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>🇳🇮</span> Córdobas (C$)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMonedaPago('USD');
                  setMontoRecibido('');
                  inputRef.current?.focus();
                }}
                className={`py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                  monedaPago === 'USD'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>🇺🇸</span> Dólares ($USD)
              </button>
            </div>
          </div>

          {/* Input de Monto Recibido */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-gray-700 uppercase">
                Monto Recibido ({monedaPago === 'NIO' ? 'C$' : '$USD'})
              </label>
              {monedaPago === 'USD' && numRecibido > 0 && (
                <span className="text-xs font-bold text-emerald-700 font-mono">
                  = C$ {(numRecibido * tc).toFixed(2)}
                </span>
              )}
            </div>

            <div className="relative">
              <span className="absolute left-4 top-3.5 text-gray-400 font-black text-lg">
                {monedaPago === 'NIO' ? 'C$' : '$'}
              </span>
              <input
                ref={inputRef}
                type="number"
                step="any"
                min="0"
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-2xl font-black text-gray-900 outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 font-mono transition-all"
              />
            </div>
          </div>

          {/* Botones de Montos Rápidos / Sugeridos */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
              Billetes / Montos Rápidos
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleFastAmount(monedaPago === 'NIO' ? totalEnNio : totalEnUsd)}
                className="px-3 py-1.5 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 text-xs font-black text-gray-800 transition-colors"
              >
                Exacto ({monedaPago === 'NIO' ? `C$ ${totalEnNio.toFixed(2)}` : `$ ${totalEnUsd.toFixed(2)}`})
              </button>
              {getFastButtons().map((amt) => {
                if (amt === (monedaPago === 'NIO' ? totalEnNio : totalEnUsd)) return null;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleFastAmount(amt)}
                    className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-xs font-black text-blue-900 transition-colors"
                  >
                    {monedaPago === 'NIO' ? `C$ ${amt}` : `$ ${amt}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tarjeta del Cambio / Vuelto Resultante */}
          {numRecibido > 0 ? (
            esInsuficiente ? (
              <div className="p-4 rounded-2xl border-2 border-red-200 bg-red-50 text-red-900 flex items-center gap-3 animate-in shake duration-300">
                <AlertCircle className="text-red-500 shrink-0" size={24} />
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block text-red-700">
                    Monto Insuficiente
                  </span>
                  <p className="text-sm font-semibold">
                    Faltan <strong className="font-mono text-base font-black text-red-800">C$ {Math.abs(cambioEnNio).toFixed(2)}</strong> para cubrir la factura.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 text-emerald-950 flex justify-between items-center">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block text-emerald-800">
                    Cambio / Vuelto a Devolver
                  </span>
                  <div className="text-3xl font-black font-mono text-emerald-950 mt-0.5">
                    C$ {cambioEnNio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {monedaPago === 'USD' && (
                    <span className="text-xs font-semibold text-emerald-800">
                      Equivalente: <strong className="font-mono">${cambioEnUsd.toFixed(2)} USD</strong>
                    </span>
                  )}
                </div>
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                  <CheckCircle2 size={32} />
                </div>
              </div>
            )
          ) : (
            <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 text-center text-xs text-gray-500">
              Ingrese el efectivo entregado por el cliente para calcular el vuelto.
            </div>
          )}

        </div>

        {/* Botones de Acción */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-2xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors text-sm"
          >
            Cancelar (Esc)
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={esInsuficiente || (totalEnNio > 0 && numRecibido <= 0)}
            className="flex-2 py-3 px-6 rounded-2xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-all active:scale-95"
          >
            <CheckCircle2 size={18} />
            <span>Confirmar y Facturar (Enter)</span>
          </button>
        </div>

      </div>
    </div>
  );
}
