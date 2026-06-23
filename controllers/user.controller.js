const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const db = require("../config/db");
const mobileRegex = /^[6-9]\d{9}$/;
const sendOTPEmail = require("../utils/sendOTPEmail"); // create this file
/* ===================================================
   ➕ CEO Creates User
=================================================== */
exports.createUser = async (req, res) => {
  try {
    const { username, email, mobile, user_type } = req.body;

    // Basic validation
    if (!username || !user_type || !mobile) {
      return res.status(400).json({
        message: "Username, mobile and user_type are required"
      });
    }

    // Mobile validation
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({
        message: "Invalid mobile number. Must be 10 digits and start with 6-9."
      });
    }

    // Role validation
    const allowedRoles = ["SALESPERSON", "PRODUCTION_MANAGER","CEO"];
    if (!allowedRoles.includes(user_type)) {
      return res.status(400).json({
        message: "Invalid user type"
      });
    }

    // Duplicate check
    const duplicate = await User.checkDuplicate(email, mobile);
    if (duplicate.length > 0) {
      return res.status(400).json({
        message: "Email or Mobile already exists"
      });
    }

    // Create user
    await User.create({ username, email, mobile, user_type });

    res.status(201).json({
      message: "User created successfully. User can now set password."
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};


/* ===================================================
   🔐 User Sets Password
=================================================== */
exports.setPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required"
      });
    }

    const user = await User.findByEmail(email);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.password_set === 1) {
      return res.status(400).json({
        message: "Password already set. Use Forgot Password."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.setPassword(user.id, hashedPassword);

    res.json({
      message: "Password set successfully"
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};


/* ===================================================
   🔎 Get All Users (CEO Only)
=================================================== */
exports.getAllUsers = async (req, res) => {
  try {
    const db = require("../config/db");

    const [rows] = await db.execute(
      "SELECT id, username, email, mobile, user_type, is_active, created_at FROM users"
    );

    res.json(rows);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};


/* ===================================================
   ✏️ Update User (CEO Only)
=================================================== */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, mobile, user_type } = req.body;

    if (!username || !user_type || !mobile) {
      return res.status(400).json({
        message: "Username, mobile and user_type are required"
      });
    }

    // Mobile validation
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({
        message: "Invalid mobile number. Must be 10 digits and start with 6-9."
      });
    }

    // Role validation
    const allowedRoles = ["SALESPERSON", "PRODUCTION_MANAGER","CEO"];
    if (!allowedRoles.includes(user_type)) {
      return res.status(400).json({
        message: "Invalid user type"
      });
    }

    // Check duplicate for other users
    const duplicate = await User.checkDuplicate(email, mobile);
    if (duplicate.some(u => u.id != id)) {
      return res.status(400).json({
        message: "Email or Mobile already exists"
      });
    }

    await User.update(id, { username, email, mobile, user_type });

    res.json({
      message: "User updated successfully"
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};


/* ===================================================
   ❌ Delete User (CEO Only)
=================================================== */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.user_type === "CEO") {
      return res.status(400).json({
        message: "Cannot delete CEO"
      });
    }

    await User.deleteUser(id);

    res.json({
      message: "User deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
};
/* ===================================================
   👤 Get Profile (Logged-in User)
=================================================== */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.execute(
      "SELECT id, username, email, mobile, user_type, avatar FROM users WHERE id=?",
      [userId]
    );
    const user = rows[0];

    if (!user) return res.status(404).json({ message: "User not found" });

    const avatarUrl = user.avatar
      ? `${req.protocol}://${req.get("host")}/api/uploads/${user.avatar}`
      : null;

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      mobile: user.mobile,
      avatar: user.avatar,
      avatarUrl,
      user_type: user.user_type
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ===================================================
   🖼 Upload Avatar
=================================================== */
exports.updateAvatar = async (req, res) => {
  try {
    if (!req.user || !req.user.id)
      return res.status(401).json({ message: "User not authenticated" });

    if (!req.file) 
      return res.status(400).json({ message: "No file uploaded" });

    const avatarFilename = req.file.filename;
    const userId = req.user.id;

    // Update DB
    await db.execute("UPDATE users SET avatar=? WHERE id=?", [avatarFilename, userId]);

    // Fetch updated user
    const [rows] = await db.execute(
      "SELECT id, username, email, mobile, user_type, avatar FROM users WHERE id=?",
      [userId]
    );
    const updatedUser = rows[0];

    // Build full URL for frontend
    const avatarUrl = updatedUser.avatar
      ? `${req.protocol}://${req.get("host")}/api/uploads/${updatedUser.avatar}`
      : null;

   res.json({
  message: "Profile updated successfully",
  avatar: updatedUser.avatar,
  avatarUrl
});

  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

/* ===================================================
   ❌ Remove Avatar
=================================================== */
exports.removeAvatar = async (req, res) => {
  try {

    const userId = req.user.id;

    await db.execute(
      "UPDATE users SET avatar=NULL WHERE id=?",
      [userId]
    );

    res.json({
      message: "Avatar removed"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server error"
    });
  }
};

/* ===================================================
   ✏️ Update Profile (Logged-in User)
=================================================== */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    let { username, email, mobile, password } = req.body;

    username = username?.trim();
    email = email?.trim();
    mobile = mobile?.trim();
    password = password?.trim();

    // ✅ Only username & mobile required
    if (!username || !mobile) {
      return res.status(400).json({
        message: "Username and mobile are required"
      });
    }

    // Mobile validation
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({
        message: "Invalid mobile number"
      });
    }

    // Check duplicate except self
    const duplicate = await User.checkDuplicate(email || null, mobile);
    if (duplicate.some(u => u.id != userId)) {
      return res.status(400).json({
        message: "Email or Mobile already exists"
      });
    }

    // Prepare data, **do not include user_type**
    const updateData = { username, mobile };
    if (email) updateData.email = email;
    // ✅ Update user
    await User.update(userId, updateData);

    // Return updated user
    const updatedUser = await User.findById(userId);
   const avatarUrl = updatedUser.avatar
  ? `${req.protocol}://${req.get("host")}/api/uploads/${updatedUser.avatar}`
  : null;

res.json({
  message: "Profile updated successfully",
  user: {
    ...updatedUser,
    avatarUrl
  }
});

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
exports.sendPasswordOTP = async (req, res) => {
  try {
    const { email } = req.body;  // ✅ FIX

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const user = await User.findByEmail(email); // ✅ FIX

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 5 * 60 * 1000;

    await db.execute(
      "UPDATE users SET otp=?, otp_expiry=? WHERE id=?",
      [otp, expiry, user.id]
    );

    console.log("👉 Sending OTP to:", user.email);

    await sendOTPEmail(user.email, otp);

    res.json({ success: true, message: "OTP sent" });

  } catch (err) {
    console.error("OTP ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
exports.verifyOTPAndChangePassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!otp || !newPassword || !email) {
      return res.status(400).json({
        message: "Email, OTP and new password required"
      });
    }

    const [rows] = await db.execute(
      "SELECT id, otp, otp_expiry FROM users WHERE email = ?",
      [email]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      !user.otp ||
      user.otp !== String(otp) ||
      Date.now() > new Date(user.otp_expiry).getTime()
    ) {
      return res.status(400).json({
        message: "Invalid or expired OTP"
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.execute(
      "UPDATE users SET password=?, otp=NULL, otp_expiry=NULL WHERE id=?",
      [hashedPassword, user.id]
    );

    res.json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error updating password"
    });
  }
};