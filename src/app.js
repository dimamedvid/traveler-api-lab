const express = require("express");
const pool = require("./db/database");
const travelPlansRoutes = require("./routes/travelPlans.routes");
const locationsRoutes = require("./routes/locations.routes");

const app = express();

app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      status: "error",
      database: "disconnected"
    });
  }
});

app.use("/api/travel-plans", travelPlansRoutes);
app.use("/api/locations", locationsRoutes);

app.use((err, req, res, next) => {
  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    "body" in err
  ) {
    return res.status(400).json({
      error: "Validation error: Malformed JSON"
    });
  }

  console.error("Unhandled error:", err);

  return res.status(500).json({
    error: "Internal server error"
  });
});

module.exports = app;