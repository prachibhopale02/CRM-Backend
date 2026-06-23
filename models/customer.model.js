const db = require("../config/db");

const Customer = {

  /* =========================
     CREATE CUSTOMER
  ========================= */
 
  create: async (data) => {
  const [result] = await db.execute(
    `INSERT INTO customers 
(customer_name, segment_id, created_by, contact_person, phone, email, address, gst_no, website, plant_location, industry_type, pan_no)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
 [
  data.customer_name,
  data.segment_id,
  data.created_by,
  data.contact_person,
  data.phone,
  data.email,
  data.address,
  data.gst_no || null,
  data.website || null,
  data.plant_location || null,
  data.industry_type || null,
  data.pan_no || null   // ✅ ADD THIS
]
  );
  return result;
},
  /* =========================
     FIND BY PHONE (Duplicate Check)
  ========================= */
  findByMobile: async (phone) => {
    const [rows] = await db.execute(
      "SELECT * FROM customers WHERE phone = ?",
      [phone]
    );
    return rows[0];
  },

  /* =========================
     GET ALL
  ========================= */
  getAll: async () => {
    const [rows] = await db.execute(
      "SELECT * FROM customers"
    );
    return rows;
  },

  /* =========================
     GET BY SALESPERSON
  ========================= */
  getBySalesperson: async (userId) => {
    const [rows] = await db.execute(
      "SELECT * FROM customers",
      [userId]
    );
    return rows;
  },

  /* =========================
     UPDATE CUSTOMER
  ========================= */
update: async (id, data) => {
  const [result] = await db.execute(
    `UPDATE customers SET
      customer_name = ?,
      segment_id = ?,
      contact_person = ?,
      phone = ?,
      email = ?,
      address = ?,
      gst_no = ?,
      website = ?,
      plant_location = ?,
      industry_type = ?,
      pan_no = ?
    WHERE id = ?`,
    [
      data.customer_name,
      data.segment_id,
      data.contact_person,
      data.phone,
      data.email,
      data.address,
      data.gst_no || null,
      data.website || null,
      data.plant_location || null,
      data.industry_type || null,
      data.pan_no || null,
      id
    ]
  );

  return result;
},
findByMobileExcludeId: async (phone, id) => {
  const [rows] = await db.execute(
    "SELECT * FROM customers WHERE phone = ? AND id != ?",
    [phone, id]
  );

  return rows[0];
},
  /* =========================
     DELETE CUSTOMER
  ========================= */
  delete: async (id) => {
    const [result] = await db.execute(
      "DELETE FROM customers WHERE id = ?",
      [id]
    );
    return result;
  }
};

module.exports = Customer;