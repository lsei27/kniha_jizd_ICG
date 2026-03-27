const DEFAULT_TSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQQW_JLbl53RlMfxF_cwet5el673UYEAeR3IF_mSIApGeBUBd90jHBLNIw2klN6LQ/pub?output=tsv";

function getPublicTsvUrl() {
  return process.env.PUBLIC_TSV_URL || DEFAULT_TSV_URL;
}

async function fetchSheetRows() {
  const response = await fetch(getPublicTsvUrl(), {
    headers: {
      accept: "text/tab-separated-values,text/plain;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Nepodařilo se načíst tabulku (${response.status}).`);
  }

  const raw = await response.text();
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Tabulka neobsahuje žádná použitelná data.");
  }

  const headers = lines[0].split("\t").map((cell) => cell.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split("\t");
    return headers.reduce((record, header, index) => {
      record[header] = values[index] ? values[index].trim() : "";
      return record;
    }, {});
  });

  return rows;
}

async function getCurrentState() {
  const rows = await fetchSheetRows();
  const lastRow = [...rows].reverse().find((row) => {
    return row["TACH. UKONČ."] || row["STAV TACH."];
  });

  if (!lastRow) {
    throw new Error("V tabulce nebyl nalezen poslední stav tachometru.");
  }

  const currentOdometer = parseKilometerValue(lastRow["TACH. UKONČ."] || lastRow["STAV TACH."]);

  if (!Number.isFinite(currentOdometer)) {
    throw new Error("Poslední stav tachometru v tabulce není číslo.");
  }

  return {
    currentOdometer,
    lastRow,
  };
}

function parseKilometerValue(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return NaN;
  }

  const normalized = String(value).replace(/\s+/g, "").replace(",", ".");
  return Number(normalized);
}

function createRecord({ currentOdometer, endOdometer, from, to, driverName, reason }) {
  const now = new Date();
  const date = formatDate(now);
  const time = formatTime(now);
  const distanceKm = endOdometer - currentOdometer;

  return {
    createdAtIso: now.toISOString(),
    date,
    startTime: time,
    from,
    to,
    startOdometer: currentOdometer,
    distanceKm,
    endTime: time,
    endOdometer,
    reason,
    driverName,
  };
}

function formatDate(date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Prague",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(date);
}

module.exports = {
  createRecord,
  getCurrentState,
  getPublicTsvUrl,
};
