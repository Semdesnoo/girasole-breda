
// CDP check of the booking drawer. Run headless chrome with --remote-debugging-port=9333, then: SHOTS=<dir> URL=<site> W=1440 node bk-test.mjs
const S = process.env.SHOTS;
const tabs = await (await fetch('http://127.0.0.1:9333/json')).json();
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {};
ws.onmessage = m => { const x = JSON.parse(m.data); if (pend[x.id]) { pend[x.id](x.result); delete pend[x.id]; } };
const cdp = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true })).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { const r = await cdp('Page.captureScreenshot'); (await import('fs')).writeFileSync(`${S}/${n}.png`, Buffer.from(r.data, 'base64')); };
const W = +process.env.W || 1440;
await cdp('Network.enable'); await cdp('Network.setCacheDisabled', { cacheDisabled: true });
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: 900, deviceScaleFactor: 1, mobile: W < 700 });
await cdp('Page.navigate', { url: process.env.URL || 'http://127.0.0.1:8767/index.html' }); await sleep(3000);
const opener = W < 700 ? '.v-mob .bar [data-bk]' : '.fab[data-bk]';
await ev(`document.querySelector('${opener}').click()`); await sleep(800);
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
ok(await ev(`document.querySelector('.bk').open`), 'drawer opens from ' + opener);
ok(await ev(`!!document.querySelector('.bk-feat')`), 'featured card from popup.json');
await shot('bk-home-' + W);
await ev(`document.querySelector('[data-go=pers]').click()`); await sleep(200); await shot('bk-pers-' + W);
await ev(`document.querySelector('[data-p="8"]').click()`); await sleep(200);
ok((await ev(`document.querySelector('.js-bk-p').textContent`)) === '8 personen (op aanvraag)', 'persons label');
await ev(`document.querySelector('[data-go=date]').click()`); await sleep(200);
const dis = await ev(`[...document.querySelectorAll('.js-bk-cal [data-d]')].filter(b=>new Date(b.dataset.d+'T12:00').getDay()===1).every(b=>b.disabled)`);
ok(dis, 'mondays disabled');
await ev(`document.querySelector('.js-bk-cal [data-d]:not(:disabled)').click()`); await sleep(300); await shot('bk-date-' + W);
await ev(`document.querySelector('[data-t]').click()`); await sleep(200);
ok(!(await ev(`document.querySelector('.js-bk-dt').textContent`)).startsWith('Selecteer'), 'date/time label set');
await ev(`document.querySelector('[data-k=huis]').click()`); await sleep(300);
ok(await ev(`!document.querySelector('[data-v=form]').hidden`), 'goes to form');
ok((await ev(`document.querySelector('.bk form [type=submit]').textContent`)) === 'Aanvraag versturen', 'request mode for 8 persons');
console.log(await ev(`JSON.stringify(Object.fromEntries(new FormData(document.querySelector('.bk form'))))`));
await shot('bk-form-' + W);
ws.close();
// animation: opens rising from below, closes with an exit animation
{
  const ws2 = new WebSocket((await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws2.onopen = r);
  let i2 = 0; const p2 = {};
  ws2.onmessage = m => { const x = JSON.parse(m.data); if (p2[x.id]) { p2[x.id](x.result); delete p2[x.id]; } };
  const c2 = (method, params = {}) => new Promise(r => { p2[++i2] = r; ws2.send(JSON.stringify({ id: i2, method, params })); });
  const e2 = async e => (await c2('Runtime.evaluate', { expression: e, returnByValue: true })).result.value;
  await c2('Emulation.setDeviceMetricsOverride', { width: W, height: 900, deviceScaleFactor: 1, mobile: W < 700 }); await sleep(300);
  await e2(`document.querySelector('.bk').open && document.querySelector('.bk').close()`);
  await e2(`document.querySelector('${opener}').click()`); await sleep(120);
  const mid = await e2(`getComputedStyle(document.querySelector('.bk')).transform`);
  ok(mid !== 'none', 'opening animation runs (' + mid.slice(0, 40) + ')');
  await sleep(150); { const r = await c2('Page.captureScreenshot'); (await import('fs')).writeFileSync(`${S}/bk-anim-${W}.png`, Buffer.from(r.data, 'base64')); }
  await sleep(700);
  const r = await e2(`(()=>{const b=document.querySelector('.bk').getBoundingClientRect();return [Math.round(b.right),Math.round(b.bottom),innerWidth,innerHeight]})()`);
  ok(W < 700 ? r[1] === r[3] : (r[2] - r[0] >= 20 && r[3] - r[1] >= 20), 'panel anchored bottom-right ' + JSON.stringify(r));
  await e2(`document.querySelector('[data-bk-close]').click()`); await sleep(100);
  ok(await e2(`document.querySelector('.bk').open && document.querySelector('.bk').classList.contains('out')`), 'closing animation running');
  await sleep(400);
  ok(await e2(`!document.querySelector('.bk').open`), 'closed after animation');
  ws2.close();
}
