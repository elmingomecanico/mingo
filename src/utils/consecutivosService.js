import { ref, get, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';
import { DEFAULT_CONSECUTIVOS, formatConsecutive } from '../components/catalogos/ConsecutivosManager';

/**
 * Consume de manera 100% ATÓMICA el siguiente número consecutivo oficial para una entidad
 * (`ventas`, `productos`, `servicios`, `ordenes_taller`) directamente desde `configuracion/consecutivos/{entidad}`.
 * Evita colisiones cuando múltiples cajeros o bodegueros guardan registros simultáneamente.
 *
 * @param {'ventas'|'productos'|'servicios'|'ordenes_taller'} entidad
 * @param {Object|null} branchObj Objeto de sucursal opcional (para prefijo de sucursal en facturas)
 * @returns {Promise<{ numeroAsignado: number, codigoFormateado: string }>}
 */
export const consumeNextConsecutiveAtomic = async (entidad, branchObj = null) => {
  const defaultCfg = DEFAULT_CONSECUTIVOS[entidad] || DEFAULT_CONSECUTIVOS.ventas;
  const entidadRef = ref(rtdb, `configuracion/consecutivos/${entidad}`);

  let assignedNumber = 1;
  let finalCfg = defaultCfg;

  const txResult = await runTransaction(entidadRef, (currentNode) => {
    if (!currentNode) {
      assignedNumber = Number(defaultCfg.siguiente_numero) || 1;
      return {
        ...defaultCfg,
        siguiente_numero: assignedNumber + 1
      };
    }
    const currentNext = Math.max(1, Number(currentNode.siguiente_numero) || 1);
    assignedNumber = currentNext;
    return {
      ...defaultCfg,
      ...currentNode,
      siguiente_numero: currentNext + 1
    };
  });

  const committedVal = txResult.snapshot.val() || defaultCfg;
  // El número consumido por esta transacción es exactamente (committedVal.siguiente_numero - 1)
  const consumedNum = Math.max(1, (Number(committedVal.siguiente_numero) || 2) - 1);
  finalCfg = { ...defaultCfg, ...committedVal };

  let humanCode = formatConsecutive(finalCfg, consumedNum);

  if (entidad === 'ventas' && finalCfg.incluir_prefijo_sucursal && branchObj) {
    const branchPrefix = branchObj.prefijo_factura || `${branchObj.id}-`;
    humanCode = `${branchPrefix}${humanCode}`;
  }

  return {
    numeroAsignado: consumedNum,
    codigoFormateado: humanCode
  };
};

/**
 * Verifica si un `codigo_visible` ya está siendo utilizado por otro registro en una colección (`productos` o `servicios`).
 * @param {'productos'|'servicios'} collectionName
 * @param {string} codigoVisible Código a verificar
 * @param {string|null} excludeId ID del registro actual (en caso de edición)
 * @returns {Promise<{ isDuplicate: boolean, conflictItem: Object|null }>}
 */
export const checkDuplicateCodigoVisible = async (collectionName, codigoVisible, excludeId = null) => {
  if (!codigoVisible || !codigoVisible.trim()) {
    return { isDuplicate: false, conflictItem: null };
  }
  const normalizedTarget = codigoVisible.trim().toUpperCase();
  const snap = await get(ref(rtdb, collectionName));
  if (!snap.exists()) return { isDuplicate: false, conflictItem: null };

  const data = snap.val();
  for (const [id, item] of Object.entries(data)) {
    if (excludeId && id === excludeId) continue;
    const itemCode = (item.codigo_visible || item.id || '').toString().trim().toUpperCase();
    if (itemCode === normalizedTarget) {
      return { isDuplicate: true, conflictItem: { id, ...item } };
    }
  }
  return { isDuplicate: false, conflictItem: null };
};
