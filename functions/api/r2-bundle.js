/**
 * Cloudflare Pages Function: /api/r2-bundle
 * Proxy seguro para descargar paquetes de fotos desde Cloudflare R2 sin bloqueos de CORS.
 */

const R2_PUBLIC_DOMAIN = 'https://pub-b021436fa28941d3851a35e721679ab8.r2.dev';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
  'Access-Control-Max-Age': '86400'
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function onRequestGet(context) {
  try {
    const urlObj = new URL(context.request.url);
    const targetUrl = urlObj.searchParams.get('url');
    const targetKey = urlObj.searchParams.get('key');

    let fullUrl = '';
    if (targetKey) {
      const cleanKey = targetKey.replace(/^\/+/, '');
      fullUrl = `${R2_PUBLIC_DOMAIN}/${cleanKey}`;
    } else if (targetUrl) {
      fullUrl = targetUrl;
    } else {
      return new Response(JSON.stringify({ error: 'Parámetro "url" o "key" requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Agregar cache-busting para siempre obtener la versión más reciente del paquete
    const fetchUrl = fullUrl.includes('?') 
      ? `${fullUrl}&_t=${Date.now()}` 
      : `${fullUrl}?_t=${Date.now()}`;

    const r2Res = await fetch(fetchUrl);

    if (!r2Res.ok) {
      return new Response(JSON.stringify({ error: `R2 respondió con status ${r2Res.status}` }), {
        status: r2Res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await r2Res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
