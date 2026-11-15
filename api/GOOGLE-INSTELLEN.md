# Reserveringen koppelen aan Google (eenmalig, ±10 minuten per klant)

Gratis. Nodig: het Google-account van het restaurant. Reserveringen komen in een Google Spreadsheet die het script zelf maakt; Gmail verstuurt de mails (max. 100 per dag).

## Waarom dit daarna blijft werken
- Alle toestemmingen staan vast in `appsscript.json`. Google vraagt ze **één keer** bij `setup`, en nooit opnieuw zolang die lijst niet verandert.
- `api-test.mjs` faalt als iemand in `Code.gs` een Google-dienst gebruikt die niet in die lijst staat. Zo kan een update nooit stiekem om nieuwe toestemming vragen.
- `setup` zet een dagelijkse controle (06:00). Gaat er ooit iets mis (toestemming ingetrokken, spreadsheet weg), dan mailt Google de eigenaar automatisch een foutmelding.
- Nieuwe versie uitrollen = zelfde web-app-link, geen nieuwe toestemming.

Toestemming verdwijnt alleen als de eigenaar hem zelf intrekt (myaccount.google.com → Beveiliging → Apps van derden) of het account verwijderd wordt. Dan: stap 4 opnieuw.

## 1. Project maken
Ingelogd met het restaurant-account: ga naar **https://script.google.com** → **Nieuw project**.

## 2. Manifest met de vaste toestemmingen
1. **Projectinstellingen** (tandwiel) → vink aan: **Het manifestbestand appsscript.json tonen in de editor**.
2. Terug naar **Editor** → open `appsscript.json` → vervang alles door de inhoud van `api/appsscript.json` → opslaan.

## 3. Code
Open `Code.gs` → vervang alles door de inhoud van `api/Code.gs` → opslaan.

## 4. Eenmalige toestemming
1. Kies bovenin de functie **setup** → **Uitvoeren**.
2. **Toegang autoriseren** → kies het restaurant-account → bij "Google heeft deze app niet geverifieerd": **Geavanceerd → Ga naar … (niet veilig)** → **Alles selecteren** → **Doorgaan**.
   (Normaal: het is het eigen script van het restaurant.)
3. Het logboek eindigt met **Uitvoering voltooid** en de link naar de spreadsheet.

## 5. Inlogcode voor de beheer-app (alleen de eigenaar weet hem)
**Projectinstellingen → Scripteigenschappen → Scripteigenschap toevoegen**:
- `PIN`: 6 tot 40 tekens, letters en cijfers mag; geen 123456/abcdef/000000.
- Optioneel `MAIL_TO`: als de mails naar een ander adres moeten dan dit Google-account.

## 6. Online zetten
1. **Implementeren → Nieuwe implementatie** → tandwiel → **Web-app**.
2. Uitvoeren als: **Ik**. Wie heeft toegang: **Iedereen**. → **Implementeren**.
3. Kopieer de **web-app-URL** (eindigt op `/exec`) en zet hem in `data-api` van `index.html`, `beheer/index.html` en `wijzig.html`.
   De link is niet geheim: zonder inlogcode kun je alleen het menu lezen en reserveren.

## Later iets aanpassen
Plak de nieuwe `Code.gs`, sla op → **Implementeren → Implementaties beheren → potlood → Versie: Nieuwe versie → Implementeren**. Link blijft gelijk, geen nieuwe toestemming.
Alleen als `appsscript.json` ooit een scope bijkrijgt: daarna één keer **setup** uitvoeren (stap 4).
