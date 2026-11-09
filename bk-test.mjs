
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
const vis = () => ev(`document.querySelector('.bk-v:not([hidden])').dataset.v`);
ok(await vis() === 'pers', 'step 1 = personen');
await shot('bk-pers-' + W);
await ev(`document.querySelector('[data-p="8"]').click()`); await sleep(500);
ok(await vis() === 'home', 'step 2 = menu');
await ev(`document.querySelector('[data-step=pers]').click()`); await sleep(300);
await ev(`document.querySelector('[data-p="12"]').click()`); await sleep(500);
ok(await ev(`document.querySelector('.bk-menu [data-k=huis]').classList.contains('on')`), '12 personen selects De Huiskamer');
await ev(`document.querySelector('[data-step=pers]').click()`); await sleep(300);
await ev(`document.querySelector('[data-p="8"]').click()`); await sleep(500);
ok(await ev(`!!document.querySelector('.bk-feat')`), 'featured card from popup.json');
await shot('bk-home-' + W);
await ev(`document.querySelector('[data-k=huis]').click()`); await sleep(150);
ok(await ev(`document.querySelector('[data-k=huis]').classList.contains('on') && document.querySelector('[data-k=huis]').getAttribute('aria-pressed')==='true'`), 'menu choice shows as selected');
await sleep(450);
ok(await vis() === 'date', 'step 3 = datum en tijd');
const dis = await ev(`[...document.querySelectorAll('.js-bk-cal [data-d]')].filter(b=>new Date(b.dataset.d+'T12:00').getDay()===1).every(b=>b.disabled)`);
ok(dis, 'mondays disabled');
await ev(`document.querySelector('.js-bk-cal [data-d]:not(:disabled)').click()`); await sleep(300); await shot('bk-date-' + W);
await ev(`document.querySelector('[data-t]').click()`); await sleep(500);
ok(await vis() === 'form', 'step 4 = gegevens');
ok(await ev(`document.querySelector('.bk-steps li:nth-child(4)').className==='now' && [...document.querySelectorAll('.bk-steps li')].slice(0,3).every(l=>l.className==='done')`), 'step indicator tracks progress');
await ev(`document.querySelector('[data-step=pers]').click()`); await sleep(300);
ok(await vis() === 'pers', 'step indicator jumps back');
await ev(`document.querySelector('[data-step=form]').click()`); await sleep(300);
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
// choosing a menu first, then changing it from the summary
{
  const ws3 = new WebSocket((await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws3.onopen = r);
  let i3 = 0; const p3 = {};
  ws3.onmessage = m => { const x = JSON.parse(m.data); if (p3[x.id]) { p3[x.id](x.result); delete p3[x.id]; } };
  const e3 = async e => { const r = await new Promise(r => { p3[++i3] = r; ws3.send(JSON.stringify({ id: i3, method: 'Runtime.evaluate', params: { expression: e, returnByValue: true } })); }); return r.result.value; };
  await e3(`document.querySelector('.bk').open || document.querySelector('${opener}').click()`); await sleep(700);
    ok(await e3(`document.querySelectorAll('.bk-menu [data-k]').length === 4`), 'four menu choices');
    await e3(`document.querySelector('[data-p="2"]').click()`); await sleep(500);
  await e3(`document.querySelector('[data-k="6"]').click()`); await sleep(600);
  await e3(`document.querySelector('.js-bk-cal [data-d]:not(:disabled)').click()`); await sleep(200);
  await e3(`document.querySelector('[data-t]').click()`); await sleep(500);
  ok(await e3(`!document.querySelector('[data-v=form]').hidden && document.querySelector('.bk form').keuze.value === 'Menu, 6 gangen'`), 'changed choice lands in form: ' + await e3(`document.querySelector('.bk form').keuze.value`));
  ws3.close();
}
