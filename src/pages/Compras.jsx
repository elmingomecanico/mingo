import React, { useState, useEffect } from 'react';
import { ref, onValue, push, set, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import { 
  ShoppingBag, Search, Plus, Trash2, AlertCircle, TrendingDown, CheckCircle2,
  ScanBarcode, Package, PackagePlus, Maximize2, X, Minus, Truck, Building, FileText,
  Edit2, Percent, DollarSign, Gift, Sparkles, ChevronDown, ChevronUp, Calculator
} from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import ConfirmModal from '../components/ConfirmModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import ImagePreviewModal from '../components/ImagePreviewModal';
import TokenizedSearchSelect from '../components/TokenizedSearchSelect';

export default function Compras() {
  const [activeTab, setActiveTab] = useState('nueva'); // 'nueva' | 'historial' | 'sugerencias'
  
  const [compras, setCompras] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);
  
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [inventario, setInventario] = useState({});
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [sucursal, setSucursal] = useState('SUC-01');
  
  const [loading, setLoading] = useState(true);

  // ================= ESTADO DE NUEVA COMPRA / FACTURA DE PROVEEDOR =================
  const [cart, setCart] = useState([]);
  const [selectedProveedor, setSelectedProveedor] = useState(null);
  const [numeroFactura, setNumeroFactura] = useState('');
  const [fechaFactura, setFechaFactura] = useState(new Date().toISOString().split('T')[0]);
  const [metodoPago, setMetodoPago] = useState('Crédito'); // 'Crédito' | 'Contado'
  const [diasCredito, setDiasCredito] = useState(30);
  const [regimenIva, setRegimenIva] = useState('exento'); // 'exento' | 'mas_iva' | 'incluido'
  const [descuentoGlobalValor, setDescuentoGlobalValor] = useState(0);
  const [descuentoGlobalTipo, setDescuentoGlobalTipo] = useState('C$'); // 'C$' | '%'
  const [fleteTransporte, setFleteTransporte] = useState(0);
  
  const [searchProd, setSearchProd] = useState('');
  
  // Modales
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);
  
  // Modal Crear Nuevo Producto
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

  // Modal Editar Producto Existente
  const [isEditProductModalOpen, setIsEditProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductForm, setEditProductForm] = useState({
    name: '',
    cat: '',
    ubicacion: '',
    compatibilidadText: '',
    image: ''
  });

  // Modal Crear Nuevo Proveedor
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

  // Alertas de inventario mínimo sugerido
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

  // Búsqueda inteligente
  const searchTerms = searchProd.toLowerCase().split(' ').filter(t => t.trim() !== '');
  const filteredSearch = productos.filter(p => {
    const compatText = (p.compatibilidad || []).join(' ');
    const textToSearch = `${p.name} ${p.id} ${p.cat || ''} ${compatText}`.toLowerCase();
    return searchTerms.every(term => textToSearch.includes(term));
  });

  // ================= CÁLCULOS MATEMÁTICOS DE FACTURA Y COSTOS =================
  // Cálculo detallado por línea de artículo
  const calculateItemMetrics = (item) => {
    const qtyComprada = Math.max(0, Number(item.qty) || 0);
    const bonifQty = Math.max(0, Number(item.bonifQty) || 0);
    const totalUnidadesFisicas = qtyComprada + bonifQty; // Lo que entra físicamente a bodega

    const costoLista = Math.max(0, Number(item.costoLista) || 0);
    const subtotalBruto = qtyComprada * costoLista;

    // Descuento en la línea
    let descuentoMonto = 0;
    if (item.descuentoTipo === '%') {
      descuentoMonto = (subtotalBruto * (Number(item.descuentoValor) || 0)) / 100;
    } else {
      descuentoMonto = Math.min(subtotalBruto, Number(item.descuentoValor) || 0);
    }
    const subtotalNetoLinea = Math.max(0, subtotalBruto - descuentoMonto);

    // IVA de la línea
    let ivaMonto = 0;
    if (regimenIva === 'mas_iva' && item.aplicaIva) {
      ivaMonto = subtotalNetoLinea * 0.15;
    }
    const montoAPagarLinea = subtotalNetoLinea + ivaMonto;

    // Costo Real Neto por unidad recibida (incluyendo regalías que bajan el costo promedio)
    const costoRealUnitario = totalUnidadesFisicas > 0 
      ? Number((montoAPagarLinea / totalUnidadesFisicas).toFixed(2))
      : 0;

    // Cálculo del precio de venta y margen de ganancia
    const precioVenta = Number(item.nuevoPrecioVenta) || 0;
    let margenPorcentaje = 0;
    if (precioVenta > 0 && costoRealUnitario > 0) {
      // Margen comercial sobre venta: ((Precio - Costo) / Precio) * 100
      margenPorcentaje = Number((((precioVenta - costoRealUnitario) / precioVenta) * 100).toFixed(1));
    }

    return {
      qtyComprada,
      bonifQty,
      totalUnidadesFisicas,
      costoLista,
      subtotalBruto,
      descuentoMonto,
      subtotalNetoLinea,
      ivaMonto,
      montoAPagarLinea,
      costoRealUnitario,
      precioVenta,
      margenPorcentaje
    };
  };

  // Cálculo de totales globales de la factura
  const globalSubtotalBruto = cart.reduce((sum, item) => sum + calculateItemMetrics(item).subtotalBruto, 0);
  const globalDescuentosLineas = cart.reduce((sum, item) => sum + calculateItemMetrics(item).descuentoMonto, 0);
  const globalIvaLineas = cart.reduce((sum, item) => sum + calculateItemMetrics(item).ivaMonto, 0);
  const subtotalDespuesLineas = globalSubtotalBruto - globalDescuentosLineas;

  // Descuento global adicional
  let montoDescuentoGlobal = 0;
  if (descuentoGlobalTipo === '%') {
    montoDescuentoGlobal = (subtotalDespuesLineas * (Number(descuentoGlobalValor) || 0)) / 100;
  } else {
    montoDescuentoGlobal = Math.min(subtotalDespuesLineas, Number(descuentoGlobalValor) || 0);
  }

  const subtotalNetoFinal = Math.max(0, subtotalDespuesLineas - montoDescuentoGlobal);
  const totalFacturaAPagar = subtotalNetoFinal + globalIvaLineas + (Number(fleteTransporte) || 0);
  const totalUnidadesFisicasBodega = cart.reduce((sum, item) => sum + calculateItemMetrics(item).totalUnidadesFisicas, 0);

  // ================= ACCIONES DEL CARRITO DE COMPRAS =================
  const handleAddToCart = (prod) => {
    const existing = cart.find(item => item.id === prod.id);
    if (existing) {
      setCart(cart.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item));
      toast.success(`+1 ${prod.name} en la factura`);
    } else {
      const costoBase = Number(prod.cost) || 0;
      const precioBase = Number(prod.price) || (costoBase > 0 ? Number((costoBase * 1.35).toFixed(2)) : 0);
      let margenCalc = 35;
      if (precioBase > 0 && costoBase > 0) {
        margenCalc = Number((((precioBase - costoBase) / precioBase) * 100).toFixed(1));
      }

      setCart([...cart, { 
        ...prod, 
        qty: 1, 
        bonifQty: 0,
        costoLista: costoBase,
        descuentoValor: 0,
        descuentoTipo: '%',
        aplicaIva: regimenIva === 'mas_iva',
        nuevoPrecioVenta: precioBase,
        margenSugerido: margenCalc,
        actualizarPrecioVenta: true,
        expandedDetails: false
      }]);
      toast.success(`"${prod.name}" agregado a la factura`);
    }
  };

  // Modificar valores de una línea
  const updateCartItem = (id, updates) => {
    setCart(cart.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };
      return updated;
    }));
  };

  // Cambio interactivo de Margen % -> Recalcula Precio de Venta
  const handleMargenChange = (id, nuevoMargen) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const { costoRealUnitario } = calculateItemMetrics(item);
    const m = Number(nuevoMargen) || 0;
    let nuevoPrecio = 0;
    if (m < 100 && costoRealUnitario > 0) {
      // Precio = Costo / (1 - Margen/100)
      nuevoPrecio = Number((costoRealUnitario / (1 - (m / 100))).toFixed(2));
    }
    updateCartItem(id, { margenSugerido: m, nuevoPrecioVenta: nuevoPrecio });
  };

  // Cambio interactivo de Precio de Venta -> Recalcula Margen %
  const handlePrecioVentaChange = (id, nuevoPrecio) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const { costoRealUnitario } = calculateItemMetrics(item);
    const p = Number(nuevoPrecio) || 0;
    let nuevoMargen = 0;
    if (p > 0 && costoRealUnitario > 0) {
      nuevoMargen = Number((((p - costoRealUnitario) / p) * 100).toFixed(1));
    }
    updateCartItem(id, { nuevoPrecioVenta: p, margenSugerido: nuevoMargen });
  };

  // Lector de código de barras
  const handleBarcodeInput = (code) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim().toLowerCase();
    
    let match = productos.find(p => 
      p.id?.toLowerCase() === cleanCode || 
      (p.barcode && p.barcode.toString().toLowerCase() === cleanCode) ||
      (p.codigo_barra && p.codigo_barra.toString().toLowerCase() === cleanCode)
    );

    if (!match) {
      const candidates = productos.filter(p => {
        const textToSearch = `${p.name} ${p.id} ${p.cat || ''}`.toLowerCase();
        return textToSearch.includes(cleanCode);
      });
      if (candidates.length === 1) match = candidates[0];
    }

    if (match) {
      handleAddToCart(match);
      setSearchProd('');
      toast.success(`⚡ Escaneado: ${match.name}`, { icon: '📦' });
    } else {
      toast.error(`No se encontró ningún producto con código: "${code.trim()}".`);
      setNewProductForm(prev => ({
        ...prev,
        id: code.trim().toUpperCase(),
        name: searchProd.trim()
      }));
    }
  };

  // Modal para Editar Producto Maestro
  const openEditProductModal = (prod) => {
    setEditingProduct(prod);
    setEditProductForm({
      name: prod.name || '',
      cat: prod.cat || categorias[0] || 'Repuestos',
      ubicacion: prod.ubicacion || '',
      compatibilidadText: (prod.compatibilidad || []).join(', '),
      image: prod.image || ''
    });
    setIsEditProductModalOpen(true);
  };

  const handleSaveEditedProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editProductForm.name.trim()) return toast.error('El nombre no puede estar vacío');

    try {
      const compatList = editProductForm.compatibilidadText
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const updates = {
        name: editProductForm.name.trim(),
        cat: editProductForm.cat,
        ubicacion: editProductForm.ubicacion,
        compatibilidad: compatList,
        image: editProductForm.image
      };

      // 1. Actualizar en Firebase RTDB
      await runTransaction(ref(rtdb, `productos/${editingProduct.id}`), (curr) => {
        return { ...curr, ...updates };
      });

      // 2. Actualizar en la lista local de la compra
      setCart(cart.map(c => c.id === editingProduct.id ? { ...c, ...updates } : c));

      toast.success(`Producto "${updates.name}" actualizado en catálogo`);
      setIsEditProductModalOpen(false);
      setEditingProduct(null);
    } catch (err) {
      toast.error('Error al editar producto: ' + err.message);
    }
  };

  // Guardar nuevo producto maestro y agregarlo a la factura
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

      await set(ref(rtdb, `productos/${prodId}`), newProdData);
      await set(ref(rtdb, `inventario/${sucursal}/${prodId}`), {
        stock_actual: 0,
        stock_minimo: Number(newProductForm.stock_minimo) || 5,
        ubicacion: newProductForm.ubicacion || ''
      });

      handleAddToCart({ id: prodId, ...newProdData });

      toast.success(`✨ "${newProdData.name}" creado y añadido a la factura`);
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
      toast.success(`Proveedor "${provData.nombre}" registrado`);
      setIsNewProvModalOpen(false);
      setNewProvForm({ nombre: '', ruc: '', telefono: '', direccion: '', contacto: '' });
    } catch (err) {
      toast.error('Error al registrar proveedor: ' + err.message);
    }
  };

  // Procesar y confirmar la orden de compra
  const processPurchase = async () => {
    if (cart.length === 0) return toast.error("Agregue al menos un producto a la compra");
    if (!selectedProveedor) return toast.error("Seleccione un proveedor");
    if (!numeroFactura.trim()) return toast.error("Ingrese el número de factura física del proveedor");

    setConfirmModal({
      isOpen: true,
      title: 'Confirmar Ingreso de Factura de Proveedor',
      message: `¿Estás seguro de registrar la factura ${numeroFactura.trim()} de ${selectedProveedor.label} por un total de C$ ${totalFacturaAPagar.toLocaleString('es-NI', { minimumFractionDigits: 2 })}? Se ingresarán ${totalUnidadesFisicasBodega} unidades físicas al inventario y se actualizarán costos y precios maestros.`,
      onConfirm: executePurchase
    });
  };

  const executePurchase = async () => {
    setConfirmModal({ ...confirmModal, isOpen: false });
    const toastId = toast.loading("Procesando factura y actualizando inventario...");
    
    try {
      const compraRef = push(ref(rtdb, 'compras'));
      const compraId = compraRef.key;
      
      const newCompra = {
        id: compraId,
        fecha: new Date(fechaFactura).toISOString(),
        fecha_registro: new Date().toISOString(),
        sucursal,
        id_proveedor: selectedProveedor.value,
        nombre_proveedor: selectedProveedor.label,
        numero_factura: numeroFactura.trim(),
        metodo_pago: metodoPago,
        dias_credito: metodoPago === 'Crédito' ? diasCredito : 0,
        regimen_iva: regimenIva,
        descuento_global_monto: montoDescuentoGlobal,
        flete: Number(fleteTransporte) || 0,
        total: totalFacturaAPagar,
        total_unidades: totalUnidadesFisicasBodega,
        estado: 'Completado',
        items: cart.map(item => {
          const m = calculateItemMetrics(item);
          return {
            id_producto: item.id,
            nombre: item.name,
            cantidad_facturada: m.qtyComprada,
            cantidad_bonificada: m.bonifQty,
            total_unidades: m.totalUnidadesFisicas,
            costo_lista: m.costoLista,
            descuento_monto: m.descuentoMonto,
            iva_monto: m.ivaMonto,
            subtotal_linea: m.montoAPagarLinea,
            costo_real_unitario: m.costoRealUnitario,
            nuevo_precio_venta: m.precioVenta,
            margen_porcentaje: m.margenPorcentaje
          };
        })
      };
      await set(compraRef, newCompra);

      // 1. Si es Crédito, registrar en CxP
      if (metodoPago === 'Crédito') {
        const cxpRef = push(ref(rtdb, 'cxp'));
        const fechaVence = new Date(fechaFactura);
        fechaVence.setDate(fechaVence.getDate() + Number(diasCredito));
        await set(cxpRef, {
          id_proveedor: selectedProveedor.value,
          id_compra: compraId,
          numero_factura: numeroFactura.trim(),
          fecha_emision: new Date(fechaFactura).toISOString(),
          fecha_vencimiento: fechaVence.toISOString(),
          monto_total: totalFacturaAPagar,
          saldo_pendiente: totalFacturaAPagar,
          estado: 'Pendiente',
          sucursal
        });
      } else {
        // 2. Si es Contado, asentar egreso en Libro Diario de Contabilidad
        const movRef = push(ref(rtdb, 'movimientos_contables'));
        await set(movRef, {
          fecha: new Date(fechaFactura).toISOString(),
          tipo: 'Egreso',
          categoria: 'Pago a Proveedor (Repuestos/Insumos)',
          concepto: `Compra al contado factura ${numeroFactura.trim()} (${selectedProveedor.label})`,
          monto: totalFacturaAPagar,
          metodo_pago: 'Efectivo',
          id_referencia: compraId,
          numero_comprobante: numeroFactura.trim(),
          beneficiario: selectedProveedor.label,
          sucursal,
          usuario: 'Compras'
        });
      }

      // 3. Aumentar Inventario, Actualizar Costo Real y Precio de Venta en Catálogo, y Asentar Kardex
      for (const item of cart) {
        const m = calculateItemMetrics(item);

        // Aumentar stock físico (compradas + bonificadas)
        const itemInvRef = ref(rtdb, `inventario/${sucursal}/${item.id}/stock_actual`);
        await runTransaction(itemInvRef, (currentStock) => {
          return (currentStock || 0) + m.totalUnidadesFisicas;
        });

        // Actualizar último costo real en el catálogo maestro
        const prodCostRef = ref(rtdb, `productos/${item.id}/cost`);
        await set(prodCostRef, m.costoRealUnitario);

        // Actualizar precio de venta en catálogo maestro si está seleccionado
        if (item.actualizarPrecioVenta && m.precioVenta > 0) {
          const prodPriceRef = ref(rtdb, `productos/${item.id}/price`);
          await set(prodPriceRef, m.precioVenta);
        }

        // Registrar movimiento detallado en Kardex
        const kardexRef = push(ref(rtdb, 'kardex'));
        await set(kardexRef, {
          fecha: new Date().toISOString(),
          id_sucursal: sucursal,
          id_producto: item.id,
          nombre_producto: item.name,
          tipo_movimiento: 'Entrada por Compra',
          cantidad: m.totalUnidadesFisicas,
          id_referencia: numeroFactura.trim(),
          id_proveedor: selectedProveedor.value,
          costo_unitario: m.costoRealUnitario,
          precio_venta: m.precioVenta,
          detalle: `${m.qtyComprada} facturadas${m.bonifQty > 0 ? ` + ${m.bonifQty} bonificación/regalía` : ''}`,
          usuario: 'Compras'
        });
      }

      toast.success("Factura de compra registrada y catálogo actualizado con éxito", { id: toastId });
      
      // Limpiar formulario
      setCart([]);
      setSelectedProveedor(null);
      setNumeroFactura('');
      setDescuentoGlobalValor(0);
      setFleteTransporte(0);
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
            Compras y Facturación de Proveedores
          </h1>
          <p className="text-gray-500 text-sm">
            Ingreso de facturas, cálculo exacto de costo real con IVA, descuentos, regalías y fijación de margen comercial.
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
              onClick={() => setActiveTab('nueva')} 
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'nueva' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              + Ingresar Factura
            </button>
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
          </div>
        </div>
      </div>

      {/* ================= TAB: NUEVA COMPRA (FORMULARIO EXACTO Y MULTI-CRITERIO) ================= */}
      {activeTab === 'nueva' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LADO IZQUIERDO (COLUMNA PRINCIPAL): CABECERA, BUSCADOR Y LISTA DE ÍTEMS */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* CABECERA DE LA FACTURA FÍSICA DEL PROVEEDOR */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="border-b pb-3 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={16} className="text-blue-600" />
                  Datos de la Factura Física del Proveedor
                </span>
                <span className="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {sucursal}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Proveedor */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Proveedor *</label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <TokenizedSearchSelect
                        options={proveedores.map(p => ({
                          id: p.id,
                          value: p.id,
                          label: p.nombre,
                          sublabel: [p.telefono1, p.contacto ? `Contacto: ${p.contacto}` : '', p.ruc ? `RUC: ${p.ruc}` : ''].filter(Boolean).join(' • '),
                          searchFields: [p.nombre, p.telefono1, p.telefono2, p.contacto, p.ruc, p.direccion]
                        }))}
                        value={selectedProveedor?.value || selectedProveedor?.id}
                        onChange={(sel) => setSelectedProveedor(sel ? { value: sel.id, label: sel.label } : null)}
                        placeholder="Buscar proveedor por nombre, RUC, teléfono o contacto..."
                        icon={Building}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsNewProvModalOpen(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl flex items-center justify-center shadow-sm h-[42px] w-[42px] transition-colors shrink-0"
                      title="Registrar Nuevo Proveedor Rápido"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                {/* No. Factura Físico */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">No. Factura Físico *</label>
                  <input 
                    type="text" 
                    value={numeroFactura} 
                    onChange={e => setNumeroFactura(e.target.value)} 
                    placeholder="Ej: F-10294" 
                    className="w-full border border-gray-200 p-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm h-[38px] uppercase font-mono font-bold" 
                  />
                </div>
              </div>

              {/* Fila 2: Fecha Factura y Régimen de IVA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha de Emisión Factura</label>
                  <input 
                    type="date"
                    value={fechaFactura}
                    onChange={e => setFechaFactura(e.target.value)}
                    className="w-full border border-gray-200 p-2 rounded-xl text-xs font-bold text-gray-700 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tratamiento de IVA en Factura</label>
                  <select
                    value={regimenIva}
                    onChange={e => {
                      const nuevoReg = e.target.value;
                      setRegimenIva(nuevoReg);
                      // Ajustar el checkbox aplicaIva en los ítems si cambia el régimen
                      setCart(cart.map(c => ({
                        ...c,
                        aplicaIva: nuevoReg === 'mas_iva'
                      })));
                    }}
                    className="w-full border border-gray-200 p-2 rounded-xl bg-gray-50 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="exento">Factura Exenta de IVA (Sin Impuesto)</option>
                    <option value="mas_iva">+ 15% IVA (Se suma sobre subtotal gravado)</option>
                    <option value="incluido">IVA Ya Incluido en los precios de lista</option>
                  </select>
                </div>
              </div>

              {/* BUSCADOR INTELIGENTE CON LECTOR DE BARRAS, CÁMARA Y NUEVO PRODUCTO */}
              <div className="relative pt-3 border-t">
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">
                  Buscar Producto para Agregar a la Factura
                </label>
                
                <div className="flex gap-2">
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
                    title="Escanear código de barras con la cámara"
                  >
                    <ScanBarcode size={18} />
                    <span className="hidden sm:inline">Cámara</span>
                  </button>

                  {/* Botón Crear Nuevo Producto */}
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
                    title="Crear un nuevo producto que no existe en el catálogo"
                  >
                    <PackagePlus size={18} />
                    <span className="hidden sm:inline">Nuevo Producto</span>
                  </button>
                </div>

                {/* DESPLEGABLE FLOTANTE INTELIGENTE */}
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
                                  <span>• Precio Venta actual: <strong className="text-emerald-700 font-bold">C$ {p.price || 0}</strong></span>
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

            {/* TABLA DE PRODUCTOS DE LA FACTURA (CÁLCULO EXACTO DE COSTOS, REGALÍAS Y MÁRGENES) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
              <div className="flex justify-between items-center mb-1">
                <div>
                  <h2 className="font-bold text-base text-gray-800 flex items-center gap-2">
                    <ShoppingBag className="text-blue-600" size={20} />
                    Artículos en la Factura ({cart.length})
                  </h2>
                  <p className="text-xs text-gray-400">
                    Cálculo automático de costo neto, regalías bonificadas y fijación de margen comercial.
                  </p>
                </div>
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
                <div className="py-14 px-4 text-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                  <Calculator className="mx-auto text-gray-300 mb-2" size={44} />
                  <p className="font-bold text-gray-700 text-sm">Factura vacía</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                    Busca o escanea repuestos en el buscador superior para ingresar artículos, descuentos y bonificaciones.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item, index) => {
                    const metrics = calculateItemMetrics(item);

                    return (
                      <div 
                        key={item.id} 
                        className="p-4 rounded-2xl border border-gray-200 bg-white hover:border-blue-300 transition-all space-y-3 shadow-xs"
                      >
                        {/* Fila Principal: Producto, Cantidades, Costo de Lista y Total Línea */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          
                          {/* Producto con Foto y Botón de Edición Maestra */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {item.image ? (
                              <div 
                                className="relative group shrink-0 cursor-pointer"
                                onClick={() => setPreviewProduct(item)}
                                title="Ver foto ampliada"
                              >
                                <img 
                                  src={item.image} 
                                  alt={item.name} 
                                  className="w-11 h-11 rounded-xl object-cover border border-gray-200 shadow-xs cursor-zoom-in" 
                                />
                                <div className="absolute inset-0 bg-black/25 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Maximize2 size={14} className="text-white" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                                <Package size={18} />
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {item.id}
                                </span>
                                <p className="font-bold text-gray-900 text-sm truncate">{item.name}</p>
                                <button
                                  type="button"
                                  onClick={() => openEditProductModal(item)}
                                  className="text-blue-600 hover:text-blue-800 p-1 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Editar nombre, categoría o datos maestros del producto"
                                >
                                  <Edit2 size={13} />
                                </button>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                {item.cat || 'Repuestos'} • Ubicación: {item.ubicacion || 'Bodega'}
                              </p>
                            </div>
                          </div>

                          {/* Subtotal de Línea a Pagar y Botón Eliminar */}
                          <div className="flex items-center gap-4 self-end sm:self-center">
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-gray-400 block">Subtotal a Pagar</span>
                              <span className="font-black text-gray-900 text-base">
                                C$ {metrics.montoAPagarLinea.toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <button
                              onClick={() => setCart(cart.filter(c => c.id !== item.id))}
                              className="text-gray-300 hover:text-red-500 p-1.5 rounded-lg transition-colors"
                              title="Quitar de la factura"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                        </div>

                        {/* Fila de Controles: Cantidades, Costo Bruto, Descuentos e IVA */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-gray-100 text-xs">
                          
                          {/* 1. Cantidad Comprada */}
                          <div className="bg-gray-50/80 p-2 rounded-xl border border-gray-100">
                            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                              Cant. Facturada
                            </label>
                            <div className="flex items-center gap-1">
                              <button 
                                type="button"
                                onClick={() => updateCartItem(item.id, { qty: Math.max(1, (item.qty || 1) - 1) })}
                                className="w-6 h-6 bg-white border border-gray-200 rounded flex items-center justify-center font-bold text-gray-600"
                              >
                                -
                              </button>
                              <input 
                                type="number" 
                                min="1" 
                                value={item.qty} 
                                onChange={(e) => updateCartItem(item.id, { qty: Math.max(1, parseInt(e.target.value) || 1) })} 
                                className="w-12 text-center font-black border rounded py-0.5 outline-none bg-white" 
                              />
                              <button 
                                type="button"
                                onClick={() => updateCartItem(item.id, { qty: (item.qty || 1) + 1 })}
                                className="w-6 h-6 bg-white border border-gray-200 rounded flex items-center justify-center font-bold text-gray-600"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* 2. Regalía / Bonificación (+ Bonif) */}
                          <div className="bg-purple-50/50 p-2 rounded-xl border border-purple-100">
                            <label className="text-[10px] uppercase font-bold text-purple-700 block mb-1 flex items-center gap-1">
                              <Gift size={11} /> + Regalía / Bonif
                            </label>
                            <div className="flex items-center gap-1">
                              <input 
                                type="number" 
                                min="0" 
                                placeholder="0"
                                value={item.bonifQty === 0 ? '' : item.bonifQty} 
                                onChange={(e) => updateCartItem(item.id, { bonifQty: Math.max(0, parseInt(e.target.value) || 0) })} 
                                className="w-full text-center font-bold border border-purple-200 rounded py-0.5 outline-none bg-white text-purple-800" 
                              />
                            </div>
                            <span className="text-[9px] text-purple-600 font-semibold block mt-0.5 text-center">
                              Total entra: <strong>{metrics.totalUnidadesFisicas}</strong> unid.
                            </span>
                          </div>

                          {/* 3. Costo Bruto de Lista */}
                          <div className="bg-gray-50/80 p-2 rounded-xl border border-gray-100">
                            <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                              Costo Lista (C$)
                            </label>
                            <input 
                              type="number" 
                              min="0" 
                              step="0.01" 
                              value={item.costoLista} 
                              onChange={(e) => updateCartItem(item.id, { costoLista: Math.max(0, parseFloat(e.target.value) || 0) })} 
                              className="w-full font-bold border rounded py-0.5 px-2 outline-none bg-white text-right" 
                            />
                            <span className="text-[9px] text-gray-400 block mt-0.5 text-right">
                              Bruto: C$ {metrics.subtotalBruto.toFixed(0)}
                            </span>
                          </div>

                          {/* 4. Descuento de Línea */}
                          <div className="bg-gray-50/80 p-2 rounded-xl border border-gray-100">
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-[10px] uppercase font-bold text-gray-500">
                                Descuento
                              </label>
                              <button 
                                type="button"
                                onClick={() => updateCartItem(item.id, { descuentoTipo: item.descuentoTipo === '%' ? 'C$' : '%' })}
                                className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 rounded hover:bg-blue-100"
                              >
                                {item.descuentoTipo}
                              </button>
                            </div>
                            <input 
                              type="number" 
                              min="0" 
                              step="0.01" 
                              placeholder="0"
                              value={item.descuentoValor === 0 ? '' : item.descuentoValor} 
                              onChange={(e) => updateCartItem(item.id, { descuentoValor: Math.max(0, parseFloat(e.target.value) || 0) })} 
                              className="w-full font-bold border rounded py-0.5 px-2 outline-none bg-white text-right" 
                            />
                            <span className="text-[9px] text-emerald-600 font-semibold block mt-0.5 text-right">
                              - C$ {metrics.descuentoMonto.toFixed(2)}
                            </span>
                          </div>

                        </div>

                        {/* Fila de Resultados: Costo Real Unitario, Margen % y Nuevo Precio de Venta */}
                        <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-xs">
                          
                          {/* Costo Real Neto Calculado */}
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-blue-600 text-white shrink-0">
                              <Calculator size={14} />
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-blue-900 block">
                                Costo Real Neto Unitario
                              </span>
                              <span className="text-sm font-black text-blue-950 font-mono">
                                C$ {metrics.costoRealUnitario.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-blue-700 block">
                                ({metrics.montoAPagarLinea.toFixed(0)} / {metrics.totalUnidadesFisicas} unid.)
                              </span>
                            </div>
                          </div>

                          {/* Margen de Ganancia (%) */}
                          <div>
                            <label className="text-[10px] uppercase font-bold text-gray-600 block mb-0.5 flex items-center gap-1">
                              Margen Ganancia (%)
                            </label>
                            <div className="flex items-center gap-1">
                              <input 
                                type="number" 
                                step="0.5"
                                value={item.margenSugerido} 
                                onChange={(e) => handleMargenChange(item.id, e.target.value)} 
                                className="w-20 font-black border border-blue-200 rounded py-1 px-2 text-center bg-white text-blue-900 outline-none" 
                              />
                              <span className="font-bold text-gray-500">%</span>
                            </div>
                          </div>

                          {/* Nuevo Precio de Venta en Catálogo */}
                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-gray-600 block mb-0.5">
                                Nuevo Precio Venta (C$)
                              </label>
                              <input 
                                type="number" 
                                step="0.01"
                                value={item.nuevoPrecioVenta} 
                                onChange={(e) => handlePrecioVentaChange(item.id, e.target.value)} 
                                className="w-28 font-black border border-emerald-300 rounded py-1 px-2 text-right bg-white text-emerald-800 text-sm outline-none" 
                              />
                            </div>
                            <div className="pt-3">
                              <label className="flex items-center gap-1 text-[11px] font-bold text-gray-600 cursor-pointer" title="Actualizar automáticamente en el catálogo maestro y POS">
                                <input 
                                  type="checkbox"
                                  checked={item.actualizarPrecioVenta}
                                  onChange={e => updateCartItem(item.id, { actualizarPrecioVenta: e.target.checked })}
                                  className="rounded text-blue-600"
                                />
                                <span>Actualizar POS</span>
                              </label>
                            </div>
                          </div>

                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* LADO DERECHO: PIE DE FACTURA, TOTALES Y CONDICIÓN DE PAGO */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-fit sticky top-6">
            <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-bold text-base text-gray-800 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" /> 
                Liquidación de Factura
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Cuadre exacto con el total físico emitido por el proveedor.
              </p>
            </div>
            
            <div className="p-5 space-y-4">
              
              {/* Proveedor y Factura */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase">Proveedor:</span>
                  <span className="font-bold text-gray-800 truncate max-w-[170px]">
                    {selectedProveedor ? selectedProveedor.label : 'Sin seleccionar'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase">No. Factura:</span>
                  <span className="font-mono font-bold text-blue-600">
                    {numeroFactura || 'Sin ingresar'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-bold uppercase">Unidades a Bodega:</span>
                  <span className="font-bold text-purple-700">
                    {totalUnidadesFisicasBodega} unid.
                  </span>
                </div>
              </div>

              {/* Desglose de Operación */}
              <div className="space-y-2 text-xs border-b pb-3 text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal Bruto de Productos:</span>
                  <span className="font-mono font-bold">C$ {globalSubtotalBruto.toFixed(2)}</span>
                </div>

                {globalDescuentosLineas > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>(-) Descuentos por Línea:</span>
                    <span className="font-mono font-bold">- C$ {globalDescuentosLineas.toFixed(2)}</span>
                  </div>
                )}

                {/* Descuento Global Adicional */}
                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1 font-medium">
                    Descuento Global:
                    <button
                      type="button"
                      onClick={() => setDescuentoGlobalTipo(descuentoGlobalTipo === 'C$' ? '%' : 'C$')}
                      className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1 rounded"
                    >
                      {descuentoGlobalTipo}
                    </button>
                  </span>
                  <div className="w-24">
                    <input 
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={descuentoGlobalValor === 0 ? '' : descuentoGlobalValor}
                      onChange={e => setDescuentoGlobalValor(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full text-right font-bold border rounded py-0.5 px-1.5 outline-none text-xs"
                    />
                  </div>
                </div>

                {/* IVA de la Factura */}
                <div className="flex justify-between items-center pt-1">
                  <span className="font-medium">IVA (15%):</span>
                  <span className="font-mono font-bold text-gray-800">
                    C$ {globalIvaLineas.toFixed(2)}
                  </span>
                </div>

                {/* Flete o Transporte */}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-medium">Flete / Transporte:</span>
                  <div className="w-24">
                    <input 
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={fleteTransporte === 0 ? '' : fleteTransporte}
                      onChange={e => setFleteTransporte(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full text-right font-bold border rounded py-0.5 px-1.5 outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Total Factura */}
              <div className="pt-1">
                <span className="text-xs font-bold text-gray-500 uppercase block">Total a Pagar Proveedor</span>
                <div className="text-3xl font-black text-gray-900">
                  C$ {totalFacturaAPagar.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Condición de Pago */}
              <div className="space-y-2 pt-2 border-t">
                <label className="block text-xs font-bold text-gray-600 uppercase">Condición de Pago</label>
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

                {metodoPago === 'Crédito' && (
                  <div className="pt-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Plazo de Crédito (Días)</label>
                    <select
                      value={diasCredito}
                      onChange={e => setDiasCredito(Number(e.target.value))}
                      className="w-full border p-1.5 rounded-lg text-xs font-bold text-gray-700 outline-none"
                    >
                      <option value="15">15 Días</option>
                      <option value="30">30 Días (Estándar)</option>
                      <option value="45">45 Días</option>
                      <option value="60">60 Días</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Botón de Confirmación */}
              <button 
                onClick={processPurchase}
                disabled={cart.length === 0 || !selectedProveedor || !numeroFactura.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                Registrar Factura en Inventario
              </button>

            </div>
          </div>

        </div>
      )}

      {/* ================= TAB: HISTORIAL DE COMPRAS ================= */}
      {activeTab === 'historial' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100 text-xs uppercase">
                <tr>
                  <th className="p-4">Fecha Factura</th>
                  <th className="p-4">Proveedor</th>
                  <th className="p-4">No. Factura</th>
                  <th className="p-4 text-center">Condición</th>
                  <th className="p-4 text-center">Unidades</th>
                  <th className="p-4 text-right">Total Factura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-medium">Cargando compras...</td></tr>
                ) : compras.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-medium">No hay compras registradas aún.</td></tr>
                ) : (
                  compras.map(comp => (
                    <tr key={comp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600 text-xs font-mono">
                        {new Date(comp.fecha).toLocaleDateString('es-NI')}
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
                      <td className="p-4 text-center text-xs text-gray-600 font-bold">
                        {comp.total_unidades || (comp.items || []).reduce((s, i) => s + (i.total_unidades || i.cantidad || 0), 0)} unid.
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

      {/* ================= TAB: SUGERENCIAS DE COMPRA ================= */}
      {activeTab === 'sugerencias' && (
        <div className="space-y-4">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-2xl flex items-start gap-3 shadow-xs">
            <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={20} />
            <div>
              <h3 className="font-bold text-red-800 text-sm">Productos por Agotarse o en Nivel Crítico</h3>
              <p className="text-xs text-red-600 mt-0.5">
                Artículos que alcanzaron o están por debajo del stock mínimo. Haz clic para agregarlos a la orden.
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

      {/* ================= MODAL EDITAR PRODUCTO MAESTRO ================= */}
      {isEditProductModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-blue-50/70 flex justify-between items-center text-blue-900 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-600 text-white">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">Editar Datos del Producto</h2>
                  <p className="text-xs text-blue-700 font-mono">{editingProduct.id}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsEditProductModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white/50 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEditedProduct} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo del Producto *</label>
                  <input 
                    required
                    type="text"
                    value={editProductForm.name}
                    onChange={e => setEditProductForm({ ...editProductForm, name: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría</label>
                    <select
                      value={editProductForm.cat}
                      onChange={e => setEditProductForm({ ...editProductForm, cat: e.target.value })}
                      className="w-full border border-gray-200 p-2.5 rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {(categorias.length > 0 ? categorias : ['Repuestos', 'Llantas', 'Aceites', 'Baterías', 'Accesorios']).map((c, i) => (
                        <option key={i} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ubicación / Estante</label>
                    <select
                      value={editProductForm.ubicacion}
                      onChange={e => setEditProductForm({ ...editProductForm, ubicacion: e.target.value })}
                      className="w-full border border-gray-200 p-2.5 rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sin asignar</option>
                      {ubicaciones.map((u, i) => (
                        <option key={i} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modelos de Moto Compatibles (Separados por coma)</label>
                  <input 
                    type="text"
                    placeholder="Ej: Pulsar 180, Boxer 100, YBR 125"
                    value={editProductForm.compatibilidadText}
                    onChange={e => setEditProductForm({ ...editProductForm, compatibilidadText: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-blue-200 transition-all active:scale-95"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CREAR NUEVO PRODUCTO RÁPIDO ================= */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-emerald-50/70 flex justify-between items-center text-emerald-900 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-600 text-white">
                  <PackagePlus size={20} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">Crear Nuevo Producto</h2>
                  <p className="text-xs text-emerald-700">Se agregará al catálogo maestro y a la factura actual</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsNewProductModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white/50 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNewProduct} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Precio Venta Sugerido (C$)</label>
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
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewProductModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-200 transition-all active:scale-95"
                >
                  Guardar y Agregar a Factura
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CREAR NUEVO PROVEEDOR RÁPIDO ================= */}
      {isNewProvModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/70 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <Truck className="text-blue-600" size={20} />
                <h3 className="text-base font-bold text-gray-800">Registrar Nuevo Proveedor</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsNewProvModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNewProvider} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">RUC / Cédula</label>
                    <input 
                      type="text" 
                      placeholder="Ej: J031000..." 
                      value={newProvForm.ruc}
                      onChange={e => setNewProvForm({ ...newProvForm, ruc: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
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
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewProvModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-blue-200 transition-all active:scale-95"
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
