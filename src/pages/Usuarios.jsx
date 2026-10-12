import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { ShieldCheck, Plus, Edit2, Trash2, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import ConfirmModal from '../components/ConfirmModal';

const FUNCIONES_OPTIONS = [
  { value: 'Mecánico', label: 'Mecánico' },
  { value: 'Cajero', label: 'Cajero' },
  { value: 'Vendedor', label: 'Vendedor' },
  { value: 'Gerente', label: 'Gerente' },
  { value: 'Auxiliar', label: 'Auxiliar' },
];

const PERMISOS_CATEGORIAS = {
  'Ventas y Facturación': [
    { id: 'VER_POS', label: 'Acceso a Caja POS' },
    { id: 'FACTURAR_MULTISUCURSAL', label: 'Facturar desde Todas las Sucursales (Multisucursal)' },
    { id: 'ANULAR_FACTURA', label: 'Anular Facturas' }
  ],
  'Órdenes y Taller': [
    { id: 'VER_TALLER', label: 'Ver Órdenes de Trabajo' }
  ],
  'Inventario y Compras': [
    { id: 'VER_INVENTARIO', label: 'Ver Inventario' },
    { id: 'VER_COMPRAS', label: 'Ver Compras' },
    { id: 'CREAR_PRODUCTO', label: 'Crear/Editar Productos' },
    { id: 'AJUSTE_INVENTARIO', label: 'Ajustar Stock Manualmente' }
  ],
  'Finanzas y Cuentas': [
    { id: 'VER_CONTABILIDAD', label: 'Acceso a Contabilidad y Libro Diario' },
    { id: 'VER_CXC', label: 'Ver Cuentas por Cobrar (CxC)' },
    { id: 'VER_CXP', label: 'Ver Cuentas por Pagar (CxP)' },
    { id: 'VER_REPORTES', label: 'Ver Reportes y Estadísticas' }
  ],
  'Catálogos y Usuarios': [
    { id: 'VER_CLIENTES', label: 'Ver Clientes' },
    { id: 'VER_PROVEEDORES', label: 'Ver Proveedores' },
    { id: 'VER_CATALOGOS', label: 'Acceder a Ajustes / Catálogos' },
    { id: 'VER_USUARIOS', label: 'Gestionar Usuarios' }
  ]
};

const TODAS_LOS_PERMISOS = Object.values(PERMISOS_CATEGORIAS).flat().map(p => p.id);

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nombre_completo: '', 
    usuario: '', 
    password: '', 
    rol: 'Usuario', 
    funcion: null, 
    permisos: [],
    estado: 'Activo', 
    id_sucursal: 'SUC-01',
    permite_multisucursal: false
  });

  useEffect(() => {
    const usersRef = ref(rtdb, 'usuarios');
    const unsub = onValue(usersRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        setUsuarios(parsed);
      } else {
        setUsuarios([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      const hasMulti = Boolean(item.permite_multisucursal || item.permisos?.includes('FACTURAR_MULTISUCURSAL'));
      setFormData({ 
        nombre_completo: item.nombre_completo || '', 
        usuario: item.usuario || '', 
        password: item.password || '',
        rol: item.rol || 'Usuario',
        funcion: item.funcion ? { value: item.funcion, label: item.funcion } : null,
        permisos: item.permisos || [],
        estado: item.estado || 'Activo',
        id_sucursal: item.id_sucursal || 'SUC-01',
        tipo_salario: item.tipo_salario || 'Comisión',
        salario_base: item.salario_base || 0,
        porcentaje_comision: item.porcentaje_comision || 50,
        permite_multisucursal: hasMulti
      });
    } else {
      setEditingId(null);
      setFormData({ 
        nombre_completo: '', 
        usuario: '', 
        password: '', 
        rol: 'Usuario', 
        funcion: null, 
        permisos: [], 
        estado: 'Activo', 
        id_sucursal: 'SUC-01',
        tipo_salario: 'Comisión',
        salario_base: 0,
        porcentaje_comision: 50,
        permite_multisucursal: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.usuario.trim() || !formData.password.trim()) {
      return toast.error("Usuario y contraseña son requeridos");
    }

    if (!editingId && usuarios.some(u => u.usuario.toLowerCase() === formData.usuario.toLowerCase())) {
      return toast.error("El nombre de usuario ya está en uso");
    }

    try {
      const itemRef = editingId ? ref(rtdb, `usuarios/${editingId}`) : push(ref(rtdb, 'usuarios'));
      
      // Asegurar que si permite_multisucursal es true, también esté en el array de permisos
      let perms = [...formData.permisos];
      if (formData.permite_multisucursal && !perms.includes('FACTURAR_MULTISUCURSAL')) {
        perms.push('FACTURAR_MULTISUCURSAL');
      } else if (!formData.permite_multisucursal && perms.includes('FACTURAR_MULTISUCURSAL')) {
        perms = perms.filter(p => p !== 'FACTURAR_MULTISUCURSAL');
      }

      const payload = {
        nombre_completo: formData.nombre_completo.trim(),
        usuario: formData.usuario.trim(),
        password: formData.password.trim(),
        rol: formData.rol,
        funcion: formData.funcion ? formData.funcion.value : '',
        permisos: perms,
        estado: formData.estado,
        id_sucursal: formData.id_sucursal,
        permite_multisucursal: Boolean(formData.permite_multisucursal),
        tipo_salario: formData.tipo_salario,
        salario_base: Number(formData.salario_base) || 0,
        porcentaje_comision: Number(formData.porcentaje_comision) || 0
      };

      await set(itemRef, payload);
      toast.success(editingId ? 'Usuario actualizado' : 'Usuario registrado');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const requestDelete = (id, nombre) => {
    if (usuarios.length === 1) return toast.error("No puedes eliminar el único usuario del sistema");
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Usuario',
      message: `¿Estás seguro de eliminar el acceso de "${nombre}" al sistema? No se podrá recuperar.`,
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      await remove(ref(rtdb, `usuarios/${id}`));
      toast.success("Usuario eliminado");
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    } finally {
      setConfirmModal({ ...confirmModal, isOpen: false });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <ShieldCheck className="text-blue-600" /> 
            Control de Usuarios
          </h1>
          <p className="text-gray-500 text-sm">Gestiona los roles, funciones y permisos del personal.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
        >
          <Plus size={20} />
          Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Personal</th>
                <th className="p-4">Credenciales</th>
                <th className="p-4">Rol en Sistema</th>
                <th className="p-4">Función (Puesto)</th>
                <th className="p-4">Sucursal</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-400">Cargando usuarios...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-400">No hay usuarios.</td></tr>
              ) : (
                usuarios.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-800">{user.nombre_completo}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-gray-600 font-mono text-xs">
                        <KeyRound size={12} /> {user.usuario}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        user.rol === 'SuperAdmin' ? 'bg-purple-100 text-purple-700' :
                        user.rol === 'Administrador' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {user.rol}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-gray-700">{user.funcion || 'N/A'}</td>
                    <td className="p-4 text-gray-600">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="font-semibold text-gray-800">{user.id_sucursal || 'SUC-01'}</span>
                        {user.permite_multisucursal || user.permisos?.includes('FACTURAR_MULTISUCURSAL') || user.rol === 'SuperAdmin' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ★ Multisucursal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                            1 Sede Única
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        user.estado === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.estado}
                      </span>
                    </td>
                    <td className="p-4 text-center flex justify-center gap-2">
                      <button onClick={() => handleOpenModal(user)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => requestDelete(user.id, user.nombre_completo)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <h2 className="text-base sm:text-lg font-black text-gray-800">
                {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nombre Completo *</label>
                  <input required type="text" value={formData.nombre_completo} onChange={e => setFormData({...formData, nombre_completo: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm" placeholder="Ej: Mario Rodríguez" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Usuario (Login) *</label>
                    <input required type="text" value={formData.usuario} onChange={e => setFormData({...formData, usuario: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm font-mono" placeholder="mario.r" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Contraseña *</label>
                    <input required type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm" placeholder="••••••••" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nivel de Acceso (Rol)</label>
                    <select value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm bg-white">
                      <option value="SuperAdmin">Super Administrador</option>
                      <option value="Administrador">Administrador</option>
                      <option value="Usuario">Usuario Regular</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Función (Puesto)</label>
                    <Select
                      options={FUNCIONES_OPTIONS}
                      value={formData.funcion}
                      onChange={(selected) => setFormData({ ...formData, funcion: selected })}
                      placeholder="Buscar función..."
                      className="react-select-container text-sm"
                      classNamePrefix="react-select"
                    />
                  </div>
                </div>

                <div className="bg-green-50 p-3.5 sm:p-4 rounded-2xl border border-green-100 space-y-3">
                  <h3 className="font-bold text-green-900 text-xs sm:text-sm flex items-center gap-2">
                    Estructura Salarial (RRHH)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-green-800 mb-1 uppercase">Tipo de Salario</label>
                      <select value={formData.tipo_salario} onChange={e => setFormData({...formData, tipo_salario: e.target.value})} className="w-full border border-green-200 bg-white p-2.5 rounded-xl outline-none focus:border-green-500 text-xs sm:text-sm">
                        <option value="Comisión">100% Comisión</option>
                        <option value="Fijo">Sueldo Fijo</option>
                        <option value="Mixto">Fijo + Comisión</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-green-800 mb-1 uppercase">Sueldo Base (C$)</label>
                      <input 
                        type="number" 
                        disabled={formData.tipo_salario === 'Comisión'}
                        value={formData.salario_base} 
                        onChange={e => setFormData({...formData, salario_base: e.target.value})} 
                        className="w-full border border-green-200 disabled:bg-gray-100 disabled:text-gray-400 bg-white p-2.5 rounded-xl outline-none focus:border-green-500 text-xs sm:text-sm" 
                        placeholder="0.00" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-green-800 mb-1 uppercase">Comisión (%)</label>
                      <input 
                        type="number" 
                        disabled={formData.tipo_salario === 'Fijo'}
                        value={formData.porcentaje_comision} 
                        onChange={e => setFormData({...formData, porcentaje_comision: e.target.value})} 
                        className="w-full border border-green-200 disabled:bg-gray-100 disabled:text-gray-400 bg-white p-2.5 rounded-xl outline-none focus:border-green-500 text-xs sm:text-sm" 
                        placeholder="50" 
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">Permisos Especiales</label>
                  {formData.rol === 'SuperAdmin' ? (
                    <div className="bg-purple-50 text-purple-700 p-4 rounded-2xl text-xs sm:text-sm font-medium border border-purple-100 flex items-center gap-2">
                      <ShieldCheck size={18} className="shrink-0" />
                      Los Super Administradores tienen acceso total e irrestricto al sistema.
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50/30">
                      <div className="grid grid-cols-1 sm:grid-cols-2">
                        {Object.entries(PERMISOS_CATEGORIAS).map(([cat, perms]) => (
                          <div key={cat} className="p-3 sm:p-4 border-b border-gray-200 last:border-0 odd:border-r">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-bold text-gray-800 text-xs sm:text-sm">{cat}</h4>
                              <button
                                type="button"
                                onClick={() => {
                                  const allCatPerms = perms.map(p => p.id);
                                  const hasAll = allCatPerms.every(p => formData.permisos.includes(p));
                                  if (hasAll) {
                                    setFormData({ ...formData, permisos: formData.permisos.filter(p => !allCatPerms.includes(p)) });
                                  } else {
                                    const newPerms = new Set([...formData.permisos, ...allCatPerms]);
                                    setFormData({ ...formData, permisos: Array.from(newPerms) });
                                  }
                                }}
                                className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
                              >
                                Marcar Todo
                              </button>
                            </div>
                            <div className="space-y-1.5 sm:space-y-2">
                              {perms.map(p => (
                                <label key={p.id} className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                                  <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                    checked={formData.permisos.includes(p.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormData({ ...formData, permisos: [...formData.permisos, p.id] });
                                      } else {
                                        setFormData({ ...formData, permisos: formData.permisos.filter(x => x !== p.id) });
                                      }
                                    }}
                                  />
                                  {p.label}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* PRIVILEGIO GERENCIAL: FACTURACIÓN MULTISUCURSAL */}
                <div className="bg-amber-50/90 p-3.5 sm:p-4 rounded-2xl border border-amber-200 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="permite_multisucursal_chk"
                    checked={formData.permite_multisucursal}
                    onChange={(e) => setFormData({ ...formData, permite_multisucursal: e.target.checked })}
                    className="mt-1 w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="permite_multisucursal_chk" className="cursor-pointer">
                    <div className="text-xs sm:text-sm font-bold text-amber-950 flex items-center gap-1.5">
                      <span>🏢 Autorizar Facturación Multisucursal</span>
                      <span className="text-[10px] uppercase font-black tracking-wider bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">Decisión Gerencia</span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-amber-800 mt-1 leading-snug">
                      Permite que este usuario pueda despachar y facturar inventario desde cualquier sucursal simultáneamente en el POS. Si se desactiva, el cajero estará restringido únicamente a su sucursal asignada ({formData.id_sucursal}).
                    </p>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Sucursal Asignada</label>
                    <select value={formData.id_sucursal} onChange={e => setFormData({...formData, id_sucursal: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 text-xs sm:text-sm bg-white">
                      <option value="SUC-01">Sucursal Principal (SUC-01)</option>
                      <option value="SUC-02">Sucursal Norte (SUC-02)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Estado</label>
                    <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 text-xs sm:text-sm bg-white">
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm transition-colors">Cancelar</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold shadow-md shadow-blue-200 transition-all active:scale-95 text-xs sm:text-sm">Guardar Usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
}
