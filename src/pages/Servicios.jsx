import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { Wrench, Plus, Edit2, Trash2, Search, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Servicios() {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '', descripcion: '', precio: ''
  });

  useEffect(() => {
    const servRef = ref(rtdb, 'servicios');
    const unsub = onValue(servRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        setServicios(parsed);
      } else {
        setServicios([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({ 
        nombre: item.nombre || '', 
        descripcion: item.descripcion || '', 
        precio: item.precio || ''
      });
    } else {
      setEditingId(null);
      setFormData({ nombre: '', descripcion: '', precio: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return toast.error("El nombre del servicio es requerido");

    try {
      const itemRef = editingId ? ref(rtdb, `servicios/${editingId}`) : push(ref(rtdb, 'servicios'));
      
      const payload = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        precio: Number(formData.precio) || 0
      };

      await set(itemRef, payload);
      toast.success(editingId ? 'Servicio actualizado' : 'Servicio registrado');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar el servicio "${nombre}"?`)) return;
    try {
      await remove(ref(rtdb, `servicios/${id}`));
      toast.success("Servicio eliminado");
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    }
  };

  const filtered = servicios.filter(s => 
    s.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Wrench className="text-purple-600" /> 
            Catálogo de Servicios
          </h1>
          <p className="text-gray-500 text-sm">Gestiona la mano de obra, reparaciones y mantenimiento.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-purple-200 transition-all active:scale-95"
        >
          <Plus size={20} />
          Nuevo Servicio
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <input 
              type="text" 
              placeholder="Buscar servicio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Servicio</th>
                <th className="p-4">Descripción</th>
                <th className="p-4 text-right">Precio Sugerido</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-400">Cargando servicios...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-400">No se encontraron servicios.</td></tr>
              ) : (
                filtered.map(serv => (
                  <tr key={serv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-800">{serv.nombre}</td>
                    <td className="p-4 text-gray-500 truncate max-w-[300px]">
                      {serv.descripcion || 'Sin descripción'}
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-600">
                      C$ {serv.precio.toFixed(2)}
                    </td>
                    <td className="p-4 text-center flex justify-center gap-2">
                      <button onClick={() => handleOpenModal(serv)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(serv.id, serv.nombre)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
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
                {editingId ? 'Editar Servicio' : 'Nuevo Servicio'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Servicio *</label>
                <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-purple-500" placeholder="Ej: Cambio de Aceite" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio Sugerido (C$) *</label>
                <input required type="number" step="0.01" min="0" value={formData.precio} onChange={e => setFormData({...formData, precio: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-purple-500" placeholder="0.00" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} rows="3" className="w-full border p-2.5 rounded-lg outline-none focus:border-purple-500 resize-none" placeholder="Opcional..."></textarea>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors">Cancelar</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-purple-200 transition-all active:scale-95">Guardar Servicio</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
