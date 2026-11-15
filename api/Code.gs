/**
 * Girasole - koppeling tussen website, beheer-app en deze Google Spreadsheet.
 * Reserveringen komen in het tabblad "Reserveringen"; menu en acties in "Instellingen".
 * Bij elke reservering stuurt Gmail een mail naar de eigenaar van dit script.
 *
 * Instellen: zie de uitleg in api/GOOGLE-INSTELLEN.md
 * Inlogcode: Projectinstellingen > Scripteigenschappen > PIN (minstens 6 tekens, letters en cijfers mag).
 */

// run once from the editor to grant permissions and create the spreadsheet
function setup() { resSheet(); tab('Instellingen', ['sleutel', 'waarde']); Logger.log(book().getUrl()); }

var CATS = ['voor', 'pasta', 'hoofd', 'pizza'];
var STATUS = ['nieuw', 'bevestigd', 'afgewezen'];
var COLS = ['id', 'aangemaakt', 'dag', 'tijd', 'personen', 'keuze', 'naam', 'telefoon', 'email', 'status'];
var DEFAULTS = {
 "menu": {
  "voor": [
   [
    "Carpaccio di Tonno",
    "Tonijn, balsamico, rode ui en kappertjes",
    "23"
   ],
   [
    "Tartare di Manzo",
    "Rundertartaar, schuim van Parmezaan en truffel",
    "24"
   ],
   [
    "Capesante al Burro Nocciola",
    "Coquilles, shiitake, groene asperge, citroencrème",
    "24"
   ],
   [
    "Animelle di Vitello",
    "Kalfszwezerik, knolselderij, doperwten, schorseneer",
    "25"
   ],
   [
    "Stracciatella",
    "Courgette scapece, gekonfijte tomaatjes, tarallini",
    "19"
   ],
   [
    "Tartara di Salmone",
    "Zalmtartaar, crème van brie, avocado, komkommer",
    "22"
   ]
  ],
  "pasta": [
   [
    "Tagliatelle al Ragù di Ossobuco",
    "Huisgemaakte tagliatelle, ragù van ossobuco",
    "23"
   ],
   [
    "Ravioli di Capesante e Gamberi",
    "Coquilles en garnalen, bisque van schaaldieren",
    "23"
   ],
   [
    "Orecchiette Luca's Kitchen",
    "Wilde paddenstoelen, ossenhaaspuntjes, kalfsjus",
    "23"
   ],
   [
    "Linguine all'Aragosta",
    "Halve kreeft, licht pittige tomatenjus, citroen",
    "31"
   ],
   [
    "Tagliolini alla Carbonara",
    "Verse tagliolini, op Luca’s manier",
    "22"
   ],
   [
    "Ravioli di Asparagi",
    "Asperges en mascarponecrème",
    "21"
   ],
   [
    "Zuppa di Pesce",
    "Rijk gevulde Italiaanse vissoep",
    "19"
   ]
  ],
  "hoofd": [
   [
    "Carré d'Agnello",
    "Lamsrack, zoetzure muntjus, compote van rode ui",
    "35"
   ],
   [
    "Filetto di Manzo",
    "Tournedos, saus van porcini en truffel, gnocchi",
    "34"
   ],
   [
    "Merluzzo in Guazzetto",
    "Kabeljauw, kerstomaatjes, Taggiasca olijven",
    "32"
   ],
   [
    "Gamberoni in Padella",
    "Gamba’s, gegrilde courgette, paprikacoulis",
    "29"
   ],
   [
    "Stufato di Manzo",
    "Gestoofde rundernek, polenta, fondue van Taleggio",
    "27"
   ],
   [
    "Salmone Affumicato Caldo",
    "Warmgerookte zalm, witlof, mierikswortel",
    "27"
   ]
  ],
  "pizza": [
   [
    "Margherita",
    "Tomaat, mozzarella, basilicum",
    "14,50"
   ],
   [
    "Girasole",
    "Gegrilde aubergine, courgette, paprika, ui",
    "17"
   ],
   [
    "Diavola",
    "Pittige salami, paprika, rode peper",
    "17"
   ],
   [
    "Stracciatella, Luca's favoriet",
    "Kappertjes, ansjovis, Taggiasca olijven",
    "18,50"
   ],
   [
    "Al Tartufo",
    "Room, zwarte truffel, rundergehakt, rucola",
    "18,75"
   ],
   [
    "Toscana",
    "Toscaanse worst, wilde paddenstoelen",
    "18,75"
   ]
  ]
 },
 "acties": [
  {
   "actief": true,
   "id": "kerst-2026",
   "van": "2026-11-01",
   "tot": "2026-12-31",
   "titel": [
    "Natale",
    "a Girasole"
   ],
   "tekst": "Vier de feestdagen aan de tafel van Luca. Reserveer op tijd voor de kerstdagen.",
   "knop": "Reserveer voor kerst",
   "link": "#reserveren",
   "afbeelding": "media/interieur.webp",
   "vertraging_ms": 1500
  }
 ]
};

function out(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function str(v, max) { return (typeof v === 'string' ? v.trim() : '').slice(0, max); }
function today() { return Utilities.formatDate(new Date(), 'Europe/Amsterdam', 'yyyy-MM-dd'); }

// standalone script: creates its own spreadsheet on first use and remembers it
function book() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.create('Girasole reserveringen');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}
function tab(name, header) {
  var sh = book().getSheetByName(name);
  if (!sh) {
    sh = book().insertSheet(name);
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sh.getRange('A:Z').setNumberFormat('@'); // keep dates, times and phone numbers as text
    sh.setFrozenRows(1);
  }
  return sh;
}
function resSheet() { return tab('Reserveringen', COLS); }

function getSetting(k) {
  var rows = tab('Instellingen', ['sleutel', 'waarde']).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) if (rows[i][0] === k) return JSON.parse(rows[i][1]);
  return DEFAULTS[k] || null;
}
function putSetting(k, v) {
  var sh = tab('Instellingen', ['sleutel', 'waarde']), rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) if (rows[i][0] === k) { sh.getRange(i + 1, 2).setValue(JSON.stringify(v)); return; }
  sh.appendRow([k, JSON.stringify(v)]);
}

// ---- validation (same rules as the website) ----
function checkBooking(b, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.dag || '')) return 'Ongeldige datum';
  var d = new Date(b.dag + 'T12:00:00Z'), max = new Date(now + 'T12:00:00Z');
  max.setUTCDate(max.getUTCDate() + 120);
  if (isNaN(d) || b.dag < now || d > max || d.getUTCDay() === 1) return 'Op deze datum kun je niet reserveren';
  var m = /^(\d{2}):(\d{2})$/.exec(b.tijd || ''), t = m ? +m[1] * 60 + +m[2] : -1;
  if (t < 17 * 60 || t > 20 * 60 || t % 15) return 'Ongeldige tijd';
  if (!(b.personen >= 1 && b.personen <= 12 && b.personen % 1 === 0)) return 'Ongeldig aantal personen';
  if (b.naam.length < 2) return 'Vul je naam in';
  if (!/^[0-9+()\-\s]{6,20}$/.test(b.telefoon)) return 'Vul een geldig telefoonnummer in';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.email)) return 'Vul een geldig e-mailadres in';
  return null;
}
function cleanMenu(m) {
  if (!m || typeof m !== 'object') return null;
  var res = {};
  for (var i = 0; i < CATS.length; i++) {
    var c = CATS[i];
    if (!Array.isArray(m[c]) || m[c].length > 60) return null;
    res[c] = m[c].map(function (d) { return [str(d && d[0], 80), str(d && d[1], 160), str(d && d[2], 12)]; }).filter(function (d) { return d[0]; });
    if (res[c].some(function (d) { return !/^\d{1,3}(,\d{2})?$/.test(d[2]); })) return null;
  }
  return res;
}
function cleanActies(a) {
  if (!Array.isArray(a) || a.length > 30) return null;
  var date = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; };
  var res = a.map(function (x) {
    x = x || {};
    return {
      id: str(x.id, 40).replace(/[^a-z0-9-]/g, '') || 'actie-' + Math.random().toString(36).slice(2, 8),
      actief: !!x.actief, van: date(x.van), tot: date(x.tot),
      titel: (Array.isArray(x.titel) ? x.titel : []).slice(0, 2).map(function (t) { return str(t, 40); }).filter(String),
      tekst: str(x.tekst, 300), knop: str(x.knop, 40) || 'Reserveren', link: '#reserveren',
      afbeelding: /^media\/[a-z0-9-]+\.(webp|jpg)$/.test(x.afbeelding) ? x.afbeelding : 'media/interieur.webp',
      vertraging_ms: 1500
    };
  });
  return res.every(function (x) { return x.titel.length; }) ? res : null;
}

// ---- abuse limits ----
// ponytail: Apps Script can't see the visitor's IP, so limits are global (a flood also pauses real
// bookings/logins for a while). Upgrade path: move the API to a Worker with per-IP limits.
function bump(key, ttl) { var c = CacheService.getScriptCache(), n = +(c.get(key) || 0) + 1; c.put(key, String(n), ttl); return n; }
function count(key) { return +(CacheService.getScriptCache().get(key) || 0); }

function pinError(pin) {
  var real = String(PropertiesService.getScriptProperties().getProperty('PIN') || '');
  if (real.length < 6 || real.length > 40 || /^(.)\1+$/.test(real) || '0123456789'.indexOf(real) >= 0 || '9876543210'.indexOf(real) >= 0)
    return 'De inlogcode is nog niet (goed) ingesteld in Google. Kies minstens 6 tekens, niet 000000 of 123456.';
  if (count('pinfail') >= 8) return 'Te veel pogingen. Probeer het over 15 minuten opnieuw.';
  if (String(pin || '') === real) return null;
  bump('pinfail', 900);
  return 'Onjuiste pincode';
}

function rowsToList() {
  var v = resSheet().getDataRange().getValues(), from = new Date(); from.setDate(from.getDate() - 30);
  var min = Utilities.formatDate(from, 'Europe/Amsterdam', 'yyyy-MM-dd'), list = [];
  for (var i = 1; i < v.length; i++) {
    var r = {}; COLS.forEach(function (c, j) { r[c] = v[i][j] instanceof Date ? Utilities.formatDate(v[i][j], 'Europe/Amsterdam', c === 'tijd' ? 'HH:mm' : 'yyyy-MM-dd') : v[i][j]; });
    r.personen = +r.personen; r.telefoon = String(r.telefoon);
    if (r.dag >= min) list.push(r);
  }
  return list.sort(function (a, b) { return (a.dag + a.tijd) < (b.dag + b.tijd) ? -1 : 1; });
}

// ---- mails (table layout + inline styles: works in Outlook, Gmail and phone apps) ----
var SITE = 'https://semdesnoo.github.io/girasole-breda/';
var DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function langeDatum(dag) {
  var x = new Date(dag + 'T12:00:00Z'), d = DAGEN[x.getUTCDay()];
  return d.charAt(0).toUpperCase() + d.slice(1) + ' ' + x.getUTCDate() + ' ' + MAANDEN[x.getUTCMonth()] + ' ' + x.getUTCFullYear();
}
function gasten(n) { return n + (n === 1 ? ' gast' : ' gasten'); }

var F = "font-family:Georgia,'Times New Roman',serif;", S = 'font-family:Helvetica,Arial,sans-serif;';
function block(inner, bg) {
  return '<tr><td style="background:' + (bg || '#FFFBF2') + ';padding:30px 34px;border-top:1px solid #EFE2CC">' + inner + '</td></tr>';
}
function btn(href, label, solid) {
  return '<a href="' + href + '" style="display:inline-block;' + S + 'font-size:13px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:13px 24px;border-radius:999px;margin:4px;' +
    (solid ? 'background:#F5B800;color:#3A0B14;' : 'border:1px solid #5B0A19;color:#5B0A19;') + '">' + label + '</a>';
}
function page(preheader, rows) {
  return '<!doctype html><html><body style="margin:0;padding:0;background:#F3E6D0">' +
    '<div style="display:none;max-height:0;overflow:hidden">' + esc(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3E6D0"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-radius:18px;overflow:hidden;text-align:center;color:#3A0B14">' +
    '<tr><td style="background:#FDF5E1;padding:30px 20px 26px;border-bottom:4px solid #5B0A19">' +
    '<a href="' + SITE + '"><img src="' + SITE + 'media/logo-mail.png" width="300" alt="GIRASOLE by Luca&#39;s Kitchen" style="display:inline-block;width:300px;max-width:85%;height:auto;border:0"></a></td></tr>' +
    rows +
    '<tr><td style="background:#3A0B14;padding:22px;' + S + 'font-size:12px;line-height:1.7;color:#D6C3BD">Girasole by Luca&#39;s Kitchen · Sophiastraat 14, 4811 EK Breda<br>' +
    '<a href="tel:+31765224437" style="color:#F5B800;text-decoration:none">076 522 4437</a> · <a href="' + SITE + '" style="color:#F5B800;text-decoration:none">girasole website</a></td></tr>' +
    '</table></td></tr></table></body></html>';
}
function details(b) {
  return '<div style="' + S + 'font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#B3262E">Je reservering</div>' +
    '<div style="' + F + 'font-size:28px;margin:12px 0 6px">' + esc(langeDatum(b.dag)) + '</div>' +
    '<div style="' + S + 'font-size:17px;font-weight:bold">' + gasten(b.personen) + ' · ' + esc(b.tijd) + ' uur</div>' +
    '<div style="' + S + 'font-size:15px;color:#6B4A4E;margin-top:6px">' + esc(b.keuze) + '</div>';
}

function mailGast(b, id, replyTo) {
  var html = page('We bellen of mailen je nog even om je tafel te bevestigen.',
    block('<div style="' + F + 'font-style:italic;font-size:30px;color:#B3262E">Grazie, ' + esc(b.naam.split(' ')[0]) + '!</div>' +
      '<p style="' + S + 'font-size:15px;line-height:1.6;color:#6B4A4E;margin:12px 0 0">We hebben je aanvraag goed ontvangen.</p>') +
    block(details(b)) +
    block('<div style="' + F + 'font-size:22px;margin-bottom:10px">Let op: we nemen nog even contact op</div>' +
      '<p style="' + S + 'font-size:15px;line-height:1.65;color:#4E2A30;margin:0">Je reservering is pas definitief nadat we contact met je hebben gehad. ' +
      'We bellen je even, of sturen je een mailtje als we je niet te pakken krijgen. Zo weten we zeker dat er een plek voor je klaarstaat. ' +
      'Houd je telefoon en je mail daarom even in de gaten, we laten zo snel mogelijk van ons horen.</p>', '#FDF0C9') +
    block('<div style="' + F + 'font-size:22px;margin-bottom:10px">Iets wijzigen?</div>' +
      '<p style="' + S + 'font-size:15px;line-height:1.65;color:#6B4A4E;margin:0 0 16px">Kun je toch niet, of komen jullie met meer of minder personen? Bel ons even of beantwoord deze mail, dan passen we het graag aan.</p>' +
      btn('tel:+31765224437', 'Bel ons', true) + btn('https://maps.google.com/?q=Sophiastraat+14+4811+EK+Breda', 'Route', false)) +
    block('<div style="' + F + 'font-size:22px;margin-bottom:10px">Openingstijden</div>' +
      '<p style="' + S + 'font-size:15px;line-height:1.65;color:#6B4A4E;margin:0">Dinsdag t/m zondag vanaf 17:00<br>Maandag gesloten</p>' +
      '<p style="' + S + 'font-size:12px;color:#9A7F7F;margin:18px 0 0">Aanvraagnummer ' + esc(id) + '</p>'));
  MailApp.sendEmail({ to: b.email, replyTo: replyTo, name: "Girasole by Luca's Kitchen",
    subject: 'Je reserveringsaanvraag bij Girasole: ' + langeDatum(b.dag).toLowerCase() + ', ' + b.tijd, htmlBody: html });
}

function mailEigenaar(b, id, to) {
  var tel = b.telefoon.replace(/[^0-9+]/g, '');
  var row = function (k, v) { return '<tr><td style="' + S + 'font-size:13px;color:#876A6C;padding:8px 0;text-align:left;border-bottom:1px dashed #EFE2CC">' + k + '</td><td style="' + S + 'font-size:15px;font-weight:bold;padding:8px 0;text-align:right;border-bottom:1px dashed #EFE2CC">' + v + '</td></tr>'; };
  var html = page(gasten(b.personen) + ' op ' + langeDatum(b.dag) + ' om ' + b.tijd,
    block('<div style="display:inline-block;background:#F5B800;color:#3A0B14;' + S + 'font-size:12px;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:999px">Nieuwe reservering</div>' + '<div style="height:18px"></div>' + details(b)) +
    block('<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
      row('Naam', esc(b.naam)) + row('Telefoon', '<a href="tel:' + esc(tel) + '" style="color:#5B0A19">' + esc(b.telefoon) + '</a>') +
      row('E-mail', '<a href="mailto:' + esc(b.email) + '" style="color:#5B0A19">' + esc(b.email) + '</a>') + row('Aanvraagnummer', esc(id)) + '</table>') +
    block('<p style="' + S + 'font-size:15px;line-height:1.6;color:#4E2A30;margin:0 0 16px">Bel de gast om de tafel te bevestigen en zet de reservering daarna op <b>Bevestigd</b> in de app.</p>' +
      btn('tel:' + esc(tel), 'Bel ' + esc(b.naam.split(' ')[0]), true) + btn(SITE + 'beheer/', 'Open de app', false), '#FDF0C9'));
  MailApp.sendEmail({ to: to, replyTo: b.email, name: 'Girasole reserveringen',
    subject: 'Nieuwe reservering: ' + gasten(b.personen) + ', ' + langeDatum(b.dag).toLowerCase() + ' om ' + b.tijd, htmlBody: html });
}

function mails(b, id) {
  var owner = PropertiesService.getScriptProperties().getProperty('MAIL_TO') || Session.getEffectiveUser().getEmail();
  try { if (owner) mailEigenaar(b, id, owner); } catch (x) {}
  try { mailGast(b, id, owner); } catch (x) {}
}

// ---- endpoints ----
function doGet(e) {
  if ((e.parameter || {}).action === 'site') return out({ menu: getSetting('menu'), acties: getSetting('acties') });
  return out({ error: 'Onbekende actie' });
}

function doPost(e) {
  var raw; try { raw = JSON.parse(e.postData.contents); } catch (x) { return out({ error: 'Ongeldig verzoek' }); }
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { return out(handle(raw)); }
  catch (x) { return out({ error: 'Er ging iets mis op de server.' }); }
  finally { lock.releaseLock(); }
}

function handle(raw) {
  if (raw.action === 'reserveer') {
    if (str(raw['bot-field'], 10)) return { ok: true }; // honeypot
    if (count('res') >= 40) return { error: 'Even te veel aanvragen. Bel ons op 076 522 4437.' };
    var b = { dag: str(raw.dag, 10), tijd: str(raw.tijd, 5), personen: parseInt(raw.personen, 10), keuze: str(raw.keuze, 60) || 'À la carte',
      naam: str(raw.naam, 80), telefoon: str(raw.telefoon, 20), email: str(raw.email, 120) };
    var err = checkBooking(b, today());
    if (err) return { error: err };
    bump('res', 3600);
    var id = String(Date.now());
    resSheet().appendRow([id, new Date().toISOString(), "'" + b.dag, "'" + b.tijd, b.personen, b.keuze, "'" + b.naam, "'" + b.telefoon, b.email, 'nieuw']);
    mails(b, id); // each mail is wrapped in try: a mail hiccup must not lose the booking
    return { ok: true, id: id };
  }

  var denied = pinError(raw.pin);
  if (denied) return { error: denied, auth: false };

  if (raw.action === 'check') return { ok: true };
  if (raw.action === 'lijst') return { lijst: rowsToList() };
  if (raw.action === 'status') {
    if (STATUS.indexOf(raw.status) < 0) return { error: 'Ongeldige status' };
    var sh = resSheet(), ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
    for (var i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(raw.id)) { sh.getRange(i + 1, COLS.indexOf('status') + 1).setValue(raw.status); return { ok: true }; }
    return { error: 'Reservering niet gevonden' };
  }
  if (raw.action === 'menu') {
    var menu = cleanMenu(raw.data);
    if (!menu) return { error: 'Menu klopt niet. Controleer de prijzen (bijv. 24 of 18,50).' };
    putSetting('menu', menu); return { ok: true };
  }
  if (raw.action === 'acties') {
    var acties = cleanActies(raw.data);
    if (!acties) return { error: 'Elke actie heeft minstens een titel nodig.' };
    putSetting('acties', acties); return { ok: true };
  }
  return { error: 'Onbekende actie' };
}
