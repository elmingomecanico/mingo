import React, { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { rtdb } from '../firebase';
import { Wrench, Clock, CheckCircle2, AlertCircle, User, FileText } from 'lucide-react';
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
    onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const mecs = Object.keys(val).map(key => ({ id: key, ...val[key] }))
          .filter(u => u.funcion === 'Mecánico' && u.estado === 'Activo');
        setMecanicosDb(mecs);
      }
    });

    return () => unsub();
  }, []);

  const changeEstado = async (id, nuevoEstado) => {
    try {
      await update(ref(rtdb, `ordenes_trabajo/${id}`), { estado: nuevoEstado });
      toast.success(`Orden de trabajo marcada como ${nuevoEstado}`);
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

  const getStatusColor = (estado) => {
    switch (estado) {
      case 'Pendiente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'En Proceso': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Listo': return 'bg-green-100 text-green-800 border-green-200';
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

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Estado</label>
          <select 
            value={estadoFilter} 
            onChange={e => setEstadoFilter(e.target.value)}
            className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium"
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
              className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium"
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
        <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-100">
          <CheckCircle2 size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-bold text-gray-500">No hay órdenes de trabajo</h3>
          <p className="text-gray-400 text-sm">No se encontraron servicios que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {ordenesFiltradas.map(ot => (
            <div key={ot.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col transition-shadow hover:shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="text-gray-400" size={18} />
                  <span className="font-bold text-gray-800">{ot.numero_factura}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getStatusColor(ot.estado)}`}>
                  {ot.estado}
                </span>
              </div>
              
              <div className="space-y-3 flex-1 mb-4">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Mecánico Asignado</p>
                  <p className="font-medium text-gray-800 flex items-center gap-1.5">
                    <User size={14} className="text-blue-500" />
                    {ot.nombre_mecanico || 'Sin Asignar'}
                  </p>
                </div>
                
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Servicios a Realizar</p>
                  <ul className="space-y-1">
                    {ot.servicios && ot.servicios.map((s, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-400">{s.cantidad}x</span>
                        <span className="font-medium leading-tight">{s.nombre}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 grid grid-cols-3 gap-2">
                {ot.estado !== 'Pendiente' && (
                  <button 
                    onClick={() => changeEstado(ot.id, 'Pendiente')}
                    className="py-2 px-3 bg-gray-100 hover:bg-yellow-100 hover:text-yellow-800 text-gray-600 text-xs font-bold rounded-lg transition-colors"
                  >
                    Pendiente
                  </button>
                )}
                
                {ot.estado !== 'En Proceso' && (
                  <button 
                    onClick={() => changeEstado(ot.id, 'En Proceso')}
                    className="py-2 px-3 bg-gray-100 hover:bg-blue-100 hover:text-blue-800 text-gray-600 text-xs font-bold rounded-lg transition-colors"
                  >
                    Iniciar (En Proceso)
                  </button>
                )}
                
                {ot.estado !== 'Listo' && (
                  <button 
                    onClick={() => changeEstado(ot.id, 'Listo')}
                    className="py-2 px-3 bg-gray-100 hover:bg-green-100 hover:text-green-800 text-gray-600 text-xs font-bold rounded-lg transition-colors col-span-2"
                  >
                    Marcar como Listo
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
