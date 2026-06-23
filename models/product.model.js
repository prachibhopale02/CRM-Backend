const db = require("../config/db");

const Product = {};

/* =========================
   CREATE PRODUCT
========================= */
Product.create = async (data) => {
  const [result] = await db.execute(
    `INSERT INTO products 
     (product_name, product_code, segment_id, unit)
     VALUES (?, ?, ?, ?)`,
    [
      data.product_name,
      data.product_code,
      data.segment_id,
      data.unit
    ]
  );
  return result;
};

/* =========================
   GET ALL ACTIVE PRODUCTS
========================= */
Product.getAll = async () => {
  const [rows] = await db.execute(
    `SELECT p.*, s.segment_name
     FROM products p
     JOIN segments s ON p.segment_id = s.id
     WHERE p.is_active = 1
     AND EXISTS (
       SELECT 1 
       FROM boms b 
       WHERE b.product_id = p.id 
       AND b.is_deleted = 0
     )
     ORDER BY p.id DESC`
  );
  return rows;
};
/* =========================
   SOFT DELETE PRODUCT
========================= */
Product.delete = async (id) => {
  const [result] = await db.execute(
    `DELETE FROM products WHERE id = ?`,
    [id]
  );
  return result;
};
/* =========================
   UPDATE PRODUCT
========================= */
Product.update = async (id, data) => {
  const [result] = await db.execute(
    `UPDATE products 
     SET product_name = ?, product_code = ?, segment_id = ?, unit = ?
     WHERE id = ?`,
    [data.product_name, data.product_code, data.segment_id, data.unit, id]
  );
  return result;
};

module.exports = Product;