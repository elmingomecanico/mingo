import React from 'react';
import { X, ExternalLink, Package } from 'lucide-react';

export default function ImagePreviewModal({ isOpen, onClose, product }) {
  if (!isOpen || !product) return null;

  const imageUrl = product.image || product.imagen_url || product.imagen || (typeof product === 'string' ? product : '');
  const productName = product.name || product.nombre || 'Foto del Producto';
  const productId = product.id || '';
  const productPrice = product.price || product.precio || 0;
  const productCategory = product.cat || product.categoria || '';

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-gray-900 text-white flex justify-between items-center border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Package className="text-blue-400" size={18} />
            <div>
              <h3 className="font-bold text-sm truncate max-w-[280px]">{productName}</h3>
              {productId && <span className="text-[11px] font-mono text-gray-400">{productId}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 text-xl font-bold leading-none"
          >
            &times;
          </button>
        </div>

        {/* Imagen */}
        <div className="bg-black/95 flex items-center justify-center p-4 min-h-[300px] max-h-[70vh]">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={productName} 
              className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-lg border border-white/10"
            />
          ) : (
            <div className="text-center p-8 text-gray-500">
              <Package size={48} className="mx-auto mb-2 text-gray-600" />
              <p className="text-sm font-semibold">Sin imagen registrada</p>
            </div>
          )}
        </div>

        {/* Footer con información del producto */}
        <div className="p-4 bg-gray-50 flex items-center justify-between border-t border-gray-100">
          <div>
            {productCategory && (
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">
                {productCategory}
              </span>
            )}
            <strong className="text-lg font-black text-blue-700">
              C$ {Number(productPrice).toFixed(2)}
            </strong>
          </div>

          <div className="flex gap-2">
            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                download={`producto_${productId || 'foto'}.jpg`}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
                title="Abrir imagen completa en pestaña nueva"
              >
                <ExternalLink size={14} /> Abrir
              </a>
            )}
            <button
              onClick={onClose}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
