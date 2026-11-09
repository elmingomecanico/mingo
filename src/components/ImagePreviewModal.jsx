import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Package, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { fetchProductBundle } from '../utils/storageService';

export default function ImagePreviewModal({ isOpen, onClose, product }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [galleryImages, setGalleryImages] = useState([]);
  const [loadingBundle, setLoadingBundle] = useState(false);

  const initialCover = product?.image || product?.imagen_url || product?.image_url || (typeof product === 'string' ? product : '');
  const productName = product?.name || product?.nombre || 'Foto del Producto';
  const productId = product?.id || '';
  const productPrice = product?.price || product?.precio || 0;
  const productCategory = product?.cat || product?.categoria || '';

  useEffect(() => {
    setActiveIdx(0);
    if (!product) {
      setGalleryImages([]);
      return;
    }

    // Si ya viene con array de imágenes en memoria
    if (Array.isArray(product.images) && product.images.length > 0) {
      setGalleryImages(product.images);
      return;
    }

    // Si tiene bundle_url en Cloudflare R2, hacer 1 sola lectura Tipo B para traer el paquete de hasta 4 fotos
    if (product.bundle_url) {
      setLoadingBundle(true);
      fetchProductBundle(product.bundle_url)
        .then(imgs => {
          if (imgs && imgs.length > 0) {
            setGalleryImages(imgs);
          } else if (initialCover) {
            setGalleryImages([initialCover]);
          }
        })
        .finally(() => setLoadingBundle(false));
    } else if (initialCover) {
      setGalleryImages([initialCover]);
    } else {
      setGalleryImages([]);
    }
  }, [product, initialCover]);

  if (!isOpen || !product) return null;

  const currentDisplayImage = galleryImages[activeIdx] || initialCover;

  const handlePrev = (e) => {
    e.stopPropagation();
    setActiveIdx(prev => (prev > 0 ? prev - 1 : galleryImages.length - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setActiveIdx(prev => (prev < galleryImages.length - 1 ? prev + 1 : 0));
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-gray-900 text-white flex justify-between items-center border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <Package className="text-blue-400" size={18} />
            <div>
              <h3 className="font-bold text-sm truncate max-w-[280px]">{productName}</h3>
              <div className="flex items-center gap-2">
                {productId && <span className="text-[11px] font-mono text-gray-400">{productId}</span>}
                {galleryImages.length > 1 && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Layers size={10} /> Foto {activeIdx + 1} de {galleryImages.length} (Paquete R2)
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10 text-xl font-bold leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Visor Principal con Flechas */}
        <div className="bg-black/95 relative flex items-center justify-center p-4 min-h-[260px] overflow-hidden flex-1 group">
          {currentDisplayImage ? (
            <img 
              src={currentDisplayImage} 
              alt={`${productName} - Vista ${activeIdx + 1}`} 
              className="max-w-full max-h-[50vh] object-contain rounded-xl shadow-lg border border-white/10 transition-all duration-200"
            />
          ) : (
            <div className="text-center p-8 text-gray-500">
              <Package size={48} className="mx-auto mb-2 text-gray-600" />
              <p className="text-sm font-semibold">Sin imagen registrada</p>
            </div>
          )}

          {/* Flechas de Navegación si hay más de 1 foto */}
          {galleryImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center border border-white/20 transition-all opacity-80 hover:opacity-100 cursor-pointer"
                title="Foto anterior"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center border border-white/20 transition-all opacity-80 hover:opacity-100 cursor-pointer"
                title="Foto siguiente"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {loadingBundle && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Cargando paquete de fotos...
            </div>
          )}
        </div>

        {/* Tira de Miniaturas del Paquete (Hasta 4 fotos) */}
        {galleryImages.length > 1 && (
          <div className="p-2.5 bg-gray-900 border-t border-gray-800 flex justify-center gap-2 overflow-x-auto shrink-0">
            {galleryImages.map((imgSrc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  activeIdx === idx 
                    ? 'border-blue-500 scale-105 shadow-md shadow-blue-500/30' 
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 bg-black/70 text-[9px] text-white px-1 font-mono font-bold">
                  {idx + 1}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Footer con información del producto */}
        <div className="p-3 sm:p-4 bg-gray-50 flex items-center justify-between border-t border-gray-100 shrink-0">
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
            {currentDisplayImage && (
              <a
                href={currentDisplayImage}
                target="_blank"
                rel="noreferrer"
                download={`producto_${productId || 'foto'}_${activeIdx + 1}.webp`}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Abrir imagen completa"
              >
                <ExternalLink size={14} /> Abrir
              </a>
            )}
            <button
              onClick={onClose}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
