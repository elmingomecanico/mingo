import React, { useState, useEffect } from 'react';
import { ref, onValue, set, push, remove, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import { Wrench, Plus, Edit2, Trash2, Search, DollarSign, Hash, Lock, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { DEFAULT_CONSECUTIVOS, formatConsecutive } from '../components/catalogos/ConsecutivosManager';

export default function Servicios() {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [consecutivosConfig, setConsecutivosConfig] = useState(DEFAULT_CONSECUTIVOS);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    codigo_visible: '', nombre: '', descripcion: '', precio: ''
  });

  useEffect(() => {
    const servRef = ref(rtdb, 'servicios');
    const unsubServ = onValue(servRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        const parsed = Object.keys(val).map(key => ({ id: key, ...val[key] }));
        setServicios(parsed);
      } else {
        setServicios([]);
      }
      setLoading(false);
    });

    const consRef = ref(rtdb, 'configuracion/consecutivos');
    const unsubCons = onValue(consRef, (snapshot) => {
      if (snapshot.exists()) {
        setConsecutivosConfig({ ...DEFAULT_CONSECUTIVOS, ...snapshot.val() });
      }
    });

    return () => {
      unsubServ();
      unsubCons();
    };
  }, []);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({ 
        codigo_visible: item.codigo_visible || item.id,
        nombre: item.nombre || '', 
        descripcion: item.descripcion || '', 
        precio: item.precio || ''
      });
    } else {
      setEditingId(null);
      const srvCfg = consecutivosConfig?.servicios || DEFAULT_CONSECUTIVOS.servicios;
      const nextNum = srvCfg.siguiente_numero || (servicios.length + 1);
      const suggestedCode = formatConsecutive(srvCfg, nextNum);
      setFormData({ 
        codigo_visible: suggestedCode,
        nombre: '', 
        descripcion: '', 
        precio: '' 
      });
    }
    setIsModalOpen(true);
  };

  const handleRegenerateServiceCode = () => {
    const srvCfg = consecutivosConfig?.servicios || DEFAULT_CONSECUTIVOS.servicios;
    const nextNum = srvCfg.siguiente_numero || (servicios.length + 1);
    const suggestedCode = formatConsecutive(srvCfg, nextNum);
    setFormData(prev => ({ ...prev, codigo_visible: suggestedCode }));
    toast.success(`Código sugerido: ${suggestedCode}`, { icon: '✨' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return toast.error("El nombre del servicio es requerido");

    try {
      const itemRef = editingId ? ref(rtdb, `servicios/${editingId}`) : push(ref(rtdb, 'servicios'));
      const codigoFinal = formData.codigo_visible?.trim() || (editingId || itemRef.key);
      
      const payload = {
        id: editingId || itemRef.key,
        codigo_visible: codigoFinal,
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        precio: Number(formData.precio) || 0
      };

      await set(itemRef, payload);

      if (!editingId) {
        await runTransaction(ref(rtdb, 'configuracion/consecutivos/servicios/siguiente_numero'), (cur) => {
          return (Number(cur) || 1) + 1;
        });
      }

      toast.success(editingId ? 'Servicio actualizado' : 'Servicio registrado');
      setIsModalOpen(false);
    } catch (error) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar el servicio "${nombre}"?`)) return;
    try {
      await remove(ref(rtdb, `servicios/${id}`));
      toast.success("Servicio eliminado");
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    }
  };

  const filtered = servicios.filter(s => {
    const term = search.toLowerCase();
    return (
      s.nombre.toLowerCase().includes(term) ||
      (s.codigo_visible && s.codigo_visible.toLowerCase().includes(term)) ||
      s.id.toLowerCase().includes(term) ||
      (s.descripcion && s.descripcion.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Wrench className="text-purple-600" /> 
            Catálogo de Servicios
          </h1>
          <p className="text-gray-500 text-sm">Gestiona la mano de obra, reparaciones y mantenimiento.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-purple-200 transition-all active:scale-95"
        >
          <Plus size={20} />
          Nuevo Servicio
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="relative max-w-md">
            <input 
              type="text" 
              placeholder="Buscar servicio..."
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
                <th className="p-4">Código</th>
                <th className="p-4">Servicio</th>
                <th className="p-4">Descripción</th>
                <th className="p-4 text-right">Precio Sugerido</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-400">Cargando servicios...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-400">No se encontraron servicios.</td></tr>
              ) : (
                filtered.map(serv => (
                  <tr key={serv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          {serv.codigo_visible || serv.id}
                        </span>
                        {serv.codigo_visible && serv.codigo_visible !== serv.id && (
                          <span className="font-mono text-[9px] text-gray-400 truncate max-w-[100px]" title={`UUID interno en Firebase: ${serv.id}`}>
                            UUID: {serv.id.substring(0, 8)}...
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-bold text-gray-800">{serv.nombre}</td>
                    <td className="p-4 text-gray-500 truncate max-w-[300px]">
                      {serv.descripcion || 'Sin descripción'}
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-600">
                      C$ {serv.precio.toFixed(2)}
                    </td>
                    <td className="p-4 text-center flex justify-center gap-2">
                      <button onClick={() => handleOpenModal(serv)} className="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(serv.id, serv.nombre)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80 shrink-0">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-800">
                  {editingId ? 'Editar Servicio' : 'Nuevo Servicio'}
                </h2>
                {editingId && (
                  <span className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
                    <Lock size={10} /> UUID: {editingId}
                  </span>
                )}
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* Código Visible / Referencia */}
                <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-purple-950 uppercase flex items-center gap-1.5">
                      <Hash size={14} className="text-purple-700" />
                      Código Visible Comercial *
                    </label>
                    <button
                      type="button"
                      onClick={handleRegenerateServiceCode}
                      className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-purple-200 shadow-2xs hover:bg-purple-50 transition-colors"
                      title="Regenerar sugerencia según regla de correlativos"
                    >
                      <Sparkles size={12} /> Sugerir
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.codigo_visible}
                    onChange={e => setFormData({ ...formData, codigo_visible: e.target.value })}
                    placeholder="Ej: SRV-001, MAN-OBRA#, #TALLER-01"
                    className="w-full border-2 border-purple-300 p-2.5 rounded-xl outline-none focus:border-purple-600 font-mono font-bold text-sm text-purple-900 bg-white"
                  />
                  <p className="text-[11px] text-purple-800 leading-tight">
                    ✨ <strong>Personalizable:</strong> Letras, números y símbolos permitidos con UUID único interno.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre del Servicio *</label>
                  <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm" placeholder="Ej: Cambio de Aceite" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Precio Sugerido (C$) *</label>
                  <input required type="number" step="0.01" min="0" value={formData.precio} onChange={e => setFormData({...formData, precio: e.target.value})} className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold" placeholder="0.00" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Descripción</label>
                  <textarea value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} rows="3" className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none" placeholder="Opcional..."></textarea>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors text-sm">Cancelar</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md shadow-purple-200 transition-all active:scale-95 text-sm">Guardar Servicio</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
