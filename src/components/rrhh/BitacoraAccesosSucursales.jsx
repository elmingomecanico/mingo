import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../../firebase';
import { 
  Store, Calendar, User, Search, Filter, Clock, MapPin, 
  Building2, ShieldCheck, ArrowRightLeft, Sparkles, CheckCircle2 
} from 'lucide-react';

export default function BitacoraAccesosSucursales() {
  const [accesos, setAccesos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const hoyStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const [filtroFecha, setFiltroFecha] = useState(hoyStr);
  const [filtroSucursal, setFiltroSucursal] = useState('Todas');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('Todos');

  useEffect(() => {
    // 1. Cargar sucursales
    const sucRef = ref(rtdb, 'configuracion/sucursales');
    const unsubSuc = onValue(sucRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setSucursales(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      } else {
        setSucursales([]);
      }
    });

    // 2. Cargar bitácora de accesos
    const bitRef = ref(rtdb, 'bitacora_accesos_sucursal');
    const unsubBit = onValue(bitRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.keys(val).map(k => ({ id: k, ...val[k] }));
        // Orden descendente por timestamp
        list.sort((a, b) => new Date(b.timestamp || b.fecha || 0) - new Date(a.timestamp || a.fecha || 0));
        setAccesos(list);
      } else {
        setAccesos([]);
      }
      setLoading(false);
    });

    return () => {
      unsubSuc();
      unsubBit();
    };
  }, []);

  const sucursalesMap = useMemo(() => {
    const map = {};
    sucursales.forEach(s => {
      map[s.id] = s.nombre || s.name || s.id;
    });
    return map;
  }, [sucursales]);

  // Filtrado reactivo
  const accesosFiltrados = useMemo(() => {
    return accesos.filter(item => {
      if (filtroFecha && item.fecha !== filtroFecha) {
        return false;
      }
      if (filtroSucursal !== 'Todas' && item.id_sucursal !== filtroSucursal) {
        return false;
      }
      if (filtroTipo !== 'Todos' && item.tipo !== filtroTipo) {
        return false;
      }
      if (filtroUsuario.trim()) {
        const q = filtroUsuario.toLowerCase().trim();
        const matchNom = item.nombre_completo?.toLowerCase().includes(q);
        const matchUser = item.usuario?.toLowerCase().includes(q);
        const matchRol = item.rol?.toLowerCase().includes(q);
        if (!matchNom && !matchUser && !matchRol) return false;
      }
      return true;
    });
  }, [accesos, filtroFecha, filtroSucursal, filtroTipo, filtroUsuario]);

  // Resumen del día de hoy
  const estadisticasHoy = useMemo(() => {
    const deHoy = accesos.filter(a => a.fecha === hoyStr);
    const usuariosUnicos = new Set(deHoy.map(a => a.id_usuario || a.usuario));
    
    // Conteo por sucursal
    const porSede = {};
    deHoy.forEach(a => {
      const sId = a.id_sucursal || 'Sin Sede';
      porSede[sId] = (porSede[sId] || 0) + 1;
    });

    return {
      totalHoy: deHoy.length,
      colaboradoresHoy: usuariosUnicos.size,
      porSede
    };
  }, [accesos, hoyStr]);

  return (
    <div className="space-y-6">
      {/* TARJETAS DE CONTROL DIARIO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-5 rounded-2xl shadow-sm border border-blue-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">Colaboradores Hoy</span>
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <User size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black">{estadisticasHoy.colaboradoresHoy}</span>
            <span className="text-xs text-blue-200 font-medium">en operaciones hoy</span>
          </div>
          <p className="text-[11px] text-blue-200/80 mt-1">
            Personal que ha seleccionado sede de trabajo hoy ({hoyStr}).
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total de Accesos Hoy</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-800">{estadisticasHoy.totalHoy}</span>
            <span className="text-xs text-emerald-600 font-bold">registros</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Inicios de sesión y cambios de sede registrados.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Historial Total</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-800">{accesos.length}</span>
            <span className="text-xs text-indigo-600 font-bold">en bitácora</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Auditoría permanente de sedes de trabajo.
          </p>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 pb-3">
          <h3 className="font-black text-sm text-gray-800 flex items-center gap-2">
            <Filter size={16} className="text-blue-600" />
            Filtros de Auditoría
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltroFecha(hoyStr)}
              className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filtroFecha === hoyStr 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setFiltroFecha('')}
              className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filtroFecha === '' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Ver Todas las Fechas
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Fecha</label>
            <div className="relative">
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="w-full border border-gray-200 p-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-blue-500 bg-gray-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Sucursal</label>
            <select
              value={filtroSucursal}
              onChange={(e) => setFiltroSucursal(e.target.value)}
              className="w-full border border-gray-200 p-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-blue-500 bg-gray-50 cursor-pointer"
            >
              <option value="Todas">Todas las sucursales</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nombre || s.name || s.id} ({s.codigo_visible || s.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Tipo de Evento</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full border border-gray-200 p-2 rounded-xl text-xs sm:text-sm font-semibold outline-none focus:border-blue-500 bg-gray-50 cursor-pointer"
            >
              <option value="Todos">Todos los tipos</option>
              <option value="inicio_sesion">Inicio de Sesión</option>
              <option value="cambio_sucursal">Cambio de Sede</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Buscar Colaborador</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nombre, usuario o rol..."
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value)}
                className="w-full border border-gray-200 pl-8 pr-3 p-2 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-500 bg-gray-50"
              />
              <Search size={14} className="absolute left-2.5 top-3 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* TABLA DE AUDITORÍA */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h4 className="font-black text-sm text-gray-800 flex items-center gap-2">
            <Store size={16} className="text-blue-600" />
            Registros de Acceso por Sede ({accesosFiltrados.length})
          </h4>
          <span className="text-xs text-gray-400 font-medium">
            Ordenado del más reciente al más antiguo
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm font-semibold">
            Cargando bitácora de accesos...
          </div>
        ) : accesosFiltrados.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto">
              <Clock size={24} />
            </div>
            <p className="font-bold text-gray-700 text-sm">No se encontraron accesos con los filtros actuales</p>
            <p className="text-xs text-gray-400">Prueba cambiando la fecha o limpiando la búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Rol en Sistema</th>
                  <th className="py-3 px-4">Sucursal de Trabajo</th>
                  <th className="py-3 px-4 text-center">Tipo de Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accesosFiltrados.map((item) => {
                  const horaStr = item.timestamp 
                    ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : '--:--';
                  const nombreSede = sucursalesMap[item.id_sucursal] || item.nombre_sucursal || item.id_sucursal;
                  const esCambio = item.tipo === 'cambio_sucursal';

                  return (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-gray-800">{item.fecha}</div>
                        <div className="text-[11px] text-gray-400 flex items-center gap-1">
                          <Clock size={11} /> {horaStr}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-800 flex items-center gap-1.5">
                          <User size={13} className="text-blue-600" />
                          {item.nombre_completo || 'Usuario'}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          @{item.usuario || 'sin_usuario'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.rol === 'SuperAdmin' 
                            ? 'bg-purple-100 text-purple-700 border border-purple-200' 
                            : item.rol === 'Administrador'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {item.rol || 'Personal'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            <Store size={14} />
                          </span>
                          <div>
                            <span className="font-bold text-gray-800 block text-xs sm:text-sm">
                              {nombreSede}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400 font-bold bg-gray-100 px-1.5 py-0.2 rounded">
                              {item.id_sucursal}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {esCambio ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <ArrowRightLeft size={11} />
                            Cambio de Sede
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <CheckCircle2 size={11} />
                            Inicio de Sesión
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
