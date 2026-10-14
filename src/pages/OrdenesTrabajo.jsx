import React, { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { rtdb } from '../firebase';
import { Wrench, Clock, CheckCircle2, AlertCircle, User, FileText, DollarSign, Award, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function OrdenesTrabajo() {
  const { user } = useAuth();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [estadoFilter, setEstadoFilter] = useState('Todas');
  const [mecanicoFilter, setMecanicoFilter] = useState('Todos');

  // Catálogo de usuarios mecánicos para filtrar (solo útil para Admins)
  const [mecanicosDb, setMecanicosDb] = useState([]);

  useEffect(() => {
    // Si el usuario logueado es mecánico, auto-filtramos por su ID
    if (user.funcion === 'Mecánico') {
      setMecanicoFilter(user.id);
    }
  }, [user]);

  useEffect(() => {
    const otRef = ref(rtdb, 'ordenes_trabajo');
    const unsub = onValue(otRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        
        // Ordenar por fecha descendente
        parsed.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
        setOrdenes(parsed);
      } else {
        setOrdenes([]);
      }
      setLoading(false);
    });

    // Cargar mecánicos para el filtro
    const usersRef = ref(rtdb, 'usuarios');
    const unsubUsers = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const mecs = Object.keys(val).map(key => ({ id: key, ...val[key] }))
          .filter(u => u.funcion === 'Mecánico' && u.estado === 'Activo');
        setMecanicosDb(mecs);
      }
    });

    return () => {
      unsub();
      unsubUsers();
    };
  }, []);

  const changeEstado = async (id, nuevoEstado) => {
    try {
      const targetOt = ordenes.find(o => o.id === id);
      const comisionPorc = targetOt?.comision_mecanico_porcentaje || 50;
      const totalServ = Number(targetOt?.total_servicios || 0);
      const comisionMonto = Number(targetOt?.comision_mecanico_monto) || (totalServ * (comisionPorc / 100));

      const updatePayload = { 
        estado: nuevoEstado,
        comision_mecanico_porcentaje: comisionPorc,
        comision_mecanico_monto: comisionMonto
      };

      if (nuevoEstado === 'Listo' || nuevoEstado === 'Completado') {
        updatePayload.fecha_finalizacion = new Date().toISOString();
      }

      await update(ref(rtdb, `ordenes_trabajo/${id}`), updatePayload);
      toast.success(`Orden marcada como ${nuevoEstado}. Comisión: C$ ${comisionMonto.toFixed(2)}`);
    } catch (error) {
      toast.error('Error al actualizar estado: ' + error.message);
    }
  };

  // Filtrado final
  const ordenesFiltradas = ordenes.filter(ot => {
    const matchEstado = estadoFilter === 'Todas' || ot.estado === estadoFilter;
    const matchMecanico = mecanicoFilter === 'Todos' || ot.id_mecanico === mecanicoFilter;
    return matchEstado && matchMecanico;
  });

  // Métricas agregadas
  const kpiPendientes = ordenesFiltradas.filter(o => o.estado === 'Pendiente').length;
  const kpiEnProceso = ordenesFiltradas.filter(o => o.estado === 'En Proceso').length;
  const kpiListas = ordenesFiltradas.filter(o => o.estado === 'Listo' || o.estado === 'Completado').length;
  const kpiTotalManoObra = ordenesFiltradas.reduce((acc, o) => acc + Number(o.total_servicios || 0), 0);
  const kpiTotalComisiones = ordenesFiltradas
    .filter(o => o.estado === 'Listo' || o.estado === 'Completado')
    .reduce((acc, o) => {
      const m = Number(o.comision_mecanico_monto) || (Number(o.total_servicios || 0) * (Number(o.comision_mecanico_porcentaje || 50) / 100));
      return acc + m;
    }, 0);

  const getStatusColor = (estado) => {
    switch (estado) {
      case 'Pendiente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'En Proceso': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Listo': 
      case 'Completado': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Wrench className="text-blue-600" /> 
            Órdenes de Trabajo (Taller)
          </h1>
          <p className="text-gray-500 text-sm">Gestiona los servicios de reparación y mantenimiento en curso.</p>
        </div>
      </div>

      {/* RESUMEN DE INDICADORES (KPIS) Y COMISIONES */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Pendientes</span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-black text-amber-600">{kpiPendientes}</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600"><Clock size={18} /></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">En Proceso</span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-black text-blue-600">{kpiEnProceso}</span>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><Wrench size={18} /></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Listas / Completadas</span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-2xl font-black text-emerald-600">{kpiListas}</span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><CheckCircle2 size={18} /></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Mano de Obra Facturada</span>
          <div className="flex items-center justify-between mt-2 gap-2">
            <span className="text-base sm:text-lg font-black text-gray-800 break-words leading-tight">
              C$ {kpiTotalManoObra.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className="p-2 bg-gray-100 rounded-xl text-gray-600 shrink-0"><DollarSign size={18} /></div>
          </div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-md flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider flex items-center gap-1">
            <Award size={14} /> Comisiones Ganadas
          </span>
          <div className="mt-2">
            <span className="text-lg sm:text-xl font-black text-white break-words leading-tight block">
              C$ {kpiTotalComisiones.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-emerald-200 block mt-0.5">Listas para pago en nómina</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Estado</label>
          <select 
            value={estadoFilter} 
            onChange={e => setEstadoFilter(e.target.value)}
            className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm bg-white"
          >
            <option value="Todas">Todas las Órdenes</option>
            <option value="Pendiente">Pendientes</option>
            <option value="En Proceso">En Proceso</option>
            <option value="Listo">Listas (Completadas)</option>
          </select>
        </div>

        {/* Solo administradores o super admins pueden ver trabajos de otros mecánicos */}
        {(user.rol === 'SuperAdmin' || user.permisos?.includes('VER_REPORTES')) && (
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Mecánico</label>
            <select 
              value={mecanicoFilter} 
              onChange={e => setMecanicoFilter(e.target.value)}
              className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm bg-white"
            >
              <option value="Todos">Todos los Mecánicos</option>
              {mecanicosDb.map(m => (
                <option key={m.id} value={m.id}>{m.nombre_completo}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tarjetas Kanban / Lista */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Cargando órdenes de trabajo...</div>
      ) : ordenesFiltradas.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-100">
          <CheckCircle2 size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-bold text-gray-500">No hay órdenes de trabajo</h3>
          <p className="text-gray-400 text-sm">No se encontraron servicios que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {ordenesFiltradas.map(ot => {
            const isFinalizada = ot.estado === 'Listo' || ot.estado === 'Completado';
            const totalServicios = Number(ot.total_servicios || 0);
            const comisionPorc = Number(ot.comision_mecanico_porcentaje) || 50;
            const comisionMonto = Number(ot.comision_mecanico_monto) || (totalServicios * (comisionPorc / 100));

            return (
              <div key={ot.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col transition-shadow hover:shadow-md">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="text-gray-400" size={18} />
                    <span className="font-bold text-gray-800">{ot.numero_factura}</span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(ot.estado)}`}>
                    {ot.estado}
                  </span>
                </div>

                {ot.nombre_cliente && (
                  <p className="text-xs text-gray-500 mb-3 break-words">
                    Cliente: <strong className="text-gray-700">{ot.nombre_cliente}</strong>
                  </p>
                )}
                
                <div className="space-y-3 flex-1 mb-4">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Mecánico Asignado</p>
                    <p className="font-semibold text-gray-800 flex items-center gap-1.5 text-sm">
                      <User size={15} className="text-blue-500" />
                      {ot.nombre_mecanico || 'Sin Asignar'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Servicios a Realizar</p>
                    <ul className="space-y-1.5">
                      {ot.servicios && ot.servicios.map((s, idx) => (
                        <li key={idx} className="text-xs text-gray-700 flex justify-between items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
                          <span className="font-medium leading-tight">{s.cantidad}x {s.nombre}</span>
                          <span className="font-bold text-gray-800 shrink-0">C$ {Number(s.subtotal || 0).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CAJA DE COMISIÓN GENERADA */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    isFinalizada 
                      ? 'bg-emerald-50 border-emerald-200' 
                      : 'bg-blue-50/70 border-blue-200'
                  }`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-600">Total Mano de Obra:</span>
                      <span className="font-black text-gray-800">C$ {totalServicios.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-black mt-1 pt-1 border-t border-gray-200/50">
                      <span className={`flex items-center gap-1 ${isFinalizada ? 'text-emerald-800' : 'text-blue-800'}`}>
                        <Award size={15} /> Comisión ({comisionPorc}%):
                      </span>
                      <span className={`text-base ${isFinalizada ? 'text-emerald-700' : 'text-blue-700'}`}>
                        C$ {comisionMonto.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex justify-end">
                      {isFinalizada ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <CheckCircle2 size={11} /> Comisión Generada y Contabilizada
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Clock size={11} /> Comisión Estimada
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 grid grid-cols-3 gap-2">
                  {ot.estado !== 'Pendiente' && (
                    <button 
                      onClick={() => changeEstado(ot.id, 'Pendiente')}
                      className="py-2 px-3 bg-gray-100 hover:bg-yellow-100 hover:text-yellow-800 text-gray-600 text-xs font-bold rounded-xl transition-colors"
                    >
                      Pendiente
                    </button>
                  )}
                  
                  {ot.estado !== 'En Proceso' && (
                    <button 
                      onClick={() => changeEstado(ot.id, 'En Proceso')}
                      className="py-2 px-3 bg-gray-100 hover:bg-blue-100 hover:text-blue-800 text-gray-600 text-xs font-bold rounded-xl transition-colors"
                    >
                      Iniciar
                    </button>
                  )}
                  
                  {!isFinalizada && (
                    <button 
                      onClick={() => changeEstado(ot.id, 'Listo')}
                      className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 col-span-2 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={15} /> Marcar como Listo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
