const pool = require("../db/database");

function formatTravelPlan(plan) {
  return {
    ...plan,
    budget: plan.budget !== null
      ? Number(plan.budget)
      : null
  };
}

function isValidDate(dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateTravelPlan(data) {
  const {
    title,
    start_date,
    end_date,
    budget,
    currency,
    is_public
  } = data;

  if (
    typeof title !== "string" ||
    title.trim().length === 0 ||
    title.length > 200
  ) {
    return "Title must contain between 1 and 200 characters";
  }

  if (start_date !== undefined && start_date !== null) {
    if (
      typeof start_date !== "string" ||
      !isValidDate(start_date)
    ) {
      return "Invalid start date";
    }
  }

  if (end_date !== undefined && end_date !== null) {
    if (
      typeof end_date !== "string" ||
      !isValidDate(end_date)
    ) {
      return "Invalid end date";
    }
  }

  if (start_date && end_date && end_date < start_date) {
    return "End date cannot be before start date";
  }

  if (budget !== undefined && budget !== null) {
    if (
      typeof budget !== "number" ||
      !Number.isFinite(budget) ||
      budget < 0
    ) {
      return "Budget must be a non-negative number";
    }

    if (!/^\d+(\.\d{1,2})?$/.test(String(budget))) {
      return "Budget can have at most 2 decimal places";
    }

    if (budget > 99999999.99) {
      return "Budget is too large";
    }
  }

  if (currency !== undefined && currency !== null) {
    if (
      typeof currency !== "string" ||
      !/^[A-Z]{3}$/.test(currency)
    ) {
      return "Currency must be a 3-letter uppercase code";
    }
  }

  if (
    is_public !== undefined &&
    typeof is_public !== "boolean"
  ) {
    return "is_public must be boolean";
  }

  return null;
}

async function createTravelPlan(req, res) {
  try {
    const validationError = validateTravelPlan(req.body);

    if (validationError) {
      return res.status(400).json({
        error: `Validation error: ${validationError}`
      });
    }

    const {
      title,
      description,
      start_date,
      end_date,
      budget,
      currency,
      is_public
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO travel_plans (
        title,
        description,
        start_date,
        end_date,
        budget,
        currency,
        is_public
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
      `,
      [
        title,
        description ?? null,
        start_date ?? null,
        end_date ?? null,
        budget ?? null,
        currency ?? "USD",
        is_public ?? false
      ]
    );

    return res
      .status(201)
      .json(formatTravelPlan(result.rows[0]));
  } catch (error) {
    console.error("Create travel plan error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}

async function getTravelPlan(req, res) {
  try {
    const { id } = req.params;

    const planResult = await pool.query(
      `
      SELECT *
      FROM travel_plans
      WHERE id = $1;
      `,
      [id]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        error: "Travel plan not found"
      });
    }

    const locationsResult = await pool.query(
      `
      SELECT *
      FROM locations
      WHERE travel_plan_id = $1
      ORDER BY visit_order ASC;
      `,
      [id]
    );

    const plan = formatTravelPlan(planResult.rows[0]);

    plan.locations = locationsResult.rows.map((location) => ({
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
    }));

    return res.status(200).json(plan);

  } catch (error) {
    console.error("Get travel plan error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}

async function getTravelPlans(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM travel_plans
      ORDER BY created_at DESC;
      `
    );

    const plans = result.rows.map(formatTravelPlan);

    return res.status(200).json(plans);
  } catch (error) {
    console.error("Get travel plans error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}

function validateTravelPlanUpdate(data) {
  const {
    title,
    start_date,
    end_date,
    budget,
    currency,
    is_public,
    version
  } = data;

  if (
    !Number.isInteger(version) ||
    version <= 0
  ) {
    return "Version must be a positive integer";
  }

  if (title !== undefined) {
    if (
      typeof title !== "string" ||
      title.trim().length === 0 ||
      title.length > 200
    ) {
      return "Title must contain between 1 and 200 characters";
    }
  }

  if (start_date !== undefined && start_date !== null) {
    if (
      typeof start_date !== "string" ||
      !isValidDate(start_date)
    ) {
      return "Invalid start date";
    }
  }

  if (end_date !== undefined && end_date !== null) {
    if (
      typeof end_date !== "string" ||
      !isValidDate(end_date)
    ) {
      return "Invalid end date";
    }
  }

  if (start_date && end_date && end_date < start_date) {
    return "End date cannot be before start date";
  }

  if (budget !== undefined && budget !== null) {
    if (
      typeof budget !== "number" ||
      !Number.isFinite(budget) ||
      budget < 0
    ) {
      return "Budget must be a non-negative number";
    }

    if (!/^\d+(\.\d{1,2})?$/.test(String(budget))) {
      return "Budget can have at most 2 decimal places";
    }
  }

  if (currency !== undefined && currency !== null) {
    if (
      typeof currency !== "string" ||
      !/^[A-Z]{3}$/.test(currency)
    ) {
      return "Currency must be a 3-letter uppercase code";
    }
  }

  if (
    is_public !== undefined &&
    typeof is_public !== "boolean"
  ) {
    return "is_public must be boolean";
  }

  return null;
}

async function updateTravelPlan(req, res) {
  try {
    const { id } = req.params;

    const validationError = validateTravelPlanUpdate(req.body);

    if (validationError) {
      return res.status(400).json({
        error: `Validation error: ${validationError}`
      });
    }

    const {
      title,
      description,
      start_date,
      end_date,
      budget,
      currency,
      is_public,
      version
    } = req.body;

    const result = await pool.query(
      `
      UPDATE travel_plans
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        budget = COALESCE($5, budget),
        currency = COALESCE($6, currency),
        is_public = COALESCE($7, is_public),
        version = version + 1
      WHERE id = $8
        AND version = $9
      RETURNING *;
      `,
      [
        title ?? null,
        description ?? null,
        start_date ?? null,
        end_date ?? null,
        budget ?? null,
        currency ?? null,
        is_public ?? null,
        id,
        version
      ]
    );

    if (result.rows.length === 0) {
      const existingPlan = await pool.query(
        `
        SELECT id, version
        FROM travel_plans
        WHERE id = $1;
        `,
        [id]
      );

      if (existingPlan.rows.length === 0) {
        return res.status(404).json({
          error: "Travel plan not found"
        });
      }

      return res.status(409).json({
        error: "Conflict: travel plan was modified by another request",
        current_version: existingPlan.rows[0].version
      });
    }

    return res
      .status(200)
      .json(formatTravelPlan(result.rows[0]));

  } catch (error) {
    console.error("Update travel plan error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}

async function deleteTravelPlan(req, res) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM travel_plans
      WHERE id = $1
      RETURNING id;
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Travel plan not found"
      });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Delete travel plan error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}

module.exports = {
  createTravelPlan,
  getTravelPlan,
  getTravelPlans,
  updateTravelPlan,
  deleteTravelPlan
};