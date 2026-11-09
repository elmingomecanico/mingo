/**
 * Cloudflare Pages Function: /api/upload-r2
 * Sube archivos y paquetes de fotos directamente al bucket R2 "elmingo".
 */

const R2_CONFIG = {
  endpoint: '8bb730e7bd975472c1fa0274bb0bcffd.r2.cloudflarestorage.com',
  bucket: 'elmingo',
  accessKey: '7954b78aac4ff9ac84197a617614b4ac',
  secretKey: '07e3891caf00b5ca5070810d77d1d8ca450b58704b3215720a6856ed5e10be20',
  publicDomain: 'https://pub-b021436fa28941d3851a35e721679ab8.r2.dev'
};

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

async function uploadToR2(key, bodyBuffer, contentType = 'image/webp') {
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
      'Cache-Control': 'public, max-age=31536000, immutable'
    },
    body: bodyBuffer
  });

  return res.ok;
}

export async function onRequestPost({ request }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  try {
    const contentTypeHeader = request.headers.get('content-type') || '';
    let key = '';
    let contentType = 'image/webp';
    let bodyBuffer;

    if (contentTypeHeader.includes('application/json')) {
      const json = await request.json();
      key = json.key;
      contentType = json.contentType || 'application/json';

      if (json.dataBase64) {
        // Base64 a ArrayBuffer
        const base64Data = json.dataBase64.replace(/^data:image\/\w+;base64,/, '');
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        bodyBuffer = bytes.buffer;
      } else if (json.bundleJson) {
        // Objeto JSON empaquetado directo
        const str = JSON.stringify(json.bundleJson);
        bodyBuffer = new TextEncoder().encode(str);
        contentType = 'application/json';
      } else {
        return new Response(JSON.stringify({ error: 'Faltan datos de imagen o paquete' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Multipart FormData
      const formData = await request.formData();
      const file = formData.get('file');
      key = formData.get('key') || `productos/${Date.now()}.webp`;
      if (!file) {
        return new Response(JSON.stringify({ error: 'No se envió ningún archivo' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      contentType = file.type || 'image/webp';
      bodyBuffer = await file.arrayBuffer();
    }

    if (!key) {
      return new Response(JSON.stringify({ error: 'Parámetro key requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const success = await uploadToR2(key, bodyBuffer, contentType);

    if (!success) {
      return new Response(JSON.stringify({ error: 'Fallo al almacenar en Cloudflare R2' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const publicUrl = `${R2_CONFIG.publicDomain}/${key}`;

    return new Response(JSON.stringify({
      success: true,
      key,
      url: publicUrl,
      cachedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function onRequestGet() {
  return new Response(JSON.stringify({
    status: 'online',
    provider: 'Cloudflare R2',
    bucket: R2_CONFIG.bucket,
    publicDomain: R2_CONFIG.publicDomain
  }), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    }
  });
}
