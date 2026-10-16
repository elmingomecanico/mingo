import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { BarChart2, DollarSign, ShoppingBag, Calendar, FileText, Lock, Printer, ArrowUpRight, CheckCircle2, AlertTriangle, Eye, X, Store, Trash2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import CashTicketPrinter from '../components/CashTicketPrinter';
import ReporteGerencialCajas from '../components/reportes/ReporteGerencialCajas';
import { useAuth } from '../context/AuthContext';
import { reverseAndDeleteSale } from '../utils/integrityService';

export default function Reportes() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('gerencial'); // 'gerencial' | 'ventas' | 'cierres'
  const [ventas, setVentas] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroSucursal, setFiltroSucursal] = useState('Todas');

  // Para reimprimir acta de cierre
  const [selectedTurnoPrint, setSelectedTurnoPrint] = useState(null);
  const printRef = useRef();
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Acta_Cierre_${selectedTurnoPrint?.numero_turno || 'POS'}`,
    pageStyle: `@page { size: 80mm auto; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; } }`
  });

  const handleDeleteVenta = async (venta) => {
    const num = venta.numero_factura || venta.id;
    if (!window.confirm(`¿Estás seguro de anular/eliminar la factura ${num}?\n\nEsta acción ejecutará una reversión completa en cascada:\n• Devolverá el stock físico de los repuestos vendidos a la bodega\n• Registrará la entrada por anulación en el Kardex\n• Eliminará la Cuenta por Cobrar (CxC), Orden de Trabajo (OT) o Deuda de Empleado asociada\n• Revertirá el ingreso en el turno de caja o cuenta bancaria.`)) {
      return;
    }
    const toastId = toast.loading(`Anulando venta ${num} y revirtiendo registros...`);
    try {
      await reverseAndDeleteSale(venta, user?.nombre_completo || 'SuperAdmin');
      toast.success(`Venta ${num} anulada y stock/saldos revertidos con éxito`, { id: toastId });
    } catch (err) {
      toast.error('Error al anular venta: ' + err.message, { id: toastId });
    }
  };

  const handleDeleteTurno = async (turno) => {
    const num = turno.numero_turno || turno.id;
    if (!window.confirm(`¿Estás seguro de eliminar el registro de turno de caja ${num}? Se eliminará el acta de arqueo.`)) {
      return;
    }
    try {
      await remove(ref(rtdb, `turnos_caja/${turno.id}`));
      toast.success(`Turno ${num} eliminado correctamente`);
    } catch (err) {
      toast.error('Error al eliminar turno: ' + err.message);
    }
  };

  useEffect(() => {
    const ventasRef = ref(rtdb, 'ventas');
    const turnosRef = ref(rtdb, 'turnos_caja');
    
    const unsubVentas = onValue(ventasRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsed = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        parsed.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setVentas(parsed);
      } else {
        setVentas([]);
      }
      setLoading(false);
    });

    const unsubTurnos = onValue(turnosRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsed = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        parsed.sort((a, b) => new Date(b.fecha_apertura) - new Date(a.fecha_apertura));
        setTurnos(parsed);
      } else {
        setTurnos([]);
      }
    });

    return () => {
      unsubVentas();
      unsubTurnos();
    };
  }, []);

  const filteredVentas = filtroSucursal === 'Todas' 
    ? ventas 
    : ventas.filter(v => v.sucursal === filtroSucursal);

  const filteredTurnos = filtroSucursal === 'Todas'
    ? turnos
    : turnos.filter(t => t.sucursal === filtroSucursal);

  // Cálculos de totales
  const totalIngresos = filteredVentas.reduce((sum, v) => sum + (v.total || 0), 0);
  const totalFacturas = filteredVentas.length;
  const hoy = new Date().toISOString().split('T')[0];
  const ventasHoy = filteredVentas.filter(v => v.fecha && v.fecha.startsWith(hoy));
  const ingresosHoy = ventasHoy.reduce((sum, v) => sum + (v.total || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Encabezado y Selector de Sucursal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <BarChart2 className="text-amber-500" /> 
            Reportes, Ventas y Cierres de Caja
          </h1>
          <p className="text-gray-500 text-sm">Resumen de ingresos, facturas y auditoría de turnos de caja.</p>
        </div>
        
        <select 
          value={filtroSucursal}
          onChange={(e) => setFiltroSucursal(e.target.value)}
          className="border-gray-200 bg-white border p-2.5 rounded-xl font-bold text-sm text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="Todas">Todas las Sucursales</option>
          <option value="SUC-01">Sucursal Principal (SUC-01)</option>
          <option value="SUC-02">Sucursal Norte (SUC-02)</option>
        </select>
      </div>

      {/* Pestañas: Monitor Gerencial vs Facturas vs Cierres de Caja */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('gerencial')}
          className={`pb-3 px-4 font-black text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'gerencial'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Store size={18} />
          Monitor Gerencial de Cajas (Tiempo Real)
        </button>

        <button
          onClick={() => setActiveTab('ventas')}
          className={`pb-3 px-4 font-black text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'ventas'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShoppingBag size={18} />
          Facturación y Ventas ({filteredVentas.length})
        </button>

        <button
          onClick={() => setActiveTab('cierres')}
          className={`pb-3 px-4 font-black text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'cierres'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Lock size={18} />
          Auditoría de Cierres de Caja ({filteredTurnos.length})
        </button>
      </div>

      {/* CONTENIDO SEGÚN LA PESTAÑA */}
      {activeTab === 'gerencial' && (
        <ReporteGerencialCajas user={user} />
      )}

      {/* Tarjetas de Métricas para Historial de Ventas y Cierres */}
      {activeTab !== 'gerencial' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col justify-between gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <p className="text-gray-500 font-bold text-xs uppercase tracking-wider">Ingresos de Hoy</p>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 shrink-0">
                <DollarSign size={22} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="text-xl sm:text-2xl font-black text-gray-800 break-words leading-tight">
                C$ {ingresosHoy.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col justify-between gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <p className="text-gray-500 font-bold text-xs uppercase tracking-wider">Facturas Emitidas Hoy</p>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 shrink-0">
                <ShoppingBag size={22} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="text-xl sm:text-2xl font-black text-gray-800 break-words leading-tight">
                {ventasHoy.length}
              </h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col justify-between gap-3 hover:shadow-md transition-shadow sm:col-span-2 md:col-span-1">
            <div className="flex items-center justify-between">
              <p className="text-gray-500 font-bold text-xs uppercase tracking-wider">Total Facturado Histórico</p>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 shrink-0">
                <FileText size={22} />
              </div>
            </div>
            <div className="mt-1">
              <h3 className="text-xl sm:text-2xl font-black text-gray-800 break-words leading-tight">
                C$ {totalIngresos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ventas' && (
        /* Historial de Ventas */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
            <Calendar size={18} className="text-gray-500" />
            <h2 className="font-bold text-gray-700">Historial de Facturas Emitidas</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-4">Factura</th>
                  <th className="p-4">Fecha y Hora</th>
                  <th className="p-4">Turno</th>
                  <th className="p-4">Sucursal</th>
                  <th className="p-4">Método</th>
                  <th className="p-4">Productos / Servicios</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-gray-400">Cargando reporte de ventas...</td>
                  </tr>
                ) : filteredVentas.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-gray-400">No hay ventas registradas.</td>
                  </tr>
                ) : (
                  filteredVentas.map(venta => {
                    const date = new Date(venta.fecha);
                    const itemsSummary = venta.items 
                      ? venta.items.map(i => `${i.cantidad}x ${i.name || 'Prod'}`).join(', ')
                      : 'Sin detalles';
                    
                    return (
                      <tr key={venta.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-mono font-bold text-gray-800">
                          {venta.numero_factura || venta.id.substring(venta.id.length - 6).toUpperCase()}
                        </td>
                        <td className="p-4 text-gray-700">{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-4">
                          {venta.numero_turno ? (
                            <span className="font-mono text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold">
                              {venta.numero_turno}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="p-4 text-gray-600">
                          <span className="bg-gray-100 px-2 py-1 rounded text-xs font-semibold">{venta.sucursal}</span>
                        </td>
                        <td className="p-4 text-gray-700 font-semibold text-xs">
                          {venta.metodo_pago || 'Efectivo'}
                        </td>
                        <td className="p-4 text-gray-600 break-words max-w-xs" title={itemsSummary}>
                          {itemsSummary}
                        </td>
                        <td className="p-4 text-right font-black text-blue-700 font-mono">
                          C$ {Number(venta.total || 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs bg-emerald-100 text-emerald-800">
                            {venta.estado || 'Completado'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleDeleteVenta(venta)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Anular / Eliminar Venta de prueba"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'cierres' && (
        /* PESTAÑA: HISTORIAL Y AUDITORÍA DE CIERRES DE CAJA */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-amber-600" />
              <h2 className="font-bold text-gray-700">Actas de Arqueo y Turnos de Caja Registrados</h2>
            </div>
            <span className="text-xs text-gray-500 font-bold">
              Total Turnos: {filteredTurnos.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-4">Turno</th>
                  <th className="p-4">Apertura / Cierre</th>
                  <th className="p-4">Cajero</th>
                  <th className="p-4">Sucursal</th>
                  <th className="p-4 text-right">Fondo Inicial</th>
                  <th className="p-4 text-right">Ventas Efectivo</th>
                  <th className="p-4 text-right">Salidas Gerencia</th>
                  <th className="p-4 text-right">Efectivo Teórico</th>
                  <th className="p-4 text-right">Físico Contado</th>
                  <th className="p-4 text-center">Cuadre / Dif</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTurnos.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="p-8 text-center text-gray-400">
                      No hay turnos de caja registrados para esta sucursal.
                    </td>
                  </tr>
                ) : (
                  filteredTurnos.map(turno => {
                    const dif = Number(turno.diferencia_cordobas || 0);
                    const isClosed = turno.estado === 'Cerrada';

                    return (
                      <tr key={turno.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-mono font-black text-gray-800">
                          {turno.numero_turno || turno.id.substring(0, 8)}
                        </td>
                        <td className="p-4 text-xs text-gray-600">
                          <div>
                            <strong>Ap:</strong> {turno.fecha_apertura ? new Date(turno.fecha_apertura).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                          </div>
                          {turno.fecha_cierre && (
                            <div className="text-gray-400">
                              <strong>Ci:</strong> {new Date(turno.fecha_cierre).toLocaleString('es-NI', { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-xs font-bold text-gray-800 break-words max-w-[140px]">
                          {turno.cajero_nombre || 'Cajero'}
                        </td>
                        <td className="p-4 text-gray-600">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-semibold">{turno.sucursal}</span>
                        </td>
                        <td className="p-4 text-right font-mono text-xs text-gray-700">
                          C$ {Number(turno.total_inicial_cordobas || 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-mono text-xs font-bold text-emerald-700">
                          + C$ {Number(turno.total_ventas_efectivo || 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-mono text-xs font-bold text-rose-700">
                          - C$ {Number(turno.total_salidas_efectivo || 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-mono text-xs font-bold text-slate-800">
                          C$ {Number(turno.efectivo_esperado_cordobas || (Number(turno.total_inicial_cordobas || 0) + Number(turno.total_ventas_efectivo || 0) - Number(turno.total_salidas_efectivo || 0))).toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-mono text-xs font-black text-blue-900">
                          {isClosed ? `C$ ${Number(turno.total_contado_cordobas || 0).toFixed(2)}` : 'En curso'}
                        </td>
                        <td className="p-4 text-center">
                          {!isClosed ? (
                            <span className="text-xs text-gray-400 italic">Abierta</span>
                          ) : Math.abs(dif) < 0.01 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-800">
                              ✓ Exacto
                            </span>
                          ) : dif > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] bg-blue-100 text-blue-800 font-mono">
                              +{dif.toFixed(2)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold text-[11px] bg-rose-100 text-rose-800 font-mono">
                              -{Math.abs(dif).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs ${
                            isClosed ? 'bg-gray-100 text-gray-800' : 'bg-emerald-100 text-emerald-800 animate-pulse'
                          }`}>
                            {turno.estado || 'Abierta'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isClosed && (
                              <button
                                type="button"
                                onClick={() => setSelectedTurnoPrint(turno)}
                                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                title="Ver y reimprimir Acta de Cierre"
                              >
                                <Printer size={13} />
                                Acta
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteTurno(turno)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar turno de caja de prueba"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL PARA REIMPRIMIR ACTA DE CIERRE */}
      {selectedTurnoPrint && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-full">
                Acta de Cierre: {selectedTurnoPrint.numero_turno}
              </span>
              <button onClick={() => setSelectedTurnoPrint(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none">&times;</button>
            </div>

            <div className="p-4 overflow-y-auto bg-gray-100 flex-1 flex justify-center">
              <CashTicketPrinter data={selectedTurnoPrint} type="cierre" isPreview={true} />
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
                onClick={() => setSelectedTurnoPrint(null)}
                className="w-full text-gray-500 font-bold hover:bg-gray-100 py-2 rounded-xl text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>

            <div className="hidden">
              <CashTicketPrinter ref={printRef} data={selectedTurnoPrint} type="cierre" isPreview={false} />
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
