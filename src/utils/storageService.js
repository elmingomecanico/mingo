import { ref, set, get, remove, onValue } from 'firebase/database';
import { rtdb } from '../firebase';

/**
 * CONFIGURACIÓN PREPARADA PARA CLOUDFLARE R2
 * ==========================================
 * Mientras Cloudflare R2 no esté activo, las imágenes se comprimen a formato WebP ligero
 * y se almacenan en el nodo independiente `productos_imagenes/{id_producto}` de Firebase RTDB.
 * De esta manera, el catálogo principal `productos` se mantiene ultraligero en memoria y red.
 *
 * Cuando actives Cloudflare R2:
 * 1. Cambia `USE_CLOUDFLARE_R2 = true`
 * 2. Coloca la URL de tu Worker / API de subida en `R2_UPLOAD_ENDPOINT` y el dominio público en `R2_PUBLIC_DOMAIN`.
 */
export const R2_CONFIG = {
  USE_CLOUDFLARE_R2: false,
  R2_UPLOAD_ENDPOINT: import.meta.env.VITE_R2_UPLOAD_URL || '',
  R2_PUBLIC_DOMAIN: import.meta.env.VITE_R2_PUBLIC_URL || ''
};

/**
 * Comprime cualquier archivo de imagen a formato WebP ultraligero en el navegador.
 * @param {File} file Archivo de imagen original
 * @param {number} maxSize Dimensión máxima en píxeles (ancho o alto)
 * @param {number} quality Calidad de compresión (0.1 a 1.0)
 * @returns {Promise<string>} DataURL en formato image/webp (o image/jpeg como fallback)
 */
export const compressImageToWebP = (file, maxSize = 420, quality = 0.72) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen inválido'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Intentar codificar en WebP nativo; si el navegador no lo soporta, cae a JPEG
        let compressedDataUrl = canvas.toDataURL('image/webp', quality);
        if (!compressedDataUrl.startsWith('data:image/webp')) {
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(compressedDataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Guarda la imagen de un producto en el nodo independiente `productos_imagenes/{productId}`
 * o la sube a Cloudflare R2 cuando esté habilitado.
 * @param {string} productId UUID del producto
 * @param {string} imageDataUrl Imagen comprimida en WebP (DataURL) o URL externa
 * @returns {Promise<{ has_image: boolean, image_url: string }>}
 */
export const saveProductImage = async (productId, imageDataUrl) => {
  if (!productId || !imageDataUrl) {
    return { has_image: false, image_url: '' };
  }

  // Si ya es una URL HTTP externa (ej. Cloudflare R2), solo retornarla
  if (imageDataUrl.startsWith('http://') || imageDataUrl.startsWith('https://')) {
    return { has_image: true, image_url: imageDataUrl };
  }

  // MODO CLOUDFLARE R2 (Listo para activar)
  if (R2_CONFIG.USE_CLOUDFLARE_R2 && R2_CONFIG.R2_UPLOAD_ENDPOINT) {
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();
    const formData = new FormData();
    formData.append('file', blob, `${productId}.webp`);
    formData.append('productId', productId);

    const uploadRes = await fetch(R2_CONFIG.R2_UPLOAD_ENDPOINT, {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) {
      throw new Error('Error al subir imagen a Cloudflare R2');
    }
    const data = await uploadRes.json();
    const publicUrl = data.url || `${R2_CONFIG.R2_PUBLIC_DOMAIN}/${productId}.webp`;
    return { has_image: true, image_url: publicUrl };
  }

  // MODO NODO INDEPENDIENTE RTDB (WebP comprimido fuera del árbol de productos)
  await set(ref(rtdb, `productos_imagenes/${productId}`), {
    id: productId,
    data: imageDataUrl,
    formato: 'webp',
    storage_provider: 'rtdb_independent_node',
    fecha_actualizacion: new Date().toISOString()
  });

  return { has_image: true, image_url: '' };
};

/**
 * Elimina la imagen asociada a un producto del nodo independiente (o de Cloudflare R2).
 * @param {string} productId UUID del producto
 */
export const deleteProductImage = async (productId) => {
  if (!productId) return;
  try {
    await remove(ref(rtdb, `productos_imagenes/${productId}`));
  } catch (err) {
    console.error('Error al eliminar imagen de producto:', err);
  }
};

/**
 * Suscripción reactiva al mapa de imágenes en el nodo independiente `productos_imagenes`.
 * @param {Function} callback Recibe un objeto `{ [productId]: dataUrl }`
 * @returns {Function} Función para cancelar la suscripción
 */
export const subscribeProductImages = (callback) => {
  const imgRef = ref(rtdb, 'productos_imagenes');
  return onValue(imgRef, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.val();
      const map = {};
      Object.keys(raw).forEach((k) => {
        map[k] = typeof raw[k] === 'string' ? raw[k] : (raw[k]?.data || '');
      });
      callback(map);
    } else {
      callback({});
    }
  });
};

/**
 * Obtiene la imagen de un producto resolviendo en orden de prioridad:
 * 1. URL de Cloudflare R2 (`product.image_url`)
 * 2. Nodo independiente WebP (`imagesMap[product.id]`)
 * 3. Propiedad heredada `product.image` (compatibilidad con productos anteriores)
 */
export const resolveProductImage = (product, imagesMap = {}) => {
  if (!product) return '';
  if (product.image_url) return product.image_url;
  if (imagesMap && imagesMap[product.id]) return imagesMap[product.id];
  if (product.image) return product.image;
  return '';
};
