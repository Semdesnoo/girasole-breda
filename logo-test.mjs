
// Logo check: SHOTS=<dir> URL=<base> W=390 node logo-test.mjs  (headless chrome on :9333)
const S = process.env.SHOTS, BASE = process.env.URL || 'http://127.0.0.1:8767/', W = +process.env.W || 390;
const tabs = await (await fetch('http://127.0.0.1:9333/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {};
ws.onmessage = m => { const x = JSON.parse(m.data); if (pend[x.id]) { pend[x.id](x.result); delete pend[x.id]; } };
const cdp = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true })).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { const r = await cdp('Page.captureScreenshot'); (await import('fs')).writeFileSync(`${S}/${n}.png`, Buffer.from(r.data, 'base64')); };
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await cdp('Network.enable'); await cdp('Network.setCacheDisabled', { cacheDisabled: true });
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: 844, deviceScaleFactor: 2, mobile: W < 700 });
for (const page of ['index.html', 'contact.html']) {
  await cdp('Page.navigate', { url: BASE + page }); await sleep(3500);
  await ev(`document.querySelector('.pop-d[open]')?.close()`);
  const imgs = await ev(`[...document.querySelectorAll('img.lk')].filter(i=>i.offsetParent).map(i=>({s:i.src.split('/').pop(),w:i.naturalWidth,r:Math.round(i.getBoundingClientRect().width)}))`);
  ok(imgs.length >= 2 && imgs.every(i => i.w > 0), `${page} logos loaded ${JSON.stringify(imgs)}`);
  ok(await ev(`document.documentElement.scrollWidth <= innerWidth`), `${page} no overflow`);
  await ev(`scrollTo(0,0)`); await sleep(1800); await shot(`logo-top-${page}-${W}`);
  await ev(`scrollTo(0, document.body.scrollHeight)`); await sleep(1500); await shot(`logo-foot-${page}-${W}`);
}
ws.close();
