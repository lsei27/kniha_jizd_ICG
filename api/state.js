const { getCurrentState } = require("./_lib/sheet");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Použijte GET." });
    return;
  }

  try {
    const auto = req.query.auto;
    const { currentOdometer, lastRow } = await getCurrentState(auto);

    res.status(200).json({
      currentOdometer,
      timestamp: new Date().toISOString(),
      lastRow,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};
