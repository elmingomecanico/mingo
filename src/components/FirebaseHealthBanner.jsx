import React, { useState, useEffect } from 'react';
import { ref, onValue, get } from 'firebase/database';
import { rtdb } from '../firebase';
import { AlertTriangle, ExternalLink, RefreshCw, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FirebaseHealthBanner() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'healthy' | 'permission_denied' | 'offline'
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkConnection = async () => {
    setChecking(true);
    try {
      // Intentamos leer una referencia básica para diagnosticar permisos
      const testRef = ref(rtdb, 'configuracion');
      await get(testRef);
      setStatus('healthy');
      if (status !== 'healthy' && status !== 'checking') {
        toast.success('Conexión con Firebase restablecida con éxito');
      }
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('permission_denied') || msg.includes('Permission denied') || err.code === 'PERMISSION_DENIED') {
        setStatus('permission_denied');
      } else {
        setStatus('offline');
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Escucha pasiva para detectar errores de permisos de inmediato
    const testRef = ref(rtdb, 'configuracion');
    const unsub = onValue(testRef, 
      () => {
        setStatus('healthy');
      },
      (err) => {
        const msg = err?.message || '';
        if (msg.includes('permission_denied') || msg.includes('Permission denied') || err.code === 'PERMISSION_DENIED') {
          setStatus('permission_denied');
        } else {
          setStatus('offline');
        }
      }
    );

    return () => unsub();
  }, []);

  if (status === 'healthy' || status === 'checking' || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-red-700 text-white p-3 sm:p-4 rounded-2xl shadow-lg mb-6 border-2 border-white/20 animate-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldAlert size={22} className="text-white drop-shadow" />
          </div>
          <div>
            <h3 className="font-black text-sm sm:text-base tracking-tight flex items-center gap-2">
              <span>Alerta de Base de Datos: Reglas de Firebase Expiradas</span>
              <span className="text-[10px] bg-white/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                Permission Denied
              </span>
            </h3>
            <p className="text-xs text-white/90 mt-0.5 max-w-2xl leading-relaxed">
              El período de prueba inicial de 30 días en Firebase Realtime Database ha finalizado. 
              Por esta razón, la base de datos no permite leer ni mostrar información hasta que se actualicen las reglas de seguridad.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end pt-2 sm:pt-0 border-t border-white/20 sm:border-0">
          <button
            type="button"
            onClick={checkConnection}
            disabled={checking}
            className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Reintentar verificación de conexión"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Verificando...' : 'Reintentar'}
          </button>

          <a
            href="https://console.firebase.google.com/project/mingo-2b220/database/mingo-2b220-default-rtdb/rules"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white text-rose-800 hover:bg-rose-50 rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <span>Actualizar en Firebase</span>
            <ExternalLink size={13} />
          </a>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Cerrar aviso temporalmente"
          >
            <X size={16} />
          </button>
        </div>

      </div>

      {/* Instrucción directa de 1 clic */}
      <div className="mt-3 pt-2.5 border-t border-white/20 text-xs bg-black/20 p-2.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-mono">
        <span className="text-white/90 text-[11px]">
          Regla requerida: <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-200">{"{ \".read\": true, \".write\": true }"}</code>
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText('{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}');
            toast.success('Reglas copiadas al portapapeles');
          }}
          className="text-[11px] underline text-amber-200 hover:text-white cursor-pointer"
        >
          Copiar regla al portapapeles
        </button>
      </div>
    </div>
  );
}
