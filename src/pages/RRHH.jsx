import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, update } from 'firebase/database';
import { rtdb } from '../firebase';
import { Users, CalendarDays, DollarSign, FileText, CheckCircle2, History, HandCoins } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RRHH() {
  const [activeTab, setActiveTab] = useState('generar'); // generar, historial, adelantos
  
  // Datos
  const [usuarios, setUsuarios] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [adelantos, setAdelantos] = useState([]);
  const [nominas, setNominas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para Generar Nómina
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [nominaBorrador, setNominaBorrador] = useState(null);

  // Estados para Adelantos
  const [isAdelantoModalOpen, setIsAdelantoModalOpen] = useState(false);
  const [adelantoForm, setAdelantoForm] = useState({ id_empleado: '', monto: '', motivo: '' });

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

    // Cargar adelantos
    const unsubAd = onValue(ref(rtdb, 'adelantos_empleados'), snap => {
      if (snap.exists()) {
        setAdelantos(Object.keys(snap.val()).map(k => ({ id: k, ...snap.val()[k] })));
      } else {
        setAdelantos([]);
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

      // 2. Obtener Adelantos pendientes de este empleado
      const susAdelantos = adelantos.filter(a => a.id_empleado === emp.id && a.estado === 'Pendiente');
      const totalAdelantos = susAdelantos.reduce((sum, a) => sum + Number(a.monto), 0);

      // 3. Sueldo Base (por defecto mostramos su salario base, aunque sea mensual, el admin lo puede editar)
      const sueldoBaseAplicar = emp.salario_base || 0;

      return {
        id_empleado: emp.id,
        nombre: emp.nombre_completo,
        tipo_salario: emp.tipo_salario,
        sueldo_base: sueldoBaseAplicar,
        comisiones: totalComisiones,
        adelantos: totalAdelantos,
        adelantos_ids: susAdelantos.map(a => a.id),
        neto: (sueldoBaseAplicar + totalComisiones) - totalAdelantos
      };
    });

    setNominaBorrador(borrador);
    toast.success("Cálculo preliminar generado");
  };

  const handleSueldoBaseChange = (id_empleado, nuevoSueldo) => {
    setNominaBorrador(prev => prev.map(line => {
      if (line.id_empleado === id_empleado) {
        const val = Number(nuevoSueldo) || 0;
        return { ...line, sueldo_base: val, neto: (val + line.comisiones) - line.adelantos };
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

      // Marcar los adelantos como 'Pagados'
      for (const line of nominaBorrador) {
        if (line.adelantos_ids && line.adelantos_ids.length > 0) {
          for (const adId of line.adelantos_ids) {
            await update(ref(rtdb, `adelantos_empleados/${adId}`), { estado: 'Pagado', id_nomina: nominaRef.key });
          }
        }
      }

      toast.success("Nómina guardada y adelantos descontados");
      setNominaBorrador(null);
      setFechaInicio('');
      setFechaFin('');
      setActiveTab('historial');
    } catch (error) {
      toast.error("Error al guardar nómina: " + error.message);
    }
  };

  const guardarAdelanto = async (e) => {
    e.preventDefault();
    if (!adelantoForm.id_empleado || !adelantoForm.monto) return toast.error("Complete los campos obligatorios");

    try {
      await push(ref(rtdb, 'adelantos_empleados'), {
        id_empleado: adelantoForm.id_empleado,
        monto: Number(adelantoForm.monto),
        motivo: adelantoForm.motivo || 'Adelanto de salario',
        fecha: new Date().toISOString(),
        estado: 'Pendiente'
      });
      toast.success("Adelanto registrado");
      setIsAdelantoModalOpen(false);
      setAdelantoForm({ id_empleado: '', monto: '', motivo: '' });
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
          <p className="text-gray-500 text-sm">Cortes de pago flexibles, comisiones y adelantos.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-gray-200">
        <button onClick={() => setActiveTab('generar')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'generar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Generar Corte</button>
        <button onClick={() => setActiveTab('historial')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'historial' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Historial de Nóminas</button>
        <button onClick={() => setActiveTab('adelantos')} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === 'adelantos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Adelantos / Préstamos</button>
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
                      <th className="p-4 text-red-500">Adelantos (-)</th>
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
                        <td className="p-4 font-bold text-red-500">C$ {line.adelantos.toFixed(2)}</td>
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

      {/* TAB: ADELANTOS */}
      {activeTab === 'adelantos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setIsAdelantoModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-purple-200">
              <HandCoins size={20} /> Nuevo Adelanto
            </button>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {adelantos.length === 0 ? (
              <div className="p-10 text-center text-gray-500">No hay adelantos registrados.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
                    <tr>
                      <th className="p-4">Fecha</th>
                      <th className="p-4">Empleado</th>
                      <th className="p-4">Motivo</th>
                      <th className="p-4">Monto</th>
                      <th className="p-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {adelantos.map(ad => {
                      const empName = usuarios.find(u => u.id === ad.id_empleado)?.nombre_completo || 'Desconocido';
                      return (
                        <tr key={ad.id} className="hover:bg-gray-50">
                          <td className="p-4 text-gray-600">{new Date(ad.fecha).toLocaleDateString()}</td>
                          <td className="p-4 font-bold text-gray-800">{empName}</td>
                          <td className="p-4 text-gray-500">{ad.motivo}</td>
                          <td className="p-4 font-black text-red-500">C$ {Number(ad.monto).toFixed(2)}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${ad.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
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

      {/* MODAL ADELANTO */}
      {isAdelantoModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <HandCoins className="text-purple-600" /> Registrar Adelanto
              </h3>
            </div>
            <form onSubmit={guardarAdelanto} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
                <select required value={adelantoForm.id_empleado} onChange={e => setAdelantoForm({...adelantoForm, id_empleado: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500">
                  <option value="">Seleccione un empleado...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre_completo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto (C$)</label>
                <input required type="number" step="0.01" value={adelantoForm.monto} onChange={e => setAdelantoForm({...adelantoForm, monto: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ej: 500.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (Opcional)</label>
                <input type="text" value={adelantoForm.motivo} onChange={e => setAdelantoForm({...adelantoForm, motivo: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ej: Adelanto de quincena" />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setIsAdelantoModalOpen(false)} className="px-4 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors">Cancelar</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-purple-200 transition-all active:scale-95">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
