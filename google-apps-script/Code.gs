const DEFAULT_SHEET_NAME = 'Buzzik';
const SCRIPT_SHARED_SECRET = 'ICG_kniha_jizd';

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const payload = JSON.parse(e.postData.contents || '{}');

    if (SCRIPT_SHARED_SECRET && payload.secret !== SCRIPT_SHARED_SECRET) {
      return jsonResponse({ ok: false, error: 'Unauthorized request.' });
    }

    const sheetName = payload.sheetName || DEFAULT_SHEET_NAME;
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

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
    return handleStateRequest_(e.parameter.sheetName || DEFAULT_SHEET_NAME);
  }

  return jsonResponse({ ok: true, service: 'kniha-jizd-writer' });
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

function handleStateRequest_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  if (!sheet) {
    return jsonResponse({ ok: false, error: 'Sheet "' + sheetName + '" nebyl nalezen.' });
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
