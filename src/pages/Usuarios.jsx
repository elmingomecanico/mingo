import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { ShieldCheck, Plus, Edit2, Trash2, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nombre_completo: '', usuario: '', password: '', rol: 'Cajero', estado: 'Activo', id_sucursal: 'SUC-01'
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
      setFormData({ 
        nombre_completo: item.nombre_completo || '', 
        usuario: item.usuario || '', 
        password: item.password || '',
        rol: item.rol || 'Cajero',
        estado: item.estado || 'Activo',
        id_sucursal: item.id_sucursal || 'SUC-01'
      });
    } else {
      setEditingId(null);
      setFormData({ 
        nombre_completo: '', usuario: '', password: '', rol: 'Cajero', estado: 'Activo', id_sucursal: 'SUC-01' 
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.usuario.trim() || !formData.password.trim()) {
      return toast.error("Usuario y contraseña son requeridos");
    }

    // Verificar si el usuario ya existe (para nuevos registros)
    if (!editingId && usuarios.some(u => u.usuario.toLowerCase() === formData.usuario.toLowerCase())) {
      return toast.error("El nombre de usuario ya está en uso");
    }

    try {
      const itemRef = editingId ? ref(rtdb, `usuarios/${editingId}`) : push(ref(rtdb, 'usuarios'));
      
      const payload = {
        nombre_completo: formData.nombre_completo.trim(),
        usuario: formData.usuario.trim(),
        password: formData.password.trim(),
        rol: formData.rol,
        estado: formData.estado,
        id_sucursal: formData.id_sucursal
      };

      await set(itemRef, payload);
      toast.success(editingId ? 'Usuario actualizado' : 'Usuario registrado');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (usuarios.length === 1) return toast.error("No puedes eliminar el único usuario del sistema");
    if (!window.confirm(`¿Estás seguro de eliminar el acceso de "${nombre}"?`)) return;
    try {
      await remove(ref(rtdb, `usuarios/${id}`));
      toast.success("Usuario eliminado");
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
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
          <p className="text-gray-500 text-sm">Gestiona los accesos, roles y sucursales del personal.</p>
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
                <th className="p-4">Rol / Nivel</th>
                <th className="p-4">Sucursal</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400">Cargando usuarios...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400">No hay usuarios.</td></tr>
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
                        user.rol === 'Administrador' ? 'bg-purple-100 text-purple-700' :
                        user.rol === 'Mecánico' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {user.rol}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{user.id_sucursal}</td>
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
                      <button onClick={() => handleDelete(user.id, user.nombre_completo)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">
                {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                <input required type="text" value={formData.nombre_completo} onChange={e => setFormData({...formData, nombre_completo: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" placeholder="Ej: Mario Rodríguez" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuario (Login) *</label>
                  <input required type="text" value={formData.usuario} onChange={e => setFormData({...formData, usuario: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" placeholder="mario.r" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                  <input required type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" placeholder="••••••••" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rol en Sistema</label>
                  <select value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500">
                    <option value="Administrador">Administrador</option>
                    <option value="Cajero">Cajero</option>
                    <option value="Mecánico">Mecánico</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500">
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal Asignada</label>
                <select value={formData.id_sucursal} onChange={e => setFormData({...formData, id_sucursal: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500">
                  <option value="SUC-01">Sucursal Principal (SUC-01)</option>
                  <option value="SUC-02">Sucursal Norte (SUC-02)</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors">Cancelar</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-blue-200 transition-all active:scale-95">Guardar Usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
