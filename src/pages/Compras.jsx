import React, { useState, useEffect } from 'react';
import { ref, onValue, push, set, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import { ShoppingBag, Search, Plus, Trash2, AlertCircle, TrendingDown, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';
import ConfirmModal from '../components/ConfirmModal';

export default function Compras() {
  const [activeTab, setActiveTab] = useState('historial'); // historial, sugerencias, nueva
  
  const [compras, setCompras] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);
  
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [inventario, setInventario] = useState({});
  const [sucursal, setSucursal] = useState('SUC-01'); // idealmente viene del contexto
  
  const [loading, setLoading] = useState(true);

  // Estado para Nueva Compra
  const [cart, setCart] = useState([]);
  const [selectedProveedor, setSelectedProveedor] = useState(null);
  const [numeroFactura, setNumeroFactura] = useState('');
  const [metodoPago, setMetodoPago] = useState('Crédito');
  const [searchProd, setSearchProd] = useState('');
  
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    const provRef = ref(rtdb, 'proveedores');
    const prodRef = ref(rtdb, 'productos');
    const invRef = ref(rtdb, `inventario/${sucursal}`);
    const compRef = ref(rtdb, 'compras');

    const unsubProv = onValue(provRef, (snapshot) => {
      if (snapshot.exists()) {
        setProveedores(Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })));
      } else setProveedores([]);
    });

    const unsubProd = onValue(prodRef, (snapshot) => {
      if (snapshot.exists()) {
        setProductos(Object.keys(snapshot.val()).map(key => ({ id: key, ...snapshot.val()[key] })));
      } else setProductos([]);
    });

    const unsubInv = onValue(invRef, (snapshot) => {
      if (snapshot.exists()) {
        const invData = snapshot.val();
        setInventario(invData);
      } else setInventario({});
    });

    const unsubComp = onValue(compRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        parsed.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setCompras(parsed);
      } else setCompras([]);
      setLoading(false);
    });

    return () => { unsubProv(); unsubProd(); unsubInv(); unsubComp(); };
  }, [sucursal]);

  // Generar sugerencias de compra basadas en el inventario mínimo
  useEffect(() => {
    if (productos.length > 0 && Object.keys(inventario).length > 0) {
      const sugeridas = [];
      productos.forEach(prod => {
        const inv = inventario[prod.id];
        if (inv) {
          const stockActual = inv.stock_actual || 0;
          const stockMinimo = inv.stock_minimo || 0;
          if (stockActual <= stockMinimo) {
            sugeridas.push({
              ...prod,
              stock_actual: stockActual,
              stock_minimo: stockMinimo,
              faltante: stockMinimo - stockActual > 0 ? stockMinimo - stockActual : 10 // Sugerir al menos 10 si están iguales
            });
          }
        }
      });
      setSugerencias(sugeridas);
    }
  }, [productos, inventario]);

  const handleAddToCart = (prod) => {
    const existing = cart.find(item => item.id === prod.id);
    if (existing) {
      setCart(cart.map(item => item.id === prod.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...prod, qty: 1, current_cost: prod.cost || 0 }]);
    }
  };

  const processPurchase = async () => {
    if (cart.length === 0) return toast.error("Agrega productos a la compra");
    if (!selectedProveedor) return toast.error("Seleccione un proveedor");
    if (!numeroFactura.trim()) return toast.error("Ingrese el número de factura del proveedor");

    setConfirmModal({
      isOpen: true,
      title: 'Confirmar Ingreso de Compra',
      message: `¿Estás seguro de registrar esta compra por C$ ${cart.reduce((s, i) => s + (i.current_cost * i.qty), 0)}? Esto aumentará el inventario inmediatamente.`,
      onConfirm: executePurchase
    });
  };

  const executePurchase = async () => {
    setConfirmModal({ ...confirmModal, isOpen: false });
    const toastId = toast.loading("Procesando ingreso de inventario...");
    
    try {
      const total = cart.reduce((sum, item) => sum + (item.current_cost * item.qty), 0);
      
      // 1. Crear el registro de Compra
      const compraRef = push(ref(rtdb, 'compras'));
      const compraId = compraRef.key;
      
      const newCompra = {
        id: compraId,
        fecha: new Date().toISOString(),
        sucursal,
        id_proveedor: selectedProveedor.value,
        nombre_proveedor: selectedProveedor.label,
        numero_factura: numeroFactura.trim(),
        metodo_pago: metodoPago,
        total,
        estado: 'Completado',
        items: cart.map(item => ({
          id_producto: item.id,
          nombre: item.name,
          cantidad: item.qty,
          costo_unitario: item.current_cost,
          subtotal: item.current_cost * item.qty
        }))
      };
      await set(compraRef, newCompra);

      // 2. Si es crédito, crear Cuenta por Pagar (CxP)
      if (metodoPago === 'Crédito') {
        const cxpRef = push(ref(rtdb, 'cxp'));
        const fechaVence = new Date();
        fechaVence.setDate(fechaVence.getDate() + 30); // 30 días de crédito
        await set(cxpRef, {
          id_proveedor: selectedProveedor.value,
          id_compra: compraId,
          numero_factura: numeroFactura.trim(),
          fecha_emision: newCompra.fecha,
          fecha_vencimiento: fechaVence.toISOString(),
          monto_total: total,
          saldo_pendiente: total,
          estado: 'Pendiente'
        });
      }

      // 3. Aumentar Inventario y registrar en Kardex
      for (const item of cart) {
        // Actualizar stock
        const itemInvRef = ref(rtdb, `inventario/${sucursal}/${item.id}/stock_actual`);
        await runTransaction(itemInvRef, (currentStock) => {
          return (currentStock || 0) + item.qty;
        });

        // Actualizar último costo en el producto maestro
        const prodCostRef = ref(rtdb, `productos/${item.id}/cost`);
        await set(prodCostRef, Number(item.current_cost));

        // Registrar en Kardex
        const kardexRef = push(ref(rtdb, 'kardex'));
        await set(kardexRef, {
          fecha: new Date().toISOString(),
          id_sucursal: sucursal,
          id_producto: item.id,
          nombre_producto: item.name,
          tipo_movimiento: 'Entrada por Compra',
          cantidad: item.qty,
          id_referencia: numeroFactura.trim(),
          id_proveedor: selectedProveedor.value
        });
      }

      toast.success("Compra procesada y stock actualizado", { id: toastId });
      
      // Limpiar formulario
      setCart([]);
      setSelectedProveedor(null);
      setNumeroFactura('');
      setActiveTab('historial');

    } catch (error) {
      console.error(error);
      toast.error("Error al procesar: " + error.message, { id: toastId });
    }
  };

  const filteredSearch = productos.filter(p => 
    p.name.toLowerCase().includes(searchProd.toLowerCase()) || 
    p.id.toLowerCase().includes(searchProd.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <ShoppingBag className="text-blue-600" /> 
            Compras y Abastecimiento
          </h1>
          <p className="text-gray-500 text-sm">Ingresa facturas de proveedores y actualiza el stock automáticamente.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setActiveTab('historial')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'historial' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Historial</button>
          <button onClick={() => setActiveTab('sugerencias')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-1 ${activeTab === 'sugerencias' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}>
            Sugerencias {sugerencias.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{sugerencias.length}</span>}
          </button>
          <button onClick={() => setActiveTab('nueva')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'nueva' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>+ Nueva Compra</button>
        </div>
      </div>

      {activeTab === 'historial' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Proveedor</th>
                  <th className="p-4">No. Factura</th>
                  <th className="p-4">Condición</th>
                  <th className="p-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="5" className="p-8 text-center text-gray-400">Cargando...</td></tr>
                ) : compras.length === 0 ? (
                  <tr><td colSpan="5" className="p-8 text-center text-gray-400">No hay compras registradas.</td></tr>
                ) : (
                  compras.map(comp => (
                    <tr key={comp.id} className="hover:bg-gray-50">
                      <td className="p-4 text-gray-600">{new Date(comp.fecha).toLocaleDateString()}</td>
                      <td className="p-4 font-bold text-gray-800">{comp.nombre_proveedor}</td>
                      <td className="p-4 font-mono text-gray-500">{comp.numero_factura}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${comp.metodo_pago === 'Crédito' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {comp.metodo_pago}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-gray-800">C$ {comp.total.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sugerencias' && (
        <div className="space-y-4">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-start gap-3">
            <AlertCircle className="text-red-500 mt-0.5" size={20} />
            <div>
              <h3 className="font-bold text-red-800">Productos por Agotarse</h3>
              <p className="text-sm text-red-600">Estos productos han alcanzado o están por debajo de su stock mínimo de alerta. Se sugiere incluirlos en la próxima orden de compra.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sugerencias.length === 0 ? (
              <div className="col-span-full p-8 text-center text-gray-400 bg-white rounded-xl border border-gray-100">
                <CheckCircle2 className="mx-auto text-green-400 mb-2" size={32} />
                <p>El inventario está saludable. No hay alertas de stock bajo.</p>
              </div>
            ) : (
              sugerencias.map(prod => (
                <div key={prod.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-gray-400">{prod.id}</span>
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <TrendingDown size={12} /> Stock: {prod.stock_actual}
                      </span>
                    </div>
                    <h4 className="font-bold text-gray-800 leading-tight mb-1">{prod.name}</h4>
                    <p className="text-sm text-gray-500">Mínimo requerido: {prod.stock_minimo}</p>
                  </div>
                  <button 
                    onClick={() => {
                      handleAddToCart(prod);
                      setActiveTab('nueva');
                      toast.success("Producto añadido a la nueva orden");
                    }}
                    className="mt-4 w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-bold transition-colors"
                  >
                    Añadir a Orden de Compra
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'nueva' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Buscador de Productos */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Proveedor</label>
                  <Select
                    options={proveedores.map(p => ({ value: p.id, label: p.nombre }))}
                    value={selectedProveedor}
                    onChange={setSelectedProveedor}
                    placeholder="Seleccionar proveedor..."
                    className="react-select-container text-sm"
                    classNamePrefix="react-select"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">No. Factura (Físico)</label>
                  <input type="text" value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)} placeholder="F-00123" className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm h-[38px] uppercase" />
                </div>
              </div>
              
              <div className="relative">
                <input 
                  type="text" 
                  value={searchProd}
                  onChange={(e) => setSearchProd(e.target.value)}
                  placeholder="Buscar producto a ingresar..." 
                  className="w-full border p-3 pl-10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <Search className="absolute left-3 top-3.5 text-gray-400" size={18} />
              </div>
              
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {filteredSearch.slice(0, 20).map(p => (
                  <div key={p.id} onClick={() => handleAddToCart(p)} className="border border-gray-100 p-3 rounded-xl cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all flex justify-between items-center bg-gray-50/50 hover:bg-blue-50/30">
                    <div>
                      <p className="font-bold text-gray-800 text-sm line-clamp-1">{p.name}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{p.id}</p>
                    </div>
                    <Plus className="text-blue-500" size={18} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Carrito de Compra */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <ShoppingBag size={18} className="text-blue-600" /> Detalle de Ingreso
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                  <ShoppingBag size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">Selecciona productos para agregarlos a la factura de compra</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="bg-white border border-gray-100 p-3 rounded-xl shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-gray-800 text-sm leading-tight pr-4">{item.name}</p>
                        <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} className="text-red-400 hover:text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-gray-400">Cant.</label>
                          <input type="number" min="1" value={item.qty} onChange={(e) => setCart(cart.map(c => c.id === item.id ? {...c, qty: Number(e.target.value)} : c))} className="w-full border rounded p-1.5 text-sm text-center outline-none focus:border-blue-500" />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-gray-400">Costo Unit.</label>
                          <input type="number" min="0" step="0.01" value={item.current_cost} onChange={(e) => setCart(cart.map(c => c.id === item.id ? {...c, current_cost: Number(e.target.value)} : c))} className="w-full border rounded p-1.5 text-sm text-right outline-none focus:border-blue-500 font-medium" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Condición de Pago</label>
                <div className="flex bg-gray-200 rounded-lg p-1">
                  <button onClick={() => setMetodoPago('Contado')} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${metodoPago === 'Contado' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Contado</button>
                  <button onClick={() => setMetodoPago('Crédito')} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${metodoPago === 'Crédito' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Crédito (CxP)</button>
                </div>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-gray-600">Total Factura:</span>
                <span className="text-2xl font-black text-blue-900">
                  C$ {cart.reduce((s, i) => s + (i.current_cost * i.qty), 0).toFixed(2)}
                </span>
              </div>
              <button 
                onClick={processPurchase}
                disabled={cart.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                Registrar Ingreso de Inventario
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        confirmText="Confirmar Ingreso"
        isDanger={false}
      />
    </div>
  );
}
