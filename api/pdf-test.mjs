// Browser check: logout sits far right (desktop); upload a PDF in the app -> site "Volledige kaart" points at it.
const SH = process.env.SHOTS || '.', PIN = process.env.PIN || '246810';
const ws = new WebSocket((await (await fetch('http://127.0.0.1:9333/json')).json()).find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r); let id = 0; const pend = {};
ws.onmessage = m => { const x = JSON.parse(m.data); if (pend[x.id]) { pend[x.id](x.result); delete pend[x.id]; } };
const cdp = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async n => { const r = await cdp('Page.captureScreenshot'); (await import('fs')).writeFileSync(`${SH}/${n}.png`, Buffer.from(r.data, 'base64')); };
let fails = 0; const ok = (c, n, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + n, x); };
const pdfPath = SH + '/test-kaart.pdf';
(await import('fs')).writeFileSync(pdfPath, '%PDF-1.4\n% Girasole test\n');

for (const W of [1440, 390]) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: 900, deviceScaleFactor: 1, mobile: W < 700 });
  await cdp('Page.navigate', { url: 'http://127.0.0.1:8767/beheer/' }); await sleep(1800);
  if (await ev(`!document.querySelector('.js-login').hidden`)) { await ev(`(()=>{const f=document.querySelector('.js-login-form');f.pin.value=${JSON.stringify(PIN)};f.requestSubmit()})()`); await sleep(1500); }
  const pos = await ev(`(()=>{const b=document.querySelector('.js-logout').getBoundingClientRect(), t=[...document.querySelectorAll('nav.tabs button')].map(x=>x.getBoundingClientRect().right);return {right: innerWidth-b.right, rightOfTabs: b.left >= Math.max(...t) - 1 || ${W} < 760}})()`);
  ok(pos.right < 40 && pos.rightOfTabs, `logout far right (${W})`, JSON.stringify(pos));
  await ev(`document.querySelector('[data-go="menu"]').click()`); await sleep(700);
  await shot('pdf-app-' + W);
}

// upload via the real file input
const doc = await cdp('DOM.getDocument');
const node = await cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '.js-pdf' });
await cdp('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [pdfPath] });
await ev(`document.querySelector('.js-pdf').dispatchEvent(new Event('change'))`); await sleep(1500);
const info = await ev(`document.querySelector('.js-pdf-info').textContent`);
ok(/test-kaart\.pdf/.test(info) && !(await ev(`document.querySelector('.js-pdf-open').hidden`)), 'app shows uploaded pdf', info);
await shot('pdf-app-uploaded');

await cdp('Page.navigate', { url: 'http://127.0.0.1:8767/index.html' }); await sleep(3000);
const hrefs = await ev(`[...document.querySelectorAll('a')].filter(a=>/Volledige kaart/.test(a.textContent)).map(a=>a.href)`);
ok(hrefs.length === 2 && hrefs.every(h => h.startsWith('https://drive.google.com/file/d/')), 'site "Volledige kaart" uses uploaded pdf', hrefs.join(' '));

await fetch('http://127.0.0.1:8787', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ action: 'kaartpdf', pin: PIN, verwijder: true }) });
await cdp('Page.reload'); await sleep(3000);
ok((await ev(`[...document.querySelectorAll('a')].filter(a=>/Volledige kaart/.test(a.textContent)).every(a=>/Menu-restaurant\.pdf/.test(a.href))`)), 'without pdf the standard card returns');
await cdp('Emulation.clearDeviceMetricsOverride');
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); ws.close(); process.exit(fails ? 1 : 0);
