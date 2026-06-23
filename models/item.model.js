const db = require("../config/db");

const Item = {};

/* =========================
   GET ALL ITEMS (OPTIONAL FILTER BY PRODUCT)
========================= */
Item.getAll = async (productId = null) => {
  let sql = `
    SELECT 
      i.id,
      i.serial_no,
      i.item_name,
      i.item_code,
      i.unit,
      i.hsn_code,
      i.chemito_code,
      i.base_price,
      i.cost,
      i.product_id,
      p.product_name
    FROM items_master i
    LEFT JOIN products p ON i.product_id = p.id
    WHERE i.is_active = 1
  `;
  const params = [];
  if (productId) {
    sql += " AND i.product_id = ?";
    params.push(productId);
  }
  sql += " ORDER BY i.id DESC";
  const [rows] = await db.execute(sql, params);
  return rows;
};

/* =========================
   CREATE ITEM
========================= */
Item.create = async (data) => {

  // next serial number
  const [rows] = await db.execute(
    `SELECT MAX(serial_no) as maxSerial
     FROM items_master
     WHERE product_id = ?`,
    [data.product_id]
  );

  const nextSerial = (rows[0].maxSerial || 0) + 1;

  const [result] = await db.execute(
    `INSERT INTO items_master
      (
        serial_no,
        item_name,
        item_code,
        unit,
        product_id,
        hsn_code,
        chemito_code,
        base_price,
        cost
      )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nextSerial,
      data.item_name,
      data.item_code || null,
      data.unit || null,
      data.product_id || null,
      data.hsn_code || null,
      data.chemito_code || null,
      data.base_price || 0,
      data.cost || 0
    ]
  );

  return result;
};

/* =========================
   UPDATE ITEM
========================= */
Item.update = async (id, data) => {
  const [result] = await db.execute(
    `UPDATE items_master
     SET item_name = ?, item_code = ?, unit = ?, hsn_code = ?, chemito_code = ?, base_price = ?, cost = ?
     WHERE id = ?`,
    [
      data.item_name,
      data.item_code || null,
      data.unit || null,
      data.hsn_code || null,
      data.chemito_code || null,
      data.base_price || 0,
      data.cost || 0,  // <-- FIXED
      id
    ]
  );
  return result;
};
/* =========================
   SOFT DELETE ITEM
========================= */
Item.delete = async (id) => {

  // get product_id first
  const [itemRows] = await db.execute(
    `SELECT product_id
     FROM items_master
     WHERE id = ?`,
    [id]
  );

  if (!itemRows.length) {
    return null;
  }

  const productId = itemRows[0].product_id;

  // soft delete
  await db.execute(
    `UPDATE items_master
     SET is_active = 0
     WHERE id = ?`,
    [id]
  );

  // get remaining active items
  const [remaining] = await db.execute(
    `SELECT id
     FROM items_master
     WHERE product_id = ?
     AND is_active = 1
     ORDER BY serial_no ASC`,
    [productId]
  );

  // reset serial numbers
  for (let i = 0; i < remaining.length; i++) {
    await db.execute(
      `UPDATE items_master
       SET serial_no = ?
       WHERE id = ?`,
      [i + 1, remaining[i].id]
    );
  }

  return true;
};
module.exports = Item;