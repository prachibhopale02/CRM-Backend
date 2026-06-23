const express = require("express");
const router = express.Router();
const segmentController = require("../controllers/segment.controller");
const { verifyToken, authorizeRoles } = require("../middleware/auth.middleware");

/* CREATE SEGMENT (CEO only) */
router.post("/create", verifyToken, authorizeRoles("CEO"), segmentController.createSegment);

/* GET SEGMENTS (All roles) */
router.get("/", verifyToken, authorizeRoles("CEO", "SALESPERSON", "PRODUCTION_MANAGER"), segmentController.getSegments);

/* DELETE SEGMENT (CEO only) */
router.delete("/:id", verifyToken, authorizeRoles("CEO"), segmentController.deleteSegment);

/* UPDATE SEGMENT (CEO only) */
router.put("/:id", verifyToken, authorizeRoles("CEO"), segmentController.updateSegment);

module.exports = router;