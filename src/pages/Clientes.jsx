import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { Users, Plus, Edit2, Trash2, Search, Phone, FileText, CreditCard, Percent, ShieldCheck, Gift, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const defaultMetodosDescuento = {
  Efectivo: true,
  Transferencia: true,
  Tarjeta: false,
  'Crédito': false
};

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '', 
    cedula: '', 
    telefono1: '', 
    telefono2: '', 
    direccion: '', 
    limite_credito: 0,
    credito_habilitado: false,
    descuento_fijo: 0,
    descuento_metodos: { ...defaultMetodosDescuento },
    regalia_observacion: '',
    tipo_cliente: 'Regular'
  });

  useEffect(() => {
    const listRef = ref(rtdb, 'clientes');
    const unsub = onValue(listRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        setClientes(parsed);
      } else {
        setClientes([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({ 
        nombre: item.nombre || '', 
        cedula: item.cedula || '', 
        telefono1: item.telefono1 || '',
        telefono2: item.telefono2 || '',
        direccion: item.direccion || '',
        limite_credito: item.limite_credito || 0,
        credito_habilitado: !!item.credito_habilitado,
        descuento_fijo: item.descuento_fijo || 0,
        descuento_metodos: item.descuento_metodos || { ...defaultMetodosDescuento },
        regalia_observacion: item.regalia_observacion || '',
        tipo_cliente: item.tipo_cliente || 'Regular'
      });
    } else {
      setEditingId(null);
      setFormData({ 
        nombre: '', 
        cedula: '', 
        telefono1: '', 
        telefono2: '', 
        direccion: '', 
        limite_credito: 0,
        credito_habilitado: false,
        descuento_fijo: 0,
        descuento_metodos: { ...defaultMetodosDescuento },
        regalia_observacion: '',
        tipo_cliente: 'Regular'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return toast.error("El nombre es requerido");

    try {
      const itemRef = editingId ? ref(rtdb, `clientes/${editingId}`) : push(ref(rtdb, 'clientes'));
      
      const payload = {
        nombre: formData.nombre.trim(),
        cedula: formData.cedula.trim(),
        telefono1: formData.telefono1.trim(),
        telefono2: formData.telefono2.trim(),
        direccion: formData.direccion.trim(),
        limite_credito: Number(formData.limite_credito) || 0,
        credito_habilitado: Boolean(formData.credito_habilitado),
        descuento_fijo: Number(formData.descuento_fijo) || 0,
        descuento_metodos: formData.descuento_metodos || { ...defaultMetodosDescuento },
        regalia_observacion: formData.regalia_observacion.trim(),
        tipo_cliente: formData.tipo_cliente,
        fecha_registro: editingId ? undefined : new Date().toISOString()
      };

      if (editingId) delete payload.fecha_registro;

      if (!editingId) {
        await set(itemRef, payload);
      } else {
        const clientObj = clientes.find(c => c.id === editingId);
        await set(itemRef, { ...clientObj, ...payload });
      }

      toast.success(editingId ? 'Privilegios y condiciones actualizados' : 'Cliente registrado exitosamente');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar a "${nombre}"?`)) return;
    try {
      await remove(ref(rtdb, `clientes/${id}`));
      toast.success("Cliente eliminado");
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    }
  };

  const filtered = clientes.filter(c => 
    c.nombre.toLowerCase().includes(search.toLowerCase()) || 
    (c.cedula && c.cedula.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600" /> 
            Cartera de Clientes y Condiciones Comerciales (Gerencia)
          </h1>
          <p className="text-gray-500 text-sm">Gestiona líneas de crédito, condiciones de pago para descuentos y regalías.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
        >
          <Plus size={20} />
          Nuevo Cliente
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <input 
              type="text" 
              placeholder="Buscar por nombre o cédula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
            />
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-100">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Contacto</th>
                <th className="p-4">Condición Descuento</th>
                <th className="p-4 text-right">Línea de Crédito</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400">Cargando clientes...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400">No se encontraron clientes.</td></tr>
              ) : (
                filtered.map(cliente => {
                  const metodosActivos = Object.keys(cliente.descuento_metodos || defaultMetodosDescuento)
                    .filter(k => (cliente.descuento_metodos || defaultMetodosDescuento)[k]);

                  return (
                    <tr key={cliente.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-800">{cliente.nombre}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <FileText size={12} /> {cliente.cedula || 'Sin cédula'}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${cliente.tipo_cliente === 'VIP' ? 'bg-purple-100 text-purple-700' : cliente.tipo_cliente === 'Mayorista' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {cliente.tipo_cliente || 'Regular'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-gray-700 text-xs">
                          <Phone size={13} className="text-gray-400" /> 
                          {cliente.telefono1 || 'Sin teléfono'}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">
                          {cliente.direccion || 'Sin dirección'}
                        </div>
                      </td>
                      <td className="p-4">
                        {(cliente.descuento_fijo || 0) > 0 ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-black text-xs">
                              <Percent size={11} /> {cliente.descuento_fijo}% VIP
                            </span>
                            <div className="text-[10px] text-gray-500 flex items-center gap-1">
                              <span>En: {metodosActivos.join(', ')}</span>
                            </div>
                            {cliente.regalia_observacion && (
                              <div className="text-[10px] text-purple-600 font-bold flex items-center gap-1">
                                <Gift size={11} /> Regalía: {cliente.regalia_observacion}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Sin descuento</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {cliente.credito_habilitado && (cliente.limite_credito || 0) > 0 ? (
                          <div>
                            <div className="font-black text-emerald-600 flex items-center justify-end gap-1">
                              <ShieldCheck size={14} className="text-emerald-500" />
                              C$ {Number(cliente.limite_credito).toFixed(2)}
                            </div>
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Autorizado</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Sin Crédito</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-1">
                          <button 
                            onClick={() => handleOpenModal(cliente)} 
                            className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                            title="Editar privilegios y condiciones"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(cliente.id, cliente.nombre)} 
                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            title="Eliminar cliente"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CONFIGURACIÓN GERENCIA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">
                {editingId ? 'Editar Cliente y Privilegios' : 'Nuevo Cliente (Gerencia)'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Nombre Completo *</label>
                  <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm" placeholder="Ej: Santos Rayo" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Cédula / RUC</label>
                    <input type="text" value={formData.cedula} onChange={e => setFormData({...formData, cedula: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm" placeholder="Ej: 001-000000-0000A" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Tipo de Cliente</label>
                    <select value={formData.tipo_cliente} onChange={e => setFormData({...formData, tipo_cliente: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm">
                      <option value="Regular">Regular</option>
                      <option value="Taller Aliado">Taller / Mecánico Aliado</option>
                      <option value="Mayorista">Mayorista</option>
                      <option value="VIP">VIP</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Teléfono Principal</label>
                    <input type="tel" value={formData.telefono1} onChange={e => setFormData({...formData, telefono1: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm" placeholder="Ej: 8888-8888" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Teléfono Secundario</label>
                    <input type="tel" value={formData.telefono2} onChange={e => setFormData({...formData, telefono2: e.target.value})} className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500 text-sm" placeholder="Opcional" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase">Dirección</label>
                  <textarea value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} rows="2" className="w-full border p-2.5 rounded-lg outline-none focus:border-blue-500 resize-none text-sm" placeholder="Dirección completa..."></textarea>
                </div>

                {/* SECCIÓN PRIVILEGIOS Y CRÉDITO (GERENCIA) */}
                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-3">
                  <h3 className="text-xs font-black text-blue-900 uppercase flex items-center gap-1.5">
                    <ShieldCheck size={16} className="text-blue-600" /> Privilegios y Crédito (Exclusivo Gerencia)
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Descuento Preferencial (%)</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="100" 
                        value={formData.descuento_fijo} 
                        onChange={e => setFormData({...formData, descuento_fijo: e.target.value})} 
                        className="w-full border p-2 rounded-lg outline-none focus:border-blue-500 text-sm font-bold bg-white" 
                        placeholder="Ej: 5 para 5%" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Límite de Crédito (C$)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        value={formData.limite_credito} 
                        onChange={e => setFormData({...formData, limite_credito: e.target.value})} 
                        className="w-full border p-2 rounded-lg outline-none focus:border-blue-500 text-sm font-bold bg-white" 
                        placeholder="0.00" 
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input 
                      type="checkbox" 
                      id="credito_habilitado" 
                      checked={formData.credito_habilitado} 
                      onChange={e => setFormData({...formData, credito_habilitado: e.target.checked})} 
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                    />
                    <label htmlFor="credito_habilitado" className="text-xs font-bold text-gray-700 cursor-pointer">
                      Habilitar compras a crédito en Caja POS para este cliente
                    </label>
                  </div>

                  {/* CONDICIONES DE PAGO PARA EL DESCUENTO */}
                  <div className="pt-3 border-t border-blue-200/60 space-y-2">
                    <label className="block text-xs font-bold text-gray-700">
                      ¿En qué métodos de pago aplica el descuento del {formData.descuento_fijo || 0}%?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Efectivo', 'Transferencia', 'Tarjeta', 'Crédito'].map((metodo) => (
                        <label key={metodo} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 cursor-pointer text-xs font-medium hover:border-blue-300 transition-colors">
                          <input
                            type="checkbox"
                            checked={!!formData.descuento_metodos?.[metodo]}
                            onChange={(e) => setFormData({
                              ...formData,
                              descuento_metodos: {
                                ...formData.descuento_metodos,
                                [metodo]: e.target.checked
                              }
                            })}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span>{metodo}</span>
                        </label>
                      ))}
                    </div>

                    <div className="pt-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                        <Gift size={13} className="text-purple-600" /> Regalía o Beneficio Alternativo (Opcional):
                      </label>
                      <input
                        type="text"
                        value={formData.regalia_observacion}
                        onChange={(e) => setFormData({ ...formData, regalia_observacion: e.target.value })}
                        placeholder="Ej: Revisión preventiva gratis con tarjeta, 1/4 aceite de cortesía..."
                        className="w-full border p-2 rounded-lg text-xs outline-none bg-white focus:border-blue-500"
                      />
                      <span className="text-[10px] text-gray-500 mt-0.5 block">
                        Se mostrará al cajero cuando el cliente pague con métodos sin descuento.
                      </span>
                    </div>
                  </div>

                </div>

              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-lg text-gray-600 font-medium hover:bg-gray-100 text-sm transition-colors">Cancelar</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md shadow-blue-200 transition-all active:scale-95 text-sm">Guardar Privilegios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
