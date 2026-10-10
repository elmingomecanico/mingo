import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { Truck, Plus, Edit2, Trash2, Search, Phone, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '', ruc: '', telefono: '', direccion: '', contacto: '', email: ''
  });

  useEffect(() => {
    const listRef = ref(rtdb, 'proveedores');
    const unsub = onValue(listRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        setProveedores(parsed);
      } else {
        setProveedores([]);
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
        ruc: item.ruc || '', 
        telefono: item.telefono || '',
        direccion: item.direccion || '',
        contacto: item.contacto || '',
        email: item.email || ''
      });
    } else {
      setEditingId(null);
      setFormData({ nombre: '', ruc: '', telefono: '', direccion: '', contacto: '', email: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return toast.error("El nombre es requerido");

    try {
      const itemRef = editingId ? ref(rtdb, `proveedores/${editingId}`) : push(ref(rtdb, 'proveedores'));
      
      const payload = {
        nombre: formData.nombre.trim(),
        ruc: formData.ruc.trim(),
        telefono: formData.telefono.trim(),
        direccion: formData.direccion.trim(),
        contacto: formData.contacto.trim(),
        email: formData.email.trim(),
        fecha_registro: editingId ? undefined : new Date().toISOString()
      };

      if (editingId) delete payload.fecha_registro;

      if (!editingId) {
        await set(itemRef, payload);
      } else {
        const provObj = proveedores.find(c => c.id === editingId);
        await set(itemRef, { ...provObj, ...payload });
      }

      toast.success(editingId ? 'Proveedor actualizado' : 'Proveedor registrado');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar al proveedor "${nombre}"?`)) return;
    try {
      await remove(ref(rtdb, `proveedores/${id}`));
      toast.success("Proveedor eliminado");
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    }
  };

  const filtered = proveedores.filter(c => 
    c.nombre.toLowerCase().includes(search.toLowerCase()) || 
    (c.ruc && c.ruc.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Truck className="text-indigo-600" /> 
            Proveedores
          </h1>
          <p className="text-gray-500 text-sm">Gestiona la información de tus proveedores y distribuidores.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
        >
          <Plus size={20} />
          Nuevo Proveedor
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <input 
              type="text" 
              placeholder="Buscar por nombre o RUC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Proveedor</th>
                <th className="p-4">Contacto Directo</th>
                <th className="p-4">Información de Contacto</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-400">Cargando proveedores...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-400">No se encontraron proveedores.</td></tr>
              ) : (
                filtered.map(prov => (
                  <tr key={prov.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-800">{prov.nombre}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <FileText size={12} /> {prov.ruc || 'Sin RUC'}
                      </div>
                    </td>
                    <td className="p-4 text-gray-700">
                      {prov.contacto || 'No especificado'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-gray-700">
                        <Phone size={14} className="text-gray-400" /> 
                        {prov.telefono || 'Sin teléfono'}
                      </div>
                      {prov.email && (
                        <div className="text-xs text-indigo-600 mt-0.5 truncate">
                          {prov.email}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center flex justify-center gap-2">
                      <button onClick={() => handleOpenModal(prov)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(prov.id, prov.nombre)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
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
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">
                {editingId ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial / Razón Social *</label>
                  <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500" placeholder="Ej: Repuestos S.A." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">RUC</label>
                  <input type="text" value={formData.ruc} onChange={e => setFormData({...formData, ruc: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500" placeholder="Ej: J0310000000000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Contacto</label>
                  <input type="text" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500" placeholder="Ej: Carlos Mejía" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="tel" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500" placeholder="Ej: 8888-8888" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500" placeholder="contacto@empresa.com" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <textarea value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} rows="2" className="w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500 resize-none" placeholder="Dirección completa..."></textarea>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors">Cancelar</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-indigo-200 transition-all active:scale-95">Guardar Proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
