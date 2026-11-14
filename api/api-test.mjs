// End-to-end check of api/Code.gs via the local stand-in (api/dev-server.mjs) or a real
// Apps Script /exec URL.  Usage: PIN=246810 node api/api-test.mjs   (API=<exec url> for the real one)
const A = process.env.API || 'http://127.0.0.1:8787', PIN = process.env.PIN || '246810';
const LOCAL = A.startsWith('http://127.0.0.1');
let fails = 0;
const ok = (c, n, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n, x); };
const post = async body => (await fetch(A, { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })).json();
const get = async q => (await fetch(A + q)).json();
const iso = d => d.toISOString().slice(0, 10);
const day = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); while (d.getUTCDay() === 1) d.setUTCDate(d.getUTCDate() + 1); return iso(d); };
const monday = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 3); while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1); return iso(d); };
const good = { action: 'reserveer', dag: day(9), tijd: '19:15', personen: 4, keuze: 'À la carte', naam: 'Anna', telefoon: '0612345678', email: 'a@b.nl' };

const site = await get('?action=site');
ok(site.menu && site.menu.voor.length > 0 && site.acties.length > 0, 'site content (menu + acties)', site.menu && site.menu.voor.length);

for (const [bad, name] of [[{ tijd: '20:15' }, 'after 20:00'], [{ tijd: '18:10' }, 'non-quarter time'], [{ dag: monday() }, 'monday'],
  [{ dag: '2020-01-01' }, 'past date'], [{ personen: 13 }, '13 persons'], [{ email: 'nope' }, 'bad email'], [{ telefoon: 'abc' }, 'bad phone']])
  ok((await post({ ...good, ...bad })).error, name + ' rejected');

ok((await post({ action: 'lijst' })).auth === false, 'list without PIN refused');
ok((await post({ action: 'check', pin: '000000' })).auth === false, 'wrong PIN refused');

const b = await post({ ...good, naam: 'Test <b>', personen: '4' });
ok(b.ok && b.id, 'booking stored', JSON.stringify(b));
const mine = (await post({ action: 'lijst', pin: PIN })).lijst.find(x => String(x.id) === b.id);
ok(mine && mine.status === 'nieuw' && mine.personen === 4 && mine.dag === good.dag && mine.tijd === '19:15' && mine.telefoon === '0612345678', 'booking listed with exact values', JSON.stringify(mine));
ok((await post({ action: 'status', pin: PIN, id: b.id, status: 'bevestigd' })).ok, 'confirm booking');
ok((await post({ action: 'lijst', pin: PIN })).lijst.find(x => String(x.id) === b.id).status === 'bevestigd', 'status saved');
ok((await post({ action: 'status', pin: PIN, id: b.id, status: 'weg' })).error, 'bad status refused');
if (LOCAL) {
  const m = await (await fetch(A + '/__mails')).json();
  ok(m.length && m.at(-1).to === 'restaurant@example.nl' && m.at(-1).replyTo === 'a@b.nl' && /Test &lt;b&gt;/.test(m.at(-1).htmlBody), 'owner mailed, reply-to guest, html escaped');
}

const menu = site.menu;
ok((await post({ action: 'menu', pin: PIN, data: { ...menu, pizza: [['Test', '', '€ 12']] } })).error, 'bad price refused');
ok((await post({ action: 'menu', pin: PIN, data: { ...menu, pizza: [...menu.pizza, ['Pizza Test', 'Alleen voor de test', '12,50']] } })).ok, 'menu saved');
ok((await get('?action=site')).menu.pizza.some(d => d[0] === 'Pizza Test'), 'site shows new dish');
ok((await post({ action: 'menu', pin: PIN, data: menu })).ok, 'menu restored');

const acties = site.acties;
ok((await post({ action: 'acties', pin: PIN, data: [{ titel: [] }] })).error, 'actie without title refused');
ok((await post({ action: 'acties', pin: PIN, data: [...acties, { actief: true, van: '2027-03-20', tot: '2027-04-05', titel: ['Buona', 'Pasqua'], tekst: 'Pasen', afbeelding: 'media/../../x.jpg' }] })).ok, 'actie saved');
const saved = (await get('?action=site')).acties.find(a => a.titel[1] === 'Pasqua');
ok(saved && saved.afbeelding === 'media/interieur.webp' && saved.id, 'unsafe image path replaced, id assigned');
ok((await post({ action: 'acties', pin: PIN, data: acties })).ok, 'acties restored');

if (LOCAL && process.env.LOCKOUT) { // locks the stand-in for 15 min, so opt-in
  for (let i = 0; i < 7; i++) await post({ action: 'check', pin: '111111' });
  ok(/Te veel/.test((await post({ action: 'check', pin: PIN })).error), 'locked after 8 wrong PINs');
}
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
