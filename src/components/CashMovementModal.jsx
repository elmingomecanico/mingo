import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight, DollarSign, Printer, X, Check, History, AlertTriangle, FileText, UserCheck } from 'lucide-react';
import { ref, push, set, runTransaction, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import CashTicketPrinter from './CashTicketPrinter';

export default function CashMovementModal({
  isOpen,
  onClose,
  activeTurno,
  currentUser,
  onMovementAdded = () => {}
}) {
  const [tipo, setTipo] = useState('Entrega a Gerencia');
  const [moneda, setMoneda] = useState('NIO'); // 'NIO' | 'USD'
  const [monto, setMonto] = useState('');
  const [tipoCambio, setTipoCambio] = useState(36.62);
  const [autorizadoPor, setAutorizadoPor] = useState('Gerencia');
  const [recibidoPor, setRecibidoPor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const [movimientosList, setMovimientosList] = useState([]);
  const [activeTab, setActiveTab] = useState('nuevo'); // 'nuevo' | 'historial'

  // Para imprimir comprobante de retiro recién creado
  const [printedMovement, setPrintedMovement] = useState(null);
  const printRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Vale_Retiro_${printedMovement?.id || 'POS'}`,
    pageStyle: `@page { size: 80mm auto; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; } .no-print, button { display: none !important; } }`
  });

  // Escuchar movimientos del turno actual
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
        setMovimientosList(list.reverse());
      } else {
        setMovimientosList([]);
      }
    });
    return () => unsub();
  }, [activeTurno?.id]);

  if (!isOpen || !activeTurno) return null;

  const numMonto = parseFloat(monto) || 0;
  const tc = parseFloat(tipoCambio) || 36.62;
  const montoCordobas = moneda === 'USD' ? (numMonto * tc) : numMonto;

  const totalRetiradoTurno = movimientosList.reduce((sum, m) => sum + (parseFloat(m.monto_cordobas) || parseFloat(m.monto) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (numMonto <= 0) {
      return toast.error('Ingrese un monto válido a retirar');
    }
    if (!recibidoPor.trim()) {
      return toast.error('Indique quién recibe el dinero en efectivo');
    }
    if (!motivo.trim()) {
      return toast.error('Indique el motivo o justificación de la salida');
    }

    setLoading(true);
    try {
      const movKey = push(ref(rtdb, `turnos_caja/${activeTurno.id}/movimientos`)).key;
      const cajeroName = currentUser?.nombre_completo || currentUser?.usuario || 'Cajero';

      const movData = {
        id: movKey,
        id_turno: activeTurno.id,
        numero_turno: activeTurno.numero_turno || 'N/A',
        sucursal: activeTurno.sucursal || 'SUC-01',
        fecha: new Date().toISOString(),
        tipo,
        moneda,
        monto: numMonto,
        tipo_cambio: tc,
        monto_cordobas: montoCordobas,
        autorizado_por: autorizadoPor.trim(),
        recibido_por: recibidoPor.trim(),
        cajero: cajeroName,
        motivo: motivo.trim()
      };

      // 1. Guardar en subnodo del turno
      await set(ref(rtdb, `turnos_caja/${activeTurno.id}/movimientos/${movKey}`), movData);

      // 2. Guardar en auditoría global de movimientos de caja
      await set(ref(rtdb, `movimientos_caja/${movKey}`), movData);

      // 3. Actualizar total de salidas acumuladas en el turno
      const totalSalidasRef = ref(rtdb, `turnos_caja/${activeTurno.id}/total_salidas_efectivo`);
      await runTransaction(totalSalidasRef, (currentVal) => {
        return (currentVal || 0) + montoCordobas;
      });

      // 4. Registrar en contabilidad para mantener libros cuadrados
      const contabilidadRef = push(ref(rtdb, 'movimientos_contables'));
      await set(contabilidadRef, {
        fecha: movData.fecha,
        sucursal: movData.sucursal,
        tipo: 'Egreso',
        categoria: tipo === 'Entrega a Gerencia' ? 'Retiro a Gerencia' : 'Caja Chica',
        monto: montoCordobas,
        descripcion: `${tipo} - ${motivo} (Turno: ${activeTurno.numero_turno})`,
        referencia: movKey,
        autorizado_por: autorizadoPor,
        usuario: cajeroName
      });

      toast.success(`Salida de C$ ${montoCordobas.toFixed(2)} registrada exitosamente`);
      setPrintedMovement(movData);
      setMonto('');
      setRecibidoPor('');
      setMotivo('');
      onMovementAdded();
    } catch (err) {
      toast.error('Error al registrar salida: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden">
        <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-red-600 to-rose-700 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-sm">
                <ArrowUpRight size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight">Salidas / Entregas de Efectivo</h2>
                <p className="text-xs text-rose-100">
                  Turno: <span className="font-bold">{activeTurno.numero_turno || 'Activo'}</span> | Sucursal: {activeTurno.sucursal}
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

          {/* Subheader / Tabs */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('nuevo')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'nuevo' ? 'bg-rose-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                + Registrar Salida
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('historial')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'historial' ? 'bg-rose-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                <History size={14} />
                Historial del Turno ({movimientosList.length})
              </button>
            </div>

            <div className="text-xs font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
              Total Retirado: C$ {totalRetiradoTurno.toFixed(2)}
            </div>
          </div>

          {/* Contenido */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {activeTab === 'nuevo' ? (
              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                
                {/* Alerta explicativa */}
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Protección para el Cuadre del Cajero:</span>
                    Cualquier entrega parcial de ventas a gerencia o gasto menor queda descontado del efectivo teórico que se le exigirá al cajero al cierre del turno.
                  </div>
                </div>

                {/* Tipo de Salida */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                    Tipo de Salida / Retiro *
                  </label>
                  <select
                    value={tipo}
                    onChange={e => setTipo(e.target.value)}
                    className="w-full p-2.5 border rounded-xl font-bold text-sm text-gray-800 bg-white outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Entrega a Gerencia">Entrega a Gerencia (Retiro parcial de ventas)</option>
                    <option value="Gasto Menor / Caja Chica">Gasto Menor / Caja Chica (Repuestos, víveres, taller)</option>
                    <option value="Pago a Proveedor">Pago a Proveedor en Efectivo</option>
                    <option value="Otro Egreso Justificado">Otro Egreso Justificado</option>
                  </select>
                </div>

                {/* Moneda y Monto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                      Moneda *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMoneda('NIO')}
                        className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${moneda === 'NIO' ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-200' : 'border-gray-200 text-gray-600'}`}
                      >
                        🇳🇮 Córdobas (C$)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMoneda('USD')}
                        className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition-all ${moneda === 'USD' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200' : 'border-gray-200 text-gray-600'}`}
                      >
                        🇺🇸 Dólares ($USD)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                      Monto a Entregar *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-black text-gray-400 text-sm">
                        {moneda === 'NIO' ? 'C$' : '$'}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={monto}
                        onChange={e => setMonto(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border rounded-xl font-black text-gray-800 text-lg focus:ring-2 focus:ring-rose-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Si es Dólares, mostrar Tipo de Cambio y Conversión */}
                {moneda === 'USD' && (
                  <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-900">T/C (C$ x $1):</span>
                      <input
                        type="number"
                        step="0.01"
                        value={tipoCambio}
                        onChange={e => setTipoCambio(e.target.value)}
                        className="w-16 p-1 border rounded bg-white font-bold text-center"
                      />
                    </div>
                    <div className="font-bold text-emerald-900">
                      Equivalente: <span className="font-black text-base font-mono">C$ {montoCordobas.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Autorización y Receptor */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                      Autorizado por *
                    </label>
                    <input
                      type="text"
                      required
                      value={autorizadoPor}
                      onChange={e => setAutorizadoPor(e.target.value)}
                      placeholder="Ej: Gerencia General / Don Mingo"
                      className="w-full p-2.5 border rounded-xl text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                      Recibido por (Firma receptora) *
                    </label>
                    <input
                      type="text"
                      required
                      value={recibidoPor}
                      onChange={e => setRecibidoPor(e.target.value)}
                      placeholder="Ej: Santos Rayo (Propietario)"
                      className="w-full p-2.5 border rounded-xl text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {/* Motivo o Justificación */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">
                    Motivo / Justificación *
                  </label>
                  <textarea
                    rows="2"
                    required
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    placeholder="Ej: Entrega parcial del efectivo de la mañana solicitado por gerencia para resguardo en banco..."
                    className="w-full p-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                </div>

                {/* Acciones */}
                <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-100 text-sm transition-colors"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || numMonto <= 0}
                    className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-lg shadow-rose-200 flex items-center gap-2 transition-all active:scale-95 disabled:bg-gray-300"
                  >
                    <ArrowUpRight size={18} />
                    {loading ? 'Registrando...' : 'Registrar Salida de Efectivo'}
                  </button>
                </div>

              </form>
            ) : (
              /* HISTORIAL DE MOVIMIENTOS EN ESTE TURNO */
              <div className="p-4 sm:p-6 space-y-3 overflow-y-auto flex-1">
                {movimientosList.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">
                    No se han registrado salidas de efectivo en este turno.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 border rounded-2xl overflow-hidden bg-white">
                    {movimientosList.map((m) => (
                      <div key={m.id} className="p-3.5 hover:bg-gray-50 transition-colors space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                            {m.tipo}
                          </span>
                          <span className="text-sm font-black text-rose-700 font-mono">
                            - C$ {Number(m.monto_cordobas || m.monto).toFixed(2)}
                            {m.moneda === 'USD' && (
                              <span className="text-xs text-gray-500 font-normal ml-1">(${m.monto} USD)</span>
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 italic">"{m.motivo}"</p>
                        <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                          <span>
                            Recibió: <strong className="text-gray-700">{m.recibido_por}</strong> (Aut: {m.autorizado_por})
                          </span>
                          <div className="flex items-center gap-2">
                            <span>{new Date(m.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <button
                              type="button"
                              onClick={() => setPrintedMovement(m)}
                              className="text-blue-600 hover:text-blue-800 font-bold p-1 hover:bg-blue-50 rounded"
                              title="Reimprimir Vale de Entrega"
                            >
                              <Printer size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL PARA REVISAR E IMPRIMIR EL COMPROBANTE DE RETIRO */}
      {printedMovement && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0 no-print print:hidden">
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full">
                Vale de Entrega Generado
              </span>
              <button onClick={() => setPrintedMovement(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none">&times;</button>
            </div>

            <div className="p-4 overflow-y-auto bg-gray-100 flex-1 flex justify-center">
              <CashTicketPrinter data={printedMovement} type="salida" isPreview={true} />
            </div>

            <div className="p-3 sm:p-4 bg-white border-t border-gray-100 space-y-2 shrink-0 no-print print:hidden">
              <button
                type="button"
                onClick={handlePrint}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-rose-200 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Printer size={18} />
                Imprimir Vale Térmico (Firma Gerencia)
              </button>
              <button
                type="button"
                onClick={() => setPrintedMovement(null)}
                className="w-full text-gray-500 font-bold hover:bg-gray-100 py-2 rounded-xl text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>

            <div className="hidden">
              <CashTicketPrinter ref={printRef} data={printedMovement} type="salida" isPreview={false} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
