import React, { useState, useEffect } from 'react';
import { ShoppingCart, Trash2, Search, Save, Loader, Printer, Plus, X, UserPlus, Minus, Percent, FileDown, ShieldAlert, Sparkles, RefreshCw, Gift, Lock, Camera, Maximize2, Package, ScanBarcode, LockOpen, ArrowUpRight, Calculator, CheckCircle2, AlertTriangle, Coins, DollarSign } from 'lucide-react';
import { ref, onValue, push, set, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import Select from 'react-select';
import TicketPrinter from './TicketPrinter';
import BarcodeScannerModal from './BarcodeScannerModal';
import ImagePreviewModal from './ImagePreviewModal';
import CashOpenModal from './CashOpenModal';
import CashCloseModal from './CashCloseModal';
import CashMovementModal from './CashMovementModal';
import MoneyCounterModal from './MoneyCounterModal';

export default function POS() {
  const { user } = useAuth();
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
  const cart = activeTab.cart || [];
  const setCart = (newCartVal) => updateActiveTab({ cart: typeof newCartVal === 'function' ? newCartVal(cart) : newCartVal });

  const selectedCliente = activeTab.selectedCliente || { value: 'MOSTRADOR', label: 'CLIENTE DE MOSTRADOR' };
  const metodoPago = activeTab.metodoPago || 'Efectivo';
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
    if (e && e.stopPropagation) e.stopPropagation();
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

  // Modal para creación rápida de clientes por cajero
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    nombre: '',
    telefono1: '',
    cedula: '',
    direccion: ''
  });

  // Modal para escáner de código de barras por cámara y vista previa de imagen
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);

  // Estados de Control de Caja (Apertura, Salidas a Gerencia, Cierre y Contador)
  const [activeTurno, setActiveTurno] = useState(null);
  const [turnosList, setTurnosList] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [isCashOpenModalOpen, setIsCashOpenModalOpen] = useState(false);
  const [isCashCloseModalOpen, setIsCashCloseModalOpen] = useState(false);
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false);
  const [isMoneyCounterOpen, setIsMoneyCounterOpen] = useState(false);

  useEffect(() => {
    const prodRef = ref(rtdb, 'productos');
    const servRef = ref(rtdb, 'servicios');
    const invRef = ref(rtdb, `inventario/${sucursal}`);
    const turnosRef = ref(rtdb, 'turnos_caja');
    const ventasRef = ref(rtdb, 'ventas');

    const unsubTurnos = onValue(turnosRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setTurnosList(list);
        const abierto = list.find(t => t.sucursal === sucursal && t.estado === 'Abierta');
        setActiveTurno(abierto || null);
      } else {
        setTurnosList([]);
        setActiveTurno(null);
      }
    });

    const unsubVentas = onValue(ventasRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setSalesList(list);
      } else {
        setSalesList([]);
      }
    });

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
      unsubTurnos();
      unsubVentas();
    };
  }, [sucursal]);

  const allItems = [...products, ...servicios];
  const searchTerms = searchCode.toLowerCase().split(' ').filter(t => t.trim() !== '');
  const filteredProducts = allItems.filter(p => {
    const compatText = (p.compatibilidad || []).join(' ');
    const textToSearch = `${p.name} ${p.id} ${p.cat || ''} ${compatText}`.toLowerCase();
    return searchTerms.every(term => textToSearch.includes(term));
  });

  // Buscar objeto del cliente actual desde la base de datos
  const clienteActualObj = clientes.find(c => c.id === selectedCliente?.value);
  const isMostrador = !selectedCliente || selectedCliente.value === 'MOSTRADOR';
  const isClienteRegistrado = !isMostrador && !!clienteActualObj;
  const hasPrivilegios = isClienteRegistrado && (clienteActualObj.descuento_fijo || 0) > 0;

  // Función para evaluar si el descuento aplica según el método de pago configurado por gerencia
  const evalClienteDescuento = (cliente, metodo) => {
    if (!cliente || !(cliente.descuento_fijo > 0)) {
      return { aplica: false, porcentaje: 0, metodosPermitidos: [], regalia: cliente?.regalia_observacion || null };
    }
    const metodosConfig = cliente.descuento_metodos || { Efectivo: true, Transferencia: true, Tarjeta: false, 'Crédito': false };
    const metodoNorm = metodo?.includes('Tarjeta') ? 'Tarjeta' : (metodo?.includes('Crédito') ? 'Crédito' : metodo);
    const aplica = !!metodosConfig[metodoNorm];
    const metodosPermitidos = Object.keys(metodosConfig).filter(k => metodosConfig[k]);
    return {
      aplica,
      porcentaje: aplica ? cliente.descuento_fijo : 0,
      metodosPermitidos,
      regalia: cliente.regalia_observacion || null
    };
  };

  const descuentoEval = evalClienteDescuento(clienteActualObj, metodoPago);

  // Determinación estricta y blindada del descuento de un ítem según los 3 niveles:
  // 1. Cliente con Privilegios: descuento automático fijado por gerencia (o 0 si el método no califica). Cajero bloqueado.
  // 2. Cliente Registrado sin Privilegios: 0.00 siempre. Cajero bloqueado.
  // 3. Cliente de Mostrador: descuento manual/promoción editable por el cajero.
  const getItemDiscount = (item) => {
    const itemTotal = (item.price || 0) * (item.qty || 1);
    if (!isMostrador) {
      if (hasPrivilegios && descuentoEval.aplica) {
        return Number(((itemTotal * (clienteActualObj.descuento_fijo || 0)) / 100).toFixed(2));
      }
      return 0;
    }
    return Math.min(itemTotal, Math.max(0, Number((item.discount || 0).toFixed(2))));
  };

  const getItemDiscountPercent = (item) => {
    const itemTotal = (item.price || 0) * (item.qty || 1);
    if (!isMostrador) {
      if (hasPrivilegios && descuentoEval.aplica) {
        return clienteActualObj.descuento_fijo || 0;
      }
      return 0;
    }
    if (itemTotal <= 0) return 0;
    const disc = getItemDiscount(item);
    return Number(((disc / itemTotal) * 100).toFixed(1));
  };

  const handleMetodoPagoChange = (newMetodo) => {
    const prevEval = evalClienteDescuento(clienteActualObj, metodoPago);
    const newEval = evalClienteDescuento(clienteActualObj, newMetodo);

    let updatedCart = cart;
    if (clienteActualObj && (clienteActualObj.descuento_fijo || 0) > 0) {
      if (newEval.aplica) {
        // Se activa el descuento para este método
        updatedCart = cart.map(item => {
          const itemTotal = item.price * item.qty;
          const autoDesc = Number(((itemTotal * newEval.porcentaje) / 100).toFixed(2));
          return {
            ...item,
            discount: autoDesc,
            discountPercent: newEval.porcentaje,
            discountMode: '%'
          };
        });
        if (!prevEval.aplica) {
          toast(`✨ Descuento VIP de ${newEval.porcentaje}% aplicado para pago con ${newMetodo}`, { icon: '✨' });
        }
      } else {
        // Se desactiva el descuento porque este método no califica
        updatedCart = cart.map(item => ({
          ...item,
          discount: 0,
          discountPercent: 0,
          discountMode: 'C$'
        }));
        if (prevEval.aplica) {
          toast(`ℹ️ El descuento preferencial no aplica para pago con ${newMetodo} (Solo en: ${newEval.metodosPermitidos.join(', ')})`, { icon: '⚠️' });
        }
        if (newEval.regalia) {
          toast(`🎁 Regalía aplicable con ${newMetodo}: ${newEval.regalia}`, { duration: 5000, icon: '🎁' });
        }
      }
    } else if (!isMostrador) {
      // Cliente registrado sin privilegios de descuento: siempre 0
      updatedCart = cart.map(item => ({
        ...item,
        discount: 0,
        discountPercent: 0,
        discountMode: 'C$'
      }));
    }

    updateActiveTab({ metodoPago: newMetodo, cart: updatedCart });
  };

  const handleSelectCliente = (val) => {
    const isNewMostrador = !val || val.value === 'MOSTRADOR';
    const cid = isNewMostrador ? 'MOSTRADOR' : val.value;
    const clientData = clientes.find(c => c.id === cid);
    const clientName = isNewMostrador ? 'CLIENTE DE MOSTRADOR' : (clientData?.nombre || val.label);

    const clientSelection = { value: cid, label: clientName };

    let newName = activeTab.name;
    const isGenericName = !activeTab.name || activeTab.name.startsWith('Factura') || activeTab.name.startsWith('Borrador');
    if (!isNewMostrador) {
      if (isGenericName) {
        newName = clientName;
      }
    } else if (isGenericName) {
      const idx = tabs.findIndex(t => t.id === activeTabId) + 1;
      newName = `Factura ${idx > 0 ? idx : 1}`;
    }

    // Comprobar privilegios y condiciones de método de pago
    let updatedCart = cart;

    if (!isNewMostrador) {
      const { aplica, porcentaje, metodosPermitidos, regalia } = evalClienteDescuento(clientData, metodoPago);
      if (clientData && (clientData.descuento_fijo || 0) > 0) {
        if (aplica) {
          updatedCart = cart.map(item => {
            const itemTotal = item.price * item.qty;
            const autoDesc = Number(((itemTotal * porcentaje) / 100).toFixed(2));
            return {
              ...item,
              discount: autoDesc,
              discountPercent: porcentaje,
              discountMode: '%'
            };
          });
          toast(`✨ Descuento VIP de ${porcentaje}% aplicado (${metodoPago})`, { icon: '✨' });
        } else {
          // Método no califica
          updatedCart = cart.map(item => ({
            ...item,
            discount: 0,
            discountPercent: 0,
            discountMode: 'C$'
          }));
          toast(`ℹ️ ${clientName} tiene ${clientData.descuento_fijo}% VIP pero no aplica con ${metodoPago} (Válido en: ${metodosPermitidos.join(', ')})`, { icon: '⚠️' });
          if (regalia) {
            toast(`🎁 Regalía registrada para este cliente: ${regalia}`, { duration: 5000, icon: '🎁' });
          }
        }
      } else {
        // Cliente registrado sin privilegios: bloqueo a 0
        updatedCart = cart.map(item => ({
          ...item,
          discount: 0,
          discountPercent: 0,
          discountMode: 'C$'
        }));
        toast(`👤 ${clientName}: Cliente sin privilegios de descuento otorgados por gerencia.`, { icon: 'ℹ️' });
      }
    }

    updateActiveTab({ selectedCliente: clientSelection, name: newName, cart: updatedCart });
  };

  const addToCart = (product) => {
    const stockActual = inventory[product.id]?.stock_actual || 0;
    const existing = cart.find(item => item.id === product.id);
    const requestedQty = existing ? existing.qty + 1 : 1;

    if (product.type !== 'servicio' && requestedQty > stockActual) {
      toast.error(`Stock insuficiente. Solo quedan ${stockActual} unidades disponibles.`);
      return;
    }

    const { aplica, porcentaje } = evalClienteDescuento(clienteActualObj, metodoPago);

    if (existing) {
      const newQty = existing.qty + 1;
      const itemTotal = existing.price * newQty;
      let finalDiscount = existing.discount;
      let finalPercent = existing.discountPercent || 0;

      if (!isMostrador) {
        if (hasPrivilegios && aplica) {
          finalPercent = porcentaje;
          finalDiscount = Number(((itemTotal * finalPercent) / 100).toFixed(2));
        } else {
          finalPercent = 0;
          finalDiscount = 0;
        }
      } else {
        if (existing.discountMode === '%') {
          finalPercent = existing.discountPercent || 0;
          finalDiscount = Number(((itemTotal * finalPercent) / 100).toFixed(2));
        } else {
          finalDiscount = Math.min(itemTotal, existing.discount || 0);
          finalPercent = itemTotal > 0 ? Number(((finalDiscount / itemTotal) * 100).toFixed(1)) : 0;
        }
      }

      setCart(cart.map(item => item.id === product.id ? { 
        ...item, 
        qty: newQty, 
        discount: finalDiscount,
        discountPercent: finalPercent,
        discountMode: isMostrador ? (item.discountMode || 'C$') : '%'
      } : item));
    } else {
      const itemTotal = product.price * 1;
      let initialPercent = 0;
      let initialDiscount = 0;

      if (!isMostrador && hasPrivilegios && aplica) {
        initialPercent = porcentaje;
        initialDiscount = Number(((itemTotal * porcentaje) / 100).toFixed(2));
      }

      setCart([...cart, { 
        ...product, 
        qty: 1, 
        discount: initialDiscount,
        discountPercent: initialPercent,
        discountMode: (!isMostrador && hasPrivilegios && aplica) ? '%' : 'C$'
      }]);
    }
  };

  const handleBarcodeInput = (code) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim().toLowerCase();
    
    // 1. Buscar coincidencia exacta por ID o código de barras
    let match = allItems.find(p => 
      p.id?.toLowerCase() === cleanCode || 
      (p.barcode && p.barcode.toString().toLowerCase() === cleanCode) ||
      (p.codigo_barra && p.codigo_barra.toString().toLowerCase() === cleanCode)
    );

    // 2. Si no es exacto, buscar si hay una coincidencia parcial única
    if (!match) {
      const candidates = allItems.filter(p => {
        const textToSearch = `${p.name} ${p.id} ${p.cat || ''}`.toLowerCase();
        return textToSearch.includes(cleanCode);
      });
      if (candidates.length === 1) {
        match = candidates[0];
      }
    }

    if (match) {
      if (match.type !== 'servicio') {
        const stockActual = inventory[match.id]?.stock_actual || 0;
        const inCart = cart.find(i => i.id === match.id);
        const nextQty = inCart ? inCart.qty + 1 : 1;
        if (nextQty > stockActual) {
          toast.error(`⚠️ Stock insuficiente para ${match.name}. Disponible: ${stockActual}`);
          return;
        }
      }
      addToCart(match);
      setSearchCode('');
      toast.success(`⚡ Escaneado: ${match.name}`, { icon: '📦' });
    } else {
      toast.error(`No se encontró ningún producto con código: "${code.trim()}"`);
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

    const itemTotal = item.price * newQty;
    let finalDiscount = item.discount || 0;
    let finalPercent = item.discountPercent || 0;

    if (!isMostrador) {
      if (hasPrivilegios && descuentoEval.aplica) {
        finalPercent = clienteActualObj.descuento_fijo || 0;
        finalDiscount = Number(((itemTotal * finalPercent) / 100).toFixed(2));
      } else {
        finalPercent = 0;
        finalDiscount = 0;
      }
    } else {
      if (item.discountMode === '%') {
        finalPercent = item.discountPercent || 0;
        finalDiscount = Number(((itemTotal * finalPercent) / 100).toFixed(2));
      } else {
        finalDiscount = Math.min(itemTotal, item.discount || 0);
        finalPercent = itemTotal > 0 ? Number(((finalDiscount / itemTotal) * 100).toFixed(1)) : 0;
      }
    }

    setCart(cart.map(c => c.id === productId ? { 
      ...c, 
      qty: newQty, 
      discount: finalDiscount,
      discountPercent: finalPercent
    } : c));
  };

  // Manejador inteligente de Descuentos para Mostrador (Conversión bidireccional C$ <-> %)
  const handleDiscountChange = (productId, rawVal, currentMode) => {
    if (!isMostrador) return; // Solo permitido para clientes de mostrador
    const val = Math.max(0, parseFloat(rawVal) || 0);
    setCart(cart.map(c => {
      if (c.id === productId) {
        const itemTotal = c.price * c.qty;
        let finalDiscount = 0;
        let finalPercent = 0;

        if (currentMode === '%') {
          finalPercent = Math.min(100, val);
          finalDiscount = Number(((itemTotal * finalPercent) / 100).toFixed(2));
        } else {
          finalDiscount = Math.min(itemTotal, val);
          finalPercent = itemTotal > 0 ? Number(((finalDiscount / itemTotal) * 100).toFixed(1)) : 0;
        }

        return {
          ...c,
          discount: finalDiscount,
          discountPercent: finalPercent,
          discountMode: currentMode
        };
      }
      return c;
    }));
  };

  // Alternar entre modo Porcentaje (%) y Córdobas (C$)
  const toggleDiscountMode = (productId) => {
    if (!isMostrador) return;
    setCart(cart.map(c => {
      if (c.id === productId) {
        const currentMode = c.discountMode || 'C$';
        const newMode = currentMode === '%' ? 'C$' : '%';
        const itemTotal = c.price * c.qty;
        
        let finalPercent = c.discountPercent || 0;
        let finalDiscount = c.discount || 0;

        if (itemTotal > 0) {
          if (newMode === '%') {
            finalPercent = Number(((finalDiscount / itemTotal) * 100).toFixed(1));
          } else {
            finalDiscount = Number(((itemTotal * finalPercent) / 100).toFixed(2));
          }
        }

        return {
          ...c,
          discountMode: newMode,
          discount: finalDiscount,
          discountPercent: finalPercent
        };
      }
      return c;
    }));
  };

  const subtotalBruto = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalDescuentos = cart.reduce((sum, item) => sum + getItemDiscount(item), 0);
  const total = Math.max(0, subtotalBruto - totalDescuentos);
  
  // Variables para la impresión
  const [completedSale, setCompletedSale] = useState(null);
  const printRef = React.useRef();
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ticket_${completedSale?.numero_factura || 'POS'}`,
    pageStyle: `@page { size: 80mm auto; margin: 0; } @media print { body { -webkit-print-color-adjust: exact; } }`
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
        limite_credito: 0,
        credito_habilitado: false,
        descuento_fijo: 0,
        tipo_cliente: 'Regular',
        fecha_registro: new Date().toISOString()
      };
      await set(cliRef, newCli);
      toast.success('Cliente registrado (Sin crédito hasta aprobación de gerencia)');
      const option = { value: cliRef.key, label: newCli.nombre };
      handleSelectCliente(option);
      setIsNewClientModalOpen(false);
      setNewClientForm({ nombre: '', telefono1: '', cedula: '', direccion: '' });
    } catch (err) {
      toast.error('Error al guardar cliente: ' + err.message);
    }
  };

  const processSale = async () => {
    // Validar que la caja esté abierta para poder facturar
    if (!activeTurno) {
      toast.error('⚠️ La caja está cerrada en esta sucursal. Debe abrir turno de caja para registrar el fondo inicial antes de facturar.', { duration: 4500 });
      setIsCashOpenModalOpen(true);
      return;
    }

    if (cart.length === 0) return toast.error('El carrito está vacío');
    if (!selectedCliente) return toast.error('Seleccione un cliente');
    if (cart.some(item => item.type === 'servicio') && !selectedMecanico) {
      return toast.error('Debe asignar un mecánico para la mano de obra');
    }
    
    // Si es crédito empleado
    if (metodoPago === 'Crédito Empleado' && !selectedEmpleadoDeudor) {
      return toast.error('Debe seleccionar al empleado al que se le otorga el crédito');
    }
    
    // Si es crédito a cliente, VALIDAR PRIVILEGIOS DE GERENCIA
    const targetClienteId = selectedCliente.value || 'MOSTRADOR';
    const clienteDataObj = clientes.find(c => c.id === targetClienteId);

    if (metodoPago === 'Crédito' && targetClienteId !== 'MOSTRADOR') {
      if (!clienteDataObj) return toast.error('Cliente no encontrado');
      
      if (!clienteDataObj.credito_habilitado) {
        return toast.error('Este cliente NO tiene crédito autorizado por gerencia.');
      }

      const limite = Number(clienteDataObj.limite_credito) || 0;
      if (limite <= 0) {
        return toast.error('El cliente tiene un límite de crédito de C$ 0.00. Solicite autorización de gerencia.');
      }

      if (total > limite) {
        return toast.error(`El monto supera el límite de crédito autorizado por gerencia (Límite: C$ ${limite.toFixed(2)})`);
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
      
      // Nombre exacto y limpio del cliente
      const nombreFinalCliente = (targetClienteId !== 'MOSTRADOR' && clienteDataObj)
        ? clienteDataObj.nombre
        : (selectedCliente.label && targetClienteId !== 'MOSTRADOR' ? selectedCliente.label : 'CLIENTE DE MOSTRADOR');

      const newSale = {
        id: saleId,
        numero_factura: humanId,
        id_turno: activeTurno?.id || null,
        numero_turno: activeTurno?.numero_turno || null,
        fecha: new Date().toISOString(),
        sucursal,
        id_cliente: targetClienteId,
        nombre_cliente: nombreFinalCliente,
        metodo_pago: metodoPago,
        id_mecanico: selectedMecanico ? selectedMecanico.value : null,
        nombre_mecanico: selectedMecanico ? selectedMecanico.label : null,
        empleado_deudor: selectedEmpleadoDeudor ? selectedEmpleadoDeudor.value : null,
        subtotal_bruto: subtotalBruto,
        descuento_total: totalDescuentos,
        total,
        regalia: (!descuentoEval.aplica && descuentoEval.regalia) ? descuentoEval.regalia : null,
        estado: 'Completado',
        items: cart.map(item => {
          const finalDesc = getItemDiscount(item);
          const finalPercent = getItemDiscountPercent(item);
          return {
            id_producto: item.id,
            type: item.type || 'producto',
            name: item.name,
            cantidad: item.qty,
            precio_unitario: item.price,
            descuento: finalDesc,
            descuento_porcentaje: finalPercent,
            subtotal: (item.price * item.qty) - finalDesc
          };
        })
      };

      await set(saleRef, newSale);

      // Si es crédito a cliente, generar cuenta por cobrar
      if (metodoPago === 'Crédito' && targetClienteId !== 'MOSTRADOR') {
        const cxcRecord = push(ref(rtdb, 'cxc'));
        const fechaVence = new Date();
        fechaVence.setDate(fechaVence.getDate() + 30);
        
        await set(cxcRecord, {
          id_cliente: targetClienteId,
          nombre_cliente: nombreFinalCliente,
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
        const totalServicios = serviciosEnCarrito.reduce((sum, item) => sum + ((item.price * item.qty) - (item.discount || 0)), 0);
        
        await set(otRef, {
          id_factura: saleId,
          numero_factura: humanId,
          fecha_creacion: newSale.fecha,
          id_cliente: targetClienteId,
          nombre_cliente: nombreFinalCliente,
          id_mecanico: selectedMecanico.value,
          nombre_mecanico: selectedMecanico.label,
          estado: 'Pendiente',
          servicios: serviciosEnCarrito.map(s => ({
            id_servicio: s.id,
            nombre: s.name,
            cantidad: s.qty,
            subtotal: (s.price * s.qty) - (s.discount || 0)
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
          const kardexRef = push(ref(rtdb, 'kardex'));
          const currentStock = inventory[item.id]?.stock_actual || 0;
          await set(kardexRef, {
            fecha: new Date().toISOString(),
            id_sucursal: sucursal,
            id_producto: item.id,
            nombre_producto: item.name,
            tipo_movimiento: 'Salida por Venta',
            cantidad: item.qty,
            id_referencia: humanId,
            stock_anterior: currentStock,
            stock_nuevo: currentStock - item.qty,
            usuario: 'Caja POS'
          });
        }
      }

      toast.success(`Factura ${humanId} procesada exitosamente`);
      setCompletedSale(newSale);
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

          {/* CONTROL DE TURNO DE CAJA (APERTURA, SALIDAS A GERENCIA, CIERRE Y CONTADOR) */}
          {activeTurno ? (
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-3.5 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 border border-emerald-500 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="flex h-3.5 w-3.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-white"></span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm tracking-wide">CAJA ABIERTA: {activeTurno.numero_turno}</span>
                    <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-bold">
                      Fondo: C$ {Number(activeTurno.total_inicial_cordobas || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-100">
                    Cajero: <strong className="text-white">{activeTurno.cajero_nombre}</strong> | Apertura: {new Date(activeTurno.fecha_apertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              {/* ACCIONES DEL TURNO DE CAJA */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsMoneyCounterOpen(true)}
                  className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-sm transition-all"
                  title="Contador de billetes y monedas en Córdobas y Dólares"
                >
                  <Calculator size={15} />
                  Contador de Dinero
                </button>
                <button
                  type="button"
                  onClick={() => setIsCashMovementModalOpen(true)}
                  className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                  title="Registrar entregas de efectivo a gerencia o gastos de caja chica"
                >
                  <ArrowUpRight size={15} />
                  Salida / Entrega a Gerencia
                </button>
                <button
                  type="button"
                  onClick={() => setIsCashCloseModalOpen(true)}
                  className="px-3.5 py-1.5 bg-gray-900 hover:bg-black text-amber-300 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95 border border-amber-300/30"
                  title="Cierre y Cuadre de Caja del Turno"
                >
                  <Lock size={15} className="text-amber-400" />
                  Cerrar Caja
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-3.5 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 border border-amber-400 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={22} className="text-amber-100 shrink-0" />
                <div>
                  <span className="font-black text-sm tracking-wide block">CAJA CERRADA EN ESTA SUCURSAL</span>
                  <p className="text-[11px] text-amber-100">
                    Debe registrar el fondo inicial para abrir el turno antes de comenzar a facturar.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMoneyCounterOpen(true)}
                  className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 backdrop-blur-sm transition-all"
                  title="Contador de billetes y monedas"
                >
                  <Calculator size={15} />
                  Contador de Dinero
                </button>
                <button
                  type="button"
                  onClick={() => setIsCashOpenModalOpen(true)}
                  className="px-4 py-2 bg-white text-amber-900 hover:bg-amber-50 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <LockOpen size={16} className="text-amber-700" />
                  Abrir Caja (Iniciar Turno)
                </button>
              </div>
            </div>
          )}

          {/* DATOS DE LA VENTA (CLIENTE, PAGO, BUSCADOR) */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 space-y-4">
            
            {/* Cliente y Método de Pago */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1 flex-wrap gap-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase">Cliente</label>
                  {clienteActualObj && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(clienteActualObj.descuento_fijo || 0) > 0 ? (
                        <>
                          {descuentoEval.aplica ? (
                            <span className="text-[11px] font-black text-amber-700 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <Sparkles size={12} /> {clienteActualObj.descuento_fijo}% VIP Automático ({metodoPago})
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full" title={`Válido solo en: ${descuentoEval.metodosPermitidos.join(', ')}`}>
                              ⚠️ Sin descuento con {metodoPago}
                            </span>
                          )}
                          {!descuentoEval.aplica && descuentoEval.regalia && (
                            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1" title="Beneficio especial para este método de pago">
                              <Gift size={12} /> Regalía: {descuentoEval.regalia}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1" title="Cliente registrado sin privilegios de descuento otorgados por gerencia">
                          <Lock size={10} /> Sin descuento asignado
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Select
                      options={[
                        { value: 'MOSTRADOR', label: 'CLIENTE DE MOSTRADOR' },
                        ...clientes.map(c => ({ 
                          value: c.id, 
                          label: c.nombre
                        }))
                      ]}
                      formatOptionLabel={(option) => (
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{option.label}</span>
                          {option.value !== 'MOSTRADOR' && (
                            <div className="flex gap-1 items-center">
                              {clientes.find(c => c.id === option.value)?.credito_habilitado && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                                  Crédito
                                </span>
                              )}
                              {(clientes.find(c => c.id === option.value)?.descuento_fijo || 0) > 0 && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                                  {clientes.find(c => c.id === option.value).descuento_fijo}% VIP
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      filterOption={(candidate, input) => {
                        if (!input) return true;
                        const tokens = input.toLowerCase().split(/\s+/).filter(Boolean);
                        const target = candidate.label.toLowerCase();
                        return tokens.every(token => target.includes(token));
                      }}
                      value={
                        selectedCliente?.value === 'MOSTRADOR'
                          ? { value: 'MOSTRADOR', label: 'CLIENTE DE MOSTRADOR' }
                          : (clienteActualObj 
                              ? { value: clienteActualObj.id, label: clienteActualObj.nombre } 
                              : selectedCliente)
                      }
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
                    title="Crear Nuevo Cliente Rápido"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Método de Pago</label>
                <select 
                  value={metodoPago} 
                  onChange={e => handleMetodoPagoChange(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm h-[38px] font-medium"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta / POS</option>
                  <option value="Transferencia">Transferencia</option>
                  {selectedCliente?.value !== 'MOSTRADOR' && (
                    <option value="Crédito">
                      Crédito (CxC) {clienteActualObj?.credito_habilitado ? '✅ Autorizado' : '⚠️ Sin autorizar'}
                    </option>
                  )}
                  <option value="Crédito Empleado">Crédito a Empleado</option>
                </select>
              </div>

              {metodoPago === 'Crédito' && selectedCliente?.value !== 'MOSTRADOR' && (
                <div className="col-span-1 md:col-span-2">
                  <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${clienteActualObj?.credito_habilitado && (clienteActualObj?.limite_credito || 0) > 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={16} />
                      {clienteActualObj?.credito_habilitado ? (
                        <span>Línea de crédito autorizada por gerencia: <strong>C$ {Number(clienteActualObj.limite_credito).toFixed(2)}</strong></span>
                      ) : (
                        <span>Este cliente <strong>NO tiene crédito autorizado</strong> por gerencia. Requiere aprobación antes de facturar.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

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

            {/* BUSCADOR INTELIGENTE CON LECTOR DE BARRAS Y CÁMARA */}
            <div className="relative pt-1">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Buscar y Agregar Productos o Servicios</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (searchCode.trim()) {
                          handleBarcodeInput(searchCode);
                        }
                      }
                    }}
                    placeholder="Escribe o escanea código con lector USB/Bluetooth..." 
                    className="w-full border border-gray-200 p-3 pl-10 pr-10 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"
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
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-100 transition-all active:scale-95 whitespace-nowrap"
                  title="Abrir cámara del celular para escanear código de barras"
                >
                  <ScanBarcode size={18} />
                  <span className="hidden sm:inline">Cámara</span>
                </button>
              </div>

              {/* LISTA DESPLEGABLE DE RESULTADOS FILTRADOS */}
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
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Miniatura con visualizador */}
                          {p.image ? (
                            <div 
                              className="relative group shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewProduct(p);
                              }}
                              title="Click para ver foto en grande"
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
                              <p className="font-bold text-gray-800 text-sm truncate">
                                {isService ? '🔧 ' : ''}{p.name}
                              </p>
                            </div>
                            {p.compatibilidad && p.compatibilidad.length > 0 && (
                              <p className="text-[11px] text-blue-600 font-medium truncate">
                                Compat: {p.compatibilidad.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-2">
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

          {/* LISTA DE PRODUCTOS QUE SE ESTÁN FACTURANDO */}
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
                      <th className="p-3 text-center w-28">Cant.</th>
                      <th className="p-3 text-right">P. Unit</th>
                      <th className="p-3 text-center w-36">Descuento</th>
                      <th className="p-3 text-right font-black text-blue-900">Subtotal</th>
                      <th className="p-3 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cart.map((item) => {
                      const effectiveDiscount = getItemDiscount(item);
                      const effectivePercent = getItemDiscountPercent(item);
                      const itemSubtotal = (item.price * item.qty) - effectiveDiscount;
                      const isPercentMode = item.discountMode === '%';
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
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
                                  {item.type === 'servicio' ? <span className="text-xs">🔧</span> : <Package size={16} />}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.type === 'servicio' && <span className="text-purple-600 font-bold text-xs bg-purple-50 px-1.5 py-0.5 rounded">Servicio</span>}
                                  <span className="font-bold text-gray-800">{item.name}</span>
                                </div>
                                <span className="font-mono text-[11px] text-gray-400">{item.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                type="button"
                                onClick={() => updateCartQty(item.id, item.qty - 1)}
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded flex items-center justify-center font-bold"
                              >
                                <Minus size={12} />
                              </button>
                              <input 
                                type="number" 
                                min="1" 
                                value={item.qty} 
                                onChange={(e) => updateCartQty(item.id, parseInt(e.target.value) || 1)}
                                className="w-10 text-center font-bold border rounded py-0.5 outline-none text-xs" 
                              />
                              <button 
                                type="button"
                                onClick={() => updateCartQty(item.id, item.qty + 1)}
                                className="w-6 h-6 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded flex items-center justify-center font-bold"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-right text-gray-600 font-medium">C$ {item.price.toFixed(0)}</td>
                          
                          {/* CAMPO DE DESCUENTO: 3 TIERS BLINDADOS */}
                          <td className="p-3 text-center">
                            {isMostrador ? (
                              /* TIER 3: CLIENTE DE MOSTRADOR -> Descuento manual interactivo (C$ <-> %) */
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-400">
                                  <input 
                                    type="number" 
                                    min="0" 
                                    step={isPercentMode ? "1" : "5"}
                                    value={isPercentMode ? (item.discountPercent || 0) : (item.discount || 0)}
                                    onChange={(e) => handleDiscountChange(item.id, e.target.value, isPercentMode ? '%' : 'C$')}
                                    className="w-16 text-center py-1 text-xs text-red-600 font-bold outline-none"
                                    title={isPercentMode ? "Porcentaje de descuento de mostrador" : "Descuento en Córdobas de mostrador"}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => toggleDiscountMode(item.id)}
                                    className={`px-1.5 py-1 text-[11px] font-black border-l transition-colors flex items-center gap-0.5 ${isPercentMode ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                                    title="Clic para cambiar entre Porcentaje (%) y Córdobas (C$)"
                                  >
                                    {isPercentMode ? '%' : 'C$'}
                                    <RefreshCw size={9} className="opacity-60" />
                                  </button>
                                </div>
                                <span className="text-[10px] text-gray-400 font-semibold">
                                  {isPercentMode 
                                    ? `≈ C$ ${effectiveDiscount.toFixed(2)}` 
                                    : `≈ ${effectivePercent.toFixed(1)}%`}
                                </span>
                              </div>
                            ) : hasPrivilegios ? (
                              /* TIER 1: CLIENTE CON PRIVILEGIOS VIP -> Automático y Bloqueado */
                              descuentoEval.aplica ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 text-amber-800 px-2.5 py-1 rounded-lg text-xs font-black shadow-xs">
                                    <Sparkles size={11} className="text-amber-600" />
                                    <span>VIP {clienteActualObj.descuento_fijo}%</span>
                                    <Lock size={10} className="text-amber-500 opacity-70" title="Fijado por gerencia (Bloqueado)" />
                                  </div>
                                  <span className="text-[10px] font-bold text-amber-700">
                                    - C$ {effectiveDiscount.toFixed(2)}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-500 px-2.5 py-1 rounded-lg text-xs font-bold" title={`No califica para descuento con pago en ${metodoPago}`}>
                                    <Lock size={11} className="text-gray-400" />
                                    <span>0.00</span>
                                  </div>
                                  <span className="text-[9px] font-bold text-red-500">
                                    Sin desc. ({metodoPago})
                                  </span>
                                </div>
                              )
                            ) : (
                              /* TIER 2: CLIENTE REGISTRADO SIN PRIVILEGIOS -> Bloqueado a 0.00 */
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 text-gray-400 px-2.5 py-1 rounded-lg text-xs font-bold" title="Cliente sin privilegios de descuento autorizados por gerencia">
                                  <Lock size={11} />
                                  <span>0.00</span>
                                </div>
                                <span className="text-[9px] font-medium text-gray-400">
                                  Sin privilegio
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="p-3 text-right font-black text-blue-800 text-sm">
                            C$ {itemSubtotal.toFixed(2)}
                          </td>
                          <td className="p-3 text-center">
                            <button 
                              type="button"
                              onClick={() => setCart(cart.filter(c => c.id !== item.id))}
                              className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
                              title="Eliminar de la lista"
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

        {/* Lado Derecho (Resumen y Cobro) */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-t-4 border-t-blue-600 space-y-3">
            <h2 className="font-black text-gray-400 uppercase tracking-wider text-xs">Resumen de Factura</h2>
            
            <div className="space-y-2 text-sm text-gray-600 border-b border-gray-100 pb-3">
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span className="font-bold text-gray-800 truncate max-w-[150px]">
                  {clienteActualObj?.nombre || selectedCliente?.label || 'CLIENTE DE MOSTRADOR'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Método:</span>
                <span className="font-bold text-gray-800">{metodoPago}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Artículos:</span>
                <span className="font-bold text-gray-800">{cart.reduce((sum, i) => sum + i.qty, 0)}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal Bruto:</span>
                <span className="font-semibold text-gray-700">C$ {subtotalBruto.toFixed(2)}</span>
              </div>
              {totalDescuentos > 0 && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Descuentos Totales:</span>
                  <span>- C$ {totalDescuentos.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between text-3xl font-black pt-3 border-t border-gray-100 text-blue-900">
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

      {/* Modal Creación Rápida de Cliente por Cajero */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                  <UserPlus className="text-blue-600" size={20} />
                  Nuevo Cliente Rápido
                </h2>
                <p className="text-[11px] text-gray-400">Datos básicos. Privilegios de crédito son otorgados por gerencia.</p>
              </div>
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

      {/* MODAL DE FINALIZACIÓN CON TICKET TÉRMICO POS-80 Y PDF */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 text-center border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                ✓ Factura Generada: {completedSale.numero_factura}
              </span>
              <button onClick={() => setCompletedSale(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            {/* VISTA PREVIA DEL TICKET EN PANTALLA */}
            <div className="p-4 overflow-y-auto bg-gray-100 flex-1 flex justify-center">
              <TicketPrinter sale={completedSale} isPreview={true} />
            </div>

            {/* BOTONES DE IMPRESIÓN Y ACCIONES */}
            <div className="p-4 bg-white border-t border-gray-100 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handlePrint}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Printer size={18} />
                  Imprimir POS-80
                </button>
                <button 
                  onClick={handlePrint}
                  className="bg-gray-800 hover:bg-gray-900 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-lg shadow-gray-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <FileDown size={18} />
                  Descargar PDF
                </button>
              </div>
              <button 
                onClick={() => setCompletedSale(null)}
                className="w-full text-gray-500 font-bold hover:bg-gray-100 py-2.5 rounded-xl text-sm transition-colors"
              >
                Cerrar y Nueva Factura
              </button>
            </div>
            
            {/* ELEMENTO OCULTO PARA LA IMPRESORA REAL */}
            <div className="hidden">
              <TicketPrinter ref={printRef} sale={completedSale} isPreview={false} />
            </div>
          </div>
        </div>
      )}

      {/* MODAL ESCÁNER DE CÓDIGO DE BARRAS POR CÁMARA */}
      <BarcodeScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScanSuccess={(code) => handleBarcodeInput(code)} 
      />

      {/* MODAL VISUALIZADOR DE FOTO DE PRODUCTO */}
      <ImagePreviewModal 
        isOpen={!!previewProduct} 
        onClose={() => setPreviewProduct(null)} 
        product={previewProduct} 
      />

      {/* MODAL APERTURA DE CAJA (INICIAR TURNO) */}
      <CashOpenModal
        isOpen={isCashOpenModalOpen}
        onClose={() => setIsCashOpenModalOpen(false)}
        sucursal={sucursal}
        currentUser={user}
        onOpenSuccess={(newT) => setActiveTurno(newT)}
      />

      {/* MODAL SALIDAS Y ENTREGAS DE EFECTIVO A GERENCIA */}
      <CashMovementModal
        isOpen={isCashMovementModalOpen}
        onClose={() => setIsCashMovementModalOpen(false)}
        activeTurno={activeTurno}
        currentUser={user}
        onMovementAdded={() => {}}
      />

      {/* MODAL CIERRE Y ARQUEO FINAL DE CAJA */}
      <CashCloseModal
        isOpen={isCashCloseModalOpen}
        onClose={() => setIsCashCloseModalOpen(false)}
        activeTurno={activeTurno}
        currentUser={user}
        salesList={salesList}
        onCloseSuccess={() => setActiveTurno(null)}
      />

      {/* MODAL CONTADOR INDEPENDIENTE DE BILLETES Y MONEDAS */}
      <MoneyCounterModal
        isOpen={isMoneyCounterOpen}
        onClose={() => setIsMoneyCounterOpen(false)}
      />

    </div>
  );
}
