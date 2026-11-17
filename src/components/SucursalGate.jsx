import React, { useEffect, useState } from 'react';
import { ref, get } from 'firebase/database';
import { Store, MapPin, Building2 } from 'lucide-react';
import { rtdb } from '../firebase';
import { useAuth } from '../context/AuthContext';

/**
 * Obliga a los usuarios con acceso a más de una sucursal (SuperAdmin, multisucursal
 * o con caja asignada) a elegir la sede donde trabajarán, y registra el acceso en
 * la bitácora `bitacora_accesos_sucursal`. Los usuarios de una sola sede entran directo.
 *
 * Props:
 *  - forceOpen: abre el selector aunque ya exista sucursal activa (cambio de sede).
 *  - onClose: se invoca al terminar un cambio de sede o al cancelarlo.
 */
export default function SucursalGate({ forceOpen = false, onClose }) {
  const { user, sucursalActiva, seleccionarSucursal } = useAuth();
  const [sucursales, setSucursales] = useState([]);
  const [esMulti, setEsMulti] = useState(null);
  const [saving, setSaving] = useState(false);

  const necesitaSeleccion = Boolean(user) && (forceOpen || !sucursalActiva);

  useEffect(() => {
    if (!necesitaSeleccion || !user) return;
    let cancelled = false;

    (async () => {
      let fresh = user;
      let lista = [];
      let tieneCaja = false;
      try {
        const [uSnap, sSnap, cSnap] = await Promise.all([
          get(ref(rtdb, `usuarios/${user.id}`)),
          get(ref(rtdb, 'configuracion/sucursales')),
          get(ref(rtdb, 'configuracion/cajas'))
        ]);
        if (uSnap.exists()) fresh = { id: user.id, ...uSnap.val() };
        if (sSnap.exists()) {
          const val = sSnap.val();
          lista = Object.keys(val)
            .map(k => ({ id: k, ...val[k] }))
            .filter(s => s.estado !== 'Inactiva');
        }
        if (fresh.id_caja_asignada) tieneCaja = true;
        if (cSnap.exists()) {
          tieneCaja = tieneCaja || Object.values(cSnap.val()).some(
            c => c && c.usuario_asignado_id === user.id && c.estado !== 'Inactiva'
          );
        }
      } catch (err) {
        console.warn('SucursalGate: no se pudo leer la configuración', err);
      }
      if (cancelled) return;

      if (lista.length === 0) lista = [{ id: fresh.id_sucursal || 'SUC-01', nombre: fresh.id_sucursal || 'SUC-01' }];

      const multi = Boolean(
        fresh.rol === 'SuperAdmin' ||
        fresh.permite_multisucursal ||
        fresh.permisos?.includes('FACTURAR_MULTISUCURSAL') ||
        tieneCaja
      ) && lista.length > 1;

      setSucursales(lista);
      setEsMulti(multi);

      // Usuario de una sola sede: entra directo y queda registrado
      if (!multi && !forceOpen) {
        const sedeId = fresh.id_sucursal || lista[0].id;
        const sede = lista.find(s => s.id === sedeId);
        seleccionarSucursal(sedeId, sede?.nombre || sede?.name || sedeId, 'inicio_sesion');
      } else if (!multi && forceOpen) {
        onClose?.();
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [necesitaSeleccion, user?.id, forceOpen]);

  if (!necesitaSeleccion || !esMulti) return null;

  const elegir = async (s) => {
    setSaving(true);
    await seleccionarSucursal(
      s.id,
      s.nombre || s.name || s.id,
      forceOpen ? 'cambio_sucursal' : 'inicio_sesion'
    );
    setSaving(false);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-blue-900 text-white p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
            <Store size={28} />
          </div>
          <h2 className="text-xl font-black">¿En qué sucursal trabajarás hoy?</h2>
          <p className="text-blue-200 text-xs mt-1">
            {user?.nombre_completo} · Se registrará tu acceso a la sede que elijas.
          </p>
        </div>
        <div className="p-5 space-y-2.5 max-h-[55vh] overflow-y-auto">
          {sucursales.map(s => (
            <button
              key={s.id}
              type="button"
              disabled={saving}
              onClick={() => elegir(s)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer hover:border-blue-500 hover:bg-blue-50 disabled:opacity-60 ${
                s.id === sucursalActiva ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Building2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">{s.nombre || s.name || s.id}</p>
                <p className="text-[11px] text-gray-500 flex items-center gap-1">
                  <MapPin size={11} /> {s.direccion || 'Sin dirección registrada'}
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                {s.codigo_visible || s.id}
              </span>
            </button>
          ))}
        </div>
        {forceOpen && (
          <div className="p-4 border-t border-gray-100 text-right">
            <button
              type="button"
              onClick={() => onClose?.()}
              className="text-sm font-bold text-gray-500 hover:text-gray-800 px-4 py-2 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
