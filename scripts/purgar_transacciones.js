/**
 * Script de Terminal / Consola para Puesta a Cero de Transacciones de Prueba
 * Taller El Mingo ERP
 * 
 * Uso: node scripts/purgar_transacciones.js
 */

const DB_URL = "https://mingo-2b220-default-rtdb.firebaseio.com";

async function main() {
  console.log("=================================================");
  console.log("  TALLER EL MINGO — PUESTA A CERO DE TRANSACCIONES");
  console.log("=================================================");
  console.log("Conectando con base de datos:", DB_URL);

  const res = await fetch(`${DB_URL}/.json`);
  if (!res.ok) {
    console.error("Error al acceder a la base de datos:", res.status, res.statusText);
    process.exit(1);
  }

  const val = await res.json();
  if (!val) {
    console.log("La base de datos está vacía.");
    process.exit(0);
  }

  const prods = val.productos || {};
  const servs = val.servicios || {};
  const sucursales = Object.keys(val.configuracion?.sucursales || { 'SUC-01': true, 'SUC-02': true });

  console.log("\n[1/3] ENTIDADES PROTEGIDAS QUE SE CONSERVAN:");
  console.log(`- Productos: ${Object.keys(prods).length} (Stock pasará a 0 en todas las sucursales)`);
  console.log(`- Servicios: ${Object.keys(servs).length}`);
  console.log(`- Usuarios: ${Object.keys(val.usuarios || {}).length}`);
  console.log(`- Sucursales: ${sucursales.length}`);
  console.log(`- Cajas Registradoras: ${Object.keys(val.configuracion?.cajas || {}).length}`);
  console.log(`- Fotos en Cloudflare R2: ${Object.keys(val.productos_imagenes || {}).length}`);

  // Auditoría de códigos duplicados / vacíos
  console.log("\n[2/3] AUDITANDO DUPLICIDAD DE CÓDIGOS:");
  const updates = {};
  let fixes = 0;

  // Corregir servicios sin código
  let servNum = 1;
  Object.entries(servs).forEach(([id, s]) => {
    const code = (s.codigo_visible || '').trim();
    if (!code) {
      const newCode = `SRV-${String(servNum).padStart(4, '0')}`;
      updates[`servicios/${id}/codigo_visible`] = newCode;
      console.log(`  -> Asignando código a servicio [${id}] "${s.nombre}": ${newCode}`);
      fixes++;
    }
    servNum++;
  });

  // Corregir productos duplicados si existieran
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
      console.log(`  -> Corrigiendo código duplicado/vacío en producto [${id}] "${p.name}": ${candidate}`);
      fixes++;
    } else {
      seenCodes.add(code.toLowerCase());
    }
    prodNum++;
  });

  if (fixes === 0) {
    console.log("  ✓ Todos los códigos de productos y servicios son únicos.");
  } else {
    console.log(`  ✓ Se prepararon ${fixes} correcciones de códigos.`);
  }

  console.log("\n[3/3] PREPARANDO PURGA ATÓMICA DE TRANSACCIONES...");
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

  // Reiniciar contadores
  updates['counters/ventas'] = 0;
  updates['counters/compras'] = 0;
  updates['counters/traspasos'] = 0;
  updates['counters/turnos_caja'] = 0;
  updates['counters/ordenes_trabajo'] = 0;
  updates['counters/cxc'] = 0;
  updates['counters/cxp'] = 0;

  // Reiniciar folios a 1
  const cfg = val.configuracion?.consecutivos || {};
  updates['configuracion/consecutivos'] = {
    ...cfg,
    ventas: { ...(cfg.ventas || { prefijo: 'FAC-', ceros: 4 }), siguiente_numero: 1 },
    compras: { ...(cfg.compras || { prefijo: 'COMP-', ceros: 4 }), siguiente_numero: 1 },
    traspasos: { ...(cfg.traspasos || { prefijo: 'TRAS-', ceros: 4 }), siguiente_numero: 1 },
    ordenes_trabajo: { ...(cfg.ordenes_trabajo || { prefijo: 'OT-', ceros: 4 }), siguiente_numero: 1 },
    turnos: { ...(cfg.turnos || { prefijo: 'TUR-', ceros: 4 }), siguiente_numero: 1 },
    cxc: { ...(cfg.cxc || { prefijo: 'CXC-', ceros: 4 }), siguiente_numero: 1 },
    productos: { ...(cfg.productos || { prefijo: 'PROD-', ceros: 4 }), siguiente_numero: Math.max(Object.keys(prods).length + 1, 36) },
    servicios: { ...(cfg.servicios || { prefijo: 'SRV-', ceros: 4 }), siguiente_numero: Math.max(Object.keys(servs).length + 1, 5) }
  };

  // Stock en 0 para todos los productos en todas las sucursales
  sucursales.forEach(bId => {
    Object.keys(prods).forEach(pId => {
      const prev = val.inventario?.[bId]?.[pId] || {};
      updates[`inventario/${bId}/${pId}`] = {
        stock_actual: 0,
        stock_minimo: Number(prev.stock_minimo || 0),
        ubicacion: prev.ubicacion || ''
      };
    });
  });

  // Cajas cerradas
  const cajas = val.configuracion?.cajas || {};
  Object.keys(cajas).forEach(cId => {
    updates[`configuracion/cajas/${cId}/estado`] = 'Cerrada';
    updates[`configuracion/cajas/${cId}/id_turno_actual`] = null;
    updates[`configuracion/cajas/${cId}/cajero_actual`] = null;
  });

  // Cuentas bancarias saldo a 0
  const bancos = val.cuentas_bancarias || {};
  Object.keys(bancos).forEach(bId => {
    updates[`cuentas_bancarias/${bId}/saldo_actual`] = 0;
  });

  // Clientes y proveedores saldo a 0
  const clientes = val.clientes || {};
  Object.keys(clientes).forEach(cId => {
    updates[`clientes/${cId}/saldo_actual`] = 0;
  });
  const proveedores = val.proveedores || {};
  Object.keys(proveedores).forEach(pId => {
    updates[`proveedores/${pId}/saldo_actual`] = 0;
  });

  // Usuarios sin turno activo
  const usuarios = val.usuarios || {};
  Object.keys(usuarios).forEach(uId => {
    updates[`usuarios/${uId}/id_turno_activo`] = null;
  });

  console.log(`Aplicando ${Object.keys(updates).length} actualizaciones atómicas a Firebase...`);
  const patchRes = await fetch(`${DB_URL}/.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });

  if (!patchRes.ok) {
    console.error("Error al aplicar actualización:", patchRes.status, patchRes.statusText);
    process.exit(1);
  }

  console.log("\n=================================================");
  console.log("  ¡PUESTA A CERO COMPLETADA EXITOSAMENTE!         ");
  console.log("=================================================");
  console.log(`✓ ${Object.keys(prods).length} productos colocados con stock en 0.`);
  console.log(`✓ Sucursales configuradas: ${sucursales.join(', ')}.`);
  console.log(`✓ Transacciones de prueba borradas.`);
  console.log(`✓ Correlativos de facturas, compras y traspasos reiniciados a 1.`);
  console.log(`✓ Usuarios, servicios y fotos R2 intactos.`);
  console.log("=================================================\n");
}

main().catch(err => {
  console.error("Error fatal:", err);
  process.exit(1);
});
