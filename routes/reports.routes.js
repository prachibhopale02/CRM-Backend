const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reports.controller");
const { verifyToken, authorizeRoles } = require("../middleware/auth.middleware");

// ✅ Booking Report (CEO only)
router.get("/bookings", verifyToken, authorizeRoles("CEO"), reportsController.getBookingReport);

// ✅ Revenue Report (CEO only)
router.get("/revenue", verifyToken, authorizeRoles("CEO"), reportsController.getRevenueReport);

router.get("/delivery", reportsController.getDeliveryReport);

router.get(
  "/customer-product",
  verifyToken,
  authorizeRoles("CEO"),
  reportsController.getCustomerProductReport
);

router.get("/available-years", reportsController.getAvailableYears);

router.get(
  "/yearly-sales",
  verifyToken,
  authorizeRoles("CEO","SALESPERSON","PRODUCTION_MANAGER"),
  reportsController.getYearlySalesReport
);
router.get("/delivery-plan", reportsController.getDeliveryPlanGraph);

router.get("/delivery-plan-all", reportsController.getDeliveryPlanGraphAll);


// 🔥 Booking vs Revenue FY (Secure)
router.get(
  "/booking-vs-revenue-fy",
  verifyToken,
  authorizeRoles("CEO", "SALESPERSON", "PRODUCTION_MANAGER"),
  reportsController.getBookingVsRevenueFY
);
router.get("/leads-fy-graph", reportsController.getLeadsFYGraph);
// 🔥 NEW FIXED GRAPH ROUTE
router.get(
  "/project-wise-order-delivered",
  verifyToken,
  authorizeRoles("CEO", "PRODUCTION_MANAGER"),
  reportsController.getProjectWiseOrderDelivered
);
router.get("/margin-comparison", reportsController.getMarginComparison);

module.exports = router;