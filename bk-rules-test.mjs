// checks the booking rules: no 'aanvraag' labels, no featured card, 12p locks Huiskamer, 15-min slots 17:00-20:00, required fields
const ws = new WebSocket((await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r); let id = 0; const pend = {};
ws.onmessage = m => { const x = JSON.parse(m.data); if (pend[x.id]) { pend[x.id](x.result); delete pend[x.id]; } };
const cdp = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true })).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = (c, n, x = '') => console.log((c ? 'PASS ' : 'FAIL ') + n, x);
await cdp('Network.setCacheDisabled', { cacheDisabled: true });
await cdp('Page.navigate', { url: (process.env.URL || 'http://127.0.0.1:8767/') + 'index.html' }); await sleep(3000);
await ev(`document.querySelector('.pop-d[open]')?.close(); document.querySelector('a[href*="#reserveren"]').click()`); await sleep(700);
ok(await ev(`!document.querySelector('.bk [data-p] small')`), 'no aanvraag labels');
ok(await ev(`!document.querySelector('.bk-feat') && !document.querySelector('.bk').textContent.includes('Uitgelicht')`), 'no featured card');
await ev(`document.querySelector('.bk [data-p="12"]').click()`); await sleep(600);
const lock = await ev(`[...document.querySelectorAll('.bk [data-k]')].map(c=>c.dataset.k+':'+c.classList.contains('on')+':'+c.disabled)`);
ok(lock.every(x => x.startsWith('huis') ? x.endsWith('true:false') : x.endsWith('false:true')), '12p -> Huiskamer checked and locked', lock.join(' '));
await ev(`document.querySelector('.bk [data-k="4"]').click()`); await sleep(500);
ok(await ev(`document.querySelector('.bk [data-k="huis"]').classList.contains('on')`), 'other menu cannot be picked at 12p');
// pick a future non-monday date
await ev(`(()=>{const b=[...document.querySelectorAll('.bk [data-step="date"]')][0]; b.disabled=false; b.click()})()`); await sleep(400);
await ev(`document.querySelector('.bk [data-m="1"]').click()`); await sleep(200);
await ev(`document.querySelector('.bk .js-bk-cal [data-d]:not(:disabled)').click()`); await sleep(400);
const t = await ev(`[...document.querySelectorAll('.bk [data-t]')].map(b=>b.dataset.t)`);
const want = []; for (let m = 17 * 60; m <= 20 * 60; m += 15) want.push(String(m / 60 | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
ok(JSON.stringify(t) === JSON.stringify(want), 'times 17:00-20:00 every 15 min', t.join(','));
ok(await ev(`['naam','telefoon','email'].every(n=>document.querySelector('.bk form [name='+n+']').required)`), 'naam, telefoon, e-mail required');
await ev(`document.querySelector('.bk [data-p="12"]').closest('.bk')`);
// back to 4 persons unlocks
await ev(`document.querySelector('.bk [data-step="pers"]').click()`); await sleep(300);
await ev(`document.querySelector('.bk [data-p="4"]').click()`); await sleep(600);
ok(await ev(`[...document.querySelectorAll('.bk [data-k]')].every(c=>!c.disabled)`), 'fewer than 12 unlocks menus');
ws.close();
