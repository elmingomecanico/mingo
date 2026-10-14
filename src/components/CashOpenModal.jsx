import React, { useState, useEffect } from 'react';
import { LockOpen, Calculator, DollarSign, Coins, AlertCircle, X, ShieldCheck, Store } from 'lucide-react';
import { ref, push, set, update, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import toast from 'react-hot-toast';
import MoneyCounterModal from './MoneyCounterModal';

export default function CashOpenModal({
  isOpen,
  onClose,
  sucursal = 'SUC-01',
  currentUser = null,
  assignedCaja = null,
  availableCajas = [],
  onOpenSuccess = () => {}
}) {
  const [selectedCajaId, setSelectedCajaId] = useState('');
  const [montoCordobas, setMontoCordobas] = useState('');
  const [montoDolares, setMontoDolares] = useState('');
  const [tipoCambio, setTipoCambio] = useState(36.62);
  const [observaciones, setObservaciones] = useState('');
  const [isCounterOpen, setIsCounterOpen] = useState(false);
  const [desgloseCounts, setDesgloseCounts] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (assignedCaja?.id) {
      setSelectedCajaId(assignedCaja.id);
    } else if (availableCajas.length > 0) {
      setSelectedCajaId(availableCajas[0].id);
    }
  }, [assignedCaja, availableCajas]);

  if (!isOpen) return null;

  const nioVal = parseFloat(montoCordobas) || 0;
  const usdVal = parseFloat(montoDolares) || 0;
  const tcVal = parseFloat(tipoCambio) || 36.62;
  const totalInicial = nioVal + (usdVal * tcVal);

  const activeCaja = availableCajas.find(c => c.id === selectedCajaId) || assignedCaja || {
    id: 'CAJA-01',
    codigo: 'CAJA-01',
    nombre: 'Caja Principal'
  };

  const handleApplyCounter = (result) => {
    setMontoCordobas(result.cordobas.toString());
    setMontoDolares(result.dolares.toString());
    setTipoCambio(result.tipoCambio);
    setDesgloseCounts(result.desglose);
    toast.success('Conteo desglosado cargado al fondo inicial');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (totalInicial < 0) {
      return toast.error('El fondo inicial no puede ser negativo');
    }

    setLoading(true);
    try {
      // Secuencial numérico TRN-0001
      const counterRef = ref(rtdb, 'counters/turnos_caja');
      const counterResult = await runTransaction(counterRef, (currentData) => {
        return (currentData || 0) + 1;
      });
      const numTurno = counterResult.snapshot.val();
      const humanId = `TRN-${numTurno.toString().padStart(4, '0')}`;

      const turnoRef = push(ref(rtdb, 'turnos_caja'));
      const turnoId = turnoRef.key;

      const cajeroName = currentUser?.nombre_completo || currentUser?.usuario || 'Cajero';

      const newTurno = {
        id: turnoId,
        numero_turno: humanId,
        sucursal,
        id_caja: activeCaja.id,
        codigo_caja: activeCaja.codigo,
        nombre_caja: activeCaja.nombre,
        cajero_id: currentUser?.id || 'anon',
        cajero_nombre: cajeroName,
        fecha_apertura: new Date().toISOString(),
        monto_inicial_cordobas: nioVal,
        monto_inicial_dolares: usdVal,
        tipo_cambio: tcVal,
        total_inicial_cordobas: totalInicial,
        desglose_apertura: desgloseCounts || null,
        observaciones_apertura: observaciones.trim(),
        estado: 'Abierta',
        total_ventas_efectivo: 0,
        total_ventas_productos: 0,
        total_ventas_servicios: 0,
        total_salidas_efectivo: 0
      };

      await set(turnoRef, newTurno);

      try {
        await update(ref(rtdb, `configuracion/cajas/${activeCaja.id}`), {
          estado_turno: 'Abierto',
          turno_actual_id: turnoId,
          turno_actual_numero: humanId,
          usuario_apertura_nombre: cajeroName,
          fecha_apertura: new Date().toISOString(),
          monto_inicial_cordobas: totalInicial
        });
      } catch (errSync) {
        console.error("Error actualizando configuracion/cajas:", errSync);
      }

      toast.success(`Caja abierta con éxito (${activeCaja.codigo}). Turno: ${humanId}`);
      onOpenSuccess(newTurno);
      onClose();
    } catch (err) {
      toast.error('Error al abrir caja: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden">
        <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-700 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
                <LockOpen size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight">Apertura de Caja (Iniciar Turno)</h2>
                <p className="text-xs text-emerald-100">Ingrese el fondo inicial en efectivo para comenzar a facturar</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {/* Metadatos informativos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100 text-xs">
              <div>
                <span className="block text-gray-400 font-bold uppercase text-[10px]">Caja Registradora</span>
                {currentUser?.rol === 'SuperAdmin' && availableCajas.length > 1 ? (
                  <select 
                    value={selectedCajaId}
                    onChange={(e) => setSelectedCajaId(e.target.value)}
                    className="w-full mt-0.5 p-1 text-xs font-black text-blue-700 bg-white border border-blue-200 rounded-lg outline-none"
                  >
                    {availableCajas.map(c => (
                      <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <span className="font-black text-blue-700 flex items-center gap-1">
                    <Store size={13} /> {activeCaja.codigo} - {activeCaja.nombre}
                  </span>
                )}
              </div>
              <div>
                <span className="block text-gray-400 font-bold uppercase text-[10px]">Sucursal</span>
                <span className="font-black text-gray-800">{sucursal}</span>
              </div>
              <div>
                <span className="block text-gray-400 font-bold uppercase text-[10px]">Cajero Responsable</span>
                <span className="font-black text-gray-800 truncate block">
                  {currentUser?.nombre_completo || currentUser?.usuario || 'Administrador'}
                </span>
              </div>
            </div>

            {/* Botón para llamar al contador de billetes */}
            <div className="flex justify-between items-center bg-blue-50 border border-blue-200 p-3 rounded-2xl">
              <div className="text-xs text-blue-900">
                <span className="font-bold block">¿Desea contar billete por billete?</span>
                <span className="text-[11px] text-blue-700">Use el contador automático para mayor exactitud.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCounterOpen(true)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Calculator size={15} />
                Contador
              </button>
            </div>

            {/* Entradas de fondo inicial */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                  Fondo Inicial en Córdobas (C$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-black text-gray-400 text-sm">C$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={montoCordobas}
                    onChange={e => setMontoCordobas(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border rounded-xl font-black text-gray-800 text-base focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                    Fondo en Dólares ($USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-black text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={montoDolares}
                      onChange={e => setMontoDolares(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 border rounded-xl font-black text-gray-800 text-base focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                    T/C (Córdobas x $1)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={tipoCambio}
                    onChange={e => setTipoCambio(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-xl font-bold text-gray-800 text-base focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Tarjeta de Gran Total Inicial */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <span className="block text-[11px] font-bold text-emerald-800 uppercase">Total Fondo Inicial en Caja:</span>
                <span className="text-[11px] text-gray-500">Equivalente consolidado en Córdobas</span>
              </div>
              <div className="text-2xl font-black text-emerald-950 font-mono">
                C$ {totalInicial.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                Observaciones / Novedades de Apertura
              </label>
              <textarea
                rows="2"
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Ej: Se inicia con cambio de billetes pequeños y monedas..."
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            </div>

            {/* Acciones */}
            <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-100 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-200 flex items-center gap-2 transition-all active:scale-95 disabled:bg-gray-300"
              >
                <ShieldCheck size={18} />
                {loading ? 'Abriendo Caja...' : 'Confirmar y Abrir Caja'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal Contador de billetes y monedas */}
      <MoneyCounterModal
        isOpen={isCounterOpen}
        onClose={() => setIsCounterOpen(false)}
        onApply={handleApplyCounter}
        initialCounts={desgloseCounts ? { nio: desgloseCounts.nio, usd: desgloseCounts.usd, tipoCambio } : null}
        title="Contador de Dinero - Fondo Inicial"
        subtitle="Desglose los billetes y monedas con los que inicia el turno"
      />
    </>
  );
}
