# AGENT.MD

## Projekt

Jednoduchá webová aplikace pro knihu jízd. Uživatel po jízdě vyplní:

- koncový stav tachometru
- odkud
- kam
- jméno řidiče
- důvod cesty

Aplikace automaticky:

- načte aktuální poslední stav tachometru
- dopočítá počáteční stav
- dopočítá ujeté kilometry
- doplní datum a čas
- odešle záznam do Google Sheetu

## Architektura

### Frontend

Statický frontend běží na Vercelu.

Soubory:

- `index.html` – formulář
- `styles.css` – mobilní vzhled pro použití přes QR v autě
- `app.js` – načítání stavu, validace, odeslání formuláře, zobrazení chyb

Frontend volá:

- `GET /api/state` – načtení aktuálního posledního stavu tachometru
- `POST /api/trips` – vytvoření nového záznamu

### Backend na Vercelu

Soubory:

- `api/state.js`
- `api/trips.js`
- `api/_lib/sheet.js`

Logika:

- `api/state.js` čte aktuální stav přes Google Apps Script
- `api/trips.js` validuje vstup a posílá zápis do Google Apps Scriptu
- `api/_lib/sheet.js` obsahuje sdílenou logiku pro načtení stavu

### Google Apps Script

Apps Script je zapisovací a čtecí vrstva nad Google Sheetem.

Používá:

- `doPost(e)` pro zápis jízdy
- `doGet(e)` pro kontrolu služby a načítání aktuálního stavu přes `?mode=state`

Apps Script dělá:

- kontrolu `SCRIPT_SHARED_SECRET`
- nalezení správného listu přes `SHEET_NAME`
- načtení posledního tachometru z posledního řádku
- atomický zápis pomocí `LockService`

## Produkční nastavení

### GitHub

Repozitář:

- `git@github.com:lsei27/kniha_jizd_ICG.git`

Default branch:

- `main`

### Vercel

Projekt je nasazen z GitHub repozitáře.

Potřebné environment variables:

- `GOOGLE_APPS_SCRIPT_URL`
- `APPS_SCRIPT_SHARED_SECRET`

Aktuálně se používá shared secret:

- `ICG_kniha_jizd`

Po změně environment variables na Vercelu je nutný `Redeploy`.

### Google Apps Script

Aktuální produkční nastavení v kódu:

- `SHEET_NAME = 'Buzzik'`
- `SCRIPT_SHARED_SECRET = 'ICG_kniha_jizd'`

Po změně kódu v Apps Scriptu nestačí jen uložit. Je nutné:

1. `Implementovat`
2. `Spravovat nasazení`
3. otevřít existující `Web app`
4. `Upravit`
5. vytvořit novou verzi
6. znovu `Implementovat`

Pokud vznikne nová `/exec` URL, musí se přepsat i ve Vercelu do `GOOGLE_APPS_SCRIPT_URL` a znovu udělat `Redeploy`.

## Důležitá poznámka k datům

Veřejný Google Sheets TSV export je vhodný jen pro čtení a může být opožděný. Proto se aktuální poslední stav tachometru bere přes Apps Script přímo z posledního řádku listu.

Správný test stavu Apps Scriptu je:

- `.../exec?mode=state`

Správná odpověď má obsahovat:

- `ok: true`
- `currentOdometer`
- `lastRow`

## Známé provozní kroky

Když frontend hlásí `Unauthorized request`:

- nesedí `APPS_SCRIPT_SHARED_SECRET` ve Vercelu a `SCRIPT_SHARED_SECRET` v Apps Scriptu

Když frontend hlásí `Sheet nebyl nalezen`:

- nesedí `SHEET_NAME` s názvem listu v Google Sheetu

Když frontend po reloadu bral starý stav:

- problém byl v tom, že se četlo z TSV exportu
- opraveno přechodem na čtení přes Apps Script `?mode=state`

## Ověřený stav projektu

- frontend funguje
- zápis do Google Sheetu funguje
- autorizace přes shared secret funguje
- po úpravě Apps Scriptu má fungovat i načítání posledního tachometru z aktuálního posledního řádku
