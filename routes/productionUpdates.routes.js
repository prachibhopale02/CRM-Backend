const express = require("express");

const router = express.Router();

const {

  addProductionUpdate,

  getProductionUpdates,

  getProductionProgress

} = require(
  "../controllers/productionUpdates.controller"
);

// =====================================
// ADD UPDATE
// =====================================
router.post(
  "/:deliveryId",
  addProductionUpdate
);

// =====================================
// GET HISTORY
// =====================================
router.get(
  "/:deliveryId",
  getProductionUpdates
);

// =====================================
// PROGRESS REPORT
// =====================================
router.get(
  "/progress-report/all",
  getProductionProgress
);

module.exports = router;