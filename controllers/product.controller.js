const Product = require("../models/product.model");
const db = require("../config/db");

exports.getProductsWithBOM = async (req, res) => {
  try {

    const [rows] = await db.query(`
      SELECT 
        p.id,
        p.product_name,
        COALESCE(SUM(bi.quantity * im.base_price),0) AS unit_price

      FROM products p

      JOIN boms b 
        ON b.product_id = p.id
        AND b.is_deleted = 0

      LEFT JOIN bom_items bi 
        ON bi.bom_id = b.id

      LEFT JOIN items_master im 
        ON im.id = bi.item_id

      WHERE p.is_active = 1

      GROUP BY p.id

      ORDER BY p.product_name
    `);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error("Error fetching products with BOM:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products with BOM"
    });
  }
};
/* =========================
   CREATE PRODUCT
========================= */
exports.createProduct = async (req, res) => {
  try {
    const { product_name, product_code, segment_id, unit } = req.body;

    if (!product_name || !segment_id) {
      return res.status(400).json({ message: "Product name and segment required" });
    }

    const result = await Product.create({
      product_name,
      product_code,
      segment_id,
      unit
    });

    res.status(201).json({
      message: "Product created successfully",
      product_id: result.insertId
    });

  } catch (err) {
    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Product code already exists" });
    }

    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET PRODUCTS
========================= */
exports.getProducts = async (req, res) => {
  try {

    console.log("GET PRODUCTS API HIT");  // 👈 add this

    const [rows] = await db.query(`
      SELECT 
  p.id,
  p.product_name,
  p.product_code,
  p.unit,
  p.segment_id,
  s.segment_name,

  COALESCE(SUM(bi.quantity * im.base_price),0) AS unit_price

FROM products p

LEFT JOIN segments s 
  ON s.id = p.segment_id

LEFT JOIN boms b 
  ON b.product_id = p.id

LEFT JOIN bom_items bi 
  ON bi.bom_id = b.id

LEFT JOIN items_master im 
  ON im.id = bi.item_id

GROUP BY p.id
    `);

    console.log(rows); // 👈 add this

    res.json(rows);

  } catch (err) {
    console.error("Products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
};
/* =========================
   DELETE PRODUCT
========================= */
exports.deleteProduct = async (req, res) => {
  try {
    await Product.delete(req.params.id);
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
/* =========================
   UPDATE PRODUCT (CEO only)
========================= */
exports.updateProduct = async (req, res) => {
  try {
    const { product_name, product_code, segment_id, unit } = req.body;
    const { id } = req.params;

    if (!product_name || !segment_id) {
      return res.status(400).json({ message: "Product name and segment required" });
    }

    await Product.update(id, { product_name, product_code, segment_id, unit });

    res.json({ message: "Product updated successfully" });

  } catch (err) {
    console.error(err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Product code already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
};
