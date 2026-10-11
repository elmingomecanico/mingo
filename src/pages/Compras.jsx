import React, { useState, useEffect } from 'react';
import { ref, onValue, push, set, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import { 
  ShoppingBag, Search, Plus, Trash2, AlertCircle, TrendingDown, CheckCircle2,
  ScanBarcode, Package, PackagePlus, Maximize2, X, Minus, Truck, Building, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import ConfirmModal from '../components/ConfirmModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import ImagePreviewModal from '../components/ImagePreviewModal';

export default function Compras() {
  const [activeTab, setActiveTab] = useState('historial'); // 'historial' | 'sugerencias' | 'nueva'
  
  const [compras, setCompras] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);
  
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [inventario, setInventario] = useState({});
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [sucursal, setSucursal] = useState('SUC-01');
  
  const [loading, setLoading] = useState(true);

  // Estado para Nueva Compra
  const [cart, setCart] = useState([]);
  const [selectedProveedor, setSelectedProveedor] = useState(null);
  const [numeroFactura, setNumeroFactura] = useState('');
  const [metodoPago, setMetodoPago] = useState('Crédito'); // 'Crédito' | 'Contado'
  const [searchProd, setSearchProd] = useState('');
  
  // Modales
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);
  
  // Modal Rápido de Nuevo Producto
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    id: '',
    price: '',
    cost: '',
    cat: '',
    stock_minimo: 5,
    ubicacion: '',
    image: '',
    compatibilidad: []
  });

  // Modal Rápido de Nuevo Proveedor
  const [isNewProvModalOpen, setIsNewProvModalOpen] = useState(false);
  const [newProvForm, setNewProvForm] = useState({
    nombre: '',
    ruc: '',
    telefono: '',
    direccion: '',
    contacto: ''
  });

  useEffect(() => {
    const provRef = ref(rtdb, 'proveedores');
    const prodRef = ref(rtdb, 'productos');
    const invRef = ref(rtdb, `inventario/${sucursal}`);
    const compRef = ref(rtdb, 'compras');
    const catRef = ref(rtdb, 'catalogos/categorias');
    const ubiRef = ref(rtdb, 'catalogos/ubicaciones');

    const unsubProv = onValue(provRef, (snapshot) => {
      if (snapshot.exists()) {
        setProveedores(Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })));
      } else setProveedores([]);
    });

    const unsubProd = onValue(prodRef, (snapshot) => {
      if (snapshot.exists()) {
        setProductos(Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })));
      } else setProductos([]);
    });

    const unsubInv = onValue(invRef, (snapshot) => {
      if (snapshot.exists()) {
        setInventario(snapshot.val());
      } else setInventario({});
    });

    const unsubComp = onValue(compRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        parsed.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setCompras(parsed);
      } else setCompras([]);
      setLoading(false);
    });

    const unsubCat = onValue(catRef, (snapshot) => {
      if (snapshot.exists()) {
        setCategorias(Object.values(snapshot.val()).map(c => c.nombre));
      }
    });

    const unsubUbi = onValue(ubiRef, (snapshot) => {
      if (snapshot.exists()) {
        setUbicaciones(Object.values(snapshot.val()).map(u => u.nombre));
      }
    });

    return () => { 
      unsubProv(); unsubProd(); unsubInv(); unsubComp(); unsubCat(); unsubUbi(); 
    };
  }, [sucursal]);

  // Generar sugerencias de compra basadas en el inventario mínimo
  useEffect(() => {
    if (productos.length > 0 && Object.keys(inventario).length > 0) {
      const sugeridas = [];
      productos.forEach(prod => {
        const inv = inventario[prod.id];
        if (inv) {
          const stockActual = inv.stock_actual || 0;
          const stockMinimo = inv.stock_minimo || 0;
          if (stockActual <= stockMinimo) {
            sugeridas.push({
              ...prod,
              stock_actual: stockActual,
              stock_minimo: stockMinimo,
              faltante: stockMinimo - stockActual > 0 ? stockMinimo - stockActual : 10
            });
          }
        }
      });
      setSugerencias(sugeridas);
    }
  }, [productos, inventario]);

  // Filtro de búsqueda inteligente para compras
  const searchTerms = searchProd.toLowerCase().split(' ').filter(t => t.trim() !== '');
  const filteredSearch = productos.filter(p => {
    const compatText = (p.compatibilidad || []).join(' ');
    const textToSearch = `${p.name} ${p.id} ${p.cat || ''} ${compatText}`.toLowerCase();
    return searchTerms.every(term => textToSearch.includes(term));
  });

  // Agregar producto a la factura de compra
  const handleAddToCart = (prod) => {
    const existing = cart.find(item => item.id === prod.id);
    if (existing) {
      setCart(cart.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { 
        ...prod, 
        qty: 1, 
        current_cost: Number(prod.cost) || 0 
      }]);
    }
  };

  // Manejo de lectura de código de barras (Cámara o Lector Físico)
  const handleBarcodeInput = (code) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim().toLowerCase();
    
    // 1. Coincidencia exacta por ID o código de barras
    let match = productos.find(p => 
      p.id?.toLowerCase() === cleanCode || 
      (p.barcode && p.barcode.toString().toLowerCase() === cleanCode) ||
      (p.codigo_barra && p.codigo_barra.toString().toLowerCase() === cleanCode)
    );

    // 2. Coincidencia única parcial si no es exacta
    if (!match) {
      const candidates = productos.filter(p => {
        const textToSearch = `${p.name} ${p.id} ${p.cat || ''}`.toLowerCase();
        return textToSearch.includes(cleanCode);
      });
      if (candidates.length === 1) {
        match = candidates[0];
      }
    }

    if (match) {
      handleAddToCart(match);
      setSearchProd('');
      toast.success(`⚡ Producto agregado: ${match.name}`, { icon: '📦' });
    } else {
      toast.error(`No se encontró ningún producto con código: "${code.trim()}". Puedes crearlo con el botón "+ Nuevo Producto".`);
      // Prellenar ID sugerido con el código escaneado
      setNewProductForm(prev => ({
        ...prev,
        id: code.trim().toUpperCase(),
        name: searchProd.trim()
      }));
    }
  };

  // Subida y compresión de imagen para nuevo producto
  const handleProductImageUpload = (e) => {
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
        setNewProductForm(prev => ({ ...prev, image: base64Str }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Guardar nuevo producto y agregarlo automáticamente a la orden de compra
  const handleSaveNewProduct = async (e) => {
    e.preventDefault();
    if (!newProductForm.name.trim()) return toast.error('Ingrese el nombre del producto');

    try {
      let prodId = newProductForm.id.trim();
      if (!prodId) {
        const num = productos.length + 1;
        prodId = `PROD-${num.toString().padStart(4, '0')}`;
        if (productos.find(p => p.id === prodId)) {
          prodId = push(ref(rtdb, 'productos')).key;
        }
      }

      const costNum = Number(newProductForm.cost) || 0;
      const priceNum = Number(newProductForm.price) || (costNum > 0 ? Number((costNum * 1.35).toFixed(2)) : 0);

      const newProdData = {
        name: newProductForm.name.trim(),
        cost: costNum,
        price: priceNum,
        cat: newProductForm.cat || categorias[0] || 'Repuestos',
        stock_minimo: Number(newProductForm.stock_minimo) || 5,
        ubicacion: newProductForm.ubicacion || '',
        image: newProductForm.image || '',
        compatibilidad: newProductForm.compatibilidad || []
      };

      // 1. Guardar en catálogo maestro de productos
      await set(ref(rtdb, `productos/${prodId}`), newProdData);

      // 2. Inicializar existencias en la sucursal actual
      await set(ref(rtdb, `inventario/${sucursal}/${prodId}`), {
        stock_actual: 0,
        stock_minimo: Number(newProductForm.stock_minimo) || 5,
        ubicacion: newProductForm.ubicacion || ''
      });

      // 3. Agregar inmediatamente al carrito de compras
      const createdItem = {
        id: prodId,
        ...newProdData,
        qty: 1,
        current_cost: costNum
      };
      handleAddToCart(createdItem);

      toast.success(`✨ Producto "${newProdData.name}" creado y añadido a la factura de compra`);
      setIsNewProductModalOpen(false);
      setSearchProd('');
      setNewProductForm({
        name: '', id: '', price: '', cost: '', cat: '', stock_minimo: 5, ubicacion: '', image: '', compatibilidad: []
      });
    } catch (err) {
      toast.error('Error al crear producto: ' + err.message);
    }
  };

  // Guardar nuevo proveedor rápido
  const handleSaveNewProvider = async (e) => {
    e.preventDefault();
    if (!newProvForm.nombre.trim()) return toast.error('Ingrese el nombre del proveedor');

    try {
      const provRef = push(ref(rtdb, 'proveedores'));
      const provData = {
        nombre: newProvForm.nombre.trim(),
        ruc: newProvForm.ruc.trim() || '',
        telefono: newProvForm.telefono.trim() || '',
        direccion: newProvForm.direccion.trim() || '',
        contacto: newProvForm.contacto.trim() || ''
      };
      await set(provRef, provData);

      setSelectedProveedor({ value: provRef.key, label: provData.nombre });
      toast.success(`Proveedor "${provData.nombre}" registrado y seleccionado`);
      setIsNewProvModalOpen(false);
      setNewProvForm({ nombre: '', ruc: '', telefono: '', direccion: '', contacto: '' });
    } catch (err) {
      toast.error('Error al registrar proveedor: ' + err.message);
    }
  };

  // Procesar y confirmar la orden de compra
  const processPurchase = async () => {
    if (cart.length === 0) return toast.error("Agrega productos a la compra");
    if (!selectedProveedor) return toast.error("Seleccione un proveedor");
    if (!numeroFactura.trim()) return toast.error("Ingrese el número de factura del proveedor");

    const totalFactura = cart.reduce((s, i) => s + (i.current_cost * i.qty), 0);

    setConfirmModal({
      isOpen: true,
      title: 'Confirmar Ingreso de Compra',
      message: `¿Estás seguro de registrar esta compra por C$ ${totalFactura.toLocaleString('es-NI', { minimumFractionDigits: 2 })}? Esto aumentará el inventario inmediatamente.`,
      onConfirm: executePurchase
    });
  };

  const executePurchase = async () => {
    setConfirmModal({ ...confirmModal, isOpen: false });
    const toastId = toast.loading("Procesando ingreso de inventario...");
    
    try {
      const total = cart.reduce((sum, item) => sum + (item.current_cost * item.qty), 0);
      
      // 1. Crear el registro de Compra
      const compraRef = push(ref(rtdb, 'compras'));
      const compraId = compraRef.key;
      
      const newCompra = {
        id: compraId,
        fecha: new Date().toISOString(),
        sucursal,
        id_proveedor: selectedProveedor.value,
        nombre_proveedor: selectedProveedor.label,
        numero_factura: numeroFactura.trim(),
        metodo_pago: metodoPago,
        total,
        estado: 'Completado',
        items: cart.map(item => ({
          id_producto: item.id,
          nombre: item.name,
          cantidad: item.qty,
          costo_unitario: item.current_cost,
          subtotal: item.current_cost * item.qty
        }))
      };
      await set(compraRef, newCompra);

      // 2. Si es crédito, crear Cuenta por Pagar (CxP)
      if (metodoPago === 'Crédito') {
        const cxpRef = push(ref(rtdb, 'cxp'));
        const fechaVence = new Date();
        fechaVence.setDate(fechaVence.getDate() + 30); // 30 días de crédito por defecto
        await set(cxpRef, {
          id_proveedor: selectedProveedor.value,
          id_compra: compraId,
          numero_factura: numeroFactura.trim(),
          fecha_emision: newCompra.fecha,
          fecha_vencimiento: fechaVence.toISOString(),
          monto_total: total,
          saldo_pendiente: total,
          estado: 'Pendiente',
          sucursal
        });
      } else {
        // Si es Contado, asentar egreso en Contabilidad directamente
        const movRef = push(ref(rtdb, 'movimientos_contables'));
        await set(movRef, {
          fecha: newCompra.fecha,
          tipo: 'Egreso',
          categoria: 'Compra de Repuestos (Contado)',
          concepto: `Compra al contado factura ${numeroFactura.trim()} (${selectedProveedor.label})`,
          monto: total,
          metodo_pago: 'Efectivo',
          id_referencia: compraId,
          numero_comprobante: numeroFactura.trim(),
          beneficiario: selectedProveedor.label,
          sucursal,
          usuario: 'Compras'
        });
      }

      // 3. Aumentar Inventario y registrar en Kardex
      for (const item of cart) {
        // Actualizar stock
        const itemInvRef = ref(rtdb, `inventario/${sucursal}/${item.id}/stock_actual`);
        await runTransaction(itemInvRef, (currentStock) => {
          return (currentStock || 0) + item.qty;
        });

        // Actualizar último costo en el producto maestro
        const prodCostRef = ref(rtdb, `productos/${item.id}/cost`);
        await set(prodCostRef, Number(item.current_cost));

        // Registrar en Kardex
        const kardexRef = push(ref(rtdb, 'kardex'));
        await set(kardexRef, {
          fecha: new Date().toISOString(),
          id_sucursal: sucursal,
          id_producto: item.id,
          nombre_producto: item.name,
          tipo_movimiento: 'Entrada por Compra',
          cantidad: item.qty,
          id_referencia: numeroFactura.trim(),
          id_proveedor: selectedProveedor.value,
          usuario: 'Compras'
        });
      }

      toast.success("Compra procesada y stock actualizado exitosamente", { id: toastId });
      
      // Limpiar formulario
      setCart([]);
      setSelectedProveedor(null);
      setNumeroFactura('');
      setActiveTab('historial');

    } catch (error) {
      console.error(error);
      toast.error("Error al procesar compra: " + error.message, { id: toastId });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <ShoppingBag className="text-blue-600" size={26} /> 
            Compras y Abastecimiento
          </h1>
          <p className="text-gray-500 text-sm">
            Ingreso de facturas de proveedores, actualización automática de inventario y costos.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <select 
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
            className="border-gray-200 bg-gray-50 border p-2 rounded-xl font-bold text-xs text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="SUC-01">Sucursal Principal (SUC-01)</option>
            <option value="SUC-02">Sucursal Norte (SUC-02)</option>
          </select>

          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('historial')} 
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'historial' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Historial
            </button>
            <button 
              onClick={() => setActiveTab('sugerencias')} 
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'sugerencias' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Sugerencias 
              {sugerencias.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {sugerencias.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('nueva')} 
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'nueva' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              + Nueva Compra
            </button>
          </div>
        </div>
      </div>

      {/* ================= TAB 1: HISTORIAL DE COMPRAS ================= */}
      {activeTab === 'historial' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-4">Fecha y Hora</th>
                  <th className="p-4">Proveedor</th>
                  <th className="p-4">No. Factura</th>
                  <th className="p-4 text-center">Condición</th>
                  <th className="p-4 text-center">Ítems</th>
                  <th className="p-4 text-right">Total Factura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-medium">Cargando historial de compras...</td></tr>
                ) : compras.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-medium">No hay compras registradas aún.</td></tr>
                ) : (
                  compras.map(comp => (
                    <tr key={comp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600 text-xs font-mono">
                        {new Date(comp.fecha).toLocaleString('es-NI')}
                      </td>
                      <td className="p-4 font-bold text-gray-800">
                        {comp.nombre_proveedor}
                      </td>
                      <td className="p-4 font-mono text-xs font-bold text-blue-600">
                        {comp.numero_factura}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${comp.metodo_pago === 'Crédito' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                          {comp.metodo_pago}
                        </span>
                      </td>
                      <td className="p-4 text-center text-xs text-gray-500 font-medium">
                        {(comp.items || []).length} productos
                      </td>
                      <td className="p-4 text-right font-black text-gray-900 text-sm">
                        C$ {Number(comp.total || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: SUGERENCIAS DE REABASTECIMIENTO ================= */}
      {activeTab === 'sugerencias' && (
        <div className="space-y-4">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-2xl flex items-start gap-3 shadow-xs">
            <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={20} />
            <div>
              <h3 className="font-bold text-red-800 text-sm">Productos por Agotarse o en Nivel Crítico</h3>
              <p className="text-xs text-red-600 mt-0.5">
                Artículos que alcanzaron o están por debajo del stock mínimo. Puedes agregarlos a la orden de compra en un clic.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sugerencias.length === 0 ? (
              <div className="col-span-full p-8 text-center text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <CheckCircle2 className="mx-auto text-green-500 mb-2" size={36} />
                <p className="font-bold text-gray-700">Inventario con niveles óptimos</p>
                <p className="text-xs text-gray-400 mt-1">No hay alertas de stock bajo en este momento.</p>
              </div>
            ) : (
              sugerencias.map(prod => (
                <div key={prod.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:border-red-200 transition-colors">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-gray-400 font-bold bg-gray-50 px-1.5 py-0.5 rounded">{prod.id}</span>
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <TrendingDown size={12} /> Stock: {prod.stock_actual}
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-800 text-sm leading-tight mb-1">{prod.name}</h4>
                    <p className="text-xs text-gray-500">Mínimo sugerido: {prod.stock_minimo} unid.</p>
                    <p className="text-xs text-blue-600 font-bold mt-1">Faltante estimado: +{prod.faltante} unid.</p>
                  </div>
                  <button 
                    onClick={() => {
                      handleAddToCart(prod);
                      setActiveTab('nueva');
                      toast.success(`"${prod.name}" añadido a la orden de compra`);
                    }}
                    className="mt-4 w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs"
                  >
                    Añadir a Factura de Compra
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: NUEVA COMPRA (REDiseño LIMPIO Y SIN TARJETAS) ================= */}
      {activeTab === 'nueva' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LADO IZQUIERDO: CABECERA Y BUSCADOR INTELIGENTE FLOTANTE */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* DATOS DE LA FACTURA DEL PROVEEDOR */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Selector de Proveedor con Botón + Rápido */}
                <div className="md:col-span-2">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase">Proveedor *</label>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Select
                        options={proveedores.map(p => ({ value: p.id, label: p.nombre }))}
                        value={selectedProveedor}
                        onChange={setSelectedProveedor}
                        placeholder="Buscar o seleccionar proveedor..."
                        className="text-sm"
                        classNamePrefix="react-select"
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsNewProvModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg flex items-center justify-center shadow-sm h-[38px] w-[38px] transition-colors shrink-0"
                      title="Registrar Nuevo Proveedor Rápido"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                {/* Número de Factura Física */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">No. Factura Físico *</label>
                  <input 
                    type="text" 
                    value={numeroFactura} 
                    onChange={e => setNumeroFactura(e.target.value)} 
                    placeholder="Ej: F-10294" 
                    className="w-full border border-gray-200 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm h-[38px] uppercase font-mono font-bold" 
                  />
                </div>
              </div>

              {/* BUSCADOR INTELIGENTE CON LECTOR DE BARRAS, CÁMARA Y NUEVO PRODUCTO */}
              <div className="relative pt-2">
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">
                  Buscar Producto para Ingresar al Inventario
                </label>
                
                <div className="flex gap-2">
                  {/* Campo de Búsqueda con enter para lector físico */}
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      value={searchProd}
                      onChange={(e) => setSearchProd(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (searchProd.trim()) handleBarcodeInput(searchProd);
                        }
                      }}
                      placeholder="Escribe código, nombre o escanea con lector USB/Bluetooth..." 
                      className="w-full border border-gray-200 p-3 pl-10 pr-10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"
                    />
                    <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                    {searchProd && (
                      <button 
                        onClick={() => setSearchProd('')} 
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 text-sm font-bold"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  {/* Botón Escáner Cámara */}
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-100 transition-all active:scale-95 whitespace-nowrap h-[44px]"
                    title="Escanear código de barras con la cámara del celular"
                  >
                    <ScanBarcode size={18} />
                    <span className="hidden sm:inline">Cámara</span>
                  </button>

                  {/* Botón Crear Nuevo Producto Sobre la Marcha */}
                  <button
                    type="button"
                    onClick={() => {
                      const num = productos.length + 1;
                      setNewProductForm({
                        name: searchProd.trim(),
                        id: `PROD-${num.toString().padStart(4, '0')}`,
                        price: '',
                        cost: '',
                        cat: categorias[0] || 'Repuestos',
                        stock_minimo: 5,
                        ubicacion: ubicaciones[0] || '',
                        image: '',
                        compatibilidad: []
                      });
                      setIsNewProductModalOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-100 transition-all active:scale-95 whitespace-nowrap h-[44px]"
                    title="Crear un nuevo producto que no está en el catálogo"
                  >
                    <PackagePlus size={18} />
                    <span className="hidden sm:inline">Nuevo Producto</span>
                  </button>
                </div>

                {/* DESPLEGABLE FLOTANTE INTELIGENTE (SOLO CUANDO SE ESCRIBE O BUSCA) */}
                {searchProd.trim().length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-blue-200 rounded-2xl shadow-2xl z-30 max-h-80 overflow-y-auto divide-y divide-gray-100 animate-in fade-in">
                    {filteredSearch.length === 0 ? (
                      <div className="p-5 text-center text-gray-500 text-sm">
                        <p className="mb-2 font-medium">No se encontró "{searchProd}"</p>
                        <button
                          type="button"
                          onClick={() => {
                            const num = productos.length + 1;
                            setNewProductForm({
                              name: searchProd.trim(),
                              id: `PROD-${num.toString().padStart(4, '0')}`,
                              price: '',
                              cost: '',
                              cat: categorias[0] || 'Repuestos',
                              stock_minimo: 5,
                              ubicacion: ubicaciones[0] || '',
                              image: '',
                              compatibilidad: []
                            });
                            setIsNewProductModalOpen(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <PackagePlus size={16} /> Crear "{searchProd}" como nuevo producto
                        </button>
                      </div>
                    ) : (
                      filteredSearch.map(p => {
                        const stock = inventario[p.id]?.stock_actual || 0;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              handleAddToCart(p);
                              setSearchProd('');
                            }}
                            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-blue-50/70 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Miniatura con zoom */}
                              {p.image ? (
                                <div
                                  className="relative group shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewProduct(p);
                                  }}
                                  title="Ver foto ampliada"
                                >
                                  <img 
                                    src={p.image} 
                                    alt={p.name} 
                                    className="w-10 h-10 rounded-lg object-cover border border-gray-200 shadow-xs cursor-zoom-in group-hover:opacity-85 transition-opacity" 
                                  />
                                  <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Maximize2 size={14} className="text-white" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                                  <Package size={18} />
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                                    {p.id}
                                  </span>
                                  <p className="font-bold text-gray-800 text-sm truncate">{p.name}</p>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
                                  {p.cat && <span className="text-gray-600 font-medium">{p.cat}</span>}
                                  <span>• Stock actual: <strong className={stock <= 0 ? 'text-red-600' : 'text-gray-700'}>{stock}</strong></span>
                                  {p.compatibilidad && p.compatibilidad.length > 0 && (
                                    <span className="text-blue-600 hidden sm:inline">• {p.compatibilidad.join(', ')}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              <div className="text-right">
                                <span className="text-[10px] uppercase font-bold text-gray-400 block">Último Costo</span>
                                <span className="font-black text-gray-800 text-sm">C$ {p.cost || 0}</span>
                              </div>
                              <button
                                type="button"
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                              >
                                <Plus size={14} /> Agregar
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* TABLA DE PRODUCTOS A INGRESAR (AHORA CON ESPACIO AMPLIO) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-base text-gray-800 flex items-center gap-2">
                  <ShoppingBag className="text-blue-600" size={20} />
                  Lista de Productos a Ingresar en la Factura ({cart.length})
                </h2>
                {cart.length > 0 && (
                  <button 
                    onClick={() => setCart([])} 
                    className="text-xs text-red-500 hover:text-red-700 font-bold transition-colors"
                  >
                    Vaciar lista
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-12 px-4 text-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                  <Package className="mx-auto text-gray-300 mb-2" size={40} />
                  <p className="font-bold text-gray-600 text-sm">No has agregado productos a esta factura</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Escribe o escanea el código en el buscador superior para añadir repuestos.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100 text-xs uppercase">
                      <tr>
                        <th className="p-3">Producto</th>
                        <th className="p-3 text-center w-32">Cantidad</th>
                        <th className="p-3 text-right w-36">Costo Unitario</th>
                        <th className="p-3 text-right font-black text-blue-900 w-32">Subtotal</th>
                        <th className="p-3 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cart.map(item => {
                        const subtotal = item.current_cost * item.qty;
                        return (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            {/* Producto con foto */}
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                {item.image ? (
                                  <div 
                                    className="relative group shrink-0 cursor-pointer"
                                    onClick={() => setPreviewProduct(item)}
                                    title="Ver foto ampliada"
                                  >
                                    <img 
                                      src={item.image} 
                                      alt={item.name} 
                                      className="w-9 h-9 rounded-lg object-cover border border-gray-200 shadow-xs cursor-zoom-in group-hover:opacity-85 transition-opacity" 
                                    />
                                    <div className="absolute inset-0 bg-black/25 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Maximize2 size={12} className="text-white" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                                    <Package size={16} />
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-gray-800 text-sm leading-tight">{item.name}</p>
                                  <span className="font-mono text-[11px] text-gray-400">{item.id}</span>
                                </div>
                              </div>
                            </td>

                            {/* Controles de Cantidad */}
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    if (item.qty > 1) {
                                      setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty - 1 } : c));
                                    } else {
                                      setCart(cart.filter(c => c.id !== item.id));
                                    }
                                  }}
                                  className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded flex items-center justify-center font-bold"
                                >
                                  <Minus size={12} />
                                </button>
                                <input 
                                  type="number" 
                                  min="1" 
                                  value={item.qty} 
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setCart(cart.map(c => c.id === item.id ? { ...c, qty: val } : c));
                                  }}
                                  className="w-12 text-center font-bold border rounded py-0.5 outline-none text-xs" 
                                />
                                <button 
                                  type="button"
                                  onClick={() => setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c))}
                                  className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded flex items-center justify-center font-bold"
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </td>

                            {/* Costo Unitario Editable */}
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs font-bold text-gray-400">C$</span>
                                <input 
                                  type="number" 
                                  min="0" 
                                  step="0.01" 
                                  value={item.current_cost} 
                                  onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    setCart(cart.map(c => c.id === item.id ? { ...c, current_cost: val } : c));
                                  }}
                                  className="w-24 text-right font-bold border rounded py-1 px-1.5 outline-none text-xs focus:ring-1 focus:ring-blue-500" 
                                />
                              </div>
                            </td>

                            {/* Subtotal */}
                            <td className="p-3 text-right font-black text-gray-900 text-sm">
                              C$ {subtotal.toFixed(2)}
                            </td>

                            {/* Eliminar */}
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => setCart(cart.filter(c => c.id !== item.id))} 
                                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                title="Eliminar de la factura"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* LADO DERECHO: RESUMEN DE COMPRA Y CONDICIÓN DE PAGO */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-fit sticky top-6">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-bold text-base text-gray-800 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" /> 
                Resumen de Ingreso
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Verifica las condiciones de pago antes de confirmar.
              </p>
            </div>
            
            <div className="p-5 space-y-5">
              
              {/* Proveedor Seleccionado */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Proveedor Asignado</span>
                <p className="font-bold text-gray-800 text-sm truncate">
                  {selectedProveedor ? selectedProveedor.label : '⚠️ Ningún proveedor seleccionado'}
                </p>
                {numeroFactura && (
                  <p className="text-xs font-mono text-blue-600 font-bold mt-0.5">
                    Factura: {numeroFactura}
                  </p>
                )}
              </div>

              {/* Total Ítems */}
              <div className="flex justify-between items-center text-xs text-gray-600 font-medium border-b pb-3">
                <span>Total de Unidades a Ingresar:</span>
                <span className="font-bold text-gray-900 text-sm">
                  {cart.reduce((s, i) => s + i.qty, 0)} unidades
                </span>
              </div>

              {/* Condición de Pago */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Condición de Pago</label>
                <div className="grid grid-cols-2 bg-gray-100 rounded-xl p-1 gap-1">
                  <button 
                    type="button"
                    onClick={() => setMetodoPago('Contado')} 
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${metodoPago === 'Contado' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Contado (Caja)
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMetodoPago('Crédito')} 
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${metodoPago === 'Crédito' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Crédito (CxP)
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {metodoPago === 'Crédito' 
                    ? 'ℹ️ Se creará una Cuenta por Pagar a 30 días.' 
                    : 'ℹ️ Se asienta como egreso en el Libro Diario contable.'}
                </p>
              </div>

              {/* Total Factura */}
              <div className="pt-2 border-t">
                <span className="text-xs font-bold text-gray-500 uppercase block">Total a Pagar</span>
                <div className="text-3xl font-black text-gray-900">
                  C$ {cart.reduce((s, i) => s + (i.current_cost * i.qty), 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Botón de Confirmación */}
              <button 
                onClick={processPurchase}
                disabled={cart.length === 0 || !selectedProveedor || !numeroFactura.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <ShoppingBag size={18} />
                Registrar Ingreso de Inventario
              </button>

            </div>
          </div>

        </div>
      )}

      {/* ================= MODAL NUEVO PRODUCTO RÁPIDO ================= */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-gray-100 bg-emerald-50/70 flex justify-between items-center text-emerald-900">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-600 text-white">
                  <PackagePlus size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black">Crear Nuevo Producto</h2>
                  <p className="text-xs text-emerald-700">Se registrará en el inventario y se agregará a esta compra</p>
                </div>
              </div>
              <button onClick={() => setIsNewProductModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-2xl">&times;</button>
            </div>

            <form onSubmit={handleSaveNewProduct} className="p-5 space-y-4 overflow-y-auto">
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre del Producto *</label>
                <input 
                  required
                  type="text"
                  placeholder="Ej: Llanta Delantera 2.75-18 Tubeless"
                  value={newProductForm.name}
                  onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })}
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código / Código de Barras *</label>
                  <input 
                    required
                    type="text"
                    placeholder="PROD-0005 o código de barras"
                    value={newProductForm.id}
                    onChange={e => setNewProductForm({ ...newProductForm, id: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría</label>
                  <select
                    value={newProductForm.cat}
                    onChange={e => setNewProductForm({ ...newProductForm, cat: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {(categorias.length > 0 ? categorias : ['Repuestos', 'Llantas', 'Aceites', 'Baterías', 'Accesorios']).map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Costo de Compra (C$) *</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newProductForm.cost}
                    onChange={e => setNewProductForm({ ...newProductForm, cost: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-base font-black text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Precio de Venta Sugerido (C$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newProductForm.price}
                    onChange={e => setNewProductForm({ ...newProductForm, price: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-base font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock Mínimo (Alerta)</label>
                  <input 
                    type="number"
                    min="1"
                    value={newProductForm.stock_minimo}
                    onChange={e => setNewProductForm({ ...newProductForm, stock_minimo: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ubicación / Estante</label>
                  <select
                    value={newProductForm.ubicacion}
                    onChange={e => setNewProductForm({ ...newProductForm, ubicacion: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Sin asignar</option>
                    {ubicaciones.map((u, i) => (
                      <option key={i} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Imagen del producto (Opcional) */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Foto del Producto (Opcional)</label>
                <div className="flex items-center gap-3">
                  {newProductForm.image && (
                    <img 
                      src={newProductForm.image} 
                      alt="Vista previa" 
                      className="w-12 h-12 rounded-lg object-cover border border-gray-200 shadow-xs" 
                    />
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleProductImageUpload} 
                    className="text-xs file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer" 
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-emerald-200 transition-all active:scale-95"
                >
                  Guardar y Agregar a Factura
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL NUEVO PROVEEDOR RÁPIDO ================= */}
      {isNewProvModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 bg-gray-50/70 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Truck className="text-blue-600" size={20} />
                <h3 className="text-base font-bold text-gray-800">Registrar Nuevo Proveedor</h3>
              </div>
              <button onClick={() => setIsNewProvModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSaveNewProvider} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre o Razón Social *</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ej: Distribuidora Motopartes S.A." 
                  value={newProvForm.nombre}
                  onChange={e => setNewProvForm({ ...newProvForm, nombre: e.target.value })}
                  className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">RUC / Cédula</label>
                  <input 
                    type="text" 
                    placeholder="Ej: J031000..." 
                    value={newProvForm.ruc}
                    onChange={e => setNewProvForm({ ...newProvForm, ruc: e.target.value })}
                    className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Teléfono</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 2255-0000" 
                    value={newProvForm.telefono}
                    onChange={e => setNewProvForm({ ...newProvForm, telefono: e.target.value })}
                    className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Persona de Contacto</label>
                <input 
                  type="text" 
                  placeholder="Ej: Lic. Marlon Morales" 
                  value={newProvForm.contacto}
                  onChange={e => setNewProvForm({ ...newProvForm, contacto: e.target.value })}
                  className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsNewProvModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-blue-200 transition-all active:scale-95"
                >
                  Guardar y Seleccionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ESCÁNER CÓDIGO DE BARRAS POR CÁMARA */}
      <BarcodeScannerModal 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={(code) => handleBarcodeInput(code)}
      />

      {/* MODAL VISUALIZADOR DE FOTO DE PRODUCTO EN GRANDE */}
      <ImagePreviewModal 
        isOpen={!!previewProduct}
        onClose={() => setPreviewProduct(null)}
        product={previewProduct}
      />

      {/* MODAL DE CONFIRMACIÓN DE COMPRA */}
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        confirmText="Confirmar Ingreso"
        isDanger={false}
      />

    </div>
  );
}
