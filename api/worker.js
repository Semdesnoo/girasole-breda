// Girasole API: reservations in, menu + seasonal actions out, admin behind one PIN.
// Public:  GET /api/site, POST /api/reserveringen
// Admin (Authorization: Bearer <PIN>): GET /api/reserveringen, PATCH /api/reserveringen/:id,
//   PUT /api/menu, PUT /api/acties, GET /api/check

const CATS = ['voor', 'pasta', 'hoofd', 'pizza'];
const STATUS = ['nieuw', 'bevestigd', 'afgewezen'];

const json = (data, status, cors) => new Response(JSON.stringify(data), {
  status: status || 200,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors },
});

function corsFor(req, env) {
  const o = req.headers.get('origin') || '';
  const ok = (env.ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ok.includes(o)) return {};
  return { 'access-control-allow-origin': o, 'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, OPTIONS', vary: 'origin' };
}

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const str = (v, max) => (typeof v === 'string' ? v.trim() : '').slice(0, max);

async function hits(env, ip, kind, minutes) {
  const r = await env.DB.prepare("SELECT COUNT(*) n FROM pogingen WHERE ip=? AND soort=? AND ts > datetime('now', ?)")
    .bind(ip, kind, `-${minutes} minutes`).first();
  return r.n;
}
const hit = (env, ip, kind) => env.DB.prepare('INSERT INTO pogingen (ip, soort) VALUES (?, ?)').bind(ip, kind).run();

async function same(a, b) { // constant-time compare via hashes
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}

async function isAdmin(req, env, ip) {
  if (!env.PIN || env.PIN.length < 6) return 'PIN niet ingesteld';
  if (await hits(env, ip, 'pin', 15) >= 8) return 'Te veel pogingen. Probeer het over 15 minuten opnieuw.';
  const given = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (await same(given, env.PIN)) return null;
  await hit(env, ip, 'pin');
  return 'Onjuiste pincode';
}

// returns an error message, or null when the booking is valid
export function checkBooking(b, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.dag || '')) return 'Ongeldige datum';
  const d = new Date(b.dag + 'T12:00:00Z'), max = new Date(now + 'T12:00:00Z');
  max.setUTCDate(max.getUTCDate() + 120);
  if (isNaN(d) || b.dag < now || d > max || d.getUTCDay() === 1) return 'Op deze datum kun je niet reserveren';
  const m = /^(\d{2}):(\d{2})$/.exec(b.tijd || '');
  const t = m ? +m[1] * 60 + +m[2] : -1;
  if (t < 17 * 60 || t > 20 * 60 || t % 15) return 'Ongeldige tijd';
  if (!Number.isInteger(b.personen) || b.personen < 1 || b.personen > 12) return 'Ongeldig aantal personen';
  if (b.naam.length < 2) return 'Vul je naam in';
  if (!/^[0-9+()\-\s]{6,20}$/.test(b.telefoon)) return 'Vul een geldig telefoonnummer in';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email)) return 'Vul een geldig e-mailadres in';
  return null;
}

async function mail(env, b) {
  if (!env.RESEND_KEY || !env.MAIL_TO) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rows = [['Datum', b.dag], ['Tijd', b.tijd], ['Personen', b.personen], ['Keuze', b.keuze], ['Naam', b.naam], ['Telefoon', b.telefoon], ['E-mail', b.email]];
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'Girasole <onboarding@resend.dev>', to: env.MAIL_TO.split(','), reply_to: b.email,
      subject: `Nieuwe reservering: ${b.personen}p op ${b.dag} om ${b.tijd}`,
      html: `<h2 style="font-family:Georgia,serif;color:#5B0A19">Nieuwe reservering</h2><table cellpadding="6">${rows.map(r => `<tr><td style="color:#876A6C">${r[0]}</td><td><b>${esc(r[1])}</b></td></tr>`).join('')}</table><p>Bevestig of wijs af in de Girasole-app.</p>`,
    }),
  }).catch(() => {});
}

const getSetting = async (env, k) => { const r = await env.DB.prepare('SELECT v FROM instellingen WHERE k=?').bind(k).first(); return r ? JSON.parse(r.v) : null; };
const putSetting = (env, k, v) => env.DB.prepare('INSERT INTO instellingen (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k, JSON.stringify(v)).run();

function cleanMenu(m) {
  if (!m || typeof m !== 'object') return null;
  const out = {};
  for (const c of CATS) {
    if (!Array.isArray(m[c]) || m[c].length > 60) return null;
    out[c] = m[c].map(d => [str(d && d[0], 80), str(d && d[1], 160), str(d && d[2], 12)]).filter(d => d[0]);
    if (out[c].some(d => !/^\d{1,3}(,\d{2})?$/.test(d[2]))) return null;
  }
  return out;
}

function cleanActies(a) {
  if (!Array.isArray(a) || a.length > 30) return null;
  const out = a.map(x => ({
    id: str(x && x.id, 40).replace(/[^a-z0-9-]/g, '') || 'actie-' + Math.random().toString(36).slice(2, 8),
    actief: !!(x && x.actief),
    van: /^\d{4}-\d{2}-\d{2}$/.test(x && x.van) ? x.van : '',
    tot: /^\d{4}-\d{2}-\d{2}$/.test(x && x.tot) ? x.tot : '',
    titel: (Array.isArray(x && x.titel) ? x.titel : []).slice(0, 2).map(t => str(t, 40)).filter(Boolean),
    tekst: str(x && x.tekst, 300),
    knop: str(x && x.knop, 40) || 'Reserveren',
    link: '#reserveren',
    afbeelding: /^media\/[a-z0-9-]+\.(webp|jpg)$/.test(x && x.afbeelding) ? x.afbeelding : 'media/interieur.webp',
    vertraging_ms: 1500,
  }));
  return out.every(x => x.titel.length) ? out : null;
}

export default {
  async fetch(req, env, ctx) {
    const cors = corsFor(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url), p = url.pathname, ip = req.headers.get('cf-connecting-ip') || 'local';
    try {
      if (p === '/api/site' && req.method === 'GET') {
        const [menu, acties] = await Promise.all([getSetting(env, 'menu'), getSetting(env, 'acties')]);
        return json({ menu, acties }, 200, cors);
      }

      if (p === '/api/reserveringen' && req.method === 'POST') {
        const raw = await req.json().catch(() => ({}));
        if (str(raw['bot-field'], 10)) return json({ ok: true }, 200, cors); // honeypot: pretend success
        if (await hits(env, ip, 'res', 10) >= 5) return json({ error: 'Even te veel aanvragen. Bel ons op 076 522 4437.' }, 429, cors);
        const b = { dag: str(raw.dag, 10), tijd: str(raw.tijd, 5), personen: parseInt(raw.personen, 10), keuze: str(raw.keuze, 60) || 'À la carte',
          naam: str(raw.naam, 80), telefoon: str(raw.telefoon, 20), email: str(raw.email, 120) };
        const err = checkBooking(b, today());
        if (err) return json({ error: err }, 400, cors);
        await hit(env, ip, 'res');
        const r = await env.DB.prepare('INSERT INTO reserveringen (dag, tijd, personen, keuze, naam, telefoon, email) VALUES (?,?,?,?,?,?,?) RETURNING id')
          .bind(b.dag, b.tijd, b.personen, b.keuze, b.naam, b.telefoon, b.email).first();
        ctx.waitUntil(mail(env, b));
        return json({ ok: true, id: r.id }, 201, cors);
      }

      if (!p.startsWith('/api/')) return json({ error: 'Niet gevonden' }, 404, cors);
      const denied = await isAdmin(req, env, ip);
      if (denied) return json({ error: denied }, 401, cors);

      if (p === '/api/check') return json({ ok: true }, 200, cors);
      if (p === '/api/reserveringen' && req.method === 'GET') {
        const { results } = await env.DB.prepare("SELECT * FROM reserveringen WHERE dag >= date('now', '-30 days') ORDER BY dag, tijd").all();
        return json(results, 200, cors);
      }
      const m = /^\/api\/reserveringen\/(\d+)$/.exec(p);
      if (m && req.method === 'PATCH') {
        const { status } = await req.json().catch(() => ({}));
        if (!STATUS.includes(status)) return json({ error: 'Ongeldige status' }, 400, cors);
        await env.DB.prepare('UPDATE reserveringen SET status=? WHERE id=?').bind(status, +m[1]).run();
        return json({ ok: true }, 200, cors);
      }
      if (p === '/api/menu' && req.method === 'PUT') {
        const menu = cleanMenu(await req.json().catch(() => null));
        if (!menu) return json({ error: 'Menu klopt niet. Controleer de prijzen (bijv. 24 of 18,50).' }, 400, cors);
        await putSetting(env, 'menu', menu);
        return json({ ok: true }, 200, cors);
      }
      if (p === '/api/acties' && req.method === 'PUT') {
        const acties = cleanActies(await req.json().catch(() => null));
        if (!acties) return json({ error: 'Elke actie heeft minstens een titel nodig.' }, 400, cors);
        await putSetting(env, 'acties', acties);
        return json({ ok: true }, 200, cors);
      }
      return json({ error: 'Niet gevonden' }, 404, cors);
    } catch (e) {
      return json({ error: 'Er ging iets mis op de server.' }, 500, cors);
    }
  },
  // keep the brute-force log small
  async scheduled(_, env) { await env.DB.prepare("DELETE FROM pogingen WHERE ts < datetime('now', '-1 day')").run(); },
};
