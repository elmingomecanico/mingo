import { ref, get, push, update, runTransaction } from 'firebase/database';
import { rtdb } from '../firebase';

/**
 * Anula y elimina una Factura de Venta revirtiendo de forma íntegra y atómica todos sus efectos:
 * 1. Reintegra el stock físico al inventario de la sucursal correspondiente (`runTransaction`).
 * 2. Registra la entrada por reversión en el `kardex` con saldos exactos.
 * 3. Descuenta el monto del turno de caja (`turnos_caja`) si fue en efectivo.
 * 4. Revierte el saldo en `cuentas_bancarias` y elimina el registro en `movimientos_bancarios` si fue Tarjeta/Transferencia.
 * 5. Elimina las cuentas por cobrar (`cxc`), deudas de empleado (`deudas_empleados`), órdenes de trabajo (`ordenes_trabajo`) y movimientos contables asociados.
 * 6. Elimina el documento de `ventas/{id}`.
 */
export const reverseAndDeleteSale = async (venta, usuarioNombre = 'SuperAdmin') => {
  if (!venta || !venta.id) throw new Error('Datos de venta inválidos');

  const saleId = venta.id;
  const numFactura = venta.numero_factura || saleId;
  const branchId = venta.sucursal || 'SUC-01';
  const multiUpdates = {};

  // 1. Revertir Stock de productos y preparar líneas de Kardex con valores transaccionales reales
  if (Array.isArray(venta.items)) {
    for (const item of venta.items) {
      const prodId = item.id_producto || item.id;
      const qty = Number(item.cantidad || item.qty || 0);
      if (item.type !== 'servicio' && prodId && qty > 0) {
        const stockRef = ref(rtdb, `inventario/${branchId}/${prodId}/stock_actual`);
        const txRes = await runTransaction(stockRef, (current) => {
          return (Number(current) || 0) + qty;
        });

        const stockNuevo = Number(txRes.snapshot.val()) || 0;
        const stockAnterior = stockNuevo - qty;

        const kardexKey = push(ref(rtdb, 'kardex')).key;
        multiUpdates[`kardex/${kardexKey}`] = {
          fecha: new Date().toISOString(),
          id_sucursal: branchId,
          id_producto: prodId,
          nombre_producto: item.name || item.nombre || 'Producto',
          tipo_movimiento: 'Entrada por Anulación de Venta',
          cantidad: qty,
          id_referencia: numFactura,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          usuario: usuarioNombre
        };
      }
    }
  }

  // 2. Si la venta estuvo asociada a un turno de caja, ajustar los acumuladores del turno
  if (venta.id_turno) {
    const turnoRef = ref(rtdb, `turnos_caja/${venta.id_turno}`);
    const turnoSnap = await get(turnoRef);
    if (turnoSnap.exists()) {
      await runTransaction(turnoRef, (t) => {
        if (!t) return t;
        const montoTotal = Number(venta.total || 0);
        const montoProd = Number(venta.total_productos || 0);
        const montoServ = Number(venta.total_servicios || 0);
        if (venta.metodo_pago === 'Efectivo') {
          t.total_ventas_efectivo = Math.max(0, (Number(t.total_ventas_efectivo) || 0) - montoTotal);
        }
        t.total_ventas_productos = Math.max(0, (Number(t.total_ventas_productos) || 0) - montoProd);
        t.total_ventas_servicios = Math.max(0, (Number(t.total_ventas_servicios) || 0) - montoServ);
        return t;
      });
    }
  }

  // 3. Si fue cobrada por Tarjeta o Transferencia, revertir saldo bancario y borrar movimiento bancario
  if (venta.metodo_pago === 'Tarjeta' || venta.metodo_pago === 'Transferencia') {
    const movsBancSnap = await get(ref(rtdb, 'movimientos_bancarios'));
    if (movsBancSnap.exists()) {
      const movsBanc = movsBancSnap.val();
      for (const [mbId, mb] of Object.entries(movsBanc)) {
        if (
          mb.id_venta === saleId ||
          mb.referencia_bancaria === numFactura ||
          mb.comprobante_relacionado === numFactura
        ) {
          if (mb.id_cuenta) {
            const montoRev = Number(mb.monto || venta.total || 0);
            await runTransaction(ref(rtdb, `cuentas_bancarias/${mb.id_cuenta}/saldo_actual`), (cur) => {
              return (Number(cur) || 0) - montoRev;
            });
          }
          multiUpdates[`movimientos_bancarios/${mbId}`] = null;
        }
      }
    }
  }

  // 4. Eliminar Cuentas por Cobrar (CxC) vinculadas a esta factura
  const cxcSnap = await get(ref(rtdb, 'cxc'));
  if (cxcSnap.exists()) {
    const cxcData = cxcSnap.val();
    for (const [cxcId, cxc] of Object.entries(cxcData)) {
      if (cxc.id_factura === saleId || (numFactura && cxc.numero_factura === numFactura)) {
        multiUpdates[`cxc/${cxcId}`] = null;
      }
    }
  }

  // 5. Eliminar Deudas de Empleados vinculadas a esta factura
  const deudasSnap = await get(ref(rtdb, 'deudas_empleados'));
  if (deudasSnap.exists()) {
    const deudasData = deudasSnap.val();
    for (const [dId, deuda] of Object.entries(deudasData)) {
      if (deuda.id_factura === saleId || (deuda.motivo && deuda.motivo.includes(numFactura))) {
        multiUpdates[`deudas_empleados/${dId}`] = null;
      }
    }
  }

  // 6. Eliminar Órdenes de Trabajo vinculadas a esta factura
  const otSnap = await get(ref(rtdb, 'ordenes_trabajo'));
  if (otSnap.exists()) {
    const otData = otSnap.val();
    for (const [otId, ot] of Object.entries(otData)) {
      if (ot.id_factura === saleId || (numFactura && ot.numero_factura === numFactura)) {
        multiUpdates[`ordenes_trabajo/${otId}`] = null;
      }
    }
  }

  // 7. Eliminar Movimientos Contables asociados a esta factura
  const movContSnap = await get(ref(rtdb, 'movimientos_contables'));
  if (movContSnap.exists()) {
    const movContData = movContSnap.val();
    for (const [mcId, mc] of Object.entries(movContData)) {
      if (mc.id_referencia === saleId || (numFactura && mc.numero_comprobante === numFactura)) {
        multiUpdates[`movimientos_contables/${mcId}`] = null;
      }
    }
  }

  // 8. Eliminar el registro de la venta
  multiUpdates[`ventas/${saleId}`] = null;

  // Ejecutar borrado en cascada en un único paquete atómico
  await update(ref(rtdb), multiUpdates);
};

/**
 * Anula y elimina una Factura de Compra revirtiendo de forma íntegra y atómica todos sus efectos:
 * 1. Resta del inventario de la sucursal las unidades físicas que habían ingresado por esa compra (`runTransaction`).
 * 2. Registra la salida por anulación en el `kardex`.
 * 3. Elimina la Cuenta por Pagar (`cxp`) vinculada.
 * 4. Elimina el movimiento contable de egreso (`movimientos_contables`) y revierte banco si aplica.
 * 5. Elimina el documento `compras/{id}`.
 */
export const reverseAndDeletePurchase = async (compra, usuarioNombre = 'SuperAdmin') => {
  if (!compra || !compra.id) throw new Error('Datos de compra inválidos');

  const compraId = compra.id;
  const numFactura = compra.numero_factura || compraId;
  const branchId = compra.sucursal || 'SUC-01';
  const multiUpdates = {};

  // 1. Descontar del inventario las unidades que ingresaron en esta compra
  if (Array.isArray(compra.items)) {
    for (const item of compra.items) {
      const prodId = item.id_producto || item.id;
      const qtyIngresada = Number(item.total_unidades || item.cantidad_facturada || 0);
      if (prodId && qtyIngresada > 0) {
        const stockRef = ref(rtdb, `inventario/${branchId}/${prodId}/stock_actual`);
        const txRes = await runTransaction(stockRef, (current) => {
          return (Number(current) || 0) - qtyIngresada;
        });

        const stockNuevo = Number(txRes.snapshot.val()) || 0;
        const stockAnterior = stockNuevo + qtyIngresada;

        const kardexKey = push(ref(rtdb, 'kardex')).key;
        multiUpdates[`kardex/${kardexKey}`] = {
          fecha: new Date().toISOString(),
          id_sucursal: branchId,
          id_producto: prodId,
          nombre_producto: item.nombre || item.name || 'Producto',
          tipo_movimiento: 'Salida por Anulación de Compra',
          cantidad: qtyIngresada,
          id_referencia: numFactura,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          usuario: usuarioNombre
        };
      }
    }
  }

  // 2. Eliminar Cuentas por Pagar (CxP) asociadas a esta compra
  const cxpSnap = await get(ref(rtdb, 'cxp'));
  if (cxpSnap.exists()) {
    const cxpData = cxpSnap.val();
    for (const [cxpId, cxp] of Object.entries(cxpData)) {
      if (cxp.id_compra === compraId || (numFactura && cxp.numero_factura === numFactura && cxp.id_proveedor === compra.id_proveedor)) {
        multiUpdates[`cxp/${cxpId}`] = null;
      }
    }
  }

  // 3. Eliminar Movimientos Contables asociados a esta compra
  const movContSnap = await get(ref(rtdb, 'movimientos_contables'));
  if (movContSnap.exists()) {
    const movContData = movContSnap.val();
    for (const [mcId, mc] of Object.entries(movContData)) {
      if (mc.id_referencia === compraId || (numFactura && mc.numero_comprobante === numFactura)) {
        multiUpdates[`movimientos_contables/${mcId}`] = null;
      }
    }
  }

  // 4. Si hubo movimiento bancario asociado a esta compra, revertir saldo y borrar movimiento
  const movBancSnap = await get(ref(rtdb, 'movimientos_bancarios'));
  if (movBancSnap.exists()) {
    const movBancData = movBancSnap.val();
    for (const [mbId, mb] of Object.entries(movBancData)) {
      if (mb.id_compra === compraId || mb.comprobante_relacionado === compraId) {
        if (mb.id_cuenta) {
          const montoRev = Number(mb.monto || compra.total || 0);
          await runTransaction(ref(rtdb, `cuentas_bancarias/${mb.id_cuenta}/saldo_actual`), (cur) => {
            return (Number(cur) || 0) + montoRev;
          });
        }
        multiUpdates[`movimientos_bancarios/${mbId}`] = null;
      }
    }
  }

  // 5. Eliminar el registro de compra
  multiUpdates[`compras/${compraId}`] = null;

  await update(ref(rtdb), multiUpdates);
};

/**
 * Verifica si un Cliente puede ser eliminado sin dejar cuentas por cobrar (CxC) huérfanas.
 */
export const validateClienteDeletion = async (clienteId) => {
  const cxcSnap = await get(ref(rtdb, 'cxc'));
  if (!cxcSnap.exists()) return { allowed: true };

  const cxcData = cxcSnap.val();
  const pendientes = Object.values(cxcData).filter(
    (c) => c.id_cliente === clienteId && c.estado === 'Pendiente' && Number(c.saldo_pendiente) > 0
  );

  if (pendientes.length > 0) {
    const totalDeuda = pendientes.reduce((acc, c) => acc + Number(c.saldo_pendiente || 0), 0);
    const facturas = pendientes.map((c) => c.numero_factura || 'S/N').join(', ');
    return {
      allowed: false,
      message: `No se puede eliminar este cliente porque tiene ${pendientes.length} cuenta(s) por cobrar pendiente(s) (${facturas}) por un saldo total de C$ ${totalDeuda.toLocaleString('es-NI', { minimumFractionDigits: 2 })}. Primero liquide la deuda o elimine la factura de prueba en Reportes.`
    };
  }

  return { allowed: true };
};

/**
 * Verifica si un Proveedor puede ser eliminado sin dejar cuentas por pagar (CxP) huérfanas.
 */
export const validateProveedorDeletion = async (proveedorId) => {
  const cxpSnap = await get(ref(rtdb, 'cxp'));
  if (!cxpSnap.exists()) return { allowed: true };

  const cxpData = cxpSnap.val();
  const pendientes = Object.values(cxpData).filter(
    (c) => c.id_proveedor === proveedorId && c.estado === 'Pendiente' && Number(c.saldo_pendiente) > 0
  );

  if (pendientes.length > 0) {
    const totalDeuda = pendientes.reduce((acc, c) => acc + Number(c.saldo_pendiente || 0), 0);
    const facturas = pendientes.map((c) => c.numero_factura || 'S/N').join(', ');
    return {
      allowed: false,
      message: `No se puede eliminar este proveedor porque tiene ${pendientes.length} factura(s) por pagar pendiente(s) (${facturas}) por un saldo total de C$ ${totalDeuda.toLocaleString('es-NI', { minimumFractionDigits: 2 })}. Primero liquide la cuenta o elimine la compra de prueba en el historial de Compras.`
    };
  }

  return { allowed: true };
};

/**
 * Elimina un producto de forma limpia en el catálogo maestro, en el nodo de imágenes WebP
 * y en todas las sucursales de inventario registradas.
 */
export const deleteProductCleanly = async (prodId) => {
  if (!prodId) return;
  const multiUpdates = {
    [`productos/${prodId}`]: null,
    [`productos_imagenes/${prodId}`]: null,
    [`inventario/${prodId}`]: null // Limpieza por si existía algún nodo en raíz heredado
  };

  const invSnap = await get(ref(rtdb, 'inventario'));
  if (invSnap.exists()) {
    const invBranches = invSnap.val();
    for (const branchKey of Object.keys(invBranches)) {
      if (invBranches[branchKey] && typeof invBranches[branchKey] === 'object' && invBranches[branchKey][prodId] !== undefined) {
        multiUpdates[`inventario/${branchKey}/${prodId}`] = null;
      }
    }
  }

  await update(ref(rtdb), multiUpdates);
};
