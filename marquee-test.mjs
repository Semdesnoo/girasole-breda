// Review marquee: starts mid-strip and loops seamlessly. URL=<base> W=390 node marquee-test.mjs (chrome :9333)
const BASE = process.env.URL || 'http://127.0.0.1:8767/', W = +process.env.W || 390, S = process.env.SHOTS;
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
await cdp('Page.navigate', { url: BASE + 'index.html' }); await sleep(2500);
await ev(`document.querySelector('.pop-d[open]')?.close()`);
const root = W < 700 ? '.v-mob' : '.v-desk';
const x0 = await ev(`new DOMMatrix(getComputedStyle(document.querySelector('${root} .marq-track')).transform).m41`);
ok(x0 < -300, 'strip already scrolled on load (x=' + Math.round(x0) + ')');
// seamless: the copy's first card sits exactly one loop-distance after the original's first card
const g = await ev(`(()=>{const t=document.querySelector('${root} .marq-track');const a=t.querySelector('.rcard'),b=t.querySelector('.marq-dup .rcard');return [b.getBoundingClientRect().x-a.getBoundingClientRect().x, +getComputedStyle(t).getPropertyValue('--shift')]})()`);
ok(Math.abs(g[0] - g[1]) < 1, `loop distance matches copy offset (${g.map(Math.round)})`);
await ev(`document.querySelector('${root} .marq').scrollIntoView({block:'center'})`); await sleep(800);
const vis = await ev(`[...document.querySelectorAll('${root} .rcard')].filter(c=>{const r=c.getBoundingClientRect();return r.right>0&&r.left<innerWidth}).length`);
ok(vis >= 2, vis + ' review cards in view');
if (S) { const r = await cdp('Page.captureScreenshot'); (await import('fs')).writeFileSync(`${S}/marq-${W}.png`, Buffer.from(r.data, 'base64')); }
ws.close();
