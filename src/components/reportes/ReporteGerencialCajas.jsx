import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../../firebase';
import { 
  Store, Wrench, DollarSign, ArrowUpRight, TrendingUp, 
  Package, Calendar, CheckCircle2, Clock, AlertCircle, 
  User, RefreshCw, Layers, ShieldCheck, ChevronRight, X, ExternalLink
} from 'lucide-react';

export default function ReporteGerencialCajas({ user }) {
  const [cajas, setCajas] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [ordenesTrabajo, setOrdenesTrabajo] = useState([]);
  const [mecanicos, setMecanicos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date().toISOString().split('T')[0]);
  const [filtroSucursal, setFiltroSucursal] = useState('Todas');

  // Modal para detalle de gastos/salidas de una caja
  const [selectedCajaGastos, setSelectedCajaGastos] = useState(null);
  // Modal para detalle de servicios de un mecánico
  const [selectedMecanicoDetalle, setSelectedMecanicoDetalle] = useState(null);

  useEffect(() => {
    const cajasRef = ref(rtdb, 'configuracion/cajas');
    const turnosRef = ref(rtdb, 'turnos_caja');
    const ventasRef = ref(rtdb, 'ventas');
    const movRef = ref(rtdb, 'movimientos_caja');
    const otRef = ref(rtdb, 'ordenes_trabajo');
    const usrRef = ref(rtdb, 'usuarios');
    const sucRef = ref(rtdb, 'configuracion/sucursales');

    const unsubCajas = onValue(cajasRef, snap => {
      if (snap.exists()) {
        const val = snap.val();
        setCajas(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      } else {
        setCajas([]);
      }
    });

    const unsubTurnos = onValue(turnosRef, snap => {
      if (snap.exists()) {
        const val = snap.val();
        setTurnos(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      } else {
        setTurnos([]);
      }
    });

    const unsubVentas = onValue(ventasRef, snap => {
      if (snap.exists()) {
        const val = snap.val();
        setVentas(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      } else {
        setVentas([]);
      }
      setLoading(false);
    });

    const unsubMov = onValue(movRef, snap => {
      if (snap.exists()) {
        const val = snap.val();
        setMovimientos(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      } else {
        setMovimientos([]);
      }
    });

    const unsubOT = onValue(otRef, snap => {
      if (snap.exists()) {
        const val = snap.val();
        setOrdenesTrabajo(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      } else {
        setOrdenesTrabajo([]);
      }
    });

    const unsubUsr = onValue(usrRef, snap => {
      if (snap.exists()) {
        const val = snap.val();
        const mecs = Object.keys(val).map(k => ({ id: k, ...val[k] }))
          .filter(u => u.funcion === 'Mecánico' || u.rol === 'Mecánico');
        setMecanicos(mecs);
      } else {
        setMecanicos([]);
      }
    });

    const unsubSuc = onValue(sucRef, snap => {
      if (snap.exists()) {
        const val = snap.val();
        setSucursales(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      } else {
        setSucursales([]);
      }
    });

    return () => {
      unsubCajas();
      unsubTurnos();
      unsubVentas();
      unsubMov();
      unsubOT();
      unsubUsr();
      unsubSuc();
    };
  }, []);

  // Filtrar datos según fecha y sucursal
  const isFechaCoincide = (isoString) => {
    if (!isoString) return false;
    return isoString.startsWith(fechaSeleccionada);
  };

  const ventasDelDia = ventas.filter(v => {
    const matchFecha = isFechaCoincide(v.fecha);
    const matchSuc = filtroSucursal === 'Todas' || v.sucursal === filtroSucursal;
    return matchFecha && matchSuc;
  });

  const turnosDelDia = turnos.filter(t => {
    const matchFecha = isFechaCoincide(t.fecha_apertura);
    const matchSuc = filtroSucursal === 'Todas' || t.sucursal === filtroSucursal;
    return matchFecha && matchSuc;
  });

  const movimientosDelDia = movimientos.filter(m => {
    const matchFecha = isFechaCoincide(m.fecha);
    const matchSuc = filtroSucursal === 'Todas' || m.sucursal === filtroSucursal;
    return matchFecha && matchSuc;
  });

  const ordenesDelDia = ordenesTrabajo.filter(ot => {
    const matchFecha = isFechaCoincide(ot.fecha_creacion);
    const matchSuc = filtroSucursal === 'Todas' || ot.sucursal === filtroSucursal;
    return matchFecha && matchSuc;
  });

  // Lista de cajas filtradas por sucursal
  const cajasFiltradas = cajas.filter(c => {
    if (filtroSucursal === 'Todas') return true;
    return c.sucursal === filtroSucursal;
  });

  // Agregación de Métricas por Caja
  const cajasReportData = cajasFiltradas.map(caja => {
    // Buscar turno activo en vivo de esta caja
    const turnoActivo = turnos.find(t => t.id_caja === caja.id && t.estado === 'Abierta');
    
    // Si no hay turno abierto, buscar el turno más reciente de esta fecha
    const turnosDeEstaCaja = turnosDelDia.filter(t => t.id_caja === caja.id);
    const ultimoTurno = turnoActivo || (turnosDeEstaCaja.length > 0 ? turnosDeEstaCaja[0] : null);

    const isLive = Boolean(turnoActivo);
    const estadoCaja = isLive ? 'Activa' : (caja.estado === 'Inactiva' ? 'Inactiva' : 'Cerrada');

    // Ventas de esta caja en el día (o en el turno activo)
    const ventasCaja = ventasDelDia.filter(v => {
      if (v.id_caja) return v.id_caja === caja.id;
      if (ultimoTurno?.id && v.id_turno === ultimoTurno.id) return true;
      return false;
    });

    const montoApertura = Number(ultimoTurno?.total_inicial_cordobas || 0);
    const aperturaNio = Number(ultimoTurno?.monto_inicial_cordobas || 0);
    const aperturaUsd = Number(ultimoTurno?.monto_inicial_dolares || 0);

    // Desglose de ventas por productos vs servicios
    let totalProductos = 0;
    let totalServicios = 0;
    let totalFacturado = 0;

    let efectivoCobrado = 0;
    let tarjetaCobrado = 0;
    let transferenciaCobrado = 0;
    let creditoCobrado = 0;

    ventasCaja.forEach(v => {
      const vTot = Number(v.total || 0);
      totalFacturado += vTot;

      if (v.total_productos !== undefined && v.total_servicios !== undefined) {
        totalProductos += Number(v.total_productos || 0);
        totalServicios += Number(v.total_servicios || 0);
      } else if (v.items && Array.isArray(v.items)) {
        v.items.forEach(it => {
          const itTot = Number(it.subtotal || (it.price * it.qty) || 0);
          if (it.type === 'servicio') {
            totalServicios += itTot;
          } else {
            totalProductos += itTot;
          }
        });
      } else {
        totalProductos += vTot;
      }

      const mp = (v.metodo_pago || '').toLowerCase();
      if (mp === 'efectivo') efectivoCobrado += vTot;
      else if (mp.includes('tarjeta')) tarjetaCobrado += vTot;
      else if (mp.includes('transferencia')) transferenciaCobrado += vTot;
      else if (mp.includes('crédito') || mp.includes('credito')) creditoCobrado += vTot;
      else efectivoCobrado += vTot;
    });

    // Salidas / Gastos de esta caja
    const salidasCaja = movimientosDelDia.filter(m => {
      if (ultimoTurno?.id && m.id_turno === ultimoTurno.id) return true;
      return false;
    });

    const totalGastosSalidas = salidasCaja.reduce((sum, m) => sum + Number(m.monto_cordobas || m.monto || 0), 0);

    // Efectivo Teórico en Caja
    const efectivoTeoricoEnCaja = (montoApertura + efectivoCobrado) - totalGastosSalidas;

    return {
      caja,
      turno: ultimoTurno,
      isLive,
      estadoCaja,
      cajero: ultimoTurno?.cajero_nombre || caja.usuario_asignado_nombre || 'Sin Asignar',
      montoApertura,
      aperturaNio,
      aperturaUsd,
      ventasCount: ventasCaja.length,
      totalFacturado,
      totalProductos,
      totalServicios,
      efectivoCobrado,
      tarjetaCobrado,
      transferenciaCobrado,
      creditoCobrado,
      totalGastosSalidas,
      salidasList: salidasCaja,
      efectivoTeoricoEnCaja
    };
  });

  // Métricas Globales Gerenciales
  const totalCajasActivas = cajasReportData.filter(c => c.isLive).length;
  const totalCajasCerradas = cajasReportData.filter(c => !c.isLive).length;
  const granTotalAperturas = cajasReportData.reduce((sum, c) => sum + c.montoApertura, 0);
  const granTotalProductos = cajasReportData.reduce((sum, c) => sum + c.totalProductos, 0);
  const granTotalServicios = cajasReportData.reduce((sum, c) => sum + c.totalServicios, 0);
  const granTotalVentas = granTotalProductos + granTotalServicios;
  const granTotalGastosSalidas = cajasReportData.reduce((sum, c) => sum + c.totalGastosSalidas, 0);
  const granTotalEfectivoEnCajas = cajasReportData.reduce((sum, c) => sum + c.efectivoTeoricoEnCaja, 0);

  // Rendimiento de Mecánicos en el Día
  // Agrupar órdenes de trabajo por mecánico
  const mecanicosReport = mecanicos.map(mec => {
    const ordenesDelMec = ordenesDelDia.filter(ot => ot.id_mecanico === mec.id);
    const ordenesListas = ordenesDelMec.filter(ot => ot.estado === 'Listo' || ot.estado === 'Completado');
    const ordenesEnProceso = ordenesDelMec.filter(ot => ot.estado === 'En Proceso' || ot.estado === 'Pendiente');

    const totalLaborFacturada = ordenesDelMec.reduce((sum, ot) => sum + Number(ot.total_servicios || 0), 0);
    const comisionPorcentaje = Number(mec.porcentaje_comision || 50);

    const totalComisionGenerada = ordenesListas.reduce((sum, ot) => {
      const com = Number(ot.comision_mecanico_monto) || 
        (Number(ot.total_servicios || 0) * (Number(ot.comision_mecanico_porcentaje || comisionPorcentaje) / 100));
      return sum + com;
    }, 0);

    const totalComisionEstimada = ordenesEnProceso.reduce((sum, ot) => {
      const com = Number(ot.comision_mecanico_monto) || 
        (Number(ot.total_servicios || 0) * (Number(ot.comision_mecanico_porcentaje || comisionPorcentaje) / 100));
      return sum + com;
    }, 0);

    return {
      mecanico: mec,
      totalOrdenes: ordenesDelMec.length,
      completadas: ordenesListas.length,
      enProceso: ordenesEnProceso.length,
      totalLaborFacturada,
      comisionPorcentaje,
      totalComisionGenerada,
      totalComisionEstimada,
      ordenes: ordenesDelMec
    };
  }).filter(m => m.totalOrdenes > 0 || m.mecanico.estado === 'Activo');

  // Ordenar mecánicos por comisiones generadas descendente
  mecanicosReport.sort((a, b) => b.totalComisionGenerada - a.totalComisionGenerada);

  const totalComisionesMecanicosHoy = mecanicosReport.reduce((sum, m) => sum + m.totalComisionGenerada, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* BARRA DE FILTROS Y ESTADO DE TIEMPO REAL */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Store size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-gray-800">Monitor Gerencial de Cajas en Vivo</h2>
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                Tiempo Real
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Control simultáneo de terminales físicas, aperturas, ingresos desglosados y comisiones operativas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Fecha de Consulta</label>
            <input 
              type="date"
              value={fechaSeleccionada}
              onChange={e => setFechaSeleccionada(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Sucursal</label>
            <select
              value={filtroSucursal}
              onChange={e => setFiltroSucursal(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Todas">Todas las Sucursales</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id}>{s.nombre} ({s.id})</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setFechaSeleccionada(new Date().toISOString().split('T')[0])}
            className="mt-4 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Volver al día de hoy"
          >
            <RefreshCw size={14} /> Hoy
          </button>
        </div>
      </div>

      {/* METRICAS CONSOLIDADAS DEL DÍA */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Cajas Activas */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Cajas Activas</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl"><Store size={16} /></span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-600">{totalCajasActivas}</span>
              <span className="text-xs text-gray-400 font-bold">/ {cajasReportData.length}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-medium block mt-0.5">{totalCajasCerradas} cerradas / inactivas</span>
          </div>
        </div>

        {/* Fondos Iniciales */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Fondo Inicial Total</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-xl"><DollarSign size={16} /></span>
          </div>
          <div className="mt-2">
            <span className="text-lg font-black text-gray-800 block">C$ {granTotalAperturas.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-gray-400 font-medium block mt-0.5">Efectivo base de apertura</span>
          </div>
        </div>

        {/* Ventas en Productos */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Ventas Productos</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-xl"><Package size={16} /></span>
          </div>
          <div className="mt-2">
            <span className="text-lg font-black text-amber-700 block">C$ {granTotalProductos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-gray-400 font-medium block mt-0.5">Repuestos e insumos</span>
          </div>
        </div>

        {/* Ventas en Servicios */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Ventas Servicios</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-xl"><Wrench size={16} /></span>
          </div>
          <div className="mt-2">
            <span className="text-lg font-black text-indigo-700 block">C$ {granTotalServicios.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-gray-400 font-medium block mt-0.5">Mano de obra taller</span>
          </div>
        </div>

        {/* Salidas / Gastos */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Gastos / Salidas</span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-xl"><ArrowUpRight size={16} /></span>
          </div>
          <div className="mt-2">
            <span className="text-lg font-black text-rose-600 block">C$ {granTotalGastosSalidas.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-gray-400 font-medium block mt-0.5">Egresos de mostrador</span>
          </div>
        </div>

        {/* Efectivo Teórico en Cajas */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-md flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider">Efectivo en Cajas</span>
            <span className="p-1.5 bg-white/20 text-white rounded-xl"><TrendingUp size={16} /></span>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-white block">C$ {granTotalEfectivoEnCajas.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-emerald-200 block mt-0.5">Saldo físico teórico actual</span>
          </div>
        </div>
      </div>

      {/* SECCIÓN 1: MONITOR DETALLADO DE CADA CAJA REGISTRADORA */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
              <Store className="text-blue-600" size={20} />
              Terminales de Caja Registradora
            </h3>
            <p className="text-xs text-gray-500">
              Estado operativo en vivo, fondo de apertura, ingresos desglosados y salidas por terminal.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400 text-sm">
            Cargando estado de cajas...
          </div>
        ) : cajasReportData.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400 text-sm">
            No hay cajas registradas para esta sucursal.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {cajasReportData.map(({ caja, turno, isLive, estadoCaja, cajero, montoApertura, aperturaNio, aperturaUsd, ventasCount, totalFacturado, totalProductos, totalServicios, efectivoCobrado, tarjetaCobrado, transferenciaCobrado, creditoCobrado, totalGastosSalidas, salidasList, efectivoTeoricoEnCaja }) => (
              <div 
                key={caja.id} 
                className={`bg-white rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                  isLive 
                    ? 'border-emerald-200 ring-2 ring-emerald-500/20' 
                    : 'border-gray-200'
                }`}
              >
                <div>
                  {/* Encabezado de la Caja */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-gray-800">{caja.codigo}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                          {caja.sucursal}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-gray-600 mt-0.5">{caja.nombre}</h4>
                    </div>

                    <div>
                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                          EN TURNO (ABIERTA)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                          <Clock size={12} /> CERRADA
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info Cajero y Turno */}
                  <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 mb-4 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-bold uppercase text-[10px]">Cajero Operativo:</span>
                      <strong className="text-gray-800">{cajero}</strong>
                    </div>
                    {turno && (
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-bold uppercase text-[10px]">Turno Actual:</span>
                        <span className="font-mono font-bold text-blue-600">{turno.numero_turno}</span>
                      </div>
                    )}
                    {turno?.fecha_apertura && (
                      <div className="flex justify-between">
                        <span className="text-gray-400 font-bold uppercase text-[10px]">Hora de Apertura:</span>
                        <span className="text-gray-600 font-medium">
                          {new Date(turno.fecha_apertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* BLOQUE: CON CUANTO ABRIÓ */}
                  <div className="mb-4 bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block mb-1">
                      Fondo Inicial de Apertura
                    </span>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xl font-black text-blue-900">
                        C$ {montoApertura.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <div className="text-[11px] text-blue-700 text-right">
                        <span>C$ {aperturaNio.toFixed(2)}</span>
                        {aperturaUsd > 0 && <span className="block">+ ${aperturaUsd.toFixed(2)} USD</span>}
                      </div>
                    </div>
                  </div>

                  {/* BLOQUE: CUANTO HA GENERADO (PRODUCTOS VS SERVICIOS) */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-500 uppercase text-[10px]">Ingresos del Día</span>
                      <span className="font-bold text-gray-400">{ventasCount} Facturas</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-100">
                        <span className="text-[10px] font-bold text-amber-800 block">📦 Productos</span>
                        <span className="text-sm font-black text-amber-900 block mt-0.5">
                          C$ {totalProductos.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="bg-indigo-50/80 p-2.5 rounded-xl border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-800 block">🔧 Servicios (Taller)</span>
                        <span className="text-sm font-black text-indigo-900 block mt-0.5">
                          C$ {totalServicios.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl text-xs">
                      <span className="font-bold text-gray-700">Total Facturado en Caja:</span>
                      <strong className="text-sm font-black text-gray-900">
                        C$ {totalFacturado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </div>

                    {/* Desglose por métodos de pago */}
                    <div className="grid grid-cols-4 gap-1 text-[10px] pt-1">
                      <div className="bg-gray-100/70 p-1.5 rounded-lg text-center">
                        <span className="block text-gray-400 font-bold uppercase">Efectivo</span>
                        <span className="font-black text-gray-700">C${efectivoCobrado.toFixed(0)}</span>
                      </div>
                      <div className="bg-gray-100/70 p-1.5 rounded-lg text-center">
                        <span className="block text-gray-400 font-bold uppercase">Tarjeta</span>
                        <span className="font-black text-gray-700">C${tarjetaCobrado.toFixed(0)}</span>
                      </div>
                      <div className="bg-gray-100/70 p-1.5 rounded-lg text-center">
                        <span className="block text-gray-400 font-bold uppercase">Transf.</span>
                        <span className="font-black text-gray-700">C${transferenciaCobrado.toFixed(0)}</span>
                      </div>
                      <div className="bg-gray-100/70 p-1.5 rounded-lg text-center">
                        <span className="block text-gray-400 font-bold uppercase">Crédito</span>
                        <span className="font-black text-gray-700">C${creditoCobrado.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* BLOQUE: SALIDAS / GASTOS DE ESTA CAJA */}
                  <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-100 mb-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1">
                        <ArrowUpRight size={13} /> Salidas / Gastos
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedCajaGastos({ caja, salidasList, totalGastosSalidas })}
                        className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline"
                      >
                        Ver Detalle ({salidasList.length})
                      </button>
                    </div>
                    <div className="mt-1 flex justify-between items-baseline">
                      <span className="text-base font-black text-rose-700">
                        C$ {totalGastosSalidas.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-rose-600">
                        {salidasList.length} retiros registrados
                      </span>
                    </div>
                  </div>
                </div>

                {/* EFECTIVO TEORICO ACTUAL */}
                <div className="pt-3 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 -mx-5 -mb-5 p-4 rounded-b-2xl">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">Efectivo Teórico en Gaveta</span>
                    <span className="text-xs text-gray-500">(Fondo + Efectivo - Gastos)</span>
                  </div>
                  <span className="text-lg font-black text-emerald-700">
                    C$ {efectivoTeoricoEnCaja.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECCIÓN 2: MECÁNICOS QUE HAN REALIZADO SERVICIOS Y COMISIONES DEL DÍA */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
              <Wrench className="text-indigo-600" size={20} />
              Servicios y Comisiones de Mecánicos en el Día
            </h3>
            <p className="text-xs text-gray-500">
              Mano de obra ejecutada, órdenes finalizadas y comisión generada por cada mecánico.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
            <span>Total Comisiones Hoy:</span>
            <strong className="text-sm font-black text-emerald-700">
              C$ {totalComisionesMecanicosHoy.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
        </div>

        {mecanicosReport.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No se han registrado órdenes de trabajo de mecánicos para esta fecha.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-bold text-xs uppercase border-b border-gray-100">
                <tr>
                  <th className="p-3">Mecánico</th>
                  <th className="p-3 text-center">Trabajos Hoy</th>
                  <th className="p-3 text-right">Mano de Obra Facturada</th>
                  <th className="p-3 text-center">% Comisión</th>
                  <th className="p-3 text-right text-emerald-700 font-black">Comisión Ganada (C$)</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mecanicosReport.map(({ mecanico, totalOrdenes, completadas, enProceso, totalLaborFacturada, comisionPorcentaje, totalComisionGenerada, totalComisionEstimada, ordenes }) => (
                  <tr key={mecanico.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs">
                          {mecanico.nombre_completo?.charAt(0) || 'M'}
                        </div>
                        <div>
                          <span className="font-bold text-gray-800 block">{mecanico.nombre_completo}</span>
                          <span className="text-[11px] text-gray-400">Sucursal: {mecanico.id_sucursal || 'SUC-01'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200" title="Completadas / Listas">
                          ✓ {completadas}
                        </span>
                        {enProceso > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200" title="En Proceso / Pendientes">
                            ⏳ {enProceso}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 text-right font-black text-gray-800">
                      C$ {totalLaborFacturada.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="p-3 text-center font-bold text-gray-600">
                      <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs">
                        {comisionPorcentaje}%
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <div className="font-black text-emerald-700 text-base">
                        C$ {totalComisionGenerada.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {totalComisionEstimada > 0 && (
                        <div className="text-[10px] text-blue-600 font-medium">
                          + C$ {totalComisionEstimada.toFixed(2)} en proceso
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedMecanicoDetalle({ mecanico, ordenes, totalLaborFacturada, totalComisionGenerada })}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
                      >
                        <ExternalLink size={13} />
                        Detalle de OTs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DETALLE DE SALIDAS / GASTOS DE CAJA */}
      {selectedCajaGastos && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-rose-600 to-red-700 text-white">
              <div>
                <h3 className="font-black text-base sm:text-lg">Salidas de Efectivo y Gastos</h3>
                <p className="text-xs text-rose-100">
                  {selectedCajaGastos.caja.codigo} - {selectedCajaGastos.caja.nombre}
                </p>
              </div>
              <button 
                onClick={() => setSelectedCajaGastos(null)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
              <div className="flex justify-between items-center bg-rose-50 p-3 rounded-2xl border border-rose-100 text-rose-900 text-xs">
                <span className="font-bold">Total Retirado de Caja:</span>
                <strong className="text-base font-black">
                  C$ {selectedCajaGastos.totalGastosSalidas.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>

              {selectedCajaGastos.salidasList.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">
                  No hay salidas registradas en esta caja para la fecha seleccionada.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedCajaGastos.salidasList.map((mov, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs space-y-1">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-gray-800">{mov.motivo}</span>
                        <strong className="text-rose-600 font-black">
                          - C$ {Number(mov.monto_cordobas || mov.monto || 0).toFixed(2)}
                        </strong>
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200/50">
                        <span>Recibido por: <strong>{mov.recibido_por || 'N/A'}</strong></span>
                        <span>{new Date(mov.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {mov.autorizado_por && (
                        <div className="text-[10px] text-gray-400">
                          Autorizado por: {mov.autorizado_por}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedCajaGastos(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE TRABAJOS Y COMISIONES POR MECÁNICO */}
      {selectedMecanicoDetalle && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
              <div>
                <h3 className="font-black text-base sm:text-lg">
                  Órdenes de Trabajo de {selectedMecanicoDetalle.mecanico.nombre_completo}
                </h3>
                <p className="text-xs text-blue-100">
                  Esquema: {selectedMecanicoDetalle.mecanico.porcentaje_comision || 50}% de comisión sobre mano de obra
                </p>
              </div>
              <button 
                onClick={() => setSelectedMecanicoDetalle(null)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
              <div className="grid grid-cols-2 gap-3 bg-blue-50 p-3 rounded-2xl border border-blue-100 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">Total Mano de Obra</span>
                  <strong className="text-base font-black text-blue-950">
                    C$ {selectedMecanicoDetalle.totalLaborFacturada.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Comisión Ganada Acumulada</span>
                  <strong className="text-base font-black text-emerald-800">
                    C$ {selectedMecanicoDetalle.totalComisionGenerada.toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="space-y-2">
                {selectedMecanicoDetalle.ordenes.map(ot => {
                  const isDone = ot.estado === 'Listo' || ot.estado === 'Completado';
                  const com = Number(ot.comision_mecanico_monto) || 
                    (Number(ot.total_servicios || 0) * (Number(ot.comision_mecanico_porcentaje || 50) / 100));

                  return (
                    <div key={ot.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <strong className="text-gray-800">{ot.numero_factura}</strong>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {ot.estado}
                          </span>
                        </div>
                        <span className="font-black text-emerald-700">
                          Comisión: C$ {com.toFixed(2)}
                        </span>
                      </div>

                      {ot.nombre_cliente && (
                        <p className="text-[11px] text-gray-500">
                          Cliente: <strong>{ot.nombre_cliente}</strong>
                        </p>
                      )}

                      <div className="bg-white p-2 rounded-lg border border-gray-200/60 text-[11px] space-y-1">
                        {ot.servicios?.map((s, idx) => (
                          <div key={idx} className="flex justify-between text-gray-600">
                            <span>{s.cantidad}x {s.nombre}</span>
                            <span className="font-bold text-gray-800">C$ {Number(s.subtotal || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedMecanicoDetalle(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
