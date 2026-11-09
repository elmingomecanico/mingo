import React, { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import { 
  Package, Search, Plus, Printer, CheckCircle2, Clock, AlertTriangle, 
  Truck, ArrowRight, User, Phone, Calendar, Hash, FileText, ChevronDown, 
  ChevronUp, ShieldCheck, Building2, Eye, History, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { registrarPendienteEntrega, procesarDespachoEntrega } from '../utils/entregasService';
import DeliveryOrderPrinter from '../components/inventario/DeliveryOrderPrinter';

export default function PendientesEntrega() {
  const { user } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos'); // 'Todos' | 'Pendiente' | 'Parcial' | 'Entregado'
  const [branchFilter, setBranchFilter] = useState('Todas');
  const [expandedRecordId, setExpandedRecordId] = useState(null);

  // Catálogos auxiliares para registro manual
  const [sucursales, setSucursales] = useState([]);
  const [productos, setProductos] = useState([]);

  // Modal de Despacho / Entrega
  const [despachoModal, setDespachoModal] = useState({
    isOpen: false,
    record: null,
    itemsToDispatch: {},
    despachadoPor: user?.nombre_completo || 'Bodeguero / Cajero',
    recibidoPor: '',
    cedulaRecibe: '',
    observaciones: ''
  });

  // Modal de Nuevo Registro Manual
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    cliente_nombre: '',
    cliente_telefono: '',
    cliente_identificacion: '',
    id_venta_origen: '',
    sucursal: user?.sucursal || 'SUC-01',
    motivo: 'Cliente pagó y retira posteriormente en taller',
    items: []
  });
  const [selectedProdToAdd, setSelectedProdToAdd] = useState('');
  const [cantToAdd, setCantToAdd] = useState(1);

  // Modal de Impresión de Orden de Entrega
  const [printModal, setPrintModal] = useState({
    isOpen: false,
    record: null,
    despacho: null
  });

  // Cargar datos en tiempo real desde Firebase RTDB
  useEffect(() => {
    const entregasRef = ref(rtdb, 'pendientes_entrega');
    const sucRef = ref(rtdb, 'configuracion/sucursales');
    const prodsRef = ref(rtdb, 'productos');

    const unsubEntregas = onValue(entregasRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.keys(val).map(k => ({ id: k, ...val[k] }));
        list.sort((a, b) => new Date(b.fecha_creacion || 0) - new Date(a.fecha_creacion || 0));
        setRegistros(list);
      } else {
        setRegistros([]);
      }
      setLoading(false);
    }, () => setLoading(false));

    const unsubSuc = onValue(sucRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setSucursales(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      }
    });

    const unsubProds = onValue(prodsRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setProductos(Object.keys(val).map(k => ({ id: k, ...val[k] })));
      }
    });

    return () => {
      unsubEntregas();
      unsubSuc();
      unsubProds();
    };
  }, []);

  // Filtrado de registros
  const filteredRegistros = useMemo(() => {
    return registros.filter(r => {
      if (statusFilter !== 'Todos' && r.estado !== statusFilter) return false;
      if (branchFilter !== 'Todas' && r.sucursal !== branchFilter) return false;

      if (search.trim()) {
        const term = search.toLowerCase().trim();
        const text = [
          r.codigo_visible,
          r.cliente_nombre,
          r.cliente_telefono,
          r.cliente_identificacion,
          r.id_venta_origen,
          r.motivo,
          ...(r.items || []).map(i => `${i.codigo_visible} ${i.nombre}`)
        ].join(' ').toLowerCase();

        return text.includes(term);
      }
      return true;
    });
  }, [registros, statusFilter, branchFilter, search]);

  // Métricas rápidas
  const metrics = useMemo(() => {
    let pendientesTotal = 0;
    let parcialesTotal = 0;
    let completadosTotal = 0;
    let piezasPendientesTotal = 0;

    registros.forEach(r => {
      if (r.estado === 'Pendiente') pendientesTotal++;
      else if (r.estado === 'Parcial') parcialesTotal++;
      else if (r.estado === 'Entregado') completadosTotal++;

      (r.items || []).forEach(it => {
        piezasPendientesTotal += Number(it.cantidad_pendiente || 0);
      });
    });

    return { pendientesTotal, parcialesTotal, completadosTotal, piezasPendientesTotal };
  }, [registros]);

  // Iniciar proceso de despacho para un registro
  const handleOpenDespacho = (record) => {
    const initialItems = {};
    (record.items || []).forEach(it => {
      if (it.cantidad_pendiente > 0) {
        initialItems[it.id_producto] = it.cantidad_pendiente; // Por defecto sugiere entregar todo el saldo pendiente
      }
    });

    setDespachoModal({
      isOpen: true,
      record,
      itemsToDispatch: initialItems,
      despachadoPor: user?.nombre_completo || 'Bodeguero / Cajero',
      recibidoPor: record.cliente_nombre || '',
      cedulaRecibe: record.cliente_identificacion || '',
      observaciones: ''
    });
  };

  // Confirmar y procesar despacho
  const handleConfirmDespacho = async (e) => {
    e.preventDefault();
    if (!despachoModal.record) return;

    const dispatchList = Object.keys(despachoModal.itemsToDispatch).map(prodId => ({
      id_producto: prodId,
      cantidad_a_entregar: Number(despachoModal.itemsToDispatch[prodId] || 0)
    })).filter(it => it.cantidad_a_entregar > 0);

    if (dispatchList.length === 0) {
      return toast.error('Debes indicar al menos 1 unidad para despachar.');
    }

    const toastId = toast.loading('Procesando entrega y generando orden...');
    try {
      const res = await procesarDespachoEntrega({
        id_registro: despachoModal.record.id,
        despachado_por: despachoModal.despachadoPor,
        recibido_por: despachoModal.recibidoPor,
        cedula_recibe: despachoModal.cedulaRecibe,
        observaciones: despachoModal.observaciones,
        despacho_items: dispatchList
      });

      toast.success(
        res.nuevoEstado === 'Entregado'
          ? '¡Entrega completada al 100%!'
          : `Despacho registrado. Quedan ${res.itemsRestantesTotal} unidades pendientes.`,
        { id: toastId }
      );

      // Abrir vista previa de impresión de la Orden de Entrega inmediatamente
      setPrintModal({
        isOpen: true,
        record: despachoModal.record,
        despacho: res.detalleDespacho
      });

      setDespachoModal({
        isOpen: false,
        record: null,
        itemsToDispatch: {},
        despachadoPor: '',
        recibidoPor: '',
        cedulaRecibe: '',
        observaciones: ''
      });
    } catch (err) {
      toast.error('Error al procesar entrega: ' + err.message, { id: toastId });
    }
  };

  // Manejador de agregar producto en registro manual
  const handleAddItemToNewForm = () => {
    if (!selectedProdToAdd) return toast.error('Selecciona un repuesto del inventario.');
    const prod = productos.find(p => p.id === selectedProdToAdd);
    if (!prod) return;

    const qty = Math.max(1, Number(cantToAdd || 1));
    setNewForm(prev => {
      const exists = prev.items.find(i => i.id_producto === prod.id);
      if (exists) {
        return {
          ...prev,
          items: prev.items.map(i => i.id_producto === prod.id ? { ...i, cantidad: i.cantidad + qty } : i)
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            id_producto: prod.id,
            codigo_visible: prod.codigo_visible || prod.id,
            nombre: prod.name,
            precio_unitario: Number(prod.price || 0),
            cantidad: qty
          }
        ]
      };
    });

    setSelectedProdToAdd('');
    setCantToAdd(1);
  };

  // Guardar nuevo registro manual
  const handleSaveNewRecord = async (e) => {
    e.preventDefault();
    if (!newForm.cliente_nombre.trim()) return toast.error('Ingresa el nombre del cliente.');
    if (newForm.items.length === 0) return toast.error('Agrega al menos un repuesto al registro.');

    const toastId = toast.loading('Registrando mercancía pendiente de entrega...');
    try {
      await registrarPendienteEntrega({
        cliente_nombre: newForm.cliente_nombre,
        cliente_telefono: newForm.cliente_telefono,
        cliente_identificacion: newForm.cliente_identificacion,
        id_venta_origen: newForm.id_venta_origen,
        sucursal: newForm.sucursal,
        motivo: newForm.motivo,
        items: newForm.items,
        usuario_registro: user?.nombre_completo || 'Personal'
      });

      toast.success('Mercancía registrada con éxito en el repositorio', { id: toastId });
      setNewModalOpen(false);
      setNewForm({
        cliente_nombre: '',
        cliente_telefono: '',
        cliente_identificacion: '',
        id_venta_origen: '',
        sucursal: user?.sucursal || 'SUC-01',
        motivo: 'Cliente pagó y retira posteriormente en taller',
        items: []
      });
    } catch (err) {
      toast.error('Error al guardar: ' + err.message, { id: toastId });
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-100 text-amber-900 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Clock size={13} /> Control de Custodia & Despachos
            </span>
            <span className="text-xs text-slate-400 font-mono font-bold">
              {registros.length} expedientes
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Pendientes de Entrega & Despacho
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Repositorio oficial de repuestos pagados o apartados en espera de retiro o montaje. Garantiza que la mercancía vendida no sea extraviada ni re-vendida.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setNewModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} /> Registrar Mercancía Pendiente
          </button>
        </div>
      </div>

      {/* MÉTRICAS RÁPIDAS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Package size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Piezas por Entregar</p>
            <p className="text-xl font-black text-amber-700">{metrics.piezasPendientesTotal} uds</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Totalmente Pendientes</p>
            <p className="text-xl font-black text-rose-700">{metrics.pendientesTotal}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Truck size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Retiros Parciales</p>
            <p className="text-xl font-black text-blue-700">{metrics.parcialesTotal}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Entregas Liquidadas</p>
            <p className="text-xl font-black text-emerald-700">{metrics.completadosTotal}</p>
          </div>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, teléfono, folio o repuesto..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Filtro Estado */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            {['Todos', 'Pendiente', 'Parcial', 'Entregado'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-blue-950 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'Pendiente' ? 'Por Retirar' : st === 'Parcial' ? 'Parciales' : st === 'Entregado' ? 'Entregados' : 'Todos'}
              </button>
            ))}
          </div>

          {/* Filtro Sucursal */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-blue-600"
          >
            <option value="Todas">Todas las Sucursales</option>
            {sucursales.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* LISTA DE EXPEDIENTES DE MERCANCÍA */}
      {loading ? (
        <div className="space-y-3 py-8">
          {[1, 2, 3].map(n => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse h-28" />
          ))}
        </div>
      ) : filteredRegistros.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto my-6 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Package size={28} />
          </div>
          <h3 className="font-black text-slate-800 text-base">No hay entregas pendientes registradas</h3>
          <p className="text-xs text-slate-500 mt-1">
            Los repuestos vendidos para retiro diferido o pedidos especiales aparecerán listados aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredRegistros.map(record => {
            const isExpanded = expandedRecordId === record.id;
            const items = record.items || [];
            const totalCompradas = items.reduce((acc, i) => acc + Number(i.cantidad_total || 0), 0);
            const totalEntregadas = items.reduce((acc, i) => acc + Number(i.cantidad_entregada || 0), 0);
            const totalPendientes = items.reduce((acc, i) => acc + Number(i.cantidad_pendiente || 0), 0);
            const percentEntregado = totalCompradas > 0 ? Math.round((totalEntregadas / totalCompradas) * 100) : 0;
            const isCompleted = record.estado === 'Entregado' || totalPendientes === 0;

            return (
              <div
                key={record.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs hover:shadow-md ${
                  isCompleted ? 'border-slate-200' : 'border-amber-300/80 bg-amber-50/10'
                }`}
              >
                {/* ENCABEZADO DE EXPEDIENTE */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black shrink-0 ${
                      isCompleted 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : totalEntregadas > 0 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isCompleted ? <CheckCircle2 size={22} /> : <Clock size={22} />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          {record.codigo_visible}
                        </span>
                        {record.id_venta_origen && (
                          <span className="text-[11px] font-mono text-slate-500 font-bold">
                            Venta: {record.id_venta_origen}
                          </span>
                        )}
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : totalEntregadas > 0
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-900'
                        }`}>
                          {isCompleted ? 'Entrega Completada' : totalEntregadas > 0 ? 'Entrega Parcial' : 'Pendiente de Retiro'}
                        </span>
                      </div>

                      <h3 className="font-black text-base text-slate-900 mt-1 truncate">
                        {record.cliente_nombre}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-0.5">
                        {record.cliente_telefono && (
                          <span className="flex items-center gap-1">
                            <Phone size={12} className="text-emerald-600" /> {record.cliente_telefono}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Building2 size={12} className="text-blue-600" /> Sucursal: {record.sucursal}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" /> {new Date(record.fecha_creacion).toLocaleDateString('es-NI')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones & Progreso */}
                  <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-right mr-2 hidden sm:block">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Progreso</span>
                      <span className="text-xs font-black text-slate-800">
                        {totalEntregadas} / {totalCompradas} piezas ({percentEntregado}%)
                      </span>
                    </div>

                    {!isCompleted && (
                      <button
                        onClick={() => handleOpenDespacho(record)}
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <Truck size={14} /> Despachar / Entregar
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title={isExpanded ? 'Contraer detalle' : 'Ver detalle de piezas'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* MOTIVO / NOTA */}
                {record.motivo && (
                  <div className="px-5 py-2 bg-slate-50/70 border-b border-slate-100 text-xs text-slate-600 flex items-center gap-2">
                    <FileText size={13} className="text-slate-400 shrink-0" />
                    <span><strong>Motivo / Nota:</strong> {record.motivo}</span>
                  </div>
                )}

                {/* DETALLE EXPANDIBLE: TABLA DE REPUESTOS Y HISTORIAL */}
                {isExpanded && (
                  <div className="p-5 space-y-4 bg-slate-50/40">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider mb-2">
                        Productos en Custodia
                      </h4>
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                            <tr>
                              <th className="py-2 px-3">Código</th>
                              <th className="py-2 px-3">Repuesto</th>
                              <th className="py-2 px-3 text-center">Comprado</th>
                              <th className="py-2 px-3 text-center">Entregado</th>
                              <th className="py-2 px-3 text-right">Saldo Pendiente</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {items.map(it => (
                              <tr key={it.id_producto} className="hover:bg-slate-50/60">
                                <td className="py-2.5 px-3 font-mono font-bold text-blue-900">{it.codigo_visible}</td>
                                <td className="py-2.5 px-3 font-bold text-slate-900">{it.nombre}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-700">{it.cantidad_total} uds</td>
                                <td className="py-2.5 px-3 text-center font-bold text-emerald-700">{it.cantidad_entregada || 0} uds</td>
                                <td className="py-2.5 px-3 text-right font-black">
                                  {it.cantidad_pendiente > 0 ? (
                                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                      {it.cantidad_pendiente} pendientes
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 flex items-center gap-1 justify-end">
                                      <Check size={13} /> Entregado
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* HISTORIAL DE DESPACHOS REALIZADOS */}
                    {record.historial_despachos && record.historial_despachos.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider mb-2 flex items-center gap-1.5">
                          <History size={13} /> Historial de Entregas & Comprobantes Generados
                        </h4>
                        <div className="space-y-2">
                          {record.historial_despachos.map((desp, dIdx) => (
                            <div key={desp.id_despacho || dIdx} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
                              <div>
                                <span className="font-mono font-bold text-blue-950 block">
                                  {desp.id_despacho}
                                </span>
                                <p className="text-slate-500 text-[11px] mt-0.5">
                                  Entregado a: <strong>{desp.recibido_por}</strong> {desp.cedula_recibe ? `(Cédula: ${desp.cedula_recibe})` : ''} • Despachó: {desp.despachado_por}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {new Date(desp.fecha).toLocaleString('es-NI')}
                                </p>
                              </div>

                              <button
                                onClick={() => setPrintModal({
                                  isOpen: true,
                                  record,
                                  despacho: desp
                                })}
                                className="bg-slate-100 hover:bg-blue-50 text-blue-900 border border-slate-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Printer size={13} /> Reimprimir Orden
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PARA PROCESAR DESPACHO / ENTREGA */}
      {despachoModal.isOpen && despachoModal.record && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="p-4 bg-blue-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base">Generar Orden de Entrega</h3>
                <p className="text-[11px] text-blue-200 font-mono">
                  Expediente: {despachoModal.record.codigo_visible} • {despachoModal.record.cliente_nombre}
                </p>
              </div>
              <button
                onClick={() => setDespachoModal({ ...despachoModal, isOpen: false })}
                className="text-blue-200 hover:text-white p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmDespacho} className="p-5 space-y-4">
              {/* TABLA DE CANTIDADES A ENTREGAR */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Indica las unidades que se entregan hoy al cliente:
                </label>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2 px-3 text-left">Repuesto</th>
                        <th className="py-2 px-3 text-center">Pendiente</th>
                        <th className="py-2 px-3 text-center">A Entregar Hoy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(despachoModal.record.items || []).filter(i => i.cantidad_pendiente > 0).map(item => (
                        <tr key={item.id_producto}>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[10px] text-slate-400 font-bold block">{item.codigo_visible}</span>
                            <span className="font-bold text-slate-800">{item.nombre}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-amber-700">
                            {item.cantidad_pendiente} uds
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max={item.cantidad_pendiente}
                              value={despachoModal.itemsToDispatch[item.id_producto] ?? item.cantidad_pendiente}
                              onChange={(e) => {
                                const val = Math.min(item.cantidad_pendiente, Math.max(0, Number(e.target.value)));
                                setDespachoModal(prev => ({
                                  ...prev,
                                  itemsToDispatch: {
                                    ...prev.itemsToDispatch,
                                    [item.id_producto]: val
                                  }
                                }));
                              }}
                              className="w-16 p-1.5 text-center font-black border border-blue-300 rounded-lg outline-none focus:border-blue-600 bg-blue-50/50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DATOS DE QUIEN RECIBE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Persona que Retira *
                  </label>
                  <input
                    type="text"
                    required
                    value={despachoModal.recibidoPor}
                    onChange={(e) => setDespachoModal(prev => ({ ...prev, recibidoPor: e.target.value }))}
                    placeholder="Nombre completo"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cédula / Identificación
                  </label>
                  <input
                    type="text"
                    value={despachoModal.cedulaRecibe}
                    onChange={(e) => setDespachoModal(prev => ({ ...prev, cedulaRecibe: e.target.value }))}
                    placeholder="Ej. 001-000000-0000A"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Despachado por (Personal de Taller) *
                </label>
                <input
                  type="text"
                  required
                  value={despachoModal.despachadoPor}
                  onChange={(e) => setDespachoModal(prev => ({ ...prev, despachadoPor: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-600 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observaciones de Entrega
                </label>
                <input
                  type="text"
                  value={despachoModal.observaciones}
                  onChange={(e) => setDespachoModal(prev => ({ ...prev, observaciones: e.target.value }))}
                  placeholder="Ej. Se verificó estado de piezas con el cliente"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDespachoModal({ ...despachoModal, isOpen: false })}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <CheckCircle2 size={16} /> Confirmar Entrega & Generar Orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO REGISTRO MANUAL */}
      {newModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="p-4 bg-blue-950 text-white flex items-center justify-between">
              <div>
                <h3 className="font-black text-base">Registrar Mercancía en Custodia</h3>
                <p className="text-[11px] text-blue-200">
                  Apartado o venta diferida de repuestos pendientes de retiro
                </p>
              </div>
              <button onClick={() => setNewModalOpen(false)} className="text-blue-200 hover:text-white p-1 cursor-pointer">
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNewRecord} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Cliente *</label>
                  <input
                    type="text"
                    required
                    value={newForm.cliente_nombre}
                    onChange={(e) => setNewForm(prev => ({ ...prev, cliente_nombre: e.target.value }))}
                    placeholder="Ej. Juan Pérez"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newForm.cliente_telefono}
                    onChange={(e) => setNewForm(prev => ({ ...prev, cliente_telefono: e.target.value }))}
                    placeholder="Ej. 8888-8888"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sucursal de Custodia</label>
                  <select
                    value={newForm.sucursal}
                    onChange={(e) => setNewForm(prev => ({ ...prev, sucursal: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-600"
                  >
                    {sucursales.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Factura / Ticket Ref.</label>
                  <input
                    type="text"
                    value={newForm.id_venta_origen}
                    onChange={(e) => setNewForm(prev => ({ ...prev, id_venta_origen: e.target.value }))}
                    placeholder="Ej. FAC-0001"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo / Situación</label>
                <input
                  type="text"
                  value={newForm.motivo}
                  onChange={(e) => setNewForm(prev => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Ej. Pagó en caja y vendrá con la moto a montarlas"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-blue-600"
                />
              </div>

              {/* SELECCIONAR PRODUCTOS */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                <span className="text-xs font-black uppercase text-slate-700 block">
                  Agregar Repuestos al Expediente
                </span>
                <div className="flex gap-2">
                  <select
                    value={selectedProdToAdd}
                    onChange={(e) => setSelectedProdToAdd(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-blue-600"
                  >
                    <option value="">-- Seleccionar repuesto --</option>
                    {productos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.codigo_visible ? `[${p.codigo_visible}] ` : ''}{p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={cantToAdd}
                    onChange={(e) => setCantToAdd(e.target.value)}
                    className="w-16 bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-black text-center outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddItemToNewForm}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Agregar
                  </button>
                </div>

                {/* Lista agregada */}
                {newForm.items.length > 0 && (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden text-xs">
                    {newForm.items.map((it, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-mono text-[10px] text-blue-700 font-bold block">{it.codigo_visible}</span>
                          <span className="font-bold text-slate-800">{it.nombre}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            {it.cantidad} uds
                          </span>
                          <button
                            type="button"
                            onClick={() => setNewForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}
                            className="text-red-500 hover:text-red-700 font-bold"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  <Package size={16} /> Guardar Registro en Custodia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPROBANTE IMPRIMIBLE DE ENTREGA */}
      <DeliveryOrderPrinter
        isOpen={printModal.isOpen}
        onClose={() => setPrintModal({ isOpen: false, record: null, despacho: null })}
        record={printModal.record}
        despacho={printModal.despacho}
      />
    </div>
  );
}
