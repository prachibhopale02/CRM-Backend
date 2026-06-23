const Item = require("../models/item.model");
const db = require("../config/db");

/* =========================
   GET ITEMS
========================= */
exports.getAllItems = async (req, res) => {
  try {
    const { product_id } = req.query;
    const items = await Item.getAll(product_id);
    res.json({ success: true, data: items });
  } catch (err) {
    console.error("ITEM FETCH ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =========================
   CREATE ITEM
========================= */
exports.createItem = async (req, res) => {
  try {
    const { item_name, item_code, unit, product_id, hsn_code, chemito_code,base_price, cost } = req.body;

    if (!item_name) {
      return res.status(400).json({ success: false, message: "Item name is required" });
    }

    const result = await Item.create({
      item_name,
      item_code,
      unit,
      product_id,
      hsn_code,
      chemito_code,
      base_price,
      cost
    });

    // fetch created item
    const [rows] = await db.execute(
      "SELECT * FROM items_master WHERE id = ?",
      [result.insertId]
    );

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (err) {
    console.error("ITEM CREATE ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =========================
   UPDATE ITEM
========================= */
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { item_name, item_code, unit, product_id, hsn_code, chemito_code,base_price, cost } = req.body;

    if (!item_name) {
      return res.status(400).json({ success: false, message: "Item name is required" });
    }

    await Item.update(id, { item_name, item_code, unit, product_id, hsn_code, chemito_code, base_price, cost });
    res.json({ success: true, message: "Item updated successfully" });
  } catch (err) {
    console.error("ITEM UPDATE ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* =========================
   DELETE ITEM
========================= */
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;

    // get product_id first
    const [itemRows] = await db.execute(
      `SELECT product_id
       FROM items_master
       WHERE id = ?`,
      [id]
    );

    if (!itemRows.length) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    const productId = itemRows[0].product_id;

    // delete BOM
    await db.execute(
      "DELETE FROM bom_items WHERE item_id = ?",
      [id]
    );

    // delete Project BOM
    await db.execute(
      "DELETE FROM project_bom_items WHERE item_id = ?",
      [id]
    );

    // delete item
    await db.execute(
      "DELETE FROM items_master WHERE id = ?",
      [id]
    );

    // reorder serial numbers
    const [remaining] = await db.execute(
      `SELECT id
       FROM items_master
       WHERE product_id = ?
       AND is_active = 1
       ORDER BY serial_no ASC`,
      [productId]
    );

    for (let i = 0; i < remaining.length; i++) {
      await db.execute(
        `UPDATE items_master
         SET serial_no = ?
         WHERE id = ?`,
        [i + 1, remaining[i].id]
      );
    }

    res.json({
      success: true,
      message: "Item deleted successfully"
    });

  } catch (err) {
    console.error("ITEM DELETE ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
exports.getItemsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;  // ✅ must match :productId in route
    console.log("Fetching items for productId:", productId); // debug

    const [rows] = await db.execute(
     `SELECT *
 FROM items_master
 WHERE product_id = ?
 AND is_active = 1
 ORDER BY serial_no ASC`
      [productId]
    );

    res.json({ success: true, data: rows });

  } catch (err) {
    console.error("Get Items By Product Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};