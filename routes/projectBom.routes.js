const express = require("express");
const router = express.Router();
const projectBomController = require("../controllers/projectBom.controller");
const { verifyToken, authorizeRoles } = require("../middleware/auth.middleware");

/* GET PROJECT BOM */
router.get(
  "/:project_id",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON","PRODUCTION_MANAGER"),
  projectBomController.getProjectBOM
);

/* UPDATE PROJECT BOM ITEM */
router.put(
  "/item/:id",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON","PRODUCTION_MANAGER"),
  projectBomController.updateProjectBOMItem
);

/* 🔥 ADD THIS SAVE ROUTE */
router.post(
  "/save",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON","PRODUCTION_MANAGER"),
  projectBomController.saveProjectBOM
);

module.exports = router;