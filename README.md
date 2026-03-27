# Kniha jízd

Jednoduchá mobilní appka pro zápis jízd do Google Sheets. Frontend je připravený pro nasazení na Vercel a zápis do tabulky jde přes Google Apps Script.

## Jak to funguje

1. Frontend na `/` načte poslední stav tachometru z veřejného TSV.
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

## Soubory

- `index.html`, `styles.css`, `app.js`: mobilní formulář
- `api/state.js`: načtení posledního stavu z veřejné tabulky
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
5. Volitelně nastavte `SCRIPT_SHARED_SECRET`.
6. `Deploy` -> `New deployment` -> `Web app`.
7. Access nastavte na `Anyone`.
8. Zkopírujte URL web appky.

### 3. Vercel Environment Variables

Ve Vercelu nastavte:

- `GOOGLE_APPS_SCRIPT_URL` = URL z Apps Script deploymentu
- `APPS_SCRIPT_SHARED_SECRET` = stejná hodnota jako v `Code.gs`, pokud ji používáte
- `PUBLIC_TSV_URL` = volitelné, pokud chcete přepsat výchozí zveřejněný TSV odkaz

### 4. Vercel deploy

Projekt je možné nasadit jako obyčejný statický web s Node serverless funkcemi.

## Důležitá poznámka

Veřejný Google Sheets `TSV` odkaz je pouze pro čtení. Přímý zápis do něj není možný, proto je v projektu přidaný Google Apps Script jako zapisovací vrstva.

## Aktuální předpoklad první verze

Pro jednoduchost se `ČAS` i `ČAS UKONČ.` zapisuje jako čas odeslání formuláře. Pokud chcete rozlišit skutečný začátek a konec jízdy, je potřeba přidat workflow `zahájit jízdu` / `ukončit jízdu`.
