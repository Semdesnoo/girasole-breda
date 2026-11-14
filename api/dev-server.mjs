// Local stand-in for Google Apps Script: runs api/Code.gs unchanged with in-memory
// Spreadsheet/Mail/Cache, served like a web app (GET ?action=..., POST text/plain JSON).
// Usage: PIN=246810 node api/dev-server.mjs   -> http://127.0.0.1:8787
// Test hooks: GET /__mails (sent mails), GET /__sheet (reservations tab).
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';

const sheets = {}, mails = [], cache = {};
function Sheet(name) {
  const rows = [];
  const range = (r, c, nr = 1, nc = 1) => ({
    setValues(v) { v.forEach((row, i) => row.forEach((x, j) => { (rows[r - 1 + i] ||= [])[c - 1 + j] = x; })); return this; },
    getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (rows[r - 1 + i] || [])[c - 1 + j] ?? '')); },
    setValue(x) { (rows[r - 1] ||= [])[c - 1] = x; return this; },
    setFontWeight() { return this; }, setNumberFormat() { return this; },
  });
  return {
    name, rows,
    getRange: (a, ...rest) => typeof a === 'string' ? range(1, 1) : range(a, ...rest),
    getDataRange() { const nc = Math.max(1, ...rows.map(r => r.length)); return range(1, 1, rows.length, nc); },
    appendRow(r) { rows.push(r.map(x => typeof x === 'number' ? x : String(x))); },
    getLastRow: () => rows.length, setFrozenRows() {},
  };
}
const fmt = (d, tz, f) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute);
};
const ctx = vm.createContext({
  console, JSON, Math, Date, String, Array, Object, isNaN, parseInt,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = Sheet(n)) }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
  Utilities: { formatDate: fmt },
  CacheService: { getScriptCache: () => ({ get: k => (cache[k] && cache[k].t > Date.now() ? cache[k].v : null), put: (k, v, ttl) => { cache[k] = { v, t: Date.now() + ttl * 1000 }; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => process.env[k] || null }) },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'restaurant@example.nl' }) },
  MailApp: { sendEmail: m => mails.push(m) },
});
vm.runInContext(fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8'), ctx);

const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__mails') return send(res, 200, mails);
  if (u.pathname === '/__sheet') return send(res, 200, (sheets.Reserveringen || { rows: [] }).rows);
  if (req.method === 'OPTIONS') return send(res, 405, { error: 'Apps Script has no preflight; use text/plain POST without custom headers' });
  if (req.method === 'GET') return send(res, 200, ctx.doGet({ parameter: Object.fromEntries(u.searchParams) }).s);
  if (req.method === 'POST') {
    if (/application\/json/.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'would trigger CORS preflight on Apps Script' });
    let b = ''; req.on('data', c => b += c); req.on('end', () => send(res, 200, ctx.doPost({ postData: { contents: b } }).s));
    return;
  }
  send(res, 405, {});
}).listen(+(process.env.PORT || 8787), '127.0.0.1', () => console.log('apps-script stand-in on :' + (process.env.PORT || 8787)));
