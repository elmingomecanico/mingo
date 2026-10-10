import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import { BarChart2, DollarSign, ShoppingBag, Calendar, FileText } from 'lucide-react';

export default function Reportes() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroSucursal, setFiltroSucursal] = useState('Todas');

  useEffect(() => {
    const ventasRef = ref(rtdb, 'ventas');
    
    const unsub = onValue(ventasRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsed = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        
        // Ordenar por fecha descendente
        parsed.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setVentas(parsed);
      } else {
        setVentas([]);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filteredVentas = filtroSucursal === 'Todas' 
    ? ventas 
    : ventas.filter(v => v.sucursal === filtroSucursal);

  // Cálculos de totales
  const totalIngresos = filteredVentas.reduce((sum, v) => sum + (v.total || 0), 0);
  const totalFacturas = filteredVentas.length;
  const hoy = new Date().toISOString().split('T')[0];
  const ventasHoy = filteredVentas.filter(v => v.fecha && v.fecha.startsWith(hoy));
  const ingresosHoy = ventasHoy.reduce((sum, v) => sum + (v.total || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <BarChart2 className="text-amber-500" /> 
            Reportes y Ventas
          </h1>
          <p className="text-gray-500 text-sm">Resumen de ingresos y facturas emitidas.</p>
        </div>
        
        <select 
          value={filtroSucursal}
          onChange={(e) => setFiltroSucursal(e.target.value)}
          className="border-gray-200 bg-white border p-2.5 rounded-lg font-medium text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="Todas">Todas las Sucursales</option>
          <option value="SUC-01">Sucursal Principal (SUC-01)</option>
          <option value="SUC-02">Sucursal Norte (SUC-02)</option>
        </select>
      </div>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-50">
            <DollarSign size={24} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-gray-500 font-medium text-sm">Ingresos de Hoy</p>
            <h3 className="text-2xl font-black text-gray-800">C$ {ingresosHoy.toFixed(2)}</h3>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-blue-50">
            <ShoppingBag size={24} className="text-blue-500" />
          </div>
          <div>
            <p className="text-gray-500 font-medium text-sm">Facturas de Hoy</p>
            <h3 className="text-2xl font-black text-gray-800">{ventasHoy.length}</h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-amber-50">
            <FileText size={24} className="text-amber-500" />
          </div>
          <div>
            <p className="text-gray-500 font-medium text-sm">Total Histórico</p>
            <h3 className="text-2xl font-black text-gray-800">C$ {totalIngresos.toFixed(2)}</h3>
          </div>
        </div>
      </div>

      {/* Historial de Ventas */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
          <Calendar size={18} className="text-gray-500" />
          <h2 className="font-bold text-gray-700">Historial de Facturas</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Factura</th>
                <th className="p-4">Fecha y Hora</th>
                <th className="p-4">Sucursal</th>
                <th className="p-4">Productos Vendidos</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-400">Cargando reporte de ventas...</td>
                </tr>
              ) : filteredVentas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-400">No hay ventas registradas.</td>
                </tr>
              ) : (
                filteredVentas.map(venta => {
                  const date = new Date(venta.fecha);
                  const itemsSummary = venta.items 
                    ? venta.items.map(i => `${i.cantidad}x ${i.name || 'Prod'}`).join(', ')
                    : 'Sin detalles';
                  
                  return (
                    <tr key={venta.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-mono font-bold text-gray-700">
                        {venta.numero_factura || venta.id.substring(venta.id.length - 6).toUpperCase()}
                      </td>
                      <td className="p-4 text-gray-700">{date.toLocaleDateString()} {date.toLocaleTimeString()}</td>
                      <td className="p-4 text-gray-600">
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">{venta.sucursal}</span>
                      </td>
                      <td className="p-4 text-gray-600 truncate max-w-xs" title={itemsSummary}>
                        {itemsSummary}
                      </td>
                      <td className="p-4 text-right font-bold text-blue-700">C$ {venta.total?.toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-bold text-xs bg-green-100 text-green-700">
                          {venta.estado || 'Completado'}
                        </span>
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
