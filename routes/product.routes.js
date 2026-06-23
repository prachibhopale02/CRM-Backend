const express = require("express");
const router = express.Router();

const productController = require("../controllers/product.controller");
const { verifyToken, authorizeRoles } = require("../middleware/auth.middleware");

/* =========================
   CREATE PRODUCT (CEO only)
========================= */
router.post(
  "/create",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON"),
  productController.createProduct
);

/* =========================
   GET PRODUCTS (All roles)
========================= */
router.get(
  "/",
  verifyToken,
  authorizeRoles("CEO", "SALESPERSON", "PRODUCTION_MANAGER"),
  productController.getProducts
);

/* =========================
   DELETE PRODUCT (CEO only)
========================= */
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON"),
  productController.deleteProduct
);
/* =========================
   UPDATE PRODUCT (CEO only)
========================= */
router.put(
  "/:id",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON"),
  productController.updateProduct
);

// Get products with BOM
router.get("/with-bom", productController.getProductsWithBOM);

module.exports = router;