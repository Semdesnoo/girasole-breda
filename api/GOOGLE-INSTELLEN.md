# Girasole-app koppelen aan Google (eenmalig, ±10 minuten)

Alles is gratis. Je hebt alleen het Gmail-account van het restaurant nodig.
De reserveringen komen in een Google Spreadsheet, en bij elke reservering stuurt Gmail een mail.

## 1. Spreadsheet maken
1. Log in met de Gmail van het restaurant en ga naar **https://sheets.new**.
2. Geef het bestand de naam **Girasole reserveringen**.

## 2. Het script plakken
1. In de spreadsheet: **Extensies → Apps Script**.
2. Haal de voorbeeldtekst (`function myFunction…`) helemaal weg.
3. Open op de computer het bestand `C:\Claude Code\girasole-breda\api\Code.gs`, kopieer **alles** en plak het in Apps Script.
4. Klik op het **diskette-icoon** (Opslaan).

## 3. Pincode instellen (alleen jij weet hem)
1. Klik links op het **tandwiel (Projectinstellingen)**.
2. Onderaan bij **Scripteigenschappen**: **Scripteigenschap toevoegen**.
   - Eigenschap: `PIN`
   - Waarde: jouw code van 6 tot 12 cijfers (niet 000000, 123456 of iets wat makkelijk te raden is)
3. Optioneel, als de mails naar een ander adres moeten dan dit Gmail-account: voeg `MAIL_TO` toe met dat e-mailadres.
4. **Scripteigenschappen opslaan**.

## 4. Online zetten
1. Rechtsboven: **Implementeren → Nieuwe implementatie**.
2. Klik op het tandwiel naast "Type selecteren" en kies **Web-app**.
3. Vul in:
   - Uitvoeren als: **Ik**
   - Wie heeft toegang: **Iedereen**
4. **Implementeren**. Google vraagt toestemming:
   **Toegang autoriseren** → kies het restaurant-account → bij "Google heeft deze app niet geverifieerd":
   **Geavanceerd → Ga naar … (niet veilig)** → **Toestaan**.
   (Dat is normaal: het is je eigen script, Google kent het alleen nog niet.)
5. Kopieer de **URL van de web-app** (eindigt op `/exec`) en stuur die door.
   Die link is niet geheim: zonder pincode kun je er alleen het menu mee lezen en een reservering plaatsen.

## Later iets aanpassen aan het script?
Plak de nieuwe `Code.gs`, sla op en kies **Implementeren → Implementaties beheren → potlood → Versie: Nieuwe versie → Implementeren**.
De link blijft dan hetzelfde.
