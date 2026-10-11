import React, { useState, useEffect } from 'react';
import { Calculator, RotateCcw, Check, X, DollarSign, Coins } from 'lucide-react';

const NIO_DENOMINATIONS = [
  { value: 1000, label: 'C$ 1,000', type: 'billete' },
  { value: 500, label: 'C$ 500', type: 'billete' },
  { value: 200, label: 'C$ 200', type: 'billete' },
  { value: 100, label: 'C$ 100', type: 'billete' },
  { value: 50, label: 'C$ 50', type: 'billete' },
  { value: 20, label: 'C$ 20', type: 'billete' },
  { value: 10, label: 'C$ 10', type: 'billete' },
  { value: 5, label: 'C$ 5', type: 'moneda' },
  { value: 1, label: 'C$ 1', type: 'moneda' },
  { value: 0.5, label: 'C$ 0.50', type: 'moneda' }
];

const USD_DENOMINATIONS = [
  { value: 100, label: '$100', type: 'billete' },
  { value: 50, label: '$50', type: 'billete' },
  { value: 20, label: '$20', type: 'billete' },
  { value: 10, label: '$10', type: 'billete' },
  { value: 5, label: '$5', type: 'billete' },
  { value: 1, label: '$1', type: 'billete' }
];

export default function MoneyCounterModal({
  isOpen,
  onClose,
  onApply,
  initialCounts = null,
  initialTipoCambio = 36.62,
  title = 'Contador de Efectivo (Arqueo Físico)',
  subtitle = 'Conteo desglosado de billetes y monedas en Córdobas y Dólares'
}) {
  const [countsNio, setCountsNio] = useState({});
  const [countsUsd, setCountsUsd] = useState({});
  const [tipoCambio, setTipoCambio] = useState(initialTipoCambio);
  const [activeTab, setActiveTab] = useState('NIO'); // 'NIO' | 'USD' | 'AMBOS'

  useEffect(() => {
    if (initialCounts) {
      setCountsNio(initialCounts.nio || {});
      setCountsUsd(initialCounts.usd || {});
      if (initialCounts.tipoCambio) setTipoCambio(initialCounts.tipoCambio);
    } else {
      setCountsNio({});
      setCountsUsd({});
    }
  }, [isOpen, initialCounts]);

  if (!isOpen) return null;

  const handleNioChange = (val, qty) => {
    const num = Math.max(0, parseInt(qty, 10) || 0);
    setCountsNio(prev => ({ ...prev, [val]: num }));
  };

  const handleUsdChange = (val, qty) => {
    const num = Math.max(0, parseInt(qty, 10) || 0);
    setCountsUsd(prev => ({ ...prev, [val]: num }));
  };

  const resetAll = () => {
    setCountsNio({});
    setCountsUsd({});
  };

  // Cálculos totales
  const totalNio = NIO_DENOMINATIONS.reduce((sum, d) => {
    const qty = countsNio[d.value] || 0;
    return sum + (d.value * qty);
  }, 0);

  const totalUsd = USD_DENOMINATIONS.reduce((sum, d) => {
    const qty = countsUsd[d.value] || 0;
    return sum + (d.value * qty);
  }, 0);

  const usdEnCordobas = totalUsd * (parseFloat(tipoCambio) || 0);
  const granTotalCordobas = totalNio + usdEnCordobas;

  const totalPiezasNio = Object.values(countsNio).reduce((sum, v) => sum + (v || 0), 0);
  const totalPiezasUsd = Object.values(countsUsd).reduce((sum, v) => sum + (v || 0), 0);

  const handleApplyClick = () => {
    if (onApply) {
      onApply({
        cordobas: totalNio,
        dolares: totalUsd,
        usdEnCordobas,
        totalCordobas: granTotalCordobas,
        tipoCambio: parseFloat(tipoCambio) || 36.62,
        desglose: {
          nio: countsNio,
          usd: countsUsd
        }
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 md:p-6 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Cabecera */}
        <div className="p-4 md:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-sm">
              <Calculator size={24} className="text-blue-100" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">{title}</h2>
              <p className="text-xs text-blue-100">{subtitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Controles y Tipo de Cambio */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Moneda:</span>
            <div className="inline-flex bg-gray-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('NIO')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${activeTab === 'NIO' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                🇳🇮 Córdobas (C$)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('USD')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${activeTab === 'USD' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                🇺🇸 Dólares ($USD)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('AMBOS')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${activeTab === 'AMBOS' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Ambas Monedas
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
              <DollarSign size={16} className="text-emerald-600" />
              <label className="text-xs font-bold text-gray-600">T/C Oficial (C$ x $1):</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={tipoCambio}
                onChange={e => setTipoCambio(e.target.value)}
                className="w-20 font-black text-right text-sm text-gray-800 bg-transparent outline-none focus:text-blue-600"
              />
            </div>
            <button
              type="button"
              onClick={resetAll}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-gray-200"
              title="Poner todos los contadores en cero"
            >
              <RotateCcw size={14} />
              Limpiar
            </button>
          </div>
        </div>

        {/* Contenido: Tablas de Denominaciones */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* COLUMNA CÓRDOBAS */}
            {(activeTab === 'NIO' || activeTab === 'AMBOS') && (
              <div className={`space-y-3 ${activeTab === 'NIO' ? 'md:col-span-2 max-w-2xl mx-auto w-full' : ''}`}>
                <div className="flex items-center justify-between pb-2 border-b border-blue-100">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-blue-900">🇳🇮 Billetes y Monedas en Córdobas (C$)</span>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    {totalPiezasNio} piezas
                  </span>
                </div>

                <div className="divide-y divide-gray-100 border rounded-2xl overflow-hidden bg-white shadow-sm">
                  {NIO_DENOMINATIONS.map(denom => {
                    const qty = countsNio[denom.value] || 0;
                    const subtotal = denom.value * qty;
                    return (
                      <div key={`nio-${denom.value}`} className="flex items-center justify-between p-2.5 hover:bg-blue-50/40 transition-colors">
                        <div className="w-28 flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${denom.type === 'billete' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                            {denom.type === 'billete' ? 'Billete' : 'Moneda'}
                          </span>
                          <span className="font-black text-gray-800 text-sm">{denom.label}</span>
                        </div>

                        {/* Botones de incremento rápido e input */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleNioChange(denom.value, Math.max(0, qty - 1))}
                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center text-sm"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={qty === 0 ? '' : qty}
                            onChange={e => handleNioChange(denom.value, e.target.value)}
                            className="w-16 text-center font-black text-sm p-1 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleNioChange(denom.value, qty + 1)}
                            className="w-7 h-7 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold flex items-center justify-center text-sm"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNioChange(denom.value, qty + 5)}
                            className="px-1.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-[10px] font-bold text-gray-600"
                            title="Sumar 5 piezas"
                          >
                            +5
                          </button>
                        </div>

                        <div className="w-24 text-right">
                          <span className={`font-mono text-sm font-black ${subtotal > 0 ? 'text-blue-900' : 'text-gray-400'}`}>
                            C$ {subtotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-blue-50 p-3 rounded-2xl flex justify-between items-center border border-blue-200">
                  <span className="font-bold text-blue-900 text-sm">Subtotal Córdobas (C$):</span>
                  <span className="text-lg font-black text-blue-950 font-mono">C$ {totalNio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            {/* COLUMNA DÓLARES */}
            {(activeTab === 'USD' || activeTab === 'AMBOS') && (
              <div className={`space-y-3 ${activeTab === 'USD' ? 'md:col-span-2 max-w-2xl mx-auto w-full' : ''}`}>
                <div className="flex items-center justify-between pb-2 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-emerald-900">🇺🇸 Billetes en Dólares ($USD)</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {totalPiezasUsd} piezas
                  </span>
                </div>

                <div className="divide-y divide-gray-100 border rounded-2xl overflow-hidden bg-white shadow-sm">
                  {USD_DENOMINATIONS.map(denom => {
                    const qty = countsUsd[denom.value] || 0;
                    const subtotal = denom.value * qty;
                    return (
                      <div key={`usd-${denom.value}`} className="flex items-center justify-between p-2.5 hover:bg-emerald-50/40 transition-colors">
                        <div className="w-28 flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            Billete
                          </span>
                          <span className="font-black text-gray-800 text-sm">{denom.label}</span>
                        </div>

                        {/* Botones de incremento rápido e input */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUsdChange(denom.value, Math.max(0, qty - 1))}
                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center justify-center text-sm"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={qty === 0 ? '' : qty}
                            onChange={e => handleUsdChange(denom.value, e.target.value)}
                            className="w-16 text-center font-black text-sm p-1 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUsdChange(denom.value, qty + 1)}
                            className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold flex items-center justify-center text-sm"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUsdChange(denom.value, qty + 5)}
                            className="px-1.5 py-1 rounded bg-gray-100 hover:bg-gray-200 text-[10px] font-bold text-gray-600"
                            title="Sumar 5 piezas"
                          >
                            +5
                          </button>
                        </div>

                        <div className="w-24 text-right">
                          <span className={`font-mono text-sm font-black ${subtotal > 0 ? 'text-emerald-900' : 'text-gray-400'}`}>
                            $ {subtotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-emerald-50 p-3 rounded-2xl space-y-1 border border-emerald-200">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-900 text-sm">Subtotal Dólares ($USD):</span>
                    <span className="text-lg font-black text-emerald-950 font-mono">$ {totalUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-emerald-700 border-t border-emerald-200/60 pt-1">
                    <span>Equivalente en C$ (T/C {tipoCambio}):</span>
                    <span className="font-bold font-mono">C$ {usdEnCordobas.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Resumen Final y Acciones */}
        <div className="p-4 md:p-5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-center sm:text-left">
            <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
              <span className="block text-[10px] uppercase font-bold text-gray-400">Total Córdobas</span>
              <span className="text-base font-black text-blue-900 font-mono">C$ {totalNio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {totalUsd > 0 && (
              <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
                <span className="block text-[10px] uppercase font-bold text-gray-400">Total Dólares</span>
                <span className="text-base font-black text-emerald-900 font-mono">$ {totalUsd.toFixed(2)} <span className="text-xs text-gray-500 font-normal">(= C$ {usdEnCordobas.toFixed(2)})</span></span>
              </div>
            )}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-5 py-2 rounded-xl text-white shadow-md">
              <span className="block text-[10px] uppercase font-bold text-blue-200">Gran Total Físico Cuadrado</span>
              <span className="text-xl font-black font-mono">C$ {granTotalCordobas.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-100 text-sm transition-colors"
            >
              Cerrar
            </button>
            {onApply && (
              <button
                type="button"
                onClick={handleApplyClick}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Check size={18} />
                Cargar este Conteo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
