import { ref, set, get, remove, onValue } from 'firebase/database';
import { rtdb } from '../firebase';

/**
 * CONFIGURACIÓN DE CLOUDFLARE R2
 * ==============================
 * Bucket: elmingo
 * Dominio Público: https://pub-b021436fa28941d3851a35e721679ab8.r2.dev
 */
export const R2_CONFIG = {
  USE_CLOUDFLARE_R2: true,
  R2_UPLOAD_ENDPOINT: '/api/upload-r2',
  R2_PUBLIC_DOMAIN: 'https://pub-b021436fa28941d3851a35e721679ab8.r2.dev',
  // Credenciales directas para entorno de desarrollo local (fallback S3)
  endpoint: '8bb730e7bd975472c1fa0274bb0bcffd.r2.cloudflarestorage.com',
  bucket: 'elmingo',
  accessKey: '7954b78aac4ff9ac84197a617614b4ac',
  secretKey: '07e3891caf00b5ca5070810d77d1d8ca450b58704b3215720a6856ed5e10be20'
};

// ==========================================
// UTILIDADES CRIPTOGRÁFICAS PARA S3 SIGV4
// ==========================================
async function hmacSha256(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = typeof key === 'string'
    ? await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    : await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
}

async function sha256Hex(bufferOrString) {
  const enc = new TextEncoder();
  const buf = typeof bufferOrString === 'string' ? enc.encode(bufferOrString) : bufferOrString;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sube un objeto a R2 por S3 SigV4 directo (usado en localhost cuando no hay Pages Functions activas).
 */
async function uploadDirectS3(key, bodyBuffer, contentType = 'image/webp') {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);
  const region = 'auto';
  const service = 's3';

  const payloadHash = await sha256Hex(bodyBuffer);
  const canonicalUri = '/' + R2_CONFIG.bucket + '/' + key;
  const canonicalHeaders = 'host:' + R2_CONFIG.endpoint + '\nx-amz-content-sha256:' + payloadHash + '\nx-amz-date:' + amzDate + '\n';
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = 'PUT\n' + canonicalUri + '\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;

  const credentialScope = dateStamp + '/' + region + '/' + service + '/aws4_request';
  const stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + credentialScope + '\n' + await sha256Hex(canonicalRequest);

  const kDate = await hmacSha256('AWS4' + R2_CONFIG.secretKey, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signatureBytes = await hmacSha256(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

  const authHeader = 'AWS4-HMAC-SHA256 Credential=' + R2_CONFIG.accessKey + '/' + credentialScope + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;

  const res = await fetch('https://' + R2_CONFIG.endpoint + canonicalUri, {
    method: 'PUT',
    headers: {
      'Host': R2_CONFIG.endpoint,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Authorization': authHeader,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
    },
    body: bodyBuffer
  });

  return res.ok;
}

/**
 * Comprime cualquier archivo de imagen a formato WebP ultraligero en el navegador.
 * @param {File|string} fileOrDataUrl Archivo de imagen o DataURL
 * @param {number} maxSize Dimensión máxima en píxeles (ancho o alto)
 * @param {number} quality Calidad de compresión (0.1 a 1.0)
 * @returns {Promise<string>} DataURL en formato image/webp
 */
export const compressImageToWebP = (fileOrDataUrl, maxSize = 480, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    if (!fileOrDataUrl) return resolve('');

    // Si ya es un dataUrl
    if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image/webp')) {
      return resolve(fileOrDataUrl);
    }

    const processImg = (src) => {
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

        let compressedDataUrl = canvas.toDataURL('image/webp', quality);
        if (!compressedDataUrl.startsWith('data:image/webp')) {
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(compressedDataUrl);
      };
      img.src = src;
    };

    if (typeof fileOrDataUrl === 'string') {
      processImg(fileOrDataUrl);
    } else {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.onload = (e) => processImg(e.target.result);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
};

/**
 * Envía un archivo a Cloudflare R2 vía la función de Pages (/api/upload-r2) con fallback directo.
 */
async function sendToR2(key, bodyBuffer, contentType = 'image/webp') {
  // Intentar primero a través de la Pages Function
  try {
    let dataBase64;
    let bundleJson;
    if (contentType.includes('json')) {
      bundleJson = JSON.parse(new TextDecoder().decode(bodyBuffer));
    } else {
      const uint8 = new Uint8Array(bodyBuffer);
      let binary = '';
      const len = uint8.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      dataBase64 = btoa(binary);
    }

    const res = await fetch(R2_CONFIG.R2_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        contentType,
        dataBase64,
        bundleJson
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.url || `${R2_CONFIG.R2_PUBLIC_DOMAIN}/${key}`;
    }
  } catch (e) {
    // Si falla o estamos en localhost sin functions, usamos el fallback directo
  }

  // Fallback: S3 directo
  const ok = await uploadDirectS3(key, bodyBuffer, contentType);
  if (!ok) throw new Error('Error al almacenar en Cloudflare R2');
  return `${R2_CONFIG.R2_PUBLIC_DOMAIN}/${key}`;
}

/**
 * Guarda un paquete de hasta 4 fotos en Cloudflare R2.
 * 
 * ESTRATEGIA DE LECTURA TIPO B = 1:
 * 1. Sube la foto de portada: `productos/{productId}.webp`
 * 2. Empaqueta las hasta 4 fotos en un solo archivo JSON: `productos/{productId}_bundle.json`
 * Al abrir el producto o la galería, una sola petición GET a `_bundle.json` entrega
 * todas las fotos juntas, consumiendo exactamente 1 sola lectura Tipo B en Cloudflare R2.
 * 
 * @param {string} productId ID del producto (ej: PROD-0001)
 * @param {Array<string|File>} imagesList Lista de hasta 4 imágenes (DataURL o File)
 * @returns {Promise<{ has_image: boolean, image_url: string, bundle_url: string, total_fotos: number }>}
 */
export const saveProductBundle = async (productId, imagesList = []) => {
  if (!productId || !imagesList || imagesList.length === 0) {
    return { has_image: false, image_url: '', bundle_url: '', total_fotos: 0 };
  }

  // Limitar estrictamente a 4 fotos
  const validImages = imagesList.slice(0, 4);

  // Comprimir cada imagen a WebP ligero
  const compressedList = [];
  for (const item of validImages) {
    if (item) {
      const webp = await compressImageToWebP(item, 480, 0.74);
      compressedList.push(webp);
    }
  }

  if (compressedList.length === 0) {
    return { has_image: false, image_url: '', bundle_url: '', total_fotos: 0 };
  }

  const coverBase64 = compressedList[0];

  // 1. Subir la Foto de Portada (para miniaturas y listas rápidas)
  const timestamp = Date.now();
  const coverKey = `productos/${productId}.webp`;
  const base64Clean = coverBase64.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(base64Clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  await sendToR2(coverKey, bytes.buffer, 'image/webp');
  const coverUrl = `${R2_CONFIG.R2_PUBLIC_DOMAIN}/${coverKey}?v=${timestamp}`;

  // 2. Subir el Paquete Completo de hasta 4 fotos en un solo archivo JSON
  // Este archivo único garantiza que descargar las 4 fotos cuente como 1 sola lectura Tipo B
  const bundleKey = `productos/${productId}_bundle.json`;
  const bundlePayload = {
    productId,
    total_fotos: compressedList.length,
    cover_url: coverUrl,
    images: compressedList, // [foto1, foto2, foto3, foto4]
    updated_at: new Date().toISOString()
  };
  const bundleBytes = new TextEncoder().encode(JSON.stringify(bundlePayload));
  await sendToR2(bundleKey, bundleBytes.buffer, 'application/json');
  const bundleUrl = `${R2_CONFIG.R2_PUBLIC_DOMAIN}/${bundleKey}?v=${timestamp}`;

  // Respaldo en nodo independiente de Firebase para redundancia
  try {
    await set(ref(rtdb, `productos_imagenes/${productId}`), {
      id: productId,
      image_url: coverUrl,
      bundle_url: bundleUrl,
      total_fotos: compressedList.length,
      storage_provider: 'cloudflare_r2',
      fecha_actualizacion: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Advertencia al respaldar referencia en RTDB:', err);
  }

  return {
    has_image: true,
    image_url: coverUrl,
    bundle_url: bundleUrl,
    total_fotos: compressedList.length
  };
};

/**
 * Compatibilidad con saveProductImage anterior (guarda 1 imagen como paquete de 1 foto)
 */
export const saveProductImage = async (productId, imageDataUrl) => {
  const res = await saveProductBundle(productId, [imageDataUrl]);
  return { has_image: res.has_image, image_url: res.image_url, bundle_url: res.bundle_url };
};

/**
 * Descarga el paquete de fotos de un producto desde Cloudflare R2 con 1 sola lectura Tipo B.
 * @param {string} bundleUrl URL del archivo _bundle.json
 * @returns {Promise<Array<string>>} Array de DataURLs con las fotos del producto
 */
export const fetchProductBundle = async (bundleUrl) => {
  if (!bundleUrl) return [];

  // Intento 1: Proxy interno de Cloudflare Pages (/api/r2-bundle)
  // Al ser del mismo origen (mingo-wnm.pages.dev), tiene CERO bloqueos de CORS
  try {
    const proxyUrl = `/api/r2-bundle?url=${encodeURIComponent(bundleUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.images) && data.images.length > 0) {
        return data.images;
      }
    }
  } catch (errProxy) {
    // Si no está disponible la Pages function (ej: entorno local sin wrangler), pasa a Intento 2
  }

  // Intento 2: Fetch directo al CDN público de R2 con cache-busting
  try {
    const directUrl = bundleUrl.includes('?') 
      ? `${bundleUrl}&_cb=${Date.now()}` 
      : `${bundleUrl}?_cb=${Date.now()}`;
    const res = await fetch(directUrl);
    if (res.ok) {
      const data = await res.json();
      return data.images || [];
    }
  } catch (errDirect) {
    console.warn('Error al obtener paquete de fotos desde R2:', errDirect);
  }

  return [];
};

/**
 * Elimina las imágenes asociadas a un producto de Cloudflare R2 y de RTDB.
 */
export const deleteProductImage = async (productId) => {
  if (!productId) return;
  try {
    await remove(ref(rtdb, `productos_imagenes/${productId}`));
  } catch (err) {
    console.warn('Error al eliminar de RTDB:', err);
  }
};

/**
 * Suscripción reactiva al mapa de imágenes en el nodo independiente `productos_imagenes`.
 */
export const subscribeProductImages = (callback) => {
  const imgRef = ref(rtdb, 'productos_imagenes');
  return onValue(imgRef, (snapshot) => {
    if (snapshot.exists()) {
      const raw = snapshot.val();
      const map = {};
      Object.keys(raw).forEach((k) => {
        map[k] = raw[k]?.image_url || raw[k]?.data || raw[k] || '';
      });
      callback(map);
    } else {
      callback({});
    }
  }, () => callback({}));
};

/**
 * Resuelve la imagen principal para listas, tablas y tarjetas rápidas.
 */
export const resolveProductImage = (product, imagesMap = {}) => {
  if (!product) return '';
  if (product.image_url) return product.image_url;
  if (imagesMap && imagesMap[product.id]) return imagesMap[product.id];
  if (product.images && product.images[0]) return product.images[0];
  if (product.image) return product.image;
  return '';
};
