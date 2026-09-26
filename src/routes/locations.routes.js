const express = require("express");

const {
  updateLocation,
  deleteLocation
} = require("../controllers/locations.controller");

const validateUuid = require("../middleware/validateUuid");

const router = express.Router();

router.put("/:id", validateUuid, updateLocation);

router.delete("/:id", validateUuid, deleteLocation);

module.exports = router;