const express = require("express");
const router = express.Router();

const projectController = require("../controllers/project.controller");
const { verifyToken, authorizeRoles } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload");
// 🔹 Import Project Validation
const { 
  validateCreateProject, 
  validateUpdateProject 
} = require("../middleware/project.validation");


/* =========================
   CREATE PROJECT
========================= */
router.post(
  "/create",
  verifyToken,
  authorizeRoles("SALESPERSON","CEO"),
  validateCreateProject,
  projectController.createProject
);


/* =========================
   VIEW PROJECTS (ROLE BASED)
========================= */
router.get(
  "/",
  verifyToken,
  authorizeRoles("CEO", "SALESPERSON", "PRODUCTION_MANAGER"),
  projectController.getProjects
);


/* =========================
   GET SINGLE PROJECT
========================= */
router.get(
  "/:id",
  verifyToken,
  authorizeRoles("CEO", "SALESPERSON", "PRODUCTION_MANAGER"),
  projectController.getProjectById
);


/* =========================
   UPDATE STATUS
========================= */
router.put(
  "/status/:id",
  verifyToken,
  authorizeRoles("PRODUCTION_MANAGER", "CEO"),
  projectController.updateStatus
);


/* =========================
   UPDATE PROJECT
========================= */
router.put(
  "/:id",
  verifyToken,
  authorizeRoles("CEO", "SALESPERSON"),

  // 🔹 Optional validation (important fix)
  validateUpdateProject,

  projectController.updateProject
);

router.post(
  "/upload-documents/:id",
  verifyToken,
  authorizeRoles("SALESPERSON", "CEO"),
  upload.fields([
    { name: "purchase_order_file", maxCount: 1 },
    { name: "quotation_file", maxCount: 1 },
    { name: "iof_file", maxCount: 1 },
    { name: "costing_file", maxCount: 1 },
  ]),
  projectController.uploadDocuments
);
router.delete(
  "/delete-document/:id/:field",
  verifyToken,
  authorizeRoles("SALESPERSON", "CEO"),
  projectController.deleteDocument
);
/* =========================
   DELETE PROJECT
========================= */
router.delete(
  "/:id",
  verifyToken,
  authorizeRoles("CEO", "SALESPERSON"),
  projectController.deleteProject
);

module.exports = router;