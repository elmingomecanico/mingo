import { ref, push, set, update, get } from 'firebase/database';
import { rtdb } from '../firebase';
import { consumeNextConsecutiveAtomic } from './consecutivosService';

/**
 * Servicio para Repositorio de Productos Pendientes de Entrega y Órdenes de Despacho
 * Taller El Mingo ERP
 */

/**
 * Registrar mercancía vendida o apartada como pendiente de entrega
 */
export async function registrarPendienteEntrega({
  cliente_nombre,
  cliente_telefono = '',
  cliente_identificacion = '',
  id_venta_origen = null,
  sucursal = 'SUC-01',
  motivo = 'Cliente retira posteriormente en taller',
  items = [],
  usuario_registro = 'Cajero'
}) {
  if (!cliente_nombre || items.length === 0) {
    throw new Error('El nombre del cliente y los productos son obligatorios.');
  }

  // Obtener consecutivo atómico para entregas
  let codigoVisible = '';
  try {
    const consumed = await consumeNextConsecutiveAtomic('entregas');
    codigoVisible = consumed?.codigoFormateado || '';
  } catch (err) {
    console.warn('Error al consumir consecutivo entregas:', err);
  }

  const newRef = push(ref(rtdb, 'pendientes_entrega'));
  const id = newRef.key;
  if (!codigoVisible) {
    codigoVisible = `ENT-${Date.now().toString().slice(-4)}`;
  }

  const itemsNormalizados = items.map(it => {
    const qty = Number(it.cantidad || it.qty || 1);
    return {
      id_producto: it.id_producto || it.id || '',
      codigo_visible: it.codigo_visible || it.id || '',
      nombre: it.nombre || it.name || 'Producto',
      precio_unitario: Number(it.precio_unitario || it.price || 0),
      cantidad_total: qty,
      cantidad_entregada: 0,
      cantidad_pendiente: qty
    };
  });

  const record = {
    id,
    codigo_visible: codigoVisible,
    fecha_creacion: new Date().toISOString(),
    id_venta_origen: id_venta_origen || '',
    cliente_nombre: cliente_nombre.trim(),
    cliente_telefono: cliente_telefono?.trim() || '',
    cliente_identificacion: cliente_identificacion?.trim() || '',
    sucursal,
    motivo: motivo?.trim() || 'Retiro diferido de repuestos',
    estado: 'Pendiente', // 'Pendiente' | 'Parcial' | 'Entregado'
    items: itemsNormalizados,
    historial_despachos: [],
    usuario_registro
  };

  await set(ref(rtdb, `pendientes_entrega/${id}`), record);
  return record;
}

/**
 * Procesar una entrega / despacho (completa o parcial) y generar registro de Orden de Entrega
 */
export async function procesarDespachoEntrega({
  id_registro,
  despachado_por,
  recibido_por,
  cedula_recibe = '',
  observaciones = '',
  despacho_items = [] // [{ id_producto, cantidad_a_entregar }]
}) {
  const regSnap = await get(ref(rtdb, `pendientes_entrega/${id_registro}`));
  if (!regSnap.exists()) {
    throw new Error('El registro de pendiente de entrega no existe.');
  }

  const record = regSnap.val();
  const currentItems = Array.isArray(record.items) ? [...record.items] : [];
  const fechaDespacho = new Date().toISOString();
  const idDespacho = `DSP-${record.codigo_visible}-${(record.historial_despachos?.length || 0) + 1}`;

  const itemsDespachadosFinal = [];
  let itemsRestantesTotal = 0;

  currentItems.forEach(item => {
    const entregaReq = despacho_items.find(d => d.id_producto === item.id_producto);
    const cantEntregar = entregaReq ? Math.max(0, Number(entregaReq.cantidad_a_entregar || 0)) : 0;
    const entregaEfectiva = Math.min(item.cantidad_pendiente, cantEntregar);

    if (entregaEfectiva > 0) {
      item.cantidad_entregada = Number(item.cantidad_entregada || 0) + entregaEfectiva;
      item.cantidad_pendiente = Math.max(0, item.cantidad_total - item.cantidad_entregada);

      itemsDespachadosFinal.push({
        id_producto: item.id_producto,
        codigo_visible: item.codigo_visible,
        nombre: item.nombre,
        cantidad_despachada: entregaEfectiva,
        saldo_pendiente: item.cantidad_pendiente
      });
    }

    itemsRestantesTotal += item.cantidad_pendiente;
  });

  if (itemsDespachadosFinal.length === 0) {
    throw new Error('Debe especificar al menos una unidad para despachar.');
  }

  const nuevoEstado = itemsRestantesTotal === 0 ? 'Entregado' : 'Parcial';

  const detalleDespacho = {
    id_despacho: idDespacho,
    fecha: fechaDespacho,
    despachado_por: despachado_por || 'Personal de Bodega',
    recibido_por: recibido_por?.trim() || record.cliente_nombre,
    cedula_recibe: cedula_recibe?.trim() || record.cliente_identificacion || '',
    observaciones: observaciones?.trim() || '',
    items_despachados: itemsDespachadosFinal
  };

  const historialActualizado = [
    ...(record.historial_despachos || []),
    detalleDespacho
  ];

  await update(ref(rtdb, `pendientes_entrega/${id_registro}`), {
    items: currentItems,
    estado: nuevoEstado,
    fecha_ultima_entrega: fechaDespacho,
    historial_despachos: historialActualizado
  });

  return {
    success: true,
    nuevoEstado,
    detalleDespacho,
    itemsRestantesTotal
  };
}
