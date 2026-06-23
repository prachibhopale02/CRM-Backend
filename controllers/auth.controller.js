const bcrypt = require("bcryptjs");
const db = require("../config/db");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);
    if (!user) return res.status(400).json({ message: "User not found" });
    if (!user.password_set) return res.status(400).json({ message: "Password not set" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, role: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

  const BASE_URL = process.env.BASE_URL;

const avatarUrl = user.avatar
  ? `${BASE_URL}/api/uploads/${user.avatar}?v=${Date.now()}`
  : null;

    res.json({
      message: "Login successful",
      token,
      role: user.user_type,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        avatar: user.avatar,
        avatarUrl
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

exports.setPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) return res.status(400).json({ message: "User not found" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.setPassword(user.id, hashedPassword);

    res.json({ message: "Password set successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// Signup only for existing users
exports.signup = async (req, res) => {
  try {
    const { email, mobile, password } = req.body;

    if (!email && !mobile) {
      return res.status(400).json({ message: "Email or Mobile is required" });
    }

    const user = await User.findByEmailOrMobile(email, mobile);

    if (!user) {
      return res.status(400).json({ message: "User not found, contact admin" });
    }

    // 🔥 ADD THIS CHECK
    if (user.password_set === 1) {
      return res.status(400).json({
        message: "Password already set. Please login or use Forgot Password."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.setPassword(user.id, hashedPassword);

    res.status(200).json({ message: "Password set successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
// Request password reset
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await db.execute(`SELECT * FROM users WHERE email = ?`, [email]);
    if (rows.length === 0) return res.status(404).json({ message: "User not found" });

    const token = crypto.randomBytes(20).toString("hex");
    const expiry = new Date(Date.now() + 3600 * 1000); // 1 hour

    await db.execute(
      `UPDATE users SET activation_token = ?, token_expiry = ? WHERE email = ?`,
      [token, expiry, email]
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    await sendEmail(email, "Password Reset Request", `Click here to reset: ${resetLink}`);

    res.json({ message: "Password reset link sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const [rows] = await db.execute(
      `SELECT * FROM users WHERE activation_token = ? AND token_expiry > NOW()`,
      [token]
    );

    if (rows.length === 0) return res.status(400).json({ message: "Invalid or expired token" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.execute(
      `UPDATE users SET password = ?, activation_token = NULL, token_expiry = NULL, password_set = 1 WHERE id = ?`,
      [hashedPassword, rows[0].id]
    );

    res.json({ message: "Password successfully reset" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};