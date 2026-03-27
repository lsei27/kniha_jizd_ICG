# Kniha jízd

Jednoduchá mobilní appka pro zápis jízd do Google Sheets. Frontend je připravený pro nasazení na Vercel a zápis do tabulky jde přes Google Apps Script.

## Jak to funguje

1. Frontend na `/` načte poslední stav tachometru přes Apps Script přímo z aktuálního posledního řádku v Google Sheetu.
2. Uživatel vyplní pouze:
   - koncový stav km
   - odkud
   - kam
   - jméno
   - důvod cesty
3. Apps Script přímo u tabulky dopočítá:
   - počáteční stav tachometru
   - ujeté km
   - datum
   - čas
4. Zápis probíhá atomicky přes `LockService`, takže se nesplete ani při rychlém použití po sobě.
5. Stejný Apps Script vrací i aktuální poslední stav, takže se po reloadu bere opravdu poslední ukončený tachometr, ne opožděný export.

## Soubory

- `index.html`, `styles.css`, `app.js`: mobilní formulář
- `api/state.js`: načtení posledního stavu přes Apps Script
- `api/trips.js`: validace a odeslání nového záznamu
- `google-apps-script/Code.gs`: zapisovací most do Google Sheets

## Lokální kontrola

```bash
npm run check
```

## Nasazení

### 1. Google Sheet

V tabulce použijte sloupce v tomto pořadí:

`DAT.` | `ČAS` | `ODKUD` | `KAM` | `STAV TACH.` | `UJETÉ KM` | `ČAS UKONČ.` | `TACH. UKONČ.` | `DŮVOD` | `KDO`

### 2. Google Apps Script

1. Otevřete cílový Google Sheet.
2. `Rozšíření` -> `Apps Script`.
3. Vložte obsah z `google-apps-script/Code.gs`.
4. Upravte `SHEET_NAME` podle skutečného názvu listu.
5. Nastavte `SCRIPT_SHARED_SECRET`, pokud chcete chránit zapisovací endpoint.
6. `Deploy` -> `New deployment` -> `Web app`.
7. Access nastavte na `Anyone`.
8. Zkopírujte URL web appky.

Aktuální produkční nastavení projektu:

- `SHEET_NAME = 'Buzzik'`
- `SCRIPT_SHARED_SECRET = 'ICG_kniha_jizd'`

Aktuální produkční Apps Script kód:

```js
const SHEET_NAME = 'Buzzik';
const SCRIPT_SHARED_SECRET = 'ICG_kniha_jizd';

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const payload = JSON.parse(e.postData.contents || '{}');

    if (SCRIPT_SHARED_SECRET && payload.secret !== SCRIPT_SHARED_SECRET) {
      return jsonResponse({ ok: false, error: 'Unauthorized request.' });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ ok: false, error: 'Sheet nebyl nalezen. Upravte SHEET_NAME.' });
    }

    const currentOdometer = getCurrentOdometer_(sheet);
    const endOdometer = Number(payload.endOdometer);

    if (!isFinite(endOdometer)) {
      return jsonResponse({ ok: false, error: 'Koncový stav tachometru musí být číslo.' });
    }

    if (endOdometer < currentOdometer) {
      return jsonResponse({
        ok: false,
        error: 'Koncový stav tachometru nesmí být menší než poslední stav v tabulce.',
      });
    }

    const record = createRecord_(payload, currentOdometer, endOdometer);
    const row = [
      record.date,
      record.startTime,
      record.from,
      record.to,
      record.startOdometer,
      record.distanceKm,
      record.endTime,
      record.endOdometer,
      record.reason,
      record.driverName,
    ];

    sheet.appendRow(row);

    return jsonResponse({
      ok: true,
      rowNumber: sheet.getLastRow(),
      record: record,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.mode === 'state') {
    return handleStateRequest_();
  }

  return jsonResponse({ ok: true, service: 'kniha-jizd-writer' });
}

function handleStateRequest_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  if (!sheet) {
    return jsonResponse({ ok: false, error: 'Sheet nebyl nalezen. Upravte SHEET_NAME.' });
  }

  const lastRowIndex = Math.max(sheet.getLastRow(), 2);
  const values = sheet.getRange(lastRowIndex, 1, 1, 10).getValues()[0];
  const currentOdometer = getCurrentOdometer_(sheet);

  return jsonResponse({
    ok: true,
    currentOdometer: currentOdometer,
    lastRow: {
      'DAT.': values[0],
      'ČAS': values[1],
      'ODKUD': values[2],
      'KAM': values[3],
      'STAV TACH.': values[4],
      'UJETÉ KM': values[5],
      'ČAS UKONČ.': values[6],
      'TACH. UKONČ.': values[7],
      'DŮVOD': values[8],
      'KDO': values[9],
    },
  });
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function getCurrentOdometer_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 2);
  const values = sheet.getRange(lastRow, 1, 1, 10).getValues()[0];
  const endOdometer = Number(values[7]);
  const startOdometer = Number(values[4]);

  if (isFinite(endOdometer)) {
    return endOdometer;
  }

  if (isFinite(startOdometer)) {
    return startOdometer;
  }

  throw new Error('V tabulce nebyl nalezen platný počáteční stav tachometru.');
}

function createRecord_(payload, currentOdometer, endOdometer) {
  const createdAt = payload.createdAtIso ? new Date(payload.createdAtIso) : new Date();
  const timeZone = Session.getScriptTimeZone() || 'Europe/Prague';
  const date = Utilities.formatDate(createdAt, timeZone, 'dd.MM.yyyy');
  const time = Utilities.formatDate(createdAt, timeZone, 'HH:mm');

  return {
    createdAtIso: createdAt.toISOString(),
    date: date,
    startTime: time,
    from: String(payload.from || '').trim(),
    to: String(payload.to || '').trim(),
    startOdometer: currentOdometer,
    distanceKm: endOdometer - currentOdometer,
    endTime: time,
    endOdometer: endOdometer,
    reason: String(payload.reason || '').trim(),
    driverName: String(payload.driverName || '').trim(),
  };
}
```

### 3. Vercel Environment Variables

Ve Vercelu nastavte:

- `GOOGLE_APPS_SCRIPT_URL` = URL z Apps Script deploymentu
- `APPS_SCRIPT_SHARED_SECRET` = `ICG_kniha_jizd`
- `PUBLIC_TSV_URL` = volitelné, pokud chcete přepsat výchozí zveřejněný TSV odkaz

### 4. Vercel deploy

Projekt je možné nasadit jako obyčejný statický web s Node serverless funkcemi.

## Důležitá poznámka

Veřejný Google Sheets `TSV` odkaz je pouze pro čtení. Přímý zápis do něj není možný, proto je v projektu přidaný Google Apps Script jako zapisovací vrstva.

Po jakékoli změně Apps Scriptu je potřeba vytvořit novou verzi deploymentu. Po jakékoli změně Vercel environment variables je potřeba udělat `Redeploy`.

## Aktuální předpoklad první verze

Pro jednoduchost se `ČAS` i `ČAS UKONČ.` zapisuje jako čas odeslání formuláře. Pokud chcete rozlišit skutečný začátek a konec jízdy, je potřeba přidat workflow `zahájit jízdu` / `ukončit jízdu`.
