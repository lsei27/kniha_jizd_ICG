import { getCurrentState, parseKilometerValue } from "./_lib/sheet.js";

export async function POST(request) {
  if (!process.env.GOOGLE_APPS_SCRIPT_URL) {
    return Response.json(
      {
        error:
          "Chybí GOOGLE_APPS_SCRIPT_URL. Nejdřív nasaďte Apps Script a doplňte jeho URL do Vercel environment variables.",
      },
      { status: 500 },
    );
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const endOdometer = parseKilometerValue(body.endOdometer);
    const from = clean(body.from);
    const via = clean(body.via);
    const to = clean(body.to);
    const driverName = clean(body.driverName);
    const reason = clean(body.reason);

    if (!Number.isFinite(endOdometer)) {
      return Response.json(
        { error: "Koncový stav tachometru musí být číslo." },
        { status: 400 },
      );
    }

    if (!from || !via || !to || !driverName || !reason) {
      return Response.json(
        { error: "Všechna pole jsou povinná." },
        { status: 400 },
      );
    }

    const createdAtIso = new Date().toISOString();
    const auto = body.auto || new URL(request.url).searchParams.get("auto") || undefined;

    // Public TSV is used only as a soft pre-check for better UX.
    const { currentOdometer } = await getCurrentState(auto);
    if (endOdometer < currentOdometer) {
      return Response.json(
        { error: "Koncový stav tachometru nesmí být menší než poslední stav v tabulce." },
        { status: 400 },
      );
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
      return Response.json(
        {
          error: upstreamPayload.error || "Google Apps Script zápis odmítl.",
          upstream: upstreamPayload,
        },
        { status: 502 },
      );
    }

    if (!upstreamPayload.record) {
      return Response.json(
        {
          error: "Google Apps Script nevrátil zapsaný záznam.",
          upstream: upstreamPayload,
        },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      record: upstreamPayload.record,
      upstream: upstreamPayload,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}
