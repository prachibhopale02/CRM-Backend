const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth.middleware");
const followupController = require("../controllers/followup.controller");

// ➤ Create follow-up
router.post("/", followupController.createFollowUp);

// ➤ Due follow-ups (FIXED)
router.get("/due/list", verifyToken, followupController.getDueFollowUps);

// ➤ Mark seen
router.post("/seen", followupController.markReminderSeen);

// ➤ Get by project
router.get("/:project_id", followupController.getFollowUps);

module.exports = router;