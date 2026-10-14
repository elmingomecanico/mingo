import React, { useState, useEffect, useRef } from 'react';
import { Lock, Calculator, CheckCircle2, AlertTriangle, Printer, X, FileText, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { ref, onValue, update } from 'firebase/database';
import { rtdb } from '../firebase';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import MoneyCounterModal from './MoneyCounterModal';
import CashTicketPrinter from './CashTicketPrinter';

export default function CashCloseModal({
  isOpen,
  onClose,
  activeTurno,
  currentUser,
  salesList = [],
  onCloseSuccess = () => {}
}) {
  const [montoContadoNio, setMontoContadoNio] = useState('');
  const [montoContadoUsd, setMontoContadoUsd] = useState('');
  const [tipoCambio, setTipoCambio] = useState(36.62);
  const [desgloseCounts, setDesgloseCounts] = useState(null);
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);

  const [movimientosList, setMovimientosList] = useState([]);
  const [isCounterOpen, setIsCounterOpen] = useState(false);

  // Para modal de ticket final tras cerrar
  const [closedTurnoData, setClosedTurnoData] = useState(null);
  const printRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Cierre_Caja_${closedTurnoData?.numero_turno || 'POS'}`,
    pageStyle: `@page { size: 80mm auto; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; } }`
  });

  // Cargar movimientos de salida del turno actual
  useEffect(() => {
    if (!activeTurno?.id) return;
    const movRef = ref(rtdb, `turnos_caja/${activeTurno.id}/movimientos`);
    const unsub = onValue(movRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
        setMovimientosList(list);
      } else {
        setMovimientosList([]);
      }
    });
    return () => unsub();
  }, [activeTurno?.id]);

  if (!isOpen || !activeTurno) return null;

  // Filtrar ventas correspondientes a este turno
  const turnoSales = salesList.filter(s => {
    if (s.id_turno && s.id_turno === activeTurno.id) return true;
    if (s.sucursal === activeTurno.sucursal && activeTurno.fecha_apertura) {
      return new Date(s.fecha) >= new Date(activeTurno.fecha_apertura);
    }
    return false;
  });

  const totalVentasEfectivo = turnoSales
    .filter(s => s.metodo_pago === 'Efectivo')
    .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

  const totalVentasTarjeta = turnoSales
    .filter(s => s.metodo_pago?.includes('Tarjeta'))
    .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

  const totalVentasTransferencia = turnoSales
    .filter(s => s.metodo_pago === 'Transferencia')
    .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

  const totalVentasCredito = turnoSales
    .filter(s => s.metodo_pago?.includes('Crédito'))
    .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

  const granTotalVendido = totalVentasEfectivo + totalVentasTarjeta + totalVentasTransferencia + totalVentasCredito;

  // Salidas a gerencia / gastos
  const totalSalidasEfectivo = movimientosList.reduce(
    (sum, m) => sum + (parseFloat(m.monto_cordobas) || parseFloat(m.monto) || 0),
    0
  );

  // Fondo Inicial
  const fondoInicial = parseFloat(activeTurno.total_inicial_cordobas) || 0;

  // Efectivo Teórico Esperado
  const efectivoTeoricoEsperado = Math.max(0, fondoInicial + totalVentasEfectivo - totalSalidasEfectivo);

  // Conteo Físico Real del Cajero
  const contadoNio = parseFloat(montoContadoNio) || 0;
  const contadoUsd = parseFloat(montoContadoUsd) || 0;
  const tc = parseFloat(tipoCambio) || 36.62;
  const totalFisicoContado = contadoNio + (contadoUsd * tc);

  // Diferencia
  const diferencia = totalFisicoContado - efectivoTeoricoEsperado;

  const handleApplyCounter = (result) => {
    setMontoContadoNio(result.cordobas.toString());
    setMontoContadoUsd(result.dolares.toString());
    setTipoCambio(result.tipoCambio);
    setDesgloseCounts(result.desglose);
    toast.success('Conteo desglosado cargado al arqueo de cierre');
  };

  const handleConfirmClose = async (e) => {
    e.preventDefault();

    if (totalFisicoContado < 0) {
      return toast.error('El monto contado no puede ser negativo');
    }

    setLoading(true);
    try {
      const fechaCierre = new Date().toISOString();
      const cajeroFinal = currentUser?.nombre_completo || currentUser?.usuario || activeTurno.cajero_nombre || 'Cajero';

      const updateData = {
        estado: 'Cerrada',
        fecha_cierre: fechaCierre,
        monto_final_contado_cordobas: contadoNio,
        monto_final_contado_dolares: contadoUsd,
        tipo_cambio_cierre: tc,
        total_contado_cordobas: totalFisicoContado,
        total_ventas_efectivo: totalVentasEfectivo,
        total_ventas_tarjeta: totalVentasTarjeta,
        total_ventas_transferencia: totalVentasTransferencia,
        total_ventas_credito: totalVentasCredito,
        total_salidas_efectivo: totalSalidasEfectivo,
        efectivo_esperado_cordobas: efectivoTeoricoEsperado,
        diferencia_cordobas: diferencia,
        cantidad_facturas: turnoSales.length,
        desglose_cierre: desgloseCounts || null,
        observaciones_cierre: observaciones.trim(),
        usuario_cierre: cajeroFinal
      };

      await update(ref(rtdb, `turnos_caja/${activeTurno.id}`), updateData);

      if (activeTurno.id_caja) {
        try {
          await update(ref(rtdb, `configuracion/cajas/${activeTurno.id_caja}`), {
            estado_turno: 'Cerrado',
            turno_actual_id: null,
            turno_actual_numero: null,
            ultimo_cierre: fechaCierre
          });
        } catch (e) {
          console.error("Error actualizando estado en configuracion/cajas:", e);
        }
      }

      const fullClosedTurno = {
        ...activeTurno,
        ...updateData,
        movimientos: movimientosList
      };

      toast.success(`Turno ${activeTurno.numero_turno} cerrado exitosamente`);
      setClosedTurnoData(fullClosedTurno);
      onCloseSuccess(fullClosedTurno);
    } catch (err) {
      toast.error('Error al cerrar caja: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden">
        <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-sm">
                <Lock size={24} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight">Cierre y Arqueo de Caja</h2>
                <p className="text-xs text-gray-300">
                  Turno: <span className="font-bold text-amber-300">{activeTurno.numero_turno || 'Activo'}</span> | Sucursal: {activeTurno.sucursal}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleConfirmClose} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
            
            {/* Metadatos del Turno */}
            <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100 text-xs">
              <div>
                <span className="block text-gray-400 font-bold uppercase text-[10px]">Cajero</span>
                <span className="font-black text-gray-800 truncate block">{activeTurno.cajero_nombre}</span>
              </div>
              <div>
                <span className="block text-gray-400 font-bold uppercase text-[10px]">Apertura</span>
                <span className="font-bold text-gray-800">
                  {new Date(activeTurno.fecha_apertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span className="block text-gray-400 font-bold uppercase text-[10px]">Facturas Emitidas</span>
                <span className="font-black text-blue-700">{turnoSales.length} facturas</span>
              </div>
            </div>

            {/* CUADRE FINANCIERO DEL SISTEMA */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <span className="text-xs font-black uppercase text-slate-700 tracking-wider block border-b border-slate-200 pb-1.5">
                1. Liquidación Teórica del Sistema (Efectivo)
              </span>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between items-center">
                  <span>(+) Fondo Inicial en Caja:</span>
                  <span className="font-bold font-mono text-slate-800">C$ {fondoInicial.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-800 font-semibold">
                  <span>(+) Ventas Facturadas en Efectivo:</span>
                  <span className="font-bold font-mono">+ C$ {totalVentasEfectivo.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-rose-700 font-semibold">
                  <span>(-) Entregas a Gerencia / Gastos:</span>
                  <span className="font-bold font-mono">- C$ {totalSalidasEfectivo.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t-2 border-slate-300 pt-2 flex justify-between items-center">
                <div>
                  <span className="font-black text-slate-900 text-sm block">EFECTIVO TEÓRICO EN GAVETA:</span>
                  <span className="text-[10px] text-slate-500">Monto exacto que el cajero debe entregar</span>
                </div>
                <div className="text-xl font-black text-slate-950 font-mono">
                  C$ {efectivoTeoricoEsperado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Métodos adicionales informativos */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-[11px] text-gray-500">
                <div>Tarjetas: <strong className="text-gray-700 font-mono">C$ {totalVentasTarjeta.toFixed(2)}</strong></div>
                <div>Transf: <strong className="text-gray-700 font-mono">C$ {totalVentasTransferencia.toFixed(2)}</strong></div>
                <div>Crédito: <strong className="text-gray-700 font-mono">C$ {totalVentasCredito.toFixed(2)}</strong></div>
              </div>
            </div>

            {/* CONTEO FÍSICO REAL DEL CAJERO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-gray-700 tracking-wider">
                  2. Conteo Físico Real del Cajero (Arqueo)
                </span>
                <button
                  type="button"
                  onClick={() => setIsCounterOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Calculator size={14} />
                  Abrir Contador de Billetes
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase">
                    Efectivo Córdobas (C$) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-gray-400 text-sm">C$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={montoContadoNio}
                      onChange={e => setMontoContadoNio(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border rounded-xl font-black text-gray-800 text-base focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase">
                    Efectivo Dólares ($USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={montoContadoUsd}
                      onChange={e => setMontoContadoUsd(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border rounded-xl font-black text-gray-800 text-base focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase">
                    T/C (Córdobas x $1)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={tipoCambio}
                    onChange={e => setTipoCambio(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-bold text-gray-800 text-base focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* COMPARADOR Y CUADRE EN TIEMPO REAL */}
            <div className={`p-4 rounded-2xl border transition-all ${
              Math.abs(diferencia) < 0.01
                ? 'bg-emerald-50 border-emerald-300'
                : diferencia > 0
                ? 'bg-blue-50 border-blue-300'
                : 'bg-rose-50 border-rose-300'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {Math.abs(diferencia) < 0.01 ? (
                    <CheckCircle2 size={20} className="text-emerald-600" />
                  ) : (
                    <AlertTriangle size={20} className={diferencia > 0 ? 'text-blue-600' : 'text-rose-600'} />
                  )}
                  <span className="font-black text-sm uppercase tracking-wide">
                    {Math.abs(diferencia) < 0.01
                      ? '✓ Caja Cuadrada Exacta'
                      : diferencia > 0
                      ? '▲ Sobrante de Efectivo'
                      : '▼ Faltante de Efectivo'}
                  </span>
                </div>
                <div className="text-xs font-bold">
                  Total Contado: <span className="font-mono font-black text-sm">C$ {totalFisicoContado.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-black/10 text-sm">
                <span className="font-bold">Diferencia de Cuadre:</span>
                <span className={`text-xl font-black font-mono ${
                  Math.abs(diferencia) < 0.01
                    ? 'text-emerald-700'
                    : diferencia > 0
                    ? 'text-blue-800'
                    : 'text-rose-700'
                }`}>
                  {diferencia >= 0 ? `+ C$ ${diferencia.toFixed(2)}` : `- C$ ${Math.abs(diferencia).toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Observaciones */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                Observaciones / Novedades de Cierre
              </label>
              <textarea
                rows="2"
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Ej: Se cuadró sin novedades. Se entregan billetes en sobre a gerencia..."
                className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-gray-500"
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
                className="px-6 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-sm shadow-lg shadow-gray-300 flex items-center gap-2 transition-all active:scale-95 disabled:bg-gray-400"
              >
                <ShieldCheck size={18} />
                {loading ? 'Cerrando Turno...' : 'Finalizar y Cerrar Caja'}
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
        title="Contador de Dinero - Cierre de Caja"
        subtitle="Desglose los billetes y monedas que tiene físicamente en la gaveta"
      />

      {/* Modal Impresión del Acta de Cierre */}
      {closedTurnoData && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                ✓ Turno Cerrado: {closedTurnoData.numero_turno}
              </span>
              <button onClick={() => { setClosedTurnoData(null); onClose(); }} className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none">&times;</button>
            </div>

            <div className="p-4 overflow-y-auto bg-gray-100 flex-1 flex justify-center">
              <CashTicketPrinter data={closedTurnoData} type="cierre" isPreview={true} />
            </div>

            <div className="p-3 sm:p-4 bg-white border-t border-gray-100 space-y-2 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-gray-200 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Printer size={18} />
                Imprimir Acta de Arqueo (POS-80)
              </button>
              <button
                type="button"
                onClick={() => { setClosedTurnoData(null); onClose(); }}
                className="w-full text-gray-500 font-bold hover:bg-gray-100 py-2 rounded-xl text-xs transition-colors"
              >
                Listo y Cerrar
              </button>
            </div>

            <div className="hidden">
              <CashTicketPrinter ref={printRef} data={closedTurnoData} type="cierre" isPreview={false} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
