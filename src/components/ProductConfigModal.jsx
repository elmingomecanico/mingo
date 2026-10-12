import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Minus, 
  Package, 
  Sparkles, 
  Lock, 
  RefreshCw, 
  Check, 
  AlertCircle,
  Building2,
  Wrench
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProductConfigModal({
  isOpen,
  onClose,
  config,
  onSave,
  SUCURSALES = [],
  getStock,
  clienteActualObj,
  isMostrador,
  hasPrivilegios,
  descuentoEval,
  metodoPago
}) {
  if (!isOpen || !config || !config.product) return null;

  const { product, isEditing, existingCartItemId } = config;
  const isService = product.type === 'servicio';

  // Sucursal seleccionada
  const [selectedBranch, setSelectedBranch] = useState(() => {
    return config.sucursal || 'SUC-01';
  });

  // Cantidad seleccionada
  const [qty, setQty] = useState(() => {
    return config.qty || 1;
  });

  // Modo y valor de descuento
  const [discountMode, setDiscountMode] = useState(() => {
    return config.discountMode || (isMostrador ? 'C$' : '%');
  });
  const [discountVal, setDiscountVal] = useState(() => {
    if (config.discountMode === '%') {
      return config.discountPercent || 0;
    }
    return config.discount || 0;
  });

  // Al abrir el modal o cambiar el producto, sincronizar
  useEffect(() => {
    setSelectedBranch(config.sucursal || 'SUC-01');
    setQty(config.qty || 1);
    setDiscountMode(config.discountMode || (isMostrador ? 'C$' : '%'));
    if (config.discountMode === '%') {
      setDiscountVal(config.discountPercent || 0);
    } else {
      setDiscountVal(config.discount || 0);
    }
  }, [config, isMostrador]);

  // Stock máximo en la sucursal seleccionada
  const maxStock = isService ? 999999 : (getStock ? getStock(product.id, selectedBranch) : 9999);

  // Asegurar que la cantidad no sobrepase el stock si el usuario cambia de sucursal
  const handleBranchChange = (newBranchId) => {
    setSelectedBranch(newBranchId);
    if (!isService && getStock) {
      const stockInNew = getStock(product.id, newBranchId);
      if (stockInNew > 0 && qty > stockInNew) {
        setQty(stockInNew);
        toast(`Cantidad ajustada a ${stockInNew} (stock disponible)`, { icon: 'ℹ️' });
      }
    }
  };

  const handleIncrement = () => {
    if (!isService && qty >= maxStock) {
      toast.error(`Stock máximo alcanzado en esta sucursal (${maxStock})`);
      return;
    }
    setQty(prev => prev + 1);
  };

  const handleDecrement = () => {
    if (qty > 1) {
      setQty(prev => prev - 1);
    }
  };

  const handleQtyInput = (e) => {
    const parsed = parseInt(e.target.value, 10);
    if (isNaN(parsed) || parsed < 1) {
      setQty(1);
    } else if (!isService && parsed > maxStock) {
      setQty(Math.max(1, maxStock));
      toast.error(`Stock máximo disponible: ${maxStock}`);
    } else {
      setQty(parsed);
    }
  };

  // Cálculos de totales y descuentos
  const unitPrice = Number(product.price) || 0;
  const subtotalBruto = unitPrice * qty;

  let effectiveDiscount = 0;
  let effectivePercent = 0;

  if (!isMostrador) {
    if (hasPrivilegios && descuentoEval?.aplica) {
      effectivePercent = clienteActualObj?.descuento_fijo || 0;
      effectiveDiscount = Number(((subtotalBruto * effectivePercent) / 100).toFixed(2));
    } else {
      effectivePercent = 0;
      effectiveDiscount = 0;
    }
  } else {
    // Modo Mostrador (permite descuento manual)
    const val = Math.max(0, parseFloat(discountVal) || 0);
    if (discountMode === '%') {
      effectivePercent = Math.min(100, val);
      effectiveDiscount = Number(((subtotalBruto * effectivePercent) / 100).toFixed(2));
    } else {
      effectiveDiscount = Math.min(subtotalBruto, val);
      effectivePercent = subtotalBruto > 0 ? Number(((effectiveDiscount / subtotalBruto) * 100).toFixed(1)) : 0;
    }
  }

  const subtotalNeto = Math.max(0, subtotalBruto - effectiveDiscount);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!isService && maxStock <= 0) {
      toast.error(`La sucursal seleccionada no tiene existencias.`);
      return;
    }

    if (!isService && qty > maxStock) {
      toast.error(`Stock insuficiente en la sucursal seleccionada. Máx: ${maxStock}`);
      return;
    }

    onSave({
      product,
      sucursal: selectedBranch,
      qty,
      discount: effectiveDiscount,
      discountPercent: effectivePercent,
      discountMode,
      isEditing,
      existingCartItemId
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col my-auto border border-gray-100 animate-in zoom-in-95 duration-200 max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center">
              {isService ? <Wrench size={20} className="text-purple-300" /> : <Package size={20} className="text-blue-300" />}
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg leading-tight">
                {isEditing ? 'Modificar Artículo' : 'Agregar a la Factura'}
              </h3>
              <p className="text-xs text-blue-200">
                {isService ? 'Configuración de mano de obra' : 'Detalles de producto e inventario'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENIDO CON SCROLL */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* TARJETA DEL PRODUCTO */}
          <div className="bg-gray-50 p-3.5 sm:p-4 rounded-2xl border border-gray-200/80 flex items-start gap-3 sm:gap-4">
            {product.image ? (
              <img 
                src={product.image} 
                alt={product.name} 
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-gray-200 shadow-xs shrink-0" 
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                {isService ? <Wrench size={28} className="text-purple-400" /> : <Package size={28} className="text-gray-400" />}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-xs font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
                  {product.id}
                </span>
                {isService ? (
                  <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-lg">
                    Servicio
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-gray-600 bg-gray-200/70 px-2 py-0.5 rounded-lg">
                    {product.cat || 'Repuesto'}
                  </span>
                )}
              </div>

              <h4 className="font-black text-gray-900 text-sm sm:text-base mt-1 leading-snug">
                {product.name}
              </h4>

              {product.compatibilidad && product.compatibilidad.length > 0 && (
                <p className="text-xs text-blue-600 font-semibold truncate mt-1">
                  Compat: {product.compatibilidad.join(', ')}
                </p>
              )}

              <div className="mt-2 text-blue-900 font-black text-lg">
                C$ {unitPrice.toFixed(2)} <span className="text-xs text-gray-400 font-semibold">/ unidad</span>
              </div>
            </div>
          </div>

          {/* SELECTOR DE SUCURSAL DE ORIGEN (MULTISUCURSAL) */}
          {!isService && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-gray-600 flex items-center gap-1.5">
                  <Building2 size={14} className="text-blue-600" />
                  Sucursal de Despacho (Inventario)
                </label>
                <span className="text-[11px] text-gray-400 font-medium">
                  Total disponible: {SUCURSALES.reduce((acc, s) => acc + (getStock ? getStock(product.id, s.id) : 0), 0)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {SUCURSALES.map((suc) => {
                  const stockSuc = getStock ? getStock(product.id, suc.id) : 0;
                  const isSelected = selectedBranch === suc.id;
                  const hasStock = stockSuc > 0;

                  return (
                    <button
                      key={suc.id}
                      type="button"
                      disabled={!hasStock}
                      onClick={() => handleBranchChange(suc.id)}
                      className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500 shadow-sm'
                          : hasStock
                            ? 'border-gray-200 bg-white hover:bg-gray-50'
                            : 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-gray-800">{suc.short}</span>
                        {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600"></span>}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-black ${
                          hasStock ? (stockSuc > 5 ? 'text-green-700' : 'text-amber-700') : 'text-red-500'
                        }`}>
                          {hasStock ? `${stockSuc} disp.` : 'Agotado'}
                        </span>
                        {suc.id === 'SUC-01' ? (
                          <span className="text-[10px] text-gray-400">Principal</span>
                        ) : (
                          <span className="text-[10px] text-gray-400">Norte</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {maxStock <= 0 && (
                <div className="flex items-center gap-1.5 p-2 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Sin existencias en esta sucursal. Selecciona otra con stock.</span>
                </div>
              )}
            </div>
          )}

          {/* SELECTOR ERGONÓMICO DE CANTIDAD */}
          <div className="space-y-2 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-blue-900 tracking-wider">
                Cantidad a Facturar
              </label>
              {!isService && (
                <span className="text-xs font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                  Máx: {maxStock} uds.
                </span>
              )}
            </div>

            {/* CONTROL TOUCH DE CANTIDAD */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={qty <= 1}
                className="w-12 h-12 rounded-2xl bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white flex items-center justify-center shadow-xs transition-all active:scale-95"
              >
                <Minus size={20} />
              </button>

              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max={!isService ? maxStock : undefined}
                  value={qty}
                  onChange={handleQtyInput}
                  className="w-28 h-12 text-center text-2xl font-black text-blue-950 bg-white border-2 border-blue-300 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-inner"
                />
              </div>

              <button
                type="button"
                onClick={handleIncrement}
                disabled={!isService && qty >= maxStock}
                className="w-12 h-12 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200 transition-all active:scale-95"
              >
                <Plus size={20} />
              </button>
            </div>

            {/* BOTONES RÁPIDOS DE CANTIDAD */}
            <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
              {[1, 2, 5, 10].map(n => {
                if (!isService && n > maxStock) return null;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQty(n)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      qty === n 
                        ? 'bg-blue-600 text-white shadow-xs' 
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
              {!isService && maxStock > 0 && maxStock > 1 && (
                <button
                  type="button"
                  onClick={() => setQty(maxStock)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    qty === maxStock 
                      ? 'bg-amber-600 text-white shadow-xs' 
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  Todo ({maxStock})
                </button>
              )}
            </div>
          </div>

          {/* DESCUENTO (OPCIONAL O REGLAS VIP) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-gray-600">
                Descuento
              </label>
              {isMostrador && (
                <span className="text-[11px] text-gray-400">
                  Manual para mostrador
                </span>
              )}
            </div>

            {isMostrador ? (
              <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-2xl border border-gray-200">
                <div className="flex-1 flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-400">
                  <input
                    type="number"
                    min="0"
                    step={discountMode === '%' ? "1" : "5"}
                    value={discountVal}
                    onChange={(e) => setDiscountVal(e.target.value)}
                    placeholder="0"
                    className="w-full p-2 text-center text-sm font-bold text-red-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setDiscountMode(prev => prev === '%' ? 'C$' : '%')}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border-l font-black text-xs flex items-center gap-1"
                    title="Alternar entre % y C$"
                  >
                    <span>{discountMode}</span>
                    <RefreshCw size={11} className="text-gray-500" />
                  </button>
                </div>
                <div className="text-right text-xs text-gray-500 shrink-0 font-medium">
                  {discountMode === '%' ? `≈ C$ ${effectiveDiscount.toFixed(2)}` : `≈ ${effectivePercent.toFixed(1)}%`}
                </div>
              </div>
            ) : hasPrivilegios ? (
              descuentoEval?.aplica ? (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900 font-bold">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-600" />
                    <span>Descuento VIP {clienteActualObj?.descuento_fijo}% autorizado</span>
                    <Lock size={12} className="text-amber-500" />
                  </div>
                  <span className="text-amber-800 font-black">- C$ {effectiveDiscount.toFixed(2)}</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-500 flex items-center justify-between">
                  <span>Pago en {metodoPago} no aplica para descuento VIP</span>
                  <span className="font-bold">C$ 0.00</span>
                </div>
              )
            ) : (
              <div className="p-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-400 flex items-center justify-between">
                <span>Cliente regular sin autorización de descuento</span>
                <span className="font-bold">C$ 0.00</span>
              </div>
            )}
          </div>

          {/* DESGLOSE FINAL DEL ARTÍCULO */}
          <div className="bg-gray-900 text-white p-4 rounded-2xl space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Subtotal ({qty} {qty === 1 ? 'unidad' : 'unidades'}):</span>
              <span className="font-semibold text-gray-200">C$ {subtotalBruto.toFixed(2)}</span>
            </div>

            {effectiveDiscount > 0 && (
              <div className="flex justify-between text-xs text-red-400 font-bold">
                <span>Descuento aplicado:</span>
                <span>- C$ {effectiveDiscount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-gray-800">
              <span className="text-sm font-black text-gray-300 uppercase">Total a Cobrar:</span>
              <span className="text-2xl font-black text-green-400">
                C$ {subtotalNeto.toFixed(2)}
              </span>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div className="flex gap-3 pt-1 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isService && maxStock <= 0}
              className="flex-2 py-3 px-6 rounded-2xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-green-100 transition-all active:scale-95"
            >
              <Check size={18} />
              {isEditing ? 'Actualizar Artículo' : 'Agregar a la Factura'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
