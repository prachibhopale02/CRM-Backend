const express = require("express");
const router = express.Router();
const bomController = require("../controllers/bom.controller");
const { verifyToken, authorizeRoles } = require("../middleware/auth.middleware");
const {
  validateCreateBOM,
  validateUpdatePerUnitQuantity,
  validateDeleteBOM
} = require("../middleware/bom.validation");

/* CREATE OR UPDATE BOM */
router.post(
  "/",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON","PRODUCTION_MANAGER"),
  validateCreateBOM,
  bomController.createOrUpdateBOM
);

/* GET BOM BY PROJECT */
router.get(
  "/project/:project_id",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON","PRODUCTION_MANAGER"),
  bomController.getBOMByProject
);

/* UPDATE PER UNIT QUANTITY */
router.put(
  "/item/:bom_item_id",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON","PRODUCTION_MANAGER"),
  validateUpdatePerUnitQuantity,
  bomController.updatePerUnitQuantity
);

/* DELETE BOM */
router.delete(
  "/:bom_id",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON"),
  validateDeleteBOM,
  bomController.deleteBOM
);

// DELETE single BOM item
router.delete(
  "/item/:bom_item_id",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON"),
  bomController.deleteBOMItem
);

/* GET ALL BOM ITEMS - NEW ROUTE */
router.get(
  "/all",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON","PRODUCTION_MANAGER"),
  bomController.getAllBOMItems
);

module.exports = router;