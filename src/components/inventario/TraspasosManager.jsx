import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ref, onValue, push, set, update, runTransaction, get } from 'firebase/database';
import { rtdb } from '../../firebase';
import { 
  ArrowRightLeft, Plus, Search, Filter, Printer, FileText, CheckCircle2, 
  AlertCircle, Building2, Package, Truck, User, Calendar, Clock, X, 
  Trash2, ChevronRight, Hash, ArrowRight, ShieldCheck, Sparkles, Eye, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import { consumeNextConsecutiveAtomic, checkDuplicateCodigoVisible } from '../../utils/consecutivosService';
import { DEFAULT_CONSECUTIVOS, formatConsecutive } from '../catalogos/ConsecutivosManager';

export default function TraspasosManager({ user, sucursalesProp = null, productsProp = null, inventoryProp = null }) {
  // Datos principales
  const [sucursales, setSucursales] = useState([]);
  const [productos, setProductos] = useState([]);
  const [allInventory, setAllInventory] = useState({});
  const [traspasos, setTraspasos] = useState([]);
  const [consecutivosConfig, setConsecutivosConfig] = useState(DEFAULT_CONSECUTIVOS);
  const [loading, setLoading] = useState(true);

  // Filtros de historial
  const [search, setSearch] = useState('');
  const [filtroOrigen, setFiltroOrigen] = useState('Todas');
  const [filtroDestino, setFiltroDestino] = useState('Todas');
  const [filtroFecha, setFiltroFecha] = useState('todos'); // 'hoy' | 'semana' | 'mes' | 'todos'

  // Modal Nuevo Traspaso
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [origenId, setOrigenId] = useState('SUC-01');
  const [destinoId, setDestinoId] = useState('SUC-02');
  const [chofer, setChofer] = useState('');
  const [motivo, setMotivo] = useState('Reabastecimiento de inventario');
  const [codigoPersonalizado, setCodigoPersonalizado] = useState('');
  const [itemsTraspaso, setItemsTraspaso] = useState([]); // [{ id, codigo, name, cantidad, stock_origen, stock_destino }]

  // Selector temporal de producto para agregar
  const [selectedProductOption, setSelectedProductOption] = useState(null);
  const [cantidadToAdd, setCantidadToAdd] = useState(1);

  // Modal Detalle / Comprobante de Remisión
  const [selectedTraspaso, setSelectedTraspaso] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const printRef = useRef(null);

  // Carga reactiva de datos desde Firebase RTDB
  useEffect(() => {
    // 1. Sucursales
    const sucRef = ref(rtdb, 'configuracion/sucursales');
    const unsubSuc = onValue(sucRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.keys(val).map(key => ({
          id: key,
          codigo_visible: val[key].codigo_visible || key,
          ...val[key]
        }));
        setSucursales(list);
        if (list.length >= 2) {
          setOrigenId(list[0].id);
          setDestinoId(list[1].id);
        }
      }
    });

    // 2. Productos
    const prodRef = ref(rtdb, 'productos');
    const unsubProd = onValue(prodRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setProductos(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      }
    });

    // 3. Inventario consolidado
    const invRef = ref(rtdb, 'inventario');
    const unsubInv = onValue(invRef, (snap) => {
      if (snap.exists()) {
        setAllInventory(snap.val());
      }
      setLoading(false);
    });

    // 4. Consecutivos
    const consRef = ref(rtdb, 'configuracion/consecutivos');
    const unsubCons = onValue(consRef, (snap) => {
      if (snap.exists()) {
        setConsecutivosConfig({ ...DEFAULT_CONSECUTIVOS, ...snap.val() });
      }
    });

    // 5. Historial de Traspasos
    const traspRef = ref(rtdb, 'traspasos');
    const unsubTrasp = onValue(traspRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.keys(val).map(k => ({ id: k, ...val[k] }));
        list.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
        setTraspasos(list);
      } else {
        setTraspasos([]);
      }
    });

    return () => {
      unsubSuc();
      unsubProd();
      unsubInv();
      unsubCons();
      unsubTrasp();
    };
  }, []);

  // Mapas auxiliares para resolución rápida
  const sucursalesMap = useMemo(() => {
    const map = {};
    sucursales.forEach(s => {
      map[s.id] = s;
    });
    return map;
  }, [sucursales]);

  // Obtener stock actual de un producto en una sucursal específica
  const getProductStock = (sucId, prodId) => {
    if (!allInventory || !allInventory[sucId] || !allInventory[sucId][prodId]) return 0;
    return Number(allInventory[sucId][prodId].stock_actual || 0);
  };

  // Abrir modal de nuevo traspaso y precomputar código sugerido
  const handleOpenNewModal = () => {
    const traspCfg = consecutivosConfig?.traspasos || DEFAULT_CONSECUTIVOS.traspasos;
    const nextNum = traspCfg.siguiente_numero || (traspasos.length + 1);
    const suggestedCode = formatConsecutive(traspCfg, nextNum);

    setCodigoPersonalizado(suggestedCode);
    setItemsTraspaso([]);
    setSelectedProductOption(null);
    setCantidadToAdd(1);
    setChofer('');
    setMotivo('Reabastecimiento regular de inventario');

    if (sucursales.length >= 2) {
      setOrigenId(sucursales[0].id);
      setDestinoId(sucursales[1].id);
    }
    setIsModalOpen(true);
  };

  // Opciones de productos para React-Select con stock en tiempo real
  const productSelectOptions = useMemo(() => {
    return productos.map(p => {
      const stockOrigen = getProductStock(origenId, p.id);
      const stockDestino = getProductStock(destinoId, p.id);
      return {
        value: p.id,
        label: `${p.name || p.nombre} [${p.codigo_visible || p.id}]`,
        product: p,
        stockOrigen,
        stockDestino
      };
    });
  }, [productos, allInventory, origenId, destinoId]);

  // Agregar producto a la lista de traspaso
  const handleAddItem = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedProductOption) return toast.error('Selecciona un repuesto para agregar');
    
    const qty = parseInt(cantidadToAdd) || 0;
    if (qty <= 0) return toast.error('La cantidad a trasladar debe ser mayor a 0');

    const p = selectedProductOption.product;
    const stockDisp = getProductStock(origenId, p.id);

    // Verificar si ya está en la lista
    const existing = itemsTraspaso.find(item => item.id === p.id);
    const totalDeseado = existing ? existing.cantidad + qty : qty;

    if (totalDeseado > stockDisp) {
      return toast.error(`Stock insuficiente en sucursal de origen. Solo hay ${stockDisp} unidades disponibles de "${p.name}".`);
    }

    if (existing) {
      setItemsTraspaso(prev => prev.map(item => 
        item.id === p.id 
          ? { ...item, cantidad: totalDeseado } 
          : item
      ));
      toast.success(`Se actualizaron las unidades de ${p.name} (${totalDeseado} en total)`);
    } else {
      setItemsTraspaso(prev => [
        ...prev,
        {
          id: p.id,
          codigo_visible: p.codigo_visible || p.id,
          name: p.name || p.nombre,
          cantidad: qty,
          stock_origen_previo: stockDisp,
          stock_destino_previo: getProductStock(destinoId, p.id)
        }
      ]);
      toast.success(`${p.name} agregado al traspaso`);
    }

    setSelectedProductOption(null);
    setCantidadToAdd(1);
  };

  // Modificar cantidad en la tabla
  const handleUpdateItemQty = (prodId, delta) => {
    setItemsTraspaso(prev => prev.map(item => {
      if (item.id !== prodId) return item;
      const nextQty = item.cantidad + delta;
      if (nextQty <= 0) return item;

      const stockDisp = getProductStock(origenId, prodId);
      if (nextQty > stockDisp) {
        toast.error(`No puedes exceder las ${stockDisp} unidades disponibles en origen.`);
        return item;
      }
      return { ...item, cantidad: nextQty };
    }));
  };

  // Quitar producto de la lista
  const handleRemoveItem = (prodId) => {
    setItemsTraspaso(prev => prev.filter(item => item.id !== prodId));
  };

  // Totales
  const totalPiezas = useMemo(() => {
    return itemsTraspaso.reduce((acc, item) => acc + item.cantidad, 0);
  }, [itemsTraspaso]);

  // EJECUCIÓN ATÓMICA DEL TRASPASO
  const handleExecuteTraspaso = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;

    if (origenId === destinoId) {
      return toast.error('La sucursal de origen y destino no pueden ser la misma.');
    }

    if (itemsTraspaso.length === 0) {
      return toast.error('Agrega al menos un repuesto para realizar el traspaso.');
    }

    // Confirmación
    const sucOrigen = sucursalesMap[origenId] || { nombre: origenId, codigo_visible: origenId };
    const sucDestino = sucursalesMap[destinoId] || { nombre: destinoId, codigo_visible: destinoId };

    if (!window.confirm(`¿Confirmas el traspaso de ${totalPiezas} piezas desde [${sucOrigen.codigo_visible}] ${sucOrigen.nombre} hacia [${sucDestino.codigo_visible}] ${sucDestino.nombre}?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Obtener consecutivo atómico oficial
      let codigoFinal = codigoPersonalizado?.trim() || '';
      const traspCfg = consecutivosConfig?.traspasos || DEFAULT_CONSECUTIVOS.traspasos;
      const suggestedDefault = formatConsecutive(traspCfg, traspCfg.siguiente_numero || 1);

      if (!codigoFinal || codigoFinal === suggestedDefault) {
        const atomicRes = await consumeNextConsecutiveAtomic('traspasos');
        codigoFinal = atomicRes.codigoFormateado;
      }

      // Validar duplicidad
      const dupCheck = await checkDuplicateCodigoVisible('traspasos', codigoFinal);
      if (dupCheck.isDuplicate) {
        const nextAtomic = await consumeNextConsecutiveAtomic('traspasos');
        codigoFinal = nextAtomic.codigoFormateado;
      }

      const fechaISO = new Date().toISOString();
      const currentUser = user?.nombre_completo || 'SuperAdmin';
      const traspasoRef = push(ref(rtdb, 'traspasos'));
      const idTraspaso = traspasoRef.key;

      const itemsSnapshot = [];

      // 2. Transacciones atómicas de inventario y registro en Kardex
      for (const item of itemsTraspaso) {
        let stockAntOrigen = 0;
        let stockNuevoOrigen = 0;
        let stockAntDestino = 0;
        let stockNuevoDestino = 0;

        // Descontar en Origen
        const stockOrigenRef = ref(rtdb, `inventario/${origenId}/${item.id}/stock_actual`);
        await runTransaction(stockOrigenRef, (current) => {
          stockAntOrigen = Number(current) || 0;
          stockNuevoOrigen = stockAntOrigen - item.cantidad;
          return stockNuevoOrigen;
        });

        // Acreditar en Destino
        const stockDestinoRef = ref(rtdb, `inventario/${destinoId}/${item.id}/stock_actual`);
        await runTransaction(stockDestinoRef, (current) => {
          stockAntDestino = Number(current) || 0;
          stockNuevoDestino = stockAntDestino + item.cantidad;
          return stockNuevoDestino;
        });

        // Registrar en Kardex de Origen (Salida)
        const kardexOrigenRef = push(ref(rtdb, `kardex/${origenId}/${item.id}`));
        await set(kardexOrigenRef, {
          id: kardexOrigenRef.key,
          id_producto: item.id,
          nombre_producto: item.name,
          tipo_movimiento: 'Salida por Traspaso',
          tipo: 'Salida',
          isEntrada: false,
          cantidad: item.cantidad,
          id_referencia: codigoFinal,
          id_sucursal: origenId,
          motivo: `Traspaso enviado hacia [${sucDestino.codigo_visible}] ${sucDestino.nombre}`,
          stock_anterior: stockAntOrigen,
          stock_nuevo: stockNuevoOrigen,
          fecha: fechaISO,
          usuario: currentUser
        });

        // Registrar en Kardex de Destino (Entrada)
        const kardexDestinoRef = push(ref(rtdb, `kardex/${destinoId}/${item.id}`));
        await set(kardexDestinoRef, {
          id: kardexDestinoRef.key,
          id_producto: item.id,
          nombre_producto: item.name,
          tipo_movimiento: 'Entrada por Traspaso',
          tipo: 'Entrada',
          isEntrada: true,
          cantidad: item.cantidad,
          id_referencia: codigoFinal,
          id_sucursal: destinoId,
          motivo: `Traspaso recibido desde [${sucOrigen.codigo_visible}] ${sucOrigen.nombre}`,
          stock_anterior: stockAntDestino,
          stock_nuevo: stockNuevoDestino,
          fecha: fechaISO,
          usuario: currentUser
        });

        itemsSnapshot.push({
          id: item.id,
          codigo_visible: item.codigo_visible,
          name: item.name,
          cantidad: item.cantidad,
          stock_origen_antes: stockAntOrigen,
          stock_origen_despues: stockNuevoOrigen,
          stock_destino_antes: stockAntDestino,
          stock_destino_despues: stockNuevoDestino
        });
      }

      // 3. Guardar el registro consolidado del traspaso
      const payload = {
        id: idTraspaso,
        codigo_visible: codigoFinal,
        id_sucursal_origen: origenId,
        codigo_sucursal_origen: sucOrigen.codigo_visible || origenId,
        nombre_sucursal_origen: sucOrigen.nombre,
        id_sucursal_destino: destinoId,
        codigo_sucursal_destino: sucDestino.codigo_visible || destinoId,
        nombre_sucursal_destino: sucDestino.nombre,
        fecha: fechaISO,
        usuario: currentUser,
        chofer_transporte: chofer.trim() || 'Entrega Directa / Personal',
        motivo: motivo.trim() || 'Traspaso de mercancía',
        total_items: itemsSnapshot.length,
        total_piezas: totalPiezas,
        estado: 'Completado',
        items: itemsSnapshot
      };

      await set(traspasoRef, payload);

      toast.success(`Traspaso ${codigoFinal} procesado exitosamente (${totalPiezas} piezas trasladadas)`, {
        icon: '📦',
        duration: 4000
      });

      setIsModalOpen(false);
      // Abrir comprobante listo para imprimir
      setSelectedTraspaso(payload);
      setIsDetailModalOpen(true);

    } catch (err) {
      toast.error('Error al procesar el traspaso: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrado de Historial
  const filteredTraspasos = useMemo(() => {
    return traspasos.filter(t => {
      // Filtro origen
      if (filtroOrigen !== 'Todas' && t.id_sucursal_origen !== filtroOrigen) return false;
      // Filtro destino
      if (filtroDestino !== 'Todas' && t.id_sucursal_destino !== filtroDestino) return false;

      // Filtro fecha
      if (filtroFecha !== 'todos' && t.fecha) {
        const itemDate = new Date(t.fecha);
        const today = new Date();
        if (filtroFecha === 'hoy') {
          if (itemDate.toDateString() !== today.toDateString()) return false;
        } else if (filtroFecha === 'semana') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(today.getDate() - 7);
          if (itemDate < sevenDaysAgo) return false;
        } else if (filtroFecha === 'mes') {
          if (itemDate.getMonth() !== today.getMonth() || itemDate.getFullYear() !== today.getFullYear()) return false;
        }
      }

      // Filtro texto
      if (search.trim()) {
        const term = search.toLowerCase();
        const text = [
          t.codigo_visible || '',
          t.nombre_sucursal_origen || '',
          t.nombre_sucursal_destino || '',
          t.usuario || '',
          t.chofer_transporte || '',
          t.motivo || '',
          ...(t.items || []).map(i => `${i.name} ${i.codigo_visible}`)
        ].join(' ').toLowerCase();

        return text.includes(term);
      }

      return true;
    });
  }, [traspasos, filtroOrigen, filtroDestino, filtroFecha, search]);

  // Estadísticas
  const statsTotalPiezas = useMemo(() => {
    return traspasos.reduce((acc, t) => acc + (Number(t.total_piezas) || 0), 0);
  }, [traspasos]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER PRINCIPAL */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <ArrowRightLeft className="text-emerald-600" size={24} />
            Traspasos y Traslados entre Sucursales
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Mueve repuestos de una sucursal a otra sin afectar ventas, con registro atómico en Kardex y hoja de remisión formal.
          </p>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer shrink-0"
        >
          <Plus size={18} />
          + Nuevo Traspaso entre Sucursales
        </button>
      </div>

      {/* TARJETAS RESUMEN DE ACTIVIDAD */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total de Traspasos</p>
            <h3 className="text-2xl font-black text-gray-800 mt-0.5">{traspasos.length}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowRightLeft size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Piezas Trasladadas</p>
            <h3 className="text-2xl font-black text-blue-900 mt-0.5">{statsTotalPiezas}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Package size={22} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sedes Habilitadas</p>
            <h3 className="text-2xl font-black text-purple-900 mt-0.5">{sucursales.length}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Building2 size={22} />
          </div>
        </div>
      </div>

      {/* CONTENEDOR CON BARRA DE FILTROS E HISTORIAL */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        
        {/* BARRA DE FILTROS */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="relative w-full md:w-96">
            <input 
              type="text" 
              placeholder="Buscar por código de remisión, chofer, repuesto o usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 bg-white"
            />
            <Search size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-xs font-bold text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <select
              value={filtroOrigen}
              onChange={(e) => setFiltroOrigen(e.target.value)}
              className="border border-gray-200 p-2 rounded-xl text-xs font-bold text-gray-700 bg-white outline-none"
            >
              <option value="Todas">Origen: Todas</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id}>
                  Desde: [{s.codigo_visible || s.id}] {s.short || s.nombre}
                </option>
              ))}
            </select>

            <select
              value={filtroDestino}
              onChange={(e) => setFiltroDestino(e.target.value)}
              className="border border-gray-200 p-2 rounded-xl text-xs font-bold text-gray-700 bg-white outline-none"
            >
              <option value="Todas">Destino: Todas</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id}>
                  Hacia: [{s.codigo_visible || s.id}] {s.short || s.nombre}
                </option>
              ))}
            </select>

            <select
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="border border-gray-200 p-2 rounded-xl text-xs font-bold text-gray-700 bg-white outline-none"
            >
              <option value="todos">Cualquier Fecha</option>
              <option value="hoy">Hoy</option>
              <option value="semana">Últimos 7 días</option>
              <option value="mes">Este Mes</option>
            </select>
          </div>
        </div>

        {/* TABLA DE HISTORIAL DE TRASPASOS */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-100 text-xs">
              <tr>
                <th className="p-4">Remisión / Código</th>
                <th className="p-4">Fecha y Hora</th>
                <th className="p-4">Ruta (Origen → Destino)</th>
                <th className="p-4 text-center">Ítems / Piezas</th>
                <th className="p-4">Transporte / Chofer</th>
                <th className="p-4">Despachado Por</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-10 text-center text-gray-400 font-medium">
                    Cargando historial de traspasos...
                  </td>
                </tr>
              ) : filteredTraspasos.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-gray-400">
                    <ArrowRightLeft className="mx-auto mb-2 opacity-30 text-gray-500" size={32} />
                    <p className="font-bold text-gray-700 text-sm">No hay traspasos registrados con estos filtros</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {search ? 'Prueba cambiando los términos de búsqueda o filtros.' : 'Haz clic en "+ Nuevo Traspaso" para trasladar mercancía entre sedes.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTraspasos.map(t => {
                  const date = new Date(t.fecha);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="p-4 font-mono font-black text-emerald-800">
                        <span className="bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          {t.codigo_visible || t.id}
                        </span>
                      </td>

                      <td className="p-4 text-gray-700">
                        <div className="font-bold">{date.toLocaleDateString()}</div>
                        <div className="text-[11px] text-gray-400">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded text-[11px] font-mono">
                            [{t.codigo_sucursal_origen || t.id_sucursal_origen}]
                          </span>
                          <span className="text-gray-700 truncate max-w-[140px]">{t.nombre_sucursal_origen}</span>
                          <ArrowRight size={14} className="text-gray-400 shrink-0" />
                          <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded text-[11px] font-mono">
                            [{t.codigo_sucursal_destino || t.id_sucursal_destino}]
                          </span>
                          <span className="text-gray-700 truncate max-w-[140px]">{t.nombre_sucursal_destino}</span>
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <span className="bg-gray-100 font-black text-gray-800 px-2.5 py-1 rounded-md">
                          {t.total_piezas || 0} piezas
                        </span>
                        <span className="text-[10px] text-gray-400 block mt-0.5 font-medium">
                          ({t.total_items || (t.items || []).length} prod.)
                        </span>
                      </td>

                      <td className="p-4 text-gray-700">
                        <div className="flex items-center gap-1.5">
                          <Truck size={14} className="text-gray-400 shrink-0" />
                          <span className="font-medium truncate max-w-[150px]">{t.chofer_transporte || 'Directo'}</span>
                        </div>
                      </td>

                      <td className="p-4 text-gray-600 font-medium">
                        {t.usuario || 'SuperAdmin'}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedTraspaso(t);
                              setIsDetailModalOpen(true);
                            }}
                            className="bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Ver Remisión y Comprobante"
                          >
                            <Eye size={14} /> Ver Hoja
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL NUEVO TRASPASO ENTRE SUCURSALES */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
            
            {/* Header del Modal */}
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-emerald-50/60 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                    Nuevo Traspaso de Inventario entre Sucursales
                  </h3>
                  <p className="text-xs text-gray-500">
                    Descuenta automáticamente de origen y acredita en destino con trazabilidad completa.
                  </p>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleExecuteTraspaso} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                
                {/* FILA 1: Código de Remisión + Chofer + Motivo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50/80 p-3.5 rounded-2xl border border-gray-200/80">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      N° de Remisión / Traspaso *
                    </label>
                    <input
                      type="text"
                      required
                      value={codigoPersonalizado}
                      onChange={e => setCodigoPersonalizado(e.target.value)}
                      disabled={consecutivosConfig?.traspasos?.permitir_edicion_libre === false}
                      className="w-full border-2 border-emerald-300 bg-white p-2.5 rounded-xl text-sm font-mono font-black text-emerald-900 uppercase outline-none focus:border-emerald-600"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Consecutivo oficial de traslado</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Chofer / Transportista / Mensajero
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: CargoTrans, Camioneta Taller..."
                      value={chofer}
                      onChange={e => setChofer(e.target.value)}
                      className="w-full border border-gray-200 bg-white p-2.5 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Persona o empresa que traslada</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Motivo u Observación
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Reabastecimiento urgente..."
                      value={motivo}
                      onChange={e => setMotivo(e.target.value)}
                      className="w-full border border-gray-200 bg-white p-2.5 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Justificación del movimiento</p>
                  </div>
                </div>

                {/* FILA 2: Selección de Sucursal Origen y Destino */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200/80">
                    <label className="block text-xs font-black text-blue-900 uppercase mb-1 flex items-center gap-1.5">
                      <Building2 size={15} /> 1. Sucursal de Origen (SALIDA) *
                    </label>
                    <select
                      value={origenId}
                      onChange={e => {
                        const newOrig = e.target.value;
                        setOrigenId(newOrig);
                        if (newOrig === destinoId) {
                          const other = sucursales.find(s => s.id !== newOrig);
                          if (other) setDestinoId(other.id);
                        }
                        // Limpiar lista para no mezclar stocks
                        setItemsTraspaso([]);
                      }}
                      className="w-full bg-white border border-blue-300 p-2.5 rounded-xl text-xs sm:text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {sucursales.map(s => (
                        <option key={s.id} value={s.id}>
                          [{s.codigo_visible || s.id}] {s.nombre} ({s.short})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-blue-700 mt-1">El stock se descontará de esta sede.</p>
                  </div>

                  <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80">
                    <label className="block text-xs font-black text-emerald-900 uppercase mb-1 flex items-center gap-1.5">
                      <Building2 size={15} /> 2. Sucursal de Destino (ENTRADA) *
                    </label>
                    <select
                      value={destinoId}
                      onChange={e => {
                        const newDest = e.target.value;
                        setDestinoId(newDest);
                        if (newDest === origenId) {
                          const other = sucursales.find(s => s.id !== newDest);
                          if (other) setOrigenId(other.id);
                        }
                      }}
                      className="w-full bg-white border border-emerald-300 p-2.5 rounded-xl text-xs sm:text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      {sucursales.map(s => (
                        <option key={s.id} value={s.id} disabled={s.id === origenId}>
                          [{s.codigo_visible || s.id}] {s.nombre} ({s.short}) {s.id === origenId ? '(Origen actual)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-emerald-700 mt-1">El stock ingresará y se sumará a esta sede.</p>
                  </div>
                </div>

                {/* FILA 3: Selector de Productos a agregar */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-800 uppercase flex items-center gap-1.5">
                      <Package size={15} className="text-emerald-600" />
                      Agregar Repuestos al Traspaso
                    </span>
                    <span className="text-[11px] text-gray-500 font-bold">
                      Origen: [{sucursalesMap[origenId]?.codigo_visible || origenId}]
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-8">
                      <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                        Buscar Repuesto / Producto
                      </label>
                      <Select
                        options={productSelectOptions}
                        value={selectedProductOption}
                        onChange={sel => {
                          setSelectedProductOption(sel);
                          setCantidadToAdd(1);
                        }}
                        placeholder="Escribe el nombre o código del repuesto..."
                        isClearable
                        className="react-select-container text-xs sm:text-sm font-medium"
                        classNamePrefix="react-select"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                        Cantidad *
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={selectedProductOption?.stockOrigen || 9999}
                        value={cantidadToAdd}
                        onChange={e => setCantidadToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full border border-gray-300 bg-white p-2 rounded-xl text-center font-black text-sm outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!selectedProductOption}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-black text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1"
                      >
                        <Plus size={16} /> Agregar
                      </button>
                    </div>
                  </div>

                  {/* Indicador de stock en origen y destino para el producto seleccionado */}
                  {selectedProductOption && (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-gray-700">
                        {selectedProductOption.product.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded">
                          Stock Origen: <strong>{selectedProductOption.stockOrigen} uds</strong>
                        </span>
                        <span className="text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                          Stock Destino: <strong>{selectedProductOption.stockDestino} uds</strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* TABLA DE PRODUCTOS EN EL TRASPASO */}
                <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                  <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="text-xs font-black text-gray-700 uppercase">
                      Lista de Piezas a Trasladar ({itemsTraspaso.length} productos)
                    </span>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      Total: {totalPiezas} piezas
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto">
                    {itemsTraspaso.length === 0 ? (
                      <div className="p-8 text-center text-gray-400 text-xs">
                        No has agregado ningún repuesto todavía. Selecciona arriba para incluir piezas en el traslado.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                          <tr>
                            <th className="p-2.5">Código</th>
                            <th className="p-2.5">Repuesto</th>
                            <th className="p-2.5 text-center">Stock Origen</th>
                            <th className="p-2.5 text-center">Cantidad a Mover</th>
                            <th className="p-2.5 text-center">Stock Destino</th>
                            <th className="p-2.5 text-right">Quitar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {itemsTraspaso.map(item => {
                            const curOrigen = getProductStock(origenId, item.id);
                            const curDestino = getProductStock(destinoId, item.id);
                            const afterOrigen = curOrigen - item.cantidad;
                            const afterDestino = curDestino + item.cantidad;

                            return (
                              <tr key={item.id} className="hover:bg-gray-50/50">
                                <td className="p-2.5 font-mono font-bold text-gray-700">{item.codigo_visible}</td>
                                <td className="p-2.5 font-bold text-gray-900">{item.name}</td>
                                
                                <td className="p-2.5 text-center font-mono">
                                  <span className="text-gray-500">{curOrigen}</span>
                                  <span className="text-gray-400 mx-1">→</span>
                                  <strong className={afterOrigen < 0 ? 'text-red-600' : 'text-blue-700'}>
                                    {afterOrigen}
                                  </strong>
                                </td>

                                <td className="p-2.5 text-center">
                                  <div className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-lg p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItemQty(item.id, -1)}
                                      className="w-5 h-5 rounded bg-white hover:bg-gray-200 font-bold flex items-center justify-center cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <span className="font-black px-2 text-xs">{item.cantidad}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateItemQty(item.id, 1)}
                                      className="w-5 h-5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>

                                <td className="p-2.5 text-center font-mono">
                                  <span className="text-gray-500">{curDestino}</span>
                                  <span className="text-gray-400 mx-1">→</span>
                                  <strong className="text-emerald-700 font-bold">
                                    {afterDestino}
                                  </strong>
                                </td>

                                <td className="p-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer Modal */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 font-bold text-xs text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-600">
                    Total: <strong className="text-emerald-700 text-sm font-black">{totalPiezas} piezas</strong>
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmitting || itemsTraspaso.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-gray-300 text-white font-black text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isSubmitting ? 'Procesando Traspaso...' : 'Registrar y Despachar Traspaso'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DETALLE / COMPROBANTE DE REMISIÓN IMPRIMIBLE */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedTraspaso && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
            
            <div className="p-4 bg-gray-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="text-emerald-400" size={18} />
                <span className="font-black text-sm">
                  Comprobante de Remisión de Inventario: {selectedTraspaso.codigo_visible}
                </span>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Hoja de Remisión formal (área imprimible) */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6" ref={printRef}>
              
              {/* Encabezado Formal */}
              <div className="border-b-2 border-gray-900 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black text-gray-950 tracking-tight">TALLER Y REPUESTOS EL MINGO</h1>
                  <p className="text-xs text-gray-500">Mantenimiento Mecánico Especializado y Venta de Repuestos</p>
                  <p className="text-xs font-mono text-gray-600 mt-1">Tel: +505 8294 3669 • elmingomecanico@gmail.com</p>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-emerald-50 border-2 border-emerald-600 px-3 py-1.5 rounded-xl">
                    <span className="text-[10px] font-bold uppercase text-emerald-800 block">Hoja de Remisión</span>
                    <strong className="text-lg font-black font-mono text-emerald-950">
                      {selectedTraspaso.codigo_visible}
                    </strong>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Fecha: {new Date(selectedTraspaso.fecha).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Rutas: Origen y Destino */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs">
                <div>
                  <span className="font-black text-blue-900 uppercase block mb-1">
                    Origen (Salida de Mercancía)
                  </span>
                  <p className="font-bold text-gray-900">
                    [{selectedTraspaso.codigo_sucursal_origen}] {selectedTraspaso.nombre_sucursal_origen}
                  </p>
                  <p className="text-gray-500 mt-0.5">
                    {sucursalesMap[selectedTraspaso.id_sucursal_origen]?.direccion || 'Dirección de sede'}
                  </p>
                </div>

                <div>
                  <span className="font-black text-emerald-900 uppercase block mb-1">
                    Destino (Recepción)
                  </span>
                  <p className="font-bold text-gray-900">
                    [{selectedTraspaso.codigo_sucursal_destino}] {selectedTraspaso.nombre_sucursal_destino}
                  </p>
                  <p className="text-gray-500 mt-0.5">
                    {sucursalesMap[selectedTraspaso.id_sucursal_destino]?.direccion || 'Dirección de sede'}
                  </p>
                </div>
              </div>

              {/* Datos de Transporte y Despacho */}
              <div className="grid grid-cols-3 gap-3 text-xs bg-white p-3 rounded-xl border border-gray-200">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Despachado Por</span>
                  <strong className="text-gray-800">{selectedTraspaso.usuario}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Chofer / Guía</span>
                  <strong className="text-gray-800">{selectedTraspaso.chofer_transporte || 'Directo'}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Motivo / Causa</span>
                  <strong className="text-gray-800">{selectedTraspaso.motivo || 'Reabastecimiento'}</strong>
                </div>
              </div>

              {/* Tabla de Repuestos Trasladados */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 font-black text-gray-700 border-b border-gray-200">
                    <tr>
                      <th className="p-2.5">N°</th>
                      <th className="p-2.5">Código / SKU</th>
                      <th className="p-2.5">Descripción del Repuesto</th>
                      <th className="p-2.5 text-right font-black">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(selectedTraspaso.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-2.5 font-mono font-bold text-gray-800">{item.codigo_visible}</td>
                        <td className="p-2.5 font-bold text-gray-900">{item.name}</td>
                        <td className="p-2.5 text-right font-black font-mono text-sm text-emerald-800">
                          {item.cantidad} uds
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200 font-black">
                    <tr>
                      <td colSpan="3" className="p-2.5 text-right uppercase text-gray-600">Total Unidades:</td>
                      <td className="p-2.5 text-right font-mono text-base text-emerald-950">
                        {selectedTraspaso.total_piezas} piezas
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Firmas de Responsabilidad */}
              <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs">
                <div>
                  <div className="border-t border-gray-400 pt-1.5 font-bold text-gray-800">
                    Entregado / Despachado
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono">Firma y Cédula</p>
                </div>
                <div>
                  <div className="border-t border-gray-400 pt-1.5 font-bold text-gray-800">
                    Transportista / Chofer
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono">Firma y Cédula</p>
                </div>
                <div>
                  <div className="border-t border-gray-400 pt-1.5 font-bold text-gray-800">
                    Recibido Conforme
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono">Firma y Cédula</p>
                </div>
              </div>

            </div>

            {/* Footer Modal con Botón Imprimir */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 font-bold text-xs text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="bg-gray-900 hover:bg-black text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all"
              >
                <Printer size={15} /> Imprimir Comprobante de Remisión
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
