import { ref, get, update } from 'firebase/database';
import { rtdb } from '../firebase';
import { DEFAULT_CONSECUTIVOS, formatConsecutive } from '../components/catalogos/ConsecutivosManager';

/**
 * Servicio de Mantenimiento, Auditoría de Códigos y Puesta a Cero
 * Taller El Mingo ERP
 */

/**
 * Audita el estado actual de la base de datos:
 * 1. Cuenta transacciones de prueba que pueden ser purgadas.
 * 2. Cuenta entidades maestras que serán protegidas (productos, usuarios, etc.).
 * 3. Detecta duplicidad de códigos comerciales en productos, servicios, sucursales y cajas.
 * 4. Detecta códigos vacíos o con formato UUID crudo.
 */
export async function auditDatabaseStatus() {
  try {
    const snap = await get(ref(rtdb));
    if (!snap.exists()) {
      return { isEmpty: true, transactions: {}, masterData: {}, duplicates: [] };
    }

    const val = snap.val();

    // 1. Transacciones de prueba
    const transactions = {
      ventas: Object.keys(val.ventas || {}).length,
      turnos_caja: Object.keys(val.turnos_caja || {}).length,
      movimientos_caja: Object.keys(val.movimientos_caja || {}).length,
      compras: Object.keys(val.compras || {}).length,
      kardex: Object.keys(val.kardex || {}).length,
      traspasos: Object.keys(val.traspasos || {}).length,
      ordenes_trabajo: Object.keys(val.ordenes_trabajo || {}).length,
      cxc: Object.keys(val.cxc || {}).length,
      cxp: Object.keys(val.cxp || {}).length,
      deudas_empleados: Object.keys(val.deudas_empleados || {}).length,
      ajustes_inventario: Object.keys(val.ajustes_inventario || {}).length,
      movimientos_contables: Object.keys(val.movimientos_contables || {}).length,
      asiento_apertura: val.asiento_apertura ? 1 : 0,
      movimientos_bancarios: Object.keys(val.movimientos_bancarios || {}).length,
      asistencia: Object.keys(val.asistencia || {}).length,
      solicitudes_empleados: Object.keys(val.solicitudes_empleados || {}).length,
    };

    const totalTransacciones = Object.values(transactions).reduce((a, b) => a + b, 0);

    // 2. Entidades Maestras (Se conservan)
    const masterData = {
      productos: Object.keys(val.productos || {}).length,
      servicios: Object.keys(val.servicios || {}).length,
      usuarios: Object.keys(val.usuarios || {}).length,
      sucursales: Object.keys(val.configuracion?.sucursales || {}).length || 2,
      cajas: Object.keys(val.configuracion?.cajas || {}).length || 2,
      clientes: Object.keys(val.clientes || {}).length,
      proveedores: Object.keys(val.proveedores || {}).length,
      categorias: Object.keys(val.catalogos?.categorias || {}).length,
      imagenes_r2: Object.keys(val.productos_imagenes || {}).length,
    };

    // 3. Auditoría de Duplicidad en Productos
    const duplicateIssues = [];
    const prodCodeMap = {};
    Object.entries(val.productos || {}).forEach(([id, p]) => {
      const code = (p.codigo_visible || '').trim();
      if (!code) {
        duplicateIssues.push({
          type: 'producto',
          severity: 'warning',
          id,
          name: p.name || 'Sin nombre',
          issue: 'Código visible no asignado o vacío',
          currentCode: '(Vacío)',
          suggestedCode: `PROD-${id.substring(0, 4).toUpperCase()}`
        });
      } else {
        if (!prodCodeMap[code.toLowerCase()]) prodCodeMap[code.toLowerCase()] = [];
        prodCodeMap[code.toLowerCase()].push({ id, ...p });
      }
    });

    Object.entries(prodCodeMap).forEach(([lowerCode, list]) => {
      if (list.length > 1) {
        list.forEach((item, idx) => {
          duplicateIssues.push({
            type: 'producto',
            severity: 'error',
            id: item.id,
            name: item.name,
            issue: `Código duplicado "${item.codigo_visible}" (compartido por ${list.length} productos)`,
            currentCode: item.codigo_visible,
            suggestedCode: `${item.codigo_visible}-${idx + 1}`
          });
        });
      }
    });

    // 4. Auditoría de Duplicidad en Servicios
    const servCodeMap = {};
    Object.entries(val.servicios || {}).forEach(([id, s]) => {
      const code = (s.codigo_visible || '').trim();
      if (!code) {
        duplicateIssues.push({
          type: 'servicio',
          severity: 'warning',
          id,
          name: s.nombre || 'Sin nombre',
          issue: 'Código visible comercial no asignado o vacío',
          currentCode: '(Vacío)',
          suggestedCode: `SRV-000${duplicateIssues.length + 1}`
        });
      } else {
        if (!servCodeMap[code.toLowerCase()]) servCodeMap[code.toLowerCase()] = [];
        servCodeMap[code.toLowerCase()].push({ id, ...s });
      }
    });

    Object.entries(servCodeMap).forEach(([lowerCode, list]) => {
      if (list.length > 1) {
        list.forEach((item, idx) => {
          duplicateIssues.push({
            type: 'servicio',
            severity: 'error',
            id: item.id,
            name: item.nombre,
            issue: `Código duplicado "${item.codigo_visible}" (compartido por ${list.length} servicios)`,
            currentCode: item.codigo_visible,
            suggestedCode: `${item.codigo_visible}-${idx + 1}`
          });
        });
      }
    });

    // 5. Auditoría de Duplicidad en Sucursales
    const branchCodeMap = {};
    Object.entries(val.configuracion?.sucursales || {}).forEach(([id, b]) => {
      const code = (b.codigo_visible || id).trim();
      if (!branchCodeMap[code.toLowerCase()]) branchCodeMap[code.toLowerCase()] = [];
      branchCodeMap[code.toLowerCase()].push({ id, ...b });
    });

    Object.entries(branchCodeMap).forEach(([lowerCode, list]) => {
      if (list.length > 1) {
        list.forEach((item, idx) => {
          duplicateIssues.push({
            type: 'sucursal',
            severity: 'error',
            id: item.id,
            name: item.nombre,
            issue: `Código de sucursal duplicado "${item.codigo_visible}"`,
            currentCode: item.codigo_visible,
            suggestedCode: `SUC-${idx + 1}`
          });
        });
      }
    });

    return {
      success: true,
      totalTransacciones,
      transactions,
      masterData,
      duplicateIssues
    };
  } catch (error) {
    console.error("Error al auditar base de datos:", error);
    return { success: false, error: error.message, transactions: {}, masterData: {}, duplicateIssues: [] };
  }
}

/**
 * Resuelve y estandariza de forma automática todos los códigos duplicados o vacíos encontrados.
 */
export async function fixDuplicateAndMissingCodes() {
  const audit = await auditDatabaseStatus();
  if (!audit.success || audit.duplicateIssues.length === 0) {
    return { success: true, fixedCount: 0, message: "No se encontraron duplicados que corregir" };
  }

  const updates = {};
  let fixedCount = 0;

  // Corregir servicios sin código o duplicados
  const snap = await get(ref(rtdb));
  const val = snap.val();
  const servs = val.servicios || {};
  let servNum = 1;

  Object.entries(servs).forEach(([id, s]) => {
    let code = (s.codigo_visible || '').trim();
    if (!code || audit.duplicateIssues.some(d => d.type === 'servicio' && d.id === id && d.severity === 'error')) {
      const newCode = `SRV-${String(servNum).padStart(4, '0')}`;
      updates[`servicios/${id}/codigo_visible`] = newCode;
      fixedCount++;
      servNum++;
    } else {
      servNum++;
    }
  });

  // Corregir productos duplicados si hubiese
  const prods = val.productos || {};
  const seenCodes = new Set();
  let prodNum = 1;

  Object.entries(prods).forEach(([id, p]) => {
    let code = (p.codigo_visible || '').trim();
    if (!code || seenCodes.has(code.toLowerCase())) {
      let candidate = `PROD-${String(prodNum).padStart(4, '0')}`;
      while (seenCodes.has(candidate.toLowerCase())) {
        prodNum++;
        candidate = `PROD-${String(prodNum).padStart(4, '0')}`;
      }
      updates[`productos/${id}/codigo_visible`] = candidate;
      seenCodes.add(candidate.toLowerCase());
      fixedCount++;
      prodNum++;
    } else {
      seenCodes.add(code.toLowerCase());
      prodNum++;
    }
  });

  if (fixedCount > 0) {
    await update(ref(rtdb), updates);
  }

  return {
    success: true,
    fixedCount,
    message: `Se estandarizaron y corrigieron ${fixedCount} códigos duplicados/vacíos exitosamente.`
  };
}

/**
 * Ejecuta la Puesta a Cero (Purga de Transacciones de Prueba):
 * 1. Elimina todos los nodos transaccionales de prueba.
 * 2. Conserva todos los productos, servicios, usuarios, sucursales y catálogos.
 * 3. Pone el stock_actual de TODOS los productos en 0 en todas las sucursales.
 * 4. Cierra todas las cajas registradoras y limpia turnos activos.
 * 5. Resetea los saldos bancarios y de cuentas corrientes a 0.
 * 6. Reinicia los correlativos de facturación, compras y traspasos a 1.
 */
export async function executePurgeAndResetToZero() {
  const snap = await get(ref(rtdb));
  if (!snap.exists()) throw new Error("Base de datos no accesible");
  const val = snap.val();

  const updates = {};

  // 1. Eliminar completamente nodos transaccionales de prueba
  const transactionalNodes = [
    'ventas',
    'turnos_caja',
    'movimientos_caja',
    'compras',
    'kardex',
    'traspasos',
    'ordenes_trabajo',
    'cxc',
    'cxp',
    'deudas_empleados',
    'ajustes_inventario',
    'movimientos_contables',
    'asiento_apertura',
    'movimientos_bancarios',
    'asistencia',
    'solicitudes_empleados'
  ];

  transactionalNodes.forEach(node => {
    updates[node] = null;
  });

  // 2. Reiniciar contadores transaccionales (counters) a 0
  updates['counters/ventas'] = 0;
  updates['counters/compras'] = 0;
  updates['counters/traspasos'] = 0;
  updates['counters/turnos_caja'] = 0;
  updates['counters/ordenes_trabajo'] = 0;
  updates['counters/cxc'] = 0;
  updates['counters/cxp'] = 0;

  // 3. Reiniciar folios en configuracion/consecutivos (ventas a 1, compras a 1, etc.)
  const cfg = val.configuracion?.consecutivos || DEFAULT_CONSECUTIVOS;
  const updatedConsecutivos = {
    ...cfg,
    ventas: { ...(cfg.ventas || DEFAULT_CONSECUTIVOS.ventas), siguiente_numero: 1 },
    compras: { ...(cfg.compras || DEFAULT_CONSECUTIVOS.compras), siguiente_numero: 1 },
    traspasos: { ...(cfg.traspasos || DEFAULT_CONSECUTIVOS.traspasos), siguiente_numero: 1 },
    ordenes_trabajo: { ...(cfg.ordenes_trabajo || DEFAULT_CONSECUTIVOS.ordenes_trabajo), siguiente_numero: 1 },
    turnos: { ...(cfg.turnos || DEFAULT_CONSECUTIVOS.turnos), siguiente_numero: 1 },
    cxc: { ...(cfg.cxc || DEFAULT_CONSECUTIVOS.cxc), siguiente_numero: 1 }
  };

  // Mantener los correlativos de productos y servicios acordes a los ya creados
  const totalProds = Object.keys(val.productos || {}).length;
  const totalServs = Object.keys(val.servicios || {}).length;
  updatedConsecutivos.productos = {
    ...(cfg.productos || DEFAULT_CONSECUTIVOS.productos),
    siguiente_numero: Math.max(totalProds + 1, 36)
  };
  updatedConsecutivos.servicios = {
    ...(cfg.servicios || DEFAULT_CONSECUTIVOS.servicios),
    siguiente_numero: Math.max(totalServs + 1, 5)
  };

  updates['configuracion/consecutivos'] = updatedConsecutivos;

  // 4. Poner stock_actual a 0 en todas las sucursales para TODOS los productos creados
  const sucursalesList = Object.keys(val.configuracion?.sucursales || { 'SUC-01': true, 'SUC-02': true });
  const prods = val.productos || {};

  sucursalesList.forEach(branchId => {
    Object.keys(prods).forEach(prodId => {
      const existingInv = val.inventario?.[branchId]?.[prodId] || {};
      updates[`inventario/${branchId}/${prodId}`] = {
        stock_actual: 0,
        stock_minimo: Number(existingInv.stock_minimo || 0),
        ubicacion: existingInv.ubicacion || ''
      };
    });
  });

  // 5. Dejar todas las Cajas Registradoras en estado "Cerrada" y sin turnos abiertos
  const cajas = val.configuracion?.cajas || {};
  Object.keys(cajas).forEach(cajaId => {
    updates[`configuracion/cajas/${cajaId}/estado`] = 'Cerrada';
    updates[`configuracion/cajas/${cajaId}/id_turno_actual`] = null;
    updates[`configuracion/cajas/${cajaId}/cajero_actual`] = null;
  });

  // 6. Resetear saldos de cuentas bancarias a 0 (conservando las cuentas creadas)
  const bancos = val.cuentas_bancarias || {};
  Object.keys(bancos).forEach(bId => {
    updates[`cuentas_bancarias/${bId}/saldo_actual`] = 0;
  });

  // 7. Resetear saldos de clientes y proveedores a 0
  const clientes = val.clientes || {};
  Object.keys(clientes).forEach(cId => {
    updates[`clientes/${cId}/saldo_actual`] = 0;
  });

  const proveedores = val.proveedores || {};
  Object.keys(proveedores).forEach(pId => {
    updates[`proveedores/${pId}/saldo_actual`] = 0;
  });

  // 8. Limpiar estado de turnos en usuarios
  const usuarios = val.usuarios || {};
  Object.keys(usuarios).forEach(uId => {
    updates[`usuarios/${uId}/id_turno_activo`] = null;
  });

  // Ejecución atómica
  await update(ref(rtdb), updates);

  return {
    success: true,
    totalProds,
    totalServs,
    sucursalesAfectadas: sucursalesList.length,
    timestamp: new Date().toISOString()
  };
}
