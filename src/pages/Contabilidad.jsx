import React, { useState, useEffect } from 'react';
import { ref, onValue, push, set, remove, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { 
  Landmark, DollarSign, TrendingUp, TrendingDown, Plus, Minus, Search, 
  Calendar, CreditCard, Filter, ArrowUpRight, ArrowDownRight, FileText, 
  Printer, CheckCircle2, AlertCircle, Clock, Trash2, Tag, ShieldAlert,
  Wallet, Building, PieChart, Scale, ArrowRightLeft, Building2
} from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import TokenizedSearchSelect from '../components/TokenizedSearchSelect';
import BancosManager from '../components/contabilidad/BancosManager';
import AsientoApertura from '../components/contabilidad/AsientoApertura';

const CATEGORIAS_GASTOS_DEFAULT = [
  'Servicios Básicos (Luz, Agua, Internet)',
  'Alquiler de Local',
  'Pago a Proveedor (Repuestos/Insumos)',
  'Combustible y Logística',
  'Alimentación y Viáticos',
  'Mantenimiento y Herramientas',
  'Nómina y Adelantos de Salario',
  'Comisiones a Mecánicos',
  'Papelería y Suministros',
  'Impuestos y Tasas Municipales',
  'Publicidad y Marketing',
  'Gastos y Comisiones Bancarias',
  'Otros Gastos de Operación'
];

const CATEGORIAS_INGRESOS_DEFAULT = [
  'Ventas Mostrador y Taller (POS)',
  'Cobro de Crédito (CxC)',
  'Inyección de Capital / Aporte Socio',
  'Devolución de Proveedor',
  'Asiento Inicial de Apertura',
  'Otros Ingresos Extraordinarios'
];

export default function Contabilidad() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('flujo'); // 'flujo' | 'bancos' | 'apertura' | 'cxp' | 'resultados' | 'categorias'
  
  // Datos desde Firebase
  const [movimientos, setMovimientos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [cxpList, setCxpList] = useState([]);
  const [cxcList, setCxcList] = useState([]);
  const [cuentasBancarias, setCuentasBancarias] = useState([]);
  const [movimientosBancarios, setMovimientosBancarios] = useState([]);
  const [asientoApertura, setAsientoApertura] = useState(null);
  const [allInventory, setAllInventory] = useState({});
  const [proveedoresMap, setProveedoresMap] = useState({});
  const [proveedoresList, setProveedoresList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroSucursal, setFiltroSucursal] = useState('Todas');
  const [filtroPeriodo, setFiltroPeriodo] = useState('mes'); // 'hoy' | 'semana' | 'mes' | 'año' | 'todo'
  const [filtroTipo, setFiltroTipo] = useState('Todos'); // 'Todos' | 'Ingreso' | 'Egreso'
  const [filtroMetodo, setFiltroMetodo] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal para Nuevo Movimiento Manual (Ingreso o Gasto)
  const [isMovModalOpen, setIsMovModalOpen] = useState(false);
  const [movTipo, setMovTipo] = useState('Egreso'); // 'Ingreso' | 'Egreso'
  const [movForm, setMovForm] = useState({
    categoria: CATEGORIAS_GASTOS_DEFAULT[0],
    concepto: '',
    monto: '',
    metodo_pago: 'Efectivo',
    id_cuenta_bancaria: '',
    referencia_bancaria: '',
    numero_comprobante: '',
    beneficiario: '',
    sucursal: 'SUC-01',
    notas: ''
  });

  // Modal para Abono CxP
  const [abonoModal, setAbonoModal] = useState(null);
  const [abonoForm, setAbonoForm] = useState({
    monto: '',
    metodo_pago: 'Efectivo',
    id_cuenta_bancaria: '',
    comprobante: '',
    observacion: ''
  });

  // Modal para Nueva Factura CxP
  const [isNewCxpModalOpen, setIsNewCxpModalOpen] = useState(false);
  const [newCxpForm, setNewCxpForm] = useState({
    id_proveedor: '',
    numero_factura: '',
    monto_total: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    sucursal: 'SUC-01'
  });

  useEffect(() => {
    // 1. Proveedores
    const provRef = ref(rtdb, 'proveedores');
    const unsubProv = onValue(provRef, (snap) => {
      if (snap.exists()) {
        const map = {};
        const list = [];
        Object.keys(snap.val()).forEach(k => {
          map[k] = snap.val()[k].nombre;
          list.push({ id: k, ...snap.val()[k] });
        });
        setProveedoresMap(map);
        setProveedoresList(list);
      } else {
        setProveedoresMap({});
        setProveedoresList([]);
      }
    });

    // 2. Movimientos Contables Manuales
    const movRef = ref(rtdb, 'movimientos_contables');
    const unsubMov = onValue(movRef, (snap) => {
      if (snap.exists()) {
        const list = Object.keys(snap.val()).map(k => ({
          id: k,
          origen: 'manual',
          ...snap.val()[k]
        }));
        setMovimientos(list);
      } else {
        setMovimientos([]);
      }
    });

    // 3. Ventas
    const venRef = ref(rtdb, 'ventas');
    const unsubVen = onValue(venRef, (snap) => {
      if (snap.exists()) {
        const list = Object.keys(snap.val()).map(k => ({
          id: k,
          ...snap.val()[k]
        }));
        setVentas(list);
      } else {
        setVentas([]);
      }
    });

    // 4. Compras
    const compRef = ref(rtdb, 'compras');
    const unsubComp = onValue(compRef, (snap) => {
      if (snap.exists()) {
        const list = Object.keys(snap.val()).map(k => ({
          id: k,
          ...snap.val()[k]
        }));
        setCompras(list);
      } else {
        setCompras([]);
      }
    });

    // 5. CxP
    const cxpRef = ref(rtdb, 'cxp');
    const unsubCxp = onValue(cxpRef, (snap) => {
      if (snap.exists()) {
        const list = Object.keys(snap.val()).map(k => ({
          id: k,
          ...snap.val()[k]
        }));
        setCxpList(list);
      } else {
        setCxpList([]);
      }
    });

    // 6. CxC
    const cxcRef = ref(rtdb, 'cxc');
    const unsubCxc = onValue(cxcRef, (snap) => {
      if (snap.exists()) {
        const list = Object.keys(snap.val()).map(k => ({
          id: k,
          ...snap.val()[k]
        }));
        setCxcList(list);
      } else {
        setCxcList([]);
      }
      setLoading(false);
    });

    // 7. Cuentas Bancarias
    const bancRef = ref(rtdb, 'cuentas_bancarias');
    const unsubBanc = onValue(bancRef, (snap) => {
      if (snap.exists()) {
        const list = Object.keys(snap.val()).map(k => ({
          id: k,
          ...snap.val()[k]
        }));
        setCuentasBancarias(list);
      } else {
        setCuentasBancarias([]);
      }
    });

    // 8. Movimientos Bancarios
    const movBancRef = ref(rtdb, 'movimientos_bancarios');
    const unsubMovBanc = onValue(movBancRef, (snap) => {
      if (snap.exists()) {
        const list = Object.keys(snap.val()).map(k => ({
          id: k,
          ...snap.val()[k]
        }));
        setMovimientosBancarios(list);
      } else {
        setMovimientosBancarios([]);
      }
    });

    // 9. Asiento Inicial de Apertura
    const aperturaRef = ref(rtdb, 'asiento_apertura/general');
    const unsubApertura = onValue(aperturaRef, (snap) => {
      if (snap.exists()) {
        setAsientoApertura(snap.val());
      } else {
        setAsientoApertura(null);
      }
    });

    // 10. Inventario para autocalcular balance inicial
    const invRef = ref(rtdb, 'inventario');
    const unsubInv = onValue(invRef, (snap) => {
      if (snap.exists()) {
        setAllInventory(snap.val());
      } else {
        setAllInventory({});
      }
    });

    return () => {
      unsubProv(); unsubMov(); unsubVen(); unsubComp(); unsubCxp(); unsubCxc();
      unsubBanc(); unsubMovBanc(); unsubApertura(); unsubInv();
    };
  }, []);

  // Consolidar Libro Diario en un solo historial ordenado y sin duplicados
  const getConsolidatedTransactions = () => {
    const list = [];
    const registeredRefs = new Set();

    // 1. Movimientos contables directos
    movimientos.forEach(m => {
      list.push({
        id: m.id,
        fecha: m.fecha,
        tipo: m.tipo, // 'Ingreso' | 'Egreso'
        categoria: m.categoria || (m.tipo === 'Ingreso' ? 'Ingreso General' : 'Gasto General'),
        concepto: m.concepto,
        monto: Number(m.monto || 0),
        metodo_pago: m.metodo_pago || 'Efectivo',
        comprobante: m.numero_comprobante || '-',
        beneficiario: m.beneficiario || '-',
        sucursal: m.sucursal || 'SUC-01',
        usuario: m.usuario || 'Sistema',
        esManual: true
      });
      if (m.id_referencia) registeredRefs.add(m.id_referencia);
    });

    // 2. Ventas POS históricas y en vivo
    ventas.forEach(v => {
      list.push({
        id: `ven-${v.id}`,
        fecha: v.fecha,
        tipo: 'Ingreso',
        categoria: 'Ventas Mostrador y Taller (POS)',
        concepto: `Factura ${v.numero_factura || v.id} - ${v.cliente?.nombre || 'Cliente de Mostrador'}`,
        monto: Number(v.total || 0),
        metodo_pago: v.metodo_pago || 'Efectivo',
        comprobante: v.numero_factura || v.id,
        beneficiario: v.cliente?.nombre || 'Cliente de Mostrador',
        sucursal: v.sucursal || 'SUC-01',
        usuario: v.cajero || 'Cajero POS',
        esManual: false
      });
    });

    // 3. Compras al contado (las de crédito se contabilizan en el abono a CxP)
    compras.forEach(c => {
      if (c.metodo_pago !== 'Crédito') {
        list.push({
          id: `comp-${c.id}`,
          fecha: c.fecha,
          tipo: 'Egreso',
          categoria: 'Compra de Repuestos (Contado)',
          concepto: `Compra ${c.numero_factura || ''} - ${c.nombre_proveedor || 'Proveedor'}`,
          monto: Number(c.total || 0),
          metodo_pago: c.metodo_pago || 'Efectivo',
          comprobante: c.numero_factura || c.id,
          beneficiario: c.nombre_proveedor || 'Proveedor',
          sucursal: c.sucursal || 'SUC-01',
          usuario: 'Compras',
          esManual: false
        });
      }
    });

    // 4. Abonos de CxP si no están ya en movimientos_contables
    cxpList.forEach(cxp => {
      if (cxp.historial_abonos && Array.isArray(cxp.historial_abonos)) {
        cxp.historial_abonos.forEach((ab, idx) => {
          const abId = `cxp-abono-${cxp.id}-${idx}`;
          if (!registeredRefs.has(cxp.id) && !registeredRefs.has(abId)) {
            list.push({
              id: abId,
              fecha: ab.fecha,
              tipo: 'Egreso',
              categoria: 'Pago a Proveedor (CxP)',
              concepto: `Abono a Factura ${cxp.numero_factura || ''} (${proveedoresMap[cxp.id_proveedor] || 'Proveedor'})`,
              monto: Number(ab.monto || 0),
              metodo_pago: ab.metodo_pago || 'Efectivo',
              comprobante: cxp.numero_factura || '-',
              beneficiario: proveedoresMap[cxp.id_proveedor] || 'Proveedor',
              sucursal: cxp.sucursal || 'SUC-01',
              usuario: 'Administración',
              esManual: false
            });
          }
        });
      }
    });

    // 5. Abonos de CxC si no están ya en movimientos_contables
    cxcList.forEach(cxc => {
      if (cxc.historial_abonos && Array.isArray(cxc.historial_abonos)) {
        cxc.historial_abonos.forEach((ab, idx) => {
          const abId = `cxc-abono-${cxc.id}-${idx}`;
          if (!registeredRefs.has(cxc.id) && !registeredRefs.has(abId)) {
            list.push({
              id: abId,
              fecha: ab.fecha,
              tipo: 'Ingreso',
              categoria: 'Cobro de Crédito (CxC)',
              concepto: `Abono a Factura ${cxc.numero_factura || ''}`,
              monto: Number(ab.monto || 0),
              metodo_pago: ab.metodo_pago || 'Efectivo',
              comprobante: cxc.numero_factura || '-',
              beneficiario: 'Cliente',
              sucursal: cxc.sucursal || 'SUC-01',
              usuario: 'Caja',
              esManual: false
            });
          }
        });
      }
    });

    return list.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  };

  const allTransactions = getConsolidatedTransactions();

  // Filtrado por fecha
  const now = new Date();
  const filteredTransactions = allTransactions.filter(item => {
    // Filtro Sucursal
    if (filtroSucursal !== 'Todas' && item.sucursal !== filtroSucursal) return false;

    // Filtro Tipo
    if (filtroTipo !== 'Todos' && item.tipo !== filtroTipo) return false;

    // Filtro Método
    if (filtroMetodo !== 'Todos' && item.metodo_pago !== filtroMetodo) return false;

    // Filtro Período
    const f = new Date(item.fecha);
    if (isNaN(f.getTime())) return true;

    if (filtroPeriodo === 'hoy') {
      const hoyStr = now.toISOString().split('T')[0];
      if (!item.fecha.startsWith(hoyStr)) return false;
    } else if (filtroPeriodo === 'semana') {
      const unaSemanaAtras = new Date();
      unaSemanaAtras.setDate(now.getDate() - 7);
      if (f < unaSemanaAtras) return false;
    } else if (filtroPeriodo === 'mes') {
      if (f.getMonth() !== now.getMonth() || f.getFullYear() !== now.getFullYear()) return false;
    } else if (filtroPeriodo === 'año') {
      if (f.getFullYear() !== now.getFullYear()) return false;
    }

    // Buscador
    if (searchTerm.trim() !== '') {
      const t = searchTerm.toLowerCase();
      const match = (item.concepto || '').toLowerCase().includes(t) ||
                    (item.categoria || '').toLowerCase().includes(t) ||
                    (item.comprobante || '').toLowerCase().includes(t) ||
                    (item.beneficiario || '').toLowerCase().includes(t);
      if (!match) return false;
    }

    return true;
  });

  // Cálculos de Totales y KPIs
  const totalIngresos = filteredTransactions
    .filter(t => t.tipo === 'Ingreso')
    .reduce((sum, t) => sum + t.monto, 0);

  const totalEgresos = filteredTransactions
    .filter(t => t.tipo === 'Egreso')
    .reduce((sum, t) => sum + t.monto, 0);

  const flujoNeto = totalIngresos - totalEgresos;

  // Total Deuda en CxP activa
  const totalDeudaCxP = cxpList
    .filter(c => c.estado === 'Pendiente')
    .reduce((sum, c) => sum + (c.saldo_pendiente || 0), 0);

  // Desglose por método de pago en el período
  const desgloseMetodos = filteredTransactions.reduce((acc, t) => {
    const met = t.metodo_pago || 'Efectivo';
    if (!acc[met]) acc[met] = { ingresos: 0, egresos: 0 };
    if (t.tipo === 'Ingreso') acc[met].ingresos += t.monto;
    else acc[met].egresos += t.monto;
    return acc;
  }, {});

  // Guardar Nuevo Movimiento Manual (Entrada / Salida)
  const handleSaveMovimiento = async (e) => {
    e.preventDefault();
    const montoNum = Number(movForm.monto);
    if (!montoNum || montoNum <= 0) {
      return toast.error('El monto debe ser mayor a 0');
    }
    if (!movForm.concepto.trim()) {
      return toast.error('Debe ingresar un concepto o motivo');
    }

    const esMetodoBancario = movForm.metodo_pago === 'Transferencia' || movForm.metodo_pago === 'Tarjeta' || movForm.metodo_pago === 'Cheque';
    if (esMetodoBancario && !movForm.id_cuenta_bancaria && cuentasBancarias.length > 0) {
      return toast.error('Seleccione la cuenta bancaria afectada para este pago');
    }

    try {
      const nowIso = new Date().toISOString();
      const cuentaAfectada = cuentasBancarias.find(c => c.id === movForm.id_cuenta_bancaria);

      // Si afecta banco, actualizar saldo bancario y registrar movimiento bancario
      if (cuentaAfectada && esMetodoBancario) {
        const saldoAnt = Number(cuentaAfectada.saldo_actual) || 0;
        const saldoPost = movTipo === 'Ingreso' ? (saldoAnt + montoNum) : (saldoAnt - montoNum);

        await runTransaction(ref(rtdb, `cuentas_bancarias/${cuentaAfectada.id}/saldo_actual`), (cur) => {
          return movTipo === 'Ingreso' ? ((Number(cur) || 0) + montoNum) : ((Number(cur) || 0) - montoNum);
        });

        const movBancarioRef = push(ref(rtdb, 'movimientos_bancarios'));
        await set(movBancarioRef, {
          id_cuenta: cuentaAfectada.id,
          nombre_cuenta: cuentaAfectada.alias,
          banco: cuentaAfectada.banco,
          moneda: cuentaAfectada.moneda,
          fecha: nowIso,
          tipo: movTipo,
          razon_movimiento: movTipo === 'Ingreso' ? 'Ingreso General' : 'Gasto Operativo Bancario',
          concepto: movForm.concepto.trim(),
          monto: montoNum,
          referencia_bancaria: movForm.referencia_bancaria?.trim() || movForm.numero_comprobante?.trim() || 'N/A',
          comprobante_relacionado: movForm.numero_comprobante?.trim() || 'N/A',
          saldo_anterior: saldoAnt,
          saldo_posterior: saldoPost,
          beneficiario_o_depositante: movForm.beneficiario?.trim() || 'N/A',
          usuario: user?.nombre_completo || 'Administración',
          sucursal: movForm.sucursal,
          notas: movForm.notas.trim() || ''
        });
      }

      // Registrar en el Libro Diario
      const movRef = push(ref(rtdb, 'movimientos_contables'));
      await set(movRef, {
        fecha: nowIso,
        tipo: movTipo,
        categoria: movForm.categoria,
        concepto: movForm.concepto.trim(),
        monto: montoNum,
        metodo_pago: movForm.metodo_pago,
        id_cuenta_bancaria: cuentaAfectada ? cuentaAfectada.id : null,
        nombre_cuenta_bancaria: cuentaAfectada ? cuentaAfectada.alias : null,
        referencia_bancaria: movForm.referencia_bancaria?.trim() || null,
        numero_comprobante: movForm.numero_comprobante.trim() || 'N/A',
        beneficiario: movForm.beneficiario.trim() || 'N/A',
        sucursal: movForm.sucursal,
        notas: movForm.notas.trim() || '',
        usuario: user?.nombre_completo || 'Administración'
      });

      toast.success(`${movTipo === 'Ingreso' ? '✅ Ingreso' : '💸 Egreso'} registrado exitosamente`);
      setIsMovModalOpen(false);
      setMovForm({
        categoria: movTipo === 'Ingreso' ? CATEGORIAS_INGRESOS_DEFAULT[0] : CATEGORIAS_GASTOS_DEFAULT[0],
        concepto: '',
        monto: '',
        metodo_pago: 'Efectivo',
        id_cuenta_bancaria: '',
        referencia_bancaria: '',
        numero_comprobante: '',
        beneficiario: '',
        sucursal: 'SUC-01',
        notas: ''
      });
    } catch (err) {
      toast.error('Error al guardar movimiento: ' + err.message);
    }
  };

  // Anular Movimiento Manual
  const handleDeleteManualMov = async (id, concepto) => {
    if (!window.confirm(`¿Está seguro de anular el movimiento contable "${concepto}"?`)) return;
    try {
      await remove(ref(rtdb, `movimientos_contables/${id}`));
      toast.success('Movimiento contable anulado');
    } catch (err) {
      toast.error('Error al anular: ' + err.message);
    }
  };

  // Guardar Abono CxP
  const handleAbonarCxP = async (e) => {
    e.preventDefault();
    const monto = Number(abonoForm.monto);
    if (monto <= 0) return toast.error('El monto debe ser mayor a 0');
    if (monto > abonoModal.saldo_pendiente) return toast.error('El abono no puede superar el saldo pendiente');

    const esMetodoBancario = abonoForm.metodo_pago === 'Transferencia' || abonoForm.metodo_pago === 'Cheque';
    if (esMetodoBancario && !abonoForm.id_cuenta_bancaria && cuentasBancarias.length > 0) {
      return toast.error('Seleccione la cuenta bancaria de origen para el pago');
    }

    try {
      const nowIso = new Date().toISOString();
      const cuentaAfectada = cuentasBancarias.find(c => c.id === abonoForm.id_cuenta_bancaria);

      // Si sale de banco, descontar saldo bancario y registrar movimiento bancario
      if (cuentaAfectada && esMetodoBancario) {
        const saldoAnt = Number(cuentaAfectada.saldo_actual) || 0;
        const saldoPost = saldoAnt - monto;

        await runTransaction(ref(rtdb, `cuentas_bancarias/${cuentaAfectada.id}/saldo_actual`), (cur) => {
          return (Number(cur) || 0) - monto;
        });

        const movBancarioRef = push(ref(rtdb, 'movimientos_bancarios'));
        await set(movBancarioRef, {
          id_cuenta: cuentaAfectada.id,
          nombre_cuenta: cuentaAfectada.alias,
          banco: cuentaAfectada.banco,
          moneda: cuentaAfectada.moneda,
          fecha: nowIso,
          tipo: 'Egreso',
          razon_movimiento: 'Pago a Proveedor (CxP)',
          concepto: `Abono a Factura ${abonoModal.numero_factura || ''} (${proveedoresMap[abonoModal.id_proveedor] || 'Proveedor'})`,
          monto: monto,
          referencia_bancaria: abonoForm.comprobante?.trim() || abonoModal.numero_factura || 'N/A',
          comprobante_relacionado: abonoModal.numero_factura || 'N/A',
          saldo_anterior: saldoAnt,
          saldo_posterior: saldoPost,
          beneficiario_o_depositante: proveedoresMap[abonoModal.id_proveedor] || 'Proveedor',
          usuario: user?.nombre_completo || 'Administración',
          sucursal: abonoModal.sucursal || 'SUC-01',
          notas: `Pago de factura por CxP. Observación: ${abonoForm.observacion || 'Ninguna'}`
        });
      }

      // Actualizar CxP
      const cxpRef = ref(rtdb, `cxp/${abonoModal.id}`);
      await runTransaction(cxpRef, (currentData) => {
        if (!currentData) return currentData;
        const nuevoSaldo = currentData.saldo_pendiente - monto;
        currentData.saldo_pendiente = nuevoSaldo;
        if (nuevoSaldo <= 0) {
          currentData.estado = 'Pagado';
        }
        if (!currentData.historial_abonos) currentData.historial_abonos = [];
        currentData.historial_abonos.push({
          fecha: nowIso,
          monto: monto,
          metodo_pago: abonoForm.metodo_pago,
          id_cuenta_bancaria: cuentaAfectada ? cuentaAfectada.id : null,
          nombre_cuenta_bancaria: cuentaAfectada ? cuentaAfectada.alias : null,
          comprobante: abonoForm.comprobante.trim() || 'N/A'
        });
        return currentData;
      });

      // Registrar Egreso en el Libro Contable
      const movRef = push(ref(rtdb, 'movimientos_contables'));
      await set(movRef, {
        fecha: nowIso,
        tipo: 'Egreso',
        categoria: 'Pago a Proveedor (CxP)',
        concepto: `Abono a Factura ${abonoModal.numero_factura || ''} (${proveedoresMap[abonoModal.id_proveedor] || 'Proveedor'})`,
        monto: monto,
        metodo_pago: abonoForm.metodo_pago,
        id_cuenta_bancaria: cuentaAfectada ? cuentaAfectada.id : null,
        nombre_cuenta_bancaria: cuentaAfectada ? cuentaAfectada.alias : null,
        numero_comprobante: abonoForm.comprobante.trim() || abonoModal.numero_factura || 'N/A',
        beneficiario: proveedoresMap[abonoModal.id_proveedor] || 'Proveedor',
        sucursal: abonoModal.sucursal || 'SUC-01',
        id_referencia: abonoModal.id,
        usuario: user?.nombre_completo || 'Administración'
      });

      toast.success('Pago a proveedor registrado y asentado en contabilidad');
      setAbonoModal(null);
      setAbonoForm({ monto: '', metodo_pago: 'Efectivo', comprobante: '', observacion: '' });
    } catch (err) {
      toast.error('Error al registrar pago: ' + err.message);
    }
  };

  // Crear Nueva Factura CxP
  const handleSaveNewCxp = async (e) => {
    e.preventDefault();
    if (!newCxpForm.id_proveedor || !newCxpForm.numero_factura || !newCxpForm.monto_total) {
      return toast.error('Complete todos los campos requeridos');
    }

    try {
      const cxpRef = push(ref(rtdb, 'cxp'));
      const fechaEmis = newCxpForm.fecha_emision || new Date().toISOString().split('T')[0];
      const fechaVenc = newCxpForm.fecha_vencimiento || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
      const montoTotal = Number(newCxpForm.monto_total);

      await set(cxpRef, {
        id_proveedor: newCxpForm.id_proveedor,
        numero_factura: newCxpForm.numero_factura.trim(),
        fecha_emision: new Date(fechaEmis).toISOString(),
        fecha_vencimiento: new Date(fechaVenc).toISOString(),
        monto_total: montoTotal,
        saldo_pendiente: montoTotal,
        estado: 'Pendiente',
        sucursal: newCxpForm.sucursal
      });

      toast.success('Cuenta por pagar a proveedor creada');
      setIsNewCxpModalOpen(false);
      setNewCxpForm({
        id_proveedor: '', numero_factura: '', monto_total: '',
        fecha_emision: new Date().toISOString().split('T')[0], fecha_vencimiento: '', sucursal: 'SUC-01'
      });
    } catch (err) {
      toast.error('Error al crear CxP: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* ENCABEZADO PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2.5">
            <Landmark className="text-blue-700" size={28} />
            Módulo de Contabilidad y Finanzas
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Libro diario de ingresos, egresos, gastos operativos y pagos a proveedores (CxP).
          </p>
        </div>

        {/* ACCIONES RÁPIDAS DE CAJA */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => {
              setMovTipo('Ingreso');
              setMovForm(prev => ({ ...prev, categoria: CATEGORIAS_INGRESOS_DEFAULT[0] }));
              setIsMovModalOpen(true);
            }}
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-emerald-100 flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Plus size={18} />
            + Registrar Entrada
          </button>

          <button
            onClick={() => {
              setMovTipo('Egreso');
              setMovForm(prev => ({ ...prev, categoria: CATEGORIAS_GASTOS_DEFAULT[0] }));
              setIsMovModalOpen(true);
            }}
            className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md shadow-rose-100 flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Minus size={18} />
            - Registrar Salida / Gasto
          </button>
        </div>
      </div>

      {/* TARJETAS DE KPIS FINANCIEROS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Ingresos */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ArrowUpRight size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-500 uppercase">Ingresos ({filtroPeriodo})</p>
            <h3 className="text-2xl font-black text-gray-900 truncate">
              C$ {totalIngresos.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Ventas y cobros</p>
          </div>
        </div>

        {/* Total Egresos */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <ArrowDownRight size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-500 uppercase">Egresos ({filtroPeriodo})</p>
            <h3 className="text-2xl font-black text-gray-900 truncate">
              C$ {totalEgresos.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-rose-600 font-semibold mt-0.5">Gastos y pagos</p>
          </div>
        </div>

        {/* Flujo Neto */}
        <div className={`bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4 ${flujoNeto >= 0 ? 'border-emerald-200' : 'border-rose-200'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${flujoNeto >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            <DollarSign size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-500 uppercase">Flujo Neto / Balance</p>
            <h3 className={`text-2xl font-black truncate ${flujoNeto >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              C$ {flujoNeto.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${flujoNeto >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {flujoNeto >= 0 ? 'Superávit Operativo' : 'Déficit del Período'}
            </span>
          </div>
        </div>

        {/* CxP Pendiente a Proveedores */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <CreditCard size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-500 uppercase">CxP Pendiente</p>
            <h3 className="text-2xl font-black text-gray-900 truncate">
              C$ {totalDeudaCxP.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Deuda a proveedores</p>
          </div>
        </div>

      </div>

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('flujo')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'flujo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <FileText size={16} />
          Libro Diario & Flujo de Caja
        </button>

        <button
          onClick={() => setActiveTab('bancos')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'bancos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Landmark size={16} />
          Cuentas Bancarias & Tesorería
          {cuentasBancarias.length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {cuentasBancarias.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('apertura')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'apertura' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Scale size={16} />
          Asiento Inicial de Apertura
          {asientoApertura ? (
            <span className="bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
              ✓
            </span>
          ) : (
            <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
              !
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cxp')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'cxp' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <CreditCard size={16} />
          Cuentas por Pagar (CxP)
          {totalDeudaCxP > 0 && (
            <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full font-bold">
              C$ {totalDeudaCxP.toFixed(0)}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('resultados')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'resultados' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <PieChart size={16} />
          Estado de Resultados
        </button>

        <button
          onClick={() => setActiveTab('categorias')}
          className={`px-4 py-2.5 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${activeTab === 'categorias' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Tag size={16} />
          Categorías de Gastos
        </button>
      </div>

      {/* ================= TAB 1: LIBRO DIARIO & FLUJO DE CAJA ================= */}
      {activeTab === 'flujo' && (
        <div className="space-y-4">
          
          {/* BARRA DE FILTROS */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto flex-1">
              {/* Buscador */}
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Buscar concepto, factura, beneficiario..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              </div>

              {/* Filtro Período */}
              <select
                value={filtroPeriodo}
                onChange={e => setFiltroPeriodo(e.target.value)}
                className="border border-gray-200 bg-gray-50 p-2 rounded-xl text-xs font-bold text-gray-700 outline-none"
              >
                <option value="hoy">Hoy</option>
                <option value="semana">Últimos 7 días</option>
                <option value="mes">Este Mes</option>
                <option value="año">Este Año</option>
                <option value="todo">Todo el Histórico</option>
              </select>

              {/* Filtro Tipo */}
              <select
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
                className="border border-gray-200 bg-gray-50 p-2 rounded-xl text-xs font-bold text-gray-700 outline-none"
              >
                <option value="Todos">Todos los Movimientos</option>
                <option value="Ingreso">Solo Entradas (+)</option>
                <option value="Egreso">Solo Salidas (-)</option>
              </select>

              {/* Filtro Método */}
              <select
                value={filtroMetodo}
                onChange={e => setFiltroMetodo(e.target.value)}
                className="border border-gray-200 bg-gray-50 p-2 rounded-xl text-xs font-bold text-gray-700 outline-none"
              >
                <option value="Todos">Todos los Métodos</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Tarjeta">Tarjeta / POS</option>
                <option value="Cheque">Cheque</option>
              </select>

              {/* Filtro Sucursal */}
              <select
                value={filtroSucursal}
                onChange={e => setFiltroSucursal(e.target.value)}
                className="border border-gray-200 bg-gray-50 p-2 rounded-xl text-xs font-bold text-gray-700 outline-none"
              >
                <option value="Todas">Todas las Sucursales</option>
                <option value="SUC-01">Sucursal Principal (SUC-01)</option>
                <option value="SUC-02">Sucursal Norte (SUC-02)</option>
              </select>
            </div>

            <div className="text-xs text-gray-400 font-bold whitespace-nowrap">
              {filteredTransactions.length} asientos encontrados
            </div>
          </div>

          {/* TABLA DEL LIBRO DIARIO */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100 text-xs uppercase">
                  <tr>
                    <th className="p-3.5">Fecha y Hora</th>
                    <th className="p-3.5 text-center">Tipo</th>
                    <th className="p-3.5">Categoría</th>
                    <th className="p-3.5">Concepto / Descripción</th>
                    <th className="p-3.5">Comprobante</th>
                    <th className="p-3.5">Método</th>
                    <th className="p-3.5">Sucursal</th>
                    <th className="p-3.5 text-right">Monto</th>
                    <th className="p-3.5">Usuario</th>
                    <th className="p-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-gray-400 font-medium">
                        Cargando libro diario contable...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-gray-400 font-medium">
                        No hay movimientos registrados para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t) => {
                      const isIngreso = t.tipo === 'Ingreso';
                      const fechaObj = new Date(t.fecha);
                      const fechaFmt = isNaN(fechaObj.getTime()) ? t.fecha : fechaObj.toLocaleString('es-NI', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      });

                      return (
                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3.5 text-xs text-gray-600 font-mono">
                            {fechaFmt}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full ${isIngreso ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                              {isIngreso ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                              {isIngreso ? 'Entrada' : 'Salida'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                              {t.categoria}
                            </span>
                          </td>
                          <td className="p-3.5 font-medium text-gray-800 max-w-xs truncate" title={t.concepto}>
                            {t.concepto}
                          </td>
                          <td className="p-3.5 font-mono text-xs text-gray-500">
                            {t.comprobante}
                          </td>
                          <td className="p-3.5 text-xs font-semibold text-gray-600">
                            {t.metodo_pago}
                          </td>
                          <td className="p-3.5 text-xs text-gray-500">
                            {t.sucursal}
                          </td>
                          <td className={`p-3.5 text-right font-black text-sm ${isIngreso ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isIngreso ? '+ ' : '- '}C$ {t.monto.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3.5 text-xs text-gray-500">
                            {t.usuario}
                          </td>
                          <td className="p-3.5 text-center">
                            {t.esManual ? (
                              <button
                                onClick={() => handleDeleteManualMov(t.id, t.concepto)}
                                className="text-gray-400 hover:text-rose-600 p-1 rounded transition-colors"
                                title="Anular este asiento contable manual"
                              >
                                <Trash2 size={15} />
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-300 font-mono" title="Registro automático del sistema">Auto</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: CUENTAS POR PAGAR (CxP) ================= */}
      {activeTab === 'cxp' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                <CreditCard className="text-rose-500" size={20} />
                Gestión de Cuentas por Pagar a Proveedores
              </h2>
              <p className="text-xs text-gray-500">
                Registra compras a crédito, facturas por pagar y abonos con impacto directo en caja.
              </p>
            </div>
            <button
              onClick={() => setIsNewCxpModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Plus size={16} /> Nueva Factura por Pagar
            </button>
          </div>

          {/* TABLA DE CxP */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100 text-xs uppercase">
                  <tr>
                    <th className="p-3.5">Proveedor</th>
                    <th className="p-3.5">Factura #</th>
                    <th className="p-3.5">Emisión</th>
                    <th className="p-3.5">Vencimiento</th>
                    <th className="p-3.5 text-right">Monto Original</th>
                    <th className="p-3.5 text-right">Saldo Pendiente</th>
                    <th className="p-3.5 text-center">Estado</th>
                    <th className="p-3.5 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cxpList.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-gray-400">
                        No hay cuentas por pagar registradas.
                      </td>
                    </tr>
                  ) : (
                    cxpList.map(item => {
                      const nombreProv = proveedoresMap[item.id_proveedor] || 'Proveedor Desconocido';
                      const isPendiente = item.estado === 'Pendiente';
                      const fechaVenc = new Date(item.fecha_vencimiento);
                      const isVencida = isPendiente && fechaVenc < new Date();

                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3.5 font-bold text-gray-800">
                            {nombreProv}
                          </td>
                          <td className="p-3.5 font-mono text-xs text-blue-600 font-bold">
                            {item.numero_factura}
                          </td>
                          <td className="p-3.5 text-xs text-gray-500">
                            {new Date(item.fecha_emision).toLocaleDateString('es-NI')}
                          </td>
                          <td className="p-3.5 text-xs">
                            <span className={isVencida ? 'text-rose-600 font-bold flex items-center gap-1' : 'text-gray-500'}>
                              {isVencida && <AlertCircle size={12} />}
                              {fechaVenc.toLocaleDateString('es-NI')}
                            </span>
                          </td>
                          <td className="p-3.5 text-right font-medium text-gray-600">
                            C$ {Number(item.monto_total || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3.5 text-right font-black text-rose-600">
                            C$ {Number(item.saldo_pendiente || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isPendiente ? (isVencida ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800') : 'bg-green-100 text-green-800'}`}>
                              {isPendiente ? (isVencida ? 'Vencida' : 'Pendiente') : 'Pagada'}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            {isPendiente && (
                              <button
                                onClick={() => {
                                  setAbonoModal(item);
                                  setAbonoForm({
                                    monto: item.saldo_pendiente,
                                    metodo_pago: 'Efectivo',
                                    comprobante: '',
                                    observacion: ''
                                  });
                                }}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                              >
                                Abonar / Pagar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: ESTADO DE RESULTADOS ================= */}
      {activeTab === 'resultados' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm max-w-3xl mx-auto space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <PieChart className="text-blue-600" size={24} />
                Estado de Resultados y Rendimiento Operativo
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Período: <span className="font-bold text-gray-700 capitalize">{filtroPeriodo}</span> • Sucursal: <span className="font-bold text-gray-700">{filtroSucursal}</span>
              </p>
            </div>

            {/* SECCIÓN INGRESOS */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl">
                <span>(+) Ingresos Operacionales Totales</span>
                <span>C$ {totalIngresos.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-4 pr-2 space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>• Facturación Ventas POS y Servicios</span>
                  <span className="font-mono">C$ {filteredTransactions.filter(t => t.categoria.includes('POS')).reduce((s, t) => s + t.monto, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Cobros y Recuperación de Créditos (CxC)</span>
                  <span className="font-mono">C$ {filteredTransactions.filter(t => t.categoria.includes('CxC')).reduce((s, t) => s + t.monto, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Otros Ingresos y Aportes</span>
                  <span className="font-mono">C$ {filteredTransactions.filter(t => t.tipo === 'Ingreso' && !t.categoria.includes('POS') && !t.categoria.includes('CxC')).reduce((s, t) => s + t.monto, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* SECCIÓN EGRESOS */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold text-rose-800 bg-rose-50 p-2.5 rounded-xl">
                <span>(-) Costos, Compras y Gastos Operativos</span>
                <span>C$ {totalEgresos.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pl-4 pr-2 space-y-1.5 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>• Pagos a Proveedores y Repuestos (CxP & Compras)</span>
                  <span className="font-mono">C$ {filteredTransactions.filter(t => t.categoria.includes('Proveedor') || t.categoria.includes('Compra')).reduce((s, t) => s + t.monto, 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Gastos Operativos y Servicios Básicos</span>
                  <span className="font-mono">C$ {filteredTransactions.filter(t => t.tipo === 'Egreso' && !t.categoria.includes('Proveedor') && !t.categoria.includes('Compra')).reduce((s, t) => s + t.monto, 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* UTILIDAD NETA FINAL */}
            <div className={`p-4 rounded-xl border flex justify-between items-center ${flujoNeto >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <div>
                <h3 className="font-black text-base text-gray-900">(=) Resultado Neto / Utilidad del Período</h3>
                <p className="text-xs text-gray-500">Margen neto operativo después de egresos</p>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-black ${flujoNeto >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  C$ {flujoNeto.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {totalIngresos > 0 && (
                  <p className="text-[11px] font-bold text-gray-500">
                    Margen: {((flujoNeto / totalIngresos) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ================= TAB 4: CATEGORÍAS DE GASTOS ================= */}
      {activeTab === 'categorias' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm max-w-4xl mx-auto space-y-4">
          <div>
            <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
              <Tag className="text-blue-600" size={20} />
              Catálogo de Cuentas y Categorías Contables
            </h2>
            <p className="text-xs text-gray-500">
              Clasificación estructurada para control analítico de las entradas y salidas de capital.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div>
              <h3 className="font-bold text-rose-700 text-sm mb-3 flex items-center gap-1.5 border-b pb-2">
                <Minus size={16} /> Categorías de Egresos y Gastos
              </h3>
              <ul className="space-y-2">
                {CATEGORIAS_GASTOS_DEFAULT.map((cat, idx) => (
                  <li key={idx} className="p-2.5 bg-gray-50 rounded-xl text-xs font-medium text-gray-700 flex items-center justify-between border border-gray-100">
                    <span>{cat}</span>
                    <span className="text-[10px] text-gray-400 font-mono">G-{idx+1}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-emerald-700 text-sm mb-3 flex items-center gap-1.5 border-b pb-2">
                <Plus size={16} /> Categorías de Ingresos y Entradas
              </h3>
              <ul className="space-y-2">
                {CATEGORIAS_INGRESOS_DEFAULT.map((cat, idx) => (
                  <li key={idx} className="p-2.5 bg-gray-50 rounded-xl text-xs font-medium text-gray-700 flex items-center justify-between border border-gray-100">
                    <span>{cat}</span>
                    <span className="text-[10px] text-gray-400 font-mono">I-{idx+1}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: CUENTAS BANCARIAS Y TESORERÍA ================= */}
      {activeTab === 'bancos' && (
        <BancosManager
          cuentasBancarias={cuentasBancarias}
          movimientosBancarios={movimientosBancarios}
          user={user}
        />
      )}

      {/* ================= TAB 4: ASIENTO INICIAL DE APERTURA ================= */}
      {activeTab === 'apertura' && (
        <AsientoApertura
          asientoApertura={asientoApertura}
          cuentasBancarias={cuentasBancarias}
          inventario={allInventory['SUC-01'] || {}}
          allInventory={allInventory}
          cxpList={cxpList}
          cxcList={cxcList}
          user={user}
        />
      )}

      {/* ================= MODAL NUEVO MOVIMIENTO (ENTRADA / SALIDA) ================= */}
      {isMovModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className={`p-4 sm:p-5 border-b flex justify-between items-center shrink-0 ${movTipo === 'Ingreso' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-rose-50 border-rose-100 text-rose-900'}`}>
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl text-white ${movTipo === 'Ingreso' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                  {movTipo === 'Ingreso' ? <Plus size={20} /> : <Minus size={20} />}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">
                    {movTipo === 'Ingreso' ? 'Registrar Entrada / Ingreso' : 'Registrar Salida / Gasto'}
                  </h2>
                  <p className="text-xs opacity-75">Asiento directo en el libro diario contable</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsMovModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white/50 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveMovimiento} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoría *</label>
                  <select
                    value={movForm.categoria}
                    onChange={e => setMovForm({ ...movForm, categoria: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(movTipo === 'Ingreso' ? CATEGORIAS_INGRESOS_DEFAULT : CATEGORIAS_GASTOS_DEFAULT).map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Concepto / Motivo *</label>
                  <input
                    required
                    type="text"
                    placeholder="Ej: Pago de recibo de luz comercial, Compra de café, etc."
                    value={movForm.concepto}
                    onChange={e => setMovForm({ ...movForm, concepto: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Monto (C$) *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={movForm.monto}
                      onChange={e => setMovForm({ ...movForm, monto: e.target.value })}
                      className="w-full border border-gray-200 p-2.5 rounded-xl text-lg font-black text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Método de Pago</label>
                    <select
                      value={movForm.metodo_pago}
                      onChange={e => setMovForm({ ...movForm, metodo_pago: e.target.value })}
                      className="w-full border border-gray-200 p-2.5 rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia Bancaria</option>
                      <option value="Tarjeta">Tarjeta / POS</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                {/* VINCULACIÓN CON CUENTA BANCARIA */}
                {(movForm.metodo_pago === 'Transferencia' || movForm.metodo_pago === 'Tarjeta' || movForm.metodo_pago === 'Cheque') && (
                  <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 space-y-2.5 animate-in fade-in">
                    <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                      <Landmark size={14} /> Control Bancario Afectado:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Cuenta Bancaria *</label>
                        <select
                          required
                          value={movForm.id_cuenta_bancaria}
                          onChange={e => setMovForm({ ...movForm, id_cuenta_bancaria: e.target.value })}
                          className="w-full border border-gray-200 p-2 rounded-lg bg-white text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Seleccionar Banco --</option>
                          {cuentasBancarias.map(c => (
                            <option key={c.id} value={c.id}>{c.alias} ({c.banco} - {c.moneda})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Referencia / Minuta / Voucher *</label>
                        <input
                          required
                          type="text"
                          placeholder="Ej: REF-9921 / VOUCHER-4"
                          value={movForm.referencia_bancaria}
                          onChange={e => setMovForm({ ...movForm, referencia_bancaria: e.target.value })}
                          className="w-full border border-gray-200 p-2 rounded-lg bg-white text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Comprobante / Recibo #</label>
                    <input
                      type="text"
                      placeholder="Ej: REC-1029 / FACT-88"
                      value={movForm.numero_comprobante}
                      onChange={e => setMovForm({ ...movForm, numero_comprobante: e.target.value })}
                      className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sucursal</label>
                    <select
                      value={movForm.sucursal}
                      onChange={e => setMovForm({ ...movForm, sucursal: e.target.value })}
                      className="w-full border border-gray-200 p-2.5 rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="SUC-01">Sucursal Principal (SUC-01)</option>
                      <option value="SUC-02">Sucursal Norte (SUC-02)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Beneficiario / Proveedor / Persona</label>
                  <input
                    type="text"
                    placeholder="Ej: Disnorte-Dissur, Enacal, Don Juan..."
                    value={movForm.beneficiario}
                    onChange={e => setMovForm({ ...movForm, beneficiario: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMovModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md transition-all active:scale-95 ${movTipo === 'Ingreso' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'}`}
                >
                  Guardar Asiento Contable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL ABONAR A FACTURA CxP ================= */}
      {abonoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-rose-50/50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-800">Abonar a Factura de Proveedor</h3>
                <p className="text-xs text-gray-500">
                  {proveedoresMap[abonoModal.id_proveedor] || 'Proveedor'} • Factura {abonoModal.numero_factura}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setAbonoModal(null)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAbonarCxP} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase">Saldo Pendiente:</span>
                  <span className="text-lg font-black text-rose-600 font-mono">
                    C$ {Number(abonoModal.saldo_pendiente).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Monto a Pagar (C$) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    max={abonoModal.saldo_pendiente}
                    min="0.01"
                    value={abonoForm.monto}
                    onChange={e => setAbonoForm({ ...abonoForm, monto: e.target.value })}
                    className="w-full border p-2.5 rounded-xl font-black text-xl text-gray-800 outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Método de Pago</label>
                  <select
                    value={abonoForm.metodo_pago}
                    onChange={e => setAbonoForm({ ...abonoForm, metodo_pago: e.target.value })}
                    className="w-full border p-2.5 rounded-xl bg-gray-50 text-sm font-medium outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                {(abonoForm.metodo_pago === 'Transferencia' || abonoForm.metodo_pago === 'Cheque') && (
                  <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-100 space-y-2 animate-in fade-in">
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Cuenta Bancaria de Origen (Sale el dinero) *
                    </label>
                    <select
                      required
                      value={abonoForm.id_cuenta_bancaria}
                      onChange={e => setAbonoForm({ ...abonoForm, id_cuenta_bancaria: e.target.value })}
                      className="w-full border border-gray-200 p-2 rounded-lg bg-white text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="">-- Seleccionar Banco de Origen --</option>
                      {cuentasBancarias.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.alias} ({c.banco} - Saldo: {c.moneda} {Number(c.saldo_actual || 0).toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Recibo de Caja / Minuta #</label>
                  <input
                    type="text"
                    placeholder="Ej: REC-9923"
                    value={abonoForm.comprobante}
                    onChange={e => setAbonoForm({ ...abonoForm, comprobante: e.target.value })}
                    className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setAbonoModal(null)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-rose-200 transition-all active:scale-95"
                >
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL NUEVA FACTURA CxP ================= */}
      {isNewCxpModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
              <h3 className="text-base font-bold text-gray-800">Registrar Factura por Pagar a Proveedor</h3>
              <button 
                type="button" 
                onClick={() => setIsNewCxpModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNewCxp} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Proveedor *</label>
                  <TokenizedSearchSelect
                    options={proveedoresList.map(p => ({
                      id: p.id,
                      value: p.id,
                      label: p.nombre,
                      sublabel: [p.telefono1, p.contacto ? `Contacto: ${p.contacto}` : '', p.ruc ? `RUC: ${p.ruc}` : ''].filter(Boolean).join(' • '),
                      searchFields: [p.nombre, p.telefono1, p.telefono2, p.contacto, p.ruc, p.direccion]
                    }))}
                    value={newCxpForm.id_proveedor}
                    onChange={sel => setNewCxpForm({ ...newCxpForm, id_proveedor: sel ? (sel.id || sel.value) : '' })}
                    placeholder="Buscar proveedor por nombre, RUC o teléfono..."
                    icon={Building}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Número de Factura *</label>
                  <input
                    required
                    type="text"
                    placeholder="Ej: F-10293"
                    value={newCxpForm.numero_factura}
                    onChange={e => setNewCxpForm({ ...newCxpForm, numero_factura: e.target.value })}
                    className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Monto Total Factura (C$) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={newCxpForm.monto_total}
                    onChange={e => setNewCxpForm({ ...newCxpForm, monto_total: e.target.value })}
                    className="w-full border p-2.5 rounded-xl font-black text-xl text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha Emisión</label>
                    <input
                      type="date"
                      value={newCxpForm.fecha_emision}
                      onChange={e => setNewCxpForm({ ...newCxpForm, fecha_emision: e.target.value })}
                      className="w-full border p-2 rounded-xl text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha Vence</label>
                    <input
                      type="date"
                      value={newCxpForm.fecha_vencimiento}
                      onChange={e => setNewCxpForm({ ...newCxpForm, fecha_vencimiento: e.target.value })}
                      className="w-full border p-2 rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewCxpModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-blue-200 transition-all active:scale-95"
                >
                  Guardar Factura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
