import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push } from 'firebase/database';
import { rtdb } from '../firebase';
import { Search, Plus, Edit2, Package, History, Maximize2, ScanBarcode } from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import ImagePreviewModal from '../components/ImagePreviewModal';

export default function Inventario() {
  const [activeTab, setActiveTab] = useState('catalogo'); // 'catalogo' | 'ajustes'
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState({});
  const [ajustes, setAjustes] = useState([]);
  const [search, setSearch] = useState('');
  const [sucursal, setSucursal] = useState('SUC-01');
  const [loading, setLoading] = useState(true);
  
  // State para catálogos
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [modelosMoto, setModelosMoto] = useState([]);
  
  // Imagen Ampliada y Escáner de Código de Barras
  const [selectedPreviewProduct, setSelectedPreviewProduct] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Modal State para Producto
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', price: '', cost: '', cat: '', stock_actual: 0, stock_minimo: 0, ubicacion: '', compatibilidad: [], image: ''
  });

  // Modal State para Ajustes
  const [isAjusteModalOpen, setIsAjusteModalOpen] = useState(false);
  const [ajusteForm, setAjusteForm] = useState({ id_producto: null, nuevo_stock: '', motivo: '' });

  useEffect(() => {
    const prodsRef = ref(rtdb, 'productos');
    const invRef = ref(rtdb, `inventario/${sucursal}`);
    const catRef = ref(rtdb, 'catalogos/categorias');
    const ubiRef = ref(rtdb, 'catalogos/ubicaciones');
    const modRef = ref(rtdb, 'catalogos/modelos');
    const ajustesRef = ref(rtdb, `ajustes_inventario/${sucursal}`);

    const unsubProds = onValue(prodsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setProducts(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setProducts([]);
      }
    });

    const unsubInv = onValue(invRef, (snapshot) => {
      if (snapshot.exists()) setInventory(snapshot.val());
      else setInventory({});
      setLoading(false);
    });

    const unsubCat = onValue(catRef, (snapshot) => {
      if (snapshot.exists()) setCategorias(Object.values(snapshot.val()).map(c => c.nombre));
    });

    const unsubUbi = onValue(ubiRef, (snapshot) => {
      if (snapshot.exists()) setUbicaciones(Object.values(snapshot.val()).map(u => u.nombre));
    });

    const unsubMod = onValue(modRef, (snapshot) => {
      if (snapshot.exists()) setModelosMoto(Object.values(snapshot.val()).map(m => m.nombre));
    });

    const unsubAjustes = onValue(ajustesRef, (snapshot) => {
      if (snapshot.exists()) {
        const list = Object.keys(snapshot.val()).map(k => ({ id: k, ...snapshot.val()[k] }));
        setAjustes(list.sort((a,b) => new Date(b.fecha) - new Date(a.fecha)));
      } else {
        setAjustes([]);
      }
    });

    return () => {
      unsubProds(); unsubInv(); unsubCat(); unsubUbi(); unsubMod(); unsubAjustes();
    };
  }, [sucursal]);

  const searchTerms = search.toLowerCase().split(' ').filter(t => t.trim() !== '');
  const filtered = products.filter(p => {
    const textToSearch = `${p.name} ${p.id} ${p.cat || ''}`.toLowerCase();
    return searchTerms.every(term => textToSearch.includes(term));
  });

  const handleBarcodeInput = (code) => {
    if (!code || !code.trim()) return;
    const clean = code.trim().toLowerCase();
    setSearch(code.trim());
    const match = products.find(p => 
      p.id?.toLowerCase() === clean || 
      (p.barcode && p.barcode.toString().toLowerCase() === clean) ||
      (p.codigo_barra && p.codigo_barra.toString().toLowerCase() === clean)
    );
    if (match) {
      toast.success(`Producto encontrado: ${match.name}`, { icon: '📦' });
    }
  };

  const handleOpenModal = (prod = null) => {
    if (prod) {
      setEditingId(prod.id);
      const invData = inventory[prod.id] || { stock_actual: 0, stock_minimo: 0, ubicacion: '' };
      setFormData({
        name: prod.name,
        price: prod.price,
        cost: prod.cost || 0,
        cat: prod.cat || '',
        stock_actual: invData.stock_actual,
        stock_minimo: invData.stock_minimo || 0,
        ubicacion: invData.ubicacion || '',
        compatibilidad: prod.compatibilidad || [],
        image: prod.image || ''
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', price: '', cost: '', cat: '', stock_actual: 0, stock_minimo: 0, ubicacion: '', compatibilidad: [], image: '' });
    }
    setIsModalOpen(true);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Seleccione un archivo de imagen válido');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const base64Str = canvas.toDataURL('image/jpeg', 0.7);
        setFormData({ ...formData, image: base64Str });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      let prodId = editingId;
      if (!prodId) {
        const num = products.length + 1;
        prodId = `PROD-${num.toString().padStart(4, '0')}`;
        if (products.find(p => p.id === prodId)) {
          prodId = push(ref(rtdb, 'productos')).key;
        }
      }

      const prodRef = ref(rtdb, `productos/${prodId}`);
      await set(prodRef, {
        name: formData.name,
        price: Number(formData.price),
        cost: Number(formData.cost),
        cat: formData.cat,
        compatibilidad: formData.compatibilidad,
        image: formData.image
      });

      // Solo si es nuevo, guardar el stock. Si estamos editando, el stock no se toca por aquí.
      const invRef = ref(rtdb, `inventario/${sucursal}/${prodId}`);
      if (!editingId) {
        await set(invRef, {
          stock_actual: Number(formData.stock_actual),
          stock_minimo: Number(formData.stock_minimo),
          ubicacion: formData.ubicacion
        });
      } else {
        // Actualizar solo ubicacion y minimo si estamos editando
        const currentInv = inventory[prodId] || { stock_actual: 0 };
        await set(invRef, {
          stock_actual: currentInv.stock_actual,
          stock_minimo: Number(formData.stock_minimo),
          ubicacion: formData.ubicacion
        });
      }

      toast.success(editingId ? 'Producto actualizado' : 'Producto creado');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleSaveAjuste = async (e) => {
    e.preventDefault();
    if (!ajusteForm.id_producto || ajusteForm.nuevo_stock === '' || !ajusteForm.motivo) {
      return toast.error("Complete todos los campos del ajuste");
    }

    try {
      const pid = ajusteForm.id_producto.value;
      const pname = ajusteForm.id_producto.label;
      const nuevo = Number(ajusteForm.nuevo_stock);
      const anterior = inventory[pid]?.stock_actual || 0;
      const diff = nuevo - anterior;

      if (diff === 0) return toast.error("El nuevo stock es igual al anterior.");

      const currentUser = JSON.parse(localStorage.getItem('mingo_user') || '{}');

      // 1. Guardar registro
      await push(ref(rtdb, `ajustes_inventario/${sucursal}`), {
        id_producto: pid,
        nombre_producto: pname,
        stock_anterior: anterior,
        stock_nuevo: nuevo,
        diferencia: diff,
        motivo: ajusteForm.motivo,
        fecha: new Date().toISOString(),
        usuario: currentUser.nombre_completo || 'Sistema'
      });

      // 2. Registrar en Kardex
      const kardexRef = push(ref(rtdb, 'kardex'));
      await set(kardexRef, {
        fecha: new Date().toISOString(),
        id_sucursal: sucursal,
        id_producto: pid,
        nombre_producto: pname,
        tipo_movimiento: diff > 0 ? 'Entrada por Ajuste' : 'Salida por Ajuste',
        cantidad: Math.abs(diff),
        id_referencia: `Ajuste (${ajusteForm.motivo})`,
        stock_anterior: anterior,
        stock_nuevo: nuevo,
        usuario: currentUser.nombre_completo || 'Sistema'
      });

      // 3. Actualizar inventario
      const invRef = ref(rtdb, `inventario/${sucursal}/${pid}`);
      const invData = inventory[pid] || {};
      await set(invRef, {
        ...invData,
        stock_actual: nuevo
      });

      toast.success("Ajuste de inventario guardado");
      setIsAjusteModalOpen(false);
      setAjusteForm({ id_producto: null, nuevo_stock: '', motivo: '' });
    } catch (error) {
      toast.error("Error al guardar ajuste: " + error.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Package className="text-blue-600" /> 
            Gestión de Inventario
          </h1>
          <p className="text-gray-500 text-sm">Catálogo de productos y control de existencias.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select 
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
            className="border-gray-200 bg-white border p-2.5 rounded-lg font-medium text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="SUC-01">Sucursal Principal (SUC-01)</option>
            <option value="SUC-02">Sucursal Norte (SUC-02)</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200">
        <button onClick={() => setActiveTab('catalogo')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'catalogo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Catálogo de Productos</button>
        <button onClick={() => setActiveTab('ajustes')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'ajustes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Ajustes de Inventario</button>
      </div>

      {activeTab === 'catalogo' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex gap-2 flex-1 max-w-lg">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder="Buscar por código, nombre o categoría..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (search.trim()) handleBarcodeInput(search);
                    }
                  }}
                  className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                />
                <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                {search && (
                  <button 
                    onClick={() => setSearch('')} 
                    className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 text-sm font-bold"
                  >
                    &times;
                  </button>
                )}
              </div>
              <button 
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 whitespace-nowrap"
                title="Escanear código de barras con la cámara"
              >
                <ScanBarcode size={16} />
                <span className="hidden sm:inline">Cámara</span>
              </button>
            </div>
            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap"
            >
              <Plus size={18} /> Nuevo Producto
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                <tr>
                  <th className="p-4">Img / Cód</th>
                  <th className="p-4">Producto y Compatibilidad</th>
                  <th className="p-4">Categoría</th>
                  <th className="p-4 text-right">Precio Venta</th>
                  <th className="p-4 text-center">Stock</th>
                  <th className="p-4">Ubicación</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="7" className="p-8 text-center text-gray-400">Cargando inventario...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="7" className="p-8 text-center text-gray-400">No se encontraron productos.</td></tr>
                ) : (
                  filtered.map(prod => {
                    const inv = inventory[prod.id] || { stock_actual: 0 };
                    const isLowStock = inv.stock_actual <= (inv.stock_minimo || 0);
                    
                    return (
                      <tr key={prod.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {prod.image ? (
                              <div className="relative group cursor-pointer" onClick={() => setSelectedPreviewProduct(prod)} title="Ver foto en grande">
                                <img src={prod.image} alt={prod.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200 shadow-sm transition-opacity group-hover:opacity-80" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-lg transition-opacity">
                                  <Maximize2 size={16} className="text-white drop-shadow" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300">
                                <Package size={20} />
                              </div>
                            )}
                            <span className="font-mono text-xs text-gray-500">{prod.id}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-gray-800">{prod.name}</p>
                          {prod.compatibilidad && prod.compatibilidad.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {prod.compatibilidad.map((m, idx) => (
                                <span key={idx} className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-gray-600">
                          <span className="bg-gray-100 px-2 py-1 rounded text-xs">{prod.cat || 'N/A'}</span>
                        </td>
                        <td className="p-4 text-right font-medium text-emerald-600">C$ {prod.price}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {inv.stock_actual}
                          </span>
                        </td>
                        <td className="p-4 text-gray-500">{inv.ubicacion || '-'}</td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleOpenModal(prod)}
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition-colors"
                            title="Editar Producto"
                          >
                            <Edit2 size={18} />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ajustes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => {
              setAjusteForm({ id_producto: null, nuevo_stock: '', motivo: '' });
              setIsAjusteModalOpen(true);
            }} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-200">
              <History size={20} /> Nuevo Ajuste de Inventario
            </button>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {ajustes.length === 0 ? (
              <div className="p-10 text-center text-gray-500">No hay ajustes registrados en esta sucursal.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                    <tr>
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Producto</th>
                      <th className="p-4 text-center">Variación</th>
                      <th className="p-4 text-center">Stock Final</th>
                      <th className="p-4">Motivo</th>
                      <th className="p-4">Usuario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ajustes.map(aj => (
                      <tr key={aj.id} className="hover:bg-gray-50">
                        <td className="p-4 text-gray-600">{new Date(aj.fecha).toLocaleString()}</td>
                        <td className="p-4 font-bold text-gray-800">
                          {aj.nombre_producto} <span className="text-xs text-gray-400 font-mono ml-2">({aj.id_producto})</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${aj.diferencia > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {aj.diferencia > 0 ? '+' : ''}{aj.diferencia}
                          </span>
                        </td>
                        <td className="p-4 text-center font-black text-gray-700">{aj.stock_nuevo}</td>
                        <td className="p-4 text-gray-600">{aj.motivo}</td>
                        <td className="p-4 text-xs font-medium text-gray-500">{aj.usuario}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Formulario Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <h2 className="text-base sm:text-lg font-black text-gray-800">
                {editingId ? `Editar Producto: ${editingId}` : 'Nuevo Producto'}
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
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
                
                <div className="space-y-4">
                  <h3 className="font-bold text-blue-900 border-b pb-2 text-xs sm:text-sm uppercase tracking-wider">Datos Generales</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nombre del Producto *</label>
                      <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm" placeholder="Ej: Llanta Delantera 2.75-18" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Categoría</label>
                      <Select
                        options={categorias.map(c => ({ value: c, label: c }))}
                        value={formData.cat ? { value: formData.cat, label: formData.cat } : null}
                        onChange={(selected) => setFormData({ ...formData, cat: selected ? selected.value : '' })}
                        placeholder="Buscar categoría..."
                        isClearable
                        className="react-select-container text-sm"
                        classNamePrefix="react-select"
                      />
                    </div>
                    <div className="hidden sm:block"></div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Costo (Compra)</label>
                      <input type="number" step="0.01" min="0" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm font-bold" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Precio (Venta) *</label>
                      <input required type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-emerald-700" placeholder="0.00" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Compatibilidad (Modelos de Moto)</label>
                    <Select
                      isMulti
                      options={modelosMoto.map(m => ({ value: m, label: m }))}
                      value={(formData.compatibilidad || []).map(m => ({ value: m, label: m }))}
                      onChange={(selected) => setFormData({ ...formData, compatibilidad: selected.map(s => s.value) })}
                      placeholder="Seleccione los modelos compatibles..."
                      className="react-select-container text-xs sm:text-sm"
                      classNamePrefix="react-select"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Imagen del Producto (Opcional)</label>
                    <div className="flex items-center gap-4">
                      {formData.image && (
                        <div className="relative group cursor-pointer" onClick={() => setSelectedPreviewProduct({ name: formData.name || 'Vista previa', image: formData.image })}>
                          <img src={formData.image} alt="Vista previa" className="w-16 h-16 object-cover rounded-xl border border-gray-200" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-xl">
                            <Maximize2 size={16} className="text-white drop-shadow" />
                          </div>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs sm:text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                  </div>

                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-blue-900 border-b pb-2 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between">
                    <span>Inventario de Bodega</span>
                    <span className="text-blue-600 bg-blue-100 px-2 py-0.5 rounded text-xs">{sucursal}</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Stock Actual</label>
                      <input 
                        type="number" 
                        required 
                        value={formData.stock_actual} 
                        onChange={e => setFormData({...formData, stock_actual: e.target.value})} 
                        disabled={!!editingId}
                        title={editingId ? "El stock solo se puede modificar desde la pestaña 'Ajustes de Inventario' o mediante Compras/Ventas." : "Stock inicial del nuevo producto"}
                        className={`w-full border p-2.5 rounded-xl outline-none text-center ${editingId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:border-blue-500 font-bold'}`} 
                      />
                      {editingId && <span className="text-[10px] text-red-500 mt-1 block leading-tight">Para modificar el stock, use la pestaña "Ajustes".</span>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Stock Mínimo (Alerta)</label>
                      <input type="number" value={formData.stock_minimo} onChange={e => setFormData({...formData, stock_minimo: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 text-center" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Ubicación / Estante</label>
                      <Select
                        options={ubicaciones.map(u => ({ value: u, label: u }))}
                        value={formData.ubicacion ? { value: formData.ubicacion, label: formData.ubicacion } : null}
                        onChange={(selected) => setFormData({ ...formData, ubicacion: selected ? selected.value : '' })}
                        placeholder="Buscar ubicación..."
                        isClearable
                        className="react-select-container text-xs sm:text-sm"
                        classNamePrefix="react-select"
                      />
                    </div>
                  </div>
                </div>

              </div>

              <div className="p-3 sm:p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold shadow-md shadow-blue-200 transition-all active:scale-95 text-xs sm:text-sm">
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Formulario Ajuste */}
      {isAjusteModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                <History className="text-orange-600" size={20} />
                Ajuste de Inventario
              </h2>
              <button 
                type="button" 
                onClick={() => setIsAjusteModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSaveAjuste} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Producto</label>
                  <Select
                    options={products.map(p => ({ value: p.id, label: p.name, stock_actual: inventory[p.id]?.stock_actual || 0 }))}
                    value={ajusteForm.id_producto}
                    onChange={sel => {
                      setAjusteForm({ 
                        ...ajusteForm, 
                        id_producto: sel, 
                        nuevo_stock: sel ? sel.stock_actual : '' 
                      })
                    }}
                    placeholder="Seleccione el producto..."
                    className="react-select-container text-xs sm:text-sm"
                    classNamePrefix="react-select"
                  />
                </div>

                {ajusteForm.id_producto && (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Stock Actual</p>
                      <p className="text-xl font-black text-gray-800">{ajusteForm.id_producto.stock_actual}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-700 mb-1 uppercase">Nuevo Stock</label>
                      <input 
                        required 
                        type="number" 
                        value={ajusteForm.nuevo_stock} 
                        onChange={e => setAjusteForm({...ajusteForm, nuevo_stock: e.target.value})} 
                        className="w-full h-11 border p-2 rounded-xl outline-none focus:border-orange-500 font-bold text-center text-xl text-orange-600 bg-white" 
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Motivo del ajuste *</label>
                  <input 
                    required 
                    type="text" 
                    value={ajusteForm.motivo} 
                    onChange={e => setAjusteForm({...ajusteForm, motivo: e.target.value})} 
                    className="w-full border p-2.5 rounded-xl outline-none focus:border-orange-500 text-sm" 
                    placeholder="Ej: Conteo físico, Producto dañado, Caducidad..." 
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsAjusteModalOpen(false)} className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold shadow-md shadow-orange-200 transition-all active:scale-95 text-xs sm:text-sm">
                  Guardar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VISUALIZADOR DE FOTO DE PRODUCTO EN GRANDE */}
      <ImagePreviewModal
        isOpen={!!selectedPreviewProduct}
        onClose={() => setSelectedPreviewProduct(null)}
        product={selectedPreviewProduct}
      />

      {/* MODAL ESCÁNER DE CÓDIGO DE BARRAS POR CÁMARA */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(code) => handleBarcodeInput(code)}
      />

    </div>
  );
}
