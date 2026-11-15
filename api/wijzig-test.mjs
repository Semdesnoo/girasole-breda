// Browser check of wijzig.html (guest changes own booking) + app shows it. Needs dev-server :8787, http.server :8767, Chrome :9333.
const SH = process.env.SHOTS || '.', PIN = process.env.PIN || '246810', A = 'http://127.0.0.1:8787';
const ws = new WebSocket((await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r); let id = 0; const pend = {};
ws.onmessage = m => { const x = JSON.parse(m.data); if (pend[x.id]) { pend[x.id](x.result); delete pend[x.id]; } };
const cdp = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { const r = await cdp('Page.captureScreenshot', { captureBeyondViewport: true }); (await import('fs')).writeFileSync(`${SH}/${n}.png`, Buffer.from(r.data, 'base64')); };
let fails = 0; const ok = (c, n, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n, x); };
const post = async b => (await fetch(A, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(b) })).json();
const d = new Date(); d.setUTCDate(d.getUTCDate() + 10); while (d.getUTCDay() === 1) d.setUTCDate(d.getUTCDate() + 1);
const dag = d.toISOString().slice(0, 10);
const b = await post({ action: 'reserveer', dag, tijd: '19:00', personen: 2, keuze: 'À la carte', naam: 'Giulia Rossi', telefoon: '0611111111', email: 'giulia@example.nl' });
const mails = await (await fetch(A + '/__mails')).json();
const [, mid, t] = mails.findLast(x => x.to === 'giulia@example.nl').htmlBody.match(/wijzig\.html\?id=(\d+)&t=([a-f0-9]{32})/);
ok(mid === b.id, 'link from guest mail');

await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cdp('Page.navigate', { url: `http://127.0.0.1:8767/wijzig.html?id=${mid}&t=${t}` }); await sleep(2500);
ok(await ev(`!document.querySelector('.js-form').hidden && document.querySelector('.js-now').textContent.includes('19:00')`), 'page loads current booking');
await shot('wijzig-form');
const box = await ev(`['dag','tijd','personen','keuze'].map(n=>{const r=document.querySelector('.js-form [name='+n+']').getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]})`);
const [fd, ti, p, k] = box, edge = await ev(`Math.round(document.querySelector('.in').getBoundingClientRect().right - 26)`);
ok(box.every(b => b[2] === fd[2] && b[3] === fd[3]) && fd[1] === ti[1] && p[1] === k[1] && fd[0] === p[0] && ti[0] === k[0] && ti[0] + ti[2] <= edge + 1 && fd[0] + fd[2] < ti[0],
  'fields equal size, aligned in two columns, inside the card', JSON.stringify(box));
await ev(`(()=>{const f=document.querySelector('.js-form');f.tijd.value='20:00';f.personen.value='4';f.personen.dispatchEvent(new Event('change'));f.requestSubmit()})()`); await sleep(1500);
ok(await ev(`!document.querySelector('.js-done').hidden`), 'change submitted from page');
await shot('wijzig-done');
await cdp('Page.navigate', { url: `http://127.0.0.1:8767/wijzig.html?id=${mid}&t=${'0'.repeat(32)}` }); await sleep(2000);
ok(await ev(`!document.querySelector('.js-fail').hidden`), 'bad link shows friendly error');

await cdp('Page.navigate', { url: 'http://127.0.0.1:8767/beheer/' }); await sleep(2000);
await ev(`(()=>{const f=document.querySelector('.js-login-form');f.pin.value=${JSON.stringify(PIN)};f.requestSubmit()})()`); await sleep(1500);
const card = await ev(`(()=>{const a=[...document.querySelectorAll('.res')].find(x=>x.textContent.includes('Giulia'));return a&&a.textContent})()`);
ok(card && card.includes('20:00') && card.includes('4 personen') && card.includes('Gewijzigd') && card.includes('Was:'), 'app shows the change', card);
await ev(`[...document.querySelectorAll('.res')].find(x=>x.textContent.includes('Giulia')).scrollIntoView({block:'center'})`); await sleep(300);
await shot('wijzig-app');
const own = (await (await fetch(A + '/__mails')).json()).findLast(x => x.to === 'restaurant@example.nl');
(await import('fs')).writeFileSync(`${SH}/mail-wijzig.html`, own.htmlBody);
ok(/^Gewijzigde reservering/.test(own.subject), 'owner change mail', own.subject);
await cdp('Emulation.clearDeviceMetricsOverride');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); ws.close(); process.exit(fails ? 1 : 0);
