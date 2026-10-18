import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { subscribeProductImages, resolveProductImage } from '../utils/storageService';
import { DEFAULT_SUCURSALES } from '../components/catalogos/BranchManager';
import ImagePreviewModal from '../components/ImagePreviewModal';
import {
  ShoppingCart, Search, Wrench, Package, Phone, MapPin, Lock, ArrowRight,
  Plus, Minus, Trash2, X, CheckCircle2, MessageCircle, Sparkles, Filter,
  ShieldCheck, Clock, Bike, Layers, ChevronRight, Copy, ExternalLink, Eye,
  Building2, SlidersHorizontal, Tag, Info, Mail, Calendar, HelpCircle
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import logoIcon from '../assets/logo-icon.jpg';

// Información oficial de contacto directo para servicios de taller
const TALLER_CONTACT = {
  whatsapp: '50582943669',
  whatsappDisplay: '+505 8294 3669',
  email: 'elmingomecanico@gmail.com'
};

// Normalizar nombres de categorías para eliminar duplicados o redundancias
export const normalizeCategoryName = (cat) => {
  if (!cat) return 'General';
  const trimmed = cat.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'lubricantes y aceites' || lower === 'aceites' || lower === 'aceite') return 'Lubricantes';
  if (lower === 'llantas y neumáticos' || lower === 'llantas y neumaticos') return 'Llantas';
  if (lower === 'frenos' || lower === 'sistema de frenos') return 'Frenos';
  if (lower === 'eléctrico' || lower === 'electrico' || lower === 'sistema eléctrico' || lower === 'sistema electrico') return 'Sistema Eléctrico';
  if (lower === 'neumáticos' || lower === 'neumaticos' || lower === 'cámaras' || lower === 'tubos') return 'Neumáticos';
  return trimmed;
};

export default function EcommerceStore() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Estados de datos desde Firebase RTDB
  const [rawProducts, setRawProducts] = useState([]);
  const [productImagesMap, setProductImagesMap] = useState({});
  const [servicios, setServicios] = useState([]);
  const [allInventory, setAllInventory] = useState({});
  const [sucursales, setSucursales] = useState(DEFAULT_SUCURSALES);
  const [categoriasCatalog, setCategoriasCatalog] = useState([]);
  const [modelosCatalog, setModelosCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de filtros y búsqueda exclusivamente para REPUESTOS / PRODUCTOS FÍSICOS
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('TODAS');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedMotoModel, setSelectedMotoModel] = useState('Todos');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState('relevancia'); // 'relevancia' | 'precio_asc' | 'precio_desc' | 'nombre_asc'
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Carrito de compras / cotización exclusivamente para PRODUCTOS FÍSICOS
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('mingo_ecommerce_cart');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      // Filtrar cualquier servicio que haya quedado en caché previo
      return Array.isArray(parsed) ? parsed.filter(i => i.itemType !== 'servicio') : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Datos del cliente para el pedido de repuestos
  const [customerInfo, setCustomerInfo] = useState({
    nombre: '',
    telefono: '',
    modeloMoto: '',
    modalidad: 'Retiro en Sucursal', // 'Retiro en Sucursal' | 'Envío por CargoTrans / Encomienda' | 'Delivery Local'
    sucursalPreferida: 'SUC-01',
    notas: ''
  });

  // Modal de vista detallada de producto / imagen
  const [previewProduct, setPreviewProduct] = useState(null);
  const [detailModalItem, setDetailModalItem] = useState(null);

  // Guardar carrito en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mingo_ecommerce_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Error guardando carrito:', e);
    }
  }, [cart]);

  // Suscripción a Firebase RTDB
  useEffect(() => {
    const prodsRef = ref(rtdb, 'productos');
    const servRef = ref(rtdb, 'servicios');
    const invRef = ref(rtdb, 'inventario');
    const sucRef = ref(rtdb, 'configuracion/sucursales');
    const catRef = ref(rtdb, 'catalogos/categorias');
    const modRef = ref(rtdb, 'catalogos/modelos');

    const unsubProds = onValue(prodsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setRawProducts(Object.keys(val).map(k => ({ id: k, ...val[k], itemType: 'producto' })));
      } else {
        setRawProducts([]);
      }
      setLoading(false);
    }, () => setLoading(false));

    const unsubImages = subscribeProductImages((map) => {
      setProductImagesMap(map);
    });

    const unsubServ = onValue(servRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setServicios(Object.keys(val).map(k => ({
          id: k,
          ...val[k],
          nombre: val[k].nombre || 'Servicio de Taller',
          precio: Number(val[k].precio || 0),
          itemType: 'servicio'
        })));
      } else {
        setServicios([]);
      }
    });

    const unsubInv = onValue(invRef, (snap) => {
      if (snap.exists()) {
        setAllInventory(snap.val());
      } else {
        setAllInventory({});
      }
    });

    const unsubSuc = onValue(sucRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const activeList = Object.keys(val)
          .map(k => ({ id: k, ...val[k] }))
          .filter(s => s.estado !== 'Inactiva');
        if (activeList.length > 0) {
          setSucursales(activeList);
          setCustomerInfo(prev => ({
            ...prev,
            sucursalPreferida: activeList[0].id
          }));
        }
      }
    });

    const unsubCat = onValue(catRef, (snap) => {
      if (snap.exists()) {
        setCategoriasCatalog(Object.values(snap.val()).map(c => c.nombre).filter(Boolean));
      }
    });

    const unsubMod = onValue(modRef, (snap) => {
      if (snap.exists()) {
        setModelosCatalog(Object.values(snap.val()).map(m => m.nombre).filter(Boolean));
      }
    });

    return () => {
      unsubProds();
      unsubImages();
      unsubServ();
      unsubInv();
      unsubSuc();
      unsubCat();
      unsubMod();
    };
  }, []);

  // Hidratar ÚNICAMENTE productos físicos con WebP/R2 y stock consolidado
  const hydratedProducts = useMemo(() => {
    return rawProducts.map(p => {
      const img = resolveProductImage(p, productImagesMap);

      let stockDisponible = 0;
      const stockPorSucursal = {};

      sucursales.forEach(suc => {
        const branchInv = allInventory?.[suc.id]?.[p.id];
        const s = branchInv !== undefined
          ? Number(branchInv.stock_actual || 0)
          : (suc.id === 'SUC-01' ? Number(p.stock_actual || 0) : 0);
        stockPorSucursal[suc.id] = Math.max(0, s);
      });

      if (selectedBranch === 'TODAS') {
        stockDisponible = Object.values(stockPorSucursal).reduce((acc, n) => acc + n, 0);
      } else {
        stockDisponible = stockPorSucursal[selectedBranch] || 0;
      }

      return {
        ...p,
        cat: normalizeCategoryName(p.cat),
        image: img,
        price: Number(p.price || 0),
        stockDisponible,
        stockPorSucursal,
        compatibilidad: Array.isArray(p.compatibilidad)
          ? p.compatibilidad
          : (typeof p.compatibilidad === 'string' && p.compatibilidad.trim() ? [p.compatibilidad.trim()] : [])
      };
    });
  }, [rawProducts, productImagesMap, allInventory, sucursales, selectedBranch]);

  // Lista limpia y no redundante de categorías
  const allCategories = useMemo(() => {
    const set = new Set();
    categoriasCatalog.forEach(c => {
      const norm = normalizeCategoryName(c);
      if (norm && norm.toLowerCase() !== 'servicios de taller') set.add(norm);
    });
    hydratedProducts.forEach(p => {
      if (p.cat && p.cat.toLowerCase() !== 'servicios de taller') {
        set.add(p.cat);
      }
    });
    // Garantizar que siempre estén visibles las categorías principales
    ['Llantas', 'Neumáticos', 'Lubricantes', 'Frenos', 'Sistema Eléctrico', 'Transmisión y Cadena'].forEach(c => set.add(c));
    return ['Todas', ...Array.from(set).sort()];
  }, [categoriasCatalog, hydratedProducts]);

  // Conteo en tiempo real de repuestos por categoría
  const categoryCounts = useMemo(() => {
    const counts = { 'Todas': hydratedProducts.length };
    hydratedProducts.forEach(p => {
      const c = p.cat || 'General';
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [hydratedProducts]);

  // Lista de modelos de moto para compatibilidad de repuestos
  const allMotoModels = useMemo(() => {
    const set = new Set(modelosCatalog);
    hydratedProducts.forEach(p => {
      (p.compatibilidad || []).forEach(m => {
        if (m && m.trim()) set.add(m.trim());
      });
    });
    return ['Todos', ...Array.from(set).sort()];
  }, [modelosCatalog, hydratedProducts]);

  // Catálogo de Productos Físicos filtrados (LOS SERVICIOS NUNCA SE MEZCLAN AQUÍ)
  const catalogItems = useMemo(() => {
    let list = [...hydratedProducts];

    // Filtro por categoría
    if (selectedCategory !== 'Todas') {
      list = list.filter(item => (item.cat || 'General') === selectedCategory);
    }

    // Filtro por modelo de moto
    if (selectedMotoModel !== 'Todos') {
      list = list.filter(item => {
        const comp = item.compatibilidad || [];
        return comp.some(m => m.toLowerCase() === selectedMotoModel.toLowerCase() || m.toLowerCase() === 'universal');
      });
    }

    // Filtro solo en stock
    if (onlyInStock) {
      list = list.filter(item => item.stockDisponible > 0);
    }

    // Búsqueda tokenizada inteligente
    if (search.trim()) {
      const tokens = search.toLowerCase().trim().split(/\s+/);
      list = list.filter(item => {
        const searchableText = [
          item.name || item.nombre || '',
          item.codigo_visible || '',
          item.cat || '',
          item.descripcion || '',
          ...(item.compatibilidad || [])
        ].join(' ').toLowerCase();

        return tokens.every(tk => searchableText.includes(tk));
      });
    }

    // Ordenamiento
    list.sort((a, b) => {
      if (sortBy === 'precio_asc') return Number(a.price || 0) - Number(b.price || 0);
      if (sortBy === 'precio_desc') return Number(b.price || 0) - Number(a.price || 0);
      if (sortBy === 'nombre_asc') return (a.name || '').localeCompare(b.name || '');
      // Por relevancia: productos con foto y stock primero
      const scoreA = (a.image ? 2 : 0) + (a.stockDisponible > 0 ? 1 : 0);
      const scoreB = (b.image ? 2 : 0) + (b.stockDisponible > 0 ? 1 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return (a.name || '').localeCompare(b.name || '');
    });

    return list;
  }, [hydratedProducts, selectedCategory, selectedMotoModel, onlyInStock, search, sortBy]);

  // Operaciones del Carrito (Solo para productos físicos)
  const addToCart = (item, qty = 1) => {
    if (item.itemType === 'servicio') {
      toast.error('Los servicios de taller no se agregan al carrito. Contáctanos por WhatsApp o correo para agendar tu cita.');
      return;
    }

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + qty } : i);
      }
      return [
        ...prev,
        {
          id: item.id,
          codigo_visible: item.codigo_visible || item.id,
          name: item.name || item.nombre,
          price: Number(item.price || 0),
          image: item.image || '',
          itemType: 'producto',
          cat: item.cat || 'General',
          qty
        }
      ];
    });
    toast.success(`${item.name || item.nombre} agregado al pedido`, {
      icon: '🛒',
      duration: 2000
    });
  };

  const updateCartQty = (id, delta) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.id !== id) return item;
          const nextQty = item.qty + delta;
          return nextQty > 0 ? { ...item, qty: nextQty } : null;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    toast.success('Carrito vaciado');
  };

  const cartCount = useMemo(() => cart.reduce((acc, i) => acc + i.qty, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((acc, i) => acc + i.price * i.qty, 0), [cart]);

  // Obtener sucursal activa para contacto
  const targetSucursalObj = useMemo(() => {
    if (selectedBranch !== 'TODAS') {
      const found = sucursales.find(s => s.id === selectedBranch);
      if (found) return found;
    }
    const pref = sucursales.find(s => s.id === customerInfo.sucursalPreferida);
    return pref || sucursales[0] || DEFAULT_SUCURSALES[0];
  }, [selectedBranch, customerInfo.sucursalPreferida, sucursales]);

  // Formatear teléfono para WhatsApp
  const getWhatsAppNumber = (rawPhone) => {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (!digits) return TALLER_CONTACT.whatsapp;
    if (digits.length === 8) return `505${digits}`;
    return digits;
  };

  // Generar mensaje de pedido de repuestos
  const buildOrderMessage = (itemsToOrder = cart) => {
    const branchName = targetSucursalObj?.nombre || 'Sucursal Principal';
    const lines = [
      `🏍️ *HOLA TALLER EL MINGO (${branchName.toUpperCase()})*`,
      `Deseo realizar el siguiente pedido / cotización de repuestos desde la Tienda Online:`,
      ``
    ];

    itemsToOrder.forEach((item, idx) => {
      const subtotal = (item.price * item.qty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const codeStr = item.codigo_visible ? `[${item.codigo_visible}] ` : '';
      lines.push(`${idx + 1}. *${item.qty}x* ${codeStr}${item.name} — *C$ ${subtotal}*`);
    });

    const totalCalc = itemsToOrder.reduce((acc, i) => acc + i.price * i.qty, 0);
    lines.push(``);
    lines.push(`💰 *TOTAL ESTIMADO REPUESTOS: C$ ${totalCalc.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*`);
    lines.push(`────────────────────`);

    if (customerInfo.nombre.trim()) lines.push(`👤 *Cliente:* ${customerInfo.nombre.trim()}`);
    if (customerInfo.telefono.trim()) lines.push(`📱 *Teléfono:* ${customerInfo.telefono.trim()}`);
    if (customerInfo.modeloMoto.trim()) lines.push(`🏍️ *Moto:* ${customerInfo.modeloMoto.trim()}`);
    lines.push(`📍 *Modalidad:* ${customerInfo.modalidad}`);
    lines.push(`🏢 *Sucursal de Preferencia:* ${branchName}`);
    if (customerInfo.notas.trim()) lines.push(`📝 *Nota:* ${customerInfo.notas.trim()}`);

    return lines.join('\n');
  };

  const handleSendWhatsAppOrder = (customItems = null) => {
    const items = customItems || cart;
    if (!items || items.length === 0) {
      return toast.error('Agrega al menos un repuesto al pedido');
    }
    const text = buildOrderMessage(items);
    const phone = TALLER_CONTACT.whatsapp; // Usar WhatsApp oficial central
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyOrderText = () => {
    if (cart.length === 0) return toast.error('El carrito está vacío');
    const text = buildOrderMessage(cart);
    navigator.clipboard.writeText(text);
    toast.success('¡Pedido copiado al portapapeles!');
  };

  const handleQuickWhatsAppItem = (item) => {
    const text = `Hola Taller El Mingo, deseo cotizar el siguiente repuesto:\n*${item.name}* [${item.codigo_visible || item.id}]\nPrecio: C$ ${Number(item.price || 0).toFixed(2)}\n¿Tienen disponibilidad inmediata?`;
    const url = `https://wa.me/${TALLER_CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('Todas');
    setSelectedMotoModel('Todos');
    setOnlyInStock(false);
    setSortBy('relevancia');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <Toaster position="top-right" />

      {/* BARRA SUPERIOR INFORMATIVA CON CONTACTOS OFICIALES */}
      <div className="bg-blue-950 text-blue-100 text-xs border-b border-blue-900">
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 font-semibold text-amber-400">
              <Sparkles size={14} /> Taller El Mingo • Repuestos y Mantenimiento de Motos
            </span>
            <a
              href={`https://wa.me/${TALLER_CONTACT.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-emerald-300 hover:text-emerald-200 font-bold"
            >
              <MessageCircle size={13} /> WhatsApp: {TALLER_CONTACT.whatsappDisplay}
            </a>
            <a
              href={`mailto:${TALLER_CONTACT.email}`}
              className="hidden sm:flex items-center gap-1 text-blue-200 hover:text-white"
            >
              <Mail size={13} /> {TALLER_CONTACT.email}
            </a>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-emerald-300 font-bold hidden sm:inline">
                  ● Sesión: {user.nombre_completo}
                </span>
                <button
                  onClick={() => navigate('/pos')}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-3 py-1 rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <ShoppingCart size={13} /> Facturación POS
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="bg-blue-800 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  Panel ERP <ArrowRight size={12} />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-blue-900/90 hover:bg-blue-800 text-blue-100 hover:text-white border border-blue-700/80 px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all text-xs shadow-sm"
              >
                <Lock size={12} className="text-amber-400" />
                <span>Acceso Facturación / Personal</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* HEADER PRINCIPAL STICKY */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            {/* Branding */}
            <div
              onClick={resetFilters}
              className="flex items-center gap-3 cursor-pointer group shrink-0"
            >
              <img
                src={logoIcon}
                alt="Taller El Mingo"
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-blue-900 shadow-md group-hover:scale-105 transition-transform object-cover"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-blue-950 tracking-tight leading-none">
                    TALLER EL MINGO
                  </h1>
                  <span className="hidden sm:inline-block bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Tienda Online
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
                  Repuestos, Lubricantes y Taller Especializado
                </p>
              </div>
            </div>

            {/* Buscador Desktop para Repuestos */}
            <div className="hidden md:flex flex-1 max-w-xl mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar repuesto por nombre, código o modelo de moto (ej. Aceite, Llantas, Boxer)..."
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-100 hover:bg-slate-100/80 focus:bg-white border-2 border-transparent focus:border-blue-600 rounded-xl text-sm font-medium outline-none transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Acciones: Enlace a Servicios de Taller + Carrito + Login */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Botón directo de salto a Servicios */}
              <a
                href="#servicios-taller"
                className="hidden sm:flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 px-3 py-2 rounded-xl text-xs font-black transition-all"
              >
                <Wrench size={14} className="text-blue-700" />
                <span>Servicios de Taller</span>
              </a>

              {/* Botón Carrito / Pedido de Repuestos */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3.5 sm:px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <ShoppingCart size={18} />
                <span className="hidden sm:inline">Mi Pedido</span>
                {cartCount > 0 && (
                  <span className="bg-amber-400 text-blue-950 font-black text-xs px-2 py-0.5 rounded-full min-w-[22px] text-center">
                    {cartCount}
                  </span>
                )}
              </button>

              {/* Botón Login */}
              {!user && (
                <Link
                  to="/login"
                  title="Acceso para facturación y personal"
                  className="bg-slate-900 hover:bg-slate-800 text-white p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
                >
                  <Lock size={15} className="text-amber-400" />
                  <span className="hidden xl:inline">Facturación</span>
                </Link>
              )}
            </div>
          </div>

          {/* Buscador Móvil */}
          <div className="flex md:hidden gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar repuesto o modelo..."
                className="w-full pl-9 pr-8 py-2 bg-slate-100 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-sm font-medium outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <a
              href="#servicios-taller"
              className="bg-blue-50 text-blue-900 border border-blue-200 px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1 shrink-0"
            >
              <Wrench size={14} /> Taller
            </a>
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`px-3 py-2 rounded-xl border font-bold text-xs flex items-center gap-1.5 shrink-0 ${
                showMobileFilters || selectedCategory !== 'Todas' || selectedMotoModel !== 'Todos'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* HERO BANNER COMERCIAL */}
      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        <div className="max-w-7xl mx-auto px-4 py-6 sm:py-10 relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-blue-800/70 border border-blue-700 text-amber-300 text-xs font-bold px-3 py-1 rounded-full mb-3">
                <Bike size={14} /> Catálogo de Repuestos Físicos • Envíos & Retiro en Tienda
              </div>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                Repuestos garantizados para tu motocicleta.
              </h2>
              <p className="text-blue-200 text-sm sm:text-base mt-2 max-w-xl">
                Encuentra repuestos originales y compatibles para tu moto. Agrega al carrito para armar tu cotización con envío por encomienda o retiro en sucursal.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href="#servicios-taller"
                  className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-blue-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-md transition-all"
                >
                  <Wrench size={15} /> Ver Servicios de Taller y Mano de Obra
                </a>
              </div>
            </div>

            {/* Selector de Moto para Repuestos */}
            <div className="w-full lg:w-auto bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex flex-col gap-2.5 min-w-[280px] sm:min-w-[340px]">
              <div className="flex items-center gap-2 text-amber-300 font-black text-xs uppercase tracking-wider">
                <Bike size={16} /> Filtra repuestos por modelo de moto
              </div>
              <select
                value={selectedMotoModel}
                onChange={(e) => setSelectedMotoModel(e.target.value)}
                className="w-full bg-white text-slate-900 font-bold text-sm px-3.5 py-2.5 rounded-xl outline-none cursor-pointer shadow-inner"
              >
                <option value="Todos">🏍️ Ver todas las marcas y modelos</option>
                {allMotoModels.filter(m => m !== 'Todos').map(model => (
                  <option key={model} value={model}>Repuestos compatibles con: {model}</option>
                ))}
              </select>
              <div className="flex items-center justify-between text-[11px] text-blue-200 pt-1">
                <span className="flex items-center gap-1"><ShieldCheck size={13} className="text-emerald-400" /> Stock verificado</span>
                <span className="flex items-center gap-1"><Package size={13} className="text-amber-400" /> Envíos nacionales</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BARRA DE CATEGORÍAS DE REPUESTOS */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-blue-950 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={15} className="text-blue-700" />
                Catálogo de Repuestos ({catalogItems.length} artículos)
              </span>
            </div>

            {/* Controles secundarios */}
            <div className={`w-full md:w-auto flex flex-wrap items-center gap-2 ${showMobileFilters ? 'flex' : 'hidden md:flex'}`}>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="TODAS">📍 Todas las Sucursales</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>📍 {s.nombre}</option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/70 px-3 py-1.5 rounded-xl cursor-pointer text-xs font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Solo con stock disponible
              </label>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="relevancia">Ordenar: Destacados</option>
                <option value="precio_asc">Precio: Menor a Mayor</option>
                <option value="precio_desc">Precio: Mayor a Menor</option>
                <option value="nombre_asc">Nombre: A - Z</option>
              </select>
            </div>
          </div>

          {/* Categorías de Repuestos Limpias y sin Redundancias */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {allCategories.map(cat => {
              const active = selectedCategory === cat;
              const count = categoryCounts[cat] || 0;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    active
                      ? 'bg-blue-950 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    active
                      ? 'bg-amber-400 text-blue-950'
                      : (count > 0 ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-400')
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: CATÁLOGO DE REPUESTOS FÍSICOS */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* Indicadores de filtros activos */}
        {(search || selectedCategory !== 'Todas' || selectedMotoModel !== 'Todos' || onlyInStock) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 bg-blue-50 border border-blue-200 px-4 py-2.5 rounded-xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-blue-900">
              <span>Mostrando {catalogItems.length} repuestos</span>
              {selectedCategory !== 'Todas' && (
                <span className="bg-white border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  Categoría: {selectedCategory}
                  <X size={12} className="cursor-pointer" onClick={() => setSelectedCategory('Todas')} />
                </span>
              )}
              {selectedMotoModel !== 'Todos' && (
                <span className="bg-amber-100 border border-amber-300 text-amber-900 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  Moto: {selectedMotoModel}
                  <X size={12} className="cursor-pointer" onClick={() => setSelectedMotoModel('Todos')} />
                </span>
              )}
              {search && (
                <span className="bg-white border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  Búsqueda: "{search}"
                  <X size={12} className="cursor-pointer" onClick={() => setSearch('')} />
                </span>
              )}
            </div>
            <button
              onClick={resetFilters}
              className="text-xs font-black text-blue-700 hover:text-blue-900 underline cursor-pointer"
            >
              Limpiar filtros de repuestos
            </button>
          </div>
        )}

        {/* Estado de Carga */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 py-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <div key={n} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse h-80 flex flex-col justify-between">
                <div className="bg-slate-200 h-40 rounded-xl" />
                <div className="space-y-2">
                  <div className="bg-slate-200 h-4 w-3/4 rounded" />
                  <div className="bg-slate-200 h-4 w-1/2 rounded" />
                  <div className="bg-slate-200 h-9 w-full rounded-xl mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : catalogItems.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center max-w-lg mx-auto my-8 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <Search size={30} />
            </div>
            <h3 className="text-lg font-black text-slate-800">No encontramos repuestos compatibles</h3>
            <p className="text-sm text-slate-500 mt-1">
              Consúltanos por WhatsApp al {TALLER_CONTACT.whatsappDisplay} con el nombre o muestra del repuesto y te confirmamos disponibilidad en bodega.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={resetFilters}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
              >
                Ver todos los repuestos
              </button>
              <a
                href={`https://wa.me/${TALLER_CONTACT.whatsapp}?text=${encodeURIComponent(
                  `Hola Taller El Mingo, estoy buscando en la web: "${search || selectedMotoModel || 'un repuesto'}" y deseo consultar disponibilidad.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <MessageCircle size={16} /> Consultar por WhatsApp
              </a>
            </div>
          </div>
        ) : (
          /* GRILLA DE REPUESTOS FÍSICOS */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {catalogItems.map(item => {
              const inCartItem = cart.find(c => c.id === item.id);
              const hasStock = item.stockDisponible > 0;
              const isLowStock = item.stockDisponible > 0 && item.stockDisponible <= Number(item.stock_minimo || 2);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col overflow-hidden group"
                >
                  {/* Foto de Producto */}
                  <div className="relative h-48 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                    {item.image ? (
                      <>
                        <img
                          src={item.image}
                          alt={item.name}
                          onClick={() => setPreviewProduct(item)}
                          className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300 cursor-zoom-in"
                          loading="lazy"
                        />
                        <button
                          onClick={() => setPreviewProduct(item)}
                          title="Ampliar imagen"
                          className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Eye size={15} />
                        </button>
                      </>
                    ) : (
                      <div
                        onClick={() => setDetailModalItem(item)}
                        className="flex flex-col items-center justify-center text-slate-400 p-4 text-center cursor-pointer"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-slate-200/70 text-slate-400 flex items-center justify-center mb-2">
                          <Package size={32} />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">Taller El Mingo</span>
                      </div>
                    )}

                    {/* Badges Superiores */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1 pointer-events-none">
                      <span className="bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                        {item.codigo_visible || item.id}
                      </span>

                      {hasStock ? (
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs ${
                          isLowStock
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-emerald-500 text-white'
                        }`}>
                          {isLowStock ? `¡Últimas ${item.stockDisponible} uds!` : `En Stock (${item.stockDisponible})`}
                        </span>
                      ) : (
                        <span className="bg-slate-700 text-slate-100 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          Consultar Bodega
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Detalle del Repuesto */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">
                          {item.cat || 'Repuestos'}
                        </span>
                      </div>

                      <h3
                        onClick={() => setDetailModalItem(item)}
                        className="font-black text-slate-800 text-sm sm:text-base leading-snug hover:text-blue-700 cursor-pointer break-words"
                      >
                        {item.name || item.nombre}
                      </h3>

                      {item.descripcion && (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {item.descripcion}
                        </p>
                      )}

                      {/* Compatibilidad de motos */}
                      {item.compatibilidad && item.compatibilidad.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {item.compatibilidad.map(mod => (
                            <span
                              key={mod}
                              onClick={() => setSelectedMotoModel(mod)}
                              className="bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                            >
                              🏍️ {mod}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Precio y Botón de Carrito */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">
                            Precio de Venta
                          </span>
                          <span className="text-lg sm:text-xl font-black text-blue-950">
                            C$ {Number(item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <button
                          onClick={() => handleQuickWhatsAppItem(item)}
                          title="Consultar por WhatsApp"
                          className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <MessageCircle size={18} />
                        </button>
                      </div>

                      {inCartItem ? (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-1">
                          <button
                            onClick={() => updateCartQty(item.id, -1)}
                            className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-blue-900 font-black flex items-center justify-center shadow-2xs cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-black text-xs text-blue-950">
                            {inCartItem.qty} en pedido
                          </span>
                          <button
                            onClick={() => updateCartQty(item.id, 1)}
                            className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black flex items-center justify-center shadow-2xs cursor-pointer"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item, 1)}
                          className="w-full bg-blue-900 hover:bg-blue-800 active:scale-98 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <ShoppingCart size={15} />
                          Agregar al Pedido
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* SECCIÓN DEDICADA DE SERVICIOS DE TALLER (SIEMPRE VISIBLE, NUNCA EN CARRITO) */}
      {/* ========================================================================= */}
      <section id="servicios-taller" className="bg-gradient-to-b from-slate-100 via-white to-slate-100 border-t-2 border-slate-200 py-12 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-900 text-white text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider mb-2.5 shadow-xs">
                <Wrench size={14} className="text-amber-400" /> Servicios de Taller Mecánico Especializado
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Mantenimiento y Reparación en Taller
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                Mano de obra calificada realizada exclusivamente en nuestras instalaciones físicas. Estos servicios no se adquieren por paquetería: se agendan directamente con nuestro equipo técnico y se facturan en caja asignando formalmente a tu mecánico.
              </p>
            </div>

            {/* Canales de Contacto Directo */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <a
                href={`https://wa.me/${TALLER_CONTACT.whatsapp}?text=${encodeURIComponent("Hola Taller El Mingo, deseo consultar sobre los servicios mecánicos para mi moto.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all"
              >
                <MessageCircle size={16} /> WhatsApp: {TALLER_CONTACT.whatsappDisplay}
              </a>
              <a
                href={`mailto:${TALLER_CONTACT.email}?subject=Consulta de Servicios de Taller - El Mingo`}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all"
              >
                <Mail size={16} /> {TALLER_CONTACT.email}
              </a>
            </div>
          </div>

          {/* Grilla de Servicios de Taller */}
          {servicios.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
              Cargando catálogo de servicios disponibles...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {servicios.map((srv) => (
                <div
                  key={srv.id}
                  className="bg-white rounded-2xl border-2 border-slate-200/90 hover:border-blue-500 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                        <Wrench size={20} />
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                        {srv.codigo_visible || srv.id}
                      </span>
                    </div>

                    <h3 className="font-black text-slate-900 text-base leading-snug">
                      {srv.nombre}
                    </h3>

                    {srv.descripcion && (
                      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                        {srv.descripcion}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <div className="mb-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Mano de Obra (Referencial)
                      </span>
                      <span className="text-xl font-black text-blue-950">
                        C$ {Number(srv.precio || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <a
                        href={`https://wa.me/${TALLER_CONTACT.whatsapp}?text=${encodeURIComponent(
                          `Hola Taller El Mingo, deseo cotizar y agendar el servicio de: *${srv.nombre}* (Ref. C$ ${Number(srv.precio || 0).toFixed(2)}). ¿Tienen disponibilidad de mecánico?`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <MessageCircle size={15} /> Agendar por WhatsApp
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Banner explicativo de cómo contratar y facturar servicios */}
          <div className="mt-8 bg-blue-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-lg">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            <div className="relative z-10 max-w-2xl">
              <span className="text-amber-400 font-black text-xs uppercase tracking-wider block mb-1">
                Atención Mecánica Profesional en Taller
              </span>
              <h4 className="text-lg sm:text-xl font-black">
                ¿Cómo funciona la contratación y facturación de servicios?
              </h4>
              <p className="text-blue-200 text-xs sm:text-sm mt-1.5 leading-relaxed">
                Para garantizar la calidad técnica, todo servicio se agrega a tu factura o expediente de orden de trabajo en caja al ingresar tu moto, donde el sistema le asigna oficialmente un mecánico responsable. Contáctanos por WhatsApp al <strong>{TALLER_CONTACT.whatsappDisplay}</strong> o al correo <strong>{TALLER_CONTACT.email}</strong> para programar tu visita.
              </p>
            </div>

            <div className="relative z-10 shrink-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <a
                href={`https://wa.me/${TALLER_CONTACT.whatsapp}?text=${encodeURIComponent("Hola Taller El Mingo, deseo programar un mantenimiento para mi moto en el taller.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-5 py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <MessageCircle size={17} /> Chatear al +505 8294 3669
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN DE SUCURSALES Y DIRECCIONES */}
      <section className="bg-white border-t border-slate-200 py-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h3 className="text-xl font-black text-slate-900">Nuestras Sucursales y Atención</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Visítanos para mantenimiento o retira tus pedidos de repuestos de inmediato.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sucursales.map(suc => (
              <div key={suc.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-base text-blue-950">{suc.nombre}</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                      Abierto
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-2">
                    <MapPin size={14} className="text-blue-600 shrink-0" />
                    {suc.direccion || 'Managua, Nicaragua'}
                  </p>
                  <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1">
                    <Phone size={14} className="text-emerald-600 shrink-0" />
                    {suc.telefono || '+505 8888-8888'}
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedBranch(suc.id);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                  >
                    Ver stock de esta sede →
                  </button>
                  <a
                    href={`https://wa.me/${TALLER_CONTACT.whatsapp}?text=${encodeURIComponent(`Hola Taller El Mingo (${suc.nombre}), deseo hacer una consulta.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-slate-400 text-xs py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="Taller El Mingo" className="w-8 h-8 rounded-full border border-slate-700" />
            <div>
              <p className="font-black text-white text-sm">TALLER EL MINGO</p>
              <p className="text-[11px] text-slate-500">
                WhatsApp: {TALLER_CONTACT.whatsappDisplay} • {TALLER_CONTACT.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/dashboard" className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1">
                Ir al Sistema ERP <ArrowRight size={13} />
              </Link>
            ) : (
              <Link to="/login" className="text-slate-300 hover:text-white font-bold flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                <Lock size={12} className="text-amber-400" /> Acceso Personal / Facturación
              </Link>
            )}
          </div>
        </div>
      </footer>

      {/* BOTÓN FLOTANTE DE PEDIDO EN MÓVIL */}
      {cartCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 z-40 sm:hidden">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-blue-600 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between font-black text-sm border-2 border-white/20"
          >
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-blue-950 px-2.5 py-0.5 rounded-full text-xs font-black">
                {cartCount}
              </span>
              <span>Ver Pedido de Repuestos</span>
            </div>
            <span>C$ {cartTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} →</span>
          </button>
        </div>
      )}

      {/* DRAWER LATERAL DEL CARRITO PARA REPUESTOS */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header Carrito */}
            <div className="p-4 bg-blue-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingCart size={20} className="text-amber-400" />
                <div>
                  <h2 className="font-black text-base leading-none">Pedido de Repuestos</h2>
                  <p className="text-[11px] text-blue-200 mt-0.5">
                    {cartCount} {cartCount === 1 ? 'artículo' : 'artículos'} para envío o retiro
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-blue-200 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido del Carrito */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart size={28} />
                  </div>
                  <p className="font-black text-slate-700 text-base">Tu pedido de repuestos está vacío</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Explora el catálogo y agrega los repuestos o lubricantes que deseas cotizar o recibir.
                  </p>
                </div>
              ) : (
                <>
                  {/* Lista de repuestos en carrito */}
                  <div className="space-y-2.5">
                    {cart.map(item => (
                      <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                              <Package size={20} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-mono font-bold text-slate-400">{item.codigo_visible}</p>
                            <p className="font-bold text-xs text-slate-800 break-words leading-snug">{item.name}</p>
                            <p className="text-xs font-black text-blue-900 mt-0.5">
                              C$ {(item.price * item.qty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              <span className="text-[10px] font-normal text-slate-500 ml-1">
                                (C$ {item.price.toFixed(2)} c/u)
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                            title="Quitar"
                          >
                            <Trash2 size={14} />
                          </button>
                          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                            <button
                              onClick={() => updateCartQty(item.id, -1)}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-xs cursor-pointer"
                            >
                              -
                            </button>
                            <span className="text-xs font-black px-1.5">{item.qty}</span>
                            <button
                              onClick={() => updateCartQty(item.id, 1)}
                              className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Formulario de entrega / retiro */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 space-y-3">
                    <p className="text-xs font-black text-blue-950 uppercase tracking-wider">
                      Datos para el envío o retiro
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Tu Nombre</label>
                        <input
                          type="text"
                          value={customerInfo.nombre}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, nombre: e.target.value }))}
                          placeholder="Ej. Carlos Pérez"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Modelo de tu Moto</label>
                        <input
                          type="text"
                          value={customerInfo.modeloMoto}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, modeloMoto: e.target.value }))}
                          placeholder="Ej. Boxer BM 150"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Sucursal de Preferencia</label>
                        <select
                          value={customerInfo.sucursalPreferida}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, sucursalPreferida: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-blue-600"
                        >
                          {sucursales.map(s => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Modalidad de Entrega</label>
                        <select
                          value={customerInfo.modalidad}
                          onChange={(e) => setCustomerInfo(prev => ({ ...prev, modalidad: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-blue-600"
                        >
                          <option value="Retiro en Sucursal">Retiro en Sucursal</option>
                          <option value="Envío por CargoTrans / Encomienda">Envío por CargoTrans / Encomienda</option>
                          <option value="Delivery Local">Delivery Local</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Indicaciones o Nota adicional</label>
                      <input
                        type="text"
                        value={customerInfo.notas}
                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, notas: e.target.value }))}
                        placeholder="Ej. Enviar a agencia CargoTrans de..."
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer del Carrito */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Total Estimado Repuestos</span>
                  <span className="text-2xl font-black text-blue-950">
                    C$ {cartTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <button
                  onClick={() => handleSendWhatsAppOrder()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 text-sm cursor-pointer transition-all"
                >
                  <MessageCircle size={19} />
                  Enviar Pedido de Repuestos por WhatsApp
                </button>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={handleCopyOrderText}
                    className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={13} /> Copiar Texto
                  </button>
                  <button
                    onClick={clearCart}
                    className="bg-white hover:bg-red-50 border border-slate-200 text-red-600 font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} /> Vaciar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE REPUESTO */}
      {detailModalItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDetailModalItem(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-blue-950 text-white flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-300">
                Código: {detailModalItem.codigo_visible || detailModalItem.id}
              </span>
              <button
                onClick={() => setDetailModalItem(null)}
                className="text-blue-200 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {detailModalItem.image && (
                <div className="h-56 bg-slate-100 rounded-2xl flex items-center justify-center p-3">
                  <img
                    src={detailModalItem.image}
                    alt={detailModalItem.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}

              <div>
                <span className="text-xs font-black uppercase text-blue-600">
                  {detailModalItem.cat || 'Repuestos'}
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-0.5">
                  {detailModalItem.name || detailModalItem.nombre}
                </h3>
                {detailModalItem.descripcion && (
                  <p className="text-sm text-slate-600 mt-2">{detailModalItem.descripcion}</p>
                )}
              </div>

              {/* Disponibilidad por sucursal */}
              {detailModalItem.stockPorSucursal && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[11px] font-black text-slate-500 uppercase mb-2">
                    Disponibilidad por Sucursal
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {sucursales.map(suc => {
                      const st = detailModalItem.stockPorSucursal[suc.id] || 0;
                      return (
                        <div key={suc.id} className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">{suc.short || suc.nombre}</span>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                            st > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {st > 0 ? `${st} uds` : 'Agotado'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div>
                  <span className="text-xs text-slate-400 font-bold block">Precio Oficial</span>
                  <span className="text-2xl font-black text-blue-950">
                    C$ {Number(detailModalItem.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      addToCart(detailModalItem, 1);
                      setDetailModalItem(null);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-4 py-3 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingCart size={16} /> Agregar al Pedido
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ZOOM DE IMAGEN */}
      <ImagePreviewModal
        isOpen={Boolean(previewProduct)}
        product={previewProduct}
        onClose={() => setPreviewProduct(null)}
      />
    </div>
  );
}
