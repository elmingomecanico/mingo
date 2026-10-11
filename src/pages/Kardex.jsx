import React, { useState, useEffect } from 'react';
import { ref, onValue, push, set } from 'firebase/database';
import { rtdb } from '../firebase';
import { 
  Activity, ArrowDownRight, ArrowUpRight, Search, Filter, 
  RefreshCw, Package, ShoppingBag, ShoppingCart, SlidersHorizontal 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Kardex() {
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('Todas');
  const [filtroTipo, setFiltroTipo] = useState('Todos');

  useEffect(() => {
    // 1. Cargar catálogo maestro de productos para resolución de nombres
    const prodRef = ref(rtdb, 'productos');
    let prodsMap = {};
    const unsubProd = onValue(prodRef, (snapshot) => {
      if (snapshot.exists()) {
        prodsMap = snapshot.val();
        setProductos(prodsMap);
      }
    });

    // 2. Cargar Kardex y Ventas para reconciliación total
    const kardexRef = ref(rtdb, 'kardex');
    const ventasRef = ref(rtdb, 'ventas');

    let rawKardex = {};
    let rawVentas = {};

    const processAll = () => {
      const allMovs = [];
      const refRegistradas = new Set();

      // Función recursiva para aplanar cualquier estructura de Kardex (plana o anidada)
      const traverse = (node, pathSucursal = null, pathProdId = null) => {
        if (!node || typeof node !== 'object') return;

        // Si es un nodo de movimiento individual
        if (node.fecha && (node.cantidad !== undefined || node.tipo || node.tipo_movimiento)) {
          const prodId = node.id_producto || pathProdId || '';
          
          // Resolución inteligente del nombre del producto (nunca "Sin Nombre")
          let prodName = node.nombre_producto;
          if (!prodName || prodName === 'Sin Nombre' || prodName === 'Prod') {
            prodName = prodsMap[prodId]?.name || (prodId ? `Producto ${prodId}` : 'Producto General');
          }

          const suc = node.id_sucursal || pathSucursal || 'SUC-01';
          const rawTipo = (node.tipo_movimiento || node.tipo || 'Salida').toString();
          const isEntrada = rawTipo.toLowerCase().includes('entrada');
          const tipoMov = isEntrada ? (rawTipo.includes('Ajuste') ? 'Entrada por Ajuste' : 'Entrada por Compra') 
                                    : (rawTipo.includes('Ajuste') ? 'Salida por Ajuste' : 'Salida por Venta');

          let refId = node.id_referencia || '';
          if (!refId && node.motivo) {
            const match = node.motivo.match(/\(([^)]+)\)/);
            refId = match ? match[1] : node.motivo;
          }

          const movItem = {
            id: node.id || Math.random().toString(36).substring(2, 9),
            fecha: node.fecha,
            id_sucursal: suc,
            id_producto: prodId,
            nombre_producto: prodName,
            tipo_movimiento: tipoMov,
            isEntrada,
            cantidad: Math.abs(Number(node.cantidad) || 0),
            id_referencia: refId || '-',
            stock_anterior: node.stock_anterior !== undefined ? node.stock_anterior : null,
            stock_nuevo: node.stock_nuevo !== undefined ? node.stock_nuevo : null,
            usuario: node.usuario || 'Sistema'
          };

          allMovs.push(movItem);

          if (refId && prodId) {
            refRegistradas.add(`${refId}_${prodId}`);
          }
          return;
        }

        // Si es un nodo contenedor, recorrer sus hijos
        Object.keys(node).forEach(key => {
          const child = node[key];
          if (child && typeof child === 'object') {
            const nextSuc = key.startsWith('SUC-') ? key : pathSucursal;
            const nextProd = key.startsWith('PROD-') || key.startsWith('SERV-') ? key : pathProdId;
            traverse(child, nextSuc, nextProd);
          }
        });
      };

      if (rawKardex && Object.keys(rawKardex).length > 0) {
        traverse(rawKardex);
      }

      // Reconciliar con Ventas para asegurar que ninguna venta falte en el Kardex
      if (rawVentas && Object.keys(rawVentas).length > 0) {
        Object.keys(rawVentas).forEach(vKey => {
          const venta = rawVentas[vKey];
          const facturaNum = venta.numero_factura || vKey;
          const fechaVenta = venta.fecha || new Date().toISOString();
          const sucursalVenta = venta.sucursal || 'SUC-01';

          if (Array.isArray(venta.items)) {
            venta.items.forEach(item => {
              if (item.type !== 'servicio') {
                const pId = item.id_producto || item.id;
                const keyRefCheck = `${facturaNum}_${pId}`;

                if (!refRegistradas.has(keyRefCheck)) {
                  // Nombre limpio
                  const pName = item.name || item.nombre || prodsMap[pId]?.name || `Producto ${pId}`;

                  const reconciledMov = {
                    id: `ventas_${vKey}_${pId}`,
                    fecha: fechaVenta,
                    id_sucursal: sucursalVenta,
                    id_producto: pId,
                    nombre_producto: pName,
                    tipo_movimiento: 'Salida por Venta',
                    isEntrada: false,
                    cantidad: Math.abs(Number(item.cantidad || item.qty || 1)),
                    id_referencia: facturaNum,
                    stock_anterior: null,
                    stock_nuevo: null,
                    usuario: 'Caja POS'
                  };

                  allMovs.push(reconciledMov);
                  refRegistradas.add(keyRefCheck);

                  // Auto-sincronizar en segundo plano hacia la colección raíz kardex en Firebase
                  try {
                    const newKRef = push(ref(rtdb, 'kardex'));
                    set(newKRef, {
                      fecha: fechaVenta,
                      id_sucursal: sucursalVenta,
                      id_producto: pId,
                      nombre_producto: pName,
                      tipo_movimiento: 'Salida por Venta',
                      cantidad: Math.abs(Number(item.cantidad || item.qty || 1)),
                      id_referencia: facturaNum,
                      usuario: 'Caja POS'
                    });
                  } catch (e) {}
                }
              }
            });
          }
        });
      }

      // Ordenar cronológicamente descendente (lo más reciente primero)
      allMovs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setMovimientos(allMovs);
      setLoading(false);
    };

    const unsubKardex = onValue(kardexRef, (snapshot) => {
      rawKardex = snapshot.exists() ? snapshot.val() : {};
      processAll();
    });

    const unsubVentas = onValue(ventasRef, (snapshot) => {
      rawVentas = snapshot.exists() ? snapshot.val() : {};
      processAll();
    });

    return () => {
      unsubProd();
      unsubKardex();
      unsubVentas();
    };
  }, []);

  // Filtros interactivos
  const filtered = movimientos.filter(m => {
    // Filtro por sucursal
    if (filtroSucursal !== 'Todas' && m.id_sucursal !== filtroSucursal) return false;

    // Filtro por tipo
    if (filtroTipo === 'Entradas' && !m.isEntrada) return false;
    if (filtroTipo === 'Salidas' && m.isEntrada) return false;

    // Filtro por texto
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (m.nombre_producto || '').toLowerCase().includes(s) ||
      (m.id_producto || '').toLowerCase().includes(s) ||
      (m.id_referencia || '').toLowerCase().includes(s)
    );
  });

  const totalEntradas = movimientos.filter(m => m.isEntrada).length;
  const totalSalidas = movimientos.filter(m => !m.isEntrada).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Activity className="text-purple-600" /> 
            Kardex de Inventario (Movimientos)
          </h1>
          <p className="text-gray-500 text-sm">
            Auditoría en tiempo real de entradas por compras, salidas por facturación en caja y ajustes de inventario.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-xs">
            Total Movimientos: <strong className="text-purple-700">{movimientos.length}</strong>
          </span>
        </div>
      </div>

      {/* TARJETAS RESUMEN DE ACTIVIDAD */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Movimientos Totales</p>
            <h3 className="text-2xl font-black text-gray-800 mt-1">{movimientos.length}</h3>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Activity size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Salidas (Ventas / Despachos)</p>
            <h3 className="text-2xl font-black text-red-600 mt-1">{totalSalidas}</h3>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <ArrowUpRight size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">Entradas (Compras / Ingresos)</p>
            <h3 className="text-2xl font-black text-green-600 mt-1">{totalEntradas}</h3>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <ArrowDownRight size={22} />
          </div>
        </div>
      </div>

      {/* CONTENEDOR DE TABLA CON FILTROS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* BARRA DE FILTROS */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="relative w-full md:w-96">
            <input 
              type="text" 
              placeholder="Buscar por producto, código (PROD-...) o factura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 bg-white"
            />
            <Search size={16} className="absolute left-3 top-3.5 text-gray-400" />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-xs font-bold text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <select
              value={filtroSucursal}
              onChange={(e) => setFiltroSucursal(e.target.value)}
              className="border border-gray-200 p-2 rounded-xl text-xs font-bold text-gray-700 bg-white outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="Todas">Todas las Sucursales</option>
              <option value="SUC-01">Sucursal Principal (SUC-01)</option>
              <option value="SUC-02">Sucursal Norte (SUC-02)</option>
            </select>

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="border border-gray-200 p-2 rounded-xl text-xs font-bold text-gray-700 bg-white outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="Todos">Todos los Movimientos</option>
              <option value="Salidas">Solo Salidas (Ventas)</option>
              <option value="Entradas">Solo Entradas (Compras)</option>
            </select>
          </div>
        </div>

        {/* TABLA PRINCIPAL */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/80 text-gray-600 font-bold border-b border-gray-100">
              <tr>
                <th className="p-4">Fecha y Hora</th>
                <th className="p-4">Tipo Movimiento</th>
                <th className="p-4">Producto Afectado</th>
                <th className="p-4 text-center">Cant.</th>
                <th className="p-4">Referencia / Factura</th>
                <th className="p-4">Sucursal</th>
                <th className="p-4">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-10 text-center text-gray-400 font-medium">
                    Cargando movimientos de inventario...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-gray-400">
                    <Activity className="mx-auto mb-2 opacity-40" size={32} />
                    <p className="font-bold text-gray-600 text-sm">No se encontraron movimientos registrados</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {search ? 'Intenta cambiar los términos de búsqueda o filtros.' : 'Los movimientos de ventas y compras aparecerán aquí automáticamente.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(mov => {
                  const date = new Date(mov.fecha);
                  const isEntrada = mov.isEntrada;
                  
                  return (
                    <tr key={mov.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="p-4 text-gray-700 text-xs">
                        <div className="font-bold text-gray-800">{date.toLocaleDateString()}</div>
                        <div className="text-[11px] text-gray-400">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs ${
                          isEntrada 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {isEntrada ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                          {mov.tipo_movimiento}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-gray-800 text-sm">{mov.nombre_producto}</div>
                        <span className="font-mono text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {mov.id_producto || 'N/A'}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <span className={`font-black text-sm px-2.5 py-1 rounded-lg ${
                          isEntrada ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {isEntrada ? '+' : '-'}{mov.cantidad}
                        </span>
                      </td>

                      <td className="p-4 font-mono text-gray-700 font-bold text-xs">
                        <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg inline-block">
                          {mov.id_referencia}
                        </span>
                      </td>

                      <td className="p-4 text-gray-600">
                        <span className="bg-gray-100 font-semibold px-2 py-0.5 rounded text-xs">
                          {mov.id_sucursal}
                        </span>
                      </td>

                      <td className="p-4 text-gray-500 text-xs font-medium">
                        {mov.usuario || 'Cajero POS'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
