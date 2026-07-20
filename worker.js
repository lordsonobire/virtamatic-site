// Virtamatic site Worker: serves static assets, POST /api/lead -> Telegram ping.
// Secrets (set via `npx wrangler secret put ...`): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const field = (v, max = 500) => String(v ?? '').trim().slice(0, max);

async function handleLead(request, env) {
  const json = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  let data;
  try {
    if ((request.headers.get('content-length') || 0) > 4096) {
      return json(413, { ok: false });
    }
    data = await request.json();
  } catch {
    return json(400, { ok: false });
  }

  // Honeypot: bots fill every input; humans never see this one.
  if (field(data.website)) return json(200, { ok: true });

  const name = field(data.name, 120);
  const business = field(data.business, 120);
  const contact = field(data.contact, 200);
  const type = field(data.type, 60);
  const msg = field(data.msg, 1500);
  if (!name || !contact) return json(400, { ok: false });

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return json(503, { ok: false });
  }

  const text = [
    '⚡ <b>New Virtamatic lead</b>',
    `<b>Name:</b> ${esc(name)}`,
    `<b>Business:</b> ${esc(business) || '—'}`,
    `<b>Contact:</b> ${esc(contact)}`,
    `<b>Type:</b> ${esc(type) || '—'}`,
    msg ? `<b>Wants to automate:</b>\n${esc(msg)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const tg = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    }
  );
  if (!tg.ok) return json(502, { ok: false });
  return json(200, { ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/lead' && request.method === 'POST') {
      return handleLead(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
