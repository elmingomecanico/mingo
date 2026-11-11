import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, update, remove, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import { 
  Search, Plus, Edit2, Trash2, Package, History, Maximize2, ScanBarcode, 
  Sliders, ShieldCheck, AlertTriangle, CheckCircle2, Percent, 
  RotateCcw, Sparkles, AlertCircle, Building2, Layers, Check, X,
  Hash, Lock, ArrowRightLeft, Star, UploadCloud, Image as ImageIcon, Wrench,
  Globe, Store, MapPin, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import { DEFAULT_CONSECUTIVOS, formatConsecutive } from '../components/catalogos/ConsecutivosManager';
import ProductCatalogsManager from '../components/inventario/ProductCatalogsManager';
import TraspasosManager from '../components/inventario/TraspasosManager';
import { 
  compressImageToWebP, 
  saveProductBundle, 
  saveProductImage, 
  fetchProductBundle, 
  subscribeProductImages, 
  resolveProductImage,
  deleteProductImage
} from '../utils/storageService';
import { consumeNextConsecutiveAtomic, checkDuplicateCodigoVisible } from '../utils/consecutivosService';
import { deleteProductCleanly } from '../utils/integrityService';
import { useConfirm } from '../context/ConfirmContext';

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
  const [activeTab, setActiveTab] = useState('catalogo'); // 'catalogo' | 'traspasos' | 'ajustes' | 'politicas' | 'tablas_catalogos'
  const [rawProducts, setRawProducts] = useState([]);
  const [productImagesMap, setProductImagesMap] = useState({});
  const [inventory, setInventory] = useState({});
  const [allInventory, setAllInventory] = useState({});
  const [ajustes, setAjustes] = useState([]);
  const [pendientesEntrega, setPendientesEntrega] = useState([]);
  const [search, setSearch] = useState('');
  const [sucursal, setSucursal] = useState('SUC-01');
  const [sucursalesList, setSucursalesList] = useState([
    { id: 'SUC-01', nombre: 'Sucursal Principal', codigo_visible: 'SUC-1' },
    { id: 'SUC-02', nombre: 'Sucursal Norte', codigo_visible: 'SUC-2' }
  ]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consecutivosConfig, setConsecutivosConfig] = useState(DEFAULT_CONSECUTIVOS);
  const { confirm } = useConfirm();

  // Hidratar productos con su imagen desde el nodo independiente WebP o R2
  const products = React.useMemo(() => {
    return rawProducts.map(p => ({
      ...p,
      image: resolveProductImage(p, productImagesMap)
    }));
  }, [rawProducts, productImagesMap]);
  
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
  const [serviciosList, setServiciosList] = useState([]);
  
  // Imagen Ampliada y Escáner de Código de Barras
  const [selectedPreviewProduct, setSelectedPreviewProduct] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Modal State para Producto
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Control de cambios en imágenes (para optimizar R2 y no sobreescribir si no cambiaron)
  const [imagesDirty, setImagesDirty] = useState(false);
  const [originalImagesSnapshot, setOriginalImagesSnapshot] = useState([]);

  // Modal para seleccionar sucursales cuando se activa el check de multi-sucursal
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    codigo_visible: '', name: '', price: '', cost: '', cat: '', stock_actual: 0, stock_minimo: 0, ubicacion: '', compatibilidad: [], image: '', images: [],
    permitir_negativo: 'heredar', permite_descuento: true, descuento_maximo: 15,
    aplica_mano_obra: false, id_servicio_asociado: '', nombre_mano_obra: '', precio_mano_obra: '',
    guardar_en_varias_sucursales: false,
    sucursales_destino: ['SUC-01']
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
    const sucursalesRef = ref(rtdb, 'configuracion/sucursales');
    const servRef = ref(rtdb, 'servicios');
    const pendientesRef = ref(rtdb, 'pendientes_entrega');

    const unsubPendientes = onValue(pendientesRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setPendientesEntrega(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      } else {
        setPendientesEntrega([]);
      }
    });

    const unsubServ = onValue(servRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setServiciosList(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      } else {
        setServiciosList([]);
      }
    });

    const unsubSucursales = onValue(sucursalesRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.keys(val).map(k => ({ id: k, ...val[k] })).filter(s => s.estado !== 'Inactiva');
        if (list.length > 0) setSucursalesList(list);
      }
    });

    const safetyTimer = setTimeout(() => setLoading(false), 3000);

    const unsubProds = onValue(prodsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setRawProducts(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setRawProducts([]);
      }
    }, () => setLoading(false));

    const unsubImgs = subscribeProductImages(setProductImagesMap);

    const unsubInv = onValue(invRef, (snapshot) => {
      if (snapshot.exists()) setInventory(snapshot.val());
      else setInventory({});
      setLoading(false);
    }, () => setLoading(false));

    const unsubAllInv = onValue(allInvRef, (snapshot) => {
      if (snapshot.exists()) setAllInventory(snapshot.val());
      else setAllInventory({});
    }, () => setLoading(false));

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
      clearTimeout(safetyTimer);
      unsubProds(); unsubImgs(); unsubInv(); unsubAllInv(); unsubPoliticas(); unsubCat(); unsubUbi(); unsubMod(); unsubAjustes(); unsubCons(); unsubSucursales(); unsubServ(); unsubPendientes();
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

    const ok = await confirm({
      title: 'Actualización Masiva de Políticas',
      message: confirmMsg,
      confirmText: 'Aplicar Cambio',
      cancelText: 'Cancelar',
      isDanger: actionType === 'bloquear_todos' || actionType === 'bloquear_descuentos'
    });
    if (!ok) return;

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

  // Mapeo reactivo de custodia por producto y métricas globales para la sucursal seleccionada
  const { custodiaPorProducto, totalUnidadesCustodia, totalOrdenesCustodia } = React.useMemo(() => {
    const map = {};
    let totalUnidades = 0;
    const ordenesSet = new Set();

    (pendientesEntrega || []).forEach(record => {
      if ((!record.sucursal || record.sucursal === sucursal) && record.estado !== 'Entregado') {
        let tienePendiente = false;
        (record.items || []).forEach(it => {
          const qtyPend = Number(it.cantidad_pendiente || 0);
          if (qtyPend > 0) {
            const pId = it.id_producto || it.id;
            if (pId) {
              map[pId] = (map[pId] || 0) + qtyPend;
              totalUnidades += qtyPend;
              tienePendiente = true;
            }
          }
        });
        if (tienePendiente && record.id) {
          ordenesSet.add(record.id);
        }
      }
    });

    return {
      custodiaPorProducto: map,
      totalUnidadesCustodia: totalUnidades,
      totalOrdenesCustodia: ordenesSet.size
    };
  }, [pendientesEntrega, sucursal]);

  // Métricas rápidas de existencias en sucursal activa
  const stockMetrics = React.useMemo(() => {
    let articulosConBajoStock = 0;
    let articulosConDeficit = 0;
    let totalFisicoEstimado = 0;

    products.forEach(p => {
      const inv = inventory[p.id] || { stock_actual: 0, stock_minimo: 0 };
      const stockNeto = Number(inv.stock_actual) || 0;
      const enCust = Number(custodiaPorProducto[p.id]) || 0;
      
      const stockFisico = stockNeto >= 0 ? (stockNeto + enCust) : Math.max(0, enCust + stockNeto);
      totalFisicoEstimado += stockFisico;

      if (stockNeto < 0) {
        articulosConDeficit++;
      } else if (stockNeto <= (inv.stock_minimo || 0)) {
        articulosConBajoStock++;
      }
    });

    return {
      articulosConBajoStock,
      articulosConDeficit,
      totalFisicoEstimado
    };
  }, [products, inventory, custodiaPorProducto]);

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
    const allSucursalIds = sucursalesList.map(s => s.id);
    setImagesDirty(false);
    setIsBranchModalOpen(false);

    if (prod) {
      setEditingId(prod.id);
      const invData = inventory[prod.id] || { stock_actual: 0, stock_minimo: 0, ubicacion: '' };
      const initialImages = Array.isArray(prod.images) && prod.images.length > 0
        ? [...prod.images]
        : (prod.image_url ? [prod.image_url] : (prod.image ? [prod.image] : []));

      setOriginalImagesSnapshot(initialImages);

      setFormData({
        codigo_visible: prod.codigo_visible || prod.id,
        name: prod.name,
        price: prod.price,
        cost: prod.cost || 0,
        cat: prod.cat || '',
        stock_actual: invData.stock_actual || 0,
        stock_minimo: invData.stock_minimo || 0,
        ubicacion: invData.ubicacion || '',
        compatibilidad: prod.compatibilidad || [],
        image: prod.image_url || prod.image || '',
        images: initialImages,
        guardar_en_varias_sucursales: false,
        sucursales_destino: allSucursalIds,
        permitir_negativo: prod.permitir_negativo || 'heredar',
        permite_descuento: prod.permite_descuento !== undefined ? Boolean(prod.permite_descuento) : true,
        descuento_maximo: prod.descuento_maximo !== undefined ? Number(prod.descuento_maximo) : 15,
        aplica_mano_obra: Boolean(prod.aplica_mano_obra),
        id_servicio_asociado: prod.id_servicio_asociado || '',
        nombre_mano_obra: prod.nombre_mano_obra || '',
        precio_mano_obra: prod.precio_mano_obra !== undefined && prod.precio_mano_obra !== null ? prod.precio_mano_obra : ''
      });

      // Si el producto tiene un paquete en Cloudflare R2 (bundle_url), cargar las fotos en el formulario
      if (prod.bundle_url) {
        fetchProductBundle(prod.bundle_url).then(imgs => {
          if (imgs && imgs.length > 0) {
            setFormData(prev => {
              // Solo actualizar si el usuario no ha agregado ya fotos nuevas mientras cargaba el bundle
              if (!prev.images || prev.images.length <= 1) {
                setOriginalImagesSnapshot(imgs);
                return {
                  ...prev,
                  images: imgs,
                  image: imgs[0] || prev.image
                };
              }
              return prev;
            });
          }
        }).catch(err => console.warn('Error al cargar bundle R2:', err));
      }
    } else {
      setEditingId(null);
      setOriginalImagesSnapshot([]);
      const prodCfg = consecutivosConfig?.productos || DEFAULT_CONSECUTIVOS.productos;
      const nextNum = prodCfg.siguiente_numero || (products.length + 1);
      const suggestedCode = formatConsecutive(prodCfg, nextNum);
      setFormData({ 
        codigo_visible: suggestedCode,
        name: '', price: '', cost: '', cat: '', stock_actual: 0, stock_minimo: 0, ubicacion: '', compatibilidad: [], image: '', images: [],
        permitir_negativo: 'heredar', permite_descuento: true, descuento_maximo: 15,
        aplica_mano_obra: false, id_servicio_asociado: '', nombre_mano_obra: '', precio_mano_obra: '',
        guardar_en_varias_sucursales: false,
        sucursales_destino: allSucursalIds
      });
    }
    setIsModalOpen(true);
  };

  const handleDeleteProduct = async (id, name) => {
    const ok = await confirm({
      title: '¿Eliminar producto del catálogo?',
      message: `¿Estás seguro de eliminar el producto "${name}"?\n\nEsta acción eliminará el repuesto del catálogo general, sus imágenes y sus existencias en todas las sucursales.`,
      confirmText: 'Sí, Eliminar Producto',
      cancelText: 'Cancelar',
      isDanger: true
    });
    if (!ok) return;

    try {
      await deleteProductCleanly(id);
      toast.success(`Producto "${name}" eliminado limpiamente de todas las sucursales`);
    } catch (error) {
      toast.error('Error al eliminar producto: ' + error.message);
    }
  };

  const handleRegenerateProductCode = () => {
    const prodCfg = consecutivosConfig?.productos || DEFAULT_CONSECUTIVOS.productos;
    const nextNum = prodCfg.siguiente_numero || (products.length + 1);
    const suggestedCode = formatConsecutive(prodCfg, nextNum);
    setFormData(prev => ({ ...prev, codigo_visible: suggestedCode }));
    toast.success(`Código sugerido: ${suggestedCode}`, { icon: '✨' });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const currentImages = formData.images || (formData.image ? [formData.image] : []);
    const availableSlots = 4 - currentImages.length;
    if (availableSlots <= 0) {
      toast.error('Has alcanzado el límite máximo de 4 fotos por producto');
      return;
    }

    const filesToProcess = files.slice(0, availableSlots);
    const validFiles = filesToProcess.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      return toast.error('Seleccione archivos de imagen válidos (JPG, PNG, WebP)');
    }

    const toastId = toast.loading(`Comprimiendo ${validFiles.length} foto(s) a WebP ultraligero...`);
    try {
      const compressedList = [];
      for (const file of validFiles) {
        const webp = await compressImageToWebP(file, 480, 0.74);
        compressedList.push(webp);
      }
      const newImages = [...currentImages, ...compressedList].slice(0, 4);
      setImagesDirty(true);
      setFormData(prev => ({
        ...prev,
        images: newImages,
        image: newImages[0] || ''
      }));
      toast.success(
        `Se ${newImages.length === 1 ? 'agregó 1 foto' : `agregaron fotos (${newImages.length}/4)`}. Listas para Cloudflare R2`,
        { id: toastId }
      );
    } catch (err) {
      toast.error('Error al procesar imágenes: ' + err.message, { id: toastId });
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImagesDirty(true);
    setFormData(prev => {
      const currentList = prev.images || (prev.image ? [prev.image] : []);
      const updated = currentList.filter((_, i) => i !== indexToRemove);
      return {
        ...prev,
        images: updated,
        image: updated[0] || ''
      };
    });
    toast.success('Foto eliminada del paquete');
  };

  const handleSetCoverImage = (index) => {
    if (index === 0) return;
    setImagesDirty(true);
    setFormData(prev => {
      const currentList = prev.images || (prev.image ? [prev.image] : []);
      const list = [...currentList];
      const [selected] = list.splice(index, 1);
      list.unshift(selected);
      return {
        ...prev,
        images: list,
        image: list[0] || ''
      };
    });
    toast.success('Foto establecida como portada principal', { icon: '⭐' });
  };

  const executeSave = async (targetBranchIds = [sucursal]) => {
    if (!targetBranchIds || targetBranchIds.length === 0) {
      return toast.error('Debe seleccionar al menos una sucursal');
    }

    setIsSubmitting(true);
    const saveToastId = toast.loading(editingId ? 'Guardando cambios del producto...' : 'Creando producto en catálogo...');

    try {
      let prodId = editingId;
      if (!prodId) {
        prodId = push(ref(rtdb, 'productos')).key;
      }

      let codigoFinal = formData.codigo_visible?.trim() || '';

      // Si es nuevo producto y el código coincide con el sugerido automático (o está vacío),
      // reservar atómicamente el consecutivo en el instante de guardar para evitar duplicados simultáneos
      const prodCfg = consecutivosConfig?.productos || DEFAULT_CONSECUTIVOS.productos;
      const suggestedDefault = formatConsecutive(prodCfg, prodCfg.siguiente_numero || 1);

      if (!editingId && (!codigoFinal || codigoFinal === suggestedDefault)) {
        const consumed = await consumeNextConsecutiveAtomic('productos');
        codigoFinal = consumed.codigoFormateado;
      } else if (!codigoFinal) {
        codigoFinal = prodId;
      }

      // Verificar que ningún otro producto tenga el mismo código visible
      const dupCheck = await checkDuplicateCodigoVisible('productos', codigoFinal, prodId);
      if (dupCheck.isDuplicate) {
        if (!editingId) {
          const nextAtomic = await consumeNextConsecutiveAtomic('productos');
          codigoFinal = nextAtomic.codigoFormateado;
        } else {
          toast.dismiss(saveToastId);
          setIsSubmitting(false);
          return toast.error(`El código visible "${codigoFinal}" ya está asignado al producto "${dupCheck.conflictItem?.name}". Elija un código único.`);
        }
      }

      // ==============================================================
      // OPTIMIZACIÓN CLOUDFLARE R2: DETECCIÓN DE CAMBIOS REALES EN FOTOS
      // ==============================================================
      const currentOriginal = editingId ? rawProducts.find(p => p.id === editingId) : null;
      const imagesToSave = formData.images && formData.images.length > 0 
        ? formData.images 
        : (formData.image ? [formData.image] : []);

      // Comprobar si hay imágenes nuevas subidas en base64 (data:image/...)
      const hasNewBase64Images = imagesToSave.some(img => typeof img === 'string' && img.startsWith('data:'));

      // Comprobar si cambiaron respecto a las fotos originales
      const isPhotosModified = !editingId || imagesDirty || hasNewBase64Images || (
        currentOriginal && (
          Boolean(currentOriginal.has_image) !== (imagesToSave.length > 0) ||
          (currentOriginal.total_fotos || 0) !== imagesToSave.length
        )
      );

      let imgMeta = {
        has_image: Boolean(currentOriginal?.has_image),
        image_url: currentOriginal?.image_url || '',
        bundle_url: currentOriginal?.bundle_url || '',
        total_fotos: currentOriginal?.total_fotos || 0
      };

      if (isPhotosModified) {
        if (imagesToSave.length > 0) {
          try {
            imgMeta = await saveProductBundle(prodId, imagesToSave);
          } catch (imgErr) {
            console.error('Error al sincronizar imágenes con R2:', imgErr);
            toast.error('Aviso: No se pudieron procesar las fotos en R2; se conservan los datos de texto.', { duration: 4000 });
          }
        } else if (editingId) {
          // Si el usuario retiró todas las imágenes del producto
          try {
            await deleteProductImage(prodId);
          } catch (delErr) {
            console.warn('Error al limpiar imagen en RTDB:', delErr);
          }
          imgMeta = { has_image: false, image_url: '', bundle_url: '', total_fotos: 0 };
        }
      }

      // 2. Guardar en Catálogo Maestro Centralizado (productos/${prodId})
      const prodRef = ref(rtdb, `productos/${prodId}`);
      await set(prodRef, {
        id: prodId,
        codigo_visible: codigoFinal,
        name: formData.name.trim(),
        price: Number(formData.price),
        cost: Number(formData.cost) || 0,
        cat: formData.cat || '',
        compatibilidad: formData.compatibilidad || [],
        has_image: imgMeta.has_image,
        image_url: imgMeta.image_url || '',
        bundle_url: imgMeta.bundle_url || '',
        total_fotos: imgMeta.total_fotos || 0,
        image: '', // Las imágenes residen optimizadas en Cloudflare R2 y nodo independiente
        permitir_negativo: formData.permitir_negativo || 'heredar',
        permite_descuento: formData.permite_descuento !== undefined ? Boolean(formData.permite_descuento) : true,
        descuento_maximo: Number(formData.descuento_maximo) || 15,
        aplica_mano_obra: Boolean(formData.aplica_mano_obra),
        id_servicio_asociado: formData.aplica_mano_obra ? (formData.id_servicio_asociado || '') : '',
        nombre_mano_obra: formData.aplica_mano_obra ? (formData.nombre_mano_obra?.trim() || '') : '',
        precio_mano_obra: formData.aplica_mano_obra ? (Number(formData.precio_mano_obra) || 0) : 0,
        fecha_actualizacion: new Date().toISOString()
      });

      // 3. Sincronización de Bodega / Inventario por Sucursales seleccionadas
      for (const sucId of targetBranchIds) {
        const branchInvRef = ref(rtdb, `inventario/${sucId}/${prodId}`);
        if (!editingId) {
          // Producto nuevo: la sucursal de trabajo actual recibe el stock inicial; las demás inician en 0
          const initialStock = (sucId === sucursal) ? (Number(formData.stock_actual) || 0) : 0;
          await set(branchInvRef, {
            stock_actual: initialStock,
            stock_minimo: Number(formData.stock_minimo) || 0,
            ubicacion: formData.ubicacion || ''
          });
        } else {
          // Edición de producto: NUNCA pisar stock_actual existente en ninguna sucursal
          await update(branchInvRef, {
            stock_minimo: Number(formData.stock_minimo) || 0,
            ubicacion: formData.ubicacion || ''
          });
        }
      }

      toast.dismiss(saveToastId);
      const sucCount = targetBranchIds.length;
      const sucText = sucCount === 1 
        ? `en sucursal ${sucursalesList.find(s => s.id === targetBranchIds[0])?.codigo_visible || targetBranchIds[0]}` 
        : `sincronizado en ${sucCount} sucursales`;

      toast.success(editingId ? `Producto actualizado (${sucText})` : `Producto "${codigoFinal}" creado (${sucText})`);
      setIsBranchModalOpen(false);
      setIsModalOpen(false);
    } catch (error) {
      toast.dismiss(saveToastId);
      console.error('Error al guardar producto:', error);
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // 1. Validaciones previas con Toast explícito
    if (!formData.name?.trim()) {
      return toast.error('El nombre del producto es obligatorio');
    }
    if (!formData.codigo_visible?.trim()) {
      return toast.error('El código visible o SKU es obligatorio');
    }
    if (formData.price === '' || isNaN(Number(formData.price)) || Number(formData.price) < 0) {
      return toast.error('Ingrese un precio de venta válido (mayor o igual a 0)');
    }
    if (formData.aplica_mano_obra && (formData.precio_mano_obra === '' || isNaN(Number(formData.precio_mano_obra)) || Number(formData.precio_mano_obra) < 0)) {
      return toast.error('Ingrese un precio válido para la mano de obra vinculada');
    }

    // Si tiene marcado el check de guardar en varias sucursales, abrir modal de selección
    if (formData.guardar_en_varias_sucursales) {
      setIsBranchModalOpen(true);
      return;
    }

    // Si no está marcado el check, guardar directamente en la sucursal actual de trabajo
    await executeSave([sucursal]);
  };

  const handleSaveAjuste = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!ajusteForm.id_producto || ajusteForm.nuevo_stock === '' || !ajusteForm.motivo) {
      return toast.error("Complete todos los campos del ajuste");
    }

    setIsSubmitting(true);
    try {
      const pid = ajusteForm.id_producto.value;
      const pname = ajusteForm.id_producto.label;
      const nuevo = Number(ajusteForm.nuevo_stock);
      const currentUser = JSON.parse(localStorage.getItem('mingo_user') || '{}');

      // Ejecutar transacción atómica sobre stock_actual para conocer el stock anterior real en servidor
      let stockAnteriorReal = 0;
      const stockRef = ref(rtdb, `inventario/${sucursal}/${pid}/stock_actual`);
      await runTransaction(stockRef, (cur) => {
        stockAnteriorReal = Number(cur) || 0;
        return nuevo;
      });

      const diff = nuevo - stockAnteriorReal;
      if (diff === 0) {
        setIsSubmitting(false);
        return toast.error("El nuevo stock es igual al stock actual en servidor.");
      }

      const ajusteKey = push(ref(rtdb, `ajustes_inventario/${sucursal}`)).key;
      const kardexKey = push(ref(rtdb, 'kardex')).key;

      await update(ref(rtdb), {
        [`ajustes_inventario/${sucursal}/${ajusteKey}`]: {
          id_producto: pid,
          nombre_producto: pname,
          stock_anterior: stockAnteriorReal,
          stock_nuevo: nuevo,
          diferencia: diff,
          motivo: ajusteForm.motivo,
          fecha: new Date().toISOString(),
          usuario: currentUser.nombre_completo || 'Sistema'
        },
        [`kardex/${kardexKey}`]: {
          fecha: new Date().toISOString(),
          id_sucursal: sucursal,
          id_producto: pid,
          nombre_producto: pname,
          tipo_movimiento: diff > 0 ? 'Entrada por Ajuste' : 'Salida por Ajuste',
          cantidad: Math.abs(diff),
          id_referencia: `Ajuste (${ajusteForm.motivo})`,
          stock_anterior: stockAnteriorReal,
          stock_nuevo: nuevo,
          usuario: currentUser.nombre_completo || 'Sistema'
        }
      });

      toast.success("Ajuste de inventario aplicado atómicamente");
      setIsAjusteModalOpen(false);
      setAjusteForm({ id_producto: null, nuevo_stock: '', motivo: '' });
    } catch (error) {
      toast.error("Error al guardar ajuste: " + error.message);
    } finally {
      setIsSubmitting(false);
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
            {sucursalesList.map(s => (
              <option key={s.id} value={s.id}>
                {s.nombre || s.name} ({s.codigo_visible || s.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200">
        <button onClick={() => setActiveTab('catalogo')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'catalogo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Catálogo de Productos</button>
        <button onClick={() => setActiveTab('traspasos')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'traspasos' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <ArrowRightLeft size={16} /> Traspasos entre Sucursales
        </button>
        <button onClick={() => setActiveTab('ajustes')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'ajustes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Ajustes de Inventario</button>
        <button onClick={() => setActiveTab('politicas')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'politicas' ? 'border-amber-600 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <ShieldCheck size={16} /> Políticas y Condiciones (Gerencia)
        </button>
        <button onClick={() => setActiveTab('tablas_catalogos')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'tablas_catalogos' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Layers size={16} /> Categorías, Marcas y Ubicaciones
        </button>
      </div>

      {activeTab === 'catalogo' && (
        <div className="space-y-4">
          {/* BANNER DE MÉTRICAS RÁPIDAS: EXISTENCIAS FÍSICAS Y MERCANCÍA EN CUSTODIA */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Package size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Total en Catálogo</span>
                <span className="text-base sm:text-lg font-black text-gray-800 block leading-tight">
                  {products.length} productos
                </span>
                <span className="text-[10px] text-gray-500">En todas las categorías</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Store size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Stock Físico (Bodega)</span>
                <span className="text-base sm:text-lg font-black text-emerald-700 block leading-tight">
                  {stockMetrics.totalFisicoEstimado} unid.
                </span>
                <span className="text-[10px] text-emerald-600 font-medium">Contadas en sucursal</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-purple-100 shadow-sm flex items-center gap-3 bg-gradient-to-br from-white to-purple-50/40">
              <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                <Layers size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-purple-700 block">Mercancía en Custodia</span>
                <span className="text-base sm:text-lg font-black text-purple-900 block leading-tight">
                  {totalUnidadesCustodia} unid.
                </span>
                <span className="text-[10px] text-purple-600 font-medium">
                  {totalOrdenesCustodia} pedidos pendientes de retiro
                </span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <AlertTriangle size={20} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Alertas de Stock</span>
                <span className="text-base sm:text-lg font-black text-amber-800 block leading-tight">
                  {stockMetrics.articulosConBajoStock + stockMetrics.articulosConDeficit} arts.
                </span>
                <span className="text-[10px] text-amber-700 font-medium">
                  {stockMetrics.articulosConDeficit > 0 ? `${stockMetrics.articulosConDeficit} en déficit de compra` : 'Bajo stock mínimo'}
                </span>
              </div>
            </div>
          </div>

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
                  <th className="p-4 text-center">Disponibilidad & Custodia</th>
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
                    const stockNeto = Number(inv.stock_actual) || 0;
                    const enCustodia = Number(custodiaPorProducto[prod.id]) || 0;
                    // Stock físico estimado en bodega:
                    // Si stockNeto >= 0: las unidades en custodia están en bodega + las unidades disponibles
                    // Si stockNeto < 0: hay déficit por compras aún no recibidas
                    const stockFisico = stockNeto >= 0 ? (stockNeto + enCustodia) : Math.max(0, enCustodia + stockNeto);
                    const deficitPendiente = stockNeto < 0 ? Math.abs(stockNeto) : 0;
                    const isLowStock = stockNeto <= (inv.stock_minimo || 0);
                    
                    return (
                      <tr key={prod.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {prod.image ? (
                              <div className="relative group cursor-pointer" onClick={() => setSelectedPreviewProduct(prod)} title="Ver fotos en grande">
                                <img src={prod.image} alt={prod.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200 shadow-sm transition-opacity group-hover:opacity-80" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-lg transition-opacity">
                                  <Maximize2 size={16} className="text-white drop-shadow" />
                                </div>
                                {(prod.total_fotos > 1 || prod.bundle_url) && (
                                  <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[9px] font-bold px-1 rounded-full shadow flex items-center gap-0.5">
                                    <Layers size={8} /> {prod.total_fotos || 4}
                                  </span>
                                )}
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
                            {prod.aplica_mano_obra && (
                              <span className="bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1" title={prod.nombre_mano_obra || 'Instalación en taller disponible'}>
                                <Wrench size={10} className="text-blue-600" />
                                Mano de Obra (+ C$ {Number(prod.precio_mano_obra || 0).toFixed(2)})
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
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black shadow-sm ${
                              stockNeto > (inv.stock_minimo || 0)
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : stockNeto > 0
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-red-100 text-red-800 border border-red-200'
                            }`}>
                              {stockNeto > 0 ? `${stockNeto} disp.` : stockNeto === 0 ? '0 disp.' : `${stockNeto} déficit`}
                            </span>

                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="text-gray-500 font-medium" title="Unidades contadas físicamente en bodega">
                                Físico: <strong className="text-gray-800">{stockFisico}</strong>
                              </span>
                              {enCustodia > 0 && (
                                <span 
                                  className="bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-0.5" 
                                  title={`Mercancía en custodia para clientes. ${deficitPendiente > 0 ? `(${deficitPendiente} unid. esperando compra/proveedor)` : '(Listas para entrega)'}`}
                                >
                                  📦 Custodia: {enCustodia}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-gray-500">{inv.ubicacion || '-'}</td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => handleOpenModal(prod)}
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition-colors"
                              title="Editar Producto"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteProduct(prod.id, prod.name)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-colors"
                              title="Eliminar Producto"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
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
                      const totalStock = sucursalesList.reduce((acc, s) => acc + (allInventory[s.id]?.[p.id]?.stock_actual || 0), 0);
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
                                <span className="font-bold text-gray-900 block max-w-xs break-words" title={p.name}>{p.name}</span>
                                <span className="text-[10px] text-gray-400">{p.cat || 'General'}</span>
                              </div>
                            </div>
                          </td>

                          {/* STOCK POR SUCURSALES */}
                          <td className="p-3.5 text-center">
                            <div className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-xl text-xs flex-wrap justify-center">
                              {sucursalesList.map((s, sIdx) => {
                                const stockVal = allInventory[s.id]?.[p.id]?.stock_actual || 0;
                                const shortCode = s.codigo_visible || s.short || s.id;
                                return (
                                  <React.Fragment key={s.id}>
                                    <span title={`${s.nombre || s.name} (${s.id})`} className={stockVal <= 0 ? 'text-rose-600 font-bold' : 'text-gray-700'}>
                                      {shortCode}: {stockVal}
                                    </span>
                                    {sIdx < sucursalesList.length - 1 && <span className="text-gray-300">|</span>}
                                  </React.Fragment>
                                );
                              })}
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

      {activeTab === 'traspasos' && (
        <TraspasosManager 
          user={JSON.parse(localStorage.getItem('mingo_user') || '{}')} 
          sucursalesProp={sucursalesList}
          productsProp={products}
          inventoryProp={allInventory}
        />
      )}

      {activeTab === 'tablas_catalogos' && (
        <ProductCatalogsManager />
      )}

      {/* Modal Formulario Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <div className="flex flex-col">
                <h2 className="text-base sm:text-lg font-black text-gray-800">
                  {editingId ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                {editingId && (
                  <p className="text-xs text-blue-700 font-bold truncate max-w-sm sm:max-w-md mt-0.5">
                    {formData.name || 'Sin nombre'} {formData.codigo_visible ? `(${formData.codigo_visible})` : ''}
                  </p>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSave} noValidate className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
                
                {/* Banner Catálogo Maestro Centralizado */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/90 rounded-2xl p-3 sm:p-3.5 flex items-start gap-3 text-xs text-blue-900 shadow-xs">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Globe size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold uppercase tracking-wider text-[11px] text-blue-900 flex items-center gap-2">
                      <span>Catálogo Maestro Centralizado</span>
                      <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Multisucursal</span>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                      El código visible, nombre, categoría, fotos HD en Cloudflare R2, precio de venta, costo y mano de obra aplican de forma automática y unificada en <strong>todas las sucursales</strong> ({sucursalesList.length} activas).
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-blue-900 border-b pb-2 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between">
                    <span>Identificación Comercial y Códigos</span>
                    <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                      <ShieldCheck size={12} /> Registro Protegido
                    </span>
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
                    <p className="text-[11px] text-blue-800 leading-tight flex items-center gap-1">
                      <Sparkles size={12} className="text-blue-600 shrink-0" />
                      <span><strong>Libertad de formato:</strong> Puede contener letras, números y guiones. Puedes editarlo libremente en cualquier momento sin alterar ventas ni existencias.</span>
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
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                        <ImageIcon size={15} className="text-blue-600" />
                        Fotos del Producto (Hasta 4 fotos en Cloudflare R2)
                      </label>
                      <span className="text-[11px] font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {(formData.images || (formData.image ? [formData.image] : [])).length} / 4 fotos
                      </span>
                    </div>

                    {/* Explicación de 1 sola lectura Tipo B */}
                    <div className="mb-3 p-2.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                      <Sparkles size={14} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Paquete Inteligente Cloudflare R2:</span> Las fotos se comprimen en WebP y se agrupan en un solo paquete. Al abrir el producto, Cloudflare cuenta <span className="font-bold underline">1 sola lectura Tipo B</span> para ver las 4 fotos.
                      </div>
                    </div>

                    {/* Grid de hasta 4 fotos */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(formData.images || (formData.image ? [formData.image] : [])).map((imgSrc, idx) => (
                        <div 
                          key={idx} 
                          className="relative group rounded-xl border-2 overflow-hidden bg-gray-900 border-gray-200 aspect-square flex items-center justify-center shadow-xs"
                        >
                          <img 
                            src={imgSrc} 
                            alt={`Foto ${idx + 1}`} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                          />

                          {/* Badge de Portada / Posición */}
                          <div className="absolute top-1.5 left-1.5 pointer-events-none">
                            {idx === 0 ? (
                              <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow">
                                <Star size={9} fill="currentColor" /> Portada
                              </span>
                            ) : (
                              <span className="bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow">
                                #{idx + 1}
                              </span>
                            )}
                          </div>

                          {/* Acciones flotantes */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveImage(idx);
                                }}
                                className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition-colors shadow cursor-pointer"
                                title="Eliminar foto"
                              >
                                <X size={13} />
                              </button>
                            </div>

                            <div className="flex justify-between items-center gap-1">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetCoverImage(idx);
                                  }}
                                  className="text-[9px] font-bold bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-1 rounded-md transition-colors shadow flex items-center gap-0.5 cursor-pointer"
                                  title="Establecer como foto principal"
                                >
                                  <Star size={9} /> Portada
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedPreviewProduct({ 
                                  name: formData.name || 'Vista previa', 
                                  images: formData.images || [imgSrc],
                                  image: imgSrc 
                                })}
                                className="ml-auto w-6 h-6 rounded-full bg-white/80 hover:bg-white text-gray-800 flex items-center justify-center shadow transition-colors cursor-pointer"
                                title="Ampliar imagen"
                              >
                                <Maximize2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Botón de subida si aún quedan espacios (< 4) */}
                      {(formData.images || (formData.image ? [formData.image] : [])).length < 4 && (
                        <label className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50/80 rounded-xl aspect-square flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all group">
                          <input 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            onChange={handleImageUpload} 
                            className="hidden" 
                          />
                          <div className="w-8 h-8 rounded-full bg-blue-100 group-hover:bg-blue-200 text-blue-600 flex items-center justify-center mb-1 transition-colors">
                            <UploadCloud size={18} />
                          </div>
                          <span className="text-[11px] font-bold text-blue-700 leading-tight">
                            {(formData.images || []).length === 0 ? 'Agregar Fotos' : 'Añadir Foto'}
                          </span>
                          <span className="text-[9px] text-gray-400 mt-0.5">
                            Quedan {4 - (formData.images || (formData.image ? [formData.image] : [])).length} de 4
                          </span>
                        </label>
                      )}
                    </div>
                  </div>

                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-bold text-blue-900 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                      <Store size={15} className="text-blue-700" />
                      <span>Inventario de Bodega</span>
                    </h3>
                    <span className="text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border border-blue-200">
                      Sede Activa: {sucursalesList.find(s => s.id === sucursal)?.codigo_visible || sucursal}
                    </span>
                  </div>

                  {/* Checkbox para guardar en varias sucursales */}
                  <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200/90 space-y-2">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="check_multi_sucursal"
                        checked={Boolean(formData.guardar_en_varias_sucursales)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            guardar_en_varias_sucursales: checked,
                            sucursales_destino: checked ? sucursalesList.map(s => s.id) : [sucursal]
                          }));
                        }}
                        className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                      <label htmlFor="check_multi_sucursal" className="flex-1 cursor-pointer select-none">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-blue-950 flex items-center gap-1.5 uppercase tracking-wide">
                            <Store size={15} className="text-blue-700" />
                            Guardar / Sincronizar en varias sucursales
                          </span>
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                            {sucursalesList.length} sucursales disponibles
                          </span>
                        </div>
                        <p className="text-[11px] text-blue-800/80 mt-0.5 leading-relaxed">
                          {formData.guardar_en_varias_sucursales 
                            ? `Activado: Al presionar "Guardar Producto", se abrirá una ventana para elegir exactamente en qué sucursales sincronizar las existencias y estante (${formData.sucursales_destino?.length || sucursalesList.length} seleccionadas).` 
                            : `Desactivado: Se guardará únicamente en la sede de trabajo actual (${sucursalesList.find(s => s.id === sucursal)?.codigo_visible || sucursal}).`}
                        </p>
                      </label>
                    </div>
                  </div>

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

                {/* MANO DE OBRA & INSTALACIÓN EN TALLER (OPCIONAL) */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  formData.aplica_mano_obra 
                    ? 'bg-blue-50/70 border-blue-300 shadow-xs' 
                    : 'bg-slate-50/70 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between border-b pb-2 mb-3 border-blue-200/60">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                        formData.aplica_mano_obra ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        <Wrench size={15} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
                          Mano de Obra & Instalación en Taller
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Permite al cliente cotizar la pieza instalada en moto y al cajero facturar el servicio en un clic.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.aplica_mano_obra}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData(prev => ({
                            ...prev,
                            aplica_mano_obra: checked,
                            precio_mano_obra: checked ? (prev.precio_mano_obra || '') : ''
                          }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {formData.aplica_mano_obra ? (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-blue-950 mb-1 uppercase">
                            Servicio Vinculado (Catálogo de Taller)
                          </label>
                          <select
                            value={formData.id_servicio_asociado}
                            onChange={(e) => {
                              const srvId = e.target.value;
                              const selectedSrv = serviciosList.find(s => s.id === srvId);
                              setFormData(prev => ({
                                ...prev,
                                id_servicio_asociado: srvId,
                                nombre_mano_obra: selectedSrv ? selectedSrv.nombre : prev.nombre_mano_obra,
                                precio_mano_obra: selectedSrv && selectedSrv.precio !== undefined ? selectedSrv.precio : prev.precio_mano_obra
                              }));
                            }}
                            className="w-full border border-blue-300 bg-white p-2.5 rounded-xl outline-none focus:border-blue-500 text-xs sm:text-sm font-medium"
                          >
                            <option value="">-- Seleccionar o personalizar --</option>
                            {serviciosList.map(srv => (
                              <option key={srv.id} value={srv.id}>
                                {srv.codigo_visible ? `[${srv.codigo_visible}] ` : ''}{srv.nombre} (C$ {Number(srv.precio || 0).toFixed(2)})
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] text-blue-800 mt-1 block leading-tight">
                            Vínculo con el catálogo maestro de servicios de taller.
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-blue-950 mb-1 uppercase">
                            Tarifa de Mano de Obra (C$) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required={formData.aplica_mano_obra}
                            value={formData.precio_mano_obra}
                            onChange={(e) => setFormData(prev => ({ ...prev, precio_mano_obra: e.target.value }))}
                            placeholder="Ej. 150.00"
                            className="w-full border border-blue-300 bg-white p-2.5 rounded-xl outline-none focus:border-blue-500 text-xs sm:text-sm font-bold text-blue-950 text-right"
                          />
                          <span className="text-[10px] text-blue-800 mt-1 block leading-tight">
                            Monto exacto a cobrar al cliente por instalar esta pieza.
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-blue-950 mb-1 uppercase">
                          Descripción de la Mano de Obra para el Cliente
                        </label>
                        <input
                          type="text"
                          value={formData.nombre_mano_obra}
                          onChange={(e) => setFormData(prev => ({ ...prev, nombre_mano_obra: e.target.value }))}
                          placeholder="Ej. Desmontaje, montaje y calibración técnica en taller"
                          className="w-full border border-blue-300 bg-white p-2 rounded-xl outline-none focus:border-blue-500 text-xs sm:text-sm font-medium"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">
                      Este producto se comercializa únicamente como pieza física sin opción de mano de obra vinculada.
                    </p>
                  )}
                </div>

              </div>

              <div className="p-3 sm:p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className={`px-5 sm:px-6 py-2.5 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs sm:text-sm ${
                    isSubmitting 
                      ? 'bg-blue-400 cursor-not-allowed text-white shadow-none' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-95 cursor-pointer'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-white" />
                      <span>Guardando Producto...</span>
                    </>
                  ) : (
                    <span>Guardar Producto</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA SELECCIONAR SUCURSALES DE SINCRONIZACIÓN */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/90 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
                  <Store size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900 leading-tight">
                    Guardar en Varias Sucursales
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Seleccione las sedes donde desea aplicar este producto
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(false)}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-700 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer text-xl font-bold leading-none disabled:opacity-50"
              >
                &times;
              </button>
            </div>

            {/* Contenido / Lista de Sucursales */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {/* Barra rápida de Marcar / Desmarcar */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 text-xs">
                <span className="font-bold text-gray-700">
                  {formData.sucursales_destino?.length || 0} de {sucursalesList.length} seleccionadas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, sucursales_destino: sucursalesList.map(s => s.id) }))}
                    className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                  >
                    Marcar Todas
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, sucursales_destino: [] }))}
                    className="text-gray-500 hover:text-gray-800 font-medium hover:underline cursor-pointer"
                  >
                    Desmarcar Todas
                  </button>
                </div>
              </div>

              {/* Lista interactiva de sucursales */}
              <div className="space-y-2">
                {sucursalesList.map(s => {
                  const isSelected = formData.sucursales_destino?.includes(s.id);
                  const isCurrentWorkBranch = s.id === sucursal;
                  const branchStock = allInventory[s.id]?.[editingId]?.stock_actual;

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setFormData(prev => {
                          const current = prev.sucursales_destino || [];
                          const updated = current.includes(s.id)
                            ? current.filter(id => id !== s.id)
                            : [...current, s.id];
                          return { ...prev, sucursales_destino: updated };
                        });
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 select-none ${
                        isSelected 
                          ? 'bg-blue-50/80 border-blue-400 text-blue-950 shadow-xs' 
                          : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Manejado por onClick del contenedor
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                            {s.codigo_visible || s.id}
                          </span>
                          <span className="font-bold text-sm truncate">
                            {s.nombre || s.name}
                          </span>
                          {isCurrentWorkBranch && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              Sede Actual
                            </span>
                          )}
                        </div>
                        {s.direccion && (
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">{s.direccion}</p>
                        )}
                        {editingId && branchStock !== undefined && (
                          <p className="text-[10px] font-semibold text-slate-500 mt-1">
                            Stock físico actual en esta sede: <strong className="text-blue-700">{branchStock} unid.</strong> (se conserva intacto)
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                <p className="font-bold text-amber-900 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-700" />
                  Sincronización Inteligente de Inventario
                </p>
                <p className="leading-relaxed">
                  El catálogo maestro (fotos, precio, nombre y códigos) se actualiza de forma centralizada. Las sucursales seleccionadas sincronizarán sus reglas de bodega (stock mínimo y estante), <strong>sin modificar nunca el stock físico existente</strong> en cada sede.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-200 text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => executeSave(formData.sucursales_destino)}
                disabled={isSubmitting || (formData.sucursales_destino?.length || 0) === 0}
                className={`px-5 sm:px-6 py-2.5 rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 text-xs sm:text-sm ${
                  isSubmitting || (formData.sucursales_destino?.length || 0) === 0
                    ? 'bg-blue-300 cursor-not-allowed text-white shadow-none'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-95 cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-white" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Confirmar y Guardar ({formData.sucursales_destino?.length || 0})</span>
                )}
              </button>
            </div>
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
