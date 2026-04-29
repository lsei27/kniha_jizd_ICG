import { getCurrentState } from "./_lib/sheet.js";

export async function GET(request) {
  try {
    const auto = new URL(request.url).searchParams.get("auto") || undefined;
    const { currentOdometer, lastRow } = await getCurrentState(auto);

    return Response.json({
      currentOdometer,
      timestamp: new Date().toISOString(),
      lastRow,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
