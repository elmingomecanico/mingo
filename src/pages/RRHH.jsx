import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, update, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { 
  Users, CalendarDays, DollarSign, CheckCircle2, History, HandCoins, 
  Palmtree, Clock, FileText, Check, X, AlertCircle, Plus, Eye, Edit3, 
  Search, ShieldAlert, Award, Briefcase, Phone, Mail, MapPin, 
  Calendar, CreditCard, ChevronRight, Sparkles, Filter, CheckCheck,
  Trash2, CalendarPlus, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function RRHH() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('expedientes'); // expedientes, asistencia, solicitudes, generar, historial, deudas
  
  // Datos principales
  const [usuarios, setUsuarios] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [nominas, setNominas] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [asistencias, setAsistencias] = useState({});
  const [loading, setLoading] = useState(true);

  // Filtros y búsquedas
  const [sucursal, setSucursal] = useState('SUC-01');
  const [fechaAsistencia, setFechaAsistencia] = useState(new Date().toISOString().split('T')[0]);
  const [searchEmpleado, setSearchEmpleado] = useState('');

  // Estados para Generar Nómina
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [nominaBorrador, setNominaBorrador] = useState(null);

  // Estados para Modal de Expediente
  const [selectedExpediente, setSelectedExpediente] = useState(null);
  const [isExpedienteModalOpen, setIsExpedienteModalOpen] = useState(false);
  const [expedienteTab, setExpedienteTab] = useState('general'); // general, prestaciones, deudas
  const [formExpediente, setFormExpediente] = useState({});

  // Estados para Registro de Período de Vacaciones
  const [isPeriodoModalOpen, setIsPeriodoModalOpen] = useState(false);
  const [periodoForm, setPeriodoForm] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    dias: 1,
    periodo_correspondiente: '',
    observaciones: ''
  });
  const [periodoAEliminar, setPeriodoAEliminar] = useState(null);

  // Estados para Modal de Deuda Manual
  const [isDeudaModalOpen, setIsDeudaModalOpen] = useState(false);
  const [deudaForm, setDeudaForm] = useState({ 
    id_empleado: '', 
    tipo: 'Adelanto', // Adelanto, Préstamo, Crédito
    monto_total: '', 
    cuota_por_pago: '',
    motivo: '' 
  });

  // Modal para rechazar solicitud con motivo
  const [solicitudARechazar, setSolicitudARechazar] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  useEffect(() => {
    // 1. Cargar empleados/usuarios
    const unsubUsr = onValue(ref(rtdb, 'usuarios'), snap => {
      if (snap.exists()) {
        const parsed = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        setUsuarios(parsed);
      } else {
        setUsuarios([]);
      }
    });

    // 2. Cargar órdenes de trabajo
    const unsubOT = onValue(ref(rtdb, 'ordenes_trabajo'), snap => {
      if (snap.exists()) {
        setOrdenes(Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })));
      }
    });

    // 3. Cargar deudas / deducciones
    const unsubAd = onValue(ref(rtdb, 'deudas_empleados'), snap => {
      if (snap.exists()) {
        const list = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        setDeudas(list.sort((a,b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion)));
      } else {
        setDeudas([]);
      }
    });

    // 4. Cargar nóminas
    const unsubNom = onValue(ref(rtdb, 'nominas'), snap => {
      if (snap.exists()) {
        const parsed = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        setNominas(parsed.sort((a,b) => new Date(b.fecha_generacion) - new Date(a.fecha_generacion)));
      } else {
        setNominas([]);
      }
    });

    // 5. Cargar solicitudes de empleados
    const unsubSol = onValue(ref(rtdb, 'solicitudes_empleados'), snap => {
      if (snap.exists()) {
        const list = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        setSolicitudes(list.sort((a,b) => new Date(b.fecha_solicitud) - new Date(a.fecha_solicitud)));
      } else {
        setSolicitudes([]);
      }
    });

    setLoading(false);

    return () => { unsubUsr(); unsubOT(); unsubAd(); unsubNom(); unsubSol(); };
  }, []);

  // Cargar asistencia de la fecha seleccionada y sucursal
  useEffect(() => {
    if (!fechaAsistencia || !sucursal) return;
    const asisRef = ref(rtdb, `asistencia/${sucursal}/${fechaAsistencia}`);
    const unsubAsis = onValue(asisRef, snap => {
      if (snap.exists()) {
        setAsistencias(snap.val());
      } else {
        setAsistencias({});
      }
    });
    return () => unsubAsis();
  }, [fechaAsistencia, sucursal]);

  // Solicitudes pendientes
  const solicitudesPendientes = solicitudes.filter(s => s.estado === 'Pendiente');

  // Helper para normalizar y ordenar períodos de vacaciones de un empleado
  const getPeriodosVacaciones = (emp) => {
    if (!emp || !emp.periodos_vacaciones) return [];
    if (Array.isArray(emp.periodos_vacaciones)) return emp.periodos_vacaciones;
    return Object.keys(emp.periodos_vacaciones).map(k => ({
      id: k,
      ...emp.periodos_vacaciones[k]
    })).sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio));
  };

  // Helpers de cálculos laborales de Nicaragua
  const calcAntiguedad = (fechaIngresoStr) => {
    if (!fechaIngresoStr) return { anos: 0, meses: 0, dias: 0, texto: 'Sin fecha registrada', mesesTotales: 0, tieneFecha: false };
    const inicio = new Date(fechaIngresoStr + (fechaIngresoStr.length === 10 ? 'T00:00:00' : ''));
    const fin = new Date();
    if (isNaN(inicio.getTime())) return { anos: 0, meses: 0, dias: 0, texto: 'Fecha no válida', mesesTotales: 0, tieneFecha: false };
    
    let anos = fin.getFullYear() - inicio.getFullYear();
    let meses = fin.getMonth() - inicio.getMonth();
    let dias = fin.getDate() - inicio.getDate();
    if (dias < 0) {
      meses -= 1;
      dias += new Date(fin.getFullYear(), fin.getMonth(), 0).getDate();
    }
    if (meses < 0) {
      anos -= 1;
      meses += 12;
    }
    const mesesTotales = Math.max(0, (anos * 12) + meses + (dias / 30));
    const texto = anos > 0 ? `${anos} a, ${meses} m` : `${meses} m, ${dias} d`;
    return { anos, meses, dias, texto, mesesTotales, tieneFecha: true };
  };

  const calcVacaciones = (emp) => {
    if (!emp) return { diasAcumulados: 0, diasTomados: 0, diasDisponibles: 0, saldoReal: 0, periodos: [], tieneFecha: false };
    const antig = calcAntiguedad(emp.fecha_ingreso);
    // Art. 76 Código del Trabajo de Nicaragua: 15 días continuos por cada 6 meses continuos = 2.5 días por mes trabajado
    const diasAcumulados = antig.tieneFecha ? Number((antig.mesesTotales * 2.5).toFixed(1)) : 0;
    const periodos = getPeriodosVacaciones(emp);
    
    // Si tiene períodos registrados en bitácora, ese es el valor 100% auditado con fechas
    const diasTomadosPeriodos = periodos.reduce((acc, p) => acc + Number(p.dias || 0), 0);
    const diasTomados = periodos.length > 0 
      ? Number(diasTomadosPeriodos.toFixed(1)) 
      : Number(emp.dias_vacaciones_tomados || 0);

    const saldoReal = Number((diasAcumulados - diasTomados).toFixed(1));
    const diasDisponibles = Math.max(0, saldoReal);
    return { diasAcumulados, diasTomados, diasDisponibles, saldoReal, periodos, tieneFecha: antig.tieneFecha };
  };

  const calcPrestacionesNicaragua = (emp) => {
    const { anos, meses, dias, tieneFecha } = calcAntiguedad(emp?.fecha_ingreso);
    const salarioBase = Number(emp?.salario_base || 0);
    
    if (!tieneFecha || salarioBase <= 0) {
      return { aguinaldoAcumulado: 0, indemnizacionMonto: 0, mesesIndemnizacion: 0 };
    }

    // Aguinaldo (Décimo Tercer Mes): 1 mes de salario por año trabajado o proporcional
    const hoy = new Date();
    const mesesPeriodoAguinaldo = hoy.getMonth() + 1; // del 1 de dic a la fecha
    const aguinaldoAcumulado = Number(((salarioBase / 12) * mesesPeriodoAguinaldo).toFixed(2));

    // Indemnización por Años de Servicio (Art. 45): 1 mes por cada uno de los primeros 3 años, y 20 días por año adicional (máx 5 meses)
    const fracAnos = anos + (meses / 12) + (dias / 365);
    let mesesIndemnizacion = 0;
    if (fracAnos <= 3) {
      mesesIndemnizacion = fracAnos * 1;
    } else {
      mesesIndemnizacion = Math.min(5, 3 + ((fracAnos - 3) * (20 / 30)));
    }
    const indemnizacionMonto = Number((salarioBase * mesesIndemnizacion).toFixed(2));

    return {
      aguinaldoAcumulado,
      indemnizacionMonto,
      mesesIndemnizacion: Number(mesesIndemnizacion.toFixed(2))
    };
  };

  // Abrir Ficha de Expediente
  const handleOpenExpediente = (emp) => {
    setSelectedExpediente(emp);
    setFormExpediente({
      nombre_completo: emp.nombre_completo || '',
      cedula: emp.cedula || '',
      telefono: emp.telefono || '',
      direccion: emp.direccion || '',
      fecha_ingreso: emp.fecha_ingreso || '',
      funcion: emp.funcion || 'Mecánico',
      id_sucursal: emp.id_sucursal || 'SUC-01',
      estado: emp.estado || 'Activo',
      tipo_salario: emp.tipo_salario || 'Comisión',
      salario_base: emp.salario_base || 0,
      porcentaje_comision: emp.porcentaje_comision || 50,
      dias_vacaciones_tomados: emp.dias_vacaciones_tomados || 0,
      contacto_emergencia: emp.contacto_emergencia || '',
      notas_expediente: emp.notas_expediente || ''
    });
    setExpedienteTab('general');
    setIsExpedienteModalOpen(true);
  };

  // Guardar Edición de Expediente
  const handleSaveExpediente = async (e) => {
    e.preventDefault();
    if (!selectedExpediente) return;

    try {
      const activeEmp = usuarios.find(u => u.id === selectedExpediente.id) || selectedExpediente;
      const periodos = getPeriodosVacaciones(activeEmp);
      const totalTomados = periodos.length > 0
        ? Number(periodos.reduce((acc, p) => acc + Number(p.dias || 0), 0).toFixed(1))
        : Number(formExpediente.dias_vacaciones_tomados || 0);

      await update(ref(rtdb, `usuarios/${selectedExpediente.id}`), {
        nombre_completo: formExpediente.nombre_completo.trim(),
        cedula: formExpediente.cedula.trim(),
        telefono: formExpediente.telefono.trim(),
        direccion: formExpediente.direccion.trim(),
        fecha_ingreso: formExpediente.fecha_ingreso || '',
        funcion: formExpediente.funcion,
        id_sucursal: formExpediente.id_sucursal,
        estado: formExpediente.estado,
        tipo_salario: formExpediente.tipo_salario,
        salario_base: Number(formExpediente.salario_base) || 0,
        porcentaje_comision: Number(formExpediente.porcentaje_comision) || 0,
        dias_vacaciones_tomados: totalTomados,
        contacto_emergencia: formExpediente.contacto_emergencia.trim(),
        notas_expediente: formExpediente.notas_expediente.trim()
      });

      toast.success('Expediente actualizado exitosamente');
      setIsExpedienteModalOpen(false);
    } catch (err) {
      toast.error('Error al actualizar expediente: ' + err.message);
    }
  };

  // Apertura y gestión de período de vacaciones
  const handleAbrirModalPeriodo = (empTarget) => {
    const hoyStr = new Date().toISOString().split('T')[0];
    const anioActual = new Date().getFullYear();
    setPeriodoForm({
      fecha_inicio: hoyStr,
      fecha_fin: hoyStr,
      dias: 1,
      periodo_correspondiente: `Período ${anioActual - 1} - ${anioActual}`,
      observaciones: 'Registro histórico de vacaciones gozadas'
    });
    setIsPeriodoModalOpen(true);
  };

  const handlePeriodoFechaChange = (campo, valor) => {
    setPeriodoForm(prev => {
      const nuevo = { ...prev, [campo]: valor };
      if (nuevo.fecha_inicio && nuevo.fecha_fin) {
        const d1 = new Date(nuevo.fecha_inicio + 'T00:00:00');
        const d2 = new Date(nuevo.fecha_fin + 'T00:00:00');
        const diffMs = d2 - d1;
        if (!isNaN(diffMs)) {
          const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
          if (diffDias > 0) {
            nuevo.dias = diffDias;
          }
        }
      }
      return nuevo;
    });
  };

  const handleGuardarPeriodoVacaciones = async (e) => {
    e.preventDefault();
    if (!selectedExpediente) return;
    const activeEmp = usuarios.find(u => u.id === selectedExpediente.id) || selectedExpediente;
    const empHireDate = formExpediente.fecha_ingreso || activeEmp.fecha_ingreso;

    if (!periodoForm.fecha_inicio || !periodoForm.fecha_fin) {
      return toast.error('Debe ingresar las fechas de inicio y fin del descanso.');
    }

    const dInicio = new Date(periodoForm.fecha_inicio + 'T00:00:00');
    const dFin = new Date(periodoForm.fecha_fin + 'T00:00:00');

    if (dFin < dInicio) {
      return toast.error('La fecha de fin no puede ser anterior a la fecha de inicio.');
    }

    if (empHireDate) {
      const dIngreso = new Date(empHireDate + 'T00:00:00');
      if (dInicio < dIngreso) {
        return toast.error(`Inconsistencia temporal: La fecha de inicio de vacaciones (${periodoForm.fecha_inicio}) no puede ser anterior a la fecha de contratación del empleado (${empHireDate}). Todo período de descanso debe corresponder al tiempo laborado.`);
      }
    }

    const diasNum = Number(periodoForm.dias);
    if (!diasNum || diasNum <= 0) {
      return toast.error('La cantidad de días debe ser mayor a 0.');
    }

    try {
      const nuevoRef = push(ref(rtdb, `usuarios/${activeEmp.id}/periodos_vacaciones`));
      await set(nuevoRef, {
        fecha_inicio: periodoForm.fecha_inicio,
        fecha_fin: periodoForm.fecha_fin,
        dias: diasNum,
        periodo_correspondiente: periodoForm.periodo_correspondiente.trim() || 'Período Vacacional',
        tipo_registro: 'Histórico / Asentado',
        observaciones: periodoForm.observaciones.trim() || 'Registro histórico de vacaciones gozadas',
        registrado_por: user?.nombre_completo || 'Gerencia',
        fecha_registro: new Date().toISOString()
      });

      // Recalcular total de días tomados
      const periodosActuales = getPeriodosVacaciones(activeEmp);
      const totalTomados = periodosActuales.reduce((acc, p) => acc + Number(p.dias || 0), 0) + diasNum;

      await update(ref(rtdb, `usuarios/${activeEmp.id}`), {
        dias_vacaciones_tomados: Number(totalTomados.toFixed(1))
      });

      setFormExpediente(prev => ({
        ...prev,
        dias_vacaciones_tomados: Number(totalTomados.toFixed(1))
      }));

      toast.success(`Período de vacaciones registrado exitosamente (${diasNum} días auditados)`);
      setIsPeriodoModalOpen(false);
    } catch (err) {
      toast.error('Error al registrar período: ' + err.message);
    }
  };

  const handleConfirmarEliminarPeriodo = async () => {
    if (!selectedExpediente || !periodoAEliminar) return;
    const activeEmp = usuarios.find(u => u.id === selectedExpediente.id) || selectedExpediente;

    try {
      await remove(ref(rtdb, `usuarios/${activeEmp.id}/periodos_vacaciones/${periodoAEliminar.id}`));

      // Recalcular total sin el período eliminado
      const periodosActuales = getPeriodosVacaciones(activeEmp).filter(p => p.id !== periodoAEliminar.id);
      const totalTomados = periodosActuales.reduce((acc, p) => acc + Number(p.dias || 0), 0);

      await update(ref(rtdb, `usuarios/${activeEmp.id}`), {
        dias_vacaciones_tomados: Number(totalTomados.toFixed(1))
      });

      setFormExpediente(prev => ({
        ...prev,
        dias_vacaciones_tomados: Number(totalTomados.toFixed(1))
      }));

      toast.success('Período de vacaciones eliminado y días reintegrados al saldo disponible');
      setPeriodoAEliminar(null);
    } catch (err) {
      toast.error('Error al eliminar período: ' + err.message);
    }
  };

  // Pase de asistencia rápido (Marcar todos presentes)
  const handleMarcarTodosPresentes = async () => {
    try {
      const empleadosSucursal = usuarios.filter(u => u.estado === 'Activo' && (u.id_sucursal === sucursal || !u.id_sucursal));
      const horaActual = '08:00 AM';

      for (const emp of empleadosSucursal) {
        const asisRef = ref(rtdb, `asistencia/${sucursal}/${fechaAsistencia}/${emp.id}`);
        await set(asisRef, {
          id_empleado: emp.id,
          nombre_empleado: emp.nombre_completo,
          fecha: fechaAsistencia,
          hora_entrada: horaActual,
          hora_salida: '05:00 PM',
          estado: 'Presente',
          notas: 'Pase general de asistencia',
          registrado_por: user?.nombre_completo || 'Gerencia'
        });
      }
      toast.success(`Asistencia registrada para ${empleadosSucursal.length} empleados.`);
    } catch (err) {
      toast.error('Error al registrar asistencia: ' + err.message);
    }
  };

  // Cambiar estado individual de asistencia
  const handleUpdateAsistencia = async (empId, empNombre, newEstado) => {
    try {
      const asisRef = ref(rtdb, `asistencia/${sucursal}/${fechaAsistencia}/${empId}`);
      const actual = asistencias[empId] || {};
      await set(asisRef, {
        id_empleado: empId,
        nombre_empleado: empNombre,
        fecha: fechaAsistencia,
        hora_entrada: actual.hora_entrada || (newEstado === 'Presente' ? '08:00 AM' : '--'),
        hora_salida: actual.hora_salida || '05:00 PM',
        estado: newEstado,
        notas: actual.notas || '',
        registrado_por: user?.nombre_completo || 'Gerencia'
      });
      toast.success(`Estado actualizado: ${newEstado}`);
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  // APROBACIÓN DE SOLICITUDES DE EMPLEADOS
  const handleAprobarSolicitud = async (sol) => {
    try {
      // 1. Marcar solicitud como aprobada
      await update(ref(rtdb, `solicitudes_empleados/${sol.id}`), {
        estado: 'Aprobada',
        fecha_resolucion: new Date().toISOString(),
        resuelta_por: user?.nombre_completo || 'Gerencia'
      });

      // 2. Ejecutar efectos según tipo
      if (sol.tipo === 'Vacaciones') {
        const emp = usuarios.find(u => u.id === sol.id_empleado);
        const periodosExistentes = getPeriodosVacaciones(emp);
        const diasSol = Number(sol.dias_solicitados || 0);

        const nuevoPeriodoRef = push(ref(rtdb, `usuarios/${sol.id_empleado}/periodos_vacaciones`));
        await set(nuevoPeriodoRef, {
          fecha_inicio: sol.fecha_inicio || new Date().toISOString().split('T')[0],
          fecha_fin: sol.fecha_fin || sol.fecha_inicio || new Date().toISOString().split('T')[0],
          dias: diasSol,
          periodo_correspondiente: `Solicitud Aprobada (${sol.fecha_inicio || ''} al ${sol.fecha_fin || ''})`,
          tipo_registro: 'Solicitud Aprobada',
          observaciones: sol.motivo ? `Aprobado por gerencia: ${sol.motivo}` : 'Vacaciones aprobadas por Gerencia',
          registrado_por: user?.nombre_completo || 'Gerencia',
          fecha_registro: new Date().toISOString()
        });

        const nuevoTotalTomados = periodosExistentes.reduce((sum, p) => sum + Number(p.dias || 0), 0) + diasSol;
        await update(ref(rtdb, `usuarios/${sol.id_empleado}`), {
          dias_vacaciones_tomados: Number(nuevoTotalTomados.toFixed(1))
        });
        toast.success(`Vacaciones aprobadas. Se registraron ${diasSol} días en la bitácora del colaborador.`);
      } else if (sol.tipo === 'Adelanto') {
        await push(ref(rtdb, 'deudas_empleados'), {
          id_empleado: sol.id_empleado,
          tipo: 'Adelanto',
          monto_total: Number(sol.monto),
          saldo_pendiente: Number(sol.monto),
          cuota_por_pago: Number(sol.monto), // Deducción íntegra en el próximo corte
          motivo: `Adelanto de salario: ${sol.motivo}`,
          fecha_creacion: new Date().toISOString(),
          estado: 'Activo'
        });
        toast.success(`Adelanto de C$ ${sol.monto} aprobado y programado para deducción.`);
      } else if (sol.tipo === 'Préstamo') {
        const cuotas = Number(sol.cuotas_sugeridas) || 1;
        const cuotaMonto = Number((Number(sol.monto) / cuotas).toFixed(2));
        await push(ref(rtdb, 'deudas_empleados'), {
          id_empleado: sol.id_empleado,
          tipo: 'Préstamo',
          monto_total: Number(sol.monto),
          saldo_pendiente: Number(sol.monto),
          cuota_por_pago: cuotaMonto,
          motivo: `Préstamo de dinero (${cuotas} cuotas): ${sol.motivo}`,
          fecha_creacion: new Date().toISOString(),
          estado: 'Activo'
        });
        toast.success(`Préstamo de C$ ${sol.monto} aprobado en ${cuotas} cuotas.`);
      } else if (sol.tipo === 'Crédito') {
        const cuotas = Number(sol.cuotas_sugeridas) || 1;
        const cuotaMonto = Number((Number(sol.monto) / cuotas).toFixed(2));
        await push(ref(rtdb, 'deudas_empleados'), {
          id_empleado: sol.id_empleado,
          tipo: 'Crédito',
          monto_total: Number(sol.monto),
          saldo_pendiente: Number(sol.monto),
          cuota_por_pago: cuotaMonto,
          motivo: `Crédito de producto (${sol.producto_detalle || 'Producto'}): ${sol.motivo}`,
          fecha_creacion: new Date().toISOString(),
          estado: 'Activo'
        });
        toast.success(`Crédito de producto por C$ ${sol.monto} aprobado.`);
      }
    } catch (err) {
      toast.error('Error al aprobar solicitud: ' + err.message);
    }
  };

  // RECHAZO DE SOLICITUD
  const handleConfirmarRechazo = async () => {
    if (!solicitudARechazar) return;
    try {
      await update(ref(rtdb, `solicitudes_empleados/${solicitudARechazar.id}`), {
        estado: 'Rechazada',
        fecha_resolucion: new Date().toISOString(),
        resuelta_por: user?.nombre_completo || 'Gerencia',
        observaciones_resolucion: motivoRechazo.trim() || 'No autorizada por gerencia en este momento'
      });
      toast.success('Solicitud rechazada');
      setSolicitudARechazar(null);
      setMotivoRechazo('');
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  };

  // CÁLCULO DE NÓMINA FLEXIBLE
  const calcularNomina = () => {
    if (!fechaInicio || !fechaFin) return toast.error("Seleccione un rango de fechas");
    if (new Date(fechaInicio) > new Date(fechaFin)) return toast.error("Fecha de inicio no puede ser mayor a fecha fin");

    const start = new Date(fechaInicio + 'T00:00:00');
    const end = new Date(fechaFin + 'T23:59:59');

    const borrador = usuarios.filter(u => u.estado === 'Activo').map(emp => {
      // 1. Calcular Comisiones en el rango
      const susOrdenes = ordenes.filter(ot => {
        const otDate = new Date(ot.fecha_creacion);
        return ot.id_mecanico === emp.id && otDate >= start && otDate <= end && ot.estado === 'Completado';
      });
      const totalComisiones = susOrdenes.reduce((sum, ot) => sum + (ot.comision_mecanico_monto || 0), 0);

      // 2. Obtener deudas activas que tengan saldo pendiente
      const susDeudas = deudas.filter(d => d.id_empleado === emp.id && d.estado === 'Activo' && d.saldo_pendiente > 0);
      
      const detallesDeducciones = susDeudas.map(d => {
        const aDeducir = Math.min(Number(d.cuota_por_pago), Number(d.saldo_pendiente));
        return {
          id_deuda: d.id,
          tipo: d.tipo,
          motivo: d.motivo,
          monto_deducido: aDeducir
        };
      });

      const totalDeducciones = detallesDeducciones.reduce((sum, d) => sum + d.monto_deducido, 0);
      const sueldoBaseAplicar = emp.salario_base || 0;

      return {
        id_empleado: emp.id,
        nombre: emp.nombre_completo,
        tipo_salario: emp.tipo_salario || 'Comisión',
        sueldo_base: sueldoBaseAplicar,
        comisiones: totalComisiones,
        deducciones: totalDeducciones,
        detalles_deducciones: detallesDeducciones,
        neto: (sueldoBaseAplicar + totalComisiones) - totalDeducciones
      };
    });

    setNominaBorrador(borrador);
    toast.success("Cálculo preliminar generado");
  };

  const handleSueldoBaseChange = (id_empleado, nuevoSueldo) => {
    setNominaBorrador(prev => prev.map(line => {
      if (line.id_empleado === id_empleado) {
        const val = Number(nuevoSueldo) || 0;
        return { ...line, sueldo_base: val, neto: (val + line.comisiones) - line.deducciones };
      }
      return line;
    }));
  };

  const guardarNomina = async () => {
    if (!nominaBorrador || nominaBorrador.length === 0) return;
    
    try {
      const nominaRef = push(ref(rtdb, 'nominas'));
      const totalPlanilla = nominaBorrador.reduce((sum, l) => sum + l.neto, 0);

      await set(nominaRef, {
        fecha_generacion: new Date().toISOString(),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        total_pagado: totalPlanilla,
        detalles: nominaBorrador
      });

      // Procesar cada deducción y actualizar saldos
      for (const line of nominaBorrador) {
        if (line.detalles_deducciones && line.detalles_deducciones.length > 0) {
          for (const ded of line.detalles_deducciones) {
            const deudaOriginal = deudas.find(d => d.id === ded.id_deuda);
            if (deudaOriginal) {
              const nuevoSaldo = Number(deudaOriginal.saldo_pendiente) - ded.monto_deducido;
              const nuevoEstado = nuevoSaldo <= 0 ? 'Pagado' : 'Activo';
              
              await update(ref(rtdb, `deudas_empleados/${ded.id_deuda}`), { 
                saldo_pendiente: nuevoSaldo,
                estado: nuevoEstado 
              });
            }
          }
        }
      }

      toast.success("Nómina guardada y deducciones aplicadas");
      setNominaBorrador(null);
      setFechaInicio('');
      setFechaFin('');
      setActiveTab('historial');
    } catch (error) {
      toast.error("Error al guardar nómina: " + error.message);
    }
  };

  const guardarDeudaManual = async (e) => {
    e.preventDefault();
    if (!deudaForm.id_empleado || !deudaForm.monto_total || !deudaForm.cuota_por_pago) {
      return toast.error("Complete los campos obligatorios");
    }

    try {
      await push(ref(rtdb, 'deudas_empleados'), {
        id_empleado: deudaForm.id_empleado,
        tipo: deudaForm.tipo,
        monto_total: Number(deudaForm.monto_total),
        saldo_pendiente: Number(deudaForm.monto_total),
        cuota_por_pago: Number(deudaForm.cuota_por_pago),
        motivo: deudaForm.motivo || `${deudaForm.tipo} registrado por RRHH`,
        fecha_creacion: new Date().toISOString(),
        estado: 'Activo'
      });
      toast.success(`${deudaForm.tipo} registrado exitosamente`);
      setIsDeudaModalOpen(false);
      setDeudaForm({ id_empleado: '', tipo: 'Adelanto', monto_total: '', cuota_por_pago: '', motivo: '' });
    } catch (error) {
      toast.error("Error: " + error.message);
    }
  };

  // Filtrado de empleados en expedientes
  const filteredEmpleados = usuarios.filter(u => {
    const text = `${u.nombre_completo || ''} ${u.funcion || ''} ${u.cedula || ''}`.toLowerCase();
    return text.includes(searchEmpleado.toLowerCase());
  });

  // Empleado activo para el modal de expediente con cálculos reactivos en vivo
  const activeExpedienteEmp = selectedExpediente ? (usuarios.find(u => u.id === selectedExpediente.id) || selectedExpediente) : null;
  const empCalculoModal = activeExpedienteEmp ? {
    ...activeExpedienteEmp,
    fecha_ingreso: formExpediente.fecha_ingreso || activeExpedienteEmp.fecha_ingreso || '',
    salario_base: formExpediente.salario_base !== undefined ? formExpediente.salario_base : activeExpedienteEmp.salario_base
  } : null;
  const vacInfoModal = empCalculoModal ? calcVacaciones(empCalculoModal) : null;
  const antigModal = empCalculoModal ? calcAntiguedad(empCalculoModal.fecha_ingreso) : null;
  const prestModal = empCalculoModal ? calcPrestacionesNicaragua(empCalculoModal) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      
      {/* HEADER DE LA PÁGINA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600" /> 
            Recursos Humanos y Nómina Integral
          </h1>
          <p className="text-gray-500 text-sm">
            Expedientes de personal, asistencia diaria, vacaciones por ley, solicitudes de colaboradores y cálculo flexible de planilla.
          </p>
        </div>

        <div className="flex gap-2">
          {solicitudesPendientes.length > 0 && (
            <button
              onClick={() => setActiveTab('solicitudes')}
              className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors animate-pulse"
            >
              <Clock size={16} className="text-amber-700" />
              {solicitudesPendientes.length} Solicitud(es) Pendiente(s)
            </button>
          )}
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN MODULAR */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200 scrollbar-hide">
        {[
          { id: 'expedientes', label: 'Expedientes de Personal', icon: <Briefcase size={16} /> },
          { id: 'asistencia', label: 'Control de Asistencia', icon: <Clock size={16} /> },
          { id: 'solicitudes', label: `Solicitudes (${solicitudesPendientes.length})`, icon: <Palmtree size={16} /> },
          { id: 'generar', label: 'Generar Planilla', icon: <CalendarDays size={16} /> },
          { id: 'historial', label: 'Historial de Nóminas', icon: <History size={16} /> },
          { id: 'deudas', label: 'Deducciones y Deudas', icon: <HandCoins size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === tab.id 
                ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 1. PESTAÑA: EXPEDIENTES DE PERSONAL                                       */}
      {/* ========================================================================= */}
      {activeTab === 'expedientes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar por nombre, cargo o cédula..."
                value={searchEmpleado}
                onChange={e => setSearchEmpleado(e.target.value)}
                className="w-full border p-2.5 pl-9 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-3 text-gray-400" size={16} />
            </div>

            <div className="flex gap-2 text-xs font-bold text-gray-500 w-full sm:w-auto justify-end">
              <span className="bg-gray-100 px-3 py-1.5 rounded-lg">
                Total Personal: <strong>{usuarios.length}</strong>
              </span>
              <span className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200">
                Activos: <strong>{usuarios.filter(u => u.estado === 'Activo').length}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmpleados.map(emp => {
              const { texto: antiguedadTexto } = calcAntiguedad(emp.fecha_ingreso);
              const { diasDisponibles, diasAcumulados } = calcVacaciones(emp);
              const { aguinaldoAcumulado } = calcPrestacionesNicaragua(emp);

              return (
                <div 
                  key={emp.id} 
                  className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 font-black text-lg flex items-center justify-center">
                        {emp.nombre_completo?.charAt(0) || 'E'}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-base">{emp.nombre_completo}</h3>
                        <p className="text-xs font-medium text-blue-600">{emp.funcion || 'Colaborador'}</p>
                        <span className="text-[11px] text-gray-400 font-mono">Céd: {emp.cedula || 'Pendiente'}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      emp.estado === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {emp.estado || 'Activo'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div>
                      <span className="text-gray-400 text-[10px] block uppercase font-bold">Esquema</span>
                      <strong className="text-gray-700">
                        {emp.tipo_salario || 'Comisión'} {emp.tipo_salario === 'Fijo' ? `(C$ ${emp.salario_base || 0})` : `(${emp.porcentaje_comision || 50}%)`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block uppercase font-bold">Antigüedad</span>
                      <strong className="text-gray-700">{antiguedadTexto}</strong>
                    </div>
                    <div className="mt-1">
                      <span className="text-gray-400 text-[10px] block uppercase font-bold">Vacaciones Disp.</span>
                      <strong className="text-amber-700">{diasDisponibles} días</strong>
                    </div>
                    <div className="mt-1">
                      <span className="text-gray-400 text-[10px] block uppercase font-bold">Aguinaldo Est.</span>
                      <strong className="text-green-700">C$ {aguinaldoAcumulado}</strong>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-[11px] text-gray-400">Sucursal: <strong>{emp.id_sucursal || 'SUC-01'}</strong></span>
                    <button
                      onClick={() => handleOpenExpediente(emp)}
                      className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
                    >
                      <Eye size={14} /> Ficha y Expediente
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. PESTAÑA: CONTROL DE ASISTENCIA                                         */}
      {/* ========================================================================= */}
      {activeTab === 'asistencia' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Fecha de Registro</label>
                <input
                  type="date"
                  value={fechaAsistencia}
                  onChange={e => setFechaAsistencia(e.target.value)}
                  className="border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Sucursal</label>
                <select
                  value={sucursal}
                  onChange={e => setSucursal(e.target.value)}
                  className="border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-white"
                >
                  <option value="SUC-01">Sucursal Principal (SUC-01)</option>
                  <option value="SUC-02">Sucursal Norte (SUC-02)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleMarcarTodosPresentes}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <CheckCheck size={16} /> Marcar Todos Presentes (Hoy)
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                  <tr>
                    <th className="p-4">Colaborador</th>
                    <th className="p-4">Cargo / Función</th>
                    <th className="p-4 text-center">Estado de Asistencia</th>
                    <th className="p-4 text-center">Hora Entrada</th>
                    <th className="p-4 text-center">Hora Salida</th>
                    <th className="p-4">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuarios.filter(u => u.estado === 'Activo' && (u.id_sucursal === sucursal || !u.id_sucursal)).map(emp => {
                    const record = asistencias[emp.id] || {};
                    const estado = record.estado || 'Sin registrar';

                    return (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="p-4">
                          <span className="font-bold text-gray-800">{emp.nombre_completo}</span>
                        </td>
                        <td className="p-4 text-xs font-semibold text-gray-500">
                          {emp.funcion || 'Colaborador'}
                        </td>
                        <td className="p-4 text-center">
                          <div className="inline-flex gap-1 bg-gray-100 p-1 rounded-xl">
                            {['Presente', 'Tardanza', 'Falta', 'Vacaciones'].map(st => (
                              <button
                                key={st}
                                onClick={() => handleUpdateAsistencia(emp.id, emp.nombre_completo, st)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                  estado === st 
                                    ? (st === 'Presente' ? 'bg-green-600 text-white shadow-xs' :
                                       st === 'Tardanza' ? 'bg-amber-500 text-white shadow-xs' :
                                       st === 'Falta' ? 'bg-red-600 text-white shadow-xs' : 'bg-blue-600 text-white shadow-xs')
                                    : 'text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-center font-mono text-xs text-gray-600">
                          {record.hora_entrada || '--:--'}
                        </td>
                        <td className="p-4 text-center font-mono text-xs text-gray-600">
                          {record.hora_salida || '--:--'}
                        </td>
                        <td className="p-4 text-xs text-gray-400">
                          {record.notas || 'Sin notas'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PESTAÑA: BANDEJA DE SOLICITUDES DE PERSONAL                            */}
      {/* ========================================================================= */}
      {activeTab === 'solicitudes' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="font-bold text-gray-800 text-base mb-1">Bandeja de Aprobación de Solicitudes</h2>
            <p className="text-xs text-gray-500">
              Revisa y aprueba solicitudes de vacaciones, adelantos, créditos de repuestos y préstamos solicitadas por los empleados desde su portal.
            </p>
          </div>

          {solicitudes.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-400">
              <Palmtree className="mx-auto mb-2 opacity-50" size={36} />
              <p className="font-bold text-sm">No hay solicitudes registradas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {solicitudes.map(sol => (
                <div 
                  key={sol.id} 
                  className={`bg-white p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                    sol.estado === 'Pendiente' ? 'border-amber-300 bg-amber-50/20' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl ${
                      sol.tipo === 'Vacaciones' ? 'bg-amber-100 text-amber-800' :
                      sol.tipo === 'Adelanto' ? 'bg-orange-100 text-orange-800' :
                      sol.tipo === 'Préstamo' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {sol.tipo === 'Vacaciones' ? <Palmtree size={22} /> :
                       sol.tipo === 'Adelanto' ? <DollarSign size={22} /> :
                       sol.tipo === 'Préstamo' ? <HandCoins size={22} /> : <Package size={22} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-gray-800 text-base">{sol.nombre_empleado}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {sol.tipo}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(sol.fecha_solicitud).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-sm text-gray-700 mt-1 font-medium">
                        {sol.tipo === 'Vacaciones' && (
                          <span>Período solicitado: <strong>{sol.fecha_inicio}</strong> al <strong>{sol.fecha_fin}</strong> (<strong>{sol.dias_solicitados} días</strong>)</span>
                        )}
                        {sol.tipo === 'Adelanto' && (
                          <span>Monto: <strong className="text-orange-700">C$ {Number(sol.monto).toFixed(2)}</strong> (Deducción íntegra en el próximo corte)</span>
                        )}
                        {sol.tipo === 'Préstamo' && (
                          <span>Monto: <strong className="text-purple-700">C$ {Number(sol.monto).toFixed(2)}</strong> en <strong>{sol.cuotas_sugeridas || 1} cuotas</strong></span>
                        )}
                        {sol.tipo === 'Crédito' && (
                          <span>Producto: <strong>{sol.producto_detalle}</strong> • Valor: <strong className="text-blue-700">C$ {Number(sol.monto).toFixed(2)}</strong></span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 italic mt-0.5">
                        Motivo: "{sol.motivo}"
                      </p>

                      {sol.observaciones_resolucion && (
                        <p className="text-xs text-red-600 mt-1 font-medium">
                          Motivo rechazo: {sol.observaciones_resolucion}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    {sol.estado === 'Pendiente' ? (
                      <>
                        <button
                          onClick={() => handleAprobarSolicitud(sol)}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Check size={14} /> Aprobar
                        </button>
                        <button
                          onClick={() => { setSolicitudARechazar(sol); setMotivoRechazo(''); }}
                          className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                        >
                          <X size={14} /> Rechazar
                        </button>
                      </>
                    ) : (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        sol.estado === 'Aprobada' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {sol.estado} por {sol.resuelta_por || 'Gerencia'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PESTAÑA: GENERAR PLANILLA / CORTES FLEXIBLES                           */}
      {/* ========================================================================= */}
      {activeTab === 'generar' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Fecha Inicio</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Fecha Fin</label>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
            </div>
            <button onClick={calcularNomina} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200 transition-all">
              <CalendarDays size={18} /> Calcular Planilla
            </button>
          </div>

          {nominaBorrador && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><DollarSign className="text-green-600" /> Borrador de Planilla</h3>
                <span className="text-xs text-gray-500">Puedes ajustar el sueldo proporcional si es corte semanal o quincenal.</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-white text-gray-500 font-bold border-b border-gray-100">
                    <tr>
                      <th className="p-4">Empleado</th>
                      <th className="p-4">Esquema</th>
                      <th className="p-4 w-40">Sueldo Fijo (C$)</th>
                      <th className="p-4 text-green-600">Comisiones (+)</th>
                      <th className="p-4 text-red-500">Deducciones (-)</th>
                      <th className="p-4 text-blue-700 font-black">Total a Pagar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {nominaBorrador.map(line => (
                      <tr key={line.id_empleado} className="hover:bg-gray-50">
                        <td className="p-4 font-bold text-gray-800">{line.nombre}</td>
                        <td className="p-4 text-xs font-bold text-gray-500 uppercase">{line.tipo_salario}</td>
                        <td className="p-4">
                          <input 
                            type="number" 
                            className="w-full border p-2 rounded-lg outline-none focus:border-blue-500 font-medium"
                            value={line.sueldo_base}
                            onChange={(e) => handleSueldoBaseChange(line.id_empleado, e.target.value)}
                            disabled={line.tipo_salario === 'Comisión'}
                          />
                        </td>
                        <td className="p-4 font-bold text-green-600">C$ {line.comisiones.toFixed(2)}</td>
                        <td className="p-4">
                          <div className="font-bold text-red-500">C$ {line.deducciones.toFixed(2)}</div>
                          {line.detalles_deducciones.length > 0 && (
                            <div className="text-[10px] text-gray-400 mt-1">
                              {line.detalles_deducciones.map(d => `${d.tipo} (C$${d.monto_deducido})`).join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="p-4 font-black text-blue-700 text-base">C$ {line.neto.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-50 font-black text-blue-900 border-t border-blue-100">
                    <tr>
                      <td colSpan="5" className="p-4 text-right uppercase">Total Planilla a Desembolsar:</td>
                      <td className="p-4 text-lg">C$ {nominaBorrador.reduce((sum, l) => sum + l.neto, 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="p-4 bg-gray-50 flex justify-end">
                <button onClick={guardarNomina} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md shadow-green-200">
                  <CheckCircle2 size={18} /> Aprobar y Guardar Nómina
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PESTAÑA: HISTORIAL DE NÓMINAS                                          */}
      {/* ========================================================================= */}
      {activeTab === 'historial' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {nominas.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No hay nóminas registradas.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                  <tr>
                    <th className="p-4">Fecha de Generación</th>
                    <th className="p-4">Período Cobrado</th>
                    <th className="p-4">Total Pagado</th>
                    <th className="p-4">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {nominas.map(nom => (
                    <tr key={nom.id}>
                      <td className="p-4 font-bold text-gray-800">{new Date(nom.fecha_generacion).toLocaleDateString()}</td>
                      <td className="p-4 text-gray-600">{nom.fecha_inicio} al {nom.fecha_fin}</td>
                      <td className="p-4 font-black text-green-600">C$ {nom.total_pagado?.toFixed(2)}</td>
                      <td className="p-4 text-xs text-gray-500">{nom.detalles?.length} empleados pagados</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PESTAÑA: DEDUCCIONES Y DEUDAS                                          */}
      {/* ========================================================================= */}
      {activeTab === 'deudas' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100">
            <div>
              <h2 className="font-bold text-gray-800 text-sm">Control de Deudas y Deducciones</h2>
              <p className="text-xs text-gray-500">Adelantos de salario, préstamos en cuotas y créditos de repuestos.</p>
            </div>
            <button onClick={() => {
              setDeudaForm({ id_empleado: '', tipo: 'Adelanto', monto_total: '', cuota_por_pago: '', motivo: '' });
              setIsDeudaModalOpen(true);
            }} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-purple-200 text-xs">
              <HandCoins size={16} /> Registrar Deuda Manual
            </button>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {deudas.length === 0 ? (
              <div className="p-10 text-center text-gray-500">No hay deudas registradas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                    <tr>
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Empleado</th>
                      <th className="p-4">Tipo</th>
                      <th className="p-4">Monto Original</th>
                      <th className="p-4">Cuota x Pago</th>
                      <th className="p-4">Saldo Pendiente</th>
                      <th className="p-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deudas.map(ad => {
                      const empName = usuarios.find(u => u.id === ad.id_empleado)?.nombre_completo || 'Desconocido';
                      return (
                        <tr key={ad.id} className="hover:bg-gray-50">
                          <td className="p-4 text-gray-600">{new Date(ad.fecha_creacion).toLocaleDateString()}</td>
                          <td className="p-4 font-bold text-gray-800">{empName}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${ad.tipo === 'Adelanto' ? 'border-orange-200 text-orange-600 bg-orange-50' : ad.tipo === 'Préstamo' ? 'border-purple-200 text-purple-600 bg-purple-50' : 'border-blue-200 text-blue-600 bg-blue-50'}`}>
                              {ad.tipo}
                            </span>
                          </td>
                          <td className="p-4 text-gray-600">C$ {Number(ad.monto_total).toFixed(2)}</td>
                          <td className="p-4 text-gray-600">C$ {Number(ad.cuota_por_pago).toFixed(2)}</td>
                          <td className="p-4 font-black text-red-500">C$ {Number(ad.saldo_pendiente).toFixed(2)}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${ad.estado === 'Activo' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                              {ad.estado}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL FICHA / EXPEDIENTE INTEGRAL DEL COLABORADOR                         */}
      {/* ========================================================================= */}
      {isExpedienteModalOpen && selectedExpediente && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            
            {/* Header del expediente */}
            <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-xl flex items-center gap-2">
                  <Briefcase className="text-blue-300" size={22} />
                  Expediente de {selectedExpediente.nombre_completo}
                </h3>
                <p className="text-xs text-blue-200 mt-0.5">
                  Ficha laboral integral • Código del Trabajo de Nicaragua
                </p>
              </div>
              <button
                onClick={() => setIsExpedienteModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 text-xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            {/* Pestañas del expediente */}
            <div className="flex border-b border-gray-200 px-6 bg-gray-50 gap-2">
              <button
                onClick={() => setExpedienteTab('general')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                  expedienteTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
                }`}
              >
                Datos Personales y Laborales
              </button>
              <button
                onClick={() => setExpedienteTab('prestaciones')}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                  expedienteTab === 'prestaciones' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
                }`}
              >
                Vacaciones y Prestaciones (Ley)
              </button>
            </div>

            {/* Contenido del expediente */}
            <form onSubmit={handleSaveExpediente} className="p-6 overflow-y-auto space-y-4 flex-1">
              {expedienteTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Nombre Completo</label>
                      <input
                        required
                        type="text"
                        value={formExpediente.nombre_completo}
                        onChange={e => setFormExpediente({ ...formExpediente, nombre_completo: e.target.value })}
                        className="w-full border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Cédula de Identidad</label>
                      <input
                        type="text"
                        placeholder="001-000000-0000A"
                        value={formExpediente.cedula}
                        onChange={e => setFormExpediente({ ...formExpediente, cedula: e.target.value })}
                        className="w-full border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Teléfono</label>
                      <input
                        type="text"
                        placeholder="+505 8888-8888"
                        value={formExpediente.telefono}
                        onChange={e => setFormExpediente({ ...formExpediente, telefono: e.target.value })}
                        className="w-full border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Fecha de Ingreso</label>
                      <input
                        type="date"
                        value={formExpediente.fecha_ingreso}
                        onChange={e => setFormExpediente({ ...formExpediente, fecha_ingreso: e.target.value })}
                        className="w-full border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Función / Puesto</label>
                      <select
                        value={formExpediente.funcion}
                        onChange={e => setFormExpediente({ ...formExpediente, funcion: e.target.value })}
                        className="w-full border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="Mecánico">Mecánico</option>
                        <option value="Cajero">Cajero</option>
                        <option value="Vendedor">Vendedor</option>
                        <option value="Gerente">Gerente</option>
                        <option value="Auxiliar">Auxiliar</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Esquema Salarial</label>
                      <select
                        value={formExpediente.tipo_salario}
                        onChange={e => setFormExpediente({ ...formExpediente, tipo_salario: e.target.value })}
                        className="w-full border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white font-bold"
                      >
                        <option value="Comisión">Comisión (%)</option>
                        <option value="Fijo">Salario Fijo (C$)</option>
                        <option value="Mixto">Mixto (Fijo + Comisión)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">
                        {formExpediente.tipo_salario === 'Fijo' ? 'Salario Fijo (C$)' : '% Comisión'}
                      </label>
                      <input
                        type="number"
                        value={formExpediente.tipo_salario === 'Fijo' ? formExpediente.salario_base : formExpediente.porcentaje_comision}
                        onChange={e => {
                          const val = e.target.value;
                          if (formExpediente.tipo_salario === 'Fijo') {
                            setFormExpediente({ ...formExpediente, salario_base: val });
                          } else {
                            setFormExpediente({ ...formExpediente, porcentaje_comision: val });
                          }
                        }}
                        className="w-full border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Dirección Domiciliar</label>
                    <input
                      type="text"
                      value={formExpediente.direccion}
                      onChange={e => setFormExpediente({ ...formExpediente, direccion: e.target.value })}
                      placeholder="Dirección del colaborador..."
                      className="w-full border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Contacto de Emergencia</label>
                    <input
                      type="text"
                      value={formExpediente.contacto_emergencia}
                      onChange={e => setFormExpediente({ ...formExpediente, contacto_emergencia: e.target.value })}
                      placeholder="Nombre y teléfono del contacto..."
                      className="w-full border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Notas y Observaciones de RRHH</label>
                    <textarea
                      rows="2"
                      value={formExpediente.notas_expediente}
                      onChange={e => setFormExpediente({ ...formExpediente, notas_expediente: e.target.value })}
                      placeholder="Historial médico, certificaciones, observaciones..."
                      className="w-full border p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {expedienteTab === 'prestaciones' && empCalculoModal && (
                <div className="space-y-4">
                  {/* ALERTA O RESUMEN DE FECHA DE INGRESO Y ANTIGÜEDAD */}
                  {!antigModal.tieneFecha ? (
                    <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950">
                      <div className="flex items-center gap-2.5">
                        <AlertCircle className="text-amber-600 shrink-0" size={22} />
                        <div>
                          <p className="text-xs font-bold">Fecha de Ingreso Laboral no establecida</p>
                          <p className="text-[11px] text-amber-800">
                            Para calcular la antigüedad legal y la acumulación de vacaciones (Art. 76) e indemnización (Art. 45), asigne la fecha en que inició a laborar:
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="date"
                          value={formExpediente.fecha_ingreso || ''}
                          onChange={e => setFormExpediente({ ...formExpediente, fecha_ingreso: e.target.value })}
                          className="border border-amber-300 p-2 rounded-xl text-xs bg-white font-bold text-gray-800 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                          <Briefcase size={16} />
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-bold block">Fecha de Ingreso</span>
                          <strong className="text-gray-800 text-sm font-black">{empCalculoModal.fecha_ingreso}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                          <Clock size={16} />
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-bold block">Antigüedad Exacta</span>
                          <strong className="text-indigo-900 text-sm font-black">
                            {antigModal.anos > 0 ? `${antigModal.anos} a, ` : ''}
                            {antigModal.meses} m, {antigModal.dias} d
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                          <Award size={16} />
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-bold block">Tiempo Laborado</span>
                          <strong className="text-amber-900 text-sm font-black">
                            {antigModal.mesesTotales.toFixed(1)} meses acumulados
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CÁLCULO LEGAL VACACIONES (ART. 76) */}
                  <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                      <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                        <Palmtree size={18} className="text-amber-700" /> Vacaciones según Art. 76 Código del Trabajo
                      </h4>
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200 self-start sm:self-auto">
                        2.5 días por mes laborado (15 días / 6 meses)
                      </span>
                    </div>

                    <p className="text-xs text-amber-900/80 leading-relaxed">
                      Nicaragua estipula 15 días continuos de descanso remunerado por cada 6 meses continuos de servicio. Los días tomados deben estar respaldados con fechas exactas en la bitácora laboral para asegurar la credibilidad del reporte.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center pt-1">
                      <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Acumulados por Ley</span>
                        <strong className="text-xl text-amber-900 block font-black my-0.5">
                          {vacInfoModal.diasAcumulados} días
                        </strong>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {antigModal.tieneFecha ? `2.5 d × ${antigModal.mesesTotales.toFixed(1)} meses` : 'Pendiente de fecha'}
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Días Tomados (Auditados)</span>
                        <strong className="text-xl text-red-600 block font-black my-0.5">
                          {vacInfoModal.diasTomados} días
                        </strong>
                        <span className="text-[10px] text-gray-500 font-medium">
                          {vacInfoModal.periodos.length} período(s) en bitácora
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">Saldo Disponible</span>
                        <strong className={`text-xl block font-black my-0.5 ${vacInfoModal.saldoReal < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {vacInfoModal.diasDisponibles} días
                        </strong>
                        <span className={`text-[10px] font-bold ${vacInfoModal.saldoReal < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          {vacInfoModal.saldoReal < 0 ? `⚠️ Excedido por ${Math.abs(vacInfoModal.saldoReal)} d` : 'Disponibles para goce'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BITÁCORA Y REGISTRO DE PERÍODOS DE VACACIONES */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
                      <div>
                        <h5 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                          <History size={16} className="text-amber-600" />
                          Bitácora de Períodos de Vacaciones Gozadas
                        </h5>
                        <p className="text-[11px] text-gray-500">
                          Historial exacto con fechas de inicio y fin registradas dentro del tiempo laborado.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAbrirModalPeriodo(empCalculoModal)}
                        className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-amber-200 transition-all shrink-0"
                      >
                        <CalendarPlus size={14} /> Registrar Período de Vacaciones
                      </button>
                    </div>

                    {vacInfoModal.periodos.length === 0 ? (
                      <div className="text-center py-7 border-2 border-dashed border-gray-100 rounded-2xl bg-amber-50/20">
                        <Palmtree className="mx-auto text-amber-300 mb-2" size={32} />
                        <p className="text-xs font-bold text-gray-700">No hay períodos de vacaciones asentados</p>
                        <p className="text-[11px] text-gray-400 max-w-md mx-auto mt-0.5">
                          Para asentar vacaciones históricas o descansos tomados con anterioridad, haga clic en "+ Registrar Período de Vacaciones" indicando las fechas exactas dentro de su relación laboral.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-xl border border-gray-100">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] sticky top-0 border-b border-gray-100">
                            <tr>
                              <th className="p-2.5">Rango de Fechas</th>
                              <th className="p-2.5 text-center">Días</th>
                              <th className="p-2.5">Período / Detalle</th>
                              <th className="p-2.5">Origen</th>
                              <th className="p-2.5">Registrado Por</th>
                              <th className="p-2.5 text-right">Acción</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {vacInfoModal.periodos.map(p => (
                              <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                                <td className="p-2.5 font-mono font-medium text-gray-800">
                                  {p.fecha_inicio} al {p.fecha_fin}
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className="font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                    {p.dias} días
                                  </span>
                                </td>
                                <td className="p-2.5 text-gray-700">
                                  <strong className="block font-semibold">{p.periodo_correspondiente || 'Vacaciones'}</strong>
                                  {p.observaciones && <span className="text-[10px] text-gray-400 italic block">{p.observaciones}</span>}
                                </td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    p.tipo_registro === 'Solicitud Aprobada' 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {p.tipo_registro || 'Histórico'}
                                  </span>
                                </td>
                                <td className="p-2.5 text-gray-400 text-[11px]">
                                  {p.registrado_por || 'Gerencia'}
                                </td>
                                <td className="p-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setPeriodoAEliminar(p)}
                                    className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                    title="Eliminar este período"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* AGUINALDO Y LIQUIDACIÓN PROYECTADA */}
                  <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200 space-y-2">
                    <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                      <Award size={18} className="text-blue-700" /> Prestaciones y Liquidación Proyectada
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-sm">
                        <span className="text-xs text-gray-500 font-bold block">Aguinaldo Acumulado (Art. 93):</span>
                        <strong className="text-lg text-emerald-700 font-black block mt-0.5">
                          C$ {prestModal.aguinaldoAcumulado}
                        </strong>
                        <p className="text-[10px] text-gray-400 mt-0.5">Décimo tercer mes proporcional a la fecha</p>
                      </div>

                      <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-sm">
                        <span className="text-xs text-gray-500 font-bold block">Indemnización Antigüedad (Art. 45):</span>
                        <strong className="text-lg text-blue-800 font-black block mt-0.5">
                          C$ {prestModal.indemnizacionMonto}
                        </strong>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {antigModal.tieneFecha ? `Equivalente a ${prestModal.mesesIndemnizacion} meses de salario` : 'Requiere fecha de ingreso'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsExpedienteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-100"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl text-sm shadow-md shadow-blue-200 transition-all"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL REGISTRAR DEUDA MANUAL */}
      {isDeudaModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <HandCoins className="text-purple-600" /> Registrar Deuda / Adelanto
              </h3>
            </div>
            <form onSubmit={guardarDeudaManual} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Empleado</label>
                <select required value={deudaForm.id_empleado} onChange={e => setDeudaForm({...deudaForm, id_empleado: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                  <option value="">Seleccione un empleado...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre_completo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Tipo</label>
                <select required value={deudaForm.tipo} onChange={e => {
                  const newTipo = e.target.value;
                  setDeudaForm(prev => ({
                    ...prev, 
                    tipo: newTipo, 
                    cuota_por_pago: newTipo === 'Adelanto' ? prev.monto_total : prev.cuota_por_pago 
                  }));
                }} className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm">
                  <option value="Adelanto">Adelanto (Deducción Única en Próximo Pago)</option>
                  <option value="Préstamo">Préstamo (Pago en Cuotas)</option>
                  <option value="Crédito">Crédito de Producto (Pago en Cuotas)</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Monto Total (C$)</label>
                  <input required type="number" step="0.01" value={deudaForm.monto_total} onChange={e => {
                    const newMonto = e.target.value;
                    setDeudaForm({
                      ...deudaForm, 
                      monto_total: newMonto,
                      cuota_por_pago: deudaForm.tipo === 'Adelanto' ? newMonto : deudaForm.cuota_por_pago
                    });
                  }} className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold" placeholder="Ej: 500.00" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Cuota x Pago (C$)</label>
                  <input required type="number" step="0.01" value={deudaForm.cuota_por_pago} onChange={e => setDeudaForm({...deudaForm, cuota_por_pago: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold" placeholder="Ej: 100.00" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Motivo / Descripción</label>
                <input type="text" value={deudaForm.motivo} onChange={e => setDeudaForm({...deudaForm, motivo: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="Ej: Adelanto por emergencia familiar" />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsDeudaModalOpen(false)} className="px-4 py-2.5 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-100">Cancelar</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-purple-200">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RECHAZO DE SOLICITUD */}
      {solicitudARechazar && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <AlertCircle className="text-red-500" /> Rechazar Solicitud
            </h3>
            <p className="text-xs text-gray-500">
              Indica la razón por la que no es posible aprobar esta solicitud de <strong>{solicitudARechazar.tipo}</strong> para <strong>{solicitudARechazar.nombre_empleado}</strong>.
            </p>
            <textarea
              required
              rows="3"
              value={motivoRechazo}
              onChange={e => setMotivoRechazo(e.target.value)}
              placeholder="Ej: Fechas no disponibles debido a alta demanda de trabajo en taller..."
              className="w-full border p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSolicitudARechazar(null)}
                className="px-4 py-2 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarRechazo}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded-xl text-sm shadow-md shadow-red-200"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR PERÍODO DE VACACIONES (HISTÓRICO O ASENTADO) */}
      {isPeriodoModalOpen && selectedExpediente && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <CalendarPlus size={20} /> Asentar Período de Vacaciones
                </h3>
                <p className="text-xs text-amber-100">
                  Empleado: {selectedExpediente.nombre_completo}
                  {empCalculoModal?.fecha_ingreso ? ` (Ingreso: ${empCalculoModal.fecha_ingreso})` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPeriodoModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleGuardarPeriodoVacaciones} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <strong>Norma de Integridad:</strong> Para que el expediente laboral sea creíble y auditable, especifique las fechas exactas en que el colaborador tomó su descanso dentro de su relación de trabajo.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Fecha de Inicio *</label>
                  <input
                    required
                    type="date"
                    value={periodoForm.fecha_inicio}
                    onChange={e => handlePeriodoFechaChange('fecha_inicio', e.target.value)}
                    className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Fecha de Fin *</label>
                  <input
                    required
                    type="date"
                    value={periodoForm.fecha_fin}
                    onChange={e => handlePeriodoFechaChange('fecha_fin', e.target.value)}
                    className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-gray-700 uppercase">Días a Descontar *</label>
                  <span className="text-[11px] text-gray-400">Calculado por rango de fechas</span>
                </div>
                <input
                  required
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={periodoForm.dias}
                  onChange={e => setPeriodoForm({ ...periodoForm, dias: e.target.value })}
                  className="w-full border p-2.5 rounded-xl text-base outline-none focus:ring-2 focus:ring-amber-500 font-black text-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Período / Motivo *</label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Período 2023 - 2024, Vacaciones Diciembre 2024..."
                  value={periodoForm.periodo_correspondiente}
                  onChange={e => setPeriodoForm({ ...periodoForm, periodo_correspondiente: e.target.value })}
                  className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Observaciones / Soporte</label>
                <textarea
                  rows="2"
                  placeholder="Observaciones de autorización, memo o constancia física..."
                  value={periodoForm.observaciones}
                  onChange={e => setPeriodoForm({ ...periodoForm, observaciones: e.target.value })}
                  className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPeriodoModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2 rounded-xl text-sm shadow-md shadow-amber-200 transition-all active:scale-95"
                >
                  Guardar Período
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN DE PERÍODO DE VACACIONES */}
      {periodoAEliminar && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4">
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <AlertCircle className="text-red-500" /> Eliminar Registro de Vacaciones
            </h3>
            <p className="text-sm text-gray-600">
              ¿Está seguro de eliminar el período registrado del <strong>{periodoAEliminar.fecha_inicio}</strong> al <strong>{periodoAEliminar.fecha_fin}</strong> (<strong>{periodoAEliminar.dias} días</strong>)?
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
              Los <strong>{periodoAEliminar.dias} días</strong> se reintegrarán automáticamente al saldo disponible de vacaciones del colaborador.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPeriodoAEliminar(null)}
                className="px-4 py-2 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEliminarPeriodo}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded-xl text-sm shadow-md shadow-red-200"
              >
                Sí, Eliminar Período
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
