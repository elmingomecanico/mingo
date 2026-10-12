import React, { useState, useEffect } from 'react';
import { ref, onValue, set, update } from 'firebase/database';
import { rtdb } from '../../firebase';
import { 
  Building2, Plus, Edit2, CheckCircle2, XCircle, MapPin, 
  Phone, User, Hash, Palette, ShieldCheck, Sparkles, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export const DEFAULT_SUCURSALES = [
  {
    id: 'SUC-01',
    nombre: 'Sucursal Principal',
    short: 'Principal',
    direccion: 'Managua, Pista Central',
    telefono: '+505 8888-8888',
    encargado: 'Administración Central',
    prefijo_factura: 'FAC-',
    color: 'blue',
    estado: 'Activa'
  },
  {
    id: 'SUC-02',
    nombre: 'Sucursal Norte',
    short: 'Norte',
    direccion: 'Carretera Norte, Km 7',
    telefono: '+505 7777-7777',
    encargado: 'Gerencia Sede Norte',
    prefijo_factura: 'FN-',
    color: 'emerald',
    estado: 'Activa'
  }
];

export default function BranchManager({ user }) {
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  const [formData, setFormData] = useState({
    id: '',
    nombre: '',
    short: '',
    direccion: '',
    telefono: '',
    encargado: '',
    prefijo_factura: '',
    color: 'blue',
    estado: 'Activa'
  });

  useEffect(() => {
    const sucRef = ref(rtdb, 'configuracion/sucursales');
    const unsub = onValue(sucRef, async (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.keys(val).map(key => ({
          id: key,
          ...val[key]
        }));
        setSucursales(list);
      } else {
        // Inicializar con las sucursales por defecto para no arrancar vacíos
        const initMap = {};
        DEFAULT_SUCURSALES.forEach(s => {
          initMap[s.id] = s;
        });
        await set(sucRef, initMap);
        setSucursales(DEFAULT_SUCURSALES);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleOpenModal = (branch = null) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        id: branch.id,
        nombre: branch.nombre || branch.name || '',
        short: branch.short || '',
        direccion: branch.direccion || '',
        telefono: branch.telefono || '',
        encargado: branch.encargado || '',
        prefijo_factura: branch.prefijo_factura || '',
        color: branch.color || 'blue',
        estado: branch.estado || 'Activa'
      });
    } else {
      // Proponer siguiente ID disponible (ej: SUC-03)
      const nextNum = sucursales.length + 1;
      const suggestedId = `SUC-${nextNum.toString().padStart(2, '0')}`;

      setEditingBranch(null);
      setFormData({
        id: suggestedId,
        nombre: '',
        short: '',
        direccion: '',
        telefono: '',
        encargado: '',
        prefijo_factura: `F${nextNum}-`,
        color: 'purple',
        estado: 'Activa'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const cleanId = formData.id.trim().toUpperCase().replace(/\s+/g, '-');
    if (!cleanId) return toast.error('El código identificador de la sucursal es requerido');
    if (!formData.nombre.trim()) return toast.error('El nombre de la sucursal es requerido');

    try {
      const branchRef = ref(rtdb, `configuracion/sucursales/${cleanId}`);
      await set(branchRef, {
        id: cleanId,
        nombre: formData.nombre.trim(),
        name: formData.nombre.trim(),
        short: formData.short.trim() || formData.nombre.trim().split(' ')[0],
        direccion: formData.direccion.trim() || 'Dirección no especificada',
        telefono: formData.telefono.trim() || 'N/A',
        encargado: formData.encargado.trim() || 'Sin asignar',
        prefijo_factura: formData.prefijo_factura.trim() || 'FAC-',
        color: formData.color,
        estado: formData.estado,
        actualizado_en: new Date().toISOString(),
        actualizado_por: user?.nombre_completo || 'SuperAdmin'
      });

      toast.success(editingBranch ? 'Sucursal actualizada con éxito' : 'Nueva sucursal registrada con éxito');
      setIsModalOpen(false);
    } catch (err) {
      toast.error('Error al guardar sucursal: ' + err.message);
    }
  };

  const handleToggleEstado = async (branch) => {
    const nuevoEstado = branch.estado === 'Activa' ? 'Inactiva' : 'Activa';
    try {
      await update(ref(rtdb, `configuracion/sucursales/${branch.id}`), {
        estado: nuevoEstado
      });
      toast.success(`Sucursal ${branch.nombre} marcada como ${nuevoEstado}`);
    } catch (err) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
  };

  const COLOR_BADGES = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    rose: 'bg-rose-100 text-rose-800 border-rose-200',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200'
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Building2 className="text-blue-600" size={24} />
            Gestión de Sucursales y Sedes de la Empresa
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Crea y administra todas las sedes del negocio, sus prefijos de factura, teléfonos y responsables.
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-all active:scale-95 shrink-0"
        >
          <Plus size={18} />
          + Nueva Sucursal
        </button>
      </div>

      {/* TARJETAS DE SUCURSALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sucursales.map(s => {
          const isActiva = s.estado !== 'Inactiva';
          const colorCls = COLOR_BADGES[s.color] || COLOR_BADGES.blue;

          return (
            <div 
              key={s.id} 
              className={`bg-white rounded-2xl p-5 border shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${isActiva ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}
            >
              <div>
                {/* CABECERA DE TARJETA */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border font-mono ${colorCls}`}>
                        {s.id}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActiva ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {isActiva ? '● Activa' : '○ Inactiva'}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-gray-900 mt-1 truncate">
                      {s.nombre || s.name}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium">
                      Alias corto: <span className="text-gray-700 font-bold">{s.short || s.id}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => handleOpenModal(s)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                    title="Editar sucursal"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>

                {/* DETALLES DE SUCURSAL */}
                <div className="space-y-2 py-3 border-y border-gray-100 text-xs text-gray-600">
                  <div className="flex items-center gap-2 truncate">
                    <MapPin size={14} className="text-gray-400 shrink-0" />
                    <span className="truncate" title={s.direccion}>{s.direccion || 'Sin dirección'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-gray-400 shrink-0" />
                    <span>{s.telefono || 'Sin teléfono'}</span>
                  </div>
                  <div className="flex items-center gap-2 truncate">
                    <User size={14} className="text-gray-400 shrink-0" />
                    <span className="truncate">Encargado: <strong>{s.encargado || 'Sin asignar'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Hash size={14} className="text-gray-400 shrink-0" />
                    <span>Prefijo Facturas: <strong className="font-mono text-blue-700">{s.prefijo_factura || 'FAC-'}</strong></span>
                  </div>
                </div>
              </div>

              {/* PIE DE TARJETA: ACCIONES */}
              <div className="mt-4 pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleToggleEstado(s)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${isActiva ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}
                >
                  {isActiva ? 'Desactivar Sede' : 'Activar Sede'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenModal(s)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800"
                >
                  Configurar →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= MODAL CREAR / EDITAR SUCURSAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-gray-100 bg-blue-50/50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <Building2 className="text-blue-600" size={18} />
                  {editingBranch ? 'Modificar Sucursal' : 'Registrar Nueva Sucursal'}
                </h3>
                <p className="text-xs text-gray-500">
                  Establece los datos operativos, prefijo de facturación y responsable.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors font-bold text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      Código Identificador *
                    </label>
                    <input
                      required
                      type="text"
                      disabled={!!editingBranch}
                      placeholder="Ej: SUC-03"
                      value={formData.id}
                      onChange={e => setFormData({ ...formData, id: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm font-bold font-mono uppercase outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Clave única de la sucursal (ej: SUC-01, SUC-02, SUC-03)</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      Alias Corto *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Ej: Linda Vista, Central..."
                      value={formData.short}
                      onChange={e => setFormData({ ...formData, short: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Para botones y selectores compactos en POS</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Nombre Oficial de la Sucursal *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Ej: Sucursal Linda Vista - Taller El Mingo"
                    value={formData.nombre}
                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full border p-2.5 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                    Dirección Física Completa
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Semáforos de Linda Vista 2c al lago, Managua"
                    value={formData.direccion}
                    onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                    className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      Teléfono / Celular
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: +505 8888-9999"
                      value={formData.telefono}
                      onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      Responsable / Encargado
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Ing. Carlos Pérez"
                      value={formData.encargado}
                      onChange={e => setFormData({ ...formData, encargado: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      Prefijo Factura
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: LV-, FAC-"
                      value={formData.prefijo_factura}
                      onChange={e => setFormData({ ...formData, prefijo_factura: e.target.value })}
                      className="w-full border p-2.5 rounded-xl text-sm font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      Color Distintivo
                    </label>
                    <select
                      value={formData.color}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                      className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-bold outline-none"
                    >
                      <option value="blue">Azul (Principal)</option>
                      <option value="emerald">Esmeralda</option>
                      <option value="purple">Púrpura</option>
                      <option value="amber">Ámbar</option>
                      <option value="rose">Rosa</option>
                      <option value="indigo">Índigo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                      Estado
                    </label>
                    <select
                      value={formData.estado}
                      onChange={e => setFormData({ ...formData, estado: e.target.value })}
                      className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs font-bold outline-none"
                    >
                      <option value="Activa">Activa</option>
                      <option value="Inactiva">Inactiva</option>
                    </select>
                  </div>
                </div>

              </div>

              <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-gray-600 font-bold hover:bg-gray-100 text-xs sm:text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
                >
                  {editingBranch ? 'Guardar Cambios' : 'Registrar Sucursal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
