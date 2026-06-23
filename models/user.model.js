const db = require("../config/db");

const User = {};

// 🔎 Find user by email
User.findByEmail = async (email) => {
  const [rows] = await db.execute(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );
  return rows[0];
};

// 🔎 Find user by mobile
User.findByMobile = async (mobile) => {
  const [rows] = await db.execute(
    "SELECT * FROM users WHERE mobile = ?",
    [mobile]
  );
  return rows[0];
};

// 🔎 Find user by ID
User.findById = async (id) => {
  const [rows] = await db.execute(
    "SELECT * FROM users WHERE id = ?",
    [id]
  );
  return rows[0];
};

// 🔎 Check duplicate email or mobile
User.checkDuplicate = async (email, mobile) => {
  const [rows] = await db.execute(
    "SELECT id FROM users WHERE email = ? OR mobile = ?",
    [email || null, mobile || null]
  );
  return rows;
};

// ➕ Create new user (by CEO)
User.create = async (data) => {
  const [result] = await db.execute(
    `INSERT INTO users 
     (username, email, mobile, password, user_type, password_set, is_active)
     VALUES (?, ?, ?, NULL, ?, 0, 1)`,
    [data.username, data.email || null, data.mobile || null, data.user_type]
  );

  return result;
};

// 🔐 Set password
User.setPassword = async (userId, hashedPassword) => {
  await db.execute(
    "UPDATE users SET password = ?, password_set = 1 WHERE id = ?",
    [hashedPassword, userId]
  );
};

// ⛔ Deactivate user
User.deactivate = async (userId) => {
  await db.execute(
    "UPDATE users SET is_active = 0 WHERE id = ?",
    [userId]
  );
};
// user.model.js
User.findByEmailOrMobile = async (email, mobile) => {
  const safeEmail = email || null;
  const safeMobile = mobile || null;

  const [rows] = await db.execute(
    "SELECT * FROM users WHERE email = ? OR mobile = ? LIMIT 1",
    [safeEmail, safeMobile]
  );

  return rows[0];
};
// Update user fields by ID
User.update = async (id, data) => {
  const fields = [];
  const values = [];

  if (data.username) {
    fields.push("username = ?");
    values.push(data.username);
  }

  if ("email" in data) { // allow null email
    fields.push("email = ?");
    values.push(data.email || null);
  }

  if (data.mobile) {
    fields.push("mobile = ?");
    values.push(data.mobile || null);
  }

  if ("user_type" in data) { // only update if provided
    fields.push("user_type = ?");
    values.push(data.user_type);
  }

  if ("password" in data) {
    fields.push("password = ?");
    values.push(data.password);
  }

  if (fields.length === 0) return;

  const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
  values.push(id);

  await db.execute(sql, values);
};
// Soft delete or hard delete (here we will do hard delete)
User.deleteUser = async (id) => {
  const [result] = await db.execute(
    "DELETE FROM users WHERE id = ?",
    [id]
  );
  return result;
};
// 📄 Get profile (for logged-in user)
User.getProfile = async (id) => {
  const [rows] = await db.execute(
    "SELECT id, username, email, mobile, avatar, user_type FROM users WHERE id = ?",
    [id]
  );
  return rows[0];
};

// 🖼 Update avatar
User.updateAvatar = async (id, avatar) => {
  await db.execute(
    "UPDATE users SET avatar = ? WHERE id = ?",
    [avatar, id]
  );
};

// ❌ Remove avatar
User.removeAvatar = async (id) => {
  await db.execute(
    "UPDATE users SET avatar = NULL WHERE id = ?",
    [id]
  );
};
User.findByType = async (type) => {
  const [rows] = await db.query(
    "SELECT id, username, email, user_type FROM users WHERE user_type = ?",
    [type]
  );
  return rows;
};
module.exports = User;