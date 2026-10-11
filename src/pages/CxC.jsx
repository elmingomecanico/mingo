import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import { Wallet, Search, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CxC() {
  const [cxcList, setCxcList] = useState([]);
  const [clientesMap, setClientesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal de Abono
  const [abonoModal, setAbonoModal] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');

  useEffect(() => {
    // Cargar clientes para mapear IDs a Nombres
    const clientesRef = ref(rtdb, 'clientes');
    const unsubClientes = onValue(clientesRef, (snapshot) => {
      if (snapshot.exists()) {
        const map = {};
        Object.keys(snapshot.val()).forEach(key => {
          map[key] = snapshot.val()[key].nombre;
        });
        setClientesMap(map);
      }
    });

    const cxcRef = ref(rtdb, 'cxc');
    const unsubCxc = onValue(cxcRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        // Ordenar: pendientes primero, luego por fecha
        parsed.sort((a, b) => {
          if (a.estado === 'Pendiente' && b.estado === 'Pagado') return -1;
          if (a.estado === 'Pagado' && b.estado === 'Pendiente') return 1;
          return new Date(b.fecha_emision) - new Date(a.fecha_emision);
        });
        setCxcList(parsed);
      } else {
        setCxcList([]);
      }
      setLoading(false);
    });

    return () => { unsubClientes(); unsubCxc(); };
  }, []);

  const handleAbonar = async (e) => {
    e.preventDefault();
    const monto = Number(montoAbono);
    if (monto <= 0) return toast.error("El abono debe ser mayor a 0");
    if (monto > abonoModal.saldo_pendiente) return toast.error("El abono no puede superar el saldo pendiente");

    try {
      const cxcRef = ref(rtdb, `cxc/${abonoModal.id}`);
      
      await runTransaction(cxcRef, (currentData) => {
        if (!currentData) return currentData;
        const nuevoSaldo = currentData.saldo_pendiente - monto;
        currentData.saldo_pendiente = nuevoSaldo;
        if (nuevoSaldo <= 0) {
          currentData.estado = 'Pagado';
        }
        
        // Registrar el abono en el historial
        if (!currentData.historial_abonos) currentData.historial_abonos = [];
        currentData.historial_abonos.push({
          fecha: new Date().toISOString(),
          monto: monto
        });
        
        return currentData;
      });

      // Registrar ingreso en contabilidad (Flujo de Caja)
      const movRef = push(ref(rtdb, 'movimientos_contables'));
      await set(movRef, {
        fecha: new Date().toISOString(),
        tipo: 'Ingreso',
        categoria: 'Cobro Cliente (CxC)',
        concepto: `Abono de cliente a factura ${abonoModal.numero_factura || ''} (${clientesMap[abonoModal.id_cliente] || 'Cliente'})`,
        monto: monto,
        metodo_pago: 'Efectivo',
        id_referencia: abonoModal.id,
        numero_comprobante: abonoModal.numero_factura || '',
        sucursal: 'SUC-01',
        usuario: 'Caja'
      });
      
      toast.success("Abono registrado con éxito");
      setAbonoModal(null);
      setMontoAbono('');
    } catch (error) {
      toast.error("Error al registrar abono: " + error.message);
    }
  };

  const filtered = cxcList.filter(c => {
    const nombreCliente = clientesMap[c.id_cliente] || '';
    return nombreCliente.toLowerCase().includes(search.toLowerCase()) || 
           (c.numero_factura && c.numero_factura.toLowerCase().includes(search.toLowerCase()));
  });

  const totalPendienteGlobal = cxcList
    .filter(c => c.estado === 'Pendiente')
    .reduce((acc, curr) => acc + curr.saldo_pendiente, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Wallet className="text-amber-500" /> 
            Cuentas por Cobrar (CxC)
          </h1>
          <p className="text-gray-500 text-sm">Gestiona los créditos otorgados a clientes y registra abonos.</p>
        </div>
        <div className="bg-amber-100 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm border border-amber-200">
          <div className="bg-amber-500 p-2 rounded-lg text-white">
            <DollarSign size={20} />
          </div>
          <div>
            <p className="text-xs text-amber-700 font-bold uppercase">Total por Cobrar</p>
            <p className="text-xl font-black text-amber-900">C$ {totalPendienteGlobal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <input 
              type="text" 
              placeholder="Buscar por cliente o factura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Factura</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Emisión / Vence</th>
                <th className="p-4 text-right">Total Factura</th>
                <th className="p-4 text-right">Saldo Pendiente</th>
                <th className="p-4 text-center">Estado</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-400">Cargando cuentas...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-400">No hay cuentas por cobrar.</td></tr>
              ) : (
                filtered.map(cxc => {
                  const isVencida = new Date(cxc.fecha_vencimiento) < new Date() && cxc.estado === 'Pendiente';
                  
                  return (
                    <tr key={cxc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-mono font-bold text-gray-700">{cxc.numero_factura}</td>
                      <td className="p-4 font-bold text-gray-800">{clientesMap[cxc.id_cliente] || 'Cliente Desconocido'}</td>
                      <td className="p-4">
                        <div className="text-gray-700">{new Date(cxc.fecha_emision).toLocaleDateString()}</div>
                        <div className={`text-xs mt-0.5 font-bold ${isVencida ? 'text-red-500' : 'text-gray-500'}`}>
                          Vence: {new Date(cxc.fecha_vencimiento).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4 text-right text-gray-600 font-medium">C$ {cxc.monto_total.toFixed(2)}</td>
                      <td className="p-4 text-right font-black text-amber-600 text-base">C$ {cxc.saldo_pendiente.toFixed(2)}</td>
                      <td className="p-4 text-center">
                        {cxc.estado === 'Pagado' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs bg-green-100 text-green-700">
                            <CheckCircle2 size={14} /> Pagado
                          </span>
                        ) : isVencida ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs bg-red-100 text-red-700">
                            <AlertCircle size={14} /> Vencida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs bg-amber-100 text-amber-700">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {cxc.estado === 'Pendiente' && (
                          <button 
                            onClick={() => { setAbonoModal(cxc); setMontoAbono(cxc.saldo_pendiente); }}
                            className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"
                          >
                            Abonar
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

      {abonoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">Registrar Abono</h2>
              <button onClick={() => setAbonoModal(null)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleAbonar} className="p-6 space-y-4">
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 mb-4">
                <p className="text-xs text-amber-600 font-bold uppercase mb-1">Saldo Pendiente Actual</p>
                <p className="text-2xl font-black text-amber-700">C$ {abonoModal.saldo_pendiente.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto a Abonar (C$)</label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  min="0.01" 
                  max={abonoModal.saldo_pendiente}
                  value={montoAbono} 
                  onChange={e => setMontoAbono(e.target.value)} 
                  className="w-full border-2 border-gray-200 p-3 rounded-xl outline-none focus:border-blue-500 text-lg font-bold text-center" 
                  autoFocus
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setAbonoModal(null)} className="px-4 py-2 rounded-lg text-gray-600 font-medium hover:bg-gray-100">Cancelar</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-md shadow-blue-200 active:scale-95 transition-all">Confirmar Abono</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
