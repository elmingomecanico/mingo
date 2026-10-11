import React, { useState, useEffect } from 'react';
import { ref, onValue, push, set } from 'firebase/database';
import { rtdb } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { 
  UserCheck, Palmtree, HandCoins, DollarSign, Package, Calendar, 
  Clock, CheckCircle2, AlertCircle, XCircle, Plus, FileText, 
  HelpCircle, ChevronRight, ShieldCheck, CreditCard, Sparkles, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PortalEmpleado() {
  const { user } = useAuth();
  const [solicitudes, setSolicitudes] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [asistenciaHoy, setAsistenciaHoy] = useState(null);
  const [empleadoData, setEmpleadoData] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal Solicitud
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tipoSol, setTipoSol] = useState('Vacaciones'); // 'Vacaciones', 'Adelanto', 'Préstamo', 'Crédito'
  const [formSol, setFormSol] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    dias_solicitados: 1,
    monto: '',
    cuotas_sugeridas: 1,
    id_producto: '',
    producto_detalle: '',
    motivo: ''
  });

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!user) return;

    // 1. Escuchar datos actualizados del usuario/empleado
    const empRef = ref(rtdb, `usuarios/${user.id}`);
    const unsubEmp = onValue(empRef, snap => {
      if (snap.exists()) {
        setEmpleadoData({ id: user.id, ...snap.val() });
      } else {
        setEmpleadoData(user);
      }
    });

    // 2. Escuchar solicitudes del empleado
    const solRef = ref(rtdb, 'solicitudes_empleados');
    const unsubSol = onValue(solRef, snap => {
      if (snap.exists()) {
        const list = Object.keys(snap.val())
          .map(k => ({ id: k, ...snap.val()[k] }))
          .filter(s => s.id_empleado === user.id)
          .sort((a, b) => new Date(b.fecha_solicitud) - new Date(a.fecha_solicitud));
        setSolicitudes(list);
      } else {
        setSolicitudes([]);
      }
    });

    // 3. Escuchar deudas / deducciones del empleado
    const deudasRef = ref(rtdb, 'deudas_empleados');
    const unsubDeudas = onValue(deudasRef, snap => {
      if (snap.exists()) {
        const list = Object.keys(snap.val())
          .map(k => ({ id: k, ...snap.val()[k] }))
          .filter(d => d.id_empleado === user.id)
          .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));
        setDeudas(list);
      } else {
        setDeudas([]);
      }
    });

    // 4. Escuchar órdenes de trabajo (para mecánicos)
    const otRef = ref(rtdb, 'ordenes_trabajo');
    const unsubOT = onValue(otRef, snap => {
      if (snap.exists()) {
        const list = Object.keys(snap.val())
          .map(k => ({ id: k, ...snap.val()[k] }))
          .filter(ot => ot.id_mecanico === user.id);
        setOrdenes(list);
      } else {
        setOrdenes([]);
      }
    });

    // 5. Escuchar asistencia de hoy
    const suc = user.id_sucursal || 'SUC-01';
    const asisRef = ref(rtdb, `asistencia/${suc}/${todayStr}/${user.id}`);
    const unsubAsis = onValue(asisRef, snap => {
      if (snap.exists()) {
        setAsistenciaHoy(snap.val());
      } else {
        setAsistenciaHoy(null);
      }
    });

    // 6. Cargar productos (para solicitudes de crédito de repuestos)
    const prodRef = ref(rtdb, 'productos');
    const unsubProd = onValue(prodRef, snap => {
      if (snap.exists()) {
        setProductos(Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })));
      }
    });

    setLoading(false);

    return () => {
      unsubEmp();
      unsubSol();
      unsubDeudas();
      unsubOT();
      unsubAsis();
      unsubProd();
    };
  }, [user]);

  // Cálculo de Vacaciones según Código del Trabajo de Nicaragua:
  // 15 días continuos por cada 6 meses de trabajo continuo (2.5 días por mes laborado)
  const fechaIngreso = empleadoData?.fecha_ingreso ? new Date(empleadoData.fecha_ingreso) : new Date(2025, 0, 1);
  const hoy = new Date();
  const mesesLaborados = Math.max(0, ((hoy.getFullYear() - fechaIngreso.getFullYear()) * 12) + (hoy.getMonth() - fechaIngreso.getMonth()));
  const diasVacacionesAcumulados = Number((mesesLaborados * 2.5).toFixed(1));
  const diasTomados = Number(empleadoData?.dias_vacaciones_tomados || 0);
  const diasVacacionesDisponibles = Math.max(0, Number((diasVacacionesAcumulados - diasTomados).toFixed(1)));

  // Deudas activas
  const deudasActivas = deudas.filter(d => d.estado === 'Activo' && d.saldo_pendiente > 0);
  const totalSaldoDeuda = deudasActivas.reduce((sum, d) => sum + Number(d.saldo_pendiente || 0), 0);
  const proximaDeduccionTotal = deudasActivas.reduce((sum, d) => sum + Math.min(Number(d.cuota_por_pago || 0), Number(d.saldo_pendiente || 0)), 0);

  // Comisiones acumuladas de órdenes completadas en el mes
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const comisionesMes = ordenes
    .filter(ot => ot.estado === 'Completado' && new Date(ot.fecha_creacion) >= primerDiaMes)
    .reduce((sum, ot) => sum + Number(ot.comision_mecanico_monto || 0), 0);

  // Auto-cálculo de días en vacaciones
  const handleFechasVacacionesChange = (inicio, fin) => {
    if (inicio && fin) {
      const d1 = new Date(inicio);
      const d2 = new Date(fin);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setFormSol(prev => ({
        ...prev,
        fecha_inicio: inicio,
        fecha_fin: fin,
        dias_solicitados: diffDays > 0 ? diffDays : 1
      }));
    } else {
      setFormSol(prev => ({ ...prev, fecha_inicio: inicio, fecha_fin: fin }));
    }
  };

  const handleMarcarAsistenciaHoy = async () => {
    try {
      const suc = user.id_sucursal || 'SUC-01';
      const asisRef = ref(rtdb, `asistencia/${suc}/${todayStr}/${user.id}`);
      const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      await set(asisRef, {
        id_empleado: user.id,
        nombre_empleado: user.nombre_completo,
        fecha: todayStr,
        hora_entrada: horaActual,
        hora_salida: '',
        estado: 'Presente',
        notas: 'Registrado desde Portal del Empleado',
        registrado_por: user.nombre_completo
      });

      toast.success(`¡Entrada registrada con éxito a las ${horaActual}!`);
    } catch (e) {
      toast.error('Error al registrar asistencia: ' + e.message);
    }
  };

  const handleSubmitSolicitud = async (e) => {
    e.preventDefault();

    if (!formSol.motivo.trim()) {
      return toast.error('Debe indicar un motivo o justificación');
    }

    if (tipoSol === 'Vacaciones') {
      if (!formSol.fecha_inicio || !formSol.fecha_fin) {
        return toast.error('Seleccione las fechas de inicio y fin de sus vacaciones');
      }
      if (formSol.dias_solicitados > diasVacacionesDisponibles) {
        return toast.error(`No puede solicitar ${formSol.dias_solicitados} días. Solo dispone de ${diasVacacionesDisponibles} días disponibles.`);
      }
    }

    if (tipoSol === 'Adelanto' || tipoSol === 'Préstamo') {
      if (!formSol.monto || Number(formSol.monto) <= 0) {
        return toast.error('Ingrese un monto válido a solicitar');
      }
    }

    if (tipoSol === 'Crédito') {
      if (!formSol.id_producto && !formSol.producto_detalle.trim()) {
        return toast.error('Seleccione o especifique el producto requerido');
      }
      if (!formSol.monto || Number(formSol.monto) <= 0) {
        return toast.error('Ingrese el valor estimado del producto');
      }
    }

    try {
      const solRef = push(ref(rtdb, 'solicitudes_empleados'));
      const payload = {
        id_empleado: user.id,
        nombre_empleado: user.nombre_completo,
        tipo: tipoSol,
        fecha_solicitud: new Date().toISOString(),
        estado: 'Pendiente',
        motivo: formSol.motivo.trim(),
        ...(tipoSol === 'Vacaciones' && {
          fecha_inicio: formSol.fecha_inicio,
          fecha_fin: formSol.fecha_fin,
          dias_solicitados: Number(formSol.dias_solicitados)
        }),
        ...(tipoSol === 'Adelanto' && {
          monto: Number(formSol.monto),
          deduccion_corte: 'Próximo Corte (100%)'
        }),
        ...(tipoSol === 'Préstamo' && {
          monto: Number(formSol.monto),
          cuotas_sugeridas: Number(formSol.cuotas_sugeridas) || 1,
          cuota_estimada: Number((Number(formSol.monto) / (Number(formSol.cuotas_sugeridas) || 1)).toFixed(2))
        }),
        ...(tipoSol === 'Crédito' && {
          monto: Number(formSol.monto),
          id_producto: formSol.id_producto || null,
          producto_detalle: formSol.producto_detalle || '',
          cuotas_sugeridas: Number(formSol.cuotas_sugeridas) || 1
        })
      };

      await set(solRef, payload);
      toast.success(`Solicitud de ${tipoSol} enviada a Gerencia para revisión.`);
      setIsModalOpen(false);
      setFormSol({
        fecha_inicio: '',
        fecha_fin: '',
        dias_solicitados: 1,
        monto: '',
        cuotas_sugeridas: 1,
        id_producto: '',
        producto_detalle: '',
        motivo: ''
      });
    } catch (err) {
      toast.error('Error al enviar solicitud: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-12">
      {/* HEADER DE BIENVENIDA */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-blue-500/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold tracking-wide border border-blue-400/30">
            <UserCheck size={14} className="text-blue-300" />
            Portal del Empleado • El Mingo ERP
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Hola, {user?.nombre_completo || 'Colaborador'}
          </h1>
          <p className="text-blue-200 text-sm max-w-xl">
            Tu espacio personal para consultar tus vacaciones por ley, estado de deudas, asistencia y realizar solicitudes de adelantos, préstamos o créditos.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30 transition-all active:scale-95 text-sm"
          >
            <Plus size={18} />
            Nueva Solicitud
          </button>
        </div>
      </div>

      {/* TARJETAS RESUMEN DE INDICADORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* 1. VACACIONES */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Vacaciones por Ley</p>
              <h3 className="text-3xl font-black text-amber-600 mt-1">
                {diasVacacionesDisponibles} <span className="text-xs font-bold text-gray-500">días disp.</span>
              </h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Palmtree size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex justify-between">
            <span>Acumulados: <strong>{diasVacacionesAcumulados} d</strong></span>
            <span>Gozados: <strong>{diasTomados} d</strong></span>
          </div>
        </div>

        {/* 2. DEDUCCIONES Y DEUDAS ACTIVAS */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Saldo Pendiente</p>
              <h3 className="text-3xl font-black text-purple-700 mt-1">
                C$ {totalSaldoDeuda.toFixed(2)}
              </h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <HandCoins size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex justify-between">
            <span>Próxima Deducción:</span>
            <strong className="text-red-600">C$ {proximaDeduccionTotal.toFixed(2)}</strong>
          </div>
        </div>

        {/* 3. COMISIONES DEL MES (SI ES MECÁNICO) O SALARIO */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {empleadoData?.tipo_salario === 'Comisión' ? 'Comisiones este Mes' : 'Salario Base'}
              </p>
              <h3 className="text-3xl font-black text-green-600 mt-1">
                C$ {empleadoData?.tipo_salario === 'Comisión' ? comisionesMes.toFixed(2) : Number(empleadoData?.salario_base || 0).toFixed(2)}
              </h3>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <DollarSign size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex justify-between">
            <span>Esquema:</span>
            <strong className="uppercase">{empleadoData?.tipo_salario || 'Comisión'}</strong>
          </div>
        </div>

        {/* 4. ASISTENCIA DE HOY */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Asistencia de Hoy</p>
              <h3 className={`text-xl font-black mt-2 flex items-center gap-2 ${asistenciaHoy ? 'text-blue-600' : 'text-gray-400'}`}>
                {asistenciaHoy ? (
                  <>
                    <CheckCircle2 size={18} className="text-green-500" />
                    <span>{asistenciaHoy.hora_entrada}</span>
                  </>
                ) : (
                  'Sin registrar'
                )}
              </h3>
            </div>
            <div className={`p-3 rounded-xl ${asistenciaHoy ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
              <Clock size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            {!asistenciaHoy ? (
              <button
                onClick={handleMarcarAsistenciaHoy}
                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Clock size={12} /> Marcar mi entrada
              </button>
            ) : (
              <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full inline-block">
                ✅ Presente
              </span>
            )}
          </div>
        </div>

      </div>

      {/* BOTONES DIRECTOS PARA SOLICITUDES RÁPIDAS */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-sm font-black text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          ¿Qué necesitas solicitar hoy?
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => { setTipoSol('Vacaciones'); setIsModalOpen(true); }}
            className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/80 transition-all text-left flex flex-col justify-between group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Palmtree size={20} />
            </div>
            <div>
              <h4 className="font-bold text-gray-800 text-sm">Vacaciones</h4>
              <p className="text-xs text-gray-500 mt-0.5">Días de descanso legal</p>
            </div>
          </button>

          <button
            onClick={() => { setTipoSol('Adelanto'); setIsModalOpen(true); }}
            className="p-4 rounded-2xl border border-orange-200 bg-orange-50/50 hover:bg-orange-100/80 transition-all text-left flex flex-col justify-between group"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <DollarSign size={20} />
            </div>
            <div>
              <h4 className="font-bold text-gray-800 text-sm">Adelanto Salario</h4>
              <p className="text-xs text-gray-500 mt-0.5">Deducción en próximo corte</p>
            </div>
          </button>

          <button
            onClick={() => { setTipoSol('Préstamo'); setIsModalOpen(true); }}
            className="p-4 rounded-2xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100/80 transition-all text-left flex flex-col justify-between group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <HandCoins size={20} />
            </div>
            <div>
              <h4 className="font-bold text-gray-800 text-sm">Préstamo Efectivo</h4>
              <p className="text-xs text-gray-500 mt-0.5">Pago en varias cuotas</p>
            </div>
          </button>

          <button
            onClick={() => { setTipoSol('Crédito'); setIsModalOpen(true); }}
            className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/80 transition-all text-left flex flex-col justify-between group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Package size={20} />
            </div>
            <div>
              <h4 className="font-bold text-gray-800 text-sm">Crédito de Producto</h4>
              <p className="text-xs text-gray-500 mt-0.5">Repuestos para tu vehículo</p>
            </div>
          </button>
        </div>
      </div>

      {/* SECCIÓN 2 COLUMNAS: SOLICITUDES Y ESTADO DE DEUDAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* HISTORIAL DE SOLICITUDES (2 COLUMNAS) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
              <FileText className="text-blue-600" size={18} />
              Mis Solicitudes Realizadas ({solicitudes.length})
            </h3>
          </div>

          {solicitudes.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
              <HelpCircle className="mx-auto text-gray-300 mb-2" size={36} />
              <p className="font-bold text-gray-600 text-sm">No has realizado ninguna solicitud aún</p>
              <p className="text-xs text-gray-400 mt-1">Usa los botones de arriba para solicitar vacaciones, adelantos, créditos o préstamos.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {solicitudes.map(sol => (
                <div key={sol.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/50 p-2 rounded-xl transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl mt-0.5 ${
                      sol.tipo === 'Vacaciones' ? 'bg-amber-100 text-amber-800' :
                      sol.tipo === 'Adelanto' ? 'bg-orange-100 text-orange-800' :
                      sol.tipo === 'Préstamo' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {sol.tipo === 'Vacaciones' ? <Palmtree size={18} /> :
                       sol.tipo === 'Adelanto' ? <DollarSign size={18} /> :
                       sol.tipo === 'Préstamo' ? <HandCoins size={18} /> : <Package size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-gray-800 text-sm">{sol.tipo}</span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(sol.fecha_solicitud).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <p className="text-xs text-gray-600 mt-0.5">
                        {sol.tipo === 'Vacaciones' && `Período: ${sol.fecha_inicio} al ${sol.fecha_fin} (${sol.dias_solicitados} días)`}
                        {sol.tipo === 'Adelanto' && `Monto: C$ ${Number(sol.monto).toFixed(2)} (A deducir en próximo corte)`}
                        {sol.tipo === 'Préstamo' && `Monto: C$ ${Number(sol.monto).toFixed(2)} en ${sol.cuotas_sugeridas || 1} cuotas`}
                        {sol.tipo === 'Crédito' && `Producto: ${sol.producto_detalle} • C$ ${Number(sol.monto).toFixed(2)}`}
                      </p>
                      
                      {sol.motivo && (
                        <p className="text-[11px] text-gray-500 italic mt-0.5">
                          "Motivo: {sol.motivo}"
                        </p>
                      )}

                      {sol.observaciones_resolucion && (
                        <div className="mt-1 text-[11px] bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100">
                          Respuesta de Gerencia: {sol.observaciones_resolucion}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center self-end sm:self-center">
                    {sol.estado === 'Pendiente' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock size={12} /> En revisión
                      </span>
                    )}
                    {sol.estado === 'Aprobada' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle2 size={12} /> Aprobada
                      </span>
                    )}
                    {sol.estado === 'Rechazada' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                        <XCircle size={12} /> Rechazada
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DETALLE DE DEUDAS Y DEDUCCIONES VIGENTES (1 COLUMNA) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
            <CreditCard className="text-purple-600" size={18} />
            Mis Deducciones Activas
          </h3>

          {deudasActivas.length === 0 ? (
            <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-gray-100">
              <CheckCircle2 className="mx-auto text-green-500 mb-1" size={28} />
              <p className="font-bold text-gray-700 text-xs">Sin deudas pendientes</p>
              <p className="text-[11px] text-gray-400">Estás al día con tus pagos de salarios.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deudasActivas.map(d => (
                <div key={d.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      d.tipo === 'Adelanto' ? 'bg-orange-100 text-orange-700' :
                      d.tipo === 'Préstamo' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {d.tipo}
                    </span>
                    <span className="font-black text-red-600 text-sm">
                      Saldo: C$ {Number(d.saldo_pendiente).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">{d.motivo}</p>
                  <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1 border-t border-gray-200/50">
                    <span>Monto Original: C$ {Number(d.monto_total).toFixed(2)}</span>
                    <span>Cuota: <strong>C$ {Number(d.cuota_por_pago).toFixed(2)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* MODAL CREAR NUEVA SOLICITUD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header del modal */}
            <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-lg flex items-center gap-2">
                  <FileText className="text-blue-300" size={20} />
                  Nueva Solicitud de Personal
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">
                  El Mingo RRHH • Sujeta a evaluación y aprobación por Gerencia
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                &times;
              </button>
            </div>

            {/* Selector de Tipo */}
            <form onSubmit={handleSubmitSolicitud} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Tipo de Solicitud</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Vacaciones', label: 'Vacaciones (Ley)', icon: <Palmtree size={16} /> },
                    { id: 'Adelanto', label: 'Adelanto Salario', icon: <DollarSign size={16} /> },
                    { id: 'Préstamo', label: 'Préstamo Efectivo', icon: <HandCoins size={16} /> },
                    { id: 'Crédito', label: 'Crédito Producto', icon: <Package size={16} /> }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTipoSol(tab.id)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        tipoSol === tab.id 
                          ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm' 
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CAMPOS DINÁMICOS SEGÚN TIPO */}
              {tipoSol === 'Vacaciones' && (
                <div className="space-y-3 bg-amber-50/50 p-4 rounded-2xl border border-amber-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-800">Saldo actual disponible:</span>
                    <span className="font-black text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full">
                      {diasVacacionesDisponibles} días
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase">Fecha Inicio</label>
                      <input
                        type="date"
                        required
                        value={formSol.fecha_inicio}
                        onChange={e => handleFechasVacacionesChange(e.target.value, formSol.fecha_fin)}
                        className="w-full border p-2 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase">Fecha Fin</label>
                      <input
                        type="date"
                        required
                        value={formSol.fecha_fin}
                        onChange={e => handleFechasVacacionesChange(formSol.fecha_inicio, e.target.value)}
                        className="w-full border p-2 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 font-medium">
                    Total días a solicitar: <strong className="text-amber-800">{formSol.dias_solicitados} días</strong>
                  </div>
                </div>
              )}

              {tipoSol === 'Adelanto' && (
                <div className="space-y-3 bg-orange-50/50 p-4 rounded-2xl border border-orange-200">
                  <div className="text-xs text-orange-800">
                    ℹ️ <strong>Adelanto de Salario:</strong> Dinero deducible en un solo pago íntegro en tu próximo corte de planilla.
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase">Monto Solicitado (C$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Ej: 1,500.00"
                      value={formSol.monto}
                      onChange={e => setFormSol({ ...formSol, monto: e.target.value })}
                      className="w-full border p-2.5 rounded-lg text-sm bg-white font-bold text-gray-800 outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              )}

              {tipoSol === 'Préstamo' && (
                <div className="space-y-3 bg-purple-50/50 p-4 rounded-2xl border border-purple-200">
                  <div className="text-xs text-purple-800">
                    ℹ️ <strong>Préstamo de Dinero:</strong> Dinero en efectivo fuera del salario regular para pagar en cuotas.
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase">Monto Total (C$)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="Ej: 5,000.00"
                        value={formSol.monto}
                        onChange={e => setFormSol({ ...formSol, monto: e.target.value })}
                        className="w-full border p-2 rounded-lg text-sm bg-white font-bold text-gray-800 outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase">N° de Cuotas</label>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        required
                        value={formSol.cuotas_sugeridas}
                        onChange={e => setFormSol({ ...formSol, cuotas_sugeridas: e.target.value })}
                        className="w-full border p-2 rounded-lg text-sm bg-white font-bold outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  {formSol.monto && (
                    <p className="text-[11px] text-purple-700 font-medium">
                      Cuota estimada por pago: <strong>C$ {(Number(formSol.monto) / (Number(formSol.cuotas_sugeridas) || 1)).toFixed(2)}</strong>
                    </p>
                  )}
                </div>
              )}

              {tipoSol === 'Crédito' && (
                <div className="space-y-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-200">
                  <div className="text-xs text-blue-800">
                    ℹ️ <strong>Crédito de Producto:</strong> Retiro de repuestos o productos del inventario con deducción de salario.
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase">Producto Requerido</label>
                    <select
                      value={formSol.id_producto}
                      onChange={e => {
                        const sel = productos.find(p => p.id === e.target.value);
                        setFormSol({
                          ...formSol,
                          id_producto: e.target.value,
                          producto_detalle: sel ? sel.name : '',
                          monto: sel ? sel.price : formSol.monto
                        });
                      }}
                      className="w-full border p-2 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar del catálogo o escribir abajo...</option>
                      {productos.map(p => (
                        <option key={p.id} value={p.id}>{p.name} - C$ {p.price}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase">Monto Estimado (C$)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="Ej: 800.00"
                        value={formSol.monto}
                        onChange={e => setFormSol({ ...formSol, monto: e.target.value })}
                        className="w-full border p-2 rounded-lg text-sm bg-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-600 mb-1 uppercase">N° de Cuotas</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        required
                        value={formSol.cuotas_sugeridas}
                        onChange={e => setFormSol({ ...formSol, cuotas_sugeridas: e.target.value })}
                        className="w-full border p-2 rounded-lg text-sm bg-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MOTIVO GENERAL */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Motivo / Justificación</label>
                <textarea
                  required
                  rows="3"
                  value={formSol.motivo}
                  onChange={e => setFormSol({ ...formSol, motivo: e.target.value })}
                  placeholder="Explica brevemente tu motivo para que Gerencia pueda evaluarlo..."
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                />
              </div>

              {/* BOTONES ACCIÓN */}
              <div className="pt-2 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-xl text-sm shadow-lg shadow-blue-200 transition-all active:scale-95"
                >
                  Enviar Solicitud
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}
