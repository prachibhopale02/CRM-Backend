const db = require("../config/db");
const BOM = require("../models/bom.model");

/* ======================================================
   CREATE OR UPDATE BOM (Single BOM Per Product)
====================================================== */
exports.createOrUpdateBOM = async (req, res) => {
  const { product_id, items } = req.body;

  if (!product_id || !items || items.length === 0) {
    return res.status(400).json({ message: "Product and items required" });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // 1️⃣ Get or create BOM
    const bomId = await BOM.createOrGetBOM(connection, product_id);
    // 3️⃣ Insert items
    for (let item of items) {
      await BOM.insertBOMItem(connection, bomId, item.item_id, item.quantity);
    }
    // backend/controllers/bom.controller.js
for (let item of items) {
  const qty = item.quantity ?? 0; // If undefined/null, use 0
  await BOM.insertBOMItem(connection, bomId, item.item_id, qty);
}
    await connection.commit();
    res.status(200).json({ message: "BOM created/updated successfully", bom_id: bomId });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};

/* ======================================================
   GET BOM BY PRODUCT
====================================================== */
exports.getBOMByProject = async (req, res) => {
  try {
    const { project_id } = req.params; // Actually it's product_id now
    const rows = await BOM.getBOMByProduct(project_id);

    res.status(200).json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ======================================================
   UPDATE PER UNIT QUANTITY
====================================================== */
exports.updatePerUnitQuantity = async (req, res) => {
  const { bom_item_id } = req.params;
  const { quantity } = req.body;

  // Only check for undefined or null, allow 0
  if (quantity === undefined || quantity === null) {
    return res.status(400).json({ message: "Quantity is required" });
  }

  try {
    const connection = await db.getConnection();
    await BOM.updateBOMItemQuantity(connection, bom_item_id, quantity);
    connection.release();

    res.status(200).json({ message: "Quantity updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
/* ======================================================
   DELETE BOM
====================================================== */
exports.deleteBOM = async (req, res) => {
  const { bom_id } = req.params;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Delete child items first
    await connection.execute(
      `DELETE FROM bom_items WHERE bom_id = ?`,
      [bom_id]
    );

    // Delete BOM
    await connection.execute(
      `DELETE FROM boms WHERE id = ?`,
      [bom_id]
    );

    await connection.commit();
    res.status(200).json({ message: "BOM deleted permanently" });

  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
};
// backend/controllers/bom.controller.js
exports.deleteBOMItem = async (req, res) => {
  const { bom_item_id } = req.params;

  try {
    const connection = await db.getConnection();
    await connection.beginTransaction();

    // 1️⃣ Get item_id and bom_id
    const [rows] = await connection.execute(
      "SELECT item_id, bom_id FROM bom_items WHERE id = ?",
      [bom_item_id]
    );

    if (!rows.length) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ message: "BOM item not found" });
    }

    const { item_id, bom_id } = rows[0];

    // 2️⃣ Delete from bom_items (HARD DELETE)
    await connection.execute(
      "DELETE FROM bom_items WHERE id = ?",
      [bom_item_id]
    );

    // 3️⃣ Delete cloned items from project_bom_items
    await connection.execute(
      "DELETE FROM project_bom_items WHERE item_id = ?",
      [item_id]
    );

    // 4️⃣ If BOM empty → delete BOM header
    const [remaining] = await connection.execute(
      "SELECT id FROM bom_items WHERE bom_id = ?",
      [bom_id]
    );

    if (remaining.length === 0) {
      await connection.execute(
        "DELETE FROM boms WHERE id = ?",
        [bom_id]
      );
    }

    await connection.commit();
    connection.release();

    res.json({ message: "BOM item deleted and project clone removed" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
// GET ALL BOM ITEMS
exports.getAllBOMItems = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM bom_items"); // replace 'bom_items' with your table name
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch BOM items" });
  }
};