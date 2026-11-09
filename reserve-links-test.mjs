// Every "reserveer" link opens the booking panel: URL=<base> W=390 node reserve-links-test.mjs (chrome on :9333)
const BASE = process.env.URL || 'http://127.0.0.1:8767/', W = +process.env.W || 390;
const ws = new WebSocket((await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {};
ws.onmessage = m => { const x = JSON.parse(m.data); if (pend[x.id]) { pend[x.id](x.result); delete pend[x.id]; } };
const cdp = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true })).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await cdp('Network.enable'); await cdp('Network.setCacheDisabled', { cacheDisabled: true });
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: 844, deviceScaleFactor: 2, mobile: W < 700 });
await cdp('Page.navigate', { url: BASE + 'index.html' }); await sleep(3500);
await ev(`document.querySelector('.pop-d[open]')?.close()`);
const root = W < 700 ? '.v-mob' : '.v-desk';
ok(await ev(`!document.getElementById('reserveren') && !document.getElementById('reserveren-m')`), 'reservation section removed from page');
const n = await ev(`document.querySelectorAll('${root} a[href*="#reserveren"]:not(.menu-wrap a)').length`);
for (let i = 0; i < n; i++) {
  const info = await ev(`(()=>{const a=[...document.querySelectorAll('${root} a[href*="#reserveren"]:not(.menu-wrap a)')][${i}];return [a.textContent.trim().slice(0,22),a.getAttribute('data-keuze')]})()`);
  await ev(`[...document.querySelectorAll('${root} a[href*="#reserveren"]:not(.menu-wrap a)')][${i}].click()`); await sleep(500);
  const st = await ev(`[document.querySelector('.bk').open, document.querySelector('.bk [data-k].on')?.getAttribute('data-k')||null]`);
  ok(st[0] && (!info[1] || st[1] === info[1]), `"${info[0]}" opens panel${info[1] ? ' with ' + info[1] + ' selected (' + st[1] + ')' : ''}`);
  await ev(`document.querySelector('.bk').close()`); await sleep(200);
}
await ev(`document.querySelector('${root} header .mbtn').click()`); await sleep(900);
await ev(`document.querySelector('${root} .menu-wrap nav a[href*="#reserveren"]').click()`); await sleep(900);
ok(await ev(`document.querySelector('.bk').open && document.querySelector('${root} .menu-wrap').hidden`), 'menu "Reserveren" closes menu and opens panel');
ws.close();
