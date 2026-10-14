import React, { useState, useEffect } from 'react';
import { ref, onValue, set, update, remove } from 'firebase/database';
import { rtdb } from '../../firebase';
import { 
  Store, Plus, Edit2, Trash2, CheckCircle2, XCircle, UserCheck, 
  UserX, ShieldCheck, Sparkles, AlertCircle, Building2, Lock, LockOpen 
} from 'lucide-react';
import toast from 'react-hot-toast';

export const DEFAULT_CAJAS = [
  {
    id: 'CAJA-01',
    codigo: 'CAJA-01',
    nombre: 'Caja Principal 1 (Mostrador)',
    sucursal: 'SUC-01',
    usuario_asignado_id: '',
    usuario_asignado_nombre: 'Sin Asignar',
    estado: 'Activa',
    descripcion: 'Terminal principal de cobro y facturación de mostrador'
  },
  {
    id: 'CAJA-02',
    codigo: 'CAJA-02',
    nombre: 'Caja Taller y Servicios',
    sucursal: 'SUC-01',
    usuario_asignado_id: '',
    usuario_asignado_nombre: 'Sin Asignar',
    estado: 'Activa',
    descripcion: 'Terminal de cobro para servicios mecánicos y repuestos'
  },
  {
    id: 'CAJA-03',
    codigo: 'CAJA-03',
    nombre: 'Caja Sede Norte',
    sucursal: 'SUC-02',
    usuario_asignado_id: '',
    usuario_asignado_nombre: 'Sin Asignar',
    estado: 'Activa',
    descripcion: 'Terminal de cobro para Sucursal Norte'
  }
];

export default function CajasManager({ user }) {
  const [cajas, setCajas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [turnosAbiertos, setTurnosAbiertos] = useState({});
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCaja, setEditingCaja] = useState(null);

  const [formData, setFormData] = useState({
    id: '',
    codigo: '',
    nombre: '',
    sucursal: 'SUC-01',
    usuario_asignado_id: '',
    estado: 'Activa',
    descripcion: ''
  });

  useEffect(() => {
    const cajasRef = ref(rtdb, 'configuracion/cajas');
    const unsubCajas = onValue(cajasRef, async (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
        setCajas(list);
      } else {
        // Inicializar con valores predeterminados
        const initialMap = {};
        DEFAULT_CAJAS.forEach(c => { initialMap[c.id] = c; });
        await set(cajasRef, initialMap);
        setCajas(DEFAULT_CAJAS);
      }
      setLoading(false);
    });

    const usrRef = ref(rtdb, 'usuarios');
    const unsubUsr = onValue(usrRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setUsuarios(Object.keys(val).map(k => ({ id: k, ...val[k] })).filter(u => u.estado !== 'Inactivo'));
      } else {
        setUsuarios([]);
      }
    });

    const sucRef = ref(rtdb, 'configuracion/sucursales');
    const unsubSuc = onValue(sucRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setSucursales(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      } else {
        setSucursales([
          { id: 'SUC-01', nombre: 'Sucursal Principal' },
          { id: 'SUC-02', nombre: 'Sucursal Norte' }
        ]);
      }
    });

    const turnosRef = ref(rtdb, 'turnos_caja');
    const unsubTurnos = onValue(turnosRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const map = {};
        Object.values(val).forEach(t => {
          if (t.estado === 'Abierta' && (t.id_caja || t.caja_id)) {
            const cid = t.id_caja || t.caja_id;
            map[cid] = t;
          }
        });
        setTurnosAbiertos(map);
      } else {
        setTurnosAbiertos({});
      }
    });

    return () => {
      unsubCajas();
      unsubUsr();
      unsubSuc();
      unsubTurnos();
    };
  }, []);

  const handleOpenModal = (caja = null) => {
    if (caja) {
      setEditingCaja(caja);
      setFormData({
        id: caja.id,
        codigo: caja.codigo || caja.id,
        nombre: caja.nombre || '',
        sucursal: caja.sucursal || 'SUC-01',
        usuario_asignado_id: caja.usuario_asignado_id || '',
        estado: caja.estado || 'Activa',
        descripcion: caja.descripcion || ''
      });
    } else {
      setEditingCaja(null);
      const nextNum = cajas.length + 1;
      const nextId = `CAJA-${nextNum.toString().padStart(2, '0')}`;
      setFormData({
        id: nextId,
        codigo: nextId,
        nombre: `Caja Mostrador ${nextNum}`,
        sucursal: sucursales[0]?.id || 'SUC-01',
        usuario_asignado_id: '',
        estado: 'Activa',
        descripcion: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.codigo.trim() || !formData.nombre.trim()) {
      return toast.error("Código y nombre de caja son obligatorios");
    }

    const cleanId = (editingCaja?.id || formData.id || formData.codigo)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');

    const assignedUser = usuarios.find(u => u.id === formData.usuario_asignado_id);
    const assignedUserName = assignedUser ? (assignedUser.nombre_completo || assignedUser.usuario) : 'Sin Asignar';

    const cajaData = {
      id: cleanId,
      codigo: formData.codigo.trim().toUpperCase(),
      nombre: formData.nombre.trim(),
      sucursal: formData.sucursal,
      usuario_asignado_id: formData.usuario_asignado_id || '',
      usuario_asignado_nombre: assignedUserName,
      estado: formData.estado,
      descripcion: formData.descripcion.trim(),
      fecha_actualizacion: new Date().toISOString()
    };

    try {
      // 1. Guardar o actualizar la caja
      await set(ref(rtdb, `configuracion/cajas/${cleanId}`), cajaData);

      // 2. Si se cambió de usuario asignado, actualizar la ficha del usuario en 'usuarios'
      if (formData.usuario_asignado_id) {
        await update(ref(rtdb, `usuarios/${formData.usuario_asignado_id}`), {
          id_caja_asignada: cleanId,
          nombre_caja_asignada: formData.nombre.trim(),
          codigo_caja_asignada: formData.codigo.trim().toUpperCase()
        });
      }

      // Si se desasignó el usuario previo
      if (editingCaja && editingCaja.usuario_asignado_id && editingCaja.usuario_asignado_id !== formData.usuario_asignado_id) {
        await update(ref(rtdb, `usuarios/${editingCaja.usuario_asignado_id}`), {
          id_caja_asignada: '',
          nombre_caja_asignada: '',
          codigo_caja_asignada: ''
        });
      }

      toast.success(editingCaja ? 'Caja actualizada correctamente' : 'Nueva caja registradora creada');
      setIsModalOpen(false);
    } catch (err) {
      toast.error('Error al guardar: ' + err.message);
    }
  };

  const handleToggleEstado = async (caja) => {
    const nuevoEstado = caja.estado === 'Activa' ? 'Inactiva' : 'Activa';
    try {
      await update(ref(rtdb, `configuracion/cajas/${caja.id}`), {
        estado: nuevoEstado
      });
      toast.success(`Caja ${caja.nombre} marcada como ${nuevoEstado}`);
    } catch (err) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
  };

  const handleQuickAssign = async (caja, newUserId) => {
    try {
      const assignedUser = usuarios.find(u => u.id === newUserId);
      const assignedUserName = assignedUser ? (assignedUser.nombre_completo || assignedUser.usuario) : 'Sin Asignar';

      // 1. Quitar asignación previa si el usuario ya tenía otra caja
      if (newUserId) {
        const cajaPrevia = cajas.find(c => c.usuario_asignado_id === newUserId && c.id !== caja.id);
        if (cajaPrevia) {
          await update(ref(rtdb, `configuracion/cajas/${cajaPrevia.id}`), {
            usuario_asignado_id: '',
            usuario_asignado_nombre: 'Sin Asignar'
          });
        }
      }

      // 2. Desasignar usuario viejo si había
      if (caja.usuario_asignado_id && caja.usuario_asignado_id !== newUserId) {
        await update(ref(rtdb, `usuarios/${caja.usuario_asignado_id}`), {
          id_caja_asignada: '',
          nombre_caja_asignada: '',
          codigo_caja_asignada: ''
        });
      }

      // 3. Asignar en la caja
      await update(ref(rtdb, `configuracion/cajas/${caja.id}`), {
        usuario_asignado_id: newUserId || '',
        usuario_asignado_nombre: assignedUserName
      });

      // 4. Asignar en el usuario
      if (newUserId) {
        await update(ref(rtdb, `usuarios/${newUserId}`), {
          id_caja_asignada: caja.id,
          nombre_caja_asignada: caja.nombre,
          codigo_caja_asignada: caja.codigo || caja.id
        });
      }

      toast.success(`Asignación de ${caja.nombre} actualizada`);
    } catch (err) {
      toast.error('Error al asignar usuario: ' + err.message);
    }
  };

  const handleDeleteCaja = async (caja) => {
    if (turnosAbiertos[caja.id]) {
      return toast.error(`No puedes eliminar "${caja.nombre}" porque tiene un turno de caja abierto en este momento.`);
    }
    if (!window.confirm(`¿Estás seguro de eliminar la caja registradora "${caja.nombre}" (${caja.codigo})? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      if (caja.usuario_asignado_id) {
        await update(ref(rtdb, `usuarios/${caja.usuario_asignado_id}`), {
          id_caja_asignada: '',
          nombre_caja_asignada: '',
          codigo_caja_asignada: ''
        });
      }
      await remove(ref(rtdb, `configuracion/cajas/${caja.id}`));
      toast.success(`Caja "${caja.nombre}" eliminada correctamente`);
    } catch (err) {
      toast.error('Error al eliminar caja: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <Store className="text-blue-600" size={20} />
            Cajas Registradoras y Asignación de Vendedores
          </h2>
          <p className="text-xs text-gray-500">
            Control gerencial de terminales físicas de cobro. Los vendedores sin caja asignada no pueden aperturar ni facturar.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-200 transition-all active:scale-95"
        >
          <Plus size={16} /> Nueva Caja Registradora
        </button>
      </div>

      {/* Grid de Cajas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-gray-400 font-bold text-sm">
            Cargando cajas registradoras...
          </div>
        ) : cajas.length === 0 ? (
          <div className="col-span-full p-8 bg-gray-50 rounded-2xl border border-gray-200 text-center text-gray-500">
            No hay cajas registradoras configuradas.
          </div>
        ) : (
          cajas.map(c => {
            const isActiva = c.estado === 'Activa';
            const turnoActivo = turnosAbiertos[c.id];
            const sucObj = sucursales.find(s => s.id === c.sucursal);

            return (
              <div 
                key={c.id} 
                className={`bg-white rounded-2xl p-5 border transition-all ${
                  isActiva ? 'border-gray-200 shadow-sm hover:border-blue-300' : 'border-gray-200 bg-gray-50/70 opacity-75'
                }`}
              >
                {/* Encabezado de la tarjeta */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2.5 bg-blue-50 text-blue-700 rounded-xl font-mono font-black text-xs">
                      {c.codigo || c.id}
                    </span>
                    <div>
                      <h3 className="font-black text-gray-800 text-sm leading-tight">{c.nombre}</h3>
                      <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1 mt-0.5">
                        <Building2 size={12} className="text-gray-400" />
                        {sucObj ? sucObj.nombre : c.sucursal}
                      </span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isActiva ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {c.estado}
                  </span>
                </div>

                {/* Estado de Turno en Vivo */}
                <div className="mb-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  {turnoActivo ? (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                        <LockOpen size={14} className="text-emerald-600 animate-pulse" />
                        <span>Turno Abierto ({turnoActivo.numero_turno})</span>
                      </div>
                      <span className="text-[11px] text-gray-600">
                        {turnoActivo.cajero_nombre}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Lock size={14} className="text-gray-400" />
                        <span>Caja Cerrada (Sin turno activo)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Usuario / Vendedor Asignado */}
                <div className="mb-4 space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Vendedor / Cajero Asignado
                  </label>
                  <select
                    value={c.usuario_asignado_id || ''}
                    onChange={(e) => handleQuickAssign(c, e.target.value)}
                    className="w-full text-xs font-bold p-2 border border-gray-200 rounded-xl bg-white text-gray-800 outline-none focus:border-blue-500"
                  >
                    <option value="">🚫 Sin Asignar (Nadie puede operar)</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>
                        👤 {u.nombre_completo || u.usuario} ({u.rol || 'Vendedor'})
                      </option>
                    ))}
                  </select>
                </div>

                {c.descripcion && (
                  <p className="text-[11px] text-gray-500 italic mb-4 line-clamp-2">
                    "{c.descripcion}"
                  </p>
                )}

                {/* Acciones */}
                <div className="pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleEstado(c)}
                    className={`font-bold transition-colors ${
                      isActiva ? 'text-amber-700 hover:text-amber-900' : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    {isActiva ? 'Desactivar' : 'Reactivar'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenModal(c)}
                      className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 p-1 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCaja(c)}
                      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar Caja"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Crear / Editar Caja */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center">
              <h3 className="font-black text-base text-gray-800 flex items-center gap-2">
                <Store size={18} className="text-blue-600" />
                {editingCaja ? 'Editar Caja Registradora' : 'Nueva Caja Registradora'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Código de Caja *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.codigo}
                    onChange={e => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                    placeholder="Ej: CAJA-01"
                    className="w-full border-2 border-gray-200 p-2.5 rounded-xl font-mono font-bold text-sm text-blue-900 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Sucursal *
                  </label>
                  <select
                    value={formData.sucursal}
                    onChange={e => setFormData({ ...formData, sucursal: e.target.value })}
                    className="w-full border-2 border-gray-200 p-2.5 rounded-xl font-bold text-sm text-gray-800 outline-none focus:border-blue-500"
                  >
                    {sucursales.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre || s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Nombre Identificador *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Caja Mostrador 1, Caja Taller"
                  className="w-full border-2 border-gray-200 p-2.5 rounded-xl text-sm font-bold text-gray-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Vendedor / Cajero Titular
                </label>
                <select
                  value={formData.usuario_asignado_id}
                  onChange={e => setFormData({ ...formData, usuario_asignado_id: e.target.value })}
                  className="w-full border-2 border-gray-200 p-2.5 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-blue-500"
                >
                  <option value="">🚫 Sin Asignar (Dejar disponible)</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nombre_completo || u.usuario} ({u.rol || 'Vendedor'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Solo el usuario titular asignado (o un SuperAdmin) podrá aperturar y facturar en esta caja.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Estado Operativo
                </label>
                <select
                  value={formData.estado}
                  onChange={e => setFormData({ ...formData, estado: e.target.value })}
                  className="w-full border-2 border-gray-200 p-2.5 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                >
                  <option value="Activa">🟢 Activa (Habilitada para cobro)</option>
                  <option value="Inactiva">🔴 Inactiva (Bloqueada)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Descripción / Ubicación Física (Opcional)
                </label>
                <textarea
                  rows="2"
                  value={formData.descripcion}
                  onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Ej: Computadora Dell mostrador derecho frente a repuestos..."
                  className="w-full border-2 border-gray-200 p-2.5 rounded-xl text-xs outline-none focus:border-blue-500 resize-none"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all"
                >
                  Guardar Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
