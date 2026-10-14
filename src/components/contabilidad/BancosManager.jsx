import React, { useState } from 'react';
import { ref, push, set, runTransaction } from 'firebase/database';
import { rtdb } from '../../firebase';
import { 
  Building2, Plus, ArrowRightLeft, DollarSign, CreditCard, 
  Search, Calendar, Filter, ArrowUpRight, ArrowDownRight, 
  CheckCircle2, AlertCircle, FileText, Printer, Percent,
  Sparkles, Wallet, Landmark, ShieldCheck, Tag, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

export const BANCOS_NICARAGUA = [
  'BAC Credomatic',
  'Banco de la Producción (Banpro)',
  'Banco LAFISE Bancentro',
  'BDF (Banco de Finanzas)',
  'Banco Avanz',
  'Banco Ficohsa',
  'Caja General / Caja Chica Central',
  'Otro Banco'
];

export default function BancosManager({ cuentasBancarias = [], movimientosBancarios = [], user }) {
  // Filtros
  const [selectedCuentaFilter, setSelectedCuentaFilter] = useState('Todas');
  const [tipoMovFilter, setTipoMovFilter] = useState('Todos');
  const [razonFilter, setRazonFilter] = useState('Todas');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [isCuentaModalOpen, setIsCuentaModalOpen] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState(null);
  const [cuentaForm, setCuentaForm] = useState({
    banco: BANCOS_NICARAGUA[0],
    alias: '',
    numero_cuenta: '',
    tipo_cuenta: 'Monetaria / Corriente',
    moneda: 'NIO',
    saldo_inicial: '',
    sucursal: 'Todas',
    recibir_tarjetas_pos: false,
    recibir_transferencias_pos: false,
    titular: 'Taller El Mingo',
    notas: ''
  });

  // Modal Depósito / Remesa de Efectivo a Banco
  const [isRemesaModalOpen, setIsRemesaModalOpen] = useState(false);
  const [remesaForm, setRemesaForm] = useState({
    id_cuenta_destino: '',
    monto: '',
    minuta_deposito: '',
    fecha: new Date().toISOString().split('T')[0],
    depositante: user?.nombre_completo || 'Administración',
    sucursal_origen: 'SUC-01',
    notas: ''
  });

  // Modal Transferencia entre Cuentas
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    id_cuenta_origen: '',
    id_cuenta_destino: '',
    monto: '',
    referencia_bancaria: '',
    fecha: new Date().toISOString().split('T')[0],
    motivo: 'Traslado de fondos operativos',
    notas: ''
  });

  // Modal Comisión Bancaria / Datáfono POS
  const [isComisionModalOpen, setIsComisionModalOpen] = useState(false);
  const [comisionForm, setComisionForm] = useState({
    id_cuenta: '',
    monto: '',
    referencia_liquidacion: '',
    lote_pos: '',
    fecha: new Date().toISOString().split('T')[0],
    concepto: 'Comisión bancaria por ventas con tarjeta POS',
    notas: ''
  });

  // Abrir Modal de Crear / Editar Cuenta
  const handleOpenCuentaModal = (cuenta = null) => {
    if (cuenta) {
      setEditingCuenta(cuenta);
      setCuentaForm({
        banco: cuenta.banco || BANCOS_NICARAGUA[0],
        alias: cuenta.alias || '',
        numero_cuenta: cuenta.numero_cuenta || '',
        tipo_cuenta: cuenta.tipo_cuenta || 'Monetaria / Corriente',
        moneda: cuenta.moneda || 'NIO',
        saldo_inicial: cuenta.saldo_inicial !== undefined ? cuenta.saldo_inicial : '',
        sucursal: cuenta.sucursal || 'Todas',
        recibir_tarjetas_pos: !!cuenta.recibir_tarjetas_pos,
        recibir_transferencias_pos: !!cuenta.recibir_transferencias_pos,
        titular: cuenta.titular || 'Taller El Mingo',
        notas: cuenta.notas || ''
      });
    } else {
      setEditingCuenta(null);
      setCuentaForm({
        banco: BANCOS_NICARAGUA[0],
        alias: '',
        numero_cuenta: '',
        tipo_cuenta: 'Monetaria / Corriente',
        moneda: 'NIO',
        saldo_inicial: '',
        sucursal: 'Todas',
        recibir_tarjetas_pos: cuentasBancarias.length === 0,
        recibir_transferencias_pos: cuentasBancarias.length === 0,
        titular: 'Taller El Mingo',
        notas: ''
      });
    }
    setIsCuentaModalOpen(true);
  };

  // Guardar Cuenta Bancaria
  const handleSaveCuenta = async (e) => {
    e.preventDefault();
    if (!cuentaForm.alias.trim()) return toast.error('Ingrese un nombre o alias para la cuenta');
    if (!cuentaForm.numero_cuenta.trim()) return toast.error('Ingrese el número de cuenta');

    try {
      const saldoInicialNum = Number(cuentaForm.saldo_inicial) || 0;

      if (editingCuenta) {
        // Actualizar cuenta existente
        const cuentaRef = ref(rtdb, `cuentas_bancarias/${editingCuenta.id}`);
        await set(cuentaRef, {
          ...editingCuenta,
          banco: cuentaForm.banco,
          alias: cuentaForm.alias.trim(),
          numero_cuenta: cuentaForm.numero_cuenta.trim(),
          tipo_cuenta: cuentaForm.tipo_cuenta,
          moneda: cuentaForm.moneda,
          sucursal: cuentaForm.sucursal,
          recibir_tarjetas_pos: cuentaForm.recibir_tarjetas_pos,
          recibir_transferencias_pos: cuentaForm.recibir_transferencias_pos,
          titular: cuentaForm.titular.trim(),
          notas: cuentaForm.notas.trim()
        });
        toast.success('Cuenta bancaria actualizada');
      } else {
        // Nueva cuenta bancaria
        const newCuentaRef = push(ref(rtdb, 'cuentas_bancarias'));
        const newId = newCuentaRef.key;

        await set(newCuentaRef, {
          banco: cuentaForm.banco,
          alias: cuentaForm.alias.trim(),
          numero_cuenta: cuentaForm.numero_cuenta.trim(),
          tipo_cuenta: cuentaForm.tipo_cuenta,
          moneda: cuentaForm.moneda,
          saldo_inicial: saldoInicialNum,
          saldo_actual: saldoInicialNum,
          sucursal: cuentaForm.sucursal,
          recibir_tarjetas_pos: cuentaForm.recibir_tarjetas_pos,
          recibir_transferencias_pos: cuentaForm.recibir_transferencias_pos,
          titular: cuentaForm.titular.trim(),
          estado: 'Activa',
          fecha_creacion: new Date().toISOString(),
          notas: cuentaForm.notas.trim()
        });

        // Si se especificó un saldo inicial > 0, registrar el movimiento bancario inicial
        if (saldoInicialNum > 0) {
          const movBancarioRef = push(ref(rtdb, 'movimientos_bancarios'));
          await set(movBancarioRef, {
            id_cuenta: newId,
            nombre_cuenta: cuentaForm.alias.trim(),
            banco: cuentaForm.banco,
            moneda: cuentaForm.moneda,
            fecha: new Date().toISOString(),
            tipo: 'Ingreso',
            razon_movimiento: 'Asiento Inicial de Apertura',
            concepto: `Saldo inicial de apertura de cuenta (${cuentaForm.alias.trim()})`,
            monto: saldoInicialNum,
            referencia_bancaria: 'APERTURA-INICIAL',
            comprobante_relacionado: 'ASIENTO-INICIAL',
            saldo_anterior: 0,
            saldo_posterior: saldoInicialNum,
            beneficiario_o_depositante: cuentaForm.titular.trim(),
            usuario: user?.nombre_completo || 'Administración',
            sucursal: cuentaForm.sucursal,
            notas: 'Saldo inicial registrado al crear la cuenta bancaria.'
          });
        }

        toast.success('Cuenta bancaria creada exitosamente');
      }

      setIsCuentaModalOpen(false);
    } catch (err) {
      toast.error('Error al guardar cuenta bancaria: ' + err.message);
    }
  };

  // Guardar Depósito / Remesa de Efectivo a Banco
  const handleSaveRemesa = async (e) => {
    e.preventDefault();
    const montoNum = Number(remesaForm.monto);
    if (!remesaForm.id_cuenta_destino) return toast.error('Seleccione la cuenta bancaria destino');
    if (!montoNum || montoNum <= 0) return toast.error('El monto debe ser mayor a 0');
    if (!remesaForm.minuta_deposito.trim()) return toast.error('Ingrese el número de boleta o minuta de depósito');

    const cuentaDestino = cuentasBancarias.find(c => c.id === remesaForm.id_cuenta_destino);
    if (!cuentaDestino) return toast.error('Cuenta bancaria no encontrada');

    try {
      const nowIso = new Date().toISOString();
      const fechaRegistro = remesaForm.fecha ? new Date(remesaForm.fecha).toISOString() : nowIso;
      const saldoAnterior = Number(cuentaDestino.saldo_actual) || 0;
      const saldoPosterior = saldoAnterior + montoNum;

      // 1. Aumentar saldo en la cuenta bancaria
      const cuentaRef = ref(rtdb, `cuentas_bancarias/${cuentaDestino.id}/saldo_actual`);
      await runTransaction(cuentaRef, (current) => {
        return (Number(current) || 0) + montoNum;
      });

      // 2. Registrar en movimientos bancarios
      const movBancarioRef = push(ref(rtdb, 'movimientos_bancarios'));
      await set(movBancarioRef, {
        id_cuenta: cuentaDestino.id,
        nombre_cuenta: cuentaDestino.alias,
        banco: cuentaDestino.banco,
        moneda: cuentaDestino.moneda,
        fecha: fechaRegistro,
        tipo: 'Ingreso',
        razon_movimiento: 'Depósito / Remesa de Caja',
        concepto: `Depósito en efectivo desde caja según minuta #${remesaForm.minuta_deposito.trim()}`,
        monto: montoNum,
        referencia_bancaria: remesaForm.minuta_deposito.trim(),
        comprobante_relacionado: `MINUTA-${remesaForm.minuta_deposito.trim()}`,
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior,
        beneficiario_o_depositante: remesaForm.depositante.trim(),
        usuario: user?.nombre_completo || 'Administración',
        sucursal: remesaForm.sucursal_origen,
        notas: remesaForm.notas.trim()
      });

      // 3. Registrar salida de efectivo en movimientos contables del libro diario
      const movContableRef = push(ref(rtdb, 'movimientos_contables'));
      await set(movContableRef, {
        fecha: fechaRegistro,
        tipo: 'Egreso',
        categoria: 'Remesa / Depósito de Efectivo a Banco',
        concepto: `Remesa de efectivo de caja a ${cuentaDestino.banco} (${cuentaDestino.alias}) - Minuta #${remesaForm.minuta_deposito.trim()}`,
        monto: montoNum,
        metodo_pago: 'Efectivo',
        numero_comprobante: remesaForm.minuta_deposito.trim(),
        beneficiario: cuentaDestino.banco,
        sucursal: remesaForm.sucursal_origen,
        id_cuenta_bancaria: cuentaDestino.id,
        notas: `Depositado por: ${remesaForm.depositante}. ${remesaForm.notas.trim()}`,
        usuario: user?.nombre_completo || 'Administración'
      });

      toast.success(`✨ Remesa de C$ ${montoNum.toLocaleString('es-NI', { minimumFractionDigits: 2 })} depositada en ${cuentaDestino.banco}`);
      setIsRemesaModalOpen(false);
      setRemesaForm({
        id_cuenta_destino: '',
        monto: '',
        minuta_deposito: '',
        fecha: new Date().toISOString().split('T')[0],
        depositante: user?.nombre_completo || 'Administración',
        sucursal_origen: 'SUC-01',
        notas: ''
      });
    } catch (err) {
      toast.error('Error al registrar remesa: ' + err.message);
    }
  };

  // Guardar Transferencia entre Cuentas Bancarias
  const handleSaveTransfer = async (e) => {
    e.preventDefault();
    const montoNum = Number(transferForm.monto);
    if (!transferForm.id_cuenta_origen || !transferForm.id_cuenta_destino) {
      return toast.error('Seleccione la cuenta de origen y destino');
    }
    if (transferForm.id_cuenta_origen === transferForm.id_cuenta_destino) {
      return toast.error('Las cuentas de origen y destino deben ser diferentes');
    }
    if (!montoNum || montoNum <= 0) return toast.error('El monto debe ser mayor a 0');
    if (!transferForm.referencia_bancaria.trim()) return toast.error('Ingrese el número de transferencia o referencia bancaria');

    const cuentaOrigen = cuentasBancarias.find(c => c.id === transferForm.id_cuenta_origen);
    const cuentaDestino = cuentasBancarias.find(c => c.id === transferForm.id_cuenta_destino);
    if (!cuentaOrigen || !cuentaDestino) return toast.error('Cuentas no encontradas');

    if ((Number(cuentaOrigen.saldo_actual) || 0) < montoNum) {
      if (!window.confirm(`⚠️ Advertencia: La cuenta origen tiene C$ ${Number(cuentaOrigen.saldo_actual || 0).toFixed(2)}, menor al monto a transferir (${montoNum.toFixed(2)}). ¿Desea proceder con saldo negativo?`)) {
        return;
      }
    }

    try {
      const nowIso = new Date().toISOString();
      const fechaRegistro = transferForm.fecha ? new Date(transferForm.fecha).toISOString() : nowIso;

      // 1. Descontar en Cuenta Origen
      const saldoAntOrigen = Number(cuentaOrigen.saldo_actual) || 0;
      const saldoPostOrigen = saldoAntOrigen - montoNum;
      await runTransaction(ref(rtdb, `cuentas_bancarias/${cuentaOrigen.id}/saldo_actual`), (cur) => {
        return (Number(cur) || 0) - montoNum;
      });

      // 2. Aumentar en Cuenta Destino
      const saldoAntDestino = Number(cuentaDestino.saldo_actual) || 0;
      const saldoPostDestino = saldoAntDestino + montoNum;
      await runTransaction(ref(rtdb, `cuentas_bancarias/${cuentaDestino.id}/saldo_actual`), (cur) => {
        return (Number(cur) || 0) + montoNum;
      });

      // 3. Registrar movimiento de egreso en cuenta origen
      const movOrigenRef = push(ref(rtdb, 'movimientos_bancarios'));
      await set(movOrigenRef, {
        id_cuenta: cuentaOrigen.id,
        nombre_cuenta: cuentaOrigen.alias,
        banco: cuentaOrigen.banco,
        moneda: cuentaOrigen.moneda,
        fecha: fechaRegistro,
        tipo: 'Egreso',
        razon_movimiento: 'Transferencia entre Cuentas',
        concepto: `Transferencia enviada hacia ${cuentaDestino.alias} (${cuentaDestino.banco}) - Ref: ${transferForm.referencia_bancaria.trim()}`,
        monto: montoNum,
        referencia_bancaria: transferForm.referencia_bancaria.trim(),
        comprobante_relacionado: `TRANSF-${transferForm.referencia_bancaria.trim()}`,
        saldo_anterior: saldoAntOrigen,
        saldo_posterior: saldoPostOrigen,
        id_cuenta_destino: cuentaDestino.id,
        nombre_cuenta_destino: cuentaDestino.alias,
        usuario: user?.nombre_completo || 'Administración',
        sucursal: 'Todas',
        notas: `${transferForm.motivo}. ${transferForm.notas.trim()}`
      });

      // 4. Registrar movimiento de ingreso en cuenta destino
      const movDestinoRef = push(ref(rtdb, 'movimientos_bancarios'));
      await set(movDestinoRef, {
        id_cuenta: cuentaDestino.id,
        nombre_cuenta: cuentaDestino.alias,
        banco: cuentaDestino.banco,
        moneda: cuentaDestino.moneda,
        fecha: fechaRegistro,
        tipo: 'Ingreso',
        razon_movimiento: 'Transferencia entre Cuentas',
        concepto: `Transferencia recibida desde ${cuentaOrigen.alias} (${cuentaOrigen.banco}) - Ref: ${transferForm.referencia_bancaria.trim()}`,
        monto: montoNum,
        referencia_bancaria: transferForm.referencia_bancaria.trim(),
        comprobante_relacionado: `TRANSF-${transferForm.referencia_bancaria.trim()}`,
        saldo_anterior: saldoAntDestino,
        saldo_posterior: saldoPostDestino,
        id_cuenta_destino: cuentaOrigen.id,
        nombre_cuenta_destino: cuentaOrigen.alias,
        usuario: user?.nombre_completo || 'Administración',
        sucursal: 'Todas',
        notas: `${transferForm.motivo}. ${transferForm.notas.trim()}`
      });

      toast.success(`⇆ Transferencia realizada exitosamente entre ${cuentaOrigen.alias} y ${cuentaDestino.alias}`);
      setIsTransferModalOpen(false);
      setTransferForm({
        id_cuenta_origen: '',
        id_cuenta_destino: '',
        monto: '',
        referencia_bancaria: '',
        fecha: new Date().toISOString().split('T')[0],
        motivo: 'Traslado de fondos operativos',
        notas: ''
      });
    } catch (err) {
      toast.error('Error al transferir fondos: ' + err.message);
    }
  };

  // Guardar Comisión Bancaria de POS
  const handleSaveComision = async (e) => {
    e.preventDefault();
    const montoNum = Number(comisionForm.monto);
    if (!comisionForm.id_cuenta) return toast.error('Seleccione la cuenta bancaria');
    if (!montoNum || montoNum <= 0) return toast.error('El monto de la comisión debe ser mayor a 0');
    if (!comisionForm.referencia_liquidacion.trim()) return toast.error('Ingrese la referencia o número de liquidación bancaria');

    const cuenta = cuentasBancarias.find(c => c.id === comisionForm.id_cuenta);
    if (!cuenta) return toast.error('Cuenta bancaria no encontrada');

    try {
      const nowIso = new Date().toISOString();
      const fechaRegistro = comisionForm.fecha ? new Date(comisionForm.fecha).toISOString() : nowIso;
      const saldoAnterior = Number(cuenta.saldo_actual) || 0;
      const saldoPosterior = saldoAnterior - montoNum;

      // 1. Descontar saldo en la cuenta bancaria
      await runTransaction(ref(rtdb, `cuentas_bancarias/${cuenta.id}/saldo_actual`), (cur) => {
        return (Number(cur) || 0) - montoNum;
      });

      // 2. Registrar en movimientos bancarios
      const movBancarioRef = push(ref(rtdb, 'movimientos_bancarios'));
      await set(movBancarioRef, {
        id_cuenta: cuenta.id,
        nombre_cuenta: cuenta.alias,
        banco: cuenta.banco,
        moneda: cuenta.moneda,
        fecha: fechaRegistro,
        tipo: 'Egreso',
        razon_movimiento: 'Comisión Bancaria / Datáfono',
        concepto: `${comisionForm.concepto.trim()} (Liq: ${comisionForm.referencia_liquidacion.trim()}${comisionForm.lote_pos ? ` • Lote: ${comisionForm.lote_pos.trim()}` : ''})`,
        monto: montoNum,
        referencia_bancaria: comisionForm.referencia_liquidacion.trim(),
        comprobante_relacionado: comisionForm.lote_pos ? `LOTE-${comisionForm.lote_pos.trim()}` : 'N/A',
        saldo_anterior: saldoAnterior,
        saldo_posterior: saldoPosterior,
        beneficiario_o_depositante: cuenta.banco,
        usuario: user?.nombre_completo || 'Administración',
        sucursal: 'Todas',
        notas: comisionForm.notas.trim()
      });

      // 3. Registrar en Libro Diario como gasto operativo financiero
      const movContableRef = push(ref(rtdb, 'movimientos_contables'));
      await set(movContableRef, {
        fecha: fechaRegistro,
        tipo: 'Egreso',
        categoria: 'Gastos y Comisiones Bancarias',
        concepto: `Comisión cobrada por ${cuenta.banco} (Liq: ${comisionForm.referencia_liquidacion.trim()})`,
        monto: montoNum,
        metodo_pago: 'Tarjeta',
        numero_comprobante: comisionForm.referencia_liquidacion.trim(),
        beneficiario: cuenta.banco,
        sucursal: 'SUC-01',
        id_cuenta_bancaria: cuenta.id,
        notas: comisionForm.notas.trim(),
        usuario: user?.nombre_completo || 'Administración'
      });

      toast.success(`Comisión bancaria de C$ ${montoNum.toLocaleString('es-NI', { minimumFractionDigits: 2 })} registrada y deducida`);
      setIsComisionModalOpen(false);
      setComisionForm({
        id_cuenta: '',
        monto: '',
        referencia_liquidacion: '',
        lote_pos: '',
        fecha: new Date().toISOString().split('T')[0],
        concepto: 'Comisión bancaria por ventas con tarjeta POS',
        notas: ''
      });
    } catch (err) {
      toast.error('Error al registrar comisión: ' + err.message);
    }
  };

  // Totales acumulados
  const totalBancosCordobas = cuentasBancarias
    .filter(c => c.moneda === 'NIO' && c.estado !== 'Inactiva')
    .reduce((sum, c) => sum + (Number(c.saldo_actual) || 0), 0);

  const totalBancosDolares = cuentasBancarias
    .filter(c => c.moneda === 'USD' && c.estado !== 'Inactiva')
    .reduce((sum, c) => sum + (Number(c.saldo_actual) || 0), 0);

  // Filtrado de movimientos bancarios
  const filteredMovimientos = movimientosBancarios.filter(m => {
    if (selectedCuentaFilter !== 'Todas' && m.id_cuenta !== selectedCuentaFilter) return false;
    if (tipoMovFilter !== 'Todos' && m.tipo !== tipoMovFilter) return false;
    if (razonFilter !== 'Todas' && m.razon_movimiento !== razonFilter) return false;

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const match = (m.concepto || '').toLowerCase().includes(term) ||
                    (m.referencia_bancaria || '').toLowerCase().includes(term) ||
                    (m.nombre_cuenta || '').toLowerCase().includes(term) ||
                    (m.banco || '').toLowerCase().includes(term) ||
                    (m.beneficiario_o_depositante || '').toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* BARRA SUPERIOR DE ACCIONES DE TESORERÍA */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <Landmark className="text-blue-700" size={24} />
            Control de Bancos y Tesorería
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Saldos reales en cuentas bancarias, depósitos de efectivo, transferencias y comisiones de POS.
          </p>
        </div>

        {/* BOTONES DE ACCIÓN RÁPIDA */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => handleOpenCuentaModal()}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Plus size={16} />
            + Nueva Cuenta
          </button>

          <button
            onClick={() => setIsRemesaModalOpen(true)}
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Wallet size={16} />
            📥 Depósito / Remesa
          </button>

          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <ArrowRightLeft size={16} />
            ⇆ Transferir Fondos
          </button>

          <button
            onClick={() => setIsComisionModalOpen(true)}
            className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <Percent size={16} />
            ⚡ Comisión POS
          </button>
        </div>
      </div>

      {/* TARJETAS RESUMEN DE LIQUIDEZ BANCARIA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-blue-200 uppercase tracking-wider">Liquidez Bancaria (C$)</p>
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center shrink-0">
              <Landmark size={24} className="text-blue-200" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight break-words leading-tight">
              C$ {totalBancosCordobas.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-blue-300 font-medium mt-1">
              {cuentasBancarias.filter(c => c.moneda === 'NIO').length} cuentas en Córdobas
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-800 to-teal-900 text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col justify-between hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-emerald-200 uppercase tracking-wider">Liquidez Bancaria ($ USD)</p>
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center shrink-0">
              <DollarSign size={24} className="text-emerald-200" />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight break-words leading-tight">
              $ {totalBancosDolares.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-[11px] text-emerald-300 font-medium mt-1">
              {cuentasBancarias.filter(c => c.moneda === 'USD').length} cuentas en Dólares
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cuentas Vinculadas a POS</p>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <CreditCard size={24} />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <p className="text-xs sm:text-sm font-black text-gray-800 break-words">
              💳 Tarjetas: <span className="text-blue-700">{cuentasBancarias.find(c => c.recibir_tarjetas_pos)?.alias || 'Sin asignar'}</span>
            </p>
            <p className="text-xs sm:text-sm font-bold text-gray-700 break-words">
              📱 Transf: <span className="text-emerald-700">{cuentasBancarias.find(c => c.recibir_transferencias_pos)?.alias || 'Sin asignar'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* LISTADO DE CUENTAS BANCARIAS (TARJETAS DE CUENTAS) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
            <Building2 className="text-blue-600" size={18} />
            Cuentas Bancarias Registradas ({cuentasBancarias.length})
          </h3>
        </div>

        {cuentasBancarias.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-gray-300 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Landmark size={30} />
            </div>
            <h4 className="text-base font-bold text-gray-700">No hay cuentas bancarias registradas aún</h4>
            <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
              Registra las cuentas de BAC, Banpro, LAFISE u otros bancos para controlar los pagos recibidos con tarjeta y transferencias.
            </p>
            <button
              onClick={() => handleOpenCuentaModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md inline-flex items-center gap-1.5"
            >
              <Plus size={16} /> Crear Primera Cuenta Bancaria
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cuentasBancarias.map((cuenta) => {
              const isNio = cuenta.moneda === 'NIO';
              const saldoNum = Number(cuenta.saldo_actual) || 0;

              return (
                <div 
                  key={cuenta.id}
                  className={`bg-white rounded-2xl p-5 border shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${cuenta.estado === 'Inactiva' ? 'border-gray-200 opacity-60' : 'border-gray-100 hover:border-blue-200'}`}
                >
                  <div>
                    {/* ENCABEZADO DE CUENTA */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                          {cuenta.banco}
                        </span>
                        <h4 className="text-base font-black text-gray-900 truncate mt-1">
                          {cuenta.alias}
                        </h4>
                        <p className="text-xs text-gray-500 font-mono">
                          {cuenta.numero_cuenta}
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenCuentaModal(cuenta)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg shrink-0 transition-colors"
                      >
                        Editar
                      </button>
                    </div>

                    {/* BADGES DE CONFIGURACIÓN */}
                    <div className="flex flex-wrap gap-1.5 my-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                        {cuenta.tipo_cuenta}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                        {isNio ? 'C$ Córdobas' : '$ Dólares'}
                      </span>
                      {cuenta.recibir_tarjetas_pos && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 flex items-center gap-1">
                          <CreditCard size={10} /> POS Tarjetas
                        </span>
                      )}
                      {cuenta.recibir_transferencias_pos && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 flex items-center gap-1">
                          <ArrowRightLeft size={10} /> Transferencias
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SALDO DISPONIBLE */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-end justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                        Saldo Disponible
                      </span>
                      <span className={`text-xl font-black ${saldoNum >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>
                        {isNio ? 'C$ ' : '$ '}
                        {saldoNum.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedCuentaFilter(cuenta.id);
                        document.getElementById('tabla-movimientos-banco')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      Ver Movs →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= TABLA DE MOVIMIENTOS BANCARIOS ================= */}
      <div id="tabla-movimientos-banco" className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
              <FileText className="text-blue-600" size={18} />
              Historial de Movimientos Bancarios y Auditoría
            </h3>
            <p className="text-xs text-gray-500">
              Trazabilidad de cada entrada, salida, comisión y depósito con su justificación contable.
            </p>
          </div>
          <span className="text-xs font-bold text-gray-500">
            {filteredMovimientos.length} movimientos encontrados
          </span>
        </div>

        {/* BARRA DE FILTROS */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto flex-1">
            {/* Buscador */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Buscar referencia, concepto, comprobante..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            </div>

            {/* Filtro por Cuenta */}
            <select
              value={selectedCuentaFilter}
              onChange={e => setSelectedCuentaFilter(e.target.value)}
              className="border border-gray-200 p-2 text-xs font-medium rounded-xl bg-gray-50 outline-none"
            >
              <option value="Todas">Todas las Cuentas</option>
              {cuentasBancarias.map(c => (
                <option key={c.id} value={c.id}>{c.alias} ({c.banco})</option>
              ))}
            </select>

            {/* Filtro por Tipo */}
            <select
              value={tipoMovFilter}
              onChange={e => setTipoMovFilter(e.target.value)}
              className="border border-gray-200 p-2 text-xs font-medium rounded-xl bg-gray-50 outline-none"
            >
              <option value="Todos">Todos los Tipos</option>
              <option value="Ingreso">Entradas (+)</option>
              <option value="Egreso">Salidas (-)</option>
            </select>

            {/* Filtro por Razón de Movimiento */}
            <select
              value={razonFilter}
              onChange={e => setRazonFilter(e.target.value)}
              className="border border-gray-200 p-2 text-xs font-medium rounded-xl bg-gray-50 outline-none"
            >
              <option value="Todas">Todas las Razones</option>
              <option value="Depósito / Remesa de Caja">Depósito / Remesa de Caja</option>
              <option value="Venta POS (Tarjeta)">Venta POS (Tarjeta)</option>
              <option value="Venta POS (Transferencia)">Venta POS (Transferencia)</option>
              <option value="Cobro de Crédito (CxC)">Cobro de Crédito (CxC)</option>
              <option value="Pago a Proveedor (CxP)">Pago a Proveedor (CxP)</option>
              <option value="Transferencia entre Cuentas">Transferencia entre Cuentas</option>
              <option value="Comisión Bancaria / Datáfono">Comisión Bancaria / Datáfono</option>
              <option value="Asiento Inicial de Apertura">Asiento Inicial de Apertura</option>
            </select>
          </div>
        </div>

        {/* TABLA DE MOVIMIENTOS */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100 uppercase">
                <tr>
                  <th className="p-3.5">Fecha y Hora</th>
                  <th className="p-3.5">Cuenta Bancaria</th>
                  <th className="p-3.5">Razón / Causa</th>
                  <th className="p-3.5">Concepto / Detalle</th>
                  <th className="p-3.5">Referencia Bancaria</th>
                  <th className="p-3.5 text-right">Monto</th>
                  <th className="p-3.5 text-right">Saldo Posterior</th>
                  <th className="p-3.5">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMovimientos.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-400">
                      No se encontraron movimientos bancarios con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredMovimientos.map((m) => {
                    const isIngreso = m.tipo === 'Ingreso';
                    const monedaSymbol = m.moneda === 'USD' ? '$' : 'C$';

                    return (
                      <tr key={m.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3.5 font-medium text-gray-600">
                          {new Date(m.fecha).toLocaleString('es-NI', { 
                            dateStyle: 'short', 
                            timeStyle: 'short' 
                          })}
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-gray-800 block">{m.nombre_cuenta}</span>
                          <span className="text-[10px] text-gray-400 font-medium">{m.banco}</span>
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            m.razon_movimiento?.includes('Venta') ? 'bg-emerald-50 text-emerald-700' :
                            m.razon_movimiento?.includes('Remesa') ? 'bg-blue-50 text-blue-700' :
                            m.razon_movimiento?.includes('Comisión') ? 'bg-amber-50 text-amber-700' :
                            m.razon_movimiento?.includes('Transferencia') ? 'bg-purple-50 text-purple-700' :
                            m.razon_movimiento?.includes('Apertura') ? 'bg-teal-50 text-teal-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {m.razon_movimiento || m.tipo}
                          </span>
                        </td>
                        <td className="p-3.5 max-w-[280px] truncate text-gray-700" title={m.concepto}>
                          {m.concepto}
                        </td>
                        <td className="p-3.5 font-mono text-xs text-blue-700 font-bold">
                          {m.referencia_bancaria || '-'}
                        </td>
                        <td className={`p-3.5 text-right font-black text-xs ${isIngreso ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isIngreso ? '+ ' : '- '}{monedaSymbol} {Number(m.monto || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-right font-bold text-gray-800">
                          {monedaSymbol} {Number(m.saldo_posterior || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3.5 text-gray-500">
                          {m.usuario || 'Sistema'}
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

      {/* ================= MODAL CREAR / EDITAR CUENTA BANCARIA ================= */}
      {isCuentaModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-blue-50/50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Landmark className="text-blue-600" size={18} />
                  {editingCuenta ? 'Editar Cuenta Bancaria' : 'Nueva Cuenta Bancaria'}
                </h3>
                <p className="text-xs text-gray-500">
                  Configura banco, moneda y vinculación de pagos electrónicos.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCuentaModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCuenta} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Banco / Institución *</label>
                  <select
                    value={cuentaForm.banco}
                    onChange={e => setCuentaForm({ ...cuentaForm, banco: e.target.value })}
                    className="w-full border p-2.5 rounded-xl bg-gray-50 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {BANCOS_NICARAGUA.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Alias / Nombre Descriptivo *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: BAC Córdobas Operaciones"
                      value={cuentaForm.alias}
                      onChange={e => setCuentaForm({ ...cuentaForm, alias: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Número de Cuenta *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: 365-1029384-0"
                      value={cuentaForm.numero_cuenta}
                      onChange={e => setCuentaForm({ ...cuentaForm, numero_cuenta: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipo de Cuenta</label>
                    <select
                      value={cuentaForm.tipo_cuenta}
                      onChange={e => setCuentaForm({ ...cuentaForm, tipo_cuenta: e.target.value })}
                      className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-medium outline-none"
                    >
                      <option value="Monetaria / Corriente">Monetaria / Corriente</option>
                      <option value="Ahorros">Ahorros</option>
                      <option value="Caja Chica">Caja Chica</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Moneda</label>
                    <select
                      value={cuentaForm.moneda}
                      onChange={e => setCuentaForm({ ...cuentaForm, moneda: e.target.value })}
                      className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-bold outline-none"
                    >
                      <option value="NIO">Córdobas (C$)</option>
                      <option value="USD">Dólares ($ USD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Sucursal</label>
                    <select
                      value={cuentaForm.sucursal}
                      onChange={e => setCuentaForm({ ...cuentaForm, sucursal: e.target.value })}
                      className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-medium outline-none"
                    >
                      <option value="Todas">Todas las Sedes</option>
                      <option value="SUC-01">Sucursal Principal</option>
                      <option value="SUC-02">Sucursal Norte</option>
                    </select>
                  </div>
                </div>

                {!editingCuenta && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Saldo Inicial de Apertura</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={cuentaForm.saldo_inicial}
                      onChange={e => setCuentaForm({ ...cuentaForm, saldo_inicial: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-base font-black text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Si la cuenta ya tiene fondos en el banco al comenzar en el sistema.
                    </p>
                  </div>
                )}

                {/* VINCULACIONES DE POS */}
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
                  <span className="text-xs font-bold text-blue-900 block">Vinculación con Caja POS:</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={cuentaForm.recibir_tarjetas_pos}
                      onChange={e => setCuentaForm({ ...cuentaForm, recibir_tarjetas_pos: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>Recibir por defecto las ventas pagadas con <strong>Tarjeta</strong> en POS</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={cuentaForm.recibir_transferencias_pos}
                      onChange={e => setCuentaForm({ ...cuentaForm, recibir_transferencias_pos: e.target.checked })}
                      className="rounded text-blue-600"
                    />
                    <span>Recibir por defecto las ventas pagadas con <strong>Transferencia</strong> en POS</span>
                  </label>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCuentaModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
                >
                  {editingCuenta ? 'Guardar Cambios' : 'Crear Cuenta Bancaria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DEPÓSITO / REMESA DE EFECTIVO ================= */}
      {isRemesaModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-emerald-50/50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Wallet className="text-emerald-600" size={18} />
                  Remesa / Depósito de Efectivo a Banco
                </h3>
                <p className="text-xs text-gray-500">
                  Retira efectivo de caja física y lo abona a la cuenta bancaria seleccionada.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsRemesaModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveRemesa} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Cuenta Bancaria Destino *</label>
                  <select
                    required
                    value={remesaForm.id_cuenta_destino}
                    onChange={e => setRemesaForm({ ...remesaForm, id_cuenta_destino: e.target.value })}
                    className="w-full border p-2.5 rounded-xl bg-gray-50 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Seleccione Cuenta Bancaria --</option>
                    {cuentasBancarias.map(c => (
                      <option key={c.id} value={c.id}>{c.alias} ({c.banco} - {c.moneda})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Monto en Efectivo a Depositar *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={remesaForm.monto}
                    onChange={e => setRemesaForm({ ...remesaForm, monto: e.target.value })}
                    className="w-full border p-2.5 rounded-xl text-xl font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Minuta / Boleta # *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: MIN-88912"
                      value={remesaForm.minuta_deposito}
                      onChange={e => setRemesaForm({ ...remesaForm, minuta_deposito: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha</label>
                    <input
                      type="date"
                      value={remesaForm.fecha}
                      onChange={e => setRemesaForm({ ...remesaForm, fecha: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Persona que Realizó el Depósito</label>
                  <input
                    type="text"
                    value={remesaForm.depositante}
                    onChange={e => setRemesaForm({ ...remesaForm, depositante: e.target.value })}
                    className="w-full border p-2.5 rounded-xl text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Notas / Justificación</label>
                  <textarea
                    rows={2}
                    placeholder="Ej: Depósito de ventas en efectivo de la mañana..."
                    value={remesaForm.notas}
                    onChange={e => setRemesaForm({ ...remesaForm, notas: e.target.value })}
                    className="w-full border p-2.5 rounded-xl text-xs outline-none"
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRemesaModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
                >
                  Confirmar Depósito a Banco
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL TRANSFERIR FONDOS ENTRE BANCOS ================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-purple-50/50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <ArrowRightLeft className="text-purple-600" size={18} />
                  Transferir Fondos entre Cuentas
                </h3>
                <p className="text-xs text-gray-500">
                  Mueve dinero de una cuenta a otra registrando la bitácora en ambas.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsTransferModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveTransfer} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Cuenta Origen (Sale el dinero) *</label>
                  <select
                    required
                    value={transferForm.id_cuenta_origen}
                    onChange={e => setTransferForm({ ...transferForm, id_cuenta_origen: e.target.value })}
                    className="w-full border p-2.5 rounded-xl bg-gray-50 text-sm font-bold text-gray-800 outline-none"
                  >
                    <option value="">-- Seleccione Origen --</option>
                    {cuentasBancarias.map(c => (
                      <option key={c.id} value={c.id}>{c.alias} (Saldo: {c.moneda} {Number(c.saldo_actual || 0).toFixed(2)})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Cuenta Destino (Recibe el dinero) *</label>
                  <select
                    required
                    value={transferForm.id_cuenta_destino}
                    onChange={e => setTransferForm({ ...transferForm, id_cuenta_destino: e.target.value })}
                    className="w-full border p-2.5 rounded-xl bg-gray-50 text-sm font-bold text-gray-800 outline-none"
                  >
                    <option value="">-- Seleccione Destino --</option>
                    {cuentasBancarias.filter(c => c.id !== transferForm.id_cuenta_origen).map(c => (
                      <option key={c.id} value={c.id}>{c.alias} ({c.banco})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Monto a Transferir *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={transferForm.monto}
                      onChange={e => setTransferForm({ ...transferForm, monto: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-lg font-black text-purple-700 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Referencia Bancaria *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: TR-00918"
                      value={transferForm.referencia_bancaria}
                      onChange={e => setTransferForm({ ...transferForm, referencia_bancaria: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Motivo / Justificación</label>
                  <input
                    type="text"
                    value={transferForm.motivo}
                    onChange={e => setTransferForm({ ...transferForm, motivo: e.target.value })}
                    className="w-full border p-2.5 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
                >
                  Ejecutar Transferencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL COMISIÓN BANCARIA DE POS ================= */}
      {isComisionModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-amber-50/50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Percent className="text-amber-600" size={18} />
                  Registrar Comisión Bancaria de Tarjeta / POS
                </h3>
                <p className="text-xs text-gray-500">
                  Deducción cobrada por el banco adquirente (BAC/Datafast) por uso de datáfono.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsComisionModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveComision} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Cuenta Bancaria Afectada *</label>
                  <select
                    required
                    value={comisionForm.id_cuenta}
                    onChange={e => setComisionForm({ ...comisionForm, id_cuenta: e.target.value })}
                    className="w-full border p-2.5 rounded-xl bg-gray-50 text-sm font-bold text-gray-800 outline-none"
                  >
                    <option value="">-- Seleccione Cuenta --</option>
                    {cuentasBancarias.map(c => (
                      <option key={c.id} value={c.id}>{c.alias} ({c.banco})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Monto de Comisión Deducido *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={comisionForm.monto}
                      onChange={e => setComisionForm({ ...comisionForm, monto: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-lg font-black text-rose-600 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Liquidación / Ref # *</label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: LIQ-44910"
                      value={comisionForm.referencia_liquidacion}
                      onChange={e => setComisionForm({ ...comisionForm, referencia_liquidacion: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Lote de POS (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: LOTE-108"
                      value={comisionForm.lote_pos}
                      onChange={e => setComisionForm({ ...comisionForm, lote_pos: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Fecha</label>
                    <input
                      type="date"
                      value={comisionForm.fecha}
                      onChange={e => setComisionForm({ ...comisionForm, fecha: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Concepto</label>
                  <input
                    type="text"
                    value={comisionForm.concepto}
                    onChange={e => setComisionForm({ ...comisionForm, concepto: e.target.value })}
                    className="w-full border p-2.5 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsComisionModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
                >
                  Registrar Comisión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
