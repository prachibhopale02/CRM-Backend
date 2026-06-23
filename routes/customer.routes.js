const express = require("express");
const router = express.Router();

const customerController = require("../controllers/customer.controller");
const { verifyToken, authorizeRoles } = require("../middleware/auth.middleware");

/* =========================
   ROUTES
========================= */

// Create customer (CEO or SALESPERSON)
router.post(
  "/create",
  verifyToken,
  authorizeRoles("CEO"), // updated to match comment
  customerController.createCustomer
);

// Get all customers (CEO & SALESPERSON)
router.get(
  "/",
  verifyToken,
  authorizeRoles("CEO", "SALESPERSON","PRODUCTION_MANAGER"),
  customerController.getCustomers
);

// Delete customer (CEO only)
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("CEO"),
  customerController.deleteCustomer
);

// Update customer (CEO only)
router.put(
  "/:id",
  verifyToken,
  authorizeRoles("CEO"),
  customerController.updateCustomer
);

module.exports = router;