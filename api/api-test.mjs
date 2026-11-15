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

{ // scopes are fixed in appsscript.json; a new Google service in Code.gs would force every owner to re-authorize
  const fs = await import('node:fs'), src = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
  const scopes = JSON.parse(fs.readFileSync(new URL('./appsscript.json', import.meta.url), 'utf8')).oauthScopes.join(' ');
  const need = { SpreadsheetApp: 'auth/spreadsheets', MailApp: 'auth/script.send_mail', DriveApp: 'auth/drive', ScriptApp: 'auth/script.scriptapp', Session: 'auth/userinfo.email' };
  const free = ['Utilities', 'PropertiesService', 'CacheService', 'LockService', 'ContentService', 'Logger', 'HtmlService'];
  const used = [...new Set(src.match(/\b[A-Z][A-Za-z]+(?=\.[a-z])/g))].filter(x => /App$|Service$|^Session$|^Utilities$|^Logger$/.test(x));
  const bad = used.filter(x => !free.includes(x) && !(need[x] && scopes.includes(need[x])));
  ok(!bad.length, 'every Google service is covered by appsscript.json scopes', bad.join(',') || used.join(','));
}
if (LOCAL) { const st = await get('/__setup'); ok(st.ok && st.triggers.length === 1, 'setup runs, exactly one daily check trigger', JSON.stringify(st)); }
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
ok(mine && !('token' in mine) && mine.status === 'nieuw' && mine.personen === 4 && mine.dag === good.dag && mine.tijd === '19:15' && mine.telefoon === '0612345678', 'booking listed with exact values', JSON.stringify(mine));
const nMail = LOCAL && (await get('/__mails')).length;
ok((await post({ action: 'status', pin: PIN, id: b.id, status: 'bevestigd' })).ok, 'confirm booking');
if (LOCAL) {
  const m = (await get('/__mails')).slice(nMail);
  ok(m.length === 1 && m[0].to === good.email && /bevestigd/.test(m[0].subject) && !/Let op/.test(m[0].htmlBody) && /wijzig\.html\?id=/.test(m[0].htmlBody), 'guest gets confirmation mail', m.map(x => x.subject).join(' | '));
  await post({ action: 'status', pin: PIN, id: b.id, status: 'bevestigd' });
  ok((await get('/__mails')).length === nMail + 1, 'confirming twice sends no second mail');
}
ok((await post({ action: 'lijst', pin: PIN })).lijst.find(x => String(x.id) === b.id).status === 'bevestigd', 'status saved');
ok((await post({ action: 'status', pin: PIN, id: b.id, status: 'weg' })).error, 'bad status refused');
if (LOCAL) {
  const m = await (await fetch(A + '/__mails')).json();
  const own = m.findLast(x => x.to === 'restaurant@example.nl'), guest = m.findLast(x => x.to === 'a@b.nl' && /aanvraag/.test(x.subject));
  ok(own && own.replyTo === 'a@b.nl' && /Test &lt;b&gt;/.test(own.htmlBody) && !/<b>Test/.test(own.htmlBody), 'owner mailed, reply-to guest, html escaped');
  ok(guest && guest.replyTo === 'restaurant@example.nl' && /we bellen je even, of sturen je een mailtje/i.test(guest.htmlBody) && /logo-mail\.png/.test(guest.htmlBody) && /4 gasten/.test(guest.htmlBody), 'guest gets confirmation with call notice');
}

if (LOCAL) { // guest self-service via the secret link in the mail
  const m = await (await fetch(A + '/__mails')).json();
  const link = m.findLast(x => x.to === 'a@b.nl').htmlBody.match(/wijzig\.html\?id=(\d+)&t=([a-f0-9]{32})/);
  ok(link && link[1] === b.id, 'guest mail has personal change link');
  const [, id, t] = link;
  ok((await post({ action: 'mijn', id, t: 'f'.repeat(32) })).error, 'wrong token refused');
  const me = await post({ action: 'mijn', id, t });
  ok(me.res && me.res.tijd === '19:15' && !('email' in me.res) && !('telefoon' in me.res), 'guest sees own booking without contact data');
  ok((await post({ action: 'wijzig', id, t, dag: good.dag, tijd: '19:15', personen: 4, keuze: 'À la carte' })).error, 'no-op change refused');
  ok((await post({ action: 'wijzig', id, t, dag: good.dag, tijd: '20:30', personen: 4, keuze: 'À la carte' })).error, 'change to 20:30 refused');
  ok((await post({ action: 'wijzig', id, t, dag: good.dag, tijd: '18:30', personen: 12, keuze: 'Menu, 4 gangen' })).ok, 'guest changes time + persons');
  const ch = (await post({ action: 'lijst', pin: PIN })).lijst.find(x => x.id === id);
  ok(ch.status === 'gewijzigd' && ch.tijd === '18:30' && ch.personen === 12 && ch.keuze === 'De Huiskamer' && /19:15/.test(ch.vorige) && !('token' in ch), 'app sees change (12p = Huiskamer, old value kept, token hidden)', JSON.stringify(ch));
  const m2 = await (await fetch(A + '/__mails')).json();
  ok(/^Gewijzigde reservering/.test(m2.findLast(x => x.to === 'restaurant@example.nl').subject), 'owner gets change mail');
  ok(/wijziging/.test(m2.findLast(x => x.to === 'a@b.nl').subject), 'guest gets change confirmation');
  ok((await post({ action: 'wijzig', id, t, annuleer: true })).ok, 'guest cancels');
  ok((await post({ action: 'lijst', pin: PIN })).lijst.find(x => x.id === id).status === 'geannuleerd', 'app sees cancellation');
  ok(/^Geannuleerd/.test((await (await fetch(A + '/__mails')).json()).findLast(x => x.to === 'restaurant@example.nl').subject), 'owner gets cancel mail');
  ok((await post({ action: 'wijzig', id, t, dag: good.dag, tijd: '19:00', personen: 2, keuze: 'À la carte' })).error, 'no changes after cancel');
}

if (LOCAL) { // full-menu PDF upload
  const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
  ok((await post({ action: 'kaartpdf', data: pdf, naam: 'kaart.pdf' })).auth === false, 'pdf upload needs PIN');
  ok((await post({ action: 'kaartpdf', pin: PIN, data: Buffer.from('<html>').toString('base64'), naam: 'x.pdf' })).error, 'non-pdf refused');
  const up = await post({ action: 'kaartpdf', pin: PIN, data: pdf, naam: 'Kaart winter.pdf' });
  ok(up.ok && /^https:\/\/drive\.google\.com\/file\/d\//.test(up.kaartPdf.url), 'pdf uploaded', up.kaartPdf && up.kaartPdf.url);
  ok((await get('?action=site')).kaartPdf.naam === 'Kaart winter.pdf', 'site gets pdf link');
  ok((await post({ action: 'kaartpdf', pin: PIN, verwijder: true })).ok && (await get('?action=site')).kaartPdf === null, 'pdf removed');
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
