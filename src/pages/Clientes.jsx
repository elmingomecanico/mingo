import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { Users, Plus, Edit2, Trash2, Search, Phone, FileText, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '', cedula: '', telefono1: '', telefono2: '', direccion: '', limite_credito: 0
  });

  useEffect(() => {
    const listRef = ref(rtdb, 'clientes');
    const unsub = onValue(listRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        setClientes(parsed);
      } else {
        setClientes([]);
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
        cedula: item.cedula || '', 
        telefono1: item.telefono1 || '',
        telefono2: item.telefono2 || '',
        direccion: item.direccion || '',
        limite_credito: item.limite_credito || 0
      });
    } else {
      setEditingId(null);
      setFormData({ nombre: '', cedula: '', telefono1: '', telefono2: '', direccion: '', limite_credito: 0 });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return toast.error("El nombre es requerido");

    try {
      const itemRef = editingId ? ref(rtdb, `clientes/${editingId}`) : push(ref(rtdb, 'clientes'));
      
      const payload = {
        nombre: formData.nombre.trim(),
        cedula: formData.cedula.trim(),
        telefono1: formData.telefono1.trim(),
        telefono2: formData.telefono2.trim(),
        direccion: formData.direccion.trim(),
        limite_credito: Number(formData.limite_credito) || 0,
        fecha_registro: editingId ? undefined : new Date().toISOString()
      };

      // Si estamos editando, mantenemos la fecha de registro original
      if (editingId) delete payload.fecha_registro;

      // Si es nuevo, usamos set directamente con el push ref
      if (!editingId) {
        await set(itemRef, payload);
      } else {
        // Actualizamos manteniendo las propiedades que ya existieran
        const clientObj = clientes.find(c => c.id === editingId);
        await set(itemRef, { ...clientObj, ...payload });
      }

      toast.success(editingId ? 'Cliente actualizado' : 'Cliente registrado');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar a "${nombre}"?`)) return;
    try {
      await remove(ref(rtdb, `clientes/${id}`));
      toast.success("Cliente eliminado");
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    }
  };

  const filtered = clientes.filter(c => 
    c.nombre.toLowerCase().includes(search.toLowerCase()) || 
    (c.cedula && c.cedula.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600" /> 
            Cartera de Clientes
          </h1>
          <p className="text-gray-500 text-sm">Gestiona la información y límites de crédito de tus clientes.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
        >
          <Plus size={20} />
          Nuevo Cliente
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <input 
              type="text" 
              placeholder="Buscar por nombre o cédula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Contacto</th>
                <th className="p-4 text-right">Límite Crédito</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-400">Cargando clientes...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-gray-400">No se encontraron clientes.</td></tr>
              ) : (
                filtered.map(cliente => (
                  <tr key={cliente.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-800">{cliente.nombre}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <FileText size={12} /> {cliente.cedula || 'Sin cédula'}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-gray-700">
                        <Phone size={14} className="text-gray-400" /> 
                        {cliente.telefono1 || 'Sin teléfono'}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                        {cliente.direccion || 'Sin dirección'}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="font-bold text-emerald-600 flex items-center justify-end gap-1">
                        <CreditCard size={14} />
                        C$ {cliente.limite_credito?.toFixed(2) || '0.00'}
                      </div>
                    </td>
                    <td className="p-4 text-center flex justify-center gap-2">
                      <button onClick={() => handleOpenModal(cliente)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(cliente.id, cliente.nombre)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
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
                {editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
                  <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" placeholder="Ej: Juan Pérez" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cédula / RUC</label>
                  <input type="text" value={formData.cedula} onChange={e => setFormData({...formData, cedula: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" placeholder="Ej: 001-000000-0000A" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Límite de Crédito (C$)</label>
                  <input type="number" step="0.01" min="0" value={formData.limite_credito} onChange={e => setFormData({...formData, limite_credito: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono Principal</label>
                  <input type="tel" value={formData.telefono1} onChange={e => setFormData({...formData, telefono1: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" placeholder="Ej: 8888-8888" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono Secundario</label>
                  <input type="tel" value={formData.telefono2} onChange={e => setFormData({...formData, telefono2: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" placeholder="Opcional" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <textarea value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} rows="2" className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500 resize-none" placeholder="Dirección completa..."></textarea>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors">Cancelar</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-blue-200 transition-all active:scale-95">Guardar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
