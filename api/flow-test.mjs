// Browser flow: website booking -> visible in beheer app; app menu edit -> visible on website.
// Needs: node api/dev-server.mjs on :8787, http.server on :8767, headless Chrome on :9333.
const SH = process.env.SHOTS || '.', PIN = process.env.PIN || '246810', W = +(process.env.W || 390);
const ws = new WebSocket((await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r); let id = 0; const pend = {};
ws.onmessage = m => { const x = JSON.parse(m.data); if (pend[x.id]) { pend[x.id](x.result); delete pend[x.id]; } };
const cdp = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { const r = await cdp('Page.captureScreenshot'); (await import('fs')).writeFileSync(`${SH}/app-${n}-${W}.png`, Buffer.from(r.data, 'base64')); };
let fails = 0; const ok = (c, n, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n, x); };
const nav = async u => { await cdp('Page.navigate', { url: u }); await sleep(2800); };
await cdp('Network.setCacheDisabled', { cacheDisabled: true });
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: W < 700 ? 844 : 900, deviceScaleFactor: 2, mobile: W < 700 });

// 1. book on the website
const naam = 'Flow ' + Date.now().toString(36);
await nav('http://127.0.0.1:8767/index.html');
await ev(`document.querySelector('.pop-d[open]')?.close(); document.querySelector('a[href*="#reserveren"]').click()`); await sleep(600);
await ev(`document.querySelector('.bk [data-p="3"]').click()`); await sleep(500);
await ev(`document.querySelector('.bk [data-k="kaart"]').click()`); await sleep(600);
await ev(`document.querySelector('.bk [data-m="1"]').click()`); await sleep(200);
await ev(`document.querySelector('.bk .js-bk-cal [data-d]:not(:disabled)').click()`); await sleep(400);
await ev(`document.querySelector('.bk [data-t="19:45"]').click()`); await sleep(500);
await ev(`(()=>{const f=document.querySelector('.bk form');f.naam.value=${JSON.stringify(naam)};f.telefoon.value='0612345678';f.email.value='gast@example.nl';f.requestSubmit()})()`); await sleep(1500);
ok(await ev(`!document.querySelector('.bk .js-thanks').hidden`), 'website shows thank-you after booking');

// 2. it arrives in the app
await nav('http://127.0.0.1:8767/beheer/');
await shot('login');
await ev(`(()=>{const f=document.querySelector('.js-login-form');f.pin.value='000000';f.requestSubmit()})()`); await sleep(900);
ok(/Onjuiste/.test(await ev(`document.querySelector('.js-login-err').textContent`)), 'wrong PIN message');
await ev(`(()=>{const f=document.querySelector('.js-login-form');f.pin.value=${JSON.stringify(PIN)};f.requestSubmit()})()`); await sleep(1500);
ok(await ev(`!document.querySelector('.js-app').hidden`), 'logged in with PIN');
const card = await ev(`(()=>{const a=[...document.querySelectorAll('.res')].find(x=>x.textContent.includes(${JSON.stringify(naam)}));return a&&a.textContent})()`);
ok(card && card.includes('19:45') && card.includes('3 personen') && card.includes('Nieuw'), 'booking arrives in app', card);
await shot('reserveringen');
await ev(`[...document.querySelectorAll('.res')].find(x=>x.textContent.includes(${JSON.stringify(naam)})).querySelector('[data-st="bevestigd"]').click()`); await sleep(900);
ok((await ev(`[...document.querySelectorAll('.res')].find(x=>x.textContent.includes(${JSON.stringify(naam)})).className`)).includes('bevestigd'), 'confirm in app');

// 3. edit menu in the app
await ev(`document.querySelector('[data-go="menu"]').click()`); await sleep(400);
await ev(`document.querySelector('[data-cat="pizza"]').click()`); await sleep(200);
await ev(`(()=>{const i=document.querySelector('.js-dishes [data-d="0"] [data-k="2"]');i.value='15,50';i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
await shot('menu');
await ev(`document.querySelector('.js-save').click()`); await sleep(1200);
ok(/Opgeslagen/.test(await ev(`document.querySelector('.js-toast').textContent`)), 'menu saved from app');
await ev(`document.querySelector('[data-go="act"]').click()`); await sleep(500);
await ev(`document.querySelector('.js-acts details')?.setAttribute('open','')`); await sleep(300);
await shot('acties');

// 4. website shows the new price
await nav('http://127.0.0.1:8767/index.html');
await ev(`document.querySelector('.pop-d[open]')?.close(); document.querySelectorAll('[data-cat="pizza"]').forEach(b=>b.click())`); await sleep(400);
ok(await ev(`[...document.querySelectorAll('.dish')].some(d=>d.textContent.includes('Margherita')&&d.textContent.includes('15,50'))`), 'website shows price from app');

// restore price
await ev(`fetch('http://127.0.0.1:8787?action=site').then(r=>r.json()).then(d=>{d.menu.pizza[0][2]='14,50';return fetch('http://127.0.0.1:8787',{method:'POST',headers:{'content-type':'text/plain'},body:JSON.stringify({action:'menu',pin:'${PIN}',data:d.menu})})}).then(r=>r.status)`);
await cdp('Emulation.clearDeviceMetricsOverride');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); ws.close(); process.exit(fails ? 1 : 0);
