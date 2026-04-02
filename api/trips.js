const { getCurrentState, parseKilometerValue } = require("./_lib/sheet");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Použijte POST." });
    return;
  }

  if (!process.env.GOOGLE_APPS_SCRIPT_URL) {
    res.status(500).json({
      error:
        "Chybí GOOGLE_APPS_SCRIPT_URL. Nejdřív nasaďte Apps Script a doplňte jeho URL do Vercel environment variables.",
    });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const endOdometer = parseKilometerValue(body.endOdometer);
    const from = clean(body.from);
    const via = clean(body.via);
    const to = clean(body.to);
    const driverName = clean(body.driverName);
    const reason = clean(body.reason);

    if (!Number.isFinite(endOdometer)) {
      res.status(400).json({ error: "Koncový stav tachometru musí být číslo." });
      return;
    }

    if (!from || !via || !to || !driverName || !reason) {
      res.status(400).json({ error: "Všechna pole jsou povinná." });
      return;
    }

    const createdAtIso = new Date().toISOString();
    const auto = body.auto || req.query.auto;

    // Public TSV is used only as a soft pre-check for better UX.
    const { currentOdometer } = await getCurrentState(auto);
    if (endOdometer < currentOdometer) {
      res.status(400).json({
        error: "Koncový stav tachometru nesmí být menší než poslední stav v tabulce.",
      });
      return;
    }

    const upstreamResponse = await fetch(process.env.GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        createdAtIso,
        endOdometer,
        from,
        via,
        to,
        driverName,
        reason,
        sheetName: auto,
        secret: process.env.APPS_SCRIPT_SHARED_SECRET || "",
      }),
    });

    const upstreamText = await upstreamResponse.text();
    let upstreamPayload = {};

    try {
      upstreamPayload = upstreamText ? JSON.parse(upstreamText) : {};
    } catch {
      upstreamPayload = { raw: upstreamText };
    }

    if (!upstreamResponse.ok || upstreamPayload.ok === false) {
      res.status(502).json({
        error: upstreamPayload.error || "Google Apps Script zápis odmítl.",
        upstream: upstreamPayload,
      });
      return;
    }

    if (!upstreamPayload.record) {
      res.status(502).json({
        error: "Google Apps Script nevrátil zapsaný záznam.",
        upstream: upstreamPayload,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      record: upstreamPayload.record,
      upstream: upstreamPayload,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}
