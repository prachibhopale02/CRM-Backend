const db = require("../config/db");

const ProductionUpdate = {};

// ====================================
// CREATE UPDATE
// ====================================
ProductionUpdate.create = async (data) => {
  const {
    delivery_id,
    update_date,
    week_label,
    completed_qty,
    remarks,
    created_by
  } = data;

  const [result] = await db.query(
    `INSERT INTO production_updates
    (
      delivery_id,
      update_date,
      week_label,
      completed_qty,
      remarks,
      created_by
    )
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      delivery_id,
      update_date,
      week_label,
      completed_qty,
      remarks,
      created_by || null
    ]
  );

  return result;
};

// ====================================
// GET BY DELIVERY
// ====================================
ProductionUpdate.getByDelivery = async (
  deliveryId
) => {

  const [rows] = await db.query(
    `SELECT *
     FROM production_updates
     WHERE delivery_id = ?
     ORDER BY update_date DESC`,
    [deliveryId]
  );

  return rows;
};

// ====================================
// TOTAL COMPLETED QTY
// ====================================
ProductionUpdate.getTotalCompletedQty =
  async (deliveryId) => {

    const [rows] = await db.query(
      `SELECT
        SUM(completed_qty) total
       FROM production_updates
       WHERE delivery_id = ?`,
      [deliveryId]
    );

    return Number(rows[0].total || 0);
  };

module.exports = ProductionUpdate;