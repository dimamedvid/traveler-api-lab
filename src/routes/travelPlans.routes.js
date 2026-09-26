const express = require("express");

const {
  createTravelPlan,
  getTravelPlan,
  getTravelPlans,
  updateTravelPlan,
  deleteTravelPlan
} = require("../controllers/travelPlans.controller");

const {
  createLocation
} = require("../controllers/locations.controller");

const validateUuid = require("../middleware/validateUuid");

const router = express.Router();

router.post("/", createTravelPlan);

router.get("/", getTravelPlans);

router.get("/:id", validateUuid, getTravelPlan);

router.put("/:id", validateUuid, updateTravelPlan);

router.delete("/:id", validateUuid, deleteTravelPlan);

router.post("/:id/locations", validateUuid, createLocation);

module.exports = router;