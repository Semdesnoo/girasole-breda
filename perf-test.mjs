
// Smoothness check: frame times during scroll + every animation, with 4x CPU throttle (mid-range phone).
// URL=<base> W=390 PORT=9337 node perf-test.mjs
const BASE = process.env.URL || 'http://127.0.0.1:8768/', W = +process.env.W || 390, PORT = process.env.PORT || 9337, CPU = +process.env.CPU || 4;
const ws = new WebSocket((await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {};
ws.onmessage = m => { const x = JSON.parse(m.data); if (pend[x.id]) { pend[x.id](x.result); delete pend[x.id]; } };
const cdp = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
await cdp('Network.setCacheDisabled', { cacheDisabled: false });
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: 844, deviceScaleFactor: W < 700 ? 2 : 1, mobile: W < 700 });
await cdp('Page.navigate', { url: BASE + 'index.html' }); await sleep(4000);
await ev(`document.querySelector('.pop-d[open]')?.close()`);
await cdp('Emulation.setCPUThrottlingRate', { rate: CPU });
const root = W < 700 ? '.v-mob' : '.v-desk';
// rAF frame recorder
const rec = ms => ev(`new Promise(res=>{const f=[];let l=performance.now();const t0=l;(function k(n){f.push(n-l);l=n;if(n-t0<${ms})requestAnimationFrame(k);else{f.shift();f.sort((a,b)=>a-b);const avg=f.reduce((a,b)=>a+b,0)/f.length;res({fps:Math.round(1000/avg),p95:Math.round(f[Math.floor(f.length*.95)]),long:f.filter(x=>x>50).length,frames:f.length})}})(l)})`);
const out = {};
out.idle = await rec(2000);
// smooth scroll whole page
const scroll = ev(`new Promise(res=>{const H=document.body.scrollHeight-innerHeight;let y=0;(function s(){y+=14;scrollTo(0,y);if(y<H)requestAnimationFrame(s);else res()})()})`);
out.scroll = await rec(6000); await scroll;
await ev(`scrollTo(0,0)`); await sleep(800);
let p = rec(1200); await ev(`document.querySelector('${root} header .mbtn').click()`); out.menuOpen = await p;
await sleep(300); p = rec(900); await ev(`document.querySelector('${root} .menu-wrap .mbtn.x').click()`); out.menuClose = await p;
await sleep(500);
p = rec(1000); await ev(`document.querySelector('${W < 700 ? ".v-mob .bar [data-bk]" : ".fab[data-bk]"}').click()`); out.bookingOpen = await p;
await sleep(300); p = rec(700); await ev(`document.querySelector('[data-bk-close]').click()`); out.bookingClose = await p;
await ev(`document.querySelector('${root} .marq').scrollIntoView({block:'center'})`); await sleep(800); out.marquee = await rec(2000);
await ev(`document.querySelector('${root} .film-box').scrollIntoView({block:'center'})`); await sleep(1500); out.film = await rec(2000);
out.videosPlaying = await ev(`[...document.querySelectorAll('video')].filter(v=>!v.paused).length`);
await cdp('Emulation.setCPUThrottlingRate', { rate: 1 });
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(13), JSON.stringify(v));
ws.close();
