import React, { useState, useEffect } from 'react';
import { 
  Wrench, AlertTriangle, CheckCircle2, ShieldCheck, RefreshCw, 
  Trash2, Package, Sparkles, Layers, Users, Building2, Store, 
  ArrowRight, Lock, AlertCircle, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useConfirm } from '../../context/ConfirmContext';
import { auditDatabaseStatus, fixDuplicateAndMissingCodes, executePurgeAndResetToZero } from '../../utils/maintenanceService';

export default function MaintenanceManager({ user }) {
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmKeyword, setConfirmKeyword] = useState('');

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await auditDatabaseStatus();
      setAuditData(res);
    } catch (e) {
      toast.error('Error al auditar base de datos: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  const handleFixCodes = async () => {
    const ok = await confirm({
      title: '¿Corregir y Estandarizar Códigos?',
      message: 'Se asignarán códigos visibles únicos y correlativos a todos los servicios y productos que actualmente no tengan código o estén duplicados.',
      confirmText: 'Sí, Corregir Códigos',
      cancelText: 'Cancelar',
      isDanger: false,
      type: 'info'
    });
    if (!ok) return;

    setIsProcessing(true);
    const toastId = toast.loading('Estandarizando códigos...');
    try {
      const res = await fixDuplicateAndMissingCodes();
      toast.success(res.message, { id: toastId });
      await runAudit();
    } catch (err) {
      toast.error('Error al corregir códigos: ' + err.message, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecutePurge = async () => {
    if (confirmKeyword.trim().toUpperCase() !== 'LIMPIAR') {
      return toast.error('Debe escribir exactamente la palabra LIMPIAR para autorizar la operación');
    }

    const ok = await confirm({
      title: '⚠️ ¿Confirmar Puesta a Cero de Transacciones de Prueba?',
      message: `Esta acción ejecutará una limpieza definitiva de prueba:\n\n` +
               `• Se eliminarán todas las ventas, turnos de caja, compras, kardex, traspasos y órdenes de trabajo de prueba.\n` +
               `• El stock actual de TODOS los productos (${auditData?.masterData?.productos || 0}) pasará a CERO (0) en todas las sucursales para iniciar el conteo físico.\n` +
               `• Los productos, servicios, usuarios, sucursales y fotos de Cloudflare R2 permanecerán 100% INTACTOS.\n` +
               `• Los correlativos de facturas, compras y traspasos volverán a iniciar desde 1.\n\n` +
               `¿Desea proceder con la puesta a cero?`,
      confirmText: 'Sí, Ejecutar Puesta a Cero',
      cancelText: 'Cancelar',
      isDanger: true
    });
    if (!ok) return;

    setIsProcessing(true);
    const toastId = toast.loading('Purgando transacciones y poniendo inventario a cero...');
    try {
      const res = await executePurgeAndResetToZero();
      toast.success(`¡Base de datos lista! ${res.totalProds} productos puestos en 0 existencias y transacciones depuradas`, { id: toastId, duration: 6000 });
      setConfirmKeyword('');
      await runAudit();
    } catch (err) {
      toast.error('Error al ejecutar puesta a cero: ' + err.message, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading && !auditData) {
    return (
      <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
        <RefreshCw size={28} className="animate-spin text-blue-600" />
        <p className="font-bold text-sm">Auditando estado de la base de datos y duplicidad de códigos...</p>
      </div>
    );
  }

  const hasIssues = auditData?.duplicateIssues && auditData.duplicateIssues.length > 0;
  const isUnlocked = confirmKeyword.trim().toUpperCase() === 'LIMPIAR';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Encabezado */}
      <div className="bg-gradient-to-r from-amber-900 to-amber-700 text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-500/30 text-amber-200 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Uso Exclusivo SuperAdmin
            </span>
          </div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Wrench size={22} className="text-amber-300" />
            Herramienta de Puesta a Cero & Mantenimiento
          </h2>
          <p className="text-xs text-amber-100/90 mt-1 max-w-2xl">
            Permite limpiar todas las transacciones de prueba previas a la inauguración. Los productos quedan con stock en <strong>cero (0)</strong> para realizar el conteo físico real, conservando intactos usuarios, sucursales, precios y fotos en Cloudflare R2.
          </p>
        </div>

        <button
          onClick={runAudit}
          disabled={loading || isProcessing}
          className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all self-end sm:self-auto shrink-0 border border-white/20 active:scale-95"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Re-escanear Base de Datos
        </button>
      </div>

      {/* SECCIÓN 1: AUDITORÍA DE CÓDIGOS Y DUPLICIDAD */}
      <div className={`p-5 rounded-2xl border transition-all ${
        hasIssues 
          ? 'bg-amber-50/70 border-amber-200 shadow-sm' 
          : 'bg-emerald-50/60 border-emerald-200'
      }`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              hasIssues ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {hasIssues ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900">
                Auditoría de Duplicidad y Consistencia de Códigos
              </h3>
              <p className="text-xs text-gray-600">
                {hasIssues 
                  ? `Se detectaron ${auditData.duplicateIssues.length} inconsistencias o códigos no asignados en los catálogos.`
                  : 'Todos los códigos de productos, servicios y sucursales son 100% únicos y consistentes.'
                }
              </p>
            </div>
          </div>

          {hasIssues && (
            <button
              onClick={handleFixCodes}
              disabled={isProcessing}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
            >
              <Sparkles size={14} />
              Corregir Códigos y Eliminar Duplicidad
            </button>
          )}
        </div>

        {hasIssues && (
          <div className="mt-3 overflow-hidden border border-amber-200 rounded-xl bg-white shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-100/60 text-amber-950 font-bold border-b border-amber-200">
                <tr>
                  <th className="p-2.5">Tipo</th>
                  <th className="p-2.5">Nombre</th>
                  <th className="p-2.5">Problema Detectado</th>
                  <th className="p-2.5">Código Actual</th>
                  <th className="p-2.5 text-emerald-700">Corrección Sugerida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {auditData.duplicateIssues.map((issue, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/50">
                    <td className="p-2.5 font-bold uppercase text-[10px] text-gray-500">{issue.type}</td>
                    <td className="p-2.5 font-semibold text-gray-800">{issue.name}</td>
                    <td className="p-2.5 text-amber-800 font-medium">{issue.issue}</td>
                    <td className="p-2.5 font-mono text-gray-500">{issue.currentCode}</td>
                    <td className="p-2.5 font-mono font-bold text-emerald-700">{issue.suggestedCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECCIÓN 2: DIAGNÓSTICO DE TRANSACCIONES VS DATOS MAESTROS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Columna Izquierda: Lo que se va a ELIMINAR / RESETEAR */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-rose-100 text-rose-700 font-bold text-sm">
            <Trash2 size={18} />
            <span>Transacciones de Prueba que se Eliminarán</span>
          </div>
          <p className="text-xs text-gray-500">
            Los siguientes registros operativos de prueba serán borrados permanentemente:
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 flex justify-between items-center">
              <span className="text-gray-700">Facturas de Venta:</span>
              <span className="font-bold text-rose-700 font-mono text-sm">{auditData?.transactions?.ventas || 0}</span>
            </div>
            <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 flex justify-between items-center">
              <span className="text-gray-700">Turnos de Caja:</span>
              <span className="font-bold text-rose-700 font-mono text-sm">{auditData?.transactions?.turnos_caja || 0}</span>
            </div>
            <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 flex justify-between items-center">
              <span className="text-gray-700">Facturas de Compras:</span>
              <span className="font-bold text-rose-700 font-mono text-sm">{auditData?.transactions?.compras || 0}</span>
            </div>
            <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 flex justify-between items-center">
              <span className="text-gray-700">Líneas en Kardex:</span>
              <span className="font-bold text-rose-700 font-mono text-sm">{auditData?.transactions?.kardex || 0}</span>
            </div>
            <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 flex justify-between items-center">
              <span className="text-gray-700">Traspasos de Bodega:</span>
              <span className="font-bold text-rose-700 font-mono text-sm">{auditData?.transactions?.traspasos || 0}</span>
            </div>
            <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 flex justify-between items-center">
              <span className="text-gray-700">Órdenes de Trabajo (Taller):</span>
              <span className="font-bold text-rose-700 font-mono text-sm">{auditData?.transactions?.ordenes_trabajo || 0}</span>
            </div>
            <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 flex justify-between items-center">
              <span className="text-gray-700">Créditos en CxC:</span>
              <span className="font-bold text-rose-700 font-mono text-sm">{auditData?.transactions?.cxc || 0}</span>
            </div>
            <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100 flex justify-between items-center">
              <span className="text-gray-700">Asientos Contables:</span>
              <span className="font-bold text-rose-700 font-mono text-sm">{auditData?.transactions?.movimientos_contables || 0}</span>
            </div>
          </div>

          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
            <RefreshCw size={14} className="text-amber-700 shrink-0" />
            <span>Los folios correlativos de <strong>Ventas, Compras y Traspasos</strong> se reiniciarán en <strong>1</strong>.</span>
          </div>
        </div>

        {/* Columna Derecha: Lo que se CONSERVA 100% INTACTO */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-emerald-100 text-emerald-800 font-bold text-sm">
            <ShieldCheck size={18} className="text-emerald-600" />
            <span>Datos Maestros que se Conservan 100% Intactos</span>
          </div>
          <p className="text-xs text-gray-500">
            Las entidades de negocio maestras permanecerán guardadas y configuradas:
          </p>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-emerald-700" />
                <span className="font-bold text-gray-800">Catálogo de Productos:</span>
              </div>
              <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                {auditData?.masterData?.productos || 0} productos (Stock pasa a 0)
              </span>
            </div>

            <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-emerald-700" />
                <span className="font-bold text-gray-800">Servicios de Mano de Obra:</span>
              </div>
              <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                {auditData?.masterData?.servicios || 0} servicios intactos
              </span>
            </div>

            <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-emerald-700" />
                <span className="font-bold text-gray-800">Usuarios, Mecánicos y Cajeros:</span>
              </div>
              <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                {auditData?.masterData?.usuarios || 0} usuarios intactos
              </span>
            </div>

            <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-emerald-700" />
                <span className="font-bold text-gray-800">Sucursales y Cajas Registradoras:</span>
              </div>
              <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                {auditData?.masterData?.sucursales || 2} sucursales | {auditData?.masterData?.cajas || 2} cajas
              </span>
            </div>

            <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-emerald-700" />
                <span className="font-bold text-gray-800">Fotos en Cloudflare R2:</span>
              </div>
              <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                {auditData?.masterData?.imagenes_r2 || 0} fotos preservadas
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: CANDADO DE SEGURIDAD Y EJECUCIÓN */}
      <div className="bg-rose-50 border-2 border-rose-300 p-5 rounded-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Lock size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-rose-950">
              Candado de Seguridad para Puesta a Cero
            </h3>
            <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
              Para evitar ejecuciones accidentales, confirme escribiendo la palabra <strong className="font-mono bg-rose-200/80 px-1 py-0.5 rounded text-rose-950">LIMPIAR</strong> en el recuadro inferior. Al presionar el botón, el sistema purgará todas las transacciones de prueba y dejará todos los productos con stock en 0 listos para el conteo físico de inventario.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          <div className="flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Escribe LIMPIAR aquí..."
              value={confirmKeyword}
              onChange={(e) => setConfirmKeyword(e.target.value)}
              className="w-full uppercase font-mono font-bold text-sm tracking-widest px-3.5 py-2.5 border-2 border-rose-300 rounded-xl outline-none focus:border-rose-600 bg-white"
            />
          </div>

          <button
            onClick={handleExecutePurge}
            disabled={!isUnlocked || isProcessing}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer ${
              isUnlocked && !isProcessing
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-300'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none border border-gray-300'
            }`}
          >
            <Trash2 size={16} />
            {isProcessing ? 'Procesando Limpieza...' : 'Ejecutar Puesta a Cero de Transacciones'}
          </button>
        </div>
      </div>

    </div>
  );
}
