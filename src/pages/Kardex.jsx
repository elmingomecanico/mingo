import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import { Activity, ArrowDownRight, ArrowUpRight, Search } from 'lucide-react';

export default function Kardex() {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const kardexRef = ref(rtdb, 'kardex');
    const unsub = onValue(kardexRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsed = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        
        // Ordenar por fecha descendente
        parsed.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setMovimientos(parsed);
      } else {
        setMovimientos([]);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = movimientos.filter(m => 
    m.nombre_producto?.toLowerCase().includes(search.toLowerCase()) || 
    m.id_producto?.toLowerCase().includes(search.toLowerCase()) ||
    m.id_referencia?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Activity className="text-purple-600" /> 
            Kardex (Movimientos)
          </h1>
          <p className="text-gray-500 text-sm">Historial de entradas y salidas de inventario.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <input 
              type="text" 
              placeholder="Buscar por producto o referencia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Movimiento</th>
                <th className="p-4">Producto</th>
                <th className="p-4 text-center">Cant.</th>
                <th className="p-4">Referencia</th>
                <th className="p-4">Sucursal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-400">Cargando Kardex...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-400">No hay movimientos registrados.</td>
                </tr>
              ) : (
                filtered.map(mov => {
                  const date = new Date(mov.fecha);
                  const isEntrada = mov.tipo_movimiento.toLowerCase().includes('entrada');
                  
                  return (
                    <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-700">{date.toLocaleDateString()} {date.toLocaleTimeString()}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-xs ${isEntrada ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {isEntrada ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                          {mov.tipo_movimiento}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-gray-800">{mov.nombre_producto || 'Sin Nombre'}</div>
                        <div className="text-xs text-gray-400 font-mono">{mov.id_producto}</div>
                      </td>
                      <td className="p-4 text-center font-bold text-gray-700">
                        {isEntrada ? '+' : '-'}{mov.cantidad}
                      </td>
                      <td className="p-4 font-mono text-gray-500 text-xs">{mov.id_referencia || '-'}</td>
                      <td className="p-4 text-gray-600">
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">{mov.id_sucursal}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
