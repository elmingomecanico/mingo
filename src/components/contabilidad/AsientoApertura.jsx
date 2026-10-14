import React, { useState, useEffect } from 'react';
import { ref, set, push, onValue } from 'firebase/database';
import { rtdb } from '../../firebase';
import { 
  Scale, CheckCircle2, AlertCircle, FileText, Printer, 
  DollarSign, Landmark, Package, Users, Truck, Sparkles, 
  Lock, RefreshCw, ShieldCheck, Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AsientoApertura({ 
  asientoApertura = null, 
  cuentasBancarias = [], 
  inventario = {}, 
  allInventory = {}, 
  cxpList = [], 
  cxcList = [], 
  user 
}) {
  const [isEditing, setIsEditing] = useState(false);

  // Formulario del Asiento Inicial
  const [formData, setFormData] = useState({
    fecha_corte: new Date().toISOString().split('T')[0],
    fondo_caja_principal: '',
    fondo_caja_norte: '',
    inventario_inicial_valorizado: '',
    cxc_inicial_clientes: '',
    cxp_inicial_proveedores: '',
    notas: 'Asiento contable inicial de apertura de operaciones para Taller El Mingo. Registra los saldos iniciales de bancos, caja, inventario y cuentas pendientes de clientes y proveedores.',
    cuentas_bancarias_saldos: {}
  });

  // Inicializar o cargar datos si ya existe asiento
  useEffect(() => {
    if (asientoApertura) {
      setFormData({
        fecha_corte: asientoApertura.fecha_corte || new Date().toISOString().split('T')[0],
        fondo_caja_principal: asientoApertura.fondo_caja_principal || 0,
        fondo_caja_norte: asientoApertura.fondo_caja_norte || 0,
        inventario_inicial_valorizado: asientoApertura.inventario_inicial_valorizado || 0,
        cxc_inicial_clientes: asientoApertura.cxc_inicial_clientes || 0,
        cxp_inicial_proveedores: asientoApertura.cxp_inicial_proveedores || 0,
        notas: asientoApertura.notas || '',
        cuentas_bancarias_saldos: asientoApertura.cuentas_bancarias_saldos || {}
      });
    } else {
      // Pre-cargar saldos iniciales de cuentas bancarias existentes
      const bancSaldos = {};
      cuentasBancarias.forEach(c => {
        bancSaldos[c.id] = c.saldo_actual !== undefined ? c.saldo_actual : (c.saldo_inicial || 0);
      });

      // Pre-cargar CxC y CxP calculados si existen
      const totalCxpPend = cxpList.reduce((s, c) => s + (Number(c.saldo_pendiente) || 0), 0);
      const totalCxcPend = cxcList.reduce((s, c) => s + (Number(c.saldo_pendiente) || 0), 0);

      setFormData(prev => ({
        ...prev,
        cuentas_bancarias_saldos: bancSaldos,
        cxp_inicial_proveedores: totalCxpPend > 0 ? totalCxpPend : '',
        cxc_inicial_clientes: totalCxcPend > 0 ? totalCxcPend : ''
      }));
    }
  }, [asientoApertura, cuentasBancarias]);

  // Función para autocalcular el inventario inicial multiplicando stock x costo
  const handleAutoCalcularInventario = () => {
    let totalCosto = 0;
    let totalProductos = 0;

    Object.keys(allInventory).forEach(sucId => {
      const branchProds = allInventory[sucId] || {};
      Object.keys(branchProds).forEach(prodId => {
        const item = branchProds[prodId];
        const stock = Number(item.stock_actual) || 0;
        const costo = Number(item.costo_compra || item.precio_compra || item.costo_unitario) || 0;
        if (stock > 0 && costo > 0) {
          totalCosto += (stock * costo);
          totalProductos += stock;
        }
      });
    });

    if (totalCosto === 0) {
      toast('ℹ️ No se detectaron productos con costo de compra registrado en inventario. Ingrese el monto estimado manualmente.', { icon: '⚠️' });
    } else {
      setFormData(prev => ({
        ...prev,
        inventario_inicial_valorizado: Number(totalCosto.toFixed(2))
      }));
      toast.success(`✨ Inventario valorizado calculado: C$ ${totalCosto.toLocaleString('es-NI', { minimumFractionDigits: 2 })} (${totalProductos} unidades)`);
    }
  };

  // Cálculos en tiempo real
  const fondoCajaPrincipal = Number(formData.fondo_caja_principal) || 0;
  const fondoCajaNorte = Number(formData.fondo_caja_norte) || 0;
  const totalCajasEfectivo = fondoCajaPrincipal + fondoCajaNorte;

  // Total en Bancos
  const totalBancos = Object.keys(formData.cuentas_bancarias_saldos || {}).reduce((sum, cId) => {
    const val = Number(formData.cuentas_bancarias_saldos[cId]) || 0;
    return sum + val;
  }, 0);

  const totalInventario = Number(formData.inventario_inicial_valorizado) || 0;
  const totalCxc = Number(formData.cxc_inicial_clientes) || 0;
  const totalCxp = Number(formData.cxp_inicial_proveedores) || 0;

  // Ecuación Contable Fundamental:
  // ACTIVO = CAJA + BANCOS + INVENTARIO + CXC
  // PASIVO = CXP
  // PATRIMONIO (CAPITAL SOCIAL) = ACTIVO - PASIVO
  const totalActivo = totalCajasEfectivo + totalBancos + totalInventario + totalCxc;
  const totalPasivo = totalCxp;
  const capitalPatrimonio = totalActivo - totalPasivo;

  // Guardar y Certificar el Asiento de Apertura
  const handleCertificarAsiento = async (e) => {
    e.preventDefault();

    if (totalActivo <= 0) {
      return toast.error('Debe ingresar al menos un saldo de Activo (Caja, Banco o Inventario) para registrar el asiento');
    }

    if (!window.confirm(`¿Está seguro de certificar el Asiento Inicial de Apertura con un Capital Social de C$ ${capitalPatrimonio.toLocaleString('es-NI', { minimumFractionDigits: 2 })}?`)) {
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const asientoPayload = {
        fecha_registro: nowIso,
        fecha_corte: formData.fecha_corte,
        fondo_caja_principal: fondoCajaPrincipal,
        fondo_caja_norte: fondoCajaNorte,
        total_cajas_efectivo: totalCajasEfectivo,
        cuentas_bancarias_saldos: formData.cuentas_bancarias_saldos,
        total_bancos: totalBancos,
        inventario_inicial_valorizado: totalInventario,
        cxc_inicial_clientes: totalCxc,
        total_activo: totalActivo,
        cxp_inicial_proveedores: totalCxp,
        total_pasivo: totalPasivo,
        capital_patrimonio_inicial: capitalPatrimonio,
        notas: formData.notas.trim(),
        certificado_por: user?.nombre_completo || 'Administración Central',
        numero_asiento: 'ASIENTO-APERTURA-001',
        estado: 'Certificado'
      };

      // 1. Guardar en nodo asiento_apertura
      const asientoRef = ref(rtdb, 'asiento_apertura/general');
      await set(asientoRef, asientoPayload);

      // 2. Asentar Asiento #1 en movimientos_contables
      const movContableRef = ref(rtdb, 'movimientos_contables/asiento_apertura_001');
      await set(movContableRef, {
        fecha: `${formData.fecha_corte}T08:00:00.000Z`,
        tipo: 'Ingreso',
        categoria: 'Asiento Inicial de Apertura',
        concepto: `Balance y Asiento Inicial de Apertura de Operaciones - Capital Social: C$ ${capitalPatrimonio.toFixed(2)}`,
        monto: totalActivo,
        metodo_pago: 'Efectivo / Bancos',
        numero_comprobante: 'ASIENTO-APERTURA-001',
        beneficiario: 'Taller El Mingo (Patrimonio Inicial)',
        sucursal: 'Todas',
        notas: formData.notas.trim(),
        usuario: user?.nombre_completo || 'Administración Central'
      });

      // 3. Actualizar saldos iniciales en cuentas bancarias si cambiaron
      for (const cId of Object.keys(formData.cuentas_bancarias_saldos || {})) {
        const nuevoSaldo = Number(formData.cuentas_bancarias_saldos[cId]) || 0;
        await set(ref(rtdb, `cuentas_bancarias/${cId}/saldo_actual`), nuevoSaldo);
      }

      toast.success('🎉 Asiento Inicial de Apertura certificado exitosamente');
      setIsEditing(false);
    } catch (err) {
      toast.error('Error al certificar asiento de apertura: ' + err.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Si ya está certificado y no estamos editando, mostrar Ficha Oficial
  if (asientoApertura && !isEditing) {
    const act = asientoApertura.total_activo || 0;
    const pas = asientoApertura.total_pasivo || 0;
    const pat = asientoApertura.capital_patrimonio_inicial || 0;

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        
        {/* ENCABEZADO DE FICHA CERTIFICADA */}
        <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-gray-900">
                  Asiento Oficial de Apertura y Balance Inicial
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Certificado
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Comprobante: <span className="font-mono font-bold text-gray-700">{asientoApertura.numero_asiento || 'ASIENTO-APERTURA-001'}</span> • Fecha de Corte: <span className="font-bold text-gray-700">{asientoApertura.fecha_corte}</span> • Certificado por: <span className="font-bold text-gray-700">{asientoApertura.certificado_por}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 md:flex-none px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer size={16} /> Imprimir Balance
            </button>
            {user?.rol === 'SuperAdmin' && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 md:flex-none px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Edit3 size={16} /> Ajustar Valores
              </button>
            )}
          </div>
        </div>

        {/* TARJETAS RESUMEN DE LA ECUACIÓN CONTABLE */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              1. Total Activo Inicial
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-700 block mt-1 break-words leading-tight">
              C$ {act.toLocaleString('es-NI', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-gray-500 font-medium mt-1 block">
              Cajas + Bancos + Inventario + CxC
            </span>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              2. Total Pasivo Inicial
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-600 block mt-1 break-words leading-tight">
              C$ {pas.toLocaleString('es-NI', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-gray-500 font-medium mt-1 block">
              Deudas pendientes a Proveedores (CxP)
            </span>
          </div>

          <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white p-4 sm:p-5 rounded-2xl shadow-md flex flex-col justify-between">
            <span className="text-xs font-bold text-blue-200 uppercase tracking-wider block">
              3. Capital Social / Patrimonio
            </span>
            <span className="text-xl sm:text-2xl font-black text-white block mt-1 break-words leading-tight">
              C$ {pat.toLocaleString('es-NI', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-blue-300 font-medium mt-1 block">
              Activo - Pasivo = Aporte Neto de Socios
            </span>
          </div>
        </div>

        {/* DETALLE COMPLETO DEL BALANCE INICIAL */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <h3 className="text-base font-black text-gray-900 border-b pb-3">
            Desglose Auditado del Asiento de Apertura
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* LADO IZQUIERDO: ACTIVOS */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Activos Circulantes e Inventario
              </h4>
              
              <div className="bg-gray-50 p-4 rounded-xl space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="font-bold text-gray-600">Fondo Efectivo en Caja Principal:</span>
                  <span className="font-mono font-black text-gray-800">
                    C$ {Number(asientoApertura.fondo_caja_principal || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="font-bold text-gray-600">Fondo Efectivo en Caja Norte:</span>
                  <span className="font-mono font-black text-gray-800">
                    C$ {Number(asientoApertura.fondo_caja_norte || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="font-bold text-gray-600">Disponibilidad en Cuentas Bancarias:</span>
                  <span className="font-mono font-black text-gray-800">
                    C$ {Number(asientoApertura.total_bancos || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="font-bold text-gray-600">Inventario Físico Inicial (Valorizado):</span>
                  <span className="font-mono font-black text-gray-800">
                    C$ {Number(asientoApertura.inventario_inicial_valorizado || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="font-bold text-gray-600">Cuentas por Cobrar Iniciales (Clientes):</span>
                  <span className="font-mono font-black text-gray-800">
                    C$ {Number(asientoApertura.cxc_inicial_clientes || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* LADO DERECHO: PASIVOS Y CAPITAL */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <AlertCircle size={14} /> Pasivos y Patrimonio Inicial
              </h4>

              <div className="bg-gray-50 p-4 rounded-xl space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="font-bold text-gray-600">Cuentas por Pagar Iniciales (Proveedores):</span>
                  <span className="font-mono font-black text-rose-600">
                    C$ {Number(asientoApertura.cxp_inicial_proveedores || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-gray-200">
                  <span className="font-bold text-gray-600">Total Pasivo (Obligaciones):</span>
                  <span className="font-mono font-black text-rose-600">
                    C$ {Number(asientoApertura.total_pasivo || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 bg-blue-50/70 px-2 rounded-lg mt-3">
                  <span className="font-black text-blue-900">Capital Social Inicial Certificado:</span>
                  <span className="font-mono font-black text-blue-900 text-sm">
                    C$ {Number(asientoApertura.capital_patrimonio_inicial || 0).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {asientoApertura.notas && (
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-xs text-amber-900">
                  <span className="font-bold block mb-0.5">Notas de la Certificación:</span>
                  <p className="text-gray-600 leading-relaxed">{asientoApertura.notas}</p>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    );
  }

  // ================= FORMULARIO ASISTENTE DE APERTURA =================
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* BANNER INTRODUCTORIO GUIADO */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <Scale size={22} className="text-blue-300" />
          <h2 className="text-lg sm:text-xl font-black">
            Asistente del Asiento Inicial de Apertura (Primera Vez)
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-blue-200 leading-relaxed max-w-3xl">
          Para que el sistema cuadre perfectamente con la realidad de tu negocio desde el día uno, registra los saldos reales que la empresa ya tiene en bancos, cajas, inventario y cuentas pendientes de cobro y pago. Este proceso genera el <strong>Asiento Contable #1</strong> y el <strong>Balance Inicial de Operaciones</strong>.
        </p>
      </div>

      <form onSubmit={handleCertificarAsiento} className="space-y-6">
        
        {/* BLOQUE 1: FONDOS EN EFECTIVO Y FECHA */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
              <DollarSign size={18} className="text-emerald-600" />
              1. Fondos en Efectivo (Caja General y Cajas Chicas)
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-500">Fecha de Corte:</label>
              <input
                type="date"
                required
                value={formData.fecha_corte}
                onChange={e => setFormData({ ...formData, fecha_corte: e.target.value })}
                className="border rounded-lg px-2.5 py-1 text-xs font-bold outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Efectivo en Caja Principal (C$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.fondo_caja_principal}
                onChange={e => setFormData({ ...formData, fondo_caja_principal: e.target.value })}
                className="w-full border p-2.5 rounded-xl text-lg font-black text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <p className="text-[11px] text-gray-400 mt-1">Efectivo físico disponible en caja al momento de inicio.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Efectivo en Caja Sucursal Norte (C$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.fondo_caja_norte}
                onChange={e => setFormData({ ...formData, fondo_caja_norte: e.target.value })}
                className="w-full border p-2.5 rounded-xl text-lg font-black text-gray-800 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
              <p className="text-[11px] text-gray-400 mt-1">Fondo fijo de apertura en sede alterna.</p>
            </div>
          </div>
        </div>

        {/* BLOQUE 2: SALDOS EN CUENTAS BANCARIAS */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="border-b pb-3">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
              <Landmark size={18} className="text-blue-600" />
              2. Saldos Iniciales en Cuentas Bancarias
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Ingresa el saldo real disponible en cada cuenta bancaria al corte de apertura.
            </p>
          </div>

          {cuentasBancarias.length === 0 ? (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
              <span>⚠️ No hay cuentas bancarias creadas aún. Puedes registrarlas en la pestaña <strong>Bancos y Tesorería</strong> o continuar si tu negocio solo opera con caja física.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cuentasBancarias.map(c => (
                <div key={c.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="font-bold text-xs text-gray-800 block truncate">{c.alias}</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {c.moneda}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-mono mb-2">{c.numero_cuenta}</p>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Saldo en Cuenta ({c.moneda}):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.cuentas_bancarias_saldos[c.id] || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        cuentas_bancarias_saldos: {
                          ...prev.cuentas_bancarias_saldos,
                          [c.id]: val
                        }
                      }));
                    }}
                    className="w-full border p-2 rounded-lg text-sm font-black text-gray-800 outline-none font-mono"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BLOQUE 3: INVENTARIO, CXC Y CXP */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="border-b pb-3">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
              <Package size={18} className="text-amber-600" />
              3. Inventario Físico y Cuentas Pendientes Históricas
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* Inventario Valorizado */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-600 uppercase">
                  Inventario Inicial (C$) *
                </label>
                <button
                  type="button"
                  onClick={handleAutoCalcularInventario}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline"
                >
                  ⚡ Autocalcular
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.inventario_inicial_valorizado}
                onChange={e => setFormData({ ...formData, inventario_inicial_valorizado: e.target.value })}
                className="w-full border p-2.5 rounded-xl text-base font-black text-gray-800 outline-none font-mono"
              />
              <p className="text-[11px] text-gray-400 mt-1">Costo total de los repuestos en estantería.</p>
            </div>

            {/* Cuentas por Cobrar Clientes */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Clientes por Cobrar (CxC) (C$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.cxc_inicial_clientes}
                onChange={e => setFormData({ ...formData, cxc_inicial_clientes: e.target.value })}
                className="w-full border p-2.5 rounded-xl text-base font-black text-gray-800 outline-none font-mono"
              />
              <p className="text-[11px] text-gray-400 mt-1">Deudas que los clientes tenían antes del sistema.</p>
            </div>

            {/* Cuentas por Pagar Proveedores */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                Proveedores por Pagar (CxP) (C$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.cxp_inicial_proveedores}
                onChange={e => setFormData({ ...formData, cxp_inicial_proveedores: e.target.value })}
                className="w-full border p-2.5 rounded-xl text-base font-black text-rose-600 outline-none font-mono"
              />
              <p className="text-[11px] text-gray-400 mt-1">Facturas de compras que se debían antes del sistema.</p>
            </div>

          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              Notas y Justificación del Asiento de Apertura
            </label>
            <textarea
              rows={2}
              value={formData.notas}
              onChange={e => setFormData({ ...formData, notas: e.target.value })}
              className="w-full border p-2.5 rounded-xl text-xs outline-none"
            />
          </div>
        </div>

        {/* RESUMEN EN VIVO DE LA ECUACIÓN CONTABLE & BOTÓN DE CERTIFICACIÓN */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4">
            <div>
              <span className="text-xs font-bold text-blue-300 uppercase tracking-widest block">
                Balance Inicial Preliminar
              </span>
              <h3 className="text-xl font-black text-white">
                Ecuación Contable de Apertura
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-blue-200 block">Capital Social / Patrimonio Resultante:</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                C$ {capitalPatrimonio.toLocaleString('es-NI', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white/5 rounded-xl">
              <span className="text-gray-400 block">Efectivo en Cajas:</span>
              <span className="text-sm font-bold text-white font-mono">C$ {totalCajasEfectivo.toFixed(2)}</span>
            </div>
            <div className="p-3 bg-white/5 rounded-xl">
              <span className="text-gray-400 block">Bancos:</span>
              <span className="text-sm font-bold text-white font-mono">C$ {totalBancos.toFixed(2)}</span>
            </div>
            <div className="p-3 bg-white/5 rounded-xl">
              <span className="text-gray-400 block">Inventario + CxC:</span>
              <span className="text-sm font-bold text-white font-mono">C$ {(totalInventario + totalCxc).toFixed(2)}</span>
            </div>
            <div className="p-3 bg-white/5 rounded-xl">
              <span className="text-rose-300 block">Pasivos (CxP):</span>
              <span className="text-sm font-bold text-rose-300 font-mono">- C$ {totalPasivo.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-900/50 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Lock size={18} />
              🔐 Certificar y Asentar Balance Inicial Oficial
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
