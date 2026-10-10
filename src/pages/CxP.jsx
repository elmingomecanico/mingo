import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import { CreditCard, Search, DollarSign, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';

export default function CxP() {
  const [cxpList, setCxpList] = useState([]);
  const [proveedoresMap, setProveedoresMap] = useState({});
  const [proveedoresList, setProveedoresList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State for New Bill
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id_proveedor: '', numero_factura: '', fecha_emision: '', fecha_vencimiento: '', monto_total: ''
  });

  // Modal de Abono
  const [abonoModal, setAbonoModal] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');

  useEffect(() => {
    // Cargar proveedores
    const provRef = ref(rtdb, 'proveedores');
    const unsubProv = onValue(provRef, (snapshot) => {
      if (snapshot.exists()) {
        const map = {};
        const list = [];
        Object.keys(snapshot.val()).forEach(key => {
          map[key] = snapshot.val()[key].nombre;
          list.push({ id: key, ...snapshot.val()[key] });
        });
        setProveedoresMap(map);
        setProveedoresList(list);
      }
    });

    const cxpRef = ref(rtdb, 'cxp');
    const unsubCxp = onValue(cxpRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        parsed.sort((a, b) => {
          if (a.estado === 'Pendiente' && b.estado === 'Pagado') return -1;
          if (a.estado === 'Pagado' && b.estado === 'Pendiente') return 1;
          return new Date(b.fecha_emision) - new Date(a.fecha_emision);
        });
        setCxpList(parsed);
      } else {
        setCxpList([]);
      }
      setLoading(false);
    });

    return () => { unsubProv(); unsubCxp(); };
  }, []);

  const handleSaveBill = async (e) => {
    e.preventDefault();
    if (!formData.id_proveedor || !formData.monto_total || !formData.numero_factura) {
      return toast.error("Complete todos los campos requeridos");
    }

    try {
      const cxpRef = push(ref(rtdb, 'cxp'));
      await set(cxpRef, {
        id_proveedor: formData.id_proveedor,
        numero_factura: formData.numero_factura.trim(),
        fecha_emision: formData.fecha_emision || new Date().toISOString(),
        fecha_vencimiento: formData.fecha_vencimiento || new Date().toISOString(),
        monto_total: Number(formData.monto_total),
        saldo_pendiente: Number(formData.monto_total),
        estado: 'Pendiente'
      });
      
      toast.success("Factura por pagar registrada");
      setIsModalOpen(false);
      setFormData({ id_proveedor: '', numero_factura: '', fecha_emision: '', fecha_vencimiento: '', monto_total: '' });
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleAbonar = async (e) => {
    e.preventDefault();
    const monto = Number(montoAbono);
    if (monto <= 0) return toast.error("El abono debe ser mayor a 0");
    if (monto > abonoModal.saldo_pendiente) return toast.error("El abono no puede superar el saldo pendiente");

    try {
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
          fecha: new Date().toISOString(),
          monto: monto
        });
        
        return currentData;
      });
      
      toast.success("Pago a proveedor registrado con éxito");
      setAbonoModal(null);
      setMontoAbono('');
    } catch (error) {
      toast.error("Error al registrar pago: " + error.message);
    }
  };

  const filtered = cxpList.filter(c => {
    const nombreProv = proveedoresMap[c.id_proveedor] || '';
    return nombreProv.toLowerCase().includes(search.toLowerCase()) || 
           (c.numero_factura && c.numero_factura.toLowerCase().includes(search.toLowerCase()));
  });

  const totalPendienteGlobal = cxpList
    .filter(c => c.estado === 'Pendiente')
    .reduce((acc, curr) => acc + curr.saldo_pendiente, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <CreditCard className="text-rose-500" /> 
            Cuentas por Pagar (CxP)
          </h1>
          <p className="text-gray-500 text-sm">Controla las facturas y pagos pendientes a proveedores.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-rose-100 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm border border-rose-200">
            <div className="bg-rose-500 p-2 rounded-lg text-white">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs text-rose-700 font-bold uppercase">Deuda Total</p>
              <p className="text-xl font-black text-rose-900">C$ {totalPendienteGlobal.toFixed(2)}</p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            <Plus size={20} />
            Nueva Factura CxP
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <input 
              type="text" 
              placeholder="Buscar por proveedor o factura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Factura</th>
                <th className="p-4">Proveedor</th>
                <th className="p-4">Fechas</th>
                <th className="p-4 text-right">Total Factura</th>
                <th className="p-4 text-right">Saldo Deudor</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-400">Cargando cuentas...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-400">No hay deudas registradas.</td></tr>
              ) : (
                filtered.map(cxp => {
                  const isVencida = new Date(cxp.fecha_vencimiento) < new Date() && cxp.estado === 'Pendiente';
                  
                  return (
                    <tr key={cxp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-mono font-bold text-gray-700">{cxp.numero_factura}</td>
                      <td className="p-4 font-bold text-gray-800">{proveedoresMap[cxp.id_proveedor] || 'Desconocido'}</td>
                      <td className="p-4">
                        <div className="text-gray-700 text-xs">Emi: {new Date(cxp.fecha_emision).toLocaleDateString()}</div>
                        <div className={`text-xs mt-0.5 font-bold ${isVencida ? 'text-red-500' : 'text-gray-500'}`}>
                          Ven: {new Date(cxp.fecha_vencimiento).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4 text-right text-gray-600 font-medium">C$ {cxp.monto_total.toFixed(2)}</td>
                      <td className="p-4 text-right font-black text-rose-600 text-base">C$ {cxp.saldo_pendiente.toFixed(2)}</td>
                      <td className="p-4 text-center">
                        {cxp.estado === 'Pagado' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs bg-green-100 text-green-700">
                            <CheckCircle2 size={14} /> Pagado
                          </span>
                        ) : isVencida ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs bg-red-100 text-red-700">
                            <AlertCircle size={14} /> Vencida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs bg-rose-100 text-rose-700">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {cxp.estado === 'Pendiente' && (
                          <button 
                            onClick={() => { setAbonoModal(cxp); setMontoAbono(cxp.saldo_pendiente); }}
                            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"
                          >
                            Pagar
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nueva Factura CxP */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">Registrar Factura CxP</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleSaveBill} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor *</label>
                <Select
                  options={proveedoresList.map(p => ({ value: p.id, label: p.nombre }))}
                  value={formData.id_proveedor ? { value: formData.id_proveedor, label: proveedoresMap[formData.id_proveedor] } : null}
                  onChange={selected => setFormData({...formData, id_proveedor: selected ? selected.value : ''})}
                  placeholder="Seleccione un proveedor..."
                  isClearable
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número de Factura *</label>
                <input required type="text" value={formData.numero_factura} onChange={e => setFormData({...formData, numero_factura: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500" placeholder="Ej: F-10203" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto Total (C$) *</label>
                <input required type="number" step="0.01" min="0.01" value={formData.monto_total} onChange={e => setFormData({...formData, monto_total: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Emisión</label>
                  <input type="date" value={formData.fecha_emision.split('T')[0]} onChange={e => setFormData({...formData, fecha_emision: new Date(e.target.value).toISOString()})} className="w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Vencimiento</label>
                  <input type="date" value={formData.fecha_vencimiento.split('T')[0]} onChange={e => setFormData({...formData, fecha_vencimiento: new Date(e.target.value).toISOString()})} className="w-full border p-2.5 rounded-lg outline-none focus:border-indigo-500 text-sm" />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors">Cancelar</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-indigo-200 transition-all active:scale-95">Registrar Deuda</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Abono */}
      {abonoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">Registrar Pago a Proveedor</h2>
              <button onClick={() => setAbonoModal(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleAbonar} className="p-6 space-y-4">
              <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 mb-4">
                <p className="text-xs text-rose-600 font-bold uppercase mb-1">Saldo Deudor Actual</p>
                <p className="text-2xl font-black text-rose-700">C$ {abonoModal.saldo_pendiente.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto a Pagar (C$)</label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  min="0.01" 
                  max={abonoModal.saldo_pendiente}
                  value={montoAbono} 
                  onChange={e => setMontoAbono(e.target.value)} 
                  className="w-full border-2 border-gray-200 p-3 rounded-xl outline-none focus:border-indigo-500 text-lg font-bold text-center" 
                  autoFocus
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setAbonoModal(null)} className="px-4 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100">Cancelar</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold shadow-md shadow-indigo-200 active:scale-95 transition-all">Confirmar Pago</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
