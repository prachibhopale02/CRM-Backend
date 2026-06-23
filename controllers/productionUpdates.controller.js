const db = require("../config/db");

const ProductionUpdate = require(
  "../models/productionUpdates.model"
);

// =====================================
// ADD UPDATE
// =====================================
exports.addProductionUpdate =
  async (req, res) => {

    try {

      const { deliveryId } = req.params;

      const {
        completed_qty,
        remarks,
        week_label,
        update_date,
        created_by
      } = req.body;

      // -------------------------
      // Delivery Info
      // -------------------------
      const [deliveryRows] =
        await db.query(
          `SELECT *
           FROM project_deliveries
           WHERE id = ?`,
          [deliveryId]
        );

      if (deliveryRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found"
        });
      }

      const delivery =
        deliveryRows[0];

      // -------------------------
      // Current total
      // -------------------------
      const currentCompleted =
        await ProductionUpdate
          .getTotalCompletedQty(
            deliveryId
          );

      const newTotal =
        currentCompleted +
        Number(completed_qty);

      // -------------------------
      // Validation
      // -------------------------
      if (
        newTotal >
        Number(delivery.delivery_quantity)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Completed qty exceeds delivery quantity"
        });
      }

      // -------------------------
      // Create update
      // -------------------------
      await ProductionUpdate.create({
        delivery_id: deliveryId,
        update_date,
        week_label,
        completed_qty,
        remarks,
        created_by
      });

      // -------------------------
      // Status
      // -------------------------
      let status = "PENDING";

      if (
        newTotal >=
        Number(delivery.delivery_quantity)
      ) {
        status = "DELIVERED";
      }
      else if (newTotal > 0) {
        status = "PARTIAL_DELIVERED";
      }

      // -------------------------
      // Update delivery
      // -------------------------
      await db.query(
        `UPDATE project_deliveries
         SET delivered_quantity = ?,
             status = ?,
             is_completed = ?
         WHERE id = ?`,
        [
          newTotal,
          status,
          newTotal >=
          Number(delivery.delivery_quantity)
            ? 1
            : 0,
          deliveryId
        ]
      );

      res.json({
        success: true,
        message:
          "Production update added"
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  };

// =====================================
// GET ALL UPDATES
// =====================================
exports.getProductionUpdates =
  async (req, res) => {

    try {

      const { deliveryId } =
        req.params;

      const rows =
        await ProductionUpdate
          .getByDelivery(
            deliveryId
          );

      res.json({
        success: true,
        data: rows
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  };
  // =====================================
// PRODUCTION PROGRESS REPORT
// =====================================
exports.getProductionProgress =
  async (req, res) => {

    try {

      const db =
        require("../config/db");
const [rows] = await db.query(`

SELECT

  pd.id,

  pd.project_id,

  pd.delivery_month,

  pd.delivery_quantity,

  pd.delivered_quantity,

  pd.priority,

  pd.status,

  pd.production_deadline,

  pd.production_status,

  p.project_title,

  p.salesperson_id,

  c.customer_name,

  MAX(pu.update_date) AS latest_update,

  (
    SELECT pu3.week_label
    FROM production_updates pu3
    WHERE pu3.delivery_id = pd.id
    ORDER BY pu3.update_date DESC, pu3.id DESC
    LIMIT 1
  ) AS week_label,

  (
    SELECT remarks
    FROM production_updates pu2
    WHERE pu2.delivery_id = pd.id
    ORDER BY pu2.update_date DESC, pu2.id DESC
    LIMIT 1
  ) AS latest_remark

FROM project_deliveries pd

LEFT JOIN production_updates pu
ON pu.delivery_id = pd.id

LEFT JOIN projects p
ON p.id = pd.project_id

LEFT JOIN customers c
ON c.id = p.customer_id

GROUP BY
  pd.id,
  pd.project_id,
  pd.delivery_month,
  pd.delivery_quantity,
  pd.delivered_quantity,
  pd.priority,
  pd.status,
  pd.production_deadline,
  pd.production_status,
  p.project_title,
  p.salesperson_id,
  c.customer_name

ORDER BY latest_update DESC
`);
      res.json({
        success: true,
        data: rows
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  };