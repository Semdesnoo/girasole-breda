// Browser check of the month calendar in the beheer app. Needs dev-server :8787, http.server :8767, Chrome :9333.
const SH = process.env.SHOTS || '.', PIN = process.env.PIN || '246810', A = 'http://127.0.0.1:8787', W = +(process.env.W || 1440);
const ws = new WebSocket((await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r); let id = 0; const pend = {};
ws.onmessage = m => { const x = JSON.parse(m.data); if (pend[x.id]) { pend[x.id](x.result); delete pend[x.id]; } };
const cdp = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { const r = await cdp('Page.captureScreenshot'); (await import('fs')).writeFileSync(`${SH}/${n}.png`, Buffer.from(r.data, 'base64')); };
let fails = 0; const ok = (c, n, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n, x); };
const post = async b => (await fetch(A, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(b) })).json();
const iso = d => d.toISOString().slice(0, 10);
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 3); while (d.getUTCDay() === 1) d.setUTCDate(d.getUTCDate() + 1);
const day = iso(d);
const g = { action: 'reserveer', keuze: 'À la carte', telefoon: '0611111111', email: 'kal@example.nl' };
if (new Date(today + 'T12:00:00Z').getUTCDay() !== 1) await post({ ...g, dag: today, tijd: '20:00', personen: 2, naam: 'Kal Vandaag' });
await post({ ...g, dag: day, tijd: '18:00', personen: 3, naam: 'Kal Een' });
await post({ ...g, dag: day, tijd: '19:30', personen: 5, naam: 'Kal Twee' });
const list = (await post({ action: 'lijst', pin: PIN })).lijst.filter(x => x.dag === day && x.status !== 'afgewezen' && x.status !== 'geannuleerd');
const want = [list.length, list.reduce((s, x) => s + x.personen, 0)];

await cdp('Network.setCacheDisabled', { cacheDisabled: true });
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: 1000, deviceScaleFactor: 1, mobile: W < 700 });
await cdp('Page.navigate', { url: 'http://127.0.0.1:8767/beheer/' }); await sleep(1800);
if (await ev(`!document.querySelector('.js-login').hidden`)) { await ev(`(()=>{const f=document.querySelector('.js-login-form');f.pin.value=${JSON.stringify(PIN)};f.requestSubmit()})()`); }
await sleep(1800);
for (let i = 0; i < 20 && !(await ev(`!!document.querySelector('.res')`)); i++) await sleep(300);
if (day.slice(0, 7) !== today.slice(0, 7)) { await ev(`document.querySelector('[data-cm="1"]').click()`); await sleep(300); }
const cell = await ev(`(()=>{const b=document.querySelector('[data-day="${day}"]');return b&&[b.querySelector('.n')?.textContent, b.querySelector('.g')?.textContent, !!b.querySelector('.new')]})()`);
ok(cell && +cell[0] === want[0] && cell[1] === want[1] + ' gasten' && cell[2], 'day cell shows count, guests, new-dot', JSON.stringify(cell) + ' want ' + want);
ok(await ev(`[...document.querySelectorAll('.cal-g button:not(.out):not(.closed)')].every(b=>/^[0-9]+$/.test(b.querySelector('.n')?.textContent||''))`), 'every open day shows a number (0 too)');
await shot('cal-' + W);
await ev(`document.querySelector('[data-day="${day}"]').click()`); await sleep(500);
const shown = await ev(`[...document.querySelectorAll('.res')].map(r=>r.querySelector('b').textContent)`);
ok(shown.length === want[0] && shown.includes('Kal Een') && shown.includes('Kal Twee'), 'click day lists that day only', shown.join(','));
ok(await ev(`document.querySelector('[data-day="${day}"]').getAttribute('aria-pressed')==='true'`), 'clicked day highlighted');
await ev(`document.querySelector('[data-cal-today]').click()`); await sleep(500);
const todayNames = await ev(`[...document.querySelectorAll('.res')].map(r=>r.querySelector('b').textContent)`);
ok(await ev(`document.querySelector('.js-cal-t').textContent`) && todayNames.every(n => n !== 'Kal Een'), 'Vandaag button shows today', todayNames.join(',') || '(leeg)');
await ev(`document.querySelector('[data-f="komend"]').click()`); await sleep(300);
ok((await ev(`document.querySelectorAll('.res').length`)) >= want[0], 'Komend still lists everything ahead');
await shot('cal-list-' + W);
await cdp('Emulation.clearDeviceMetricsOverride');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); ws.close(); process.exit(fails ? 1 : 0);
