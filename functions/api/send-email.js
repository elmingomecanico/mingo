/**
 * Cloudflare Pages Function: /api/send-email
 * Envía notificaciones por correo electrónico del ERP Taller El Mingo
 * usando Google Apps Script (gratis vía Gmail), Resend o Brevo.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const to = (body.to || env.NOTIFICATION_EMAIL || 'elmingomecanico@gmail.com').trim();
    const subject = (body.subject || 'Notificación ERP Taller El Mingo').trim();
    const html = body.html || `<p>${body.text || 'Movimiento registrado en el sistema ERP.'}</p>`;
    const text = body.text || subject;
    const fromName = (body.fromName || 'ERP Taller El Mingo').trim();

    const provider = body.provider || '';
    const webhookUrl = (body.webhookUrl || env.APPS_SCRIPT_EMAIL_URL || '').trim();
    const resendKey = (
      (provider === 'resend' ? body.apiKey : '') ||
      (body.apiKey && body.apiKey.startsWith('re_') ? body.apiKey : '') ||
      env.RESEND_API_KEY ||
      ''
    ).trim();
    const brevoKey = (
      (provider === 'brevo' ? body.apiKey : '') ||
      (body.apiKey && body.apiKey.startsWith('xkeysib-') ? body.apiKey : '') ||
      env.BREVO_API_KEY ||
      ''
    ).trim();

    // 1. Google Apps Script Webhook (100% gratis directo desde la cuenta Gmail)
    if ((provider === 'apps_script' || (!resendKey && !brevoKey)) && webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html, text, fromName }),
        redirect: 'follow'
      });

      const resText = await res.text();
      if (!res.ok) {
        return new Response(
          JSON.stringify({ ok: false, provider: 'apps_script', message: `Apps Script respondió HTTP ${res.status}: ${resText.slice(0, 200)}` }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, provider: 'apps_script', message: `Correo enviado a ${to} vía Google Apps Script.` }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 2. Resend API (3,000 correos/mes gratis)
    if (resendKey) {
      const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject,
          html,
          text
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return new Response(
          JSON.stringify({ ok: false, provider: 'resend', message: data?.message || `Error Resend HTTP ${res.status}` }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, provider: 'resend', id: data.id, message: `Correo enviado a ${to} vía Resend.` }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 3. Brevo API (300 correos/día gratis)
    if (brevoKey) {
      const senderEmail = env.BREVO_SENDER_EMAIL || to;
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: fromName, email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return new Response(
          JSON.stringify({ ok: false, provider: 'brevo', message: data?.message || `Error Brevo HTTP ${res.status}` }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, provider: 'brevo', id: data.messageId, message: `Correo enviado a ${to} vía Brevo.` }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // Sin proveedor configurado todavía
    return new Response(
      JSON.stringify({
        ok: false,
        pendingConfig: true,
        message: 'No hay un proveedor de correo configurado todavía. Configure Google Apps Script (Gmail), Resend o Brevo en Configuración del Sistema → Notificaciones Email.'
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, message: err?.message || 'Error interno al enviar correo.' }),
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
