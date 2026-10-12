import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { rtdb } from '../../firebase';
import { 
  Layers, Tag, MapPin, Plus, Trash2, Edit2, Search, 
  Sparkles, CheckCircle2, AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../ConfirmModal';

export default function ProductCatalogsManager() {
  const [activeCatalog, setActiveCatalog] = useState('categorias');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', descripcion: '' });

  const [confirmModal, setConfirmModal] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: null, 
    isDanger: true 
  });

  const catalogOptions = [
    { 
      id: 'categorias', 
      name: 'Categorías de Producto', 
      short: 'Categorías',
      icon: <Layers size={18} />, 
      color: 'blue',
      desc: 'Clasificación principal para repuestos, lubricantes y accesorios.'
    },
    { 
      id: 'modelos', 
      name: 'Marcas y Modelos de Moto', 
      short: 'Modelos / Marcas',
      icon: <Tag size={18} />, 
      color: 'purple',
      desc: 'Modelos para compatibilidad de repuestos (ej: Pulsar 200, YBR 125, Boxer).'
    },
    { 
      id: 'ubicaciones', 
      name: 'Ubicaciones en Bodega', 
      short: 'Ubicaciones',
      icon: <MapPin size={18} />, 
      color: 'emerald',
      desc: 'Estantes, anaqueles y pasillos para localizar físicamente el producto.'
    }
  ];

  useEffect(() => {
    setLoading(true);
    const dbRef = ref(rtdb, `catalogos/${activeCatalog}`);
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
  }, [activeCatalog]);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({ 
        nombre: item.nombre || '', 
        descripcion: item.descripcion || '' 
      });
    } else {
      setEditingId(null);
      setFormData({ nombre: '', descripcion: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return toast.error("El nombre es requerido");

    try {
      let itemRef;
      if (!editingId) {
        itemRef = push(ref(rtdb, `catalogos/${activeCatalog}`));
      } else {
        itemRef = ref(rtdb, `catalogos/${activeCatalog}/${editingId}`);
      }

      await set(itemRef, {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion?.trim() || ''
      });

      toast.success(editingId ? 'Registro actualizado' : 'Registro agregado al catálogo');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const requestDelete = (id, nombre) => {
    const curCat = catalogOptions.find(c => c.id === activeCatalog)?.name || activeCatalog;
    setConfirmModal({
      isOpen: true,
      title: `Eliminar de ${curCat}`,
      message: `¿Estás seguro de que deseas eliminar "${nombre}"? Esta acción no se puede deshacer.`,
      isDanger: true,
      onConfirm: () => handleDelete(id)
    });
  };

  const handleDelete = async (id) => {
    try {
      await remove(ref(rtdb, `catalogos/${activeCatalog}/${id}`));
      toast.success("Eliminado correctamente");
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    } finally {
      setConfirmModal({ ...confirmModal, isOpen: false });
    }
  };

  const seedSampleData = async () => {
    try {
      await set(ref(rtdb, 'catalogos/categorias'), {
        "c1": { nombre: "Lubricantes y Aceites", descripcion: "Aceites de motor 4T, 2T y transmisión" },
        "c2": { nombre: "Llantas y Neumáticos", descripcion: "Delanteras, traseras y tubos" },
        "c3": { nombre: "Sistema de Frenos", descripcion: "Pastillas, zapatas, bombas y discos" },
        "c4": { nombre: "Sistema Eléctrico", descripcion: "Baterías, bujías, CDI, focos" },
        "c5": { nombre: "Transmisión y Cadena", descripcion: "Kit de arrastre, sprockets, cadenas" }
      });
      await set(ref(rtdb, 'catalogos/modelos'), {
        "m1": { nombre: "Pulsar NS 200", descripcion: "Bajaj" },
        "m2": { nombre: "Yamaha YBR 125", descripcion: "Yamaha" },
        "m3": { nombre: "Honda CB 190R", descripcion: "Honda" },
        "m4": { nombre: "Boxer BM 150", descripcion: "Bajaj" },
        "m5": { nombre: "Suzuki GN 125", descripcion: "Suzuki" },
        "m6": { nombre: "Universal / Varios", descripcion: "Aplica a múltiples marcas" }
      });
      await set(ref(rtdb, 'catalogos/ubicaciones'), {
        "u1": { nombre: "Bodega Principal - Estante A1", descripcion: "Área de lubricantes pesados" },
        "u2": { nombre: "Bodega Principal - Estante B2", descripcion: "Repuestos pequeños y partes eléctricas" },
        "u3": { nombre: "Mostrador Frontal - Vitrina 1", descripcion: "Accesorios de alta rotación" },
        "u4": { nombre: "Área de Llantas - Rack 1", descripcion: "Llantas y cámaras" }
      });
      toast.success("Catálogos iniciales cargados con éxito");
    } catch (e) {
      toast.error("Error al cargar datos muestra: " + e.message);
    }
  };

  const filteredData = data.filter(item => {
    const term = search.toLowerCase();
    return (
      (item.nombre && item.nombre.toLowerCase().includes(term)) ||
      (item.descripcion && item.descripcion.toLowerCase().includes(term))
    );
  });

  const activeCatalogInfo = catalogOptions.find(c => c.id === activeCatalog) || catalogOptions[0];

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      
      {/* Selector de Catálogo Operativo (Pills) */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-black text-gray-800 flex items-center gap-2">
            <Layers className="text-blue-600" size={20} />
            Catálogos y Tablas Auxiliares de Productos
          </h2>
          <p className="text-xs text-gray-500">
            Tablas operativas requeridas para clasificar y organizar productos, repuestos y servicios.
          </p>
        </div>

        <button
          type="button"
          onClick={seedSampleData}
          className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 self-end md:self-auto"
        >
          <Sparkles size={14} className="text-amber-600" />
          Cargar Catálogos Iniciales
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {catalogOptions.map(cat => {
          const isSelected = activeCatalog === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setActiveCatalog(cat.id);
                setSearch('');
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200 scale-[1.01]'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
              }`}
            >
              <span className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {cat.icon}
              </span>
              <div className="min-w-0">
                <span className="font-black text-sm block truncate">{cat.name}</span>
                <span className={`text-[11px] block line-clamp-2 mt-0.5 leading-tight ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                  {cat.desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Contenedor de la Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Barra de Acciones y Búsqueda */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder={`Buscar en ${activeCatalogInfo.short.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-xs sm:text-sm bg-white"
            />
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 font-bold text-xs"
              >
                &times;
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-200 transition-all active:scale-95"
          >
            <Plus size={16} />
            Nueva {activeCatalog === 'categorias' ? 'Categoría' : activeCatalog === 'modelos' ? 'Marca / Modelo' : 'Ubicación'}
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-[11px] font-bold border-b border-gray-200 tracking-wider">
              <tr>
                <th className="p-4">Nombre / Etiqueta</th>
                <th className="p-4">Descripción / Detalles</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="3" className="p-8 text-center text-gray-400">
                    Cargando catálogo...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-8 text-center text-gray-400">
                    No se encontraron registros en {activeCatalogInfo.short.toLowerCase()}.
                  </td>
                </tr>
              ) : (
                filteredData.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span>{item.nombre}</span>
                    </td>
                    <td className="p-4 text-gray-500 text-xs sm:text-sm">
                      {item.descripcion || <span className="italic text-gray-300">Sin descripción</span>}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete(item.id, item.nombre)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Agregar / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <h2 className="text-base sm:text-lg font-black text-gray-800">
                {editingId ? `Editar ${activeCatalogInfo.short}` : `Nuevo Registro en ${activeCatalogInfo.short}`}
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
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder={
                      activeCatalog === 'categorias' ? 'Ej: Frenos, Lubricantes...' :
                      activeCatalog === 'modelos' ? 'Ej: Pulsar 200, YBR 125...' :
                      'Ej: Estante A1, Vitrina Central...'
                    }
                    className="w-full border-2 border-gray-200 p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-gray-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Descripción (Opcional)
                  </label>
                  <textarea
                    rows="3"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Detalles adicionales, marca fabricante, o referencia..."
                    className="w-full border-2 border-gray-200 p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm text-gray-700 resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
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
