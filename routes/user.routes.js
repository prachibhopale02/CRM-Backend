const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload"); // file upload middleware
const { verifyToken, authorizeRoles } = require("../middleware/auth.middleware");
const userController = require("../controllers/user.controller");

/* ===================================================
   ➕ Create User (CEO Only)
=================================================== */
router.post(
  "/create",
  verifyToken,
  authorizeRoles("CEO"),
  userController.createUser
);

/* ===================================================
   🔎 Get All Users (CEO & Production Manager)
=================================================== */
router.get(
  "/all",
  verifyToken,
  authorizeRoles("CEO", "PRODUCTION_MANAGER"),
  userController.getAllUsers
);

/* ===================================================
   👤 Logged-in User Routes
=================================================== */
// Get Profile
router.get("/profile", verifyToken, userController.getProfile);

// Update Profile
router.put("/profile", verifyToken, userController.updateProfile);

// Upload Avatar
router.put(
  "/avatar",
  verifyToken,
  upload.single("avatar"),
  userController.updateAvatar
);

// Remove Avatar
router.delete("/avatar", verifyToken, userController.removeAvatar);

router.post(
  "/send-otp",
  verifyToken,
  userController.sendPasswordOTP
);

router.post(
  "/verify-otp",
  userController.verifyOTPAndChangePassword
);
/* ===================================================
   ✏️ CEO-only User Management
=================================================== */
// Update User by ID
router.put("/:id", verifyToken, authorizeRoles("CEO"), userController.updateUser);

// Delete User by ID
router.delete("/:id", verifyToken, authorizeRoles("CEO"), userController.deleteUser);

module.exports = router;