/**
 * Girasole - koppeling tussen website, beheer-app en deze Google Spreadsheet.
 * Reserveringen komen in het tabblad "Reserveringen"; menu en acties in "Instellingen".
 * Bij elke reservering stuurt Gmail een mail naar de eigenaar van dit script.
 *
 * Instellen: zie de uitleg in api/GOOGLE-INSTELLEN.md
 * Pincode: Projectinstellingen > Scripteigenschappen > PIN (6-12 cijfers).
 */

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

function book() { return SpreadsheetApp.getActiveSpreadsheet(); }
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
  if (!/^\d{6,12}$/.test(real) || /^(\d)\1+$/.test(real) || '0123456789'.indexOf(real) >= 0 || '9876543210'.indexOf(real) >= 0)
    return 'De pincode is nog niet (goed) ingesteld in Google. Kies 6-12 cijfers, niet 000000 of 123456.';
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

function mailOwner(b) {
  var to = PropertiesService.getScriptProperties().getProperty('MAIL_TO') || Session.getEffectiveUser().getEmail();
  if (!to) return;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var rows = [['Datum', b.dag], ['Tijd', b.tijd], ['Personen', b.personen], ['Keuze', b.keuze], ['Naam', b.naam], ['Telefoon', b.telefoon], ['E-mail', b.email]];
  MailApp.sendEmail({
    to: to, replyTo: b.email, name: 'Girasole website',
    subject: 'Nieuwe reservering: ' + b.personen + 'p op ' + b.dag + ' om ' + b.tijd,
    htmlBody: '<h2 style="font-family:Georgia,serif;color:#5B0A19">Nieuwe reservering</h2><table cellpadding="6">' +
      rows.map(function (r) { return '<tr><td style="color:#876A6C">' + r[0] + '</td><td><b>' + esc(r[1]) + '</b></td></tr>'; }).join('') +
      '</table><p>Bevestig of wijs af in de Girasole-app.</p>'
  });
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
    resSheet().appendRow([id, new Date().toISOString(), b.dag, b.tijd, b.personen, b.keuze, b.naam, b.telefoon, b.email, 'nieuw']);
    try { mailOwner(b); } catch (x) {} // a mail hiccup must not lose the booking
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
