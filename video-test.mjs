
// Mobile/desktop video check. Headless chrome on :9333, then: SHOTS=<dir> URL=<base> W=390 node video-test.mjs
const S = process.env.SHOTS, BASE = process.env.URL || 'http://127.0.0.1:8767/', W = +process.env.W || 390;
const tabs = await (await fetch('http://127.0.0.1:9333/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {};
ws.onmessage = m => { const x = JSON.parse(m.data); if (pend[x.id]) { pend[x.id](x.result); delete pend[x.id]; } };
const cdp = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { const r = await cdp('Page.captureScreenshot'); (await import('fs')).writeFileSync(`${S}/${n}.png`, Buffer.from(r.data, 'base64')); };
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await cdp('Network.enable'); await cdp('Network.setCacheDisabled', { cacheDisabled: true });
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: 844, deviceScaleFactor: 2, mobile: W < 700 });
await cdp('Emulation.setTouchEmulationEnabled', { enabled: W < 700 });
await cdp('Page.navigate', { url: BASE + 'index.html' }); await sleep(3000);
await ev(`document.querySelector('.pop-d[open]')?.close()`);
const root = W < 700 ? '.v-mob' : '.v-desk';
ok(await ev(`document.documentElement.scrollWidth <= innerWidth`), `no horizontal overflow (${W}px)`);
const pending = await ev(`[...document.querySelectorAll('${root} video')].filter(v=>v.hasAttribute('data-src')).length`);
ok(pending >= 2, `lazy: ${pending} videos still unloaded at top`);
for (const [sel, name] of [['.film-box video','film'], ['[aria-label="Buona sera"] video','buona'], ['#kaart' + (W<700?'-m':'') + ' video','kaart']]) {
  await ev(`document.querySelector('${root} ${sel}').scrollIntoView({block:'center'})`); await sleep(2500);
  const v = await ev(`(()=>{const v=document.querySelector('${root} ${sel}');const r=v.getBoundingClientRect();return {src:v.currentSrc.split('/').pop(),w:v.videoWidth,paused:v.paused,t:v.currentTime,rw:Math.round(r.width)}})()`);
  ok(v.w > 0 && !v.paused && v.t > 0, `${name} plays: ${JSON.stringify(v)}`);
  await shot(`vid-${name}-${W}`);
}
await ev(`document.querySelector('${root} .film-box').scrollIntoView({block:'center'})`); await sleep(1500); // smooth scroll must settle before measuring
const br = await ev(`(()=>{const b=document.querySelector('${root} [data-film]').getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`);
for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: br[0], y: br[1], button: 'left', clickCount: 1 }); // trusted gesture
await sleep(3000);
const f = await ev(`(()=>{const v=document.querySelector('${root} .film-box video');return {muted:v.muted,controls:v.controls,loop:v.loop,t:v.currentTime}})()`);
ok(!f.muted && f.controls && !f.loop && f.t > 1, `film sound mode ${JSON.stringify(f)}`);
ok(await ev(`[...document.querySelectorAll('button,a.btn,.fab')].filter(b=>b.offsetParent&&b.closest('${root}, .bk')).every(b=>{const r=b.getBoundingClientRect();return r.height>=44||r.height===0})`), 'tap targets >= 44px');
await cdp('Page.navigate', { url: BASE + 'contact.html' }); await sleep(3000);
ok(await ev(`document.documentElement.scrollWidth <= innerWidth`), 'contact: no overflow');
const z = await ev(`(()=>{const v=document.querySelector('.zaal video');return {w:v.videoWidth,paused:v.paused}})()`);
ok(z.w > 0 && !z.paused, 'contact zaal video plays ' + JSON.stringify(z));
await shot(`vid-contact-${W}`);
ws.close();
