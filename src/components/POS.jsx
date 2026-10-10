import React, { useState, useEffect } from 'react';
import { ShoppingCart, Trash2, Search, Save, Loader } from 'lucide-react';
import { ref, onValue, push, set, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import logoIcon from '../assets/logo-icon.jpg';

export default function POS() {
  const [sucursal, setSucursal] = useState('SUC-01');
  const [cart, setCart] = useState([]);
  const [searchCode, setSearchCode] = useState('');
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);

  // Cargar productos e inventario desde Firebase Realtime Database
  useEffect(() => {
    const prodRef = ref(rtdb, 'productos');
    const invRef = ref(rtdb, `inventario/${sucursal}`);

    const unsubProd = onValue(prodRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const prodList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setProducts(prodList);
      }
    });

    const unsubInv = onValue(invRef, (snapshot) => {
      if (snapshot.val()) {
        setInventory(snapshot.val());
      } else {
        setInventory({});
      }
      setLoading(false);
    });

    return () => {
      unsubProd();
      unsubInv();
    };
  }, [sucursal]);

  const addToCart = (product) => {
    const stockActual = inventory[product.id]?.stock_actual || 0;
    
    const existing = cart.find(item => item.id === product.id);
    const requestedQty = existing ? existing.qty + 1 : 1;

    if (requestedQty > stockActual) {
      alert(`Stock insuficiente. Solo quedan ${stockActual} unidades disponibles.`);
      return;
    }

    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
    } else {
      setCart([...cart, { ...product, qty: 1, discount: 0 }]);
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.qty) - item.discount, 0);

  const processSale = async () => {
    if (cart.length === 0) return alert('El carrito está vacío');
    setLoading(true);

    try {
      // 1. Crear documento de Venta
      const saleRef = push(ref(rtdb, 'ventas'));
      const saleId = saleRef.key;
      
      const newSale = {
        fecha: new Date().toISOString(),
        sucursal,
        total,
        estado: 'Completado',
        items: cart.map(item => ({
          id_producto: item.id,
          cantidad: item.qty,
          precio_unitario: item.price,
          subtotal: (item.price * item.qty) - item.discount
        }))
      };

      await set(saleRef, newSale);

      // 2. Descontar Inventario (Transacción Atómica)
      for (const item of cart) {
        const itemInvRef = ref(rtdb, `inventario/${sucursal}/${item.id}/stock_actual`);
        await runTransaction(itemInvRef, (currentStock) => {
          return (currentStock || 0) - item.qty;
        });
        
        // 3. Registrar en Kardex
        const kardexRef = push(ref(rtdb, 'kardex'));
        await set(kardexRef, {
          fecha: new Date().toISOString(),
          id_sucursal: sucursal,
          id_producto: item.id,
          tipo_movimiento: 'Salida',
          cantidad: item.qty,
          id_referencia: saleId
        });
      }

      alert(`Factura procesada con éxito: ${saleId}`);
      setCart([]);
    } catch (error) {
      console.error(error);
      alert('Error procesando la venta: ' + error.message);
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchCode.toLowerCase()) || 
    p.id.toLowerCase().includes(searchCode.toLowerCase())
  );

  // ================== SEED DATABASE ==================
  const seedDatabase = async () => {
    if (!window.confirm("¿Inicializar la base de datos con los datos de prueba de Excel?")) return;
    setLoading(true);
    const prodRef = ref(rtdb, 'productos');
    const invSuc01Ref = ref(rtdb, 'inventario/SUC-01');
    const invSuc02Ref = ref(rtdb, 'inventario/SUC-02');

    const dummyProducts = {
      "PROD-0001": { name: "Aceite 20W50 4T (Litro)", price: 350, cost: 250, cat: "Lubricantes" },
      "PROD-0002": { name: "Llanta Trasera 90/90-18", price: 1600, cost: 1200, cat: "Llantas" },
      "PROD-0003": { name: "PASTILLAS DE FRENO DELANTERAS", price: 250, cost: 150, cat: "FRENOS" },
      "PROD-0004": { name: "Batería 12V 7Ah Seca", price: 1000, cost: 800, cat: "Eléctrico" }
    };

    const dummyInv01 = {
      "PROD-0001": { stock_actual: 18, stock_minimo: 5, ubicacion: "UBI-002" },
      "PROD-0002": { stock_actual: 4, stock_minimo: 2, ubicacion: "Bodega 2" },
      "PROD-0003": { stock_actual: 10, stock_minimo: 5, ubicacion: "ESTANTE 3-B" },
      "PROD-0004": { stock_actual: 5, stock_minimo: 2, ubicacion: "Estante 2-C" }
    };

    const dummyInv02 = {
      "PROD-0001": { stock_actual: 4, stock_minimo: 2, ubicacion: "UBI-003" }
    };

    try {
      await set(prodRef, dummyProducts);
      await set(invSuc01Ref, dummyInv01);
      await set(invSuc02Ref, dummyInv02);
      alert("¡Base de datos inicializada!");
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };
  // ===================================================

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Lado Izquierdo */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <img src={logoIcon} alt="Logo" className="w-10 h-10 object-contain rounded" />
              Taller El Mingo
            </h1>
            <div className="flex gap-2">
              {products.length === 0 && (
                <button onClick={seedDatabase} className="bg-yellow-500 text-white px-3 py-2 rounded text-sm font-bold">
                  Inicializar BD
                </button>
              )}
              <select 
                value={sucursal}
                onChange={(e) => setSucursal(e.target.value)}
                className="border p-2 rounded bg-gray-50 font-semibold"
              >
                <option value="SUC-01">Sucursal Principal (SUC-01)</option>
                <option value="SUC-02">Sucursal Norte (SUC-02)</option>
              </select>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="relative">
              <input 
                type="text" 
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Buscar código o nombre del producto..." 
                className="w-full border p-3 pl-10 rounded-lg text-lg focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-3.5 text-gray-400" />
            </div>
            
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
              {loading && <p className="text-gray-500">Cargando base de datos...</p>}
              {!loading && filteredProducts.map(p => {
                const stock = inventory[p.id]?.stock_actual || 0;
                return (
                  <div key={p.id} onClick={() => addToCart(p)} className="border p-3 rounded-lg cursor-pointer hover:bg-blue-50 transition border-blue-100 flex flex-col justify-between h-24">
                    <p className="font-bold text-gray-800 text-xs line-clamp-2">{p.name}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-green-600 font-bold text-sm">C${p.price}</span>
                      <span className={`text-xs px-2 py-1 rounded-full text-white ${stock > 0 ? 'bg-blue-500' : 'bg-red-500'}`}>
                        {stock} disp.
                      </span>
                    </div>
                  </div>
                )
              })}
              {!loading && filteredProducts.length === 0 && <p className="col-span-3 text-center text-gray-400">No hay productos que coincidan.</p>}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h2 className="font-bold text-lg mb-3 text-gray-700">Carrito de Compras</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b text-sm">
                  <tr>
                    <th className="p-3">Descripción</th>
                    <th className="p-3 w-20">Cant.</th>
                    <th className="p-3">Precio</th>
                    <th className="p-3">Subtotal</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {cart.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3">
                        <input type="number" min="1" value={item.qty} 
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 1;
                            setCart(cart.map(c => c.id === item.id ? {...c, qty: newQty} : c))
                          }}
                          className="w-16 border rounded p-1 text-center" />
                      </td>
                      <td className="p-3">C${item.price}</td>
                      <td className="p-3 font-bold">C${(item.price * item.qty) - item.discount}</td>
                      <td className="p-3 text-red-500 cursor-pointer hover:text-red-700" onClick={() => setCart(cart.filter(c => c.id !== item.id))}>
                        <Trash2 size={18} />
                      </td>
                    </tr>
                  ))}
                  {cart.length === 0 && <tr><td colSpan="5" className="p-6 text-center text-gray-400">El carrito está vacío</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Lado Derecho */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border-t-4 border-blue-600">
            <h2 className="font-bold text-gray-500 mb-2">Resumen de Factura</h2>
            <div className="flex justify-between text-lg mb-2">
              <span>Subtotal:</span>
              <span>C${total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-3xl font-black mt-4 pt-4 border-t text-blue-900">
              <span>TOTAL:</span>
              <span>C${total.toFixed(2)}</span>
            </div>
          </div>

          <button 
            onClick={processSale}
            disabled={loading || cart.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold text-xl p-4 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
          >
            {loading ? <Loader className="animate-spin" /> : <Save size={24} />}
            PROCESAR FACTURA
          </button>
        </div>

      </div>
    </div>
  );
}
