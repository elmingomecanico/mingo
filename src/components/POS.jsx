import React, { useState, useEffect } from 'react';
import { ShoppingCart, Trash2, Search, Save, Loader, Printer, Plus, X, UserPlus, Minus } from 'lucide-react';
import { ref, onValue, push, set, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import Select from 'react-select';
import TicketPrinter from './TicketPrinter';

export default function POS() {
  const [sucursal, setSucursal] = useState('SUC-01');
  
  // ================= TAB SYSTEM =================
  const getDefaultTab = (num = 1) => ({
    id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
    name: `Factura ${num}`,
    cart: [],
    selectedCliente: { value: 'MOSTRADOR', label: 'CLIENTE DE MOSTRADOR' },
    metodoPago: 'Efectivo',
    selectedMecanico: null,
    selectedEmpleadoDeudor: null
  });

  const [tabs, setTabsState] = useState(() => {
    const saved = localStorage.getItem('pos_tabs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t, i) => ({
            ...t,
            name: t.name?.startsWith('Borrador') ? t.name.replace('Borrador', 'Factura') : (t.name || `Factura ${i + 1}`)
          }));
        }
      } catch (e) {}
    }
    return [getDefaultTab(1)];
  });

  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id || Date.now().toString());

  const setTabs = (newTabs) => {
    setTabsState(newTabs);
    localStorage.setItem('pos_tabs', JSON.stringify(newTabs));
  };

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0] || getDefaultTab(1);
  
  const updateActiveTab = (updates) => {
    const updatedTabs = tabs.map(t => t.id === activeTabId ? { ...t, ...updates } : t);
    setTabs(updatedTabs);
  };

  // State proxies
  const cart = activeTab.cart;
  const setCart = (newCartVal) => updateActiveTab({ cart: typeof newCartVal === 'function' ? newCartVal(cart) : newCartVal });

  const selectedCliente = activeTab.selectedCliente;
  const handleSelectCliente = (val) => {
    const isGenericName = !activeTab.name || activeTab.name.startsWith('Factura') || activeTab.name.startsWith('Borrador');
    let newName = activeTab.name;
    if (val && val.value !== 'MOSTRADOR') {
      if (isGenericName) {
        newName = val.label;
      }
    } else if (isGenericName) {
      const idx = tabs.findIndex(t => t.id === activeTabId) + 1;
      newName = `Factura ${idx > 0 ? idx : 1}`;
    }
    updateActiveTab({ selectedCliente: val, name: newName });
  };

  const metodoPago = activeTab.metodoPago;
  const setMetodoPago = (val) => updateActiveTab({ metodoPago: val });

  const selectedMecanico = activeTab.selectedMecanico;
  const setSelectedMecanico = (val) => updateActiveTab({ selectedMecanico: val });

  const selectedEmpleadoDeudor = activeTab.selectedEmpleadoDeudor;
  const setSelectedEmpleadoDeudor = (val) => updateActiveTab({ selectedEmpleadoDeudor: val });

  const addNewTab = () => {
    const newTab = getDefaultTab(tabs.length + 1);
    const nextTabs = [...tabs, newTab];
    setTabs(nextTabs);
    setActiveTabId(newTab.id);
  };

  const closeTab = (idToClose, e) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      const freshTab = getDefaultTab(1);
      setTabs([freshTab]);
      setActiveTabId(freshTab.id);
    } else {
      const newTabs = tabs.filter(t => t.id !== idToClose);
      setTabs(newTabs);
      if (activeTabId === idToClose) {
        setActiveTabId(newTabs[0].id);
      }
    }
  };
  // ================= END TAB SYSTEM =================

  const [searchCode, setSearchCode] = useState('');
  const [products, setProducts] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [mecanicos, setMecanicos] = useState([]);
  const [empleados, setEmpleados] = useState([]);

  // Modal para creación rápida de clientes
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    nombre: '',
    telefono1: '',
    cedula: '',
    direccion: '',
    limite_credito: ''
  });

  useEffect(() => {
    const prodRef = ref(rtdb, 'productos');
    const servRef = ref(rtdb, 'servicios');
    const invRef = ref(rtdb, `inventario/${sucursal}`);

    const unsubProd = onValue(prodRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const prodList = Object.keys(data).map(key => ({
          id: key,
          type: 'producto',
          ...data[key]
        }));
        setProducts(prodList);
      } else {
        setProducts([]);
      }
    });

    const unsubServ = onValue(servRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const servList = Object.keys(data).map(key => ({
          id: key,
          type: 'servicio',
          name: data[key].nombre,
          price: data[key].precio || 0,
          cat: 'Servicio'
        }));
        setServicios(servList);
      } else {
        setServicios([]);
      }
    });

    const unsubInv = onValue(invRef, (snapshot) => {
      if (snapshot.val()) {
        setInventory(snapshot.val());
      } else {
        setInventory({});
      }
      setLoading(false);
    });

    const cliRef = ref(rtdb, 'clientes');
    const unsubCli = onValue(cliRef, (snapshot) => {
      if (snapshot.exists()) {
        setClientes(Object.keys(snapshot.val()).map(key => ({
          id: key,
          ...snapshot.val()[key]
        })));
      } else {
        setClientes([]);
      }
    });

    const usrRef = ref(rtdb, 'usuarios');
    const unsubUsr = onValue(usrRef, (snapshot) => {
      if (snapshot.exists()) {
        const listMec = [];
        const listEmp = [];
        Object.keys(snapshot.val()).forEach(key => {
          const u = snapshot.val()[key];
          if (u.estado === 'Activo') {
            const empData = { id: key, ...u };
            listEmp.push(empData);
            if (u.funcion === 'Mecánico') {
              listMec.push(empData);
            }
          }
        });
        setMecanicos(listMec);
        setEmpleados(listEmp);
      } else {
        setMecanicos([]);
        setEmpleados([]);
      }
    });

    return () => {
      unsubProd();
      unsubServ();
      unsubInv();
      unsubCli();
      unsubUsr();
    };
  }, [sucursal]);

  const allItems = [...products, ...servicios];
  const searchTerms = searchCode.toLowerCase().split(' ').filter(t => t.trim() !== '');
  const filteredProducts = allItems.filter(p => {
    const compatText = (p.compatibilidad || []).join(' ');
    const textToSearch = `${p.name} ${p.id} ${p.cat || ''} ${compatText}`.toLowerCase();
    return searchTerms.every(term => textToSearch.includes(term));
  });

  const addToCart = (product) => {
    const stockActual = inventory[product.id]?.stock_actual || 0;
    const existing = cart.find(item => item.id === product.id);
    const requestedQty = existing ? existing.qty + 1 : 1;

    if (product.type !== 'servicio' && requestedQty > stockActual) {
      toast.error(`Stock insuficiente. Solo quedan ${stockActual} unidades disponibles.`);
      return;
    }

    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1, discount: 0 }]);
    }
  };

  const updateCartQty = (productId, newQty) => {
    const item = cart.find(c => c.id === productId);
    if (!item) return;

    if (newQty <= 0) {
      setCart(cart.filter(c => c.id !== productId));
      return;
    }

    if (item.type !== 'servicio') {
      const stockActual = inventory[productId]?.stock_actual || 0;
      if (newQty > stockActual) {
        toast.error(`Stock máximo disponible: ${stockActual}`);
        return;
      }
    }

    setCart(cart.map(c => c.id === productId ? { ...c, qty: newQty } : c));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.qty) - item.discount, 0);
  
  // Variables para la impresión
  const [completedSale, setCompletedSale] = useState(null);
  const printRef = React.useRef();
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Factura_${completedSale?.id || 'POS'}`,
    onAfterPrint: () => setCompletedSale(null),
  });

  const handleCreateQuickClient = async (e) => {
    e.preventDefault();
    if (!newClientForm.nombre.trim()) return toast.error('El nombre del cliente es obligatorio');

    try {
      const cliRef = push(ref(rtdb, 'clientes'));
      const newCli = {
        nombre: newClientForm.nombre.trim(),
        telefono1: newClientForm.telefono1.trim(),
        cedula: newClientForm.cedula.trim(),
        direccion: newClientForm.direccion.trim(),
        limite_credito: Number(newClientForm.limite_credito) || 0,
        fecha_registro: new Date().toISOString()
      };
      await set(cliRef, newCli);
      toast.success('Cliente creado con éxito');
      const option = { value: cliRef.key, label: newCli.nombre };
      handleSelectCliente(option);
      setIsNewClientModalOpen(false);
      setNewClientForm({ nombre: '', telefono1: '', cedula: '', direccion: '', limite_credito: '' });
    } catch (err) {
      toast.error('Error al guardar cliente: ' + err.message);
    }
  };

  const processSale = async () => {
    if (cart.length === 0) return toast.error('El carrito está vacío');
    if (!selectedCliente) return toast.error('Seleccione un cliente');
    if (cart.some(item => item.type === 'servicio') && !selectedMecanico) {
      return toast.error('Debe asignar un mecánico para la mano de obra');
    }
    
    // Si es crédito empleado
    if (metodoPago === 'Crédito Empleado' && !selectedEmpleadoDeudor) {
      return toast.error('Debe seleccionar al empleado al que se le otorga el crédito');
    }
    
    // Si es crédito a cliente, verificar si hay límite disponible
    if (metodoPago === 'Crédito' && selectedCliente.value !== 'MOSTRADOR') {
      const clienteData = clientes.find(c => c.id === selectedCliente.value);
      if (!clienteData) return toast.error('Cliente no encontrado');
      
      if (clienteData.limite_credito > 0 && total > clienteData.limite_credito) {
        return toast.error(`El monto supera el límite de crédito del cliente (C$ ${clienteData.limite_credito})`);
      }
    }

    setLoading(true);

    try {
      // Obtener número secuencial (FAC-0001)
      const counterRef = ref(rtdb, 'counters/ventas');
      const counterResult = await runTransaction(counterRef, (currentData) => {
        return (currentData || 0) + 1;
      });
      const numFactura = counterResult.snapshot.val();
      const humanId = `FAC-${numFactura.toString().padStart(4, '0')}`;

      const saleRef = push(ref(rtdb, 'ventas'));
      const saleId = saleRef.key;
      
      const newSale = {
        id: saleId,
        numero_factura: humanId,
        fecha: new Date().toISOString(),
        sucursal,
        id_cliente: selectedCliente.value,
        nombre_cliente: selectedCliente.label,
        metodo_pago: metodoPago,
        id_mecanico: selectedMecanico ? selectedMecanico.value : null,
        nombre_mecanico: selectedMecanico ? selectedMecanico.label : null,
        empleado_deudor: selectedEmpleadoDeudor ? selectedEmpleadoDeudor.value : null,
        total,
        estado: 'Completado',
        items: cart.map(item => ({
          id_producto: item.id,
          type: item.type || 'producto',
          name: item.name,
          cantidad: item.qty,
          precio_unitario: item.price,
          subtotal: (item.price * item.qty) - item.discount
        }))
      };

      await set(saleRef, newSale);

      // Si es crédito a cliente, generar cuenta por cobrar
      if (metodoPago === 'Crédito' && selectedCliente.value !== 'MOSTRADOR') {
        const cxcRecord = push(ref(rtdb, 'cxc'));
        const fechaVence = new Date();
        fechaVence.setDate(fechaVence.getDate() + 30);
        
        await set(cxcRecord, {
          id_cliente: selectedCliente.value,
          id_factura: saleId,
          numero_factura: humanId,
          fecha_emision: newSale.fecha,
          fecha_vencimiento: fechaVence.toISOString(),
          monto_total: total,
          saldo_pendiente: total,
          estado: 'Pendiente'
        });
      }

      // Si es crédito a empleado, registrar deuda en RRHH
      if (metodoPago === 'Crédito Empleado' && selectedEmpleadoDeudor) {
        const deudaRecord = push(ref(rtdb, 'deudas_empleados'));
        await set(deudaRecord, {
          id_empleado: selectedEmpleadoDeudor.value,
          tipo: 'Crédito',
          motivo: `Compra interna - Factura ${humanId}`,
          monto_total: total,
          saldo_pendiente: total,
          cuota_por_pago: total,
          fecha_creacion: newSale.fecha,
          estado: 'Activo'
        });
      }

      // Si hay servicios, generar Orden de Trabajo
      const serviciosEnCarrito = cart.filter(item => item.type === 'servicio');
      if (serviciosEnCarrito.length > 0 && selectedMecanico) {
        const otRef = push(ref(rtdb, 'ordenes_trabajo'));
        const totalServicios = serviciosEnCarrito.reduce((sum, item) => sum + ((item.price * item.qty) - item.discount), 0);
        
        await set(otRef, {
          id_factura: saleId,
          numero_factura: humanId,
          fecha_creacion: newSale.fecha,
          id_cliente: selectedCliente.value,
          nombre_cliente: selectedCliente.label,
          id_mecanico: selectedMecanico.value,
          nombre_mecanico: selectedMecanico.label,
          estado: 'Pendiente',
          servicios: serviciosEnCarrito.map(s => ({
            id_servicio: s.id,
            nombre: s.name,
            cantidad: s.qty,
            subtotal: (s.price * s.qty) - s.discount
          })),
          total_servicios: totalServicios,
          comision_mecanico_porcentaje: selectedMecanico.comision || 50,
          comision_mecanico_monto: totalServicios * ((selectedMecanico.comision || 50) / 100)
        });
      }

      // Descontar inventario
      for (const item of cart) {
        if (item.type !== 'servicio') {
          const invProdRef = ref(rtdb, `inventario/${sucursal}/${item.id}/stock_actual`);
          await runTransaction(invProdRef, (currentStock) => {
            return (currentStock || 0) - item.qty;
          });

          // Registrar en Kardex
          const kardexRef = push(ref(rtdb, `kardex/${sucursal}/${item.id}`));
          const currentStock = inventory[item.id]?.stock_actual || 0;
          await set(kardexRef, {
            fecha: new Date().toISOString(),
            tipo: 'SALIDA',
            motivo: `Venta POS (${humanId})`,
            cantidad: item.qty,
            stock_anterior: currentStock,
            stock_nuevo: currentStock - item.qty,
            usuario: 'Cajero POS'
          });
        }
      }

      toast.success(`Factura ${humanId} procesada exitosamente`);
      setCompletedSale(newSale);
      
      // Cerrar la pestaña procesada
      closeTab(activeTabId, { stopPropagation: () => {} });

    } catch (error) {
      toast.error('Error al procesar la venta: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6 animate-in fade-in duration-500">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Lado Izquierdo (Operativo de Caja) */}
        <div className="md:col-span-2 space-y-4">
          
          {/* TAB BAR ESTILO NAVEGADOR */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {tabs.map((t) => (
              <div 
                key={t.id} 
                onClick={() => setActiveTabId(t.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-t-xl border-t border-x cursor-pointer transition-all ${activeTabId === t.id ? 'bg-white border-white shadow-sm font-bold text-blue-600' : 'bg-gray-200 border-gray-300 text-gray-500 hover:bg-gray-100'}`}
              >
                <input 
                  type="text"
                  value={t.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTabs(tabs.map(tab => tab.id === t.id ? { ...tab, name: val } : tab));
                  }}
                  className="bg-transparent border-none outline-none min-w-[70px] max-w-[150px] text-sm font-bold truncate p-0 m-0 cursor-text"
                  placeholder="Nombre pestaña..."
                />
                {tabs.length > 1 && (
                  <button 
                    onClick={(e) => closeTab(t.id, e)} 
                    className="p-1 rounded-full hover:bg-red-100 hover:text-red-500 text-gray-400 transition-colors"
                    title="Cerrar pestaña"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button 
              onClick={addNewTab}
              className="flex items-center justify-center p-2 rounded-t-xl bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors shadow-sm"
              title="Nueva factura en paralelo (+)"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* BARRA SUPERIOR CAJA & SUCURSAL */}
          <div className="bg-white p-4 rounded-xl rounded-tl-none shadow-sm flex items-center justify-between -mt-4 relative z-10 border border-gray-100">
            <h1 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <ShoppingCart className="text-blue-600" size={22} />
              Caja POS
            </h1>
            <select 
              value={sucursal}
              onChange={(e) => setSucursal(e.target.value)}
              className="border border-gray-200 p-2 rounded-lg bg-gray-50 font-bold text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="SUC-01">Sucursal Principal (SUC-01)</option>
              <option value="SUC-02">Sucursal Norte (SUC-02)</option>
            </select>
          </div>

          {/* DATOS DE LA VENTA (CLIENTE, PAGO, BUSCADOR) */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-4">
            
            {/* Cliente y Método de Pago */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Cliente</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Select
                      options={[
                        { value: 'MOSTRADOR', label: 'CLIENTE DE MOSTRADOR' },
                        ...clientes.map(c => ({ value: c.id, label: c.nombre }))
                      ]}
                      filterOption={(candidate, input) => {
                        if (!input) return true;
                        const tokens = input.toLowerCase().split(/\s+/).filter(Boolean);
                        const target = candidate.label.toLowerCase();
                        return tokens.every(token => target.includes(token));
                      }}
                      value={selectedCliente}
                      onChange={handleSelectCliente}
                      placeholder="Buscar cliente..."
                      className="react-select-container text-sm"
                      classNamePrefix="react-select"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsNewClientModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg flex items-center justify-center shadow-sm h-[38px] w-[38px] transition-colors"
                    title="Crear Nuevo Cliente"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Método de Pago</label>
                <select 
                  value={metodoPago} 
                  onChange={e => setMetodoPago(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm h-[38px] font-medium"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta / POS</option>
                  <option value="Transferencia">Transferencia</option>
                  {selectedCliente?.value !== 'MOSTRADOR' && <option value="Crédito">Crédito (CxC)</option>}
                  <option value="Crédito Empleado">Crédito a Empleado</option>
                </select>
              </div>

              {metodoPago === 'Crédito Empleado' && (
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-purple-600 mb-1 uppercase">Empleado deudor (Deducción RRHH)</label>
                  <Select
                    options={empleados.map(e => ({ value: e.id, label: e.nombre_completo }))}
                    value={selectedEmpleadoDeudor}
                    onChange={setSelectedEmpleadoDeudor}
                    placeholder="Seleccionar empleado..."
                    isClearable
                    className="react-select-container text-sm"
                    classNamePrefix="react-select"
                  />
                </div>
              )}

              {cart.some(item => item.type === 'servicio') && (
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Mecánico Asignado a los Servicios</label>
                  <Select
                    options={mecanicos.map(m => ({ 
                      value: m.id, 
                      label: m.nombre_completo,
                      comision: m.porcentaje_comision || 50
                    }))}
                    value={selectedMecanico}
                    onChange={setSelectedMecanico}
                    placeholder="Seleccionar mecánico responsable..."
                    isClearable
                    className="react-select-container text-sm"
                    classNamePrefix="react-select"
                  />
                </div>
              )}
            </div>

            {/* BUSCADOR INTELIGENTE CON RESULTADOS FLOTANTES */}
            <div className="relative pt-1">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Buscar y Agregar Productos o Servicios</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  placeholder="Escribe código, nombre o modelo compatible para agregar..." 
                  className="w-full border border-gray-200 p-3 pl-10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"
                />
                <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
                {searchCode && (
                  <button 
                    onClick={() => setSearchCode('')} 
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 text-sm font-bold"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* LISTA DESPLEGABLE DE RESULTADOS FILTRADOS (SOLO APARECE AL BUSCAR) */}
              {searchCode.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-blue-200 rounded-xl shadow-2xl z-30 max-h-80 overflow-y-auto divide-y divide-gray-100 animate-in fade-in">
                  {loading && <div className="p-4 text-center text-gray-400 text-sm">Buscando...</div>}
                  {!loading && filteredProducts.length === 0 && (
                    <div className="p-4 text-center text-gray-400 text-sm">
                      No se encontraron resultados para "{searchCode}"
                    </div>
                  )}
                  {!loading && filteredProducts.map(p => {
                    const isService = p.type === 'servicio';
                    const stock = isService ? '∞' : (inventory[p.id]?.stock_actual || 0);
                    const hasStock = isService || stock > 0;
                    
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => {
                          if (hasStock) {
                            addToCart(p);
                            setSearchCode('');
                          }
                        }}
                        className={`p-3 flex items-center justify-between cursor-pointer hover:bg-blue-50 transition-colors ${!hasStock ? 'opacity-50 bg-gray-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {p.id}
                          </span>
                          <div>
                            <p className="font-bold text-gray-800 text-sm">
                              {isService ? '🔧 ' : ''}{p.name}
                            </p>
                            {p.compatibilidad && p.compatibilidad.length > 0 && (
                              <p className="text-[11px] text-blue-600 font-medium">
                                Compat: {p.compatibilidad.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isService ? 'bg-purple-100 text-purple-700' : (stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}`}>
                            {isService ? 'Servicio' : `${stock} disp.`}
                          </span>
                          <span className="font-black text-blue-700 text-base min-w-[70px] text-right">
                            C$ {p.price}
                          </span>
                          <button 
                            type="button"
                            disabled={!hasStock}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"
                          >
                            <Plus size={14} /> Agregar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* LISTA DE PRODUCTOS QUE SE ESTÁN FACTURANDO (CARRITO SIEMPRE VISIBLE) */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-base text-gray-800 flex items-center gap-2">
                <ShoppingCart className="text-green-600" size={18} />
                Lista de Productos y Servicios a Facturar ({cart.length})
              </h2>
              {cart.length > 0 && (
                <button 
                  onClick={() => setCart([])} 
                  className="text-xs text-red-500 hover:text-red-700 font-bold"
                >
                  Vaciar lista
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-12 px-4 text-center border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                <ShoppingCart className="mx-auto text-gray-300 mb-2" size={36} />
                <p className="font-bold text-gray-600 text-sm">Esta factura está vacía</p>
                <p className="text-xs text-gray-400 mt-1">Escribe en el buscador de arriba para agregar productos o servicios.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                    <tr>
                      <th className="p-3">Descripción</th>
                      <th className="p-3 text-center w-32">Cantidad</th>
                      <th className="p-3 text-right">Precio Unit.</th>
                      <th className="p-3 text-right font-black text-blue-900">Subtotal</th>
                      <th className="p-3 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cart.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {item.type === 'servicio' && <span className="text-purple-600 font-bold text-xs bg-purple-50 px-1.5 py-0.5 rounded">Servicio</span>}
                            <span className="font-bold text-gray-800">{item.name}</span>
                          </div>
                          <span className="font-mono text-[11px] text-gray-400">{item.id}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              type="button"
                              onClick={() => updateCartQty(item.id, item.qty - 1)}
                              className="w-7 h-7 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg flex items-center justify-center font-bold"
                            >
                              <Minus size={14} />
                            </button>
                            <input 
                              type="number" 
                              min="1" 
                              value={item.qty} 
                              onChange={(e) => updateCartQty(item.id, parseInt(e.target.value) || 1)}
                              className="w-12 text-center font-bold border rounded-lg py-1 outline-none text-sm" 
                            />
                            <button 
                              type="button"
                              onClick={() => updateCartQty(item.id, item.qty + 1)}
                              className="w-7 h-7 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg flex items-center justify-center font-bold"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-right text-gray-600 font-medium">C$ {item.price.toFixed(2)}</td>
                        <td className="p-3 text-right font-black text-blue-800 text-base">
                          C$ {((item.price * item.qty) - item.discount).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            type="button"
                            onClick={() => setCart(cart.filter(c => c.id !== item.id))}
                            className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-colors"
                            title="Eliminar de la lista"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Lado Derecho (Resumen y Cobro) */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-t-4 border-t-blue-600">
            <h2 className="font-black text-gray-400 uppercase tracking-wider text-xs mb-3">Resumen de Factura</h2>
            <div className="flex justify-between text-base text-gray-600 mb-2">
              <span>Cliente:</span>
              <span className="font-bold text-gray-800 truncate max-w-[150px]">{selectedCliente?.label}</span>
            </div>
            <div className="flex justify-between text-base text-gray-600 mb-2">
              <span>Método:</span>
              <span className="font-bold text-gray-800">{metodoPago}</span>
            </div>
            <div className="flex justify-between text-base text-gray-600 mb-2">
              <span>Ítems:</span>
              <span className="font-bold text-gray-800">{cart.reduce((sum, i) => sum + i.qty, 0)}</span>
            </div>
            <div className="flex justify-between text-3xl font-black mt-4 pt-4 border-t border-gray-100 text-blue-900">
              <span>TOTAL:</span>
              <span>C$ {total.toFixed(2)}</span>
            </div>
          </div>

          <button 
            onClick={processSale}
            disabled={loading || cart.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black text-lg py-4 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-green-100 transition-all active:scale-95"
          >
            {loading ? <Loader className="animate-spin" size={24} /> : <Save size={24} />}
            PROCESAR FACTURA
          </button>
        </div>

      </div>

      {/* Modal Creación Rápida de Cliente */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                <UserPlus className="text-blue-600" size={20} />
                Nuevo Cliente Rápido
              </h2>
              <button onClick={() => setIsNewClientModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleCreateQuickClient} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Nombre Completo *</label>
                <input 
                  required 
                  type="text" 
                  value={newClientForm.nombre} 
                  onChange={e => setNewClientForm({...newClientForm, nombre: e.target.value})} 
                  placeholder="Ej: Santos Gómez" 
                  className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Teléfono</label>
                  <input 
                    type="text" 
                    value={newClientForm.telefono1} 
                    onChange={e => setNewClientForm({...newClientForm, telefono1: e.target.value})} 
                    placeholder="Ej: 8888-8888" 
                    className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Cédula / RUC</label>
                  <input 
                    type="text" 
                    value={newClientForm.cedula} 
                    onChange={e => setNewClientForm({...newClientForm, cedula: e.target.value})} 
                    placeholder="Ej: 001-..." 
                    className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Límite de Crédito (C$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={newClientForm.limite_credito} 
                  onChange={e => setNewClientForm({...newClientForm, limite_credito: e.target.value})} 
                  placeholder="0.00" 
                  className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Dirección</label>
                <input 
                  type="text" 
                  value={newClientForm.direccion} 
                  onChange={e => setNewClientForm({...newClientForm, direccion: e.target.value})} 
                  placeholder="Ej: Barrio Central..." 
                  className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsNewClientModalOpen(false)} 
                  className="px-4 py-2 rounded-lg text-gray-600 font-bold hover:bg-gray-100 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-md shadow-blue-200 transition-colors"
                >
                  Guardar y Seleccionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Impresión */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 text-center border-b border-gray-100 bg-gray-50/50">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Printer size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">¡Venta Completada!</h2>
              <p className="text-gray-500 text-sm mt-1">¿Deseas imprimir el ticket?</p>
            </div>
            
            <div className="p-6 flex flex-col gap-3">
              <button 
                onClick={handlePrint}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold shadow-sm transition-colors flex justify-center items-center gap-2"
              >
                <Printer size={20} />
                Imprimir Ticket
              </button>
              <button 
                onClick={() => setCompletedSale(null)}
                className="w-full text-gray-500 font-bold hover:bg-gray-100 px-6 py-3 rounded-lg transition-colors"
              >
                Cerrar (Sin imprimir)
              </button>
            </div>
            
            <TicketPrinter ref={printRef} sale={completedSale} />
          </div>
        </div>
      )}

    </div>
  );
}
