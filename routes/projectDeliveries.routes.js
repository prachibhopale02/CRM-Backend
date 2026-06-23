const express = require("express");
const router = express.Router();
const projectDeliveriesController = require("../controllers/projectDeliveries.controller");
const { verifyToken } = require("../middleware/auth.middleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ensure folder exists
if (!fs.existsSync("uploads/invoices")) {
  fs.mkdirSync("uploads/invoices", { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/invoices");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = file.originalname.replace(ext, "");
    cb(null, Date.now() + "-" + name + ext);
  }
});

const upload = multer({ storage });

// ================= ROUTES =================

// specific routes FIRST
router.get("/pending", verifyToken, projectDeliveriesController.getPendingDeliveries);

router.get("/", projectDeliveriesController.getAll);

router.get("/:projectId", projectDeliveriesController.getByProject);

router.post("/:projectId", projectDeliveriesController.createOrUpdate);

// 🔥 FIXED PUT WITH FILE UPLOAD
router.put(
  "/complete/:id",
  upload.single("invoice_file"),
  projectDeliveriesController.markCompleted
);

router.delete("/delete/:id", projectDeliveriesController.deleteDelivery);

router.post(
  "/send-invoice-mail/:id",
  projectDeliveriesController.sendInvoiceMail
);

router.get(
  "/history/:id",
  verifyToken,
  projectDeliveriesController.getHistory
);

router.post(
  "/reschedule-by-production/:id",
  projectDeliveriesController.rescheduleByProduction
);

// ✅ ONLY ONE EXPORT
module.exports = router;