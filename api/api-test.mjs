// End-to-end check of the Girasole API against `wrangler dev` (default http://127.0.0.1:8787).
// Usage: PIN=246810 node api/api-test.mjs
import { checkBooking } from './worker.js';

const A = process.env.API || 'http://127.0.0.1:8787', PIN = process.env.PIN || '246810';
const ORIGIN = 'http://127.0.0.1:8767';
let fails = 0;
const ok = (c, n, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n, x); };
const call = async (path, { method = 'GET', body, pin } = {}) => {
  const r = await fetch(A + path, { method, headers: { 'content-type': 'application/json', origin: ORIGIN, ...(pin ? { authorization: 'Bearer ' + pin } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, d: await r.json().catch(() => null), cors: r.headers.get('access-control-allow-origin') };
};
const iso = d => d.toISOString().slice(0, 10);
const future = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 9); while (d.getUTCDay() === 1) d.setUTCDate(d.getUTCDate() + 1); return iso(d); };

// pure validation
const now = '2026-11-10', good = { dag: '2026-11-12', tijd: '19:15', personen: 4, naam: 'Anna', telefoon: '06 1234 5678', email: 'a@b.nl' };
ok(checkBooking(good, now) === null, 'valid booking accepted');
ok(checkBooking({ ...good, tijd: '20:15' }, now), 'after 20:00 rejected');
ok(checkBooking({ ...good, tijd: '18:10' }, now), 'non-quarter time rejected');
ok(checkBooking({ ...good, dag: '2026-11-16' }, now), 'monday rejected');
ok(checkBooking({ ...good, dag: '2026-11-09' }, now), 'past rejected');
ok(checkBooking({ ...good, personen: 13 }, now), '13 persons rejected');
ok(checkBooking({ ...good, email: 'nope' }, now), 'bad email rejected');

// live API
const site = await call('/api/site');
ok(site.s === 200 && site.d.menu && site.d.menu.voor.length > 0 && site.cors === ORIGIN, 'site content + CORS', site.d && site.d.menu && site.d.menu.voor.length);
ok((await call('/api/reserveringen')).s === 401, 'list without PIN refused');
ok((await call('/api/check', { pin: '000000' })).s === 401, 'wrong PIN refused');
ok((await call('/api/reserveringen', { method: 'POST', body: { ...good, dag: future(), tijd: '21:00' } })).s === 400, 'API rejects 21:00');
const dag = future();
const b = await call('/api/reserveringen', { method: 'POST', body: { ...good, dag, naam: 'Test <script>', personen: '4' } });
ok(b.s === 201 && b.d.id, 'booking stored', JSON.stringify(b.d));
const list = await call('/api/reserveringen', { pin: PIN });
const mine = list.d.find(x => x.id === b.d.id);
ok(mine && mine.status === 'nieuw' && mine.personen === 4 && mine.dag === dag, 'booking visible in app');
ok((await call('/api/reserveringen/' + b.d.id, { method: 'PATCH', pin: PIN, body: { status: 'bevestigd' } })).s === 200, 'confirm booking');
ok((await call('/api/reserveringen', { pin: PIN })).d.find(x => x.id === b.d.id).status === 'bevestigd', 'status saved');
ok((await call('/api/reserveringen/' + b.d.id, { method: 'PATCH', pin: PIN, body: { status: 'weg' } })).s === 400, 'bad status refused');

const menu = site.d.menu;
ok((await call('/api/menu', { method: 'PUT', pin: PIN, body: { ...menu, pizza: [['Test', '', '€ 12']] } })).s === 400, 'bad price refused');
const pizza = [...menu.pizza, ['Pizza Test', 'Alleen voor de test', '12,50']];
ok((await call('/api/menu', { method: 'PUT', pin: PIN, body: { ...menu, pizza } })).s === 200, 'menu saved');
ok((await call('/api/site')).d.menu.pizza.some(d => d[0] === 'Pizza Test'), 'site shows new dish');
ok((await call('/api/menu', { method: 'PUT', pin: PIN, body: menu })).s === 200, 'menu restored');

const acties = site.d.acties;
ok((await call('/api/acties', { method: 'PUT', pin: PIN, body: [{ titel: [] }] })).s === 400, 'actie without title refused');
const pasen = { actief: true, van: '2027-03-20', tot: '2027-04-05', titel: ['Buona', 'Pasqua'], tekst: 'Pasen bij Luca.', knop: 'Reserveer', afbeelding: 'media/../../x.jpg' };
ok((await call('/api/acties', { method: 'PUT', pin: PIN, body: [...acties, pasen] })).s === 200, 'actie saved');
const saved = (await call('/api/site')).d.acties.find(a => a.titel[1] === 'Pasqua');
ok(saved && saved.afbeelding === 'media/interieur.webp' && saved.id, 'path-traversal image replaced, id assigned');
ok((await call('/api/acties', { method: 'PUT', pin: PIN, body: acties })).s === 200, 'acties restored');

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
