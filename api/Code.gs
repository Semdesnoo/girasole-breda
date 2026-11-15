/**
 * Girasole - koppeling tussen website, beheer-app en deze Google Spreadsheet.
 * Reserveringen komen in het tabblad "Reserveringen"; menu en acties in "Instellingen".
 * Bij elke reservering stuurt Gmail een mail naar de eigenaar van dit script.
 *
 * Instellen: zie de uitleg in api/GOOGLE-INSTELLEN.md
 * Inlogcode: Projectinstellingen > Scripteigenschappen > PIN (minstens 6 tekens, letters en cijfers mag).
 */

// Run ONCE from the editor at installation. It asks Google for every permission the script will
// ever need (fixed list in appsscript.json), creates the spreadsheet and installs the daily check.
// Rule: never use a Google service outside appsscript.json "oauthScopes", or the owner must re-authorize.
function setup() {
  controle();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'controle') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('controle').timeBased().everyDays(1).atHour(6).create();
  Logger.log('Klaar. Spreadsheet: ' + book().getUrl());
}
// Daily self-test. If anything breaks (permission revoked, sheet gone), this run fails and Google
// itself mails the account owner a failure report, so problems never go unnoticed.
function controle() {
  resSheet(); tab('Instellingen', ['sleutel', 'waarde']);
  DriveApp.getRootFolder();
  MailApp.getRemainingDailyQuota();
  var real = String(PropertiesService.getScriptProperties().getProperty('PIN') || '');
  if (real.length < 6) throw new Error('De inlogcode (PIN) is nog niet ingesteld in Projectinstellingen > Scripteigenschappen.');
}

var CATS = ['voor', 'pasta', 'hoofd', 'pizza'];
var STATUS = ['nieuw', 'bevestigd', 'afgewezen'];
var COLS = ['id', 'aangemaakt', 'dag', 'tijd', 'personen', 'keuze', 'naam', 'telefoon', 'email', 'status', 'token', 'vorige'];
var KEUZES = ['À la carte', 'Menu, 4 gangen', 'Menu, 6 gangen', 'De Huiskamer'];
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
function resSheet() {
  var sh = tab('Reserveringen', COLS), head = sh.getRange(1, 1, 1, COLS.length).getValues()[0];
  if (head.join() !== COLS.join()) sh.getRange(1, 1, 1, COLS.length).setValues([COLS]); // older sheets: add new columns
  return sh;
}

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

function rowObj(row) {
  var r = {}; COLS.forEach(function (c, j) { var x = row[j]; r[c] = x instanceof Date ? Utilities.formatDate(x, 'Europe/Amsterdam', c === 'tijd' ? 'HH:mm' : 'yyyy-MM-dd') : (x == null ? '' : x); });
  r.personen = +r.personen; r.telefoon = String(r.telefoon); r.id = String(r.id);
  return r;
}
function rowsToList() {
  var v = resSheet().getDataRange().getValues(), from = new Date(); from.setDate(from.getDate() - 30);
  var min = Utilities.formatDate(from, 'Europe/Amsterdam', 'yyyy-MM-dd'), list = [];
  for (var i = 1; i < v.length; i++) {
    var r = rowObj(v[i]); delete r.token;
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
function details(b, label) {
  return '<div style="' + S + 'font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#B3262E">' + (label || 'Je reservering') + '</div>' +
    '<div style="' + F + 'font-size:28px;margin:12px 0 6px">' + esc(langeDatum(b.dag)) + '</div>' +
    '<div style="' + S + 'font-size:17px;font-weight:bold">' + gasten(b.personen) + ' · ' + esc(b.tijd) + ' uur</div>' +
    '<div style="' + S + 'font-size:15px;color:#6B4A4E;margin-top:6px">' + esc(b.keuze) + '</div>';
}

function mailGast(b, id, token, replyTo, kind, was) {
  var first = esc(b.naam.split(' ')[0]), link = SITE + 'wijzig.html?id=' + encodeURIComponent(id) + '&t=' + token;
  var head = {
    nieuw: ['Grazie, ' + first + '!', 'We hebben je aanvraag goed ontvangen.'],
    gewijzigd: ['Je wijziging is binnen', 'Dank je, ' + first + '. Dit is je nieuwe aanvraag.'],
    geannuleerd: ['Je reservering is geannuleerd', 'Jammer dat je er niet bij kunt zijn, ' + first + '. Hopelijk tot een andere keer!'],
    bevestigd: ['Tot snel, ' + first + '!', 'Goed nieuws: je reservering is bevestigd. Je tafel staat voor je klaar.']
  }[kind];
  var rows = block('<div style="' + F + 'font-style:italic;font-size:30px;color:#B3262E">' + head[0] + '</div>' +
    '<p style="' + S + 'font-size:15px;line-height:1.6;color:#6B4A4E;margin:12px 0 0">' + head[1] + '</p>');
  if (kind === 'geannuleerd') {
    rows += block('<div style="' + S + 'font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#B3262E">Geannuleerd</div>' +
      '<div style="' + S + 'font-size:16px;color:#9A7F7F;text-decoration:line-through;margin-top:10px">' + esc(was) + '</div>') +
      block('<p style="' + S + 'font-size:15px;line-height:1.65;color:#6B4A4E;margin:0 0 16px">Toch komen? Je bent altijd welkom om opnieuw te reserveren.</p>' +
        btn(SITE + '#reserveren', 'Opnieuw reserveren', true));
  } else {
    rows += block(details(b, kind === 'gewijzigd' ? 'Je nieuwe reservering' : kind === 'bevestigd' ? 'Bevestigd' : '') + (was ? '<div style="' + S + 'font-size:13px;color:#9A7F7F;margin-top:12px">Was: <span style="text-decoration:line-through">' + esc(was) + '</span></div>' : '')) +
      (kind === 'bevestigd' ? '' : block('<div style="' + F + 'font-size:22px;margin-bottom:10px">Let op: we nemen nog even contact op</div>' +
        '<p style="' + S + 'font-size:15px;line-height:1.65;color:#4E2A30;margin:0">Je reservering is pas definitief nadat we contact met je hebben gehad. ' +
        'We bellen je even, of sturen je een mailtje als we je niet te pakken krijgen. Zo weten we zeker dat er een plek voor je klaarstaat. ' +
        'Houd je telefoon en je mail daarom even in de gaten, we laten zo snel mogelijk van ons horen.</p>', '#FDF0C9')) +
      block('<div style="' + F + 'font-size:22px;margin-bottom:10px">Iets wijzigen?</div>' +
        '<p style="' + S + 'font-size:15px;line-height:1.65;color:#6B4A4E;margin:0 0 16px">Andere dag, tijd of aantal personen? Of kun je toch niet? Pas je reservering hier zelf aan, of bel ons even.</p>' +
        btn(link, 'Wijzig reservering', true) + btn('tel:+31765224437', 'Bel ons', false));
  }
  rows += block('<div style="' + F + 'font-size:22px;margin-bottom:10px">Openingstijden</div>' +
    '<p style="' + S + 'font-size:15px;line-height:1.65;color:#6B4A4E;margin:0">Dinsdag t/m zondag vanaf 17:00<br>Maandag gesloten</p>' +
    '<p style="' + S + 'font-size:12px;color:#9A7F7F;margin:18px 0 0">Aanvraagnummer ' + esc(id) + '</p>');
  var subject = {
    nieuw: 'Je reserveringsaanvraag bij Girasole: ' + langeDatum(b.dag).toLowerCase() + ', ' + b.tijd,
    gewijzigd: 'Je wijziging bij Girasole: ' + langeDatum(b.dag).toLowerCase() + ', ' + b.tijd,
    geannuleerd: 'Je reservering bij Girasole is geannuleerd',
    bevestigd: 'Je reservering bij Girasole is bevestigd: ' + langeDatum(b.dag).toLowerCase() + ', ' + b.tijd
  }[kind];
  MailApp.sendEmail({ to: b.email, replyTo: replyTo, name: "Girasole by Luca's Kitchen", subject: subject,
    htmlBody: page({ geannuleerd: 'Je reservering is geannuleerd.', bevestigd: 'Je tafel staat voor je klaar.' }[kind] || 'We bellen of mailen je nog even om je tafel te bevestigen.', rows) });
}

function mailEigenaar(b, id, to, kind, was) {
  var tel = b.telefoon.replace(/[^0-9+]/g, '');
  var row = function (k, v) { return '<tr><td style="' + S + 'font-size:13px;color:#876A6C;padding:8px 0;text-align:left;border-bottom:1px dashed #EFE2CC">' + k + '</td><td style="' + S + 'font-size:15px;font-weight:bold;padding:8px 0;text-align:right;border-bottom:1px dashed #EFE2CC">' + v + '</td></tr>'; };
  var badge = { nieuw: ['Nieuwe reservering', '#F5B800', '#3A0B14'], gewijzigd: ['Gewijzigd door de gast', '#E07B00', '#FFFFFF'], geannuleerd: ['Geannuleerd door de gast', '#B3262E', '#FFFFFF'] }[kind];
  var main = kind === 'geannuleerd'
    ? '<div style="' + S + 'font-size:17px;color:#9A7F7F;text-decoration:line-through;margin-top:4px">' + esc(was) + '</div>'
    : details(b, kind === 'gewijzigd' ? 'Nieuwe gegevens' : 'Reservering') + (was ? '<div style="' + S + 'font-size:13px;color:#9A7F7F;margin-top:12px">Was: <span style="text-decoration:line-through">' + esc(was) + '</span></div>' : '');
  var todo = { nieuw: 'Bel de gast om de tafel te bevestigen en zet de reservering daarna op <b>Bevestigd</b> in de app.',
    gewijzigd: 'De gast heeft de reservering aangepast. Kijk of het past, bel even en zet hem daarna weer op <b>Bevestigd</b> in de app.',
    geannuleerd: 'De tafel is weer vrij. Je hoeft niets te doen.' }[kind];
  var html = page(badge[0] + ': ' + esc(b.naam),
    block('<div style="display:inline-block;background:' + badge[1] + ';color:' + badge[2] + ';' + S + 'font-size:12px;letter-spacing:2px;text-transform:uppercase;padding:6px 14px;border-radius:999px">' + badge[0] + '</div><div style="height:18px"></div>' + main) +
    block('<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
      row('Naam', esc(b.naam)) + row('Telefoon', '<a href="tel:' + esc(tel) + '" style="color:#5B0A19">' + esc(b.telefoon) + '</a>') +
      row('E-mail', '<a href="mailto:' + esc(b.email) + '" style="color:#5B0A19">' + esc(b.email) + '</a>') + row('Aanvraagnummer', esc(id)) + '</table>') +
    block('<p style="' + S + 'font-size:15px;line-height:1.6;color:#4E2A30;margin:0 0 16px">' + todo + '</p>' +
      (kind === 'geannuleerd' ? '' : btn('tel:' + esc(tel), 'Bel ' + esc(b.naam.split(' ')[0]), true)) + btn(SITE + 'beheer/', 'Open de app', false), '#FDF0C9'));
  var subject = { nieuw: 'Nieuwe reservering: ', gewijzigd: 'Gewijzigde reservering: ', geannuleerd: 'Geannuleerd: ' }[kind] +
    (kind === 'geannuleerd' ? b.naam + ', ' + was : gasten(b.personen) + ', ' + langeDatum(b.dag).toLowerCase() + ' om ' + b.tijd);
  MailApp.sendEmail({ to: to, replyTo: b.email, name: 'Girasole reserveringen', subject: subject, htmlBody: html });
}

function mails(b, id, token, kind, was) {
  var owner = PropertiesService.getScriptProperties().getProperty('MAIL_TO') || Session.getEffectiveUser().getEmail();
  try { if (owner) mailEigenaar(b, id, owner, kind, was); } catch (x) {}
  try { mailGast(b, id, token, owner, kind, was); } catch (x) {}
}

// ---- guest changes via the secret link in their mail ----
function findBooking(id, token) {
  if (!id || !/^[a-f0-9]{32}$/.test(String(token || ''))) return null;
  var sh = resSheet(), v = sh.getDataRange().getValues(), t = COLS.indexOf('token');
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(id) && String(v[i][t]) === String(token)) return { row: i + 1, r: rowObj(v[i]) };
  return null;
}
function summary(r) { return langeDatum(r.dag) + ', ' + r.tijd + ', ' + gasten(r.personen) + ', ' + r.keuze; }
function guestEdit(raw) {
  if (count('tok') >= 40) return { error: 'Even te veel pogingen. Bel ons op 076 522 4437.' };
  var f = findBooking(str(raw.id, 20), str(raw.t, 40));
  if (!f) { bump('tok', 900); return { error: 'We kunnen deze reservering niet vinden. Bel ons op 076 522 4437.' }; }
  var r = f.r, closed = r.status === 'geannuleerd' || r.status === 'afgewezen' || r.dag < today();
  if (raw.action === 'mijn') return { res: { dag: r.dag, tijd: r.tijd, personen: r.personen, keuze: r.keuze, naam: r.naam, status: r.status, dicht: closed } };
  if (closed) return { error: 'Deze reservering kan niet meer online gewijzigd worden. Bel ons op 076 522 4437.' };
  var sh = resSheet(), col = function (c) { return COLS.indexOf(c) + 1; }, was = summary(r);
  if (raw.annuleer === true) {
    sh.getRange(f.row, col('status')).setValue('geannuleerd');
    sh.getRange(f.row, col('vorige')).setValue("'" + was);
    mails(r, r.id, '', 'geannuleerd', was);
    return { ok: true, status: 'geannuleerd' };
  }
  var nb = { dag: str(raw.dag, 10), tijd: str(raw.tijd, 5), personen: parseInt(raw.personen, 10), keuze: str(raw.keuze, 40), naam: r.naam, telefoon: r.telefoon, email: r.email };
  if (KEUZES.indexOf(nb.keuze) < 0) nb.keuze = 'À la carte';
  if (nb.personen === 12) nb.keuze = 'De Huiskamer';
  var err = checkBooking(nb, today());
  if (err) return { error: err };
  if (nb.dag === r.dag && nb.tijd === r.tijd && nb.personen === r.personen && nb.keuze === r.keuze) return { error: 'Je hebt nog niets gewijzigd.' };
  sh.getRange(f.row, col('dag')).setValue("'" + nb.dag);
  sh.getRange(f.row, col('tijd')).setValue("'" + nb.tijd);
  sh.getRange(f.row, col('personen')).setValue(nb.personen);
  sh.getRange(f.row, col('keuze')).setValue(nb.keuze);
  sh.getRange(f.row, col('status')).setValue('gewijzigd');
  sh.getRange(f.row, col('vorige')).setValue("'" + was);
  mails(nb, r.id, str(raw.t, 40), 'gewijzigd', was);
  return { ok: true, status: 'gewijzigd' };
}

// ---- full menu as PDF (uploaded in the app, shown as "Volledige kaart" on the site) ----
function kaartPdf(raw) {
  var old = getSetting('kaartPdf');
  if (raw.verwijder === true) {
    if (old && old.id) try { DriveApp.getFileById(old.id).setTrashed(true); } catch (x) {}
    putSetting('kaartPdf', null); return { ok: true, kaartPdf: null };
  }
  var b64 = String(raw.data || '');
  if (b64.length > 14000000) return { error: 'Het bestand is te groot (max 10 MB).' };
  var bytes; try { bytes = Utilities.base64Decode(b64); } catch (x) { return { error: 'Dit bestand kan niet gelezen worden.' }; }
  if (bytes.length < 5 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== '%PDF') return { error: 'Alleen PDF-bestanden zijn toegestaan.' };
  var naam = str(raw.naam, 80).replace(/[^\w .()-]/g, '') || 'Menukaart.pdf';
  var file = DriveApp.createFile(Utilities.newBlob(bytes, 'application/pdf', 'Girasole - ' + naam));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  if (old && old.id) try { DriveApp.getFileById(old.id).setTrashed(true); } catch (x) {}
  var info = { id: file.getId(), naam: naam, datum: today(), url: 'https://drive.google.com/file/d/' + file.getId() + '/view' };
  putSetting('kaartPdf', info);
  return { ok: true, kaartPdf: info };
}

// ---- endpoints ----
function doGet(e) {
  if ((e.parameter || {}).action === 'site') return out({ menu: getSetting('menu'), acties: getSetting('acties'), kaartPdf: getSetting('kaartPdf') });
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
    var id = String(Date.now()), token = Utilities.getUuid().replace(/-/g, '');
    if (b.personen === 12) b.keuze = 'De Huiskamer';
    resSheet().appendRow([id, new Date().toISOString(), "'" + b.dag, "'" + b.tijd, b.personen, b.keuze, "'" + b.naam, "'" + b.telefoon, b.email, 'nieuw', token, '']);
    mails(b, id, token, 'nieuw', ''); // each mail is wrapped in try: a mail hiccup must not lose the booking
    return { ok: true, id: id };
  }

  if (raw.action === 'mijn' || raw.action === 'wijzig') return guestEdit(raw);

  var denied = pinError(raw.pin);
  if (denied) return { error: denied, auth: false };

  if (raw.action === 'check') return { ok: true };
  if (raw.action === 'lijst') return { lijst: rowsToList() };
  if (raw.action === 'status') {
    if (STATUS.indexOf(raw.status) < 0) return { error: 'Ongeldige status' };
    var sh = resSheet(), ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
    for (var i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(raw.id)) {
      var r = rowObj(sh.getRange(i + 1, 1, 1, COLS.length).getValues()[0]);
      sh.getRange(i + 1, COLS.indexOf('status') + 1).setValue(raw.status);
      // guest gets a confirmation mail once per confirm (again after a change, never twice for one click)
      var mailed = false;
      if (raw.status === 'bevestigd' && r.status !== 'bevestigd' && r.email) {
        var owner = PropertiesService.getScriptProperties().getProperty('MAIL_TO') || Session.getEffectiveUser().getEmail();
        try { mailGast(r, r.id, r.token, owner, 'bevestigd'); mailed = true; } catch (x) {}
      }
      return { ok: true, gemaild: mailed };
    }
    return { error: 'Reservering niet gevonden' };
  }
  if (raw.action === 'menu') {
    var menu = cleanMenu(raw.data);
    if (!menu) return { error: 'Menu klopt niet. Controleer de prijzen (bijv. 24 of 18,50).' };
    putSetting('menu', menu); return { ok: true };
  }
  if (raw.action === 'kaartpdf') return kaartPdf(raw);
  if (raw.action === 'acties') {
    var acties = cleanActies(raw.data);
    if (!acties) return { error: 'Elke actie heeft minstens een titel nodig.' };
    putSetting('acties', acties); return { ok: true };
  }
  return { error: 'Onbekende actie' };
}
