import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, update, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import { 
  Search, Plus, Edit2, Package, History, Maximize2, ScanBarcode, 
  Sliders, ShieldCheck, AlertTriangle, CheckCircle2, Percent, 
  RotateCcw, Sparkles, AlertCircle, Building2, Layers, Check, X,
  Hash, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import { DEFAULT_CONSECUTIVOS, formatConsecutive } from '../components/catalogos/ConsecutivosManager';
import ProductCatalogsManager from '../components/inventario/ProductCatalogsManager';

export const canSellNegative = (product, globalPoliticas) => {
  if (!product) return false;
  if (product.type === 'servicio') return true;
  if (product.permitir_negativo === 'si') return true;
  if (product.permitir_negativo === 'no') return false;
  return Boolean(globalPoliticas?.permitir_venta_negativa_global);
};

export const canApplyDiscount = (product, globalPoliticas) => {
  if (!product) return true;
  if (product.permite_descuento === false) return false;
  if (globalPoliticas?.permitir_descuento_global === false) return false;
  return true;
};

export const getMaxAllowedDiscount = (product, globalPoliticas) => {
  if (!canApplyDiscount(product, globalPoliticas)) return 0;
  if (product?.descuento_maximo !== undefined && product?.descuento_maximo !== null && product?.descuento_maximo !== '') {
    return Number(product.descuento_maximo);
  }
  return Number(globalPoliticas?.descuento_maximo_global ?? 15);
};

export default function Inventario() {
  const [activeTab, setActiveTab] = useState('catalogo'); // 'catalogo' | 'ajustes' | 'politicas' | 'tablas_catalogos'
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState({});
  const [allInventory, setAllInventory] = useState({});
  const [ajustes, setAjustes] = useState([]);
  const [search, setSearch] = useState('');
  const [sucursal, setSucursal] = useState('SUC-01');
  const [loading, setLoading] = useState(true);
  const [consecutivosConfig, setConsecutivosConfig] = useState(DEFAULT_CONSECUTIVOS);
  
  // Políticas de Inventario y Venta en Negativo
  const [politicas, setPoliticas] = useState({
    permitir_venta_negativa_global: false,
    alerta_stock_negativo: true,
    permitir_descuento_global: true,
    descuento_maximo_global: 15
  });
  const [savingPoliticas, setSavingPoliticas] = useState(false);
  const [politicasSearch, setPoliticasSearch] = useState('');
  const [politicasFilterNegativo, setPoliticasFilterNegativo] = useState('todos'); // 'todos' | 'heredar' | 'si' | 'no'

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
    codigo_visible: '', name: '', price: '', cost: '', cat: '', stock_actual: 0, stock_minimo: 0, ubicacion: '', compatibilidad: [], image: '',
    permitir_negativo: 'heredar', permite_descuento: true, descuento_maximo: 15
  });

  // Modal State para Ajustes
  const [isAjusteModalOpen, setIsAjusteModalOpen] = useState(false);
  const [ajusteForm, setAjusteForm] = useState({ id_producto: null, nuevo_stock: '', motivo: '' });

  // Modal State para Agregar Rápidamente (Categorías, Modelos, Ubicaciones) sin salir del formulario
  const [quickAddModal, setQuickAddModal] = useState({ isOpen: false, type: 'categoria', value: '', desc: '' });

  const handleQuickAddSave = async (e) => {
    e?.preventDefault();
    if (!quickAddModal.value.trim()) return toast.error("El nombre es requerido");
    const name = quickAddModal.value.trim();
    const desc = quickAddModal.desc?.trim() || '';

    try {
      if (quickAddModal.type === 'categoria') {
        await push(ref(rtdb, 'catalogos/categorias'), { nombre: name, descripcion: desc });
        setFormData(prev => ({ ...prev, cat: name }));
        toast.success(`Categoría "${name}" agregada y seleccionada`);
      } else if (quickAddModal.type === 'modelo') {
        await push(ref(rtdb, 'catalogos/modelos'), { nombre: name, descripcion: desc });
        setFormData(prev => ({ ...prev, compatibilidad: [...(prev.compatibilidad || []), name] }));
        toast.success(`Modelo "${name}" agregado y seleccionado`);
      } else if (quickAddModal.type === 'ubicacion') {
        await push(ref(rtdb, 'catalogos/ubicaciones'), { nombre: name, descripcion: desc });
        setFormData(prev => ({ ...prev, ubicacion: name }));
        toast.success(`Ubicación "${name}" agregada y seleccionada`);
      }
      setQuickAddModal({ isOpen: false, type: 'categoria', value: '', desc: '' });
    } catch (err) {
      toast.error("Error al registrar: " + err.message);
    }
  };

  useEffect(() => {
    const prodsRef = ref(rtdb, 'productos');
    const invRef = ref(rtdb, `inventario/${sucursal}`);
    const allInvRef = ref(rtdb, 'inventario');
    const politicasRef = ref(rtdb, 'configuracion/inventario');
    const catRef = ref(rtdb, 'catalogos/categorias');
    const ubiRef = ref(rtdb, 'catalogos/ubicaciones');
    const modRef = ref(rtdb, 'catalogos/modelos');
    const ajustesRef = ref(rtdb, `ajustes_inventario/${sucursal}`);
    const consRef = ref(rtdb, 'configuracion/consecutivos');

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

    const unsubAllInv = onValue(allInvRef, (snapshot) => {
      if (snapshot.exists()) setAllInventory(snapshot.val());
      else setAllInventory({});
    });

    const unsubPoliticas = onValue(politicasRef, (snapshot) => {
      if (snapshot.exists()) {
        setPoliticas(prev => ({ ...prev, ...snapshot.val() }));
      }
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

    const unsubCons = onValue(consRef, (snapshot) => {
      if (snapshot.exists()) {
        setConsecutivosConfig({ ...DEFAULT_CONSECUTIVOS, ...snapshot.val() });
      }
    });

    return () => {
      unsubProds(); unsubInv(); unsubAllInv(); unsubPoliticas(); unsubCat(); unsubUbi(); unsubMod(); unsubAjustes(); unsubCons();
    };
  }, [sucursal]);

  const handleSavePoliticasGlobal = async (newPoliticas) => {
    setSavingPoliticas(true);
    try {
      await set(ref(rtdb, 'configuracion/inventario'), newPoliticas);
      toast.success('Políticas globales de inventario guardadas');
    } catch (e) {
      toast.error('Error al guardar políticas: ' + e.message);
    } finally {
      setSavingPoliticas(false);
    }
  };

  const handleUpdateProductPolitica = async (productId, field, value) => {
    try {
      await update(ref(rtdb, `productos/${productId}`), { [field]: value });
      toast.success('Condición de producto actualizada', { id: `pol_${productId}` });
    } catch (e) {
      toast.error('Error al actualizar: ' + e.message);
    }
  };

  const handleBulkUpdatePolitica = async (actionType) => {
    if (products.length === 0) return;
    const confirmMsg = 
      actionType === 'permitir_todos' ? '¿Permitir venta en negativo a TODOS los productos del catálogo?' :
      actionType === 'bloquear_todos' ? '¿Bloquear venta en negativo (exigir stock) a TODOS los productos?' :
      actionType === 'heredar_todos' ? '¿Restablecer TODOS los productos a "Heredar regla global"?' :
      actionType === 'habilitar_descuentos' ? '¿Habilitar descuentos a TODOS los productos?' :
      '¿Bloquear descuentos a TODOS los productos?';

    if (!window.confirm(confirmMsg)) return;

    setSavingPoliticas(true);
    try {
      const updates = {};
      products.forEach(p => {
        if (actionType === 'permitir_todos') {
          updates[`productos/${p.id}/permitir_negativo`] = 'si';
        } else if (actionType === 'bloquear_todos') {
          updates[`productos/${p.id}/permitir_negativo`] = 'no';
        } else if (actionType === 'heredar_todos') {
          updates[`productos/${p.id}/permitir_negativo`] = 'heredar';
        } else if (actionType === 'habilitar_descuentos') {
          updates[`productos/${p.id}/permite_descuento`] = true;
        } else if (actionType === 'bloquear_descuentos') {
          updates[`productos/${p.id}/permite_descuento`] = false;
        }
      });
      await update(ref(rtdb), updates);
      toast.success('Catálogo actualizado masivamente');
    } catch (e) {
      toast.error('Error en actualización masiva: ' + e.message);
    } finally {
      setSavingPoliticas(false);
    }
  };

  const searchTerms = search.toLowerCase().split(' ').filter(t => t.trim() !== '');
  const filtered = products.filter(p => {
    const textToSearch = `${p.name} ${p.codigo_visible || ''} ${p.id} ${p.cat || ''}`.toLowerCase();
    return searchTerms.every(term => textToSearch.includes(term));
  });

  const handleBarcodeInput = (code) => {
    if (!code || !code.trim()) return;
    const clean = code.trim().toLowerCase();
    setSearch(code.trim());
    const match = products.find(p => 
      p.id?.toLowerCase() === clean || 
      (p.codigo_visible && p.codigo_visible.toString().toLowerCase() === clean) ||
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
        codigo_visible: prod.codigo_visible || prod.id,
        name: prod.name,
        price: prod.price,
        cost: prod.cost || 0,
        cat: prod.cat || '',
        stock_actual: invData.stock_actual,
        stock_minimo: invData.stock_minimo || 0,
        ubicacion: invData.ubicacion || '',
        compatibilidad: prod.compatibilidad || [],
        image: prod.image || '',
        permitir_negativo: prod.permitir_negativo || 'heredar',
        permite_descuento: prod.permite_descuento !== undefined ? Boolean(prod.permite_descuento) : true,
        descuento_maximo: prod.descuento_maximo !== undefined ? Number(prod.descuento_maximo) : 15
      });
    } else {
      setEditingId(null);
      const prodCfg = consecutivosConfig?.productos || DEFAULT_CONSECUTIVOS.productos;
      const nextNum = prodCfg.siguiente_numero || (products.length + 1);
      const suggestedCode = formatConsecutive(prodCfg, nextNum);
      setFormData({ 
        codigo_visible: suggestedCode,
        name: '', price: '', cost: '', cat: '', stock_actual: 0, stock_minimo: 0, ubicacion: '', compatibilidad: [], image: '',
        permitir_negativo: 'heredar', permite_descuento: true, descuento_maximo: 15
      });
    }
    setIsModalOpen(true);
  };

  const handleRegenerateProductCode = () => {
    const prodCfg = consecutivosConfig?.productos || DEFAULT_CONSECUTIVOS.productos;
    const nextNum = prodCfg.siguiente_numero || (products.length + 1);
    const suggestedCode = formatConsecutive(prodCfg, nextNum);
    setFormData(prev => ({ ...prev, codigo_visible: suggestedCode }));
    toast.success(`Código sugerido: ${suggestedCode}`, { icon: '✨' });
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
        // Garantizar UUID interno único e irrepetible para Firebase
        prodId = push(ref(rtdb, 'productos')).key;
      }

      const codigoFinal = formData.codigo_visible?.trim() || prodId;

      const prodRef = ref(rtdb, `productos/${prodId}`);
      await set(prodRef, {
        id: prodId,
        codigo_visible: codigoFinal,
        name: formData.name,
        price: Number(formData.price),
        cost: Number(formData.cost),
        cat: formData.cat,
        compatibilidad: formData.compatibilidad,
        image: formData.image,
        permitir_negativo: formData.permitir_negativo || 'heredar',
        permite_descuento: formData.permite_descuento !== undefined ? Boolean(formData.permite_descuento) : true,
        descuento_maximo: Number(formData.descuento_maximo) || 15
      });

      // Solo si es nuevo, guardar el stock. Si estamos editando, el stock no se toca por aquí.
      const invRef = ref(rtdb, `inventario/${sucursal}/${prodId}`);
      if (!editingId) {
        await set(invRef, {
          stock_actual: Number(formData.stock_actual),
          stock_minimo: Number(formData.stock_minimo),
          ubicacion: formData.ubicacion
        });

        // Actualizar el correlativo sugerido para productos
        await runTransaction(ref(rtdb, 'configuracion/consecutivos/productos/siguiente_numero'), (cur) => {
          return (Number(cur) || 1) + 1;
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

      toast.success(editingId ? 'Producto actualizado' : 'Producto creado con UUID interno y código visible');
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
        <button onClick={() => setActiveTab('politicas')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'politicas' ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <ShieldCheck size={16} /> Políticas y Condiciones (Gerencia)
        </button>
        <button onClick={() => setActiveTab('tablas_catalogos')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'tablas_catalogos' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Layers size={16} /> Categorías, Marcas y Ubicaciones
        </button>
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
                            <div className="flex flex-col">
                              <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {prod.codigo_visible || prod.id}
                              </span>
                              {prod.codigo_visible && prod.codigo_visible !== prod.id && (
                                <span className="font-mono text-[9px] text-gray-400 truncate max-w-[100px]" title={`UUID interno en base de datos: ${prod.id}`}>
                                  UUID: {prod.id.substring(0, 8)}...
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-gray-800">{prod.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {canSellNegative(prod, politicas) ? (
                              <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1" title="Venta en negativo permitida por gerencia">
                                ⚡ Venta Negativa Autorizada
                              </span>
                            ) : (
                              <span className="bg-gray-50 border border-gray-200 text-gray-600 text-[10px] font-medium px-1.5 py-0.5 rounded" title="Bloqueado en POS si no hay existencias">
                                🔒 Requiere Stock
                              </span>
                            )}
                            {prod.permite_descuento === false ? (
                              <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                Sin Descuento
                              </span>
                            ) : (
                              <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                Desc. Máx: {getMaxAllowedDiscount(prod, politicas)}%
                              </span>
                            )}
                          </div>
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

      {activeTab === 'politicas' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* HEADER & RESUMEN DE GERENCIA */}
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 rounded-2xl border border-amber-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-amber-600 text-white shadow-sm shrink-0">
                <ShieldCheck size={22} />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-black text-amber-950">
                  Políticas de Inventario y Condiciones Comerciales
                </h2>
                <p className="text-xs sm:text-sm text-amber-800">
                  Control gerencial de venta en negativo (urgencias comerciales con mercancía física sin registrar en sistema) y topes de descuento.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              <button
                type="button"
                onClick={() => handleSavePoliticasGlobal(politicas)}
                disabled={savingPoliticas}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-amber-200 transition-all active:scale-95"
              >
                <Check size={16} />
                {savingPoliticas ? 'Guardando...' : 'Guardar Políticas Globales'}
              </button>
            </div>
          </div>

          {/* TARJETAS DE POLÍTICAS GLOBALES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CARD 1: VENTA NEGATIVA GLOBAL */}
            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              politicas.permitir_venta_negativa_global
                ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/40 shadow-xs'
                : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    politicas.permitir_venta_negativa_global ? 'bg-amber-200 text-amber-900' : 'bg-gray-100 text-gray-600'
                  }`}>
                    Regla Global por Defecto
                  </span>
                  <h3 className="font-bold text-gray-900 text-sm mt-1.5 flex items-center gap-1.5">
                    <span>Venta en Negativo</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">
                    Permite vender en el POS cuando el stock en sistema sea 0 o menor. Al ingresar la factura de compra física, el stock negativo se compensará automáticamente (ej: -2 + 10 = +8).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !politicas.permitir_venta_negativa_global;
                    const next = { ...politicas, permitir_venta_negativa_global: nextVal };
                    setPoliticas(next);
                    handleSavePoliticasGlobal(next);
                  }}
                  className={`w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 shrink-0 ${
                    politicas.permitir_venta_negativa_global ? 'bg-amber-600' : 'bg-gray-300'
                  }`}
                >
                  <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                    politicas.permitir_venta_negativa_global ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Estado global:</span>
                <span className={`font-black ${politicas.permitir_venta_negativa_global ? 'text-amber-700' : 'text-gray-700'}`}>
                  {politicas.permitir_venta_negativa_global ? '⚡ AUTORIZADO' : '🔒 BLOQUEADO'}
                </span>
              </div>
            </div>

            {/* CARD 2: ALERTA DE STOCK NEGATIVO */}
            <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              politicas.alerta_stock_negativo
                ? 'bg-blue-50/60 border-blue-200 shadow-xs'
                : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    Notificación en Caja
                  </span>
                  <h3 className="font-bold text-gray-900 text-sm mt-1.5 flex items-center gap-1.5">
                    <span>Alerta Visual de Existencia Faltante</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">
                    Muestra advertencia en color amarillo/naranja en el POS cuando un artículo se agregue o venda en números negativos para recordar al cajero que la compra está pendiente de cargar.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !politicas.alerta_stock_negativo;
                    const next = { ...politicas, alerta_stock_negativo: nextVal };
                    setPoliticas(next);
                    handleSavePoliticasGlobal(next);
                  }}
                  className={`w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 shrink-0 ${
                    politicas.alerta_stock_negativo ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                    politicas.alerta_stock_negativo ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Aviso en POS:</span>
                <span className={`font-black ${politicas.alerta_stock_negativo ? 'text-blue-700' : 'text-gray-700'}`}>
                  {politicas.alerta_stock_negativo ? '🔔 ACTIVA' : 'SILENCIADA'}
                </span>
              </div>
            </div>

            {/* CARD 3: DESCUENTO GLOBAL */}
            <div className="p-4 sm:p-5 rounded-2xl border bg-white border-gray-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Margen Comercial
                    </span>
                    <h3 className="font-bold text-gray-900 text-sm mt-1.5">
                      Descuentos Máximos en Mostrador
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 leading-snug">
                      Permitir que el cajero aplique rebajas en el mostrador y definir el límite porcentual global para artículos sin regla específica.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !politicas.permitir_descuento_global;
                      const next = { ...politicas, permitir_descuento_global: nextVal };
                      setPoliticas(next);
                      handleSavePoliticasGlobal(next);
                    }}
                    className={`w-12 h-7 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 shrink-0 ${
                      politicas.permitir_descuento_global ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                      politicas.permitir_descuento_global ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700 uppercase">Tope Global:</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={politicas.descuento_maximo_global || 15}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(0, Number(e.target.value)));
                        setPoliticas({ ...politicas, descuento_maximo_global: val });
                      }}
                      onBlur={() => handleSavePoliticasGlobal(politicas)}
                      className="w-16 p-1.5 text-center text-xs font-bold border border-gray-200 rounded-lg outline-none focus:border-emerald-500"
                    />
                    <span className="text-xs font-bold text-gray-500">%</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Permitir descuentos:</span>
                <span className={`font-black ${politicas.permitir_descuento_global ? 'text-emerald-700' : 'text-gray-700'}`}>
                  {politicas.permitir_descuento_global ? `SÍ (Máx ${politicas.descuento_maximo_global || 15}%)` : 'BLOQUEADOS'}
                </span>
              </div>
            </div>
          </div>

          {/* ACCIONES MASIVAS */}
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-black uppercase text-gray-600 tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-600" />
                Acciones Masivas Rápidas para el Catálogo ({products.length} productos)
              </span>
              <span className="text-[11px] text-gray-400">
                Aplica la misma condición a todos los artículos en un solo clic
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleBulkUpdatePolitica('heredar_todos')}
                disabled={savingPoliticas}
                className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <span>🌐 Restablecer Todos a "Heredar Regla Global"</span>
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdatePolitica('permitir_todos')}
                disabled={savingPoliticas}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-bold text-amber-800 shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <span>⚡ Permitir Venta en Negativo a Todos</span>
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdatePolitica('bloquear_todos')}
                disabled={savingPoliticas}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <span>🔒 Bloquear Venta en Negativo a Todos</span>
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdatePolitica('habilitar_descuentos')}
                disabled={savingPoliticas}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <span>🏷️ Habilitar Descuentos a Todos</span>
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdatePolitica('bloquear_descuentos')}
                disabled={savingPoliticas}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 border border-gray-300 rounded-xl text-xs font-bold text-gray-800 shadow-2xs transition-colors flex items-center gap-1.5"
              >
                <span>🚫 Bloquear Descuentos a Todos</span>
              </button>
            </div>
          </div>

          {/* MATRIZ DE POLÍTICAS POR PRODUCTO */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* BARRA DE FILTRO Y BÚSQUEDA */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Filtrar por código, nombre o categoría..."
                  value={politicasSearch}
                  onChange={(e) => setPoliticasSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl outline-none focus:border-amber-500 text-xs sm:text-sm bg-white"
                />
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                {politicasSearch && (
                  <button
                    onClick={() => setPoliticasSearch('')}
                    className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 font-bold text-xs"
                  >
                    &times;
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-600 uppercase">Filtro Negativo:</label>
                <select
                  value={politicasFilterNegativo}
                  onChange={(e) => setPoliticasFilterNegativo(e.target.value)}
                  className="border border-gray-200 bg-white p-2 rounded-xl text-xs font-medium outline-none focus:border-amber-500"
                >
                  <option value="todos">Todos los productos</option>
                  <option value="heredar">🌐 Heredan Regla Global</option>
                  <option value="si">✅ Permitidos Siempre</option>
                  <option value="no">🚫 Bloqueados Siempre</option>
                </select>
              </div>
            </div>

            {/* TABLA DE PRODUCTOS */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="p-3.5">Producto</th>
                    <th className="p-3.5 text-center">Stock Actual (Sucursales)</th>
                    <th className="p-3.5">Política Venta en Negativo</th>
                    <th className="p-3.5">Descuento</th>
                    <th className="p-3.5 text-center">Descuento Máx (%)</th>
                    <th className="p-3.5 text-center">Efecto en Caja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const terms = politicasSearch.toLowerCase().split(' ').filter(t => t.trim() !== '');
                    const listFiltered = products.filter(p => {
                      const text = `${p.name} ${p.id} ${p.cat || ''}`.toLowerCase();
                      const matchText = terms.every(t => text.includes(t));
                      if (!matchText) return false;
                      if (politicasFilterNegativo !== 'todos') {
                        const val = p.permitir_negativo || 'heredar';
                        if (val !== politicasFilterNegativo) return false;
                      }
                      return true;
                    });

                    if (listFiltered.length === 0) {
                      return (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-gray-400">
                            No se encontraron productos con los filtros seleccionados.
                          </td>
                        </tr>
                      );
                    }

                    return listFiltered.map(p => {
                      const stockP = allInventory['SUC-01']?.[p.id]?.stock_actual || 0;
                      const stockN = allInventory['SUC-02']?.[p.id]?.stock_actual || 0;
                      const totalStock = stockP + stockN;
                      const negEffective = canSellNegative(p, politicas);
                      const currentNegRule = p.permitir_negativo || 'heredar';
                      const currentAllowsDisc = p.permite_descuento !== undefined ? Boolean(p.permite_descuento) : true;
                      const maxDisc = p.descuento_maximo !== undefined ? Number(p.descuento_maximo) : 15;

                      return (
                        <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                          {/* PRODUCTO */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              {p.image ? (
                                <img src={p.image} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-gray-200" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                                  <Package size={16} />
                                </div>
                              )}
                              <div>
                                <span className="font-mono text-[10px] text-gray-400 font-bold block">{p.id}</span>
                                <span className="font-bold text-gray-900 block max-w-xs truncate" title={p.name}>{p.name}</span>
                                <span className="text-[10px] text-gray-400">{p.cat || 'General'}</span>
                              </div>
                            </div>
                          </td>

                          {/* STOCK POR SUCURSALES */}
                          <td className="p-3.5 text-center">
                            <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 px-2 py-1 rounded-xl text-xs">
                              <span title="Sucursal Principal (SUC-01)" className={stockP <= 0 ? 'text-rose-600 font-bold' : 'text-gray-700'}>
                                P: {stockP}
                              </span>
                              <span className="text-gray-300">|</span>
                              <span title="Sucursal Norte (SUC-02)" className={stockN <= 0 ? 'text-rose-600 font-bold' : 'text-gray-700'}>
                                N: {stockN}
                              </span>
                              <span className="text-gray-300">|</span>
                              <span className={`font-black ${totalStock <= 0 ? 'text-rose-600' : 'text-green-700'}`}>
                                Tot: {totalStock}
                              </span>
                            </div>
                          </td>

                          {/* POLÍTICA VENTA EN NEGATIVO */}
                          <td className="p-3.5">
                            <select
                              value={currentNegRule}
                              onChange={(e) => handleUpdateProductPolitica(p.id, 'permitir_negativo', e.target.value)}
                              className={`p-2 rounded-xl text-xs font-bold border outline-none cursor-pointer transition-colors ${
                                currentNegRule === 'si'
                                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                                  : currentNegRule === 'no'
                                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                                    : 'bg-white border-gray-200 text-gray-700'
                              }`}
                            >
                              <option value="heredar">🌐 Heredar Global ({politicas.permitir_venta_negativa_global ? 'Permitido' : 'Bloqueado'})</option>
                              <option value="si">✅ Permitir Siempre en Negativo</option>
                              <option value="no">🚫 Bloquear Siempre si Stock ≤ 0</option>
                            </select>
                          </td>

                          {/* AUTORIZAR DESCUENTO */}
                          <td className="p-3.5">
                            <select
                              value={currentAllowsDisc ? 'si' : 'no'}
                              onChange={(e) => handleUpdateProductPolitica(p.id, 'permite_descuento', e.target.value === 'si')}
                              className={`p-2 rounded-xl text-xs font-bold border outline-none cursor-pointer ${
                                currentAllowsDisc ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'
                              }`}
                            >
                              <option value="si">✅ Sí Autorizado</option>
                              <option value="no">🚫 Bloqueado</option>
                            </select>
                          </td>

                          {/* DESCUENTO MÁX (%) */}
                          <td className="p-3.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              disabled={!currentAllowsDisc}
                              value={maxDisc}
                              onChange={(e) => {
                                const val = Math.min(100, Math.max(0, Number(e.target.value)));
                                handleUpdateProductPolitica(p.id, 'descuento_maximo', val);
                              }}
                              className="w-16 p-1.5 text-center text-xs font-bold border border-gray-200 rounded-lg outline-none focus:border-amber-500 disabled:bg-gray-100 disabled:text-gray-400"
                            />
                          </td>

                          {/* EFECTO EN CAJA */}
                          <td className="p-3.5 text-center">
                            {negEffective ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                ⚡ Negativo Autorizado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                🔒 Requiere Stock
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tablas_catalogos' && (
        <ProductCatalogsManager />
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
                  <h3 className="font-bold text-blue-900 border-b pb-2 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between">
                    <span>Identificación Comercial y Códigos</span>
                    {editingId && (
                      <span className="text-[11px] font-mono font-semibold bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-gray-200">
                        <Lock size={11} /> UUID: {editingId}
                      </span>
                    )}
                  </h3>

                  {/* Campo de Código Visible / SKU Comercial */}
                  <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="text-xs font-bold text-blue-950 uppercase flex items-center gap-1.5">
                        <Hash size={14} className="text-blue-700" />
                        Código Visible / SKU Comercial *
                      </label>
                      <button
                        type="button"
                        onClick={handleRegenerateProductCode}
                        className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 self-start sm:self-auto bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs hover:bg-blue-50 transition-colors"
                        title="Regenerar sugerencia según regla de correlativos configurada por el SuperAdmin"
                      >
                        <Sparkles size={13} /> Sugerir Consecutivo
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      value={formData.codigo_visible}
                      onChange={e => setFormData({ ...formData, codigo_visible: e.target.value })}
                      placeholder="Ej: #REP-001, 10W40*, MOT-YMH-01, etc."
                      className="w-full border-2 border-blue-300 p-2.5 rounded-xl outline-none focus:border-blue-600 font-mono font-bold text-sm text-blue-900 bg-white"
                    />
                    <p className="text-[11px] text-blue-800 leading-tight">
                      ✨ <strong>Libertad de formato:</strong> Puede contener letras, números y símbolos especiales. Cada producto mantiene un UUID interno único e inalterable en base de datos.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Nombre del Producto *</label>
                      <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm" placeholder="Ej: Llanta Delantera 2.75-18" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-gray-700 uppercase">Categoría</label>
                        <button
                          type="button"
                          onClick={() => setQuickAddModal({ isOpen: true, type: 'categoria', value: '', desc: '' })}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors"
                          title="Crear nueva categoría sin salir del formulario"
                        >
                          <Plus size={12} /> Nueva
                        </button>
                      </div>
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
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-gray-700 uppercase">Compatibilidad (Modelos de Moto)</label>
                      <button
                        type="button"
                        onClick={() => setQuickAddModal({ isOpen: true, type: 'modelo', value: '', desc: '' })}
                        className="text-[11px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded transition-colors"
                        title="Crear nuevo modelo de moto sin salir del formulario"
                      >
                        <Plus size={12} /> Nuevo Modelo
                      </button>
                    </div>
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
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-gray-700 uppercase">Ubicación / Estante</label>
                        <button
                          type="button"
                          onClick={() => setQuickAddModal({ isOpen: true, type: 'ubicacion', value: '', desc: '' })}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded transition-colors"
                          title="Crear nueva ubicación en bodega sin salir del formulario"
                        >
                          <Plus size={12} /> Nueva
                        </button>
                      </div>
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

                {/* POLÍTICAS Y CONDICIONES (DECISIÓN DE GERENCIA) */}
                <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                    <h3 className="font-bold text-amber-950 text-xs sm:text-sm flex items-center gap-1.5 uppercase tracking-wider">
                      <ShieldCheck size={16} className="text-amber-700" />
                      Políticas y Condiciones del Producto
                    </h3>
                    <span className="text-[10px] uppercase font-black tracking-wider bg-amber-200 text-amber-800 px-2 py-0.5 rounded">
                      Gerencia
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-amber-900 mb-1 uppercase">
                        Venta en Negativo
                      </label>
                      <select 
                        value={formData.permitir_negativo} 
                        onChange={e => setFormData({ ...formData, permitir_negativo: e.target.value })}
                        className="w-full border border-amber-300 bg-white p-2.5 rounded-xl outline-none focus:border-amber-500 text-xs sm:text-sm font-medium"
                      >
                        <option value="heredar">🌐 Heredar Global ({politicas.permitir_venta_negativa_global ? 'Permitido' : 'Bloqueado'})</option>
                        <option value="si">✅ Permitir Venta en Negativo</option>
                        <option value="no">🚫 Bloquear (Exigir Stock)</option>
                      </select>
                      <span className="text-[10px] text-amber-800 mt-1 block leading-tight">
                        Venta urgente si está en físico pero no registrado en sistema. Se compensa al cargar la compra.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-900 mb-1 uppercase">
                        Autorizar Descuento
                      </label>
                      <select 
                        value={formData.permite_descuento ? 'si' : 'no'} 
                        onChange={e => setFormData({ ...formData, permite_descuento: e.target.value === 'si' })}
                        className="w-full border border-amber-300 bg-white p-2.5 rounded-xl outline-none focus:border-amber-500 text-xs sm:text-sm font-medium"
                      >
                        <option value="si">✅ Sí autorizar descuento</option>
                        <option value="no">🚫 No permitir descuentos</option>
                      </select>
                      <span className="text-[10px] text-amber-800 mt-1 block leading-tight">
                        Si se bloquea, el cajero no podrá aplicar rebajas en el mostrador a este artículo.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-amber-900 mb-1 uppercase">
                        Descuento Máximo (%)
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        max="100"
                        disabled={!formData.permite_descuento}
                        value={formData.descuento_maximo} 
                        onChange={e => setFormData({ ...formData, descuento_maximo: Math.min(100, Math.max(0, Number(e.target.value))) })}
                        className="w-full border border-amber-300 disabled:bg-gray-100 disabled:text-gray-400 bg-white p-2.5 rounded-xl outline-none focus:border-amber-500 text-xs sm:text-sm font-bold text-center" 
                        placeholder="15" 
                      />
                      <span className="text-[10px] text-amber-800 mt-1 block leading-tight">
                        Porcentaje máximo permitido para rebajar en mostrador.
                      </span>
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

      {/* MODAL PARA AGREGAR RÁPIDAMENTE CATEGORÍAS, MODELOS O UBICACIONES */}
      {quickAddModal.isOpen && (
        <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-3 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-sm text-gray-800 flex items-center gap-2">
                <Plus size={16} className="text-blue-600" />
                {quickAddModal.type === 'categoria' && 'Nueva Categoría de Producto'}
                {quickAddModal.type === 'modelo' && 'Nuevo Modelo de Moto'}
                {quickAddModal.type === 'ubicacion' && 'Nueva Ubicación en Bodega'}
              </h3>
              <button 
                type="button" 
                onClick={() => setQuickAddModal({ isOpen: false, type: 'categoria', value: '', desc: '' })}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleQuickAddSave} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickAddModal.value}
                  onChange={e => setQuickAddModal({ ...quickAddModal, value: e.target.value })}
                  placeholder={
                    quickAddModal.type === 'categoria' ? 'Ej: Baterías, Filtros...' :
                    quickAddModal.type === 'modelo' ? 'Ej: Pulsar NS 200, GN 125...' :
                    'Ej: Estante C3, Vitrina 2...'
                  }
                  className="w-full border-2 border-gray-200 p-2.5 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Descripción / Referencia (Opcional)</label>
                <input
                  type="text"
                  value={quickAddModal.desc}
                  onChange={e => setQuickAddModal({ ...quickAddModal, desc: e.target.value })}
                  placeholder="Detalles breves..."
                  className="w-full border border-gray-200 p-2 rounded-xl outline-none focus:border-blue-500 text-xs text-gray-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickAddModal({ isOpen: false, type: 'categoria', value: '', desc: '' })}
                  className="px-3.5 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all"
                >
                  Guardar y Seleccionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
