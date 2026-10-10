import React from 'react';
import { ShoppingBag, TrendingUp, AlertTriangle, Users, ShoppingCart, Package, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  const stats = [
    { label: 'Ventas de Hoy', value: 'C$ 8,450.00', icon: <TrendingUp size={24} className="text-emerald-500" />, color: 'bg-emerald-50' },
    { label: 'Facturas Emitidas', value: '24', icon: <ShoppingBag size={24} className="text-blue-500" />, color: 'bg-blue-50' },
    { label: 'Alertas de Stock', value: '3', icon: <AlertTriangle size={24} className="text-amber-500" />, color: 'bg-amber-50' },
    { label: 'Clientes Atendidos', value: '18', icon: <Users size={24} className="text-purple-500" />, color: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-800 tracking-tight">Bienvenido de vuelta, Mingo 👋</h1>
        <p className="text-gray-500 mt-2 text-lg">Este es un resumen de lo que está pasando en tus sucursales hoy.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-5 hover:shadow-md transition-shadow">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-gray-500 font-medium text-sm">{stat.label}</p>
              <h3 className="text-2xl font-black text-gray-800">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <Link to="/pos" className="group relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg hover:shadow-blue-500/30 transition-all hover:-translate-y-1">
            <ShoppingCart size={40} className="mb-4 opacity-80 group-hover:scale-110 transition-transform" />
            <h3 className="text-2xl font-bold">Abrir Caja POS</h3>
            <p className="text-blue-100 mt-2 text-sm">Facturar productos y servicios, aplicar descuentos y cobrar.</p>
          </Link>

          <Link to="/inventario" className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-emerald-500/30 transition-all hover:-translate-y-1">
            <Package size={40} className="mb-4 opacity-80 group-hover:scale-110 transition-transform" />
            <h3 className="text-2xl font-bold">Ver Inventario</h3>
            <p className="text-emerald-100 mt-2 text-sm">Revisar existencias de SUC-01 y SUC-02, registrar entradas.</p>
          </Link>

          <Link to="/reportes" className="group relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-amber-500/30 transition-all hover:-translate-y-1">
            <BarChart2 size={40} className="mb-4 opacity-80 group-hover:scale-110 transition-transform" />
            <h3 className="text-2xl font-bold">Reportes</h3>
            <p className="text-amber-100 mt-2 text-sm">Ver ventas del día, kardex de movimientos y ganancias.</p>
          </Link>

        </div>
      </div>

    </div>
  );
}
