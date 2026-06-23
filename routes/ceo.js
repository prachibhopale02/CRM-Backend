// routes/ceo.js
const express = require("express");
const router = express.Router();
const db = require("../config/db"); // adjust path if needed

// GET monthly delivery report
router.get("/delivery-report", async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res.status(400).json({ success: false, message: "Month and year required" });
  }

  try {
    // ---------------- Summary ----------------
    const [summaryRows] = await db.query(
      `
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN is_completed = 0 THEN 1 ELSE 0 END) AS pending
      FROM project_deliveries pd
      JOIN projects p ON pd.project_id = p.id
      WHERE MONTH(pd.delivery_month) = ? AND YEAR(pd.delivery_month) = ?
      `,
      [month, year]
    );

    // ---------------- Full schedule ----------------
    const [scheduleRows] = await db.query(
      `
      SELECT 
        pd.id,
        p.project_title,
        c.customer_name,
        pr.product_name,
        pd.delivery_month,
        pd.delivery_quantity,
        pd.delivery_value,
        pd.is_completed
      FROM project_deliveries pd
      JOIN projects p ON pd.project_id = p.id
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN products pr ON p.product_id = pr.id
      WHERE MONTH(pd.delivery_month) = ? AND YEAR(pd.delivery_month) = ?
      ORDER BY pd.delivery_month ASC
      `,
      [month, year]
    );

    res.json({
      success: true,
      summary: summaryRows[0],
      data: scheduleRows
    });

  } catch (err) {
    console.error("Delivery Report Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;