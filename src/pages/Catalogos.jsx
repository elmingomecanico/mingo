import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { Settings, Layers, Tag, MapPin, Plus, Trash2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

export default function Catalogos() {
  const [activeTab, setActiveTab] = useState('categorias');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '', precio: 0 });

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: true });

  const tabs = [
    { id: 'categorias', name: 'Categorías', icon: <Layers size={18} /> },
    { id: 'marcas', name: 'Marcas/Modelos', icon: <Tag size={18} /> },
    { id: 'ubicaciones', name: 'Ubicaciones', icon: <MapPin size={18} /> }
  ];

  useEffect(() => {
    setLoading(true);
    const dbRef = ref(rtdb, `catalogos/${activeTab}`);
    const unsub = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
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

      await set(itemRef, {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        precio: Number(formData.precio) || 0
      });

      toast.success(editingId ? 'Actualizado correctamente' : 'Agregado correctamente');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const requestDelete = (id, nombre) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Registro',
      message: `¿Estás seguro de que deseas eliminar "${nombre}" del catálogo de ${activeTab}?`,
      isDanger: true,
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      await remove(ref(rtdb, `catalogos/${activeTab}/${id}`));
      toast.success("Eliminado correctamente");
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    } finally {
      setConfirmModal({ ...confirmModal, isOpen: false });
    }
  };

  const requestSeed = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Cargar Datos de Prueba',
      message: 'Esto inyectará categorías, marcas y ubicaciones de prueba en tu base de datos. Útil para empezar a probar el sistema. ¿Proceder?',
      isDanger: false,
      onConfirm: seedCatalogos
    });
  };

  const seedCatalogos = async () => {
    setConfirmModal({ ...confirmModal, isOpen: false });
    try {
      await set(ref(rtdb, 'catalogos/categorias'), {
        "c1": { nombre: "Lubricantes" },
        "c2": { nombre: "Llantas" },
        "c3": { nombre: "Frenos" },
        "c4": { nombre: "Eléctrico" }
      });
      await set(ref(rtdb, 'catalogos/marcas'), {
        "m1": { nombre: "Yamaha" },
        "m2": { nombre: "Honda" },
        "m3": { nombre: "Suzuki" },
        "m4": { nombre: "Castrol" }
      });
      await set(ref(rtdb, 'catalogos/ubicaciones'), {
        "u1": { nombre: "Bodega Principal" },
        "u2": { nombre: "Estante A1" },
        "u3": { nombre: "Estante B2" }
      });
      toast.success("Datos de prueba generados correctamente");
    } catch (e) {
      toast.error("Error: " + e.message);
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
          <p className="text-gray-500 text-sm">Administra las listas desplegables menores del taller.</p>
        </div>
        <button onClick={requestSeed} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors">
          Cargar Datos de Prueba
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row">
        
        {/* Sidebar de Tabs */}
        <div className="w-full md:w-64 bg-gray-50/50 border-r border-gray-100 p-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                  : 'text-gray-600 hover:bg-gray-100'
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
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
            >
              <Plus size={16} /> Nuevo
            </button>
          </div>

          <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className="p-4 font-bold">Nombre</th>
                  <th className="p-4 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="2" className="p-8 text-center text-gray-400">Cargando...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan="2" className="p-8 text-center text-gray-400">No hay registros aún.</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} className="bg-white hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-gray-800">{item.nombre}</td>
                      <td className="p-4 flex justify-end gap-2">
                        <button onClick={() => handleOpenModal(item)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => requestDelete(item.id, item.nombre)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
                          <Trash2 size={16} />
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

      {/* Modal Agregar/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-800">
                {editingId ? 'Editar Registro' : 'Nuevo Registro'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre *</label>
                  <input 
                    required 
                    type="text" 
                    value={formData.nombre} 
                    onChange={e => setFormData({...formData, nombre: e.target.value})} 
                    className="w-full border-2 border-gray-200 p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm" 
                    placeholder="Ej: Llaves, Frenos..." 
                    autoFocus
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-gray-600 font-medium hover:bg-gray-100 text-sm">Cancelar</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold shadow-md active:scale-95 transition-all text-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación Genérico */}
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        isDanger={confirmModal.isDanger}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
      />
    </div>
  );
}
