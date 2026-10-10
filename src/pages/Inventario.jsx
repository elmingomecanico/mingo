import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push } from 'firebase/database';
import { rtdb } from '../firebase';
import { Search, Plus, Edit2, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';

export default function Inventario() {
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState({});
  const [search, setSearch] = useState('');
  const [sucursal, setSucursal] = useState('SUC-01');
  const [loading, setLoading] = useState(true);
  
  // State para catálogos
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', price: '', cost: '', cat: '', stock_actual: 0, stock_minimo: 0, ubicacion: ''
  });

  useEffect(() => {
    const prodsRef = ref(rtdb, 'productos');
    const invRef = ref(rtdb, `inventario/${sucursal}`);
    const catRef = ref(rtdb, 'catalogos/categorias');
    const ubiRef = ref(rtdb, 'catalogos/ubicaciones');

    const unsubProds = onValue(prodsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setProducts(Object.keys(data).map(key => ({ id: key, ...data[key] })));
      } else {
        setProducts([]);
      }
    });

    const unsubInv = onValue(invRef, (snapshot) => {
      if (snapshot.exists()) setInventory(snapshot.val());
      else setInventory({});
      setLoading(false);
    });

    const unsubCat = onValue(catRef, (snapshot) => {
      if (snapshot.exists()) setCategorias(Object.values(snapshot.val()).map(c => c.nombre));
    });

    const unsubUbi = onValue(ubiRef, (snapshot) => {
      if (snapshot.exists()) setUbicaciones(Object.values(snapshot.val()).map(u => u.nombre));
    });

    return () => {
      unsubProds();
      unsubInv();
      unsubCat();
      unsubUbi();
    };
  }, [sucursal]);

  const searchTerms = search.toLowerCase().split(' ').filter(t => t.trim() !== '');
  const filtered = products.filter(p => {
    const textToSearch = `${p.name} ${p.id} ${p.cat || ''}`.toLowerCase();
    return searchTerms.every(term => textToSearch.includes(term));
  });

  const handleOpenModal = (prod = null) => {
    if (prod) {
      setEditingId(prod.id);
      const invData = inventory[prod.id] || { stock_actual: 0, stock_minimo: 0, ubicacion: '' };
      setFormData({
        name: prod.name,
        price: prod.price,
        cost: prod.cost || 0,
        cat: prod.cat || '',
        stock_actual: invData.stock_actual,
        stock_minimo: invData.stock_minimo || 0,
        ubicacion: invData.ubicacion || ''
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', price: '', cost: '', cat: '', stock_actual: 0, stock_minimo: 0, ubicacion: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      let prodId = editingId;
      if (!prodId) {
        // Generar nuevo ID si es producto nuevo (simulando PROD-XXXX)
        const num = products.length + 1;
        prodId = `PROD-${num.toString().padStart(4, '0')}`;
        // Si por casualidad ya existe, usamos push
        if (products.find(p => p.id === prodId)) {
          prodId = push(ref(rtdb, 'productos')).key;
        }
      }

      const prodRef = ref(rtdb, `productos/${prodId}`);
      await set(prodRef, {
        name: formData.name,
        price: Number(formData.price),
        cost: Number(formData.cost),
        cat: formData.cat
      });

      const invRef = ref(rtdb, `inventario/${sucursal}/${prodId}`);
      await set(invRef, {
        stock_actual: Number(formData.stock_actual),
        stock_minimo: Number(formData.stock_minimo),
        ubicacion: formData.ubicacion
      });

      toast.success(editingId ? 'Producto actualizado' : 'Producto creado');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Package className="text-blue-600" /> 
            Gestión de Inventario
          </h1>
          <p className="text-gray-500 text-sm">Administra tu catálogo de productos y existencias.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select 
            value={sucursal}
            onChange={(e) => setSucursal(e.target.value)}
            className="border-gray-200 bg-white border p-2.5 rounded-lg font-medium text-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="SUC-01">Sucursal Principal (SUC-01)</option>
            <option value="SUC-02">Sucursal Norte (SUC-02)</option>
          </select>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Plus size={20} />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Tarjeta Principal */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* Buscador */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <input 
              type="text" 
              placeholder="Buscar por código, nombre o categoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Código</th>
                <th className="p-4">Producto</th>
                <th className="p-4">Categoría</th>
                <th className="p-4 text-right">Precio Venta</th>
                <th className="p-4 text-center">Stock</th>
                <th className="p-4">Ubicación</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-400">Cargando inventario...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-400">No se encontraron productos.</td>
                </tr>
              ) : (
                filtered.map(prod => {
                  const inv = inventory[prod.id] || { stock_actual: 0 };
                  const isLowStock = inv.stock_actual <= (inv.stock_minimo || 0);
                  
                  return (
                    <tr key={prod.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-mono text-gray-500">{prod.id}</td>
                      <td className="p-4 font-bold text-gray-800">{prod.name}</td>
                      <td className="p-4 text-gray-600">
                        <span className="bg-gray-100 px-2 py-1 rounded text-xs">{prod.cat || 'N/A'}</span>
                      </td>
                      <td className="p-4 text-right font-medium text-emerald-600">C$ {prod.price}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {inv.stock_actual}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500">{inv.ubicacion || '-'}</td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handleOpenModal(prod)}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded transition-colors"
                          title="Editar Producto"
                        >
                          <Edit2 size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId ? `Editar Producto: ${editingId}` : 'Nuevo Producto'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="space-y-4">
                <h3 className="font-bold text-blue-900 border-b pb-2">Datos Generales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto *</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <Select
                      options={categorias.map(c => ({ value: c, label: c }))}
                      value={formData.cat ? { value: formData.cat, label: formData.cat } : null}
                      onChange={(selected) => setFormData({ ...formData, cat: selected ? selected.value : '' })}
                      placeholder="Buscar categoría..."
                      isClearable
                      className="react-select-container"
                      classNamePrefix="react-select"
                    />
                  </div>
                  <div className="hidden md:block"></div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Costo (Compra)</label>
                    <input type="number" step="0.01" min="0" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Precio (Venta) *</label>
                    <input required type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-blue-900 border-b pb-2">
                  Inventario para: <span className="text-blue-600 bg-blue-100 px-2 py-0.5 rounded text-sm">{sucursal}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock Actual</label>
                    <input type="number" required value={formData.stock_actual} onChange={e => setFormData({...formData, stock_actual: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500 font-bold text-center" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo (Alerta)</label>
                    <input type="number" value={formData.stock_minimo} onChange={e => setFormData({...formData, stock_minimo: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500 text-center" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación / Estante</label>
                    <Select
                      options={ubicaciones.map(u => ({ value: u, label: u }))}
                      value={formData.ubicacion ? { value: formData.ubicacion, label: formData.ubicacion } : null}
                      onChange={(selected) => setFormData({ ...formData, ubicacion: selected ? selected.value : '' })}
                      placeholder="Buscar ubicación..."
                      isClearable
                      className="react-select-container"
                      classNamePrefix="react-select"
                    />
                  </div>
                </div>
              </div>

            </form>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm transition-colors">
                Guardar Producto
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
