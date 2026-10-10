import React, { useState, useEffect } from 'react';
import { ShoppingBag, TrendingUp, AlertTriangle, Users, Wallet, CreditCard, Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const [ventasHoy, setVentasHoy] = useState(0);
  const [montoVentasHoy, setMontoVentasHoy] = useState(0);
  const [alertasStock, setAlertasStock] = useState([]);
  const [totalCxCPendiente, setTotalCxCPendiente] = useState(0);
  const [totalCxPPendiente, setTotalCxPPendiente] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Obtener Ventas de Hoy
    const ventasRef = ref(rtdb, 'ventas');
    const unsubVentas = onValue(ventasRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        let hoyCount = 0;
        let hoyMonto = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        Object.values(val).forEach(venta => {
          if (venta.fecha && venta.fecha.startsWith(todayStr)) {
            hoyCount++;
            hoyMonto += Number(venta.total || 0);
          }
        });
        setVentasHoy(hoyCount);
        setMontoVentasHoy(hoyMonto);
      }
    });

    // 2. Obtener Alertas de Stock
    // Necesitamos productos e inventario
    const prodRef = ref(rtdb, 'productos');
    const invRef = ref(rtdb, `inventario/${user?.id_sucursal || 'SUC-01'}`);
    
    let productos = [];
    let inventario = {};

    const calcStock = () => {
      if (productos.length > 0 && Object.keys(inventario).length > 0) {
        const alertas = [];
        productos.forEach(prod => {
          const inv = inventario[prod.id];
          if (inv) {
            const stockActual = inv.stock_actual || 0;
            const stockMinimo = inv.stock_minimo || 0;
            if (stockActual <= stockMinimo) {
              alertas.push({ ...prod, stock_actual: stockActual, stock_minimo: stockMinimo });
            }
          }
        });
        setAlertasStock(alertas);
      }
    };

    const unsubProd = onValue(prodRef, (snapshot) => {
      if (snapshot.exists()) {
        productos = Object.keys(snapshot.val()).map(k => ({ id: k, ...snapshot.val()[k] }));
        calcStock();
      }
    });

    const unsubInv = onValue(invRef, (snapshot) => {
      if (snapshot.exists()) {
        inventario = snapshot.val();
        calcStock();
      }
    });

    // 3. Obtener CxC Pendiente
    const cxcRef = ref(rtdb, 'cxc');
    const unsubCxC = onValue(cxcRef, (snapshot) => {
      let pending = 0;
      if (snapshot.exists()) {
        Object.values(snapshot.val()).forEach(doc => {
          if (doc.estado === 'Pendiente') {
            pending += Number(doc.saldo_pendiente || 0);
          }
        });
      }
      setTotalCxCPendiente(pending);
    });

    // 4. Obtener CxP Pendiente
    const cxpRef = ref(rtdb, 'cxp');
    const unsubCxP = onValue(cxpRef, (snapshot) => {
      let pending = 0;
      if (snapshot.exists()) {
        Object.values(snapshot.val()).forEach(doc => {
          if (doc.estado === 'Pendiente') {
            pending += Number(doc.saldo_pendiente || 0);
          }
        });
      }
      setTotalCxPPendiente(pending);
      setLoading(false);
    });

    return () => {
      unsubVentas();
      unsubProd();
      unsubInv();
      unsubCxC();
      unsubCxP();
    };
  }, [user]);

  const firstName = user?.nombre_completo?.split(' ')[0] || 'Usuario';

  const stats = [
    { label: 'Ventas de Hoy', value: `C$ ${montoVentasHoy.toFixed(2)}`, sub: `${ventasHoy} facturas emitidas`, icon: <TrendingUp size={24} className="text-emerald-500" />, color: 'bg-emerald-50' },
    { label: 'Cuentas por Cobrar', value: `C$ ${totalCxCPendiente.toFixed(2)}`, sub: 'Saldo pendiente de clientes', icon: <Wallet size={24} className="text-blue-500" />, color: 'bg-blue-50' },
    { label: 'Cuentas por Pagar', value: `C$ ${totalCxPPendiente.toFixed(2)}`, sub: 'Deuda con proveedores', icon: <CreditCard size={24} className="text-purple-500" />, color: 'bg-purple-50' },
    { label: 'Alertas de Stock', value: alertasStock.length, sub: 'Productos agotándose', icon: <AlertTriangle size={24} className="text-red-500" />, color: 'bg-red-50' },
  ];

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando métricas...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-800 tracking-tight">Bienvenido de vuelta, {firstName} 👋</h1>
        <p className="text-gray-500 mt-2 text-lg">Este es un resumen de lo que está pasando en la sucursal hoy.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4 hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-gray-500 font-bold text-sm mb-1">{stat.label}</p>
              <h3 className="text-2xl font-black text-gray-800">{stat.value}</h3>
              <p className="text-xs text-gray-400 mt-1 font-medium">{stat.sub}</p>
            </div>
            {/* Decal de fondo */}
            <div className={`absolute -bottom-6 -right-6 opacity-5 group-hover:scale-125 transition-transform duration-500`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Productos Agotándose */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={20} /> Productos por Agotarse
            </h2>
            <Link to="/compras" className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
              Ver Sugerencias <ArrowRight size={14} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            {alertasStock.length === 0 ? (
              <p className="text-center text-gray-500 py-8 bg-gray-50 rounded-xl">Inventario saludable. No hay alertas.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-gray-400 border-b border-gray-100">
                  <tr>
                    <th className="pb-3 font-medium">Producto</th>
                    <th className="pb-3 font-medium text-center">Stock Actual</th>
                    <th className="pb-3 font-medium text-center">Mínimo Permitido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {alertasStock.slice(0, 5).map(item => (
                    <tr key={item.id}>
                      <td className="py-3 font-bold text-gray-700">{item.name}</td>
                      <td className="py-3 text-center">
                        <span className="bg-red-100 text-red-700 font-bold px-2 py-1 rounded">{item.stock_actual}</span>
                      </td>
                      <td className="py-3 text-center text-gray-500">{item.stock_minimo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-black text-gray-800 mb-6">Acciones Rápidas</h2>
          <div className="flex flex-col gap-3">
            <Link to="/pos" className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-4 rounded-xl font-bold flex items-center gap-3 transition-colors">
              <ShoppingBag size={20} />
              Nueva Venta (POS)
            </Link>
            <Link to="/compras" className="bg-purple-50 hover:bg-purple-100 text-purple-700 p-4 rounded-xl font-bold flex items-center gap-3 transition-colors">
              <Activity size={20} />
              Ingresar Compra
            </Link>
            <Link to="/cxc" className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-4 rounded-xl font-bold flex items-center gap-3 transition-colors">
              <Wallet size={20} />
              Cobrar a Clientes
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
