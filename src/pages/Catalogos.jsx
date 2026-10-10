import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { Settings, Plus, Edit2, Trash2, Layers, MapPin, Wrench, Users, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Catalogos() {
  const [activeTab, setActiveTab] = useState('categorias');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', precio: 0 });

  const tabs = [
    { id: 'categorias', name: 'Categorías', icon: <Layers size={18} /> },
    { id: 'marcas', name: 'Marcas/Modelos', icon: <Tag size={18} /> },
    { id: 'ubicaciones', name: 'Ubicaciones', icon: <MapPin size={18} /> },
    { id: 'servicios', name: 'Servicios', icon: <Wrench size={18} /> },
    { id: 'mecanicos', name: 'Mecánicos', icon: <Users size={18} /> },
  ];

  useEffect(() => {
    const listRef = ref(rtdb, `catalogos/${activeTab}`);
    const unsub = onValue(listRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
        setData(parsed);
      } else {
        setData([]);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [activeTab]);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({ 
        nombre: item.nombre || '', 
        descripcion: item.descripcion || '', 
        precio: item.precio || 0 
      });
    } else {
      setEditingId(null);
      setFormData({ nombre: '', descripcion: '', precio: 0 });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return toast.error("El nombre es requerido");

    try {
      let itemId = editingId;
      let itemRef;
      
      if (!itemId) {
        itemRef = push(ref(rtdb, `catalogos/${activeTab}`));
      } else {
        itemRef = ref(rtdb, `catalogos/${activeTab}/${itemId}`);
      }

      const savePayload = { nombre: formData.nombre.trim() };
      if (activeTab === 'servicios') {
        savePayload.descripcion = formData.descripcion;
        savePayload.precio = Number(formData.precio);
      } else if (activeTab === 'categorias') {
        savePayload.descripcion = formData.descripcion;
      }

      await set(itemRef, savePayload);
      toast.success(editingId ? 'Actualizado correctamente' : 'Creado correctamente');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${nombre}"?`)) return;
    try {
      await remove(ref(rtdb, `catalogos/${activeTab}/${id}`));
      toast.success("Eliminado correctamente");
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Settings className="text-gray-600" /> 
            Catálogos del Sistema
          </h1>
          <p className="text-gray-500 text-sm">Administra las listas desplegables y servicios del taller.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row">
        
        {/* Sidebar de Tabs */}
        <div className="w-full md:w-64 bg-gray-50/50 border-r border-gray-100 p-4 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setLoading(true); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold ${
                activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              {tab.icon}
              {tab.name}
            </button>
          ))}
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 capitalize">
              {tabs.find(t => t.id === activeTab)?.name}
            </h2>
            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors text-sm"
            >
              <Plus size={18} />
              Nuevo
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                <tr>
                  <th className="p-4">Nombre</th>
                  {['categorias', 'servicios'].includes(activeTab) && <th className="p-4">Descripción</th>}
                  {activeTab === 'servicios' && <th className="p-4">Precio Est.</th>}
                  <th className="p-4 text-center w-24">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-gray-400">Cargando datos...</td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-8 text-center text-gray-400">No hay registros aún.</td>
                  </tr>
                ) : (
                  data.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-gray-800">{item.nombre}</td>
                      {['categorias', 'servicios'].includes(activeTab) && (
                        <td className="p-4 text-gray-600 truncate max-w-xs">{item.descripcion || '-'}</td>
                      )}
                      {activeTab === 'servicios' && (
                        <td className="p-4 font-medium text-emerald-600">C$ {item.precio?.toFixed(2) || '0.00'}</td>
                      )}
                      <td className="p-4 text-center flex justify-center gap-2">
                        <button onClick={() => handleOpenModal(item)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded transition-colors">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(item.id, item.nombre)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors">
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
      </div>

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">
                {editingId ? 'Editar Registro' : 'Nuevo Registro'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" />
              </div>
              
              {['categorias', 'servicios'].includes(activeTab) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <input type="text" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" />
                </div>
              )}
              
              {activeTab === 'servicios' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Estándar (C$)</label>
                  <input type="number" step="0.01" min="0" value={formData.precio} onChange={e => setFormData({...formData, precio: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" />
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100">Cancelar</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
