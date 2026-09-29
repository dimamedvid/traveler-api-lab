
const pool = require("../db/database");

function formatLocation(location) {
  return {
    ...location,
    latitude:
      location.latitude !== null
        ? Number(location.latitude)
        : null,

    longitude:
      location.longitude !== null
        ? Number(location.longitude)
        : null,

    budget:
      location.budget !== null
        ? Number(location.budget)
        : null
  };
}

function isValidDateTime(value) {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value))
  );
}

function validateLocation(data) {
  const {
    name,
    latitude,
    longitude,
    arrival_date,
    departure_date,
    budget
  } = data;

  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.length > 200
  ) {
    return "Name must contain between 1 and 200 characters";
  }

  if (latitude !== undefined && latitude !== null) {
    if (
      typeof latitude !== "number" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      return "Latitude must be between -90 and 90";
    }
  }

  if (longitude !== undefined && longitude !== null) {
    if (
      typeof longitude !== "number" ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return "Longitude must be between -180 and 180";
    }
  }

  if (arrival_date !== undefined && arrival_date !== null) {
    if (!isValidDateTime(arrival_date)) {
      return "Invalid arrival date";
    }
  }

  if (departure_date !== undefined && departure_date !== null) {
    if (!isValidDateTime(departure_date)) {
      return "Invalid departure date";
    }
  }

  if (
    arrival_date &&
    departure_date &&
    new Date(departure_date) < new Date(arrival_date)
  ) {
    return "Departure date cannot be before arrival date";
  }

  if (budget !== undefined && budget !== null) {
    if (
      typeof budget !== "number" ||
      !Number.isFinite(budget) ||
      budget < 0
    ) {
      return "Budget must be a non-negative number";
    }
  }

  return null;
}

async function createLocation(req, res) {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const validationError = validateLocation(req.body);

    if (validationError) {
      return res.status(400).json({
        error: `Validation error: ${validationError}`
      });
    }

    const {
      name,
      address,
      latitude,
      longitude,
      arrival_date,
      departure_date,
      budget,
      notes
    } = req.body;

    await client.query("BEGIN");

    const planResult = await client.query(
      `
      SELECT id
      FROM travel_plans
      WHERE id = $1
      FOR UPDATE;
      `,
      [id]
    );

    if (planResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Travel plan not found"
      });
    }

    const result = await client.query(
      `
      INSERT INTO locations (
        travel_plan_id,
        name,
        address,
        latitude,
        longitude,
        arrival_date,
        departure_date,
        budget,
        notes
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9
      )
      RETURNING *;
      `,
      [
        id,
        name,
        address ?? null,
        latitude ?? null,
        longitude ?? null,
        arrival_date ?? null,
        departure_date ?? null,
        budget ?? null,
        notes ?? null
      ]
    );

    await client.query("COMMIT");

    return res
      .status(201)
      .json(formatLocation(result.rows[0]));

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create location error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  } finally {
    client.release();
  }
}

async function updateLocation(req, res) {
  try {
    const { id } = req.params;
    const { version } = req.body;

    if (!Number.isInteger(version) || version <= 0) {
      return res.status(400).json({
        error: "Validation error: Version must be a positive integer"
      });
    }

    const existingResult = await pool.query(
      `SELECT * FROM locations WHERE id = $1;`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        error: "Location not found"
      });
    }

    const existing = existingResult.rows[0];

    const updatedData = {
      name:
        req.body.name !== undefined
          ? req.body.name
          : existing.name,

      address:
        req.body.address !== undefined
          ? req.body.address
          : existing.address,

      latitude:
        req.body.latitude !== undefined
          ? req.body.latitude
          : existing.latitude !== null
            ? Number(existing.latitude)
            : null,

      longitude:
        req.body.longitude !== undefined
          ? req.body.longitude
          : existing.longitude !== null
            ? Number(existing.longitude)
            : null,

      arrival_date:
        req.body.arrival_date !== undefined
          ? req.body.arrival_date
          : existing.arrival_date,

      departure_date:
        req.body.departure_date !== undefined
          ? req.body.departure_date
          : existing.departure_date,

      budget:
        req.body.budget !== undefined
          ? req.body.budget
          : existing.budget !== null
            ? Number(existing.budget)
            : null,

      notes:
        req.body.notes !== undefined
          ? req.body.notes
          : existing.notes
    };

    const validationError = validateLocation(updatedData);

    if (validationError) {
      return res.status(400).json({
        error: `Validation error: ${validationError}`
      });
    }

    const result = await pool.query(
      `
      UPDATE locations
      SET
        name = $1,
        address = $2,
        latitude = $3,
        longitude = $4,
        arrival_date = $5,
        departure_date = $6,
        budget = $7,
        notes = $8,
        version = version + 1
      WHERE id = $9
        AND version = $10
      RETURNING *;
      `,
      [
        updatedData.name,
        updatedData.address,
        updatedData.latitude,
        updatedData.longitude,
        updatedData.arrival_date,
        updatedData.departure_date,
        updatedData.budget,
        updatedData.notes,
        id,
        version
      ]
    );

    if (result.rows.length === 0) {
      const currentResult = await pool.query(
        `SELECT version FROM locations WHERE id = $1;`,
        [id]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({
          error: "Location not found"
        });
      }

      return res.status(409).json({
        error: "Conflict: location was modified by another request",
        current_version: currentResult.rows[0].version
      });
    }

    return res
      .status(200)
      .json(formatLocation(result.rows[0]));

  } catch (error) {
    console.error("Update location error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}

async function deleteLocation(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM locations
      WHERE id = $1
      RETURNING id;
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Location not found"
      });
    }

    return res.status(204).send();

  } catch (error) {
    console.error("Delete location error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}

module.exports = {
  createLocation,
  updateLocation,
  deleteLocation
};
