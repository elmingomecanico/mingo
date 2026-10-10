import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, update } from 'firebase/database';
import { rtdb } from '../firebase';
import { Users, CalendarDays, DollarSign, CheckCircle2, History, HandCoins } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RRHH() {
  const [activeTab, setActiveTab] = useState('generar'); // generar, historial, deudas
  
  // Datos
  const [usuarios, setUsuarios] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [deudas, setDeudas] = useState([]);
  const [nominas, setNominas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para Generar Nómina
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [nominaBorrador, setNominaBorrador] = useState(null);

  // Estados para Deudas (Adelantos, Préstamos)
  const [isDeudaModalOpen, setIsDeudaModalOpen] = useState(false);
  const [deudaForm, setDeudaForm] = useState({ 
    id_empleado: '', 
    tipo: 'Adelanto', // Adelanto, Préstamo, Crédito
    monto_total: '', 
    cuota_por_pago: '',
    motivo: '' 
  });

  useEffect(() => {
    // Cargar empleados
    const unsubUsr = onValue(ref(rtdb, 'usuarios'), snap => {
      if (snap.exists()) {
        const parsed = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        setUsuarios(parsed.filter(u => u.estado === 'Activo'));
      }
    });

    // Cargar órdenes de trabajo
    const unsubOT = onValue(ref(rtdb, 'ordenes_trabajo'), snap => {
      if (snap.exists()) {
        setOrdenes(Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })));
      }
    });

    // Cargar deudas
    const unsubAd = onValue(ref(rtdb, 'deudas_empleados'), snap => {
      if (snap.exists()) {
        const list = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        // Filtrar y ordenar
        setDeudas(list.sort((a,b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion)));
      } else {
        setDeudas([]);
      }
    });

    // Cargar nóminas
    const unsubNom = onValue(ref(rtdb, 'nominas'), snap => {
      if (snap.exists()) {
        const parsed = Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] }));
        setNominas(parsed.sort((a,b) => new Date(b.fecha_generacion) - new Date(a.fecha_generacion)));
      } else {
        setNominas([]);
      }
      setLoading(false);
    });

    return () => { unsubUsr(); unsubOT(); unsubAd(); unsubNom(); };
  }, []);

  const calcularNomina = () => {
    if (!fechaInicio || !fechaFin) return toast.error("Seleccione un rango de fechas");
    if (new Date(fechaInicio) > new Date(fechaFin)) return toast.error("Fecha de inicio no puede ser mayor a fecha fin");

    const start = new Date(fechaInicio + 'T00:00:00');
    const end = new Date(fechaFin + 'T23:59:59');

    // Mapear cada empleado activo
    const borrador = usuarios.map(emp => {
      // 1. Calcular Comisiones en el rango
      const susOrdenes = ordenes.filter(ot => {
        const otDate = new Date(ot.fecha_creacion);
        return ot.id_mecanico === emp.id && otDate >= start && otDate <= end;
      });
      const totalComisiones = susOrdenes.reduce((sum, ot) => sum + (ot.comision_mecanico_monto || 0), 0);

      // 2. Obtener deudas activas que tengan saldo pendiente
      const susDeudas = deudas.filter(d => d.id_empleado === emp.id && d.estado === 'Activo' && d.saldo_pendiente > 0);
      
      const detallesDeducciones = susDeudas.map(d => {
        // La deducción máxima es la cuota, o el saldo pendiente si es menor a la cuota
        const aDeducir = Math.min(Number(d.cuota_por_pago), Number(d.saldo_pendiente));
        return {
          id_deuda: d.id,
          tipo: d.tipo,
          motivo: d.motivo,
          monto_deducido: aDeducir
        };
      });

      const totalDeducciones = detallesDeducciones.reduce((sum, d) => sum + d.monto_deducido, 0);

      // 3. Sueldo Base 
      const sueldoBaseAplicar = emp.salario_base || 0;

      return {
        id_empleado: emp.id,
        nombre: emp.nombre_completo,
        tipo_salario: emp.tipo_salario,
        sueldo_base: sueldoBaseAplicar,
        comisiones: totalComisiones,
        deducciones: totalDeducciones,
        detalles_deducciones: detallesDeducciones, // Array para descontar al guardar
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

      // Procesar cada deducción y actualizar los saldos de las deudas
      for (const line of nominaBorrador) {
        if (line.detalles_deducciones && line.detalles_deducciones.length > 0) {
          for (const ded of line.detalles_deducciones) {
            // Buscar la deuda original
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

  const guardarDeuda = async (e) => {
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
        motivo: deudaForm.motivo || `${deudaForm.tipo} registrado`,
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600" /> 
            Recursos Humanos y Planilla
          </h1>
          <p className="text-gray-500 text-sm">Cortes de pago flexibles, comisiones y gestión de deudas.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200">
        <button onClick={() => setActiveTab('generar')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'generar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Generar Corte</button>
        <button onClick={() => setActiveTab('historial')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'historial' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Historial de Nóminas</button>
        <button onClick={() => setActiveTab('deudas')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'deudas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Deducciones y Deudas</button>
      </div>

      {/* TAB: GENERAR CORTE */}
      {activeTab === 'generar' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Fecha Inicio</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Fecha Fin</label>
              <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={calcularNomina} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700">
              <CalendarDays size={18} /> Calcular Planilla
            </button>
          </div>

          {nominaBorrador && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><DollarSign className="text-green-600" /> Borrador de Planilla</h3>
                <span className="text-sm text-gray-500">Puedes editar el sueldo base si es un corte proporcional (ej. quincenal en lugar de mensual).</span>
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
                            className="w-full border p-2 rounded outline-none focus:border-blue-500"
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
                <button onClick={guardarNomina} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-md shadow-green-200">
                  <CheckCircle2 size={18} /> Aprobar y Guardar Nómina
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: HISTORIAL */}
      {activeTab === 'historial' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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

      {/* TAB: DEUDAS */}
      {activeTab === 'deudas' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => {
              setDeudaForm({ id_empleado: '', tipo: 'Adelanto', monto_total: '', cuota_por_pago: '', motivo: '' });
              setIsDeudaModalOpen(true);
            }} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-purple-200">
              <HandCoins size={20} /> Registrar Adelanto / Préstamo
            </button>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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

      {/* MODAL DEUDA */}
      {isDeudaModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <HandCoins className="text-purple-600" /> Nueva Deducción
              </h3>
            </div>
            <form onSubmit={guardarDeuda} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
                <select required value={deudaForm.id_empleado} onChange={e => setDeudaForm({...deudaForm, id_empleado: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">Seleccione un empleado...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre_completo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Deducción</label>
                <select required value={deudaForm.tipo} onChange={e => {
                  const newTipo = e.target.value;
                  // Si es adelanto, sugerir que la cuota sea el 100% del monto
                  setDeudaForm(prev => ({
                    ...prev, 
                    tipo: newTipo, 
                    cuota_por_pago: newTipo === 'Adelanto' ? prev.monto_total : prev.cuota_por_pago 
                  }));
                }} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="Adelanto">Adelanto (Deducción Única)</option>
                  <option value="Préstamo">Préstamo (Pago en Cuotas)</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto Total (C$)</label>
                  <input required type="number" step="0.01" value={deudaForm.monto_total} onChange={e => {
                    const newMonto = e.target.value;
                    setDeudaForm({
                      ...deudaForm, 
                      monto_total: newMonto,
                      cuota_por_pago: deudaForm.tipo === 'Adelanto' ? newMonto : deudaForm.cuota_por_pago
                    });
                  }} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ej: 500.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cuota por Pago (C$)</label>
                  <input required type="number" step="0.01" value={deudaForm.cuota_por_pago} onChange={e => setDeudaForm({...deudaForm, cuota_por_pago: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ej: 100.00" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Descripción</label>
                <input type="text" value={deudaForm.motivo} onChange={e => setDeudaForm({...deudaForm, motivo: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ej: Préstamo para gastos" />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setIsDeudaModalOpen(false)} className="px-4 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors">Cancelar</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-purple-200 transition-all active:scale-95">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
