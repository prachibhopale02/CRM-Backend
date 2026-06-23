const db = require("../config/db");

/* ======================================================
   CREATE BOM (if not exists)
====================================================== */
exports.createOrGetBOM = async (connection, product_id) => {
  // Check if BOM already exists for this product
  const [rows] = await connection.execute(
    `SELECT id FROM boms WHERE product_id = ? AND is_deleted = 0`,
    [product_id]
  );

  if (rows.length > 0) {
    return rows[0].id;
  }

  // Create new BOM
  const [result] = await connection.execute(
    `INSERT INTO boms (product_id) VALUES (?)`,
    [product_id]
  );

  return result.insertId;
};

/* ======================================================
   INSERT BOM ITEM
====================================================== */
exports.insertBOMItem = async (connection, bom_id, item_id, quantity) => {
  // Check if same item already exists in this BOM
  const [existing] = await connection.execute(
    `SELECT id FROM bom_items WHERE bom_id = ? AND item_id = ?`,
    [bom_id, item_id]
  );

  if (existing.length > 0) {
    // 🔄 UPDATE quantity if exists
    await connection.execute(
      `UPDATE bom_items SET quantity = ? WHERE bom_id = ? AND item_id = ?`,
      [quantity, bom_id, item_id]
    );
  } else {
    // ➕ INSERT if not exists
    await connection.execute(
      `INSERT INTO bom_items (bom_id, item_id, quantity)
       VALUES (?, ?, ?)`,
      [bom_id, item_id, quantity]
    );
  }
};
/* ======================================================
   UPDATE BOM ITEM QUANTITY
====================================================== */
exports.updateBOMItemQuantity = async (connection, bom_item_id, quantity) => {
  await connection.execute(
    `UPDATE bom_items SET quantity = ? WHERE id = ?`,
    [quantity, bom_item_id]
  );
};

/* ======================================================
   DELETE BOM ITEMS (During Update or Remove)
====================================================== */
exports.deleteBOMItems = async (connection, bom_id) => {
  await connection.execute(
    `DELETE FROM bom_items WHERE bom_id = ?`,
    [bom_id]
  );
};

/* ======================================================
   GET BOM BY PRODUCT
====================================================== */
exports.getBOMByProduct = async (product_id) => {
  const [rows] = await db.execute(
    `SELECT 
        b.id AS bom_id,
        b.product_id,
        bi.id AS bom_item_id,
        bi.item_id,
        bi.quantity,
        im.item_name,
        im.unit,
        im.hsn_code,
        im.base_price
     FROM boms b
     LEFT JOIN bom_items bi ON b.id = bi.bom_id
     LEFT JOIN items_master im ON bi.item_id = im.id
     WHERE b.product_id = ? AND b.is_deleted = 0`,
    [product_id]
  );

  return rows;
};

/* ======================================================
   SOFT DELETE BOM
====================================================== */
exports.softDeleteBOM = async (bom_id) => {
  await db.execute(
    `UPDATE boms SET is_deleted = 1, deleted_at = NOW() WHERE id = ?`,
    [bom_id]
  );
};
