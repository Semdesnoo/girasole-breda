
// Autoplay check incl. blocked-autoplay fallback. Run chrome with --autoplay-policy=user-gesture-required on :9335.
// SHOTS=<dir> URL=<base> W=390 node autoplay-test.mjs
const BASE = process.env.URL || 'http://127.0.0.1:8767/', W = +process.env.W || 390, PORT = process.env.PORT || 9335;
const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {};
ws.onmessage = m => { const x = JSON.parse(m.data); if (pend[x.id]) { pend[x.id](x.result); delete pend[x.id]; } };
const cdp = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true })).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
await cdp('Network.enable'); await cdp('Network.setCacheDisabled', { cacheDisabled: true });
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: 844, deviceScaleFactor: 2, mobile: W < 700 });
await cdp('Emulation.setTouchEmulationEnabled', { enabled: W < 700 });
const root = W < 700 ? '.v-mob' : '.v-desk';
const state = sel => ev(`[...document.querySelectorAll('${sel} video')].filter(v=>{const r=v.getBoundingClientRect();return r.width&&r.top<innerHeight&&r.bottom>0}).map(v=>[(v.currentSrc||v.dataset.src||'').split('/').pop(), v.paused])`);
for (const page of ['index.html', 'contact.html']) {
  await cdp('Page.navigate', { url: BASE + page }); await sleep(3500);
  await ev(`document.querySelector('.pop-d[open]')?.close()`);
  const sel = page === 'index.html' ? root : 'body';
  console.log('before gesture', JSON.stringify(await state(sel)));
  const tap = W < 700 ? async () => { for (const type of ['touchStart', 'touchEnd']) await cdp('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 30, y: 600 }] }); }
                      : async () => { for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: 30, y: 600, button: 'left', clickCount: 1 }); };
  await tap(); await sleep(1500);
  const top = await state(sel); const playingTop = top.filter(x => !x[1]).length;
  ok(top.length && playingTop === top.length, `${page} top videos play after first tap ${JSON.stringify(top)}`);
  if (page === 'index.html') {
    for (const s of ['.film-box', '.sole', W < 700 ? '#kaart-m' : '#kaart']) {
      await ev(`document.querySelector('${root} ${s}').scrollIntoView({block:'center'})`); await sleep(2000);
      const v = await ev(`(()=>{const v=document.querySelector('${root} ${s} video');return [(v.currentSrc||'').split('/').pop(), v.paused, v.currentTime>0]})()`);
      ok(v[0] && !v[1], `${s} plays when scrolled to ${JSON.stringify(v)}`);
    }
  }
}
ws.close();
