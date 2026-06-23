const db = require("../config/db");

const ProjectDelivery = {};

// ================= SAFE PRODUCTION STATUS =================
const mapProductionStatus = (status) => {
  switch (status) {
    case "NOT_STARTED":
    case "IN_PROGRESS":
    case "READY":
    case "DELAYED":
      return status;

    // old compatibility
    case "PENDING":
      return "NOT_STARTED";

    case "PARTIAL_DELIVERED":
      return "IN_PROGRESS";

    case "DELIVERED":
      return "READY";

    default:
      return "NOT_STARTED";
  }
};

// ================= Get deliveries for a project =================
ProjectDelivery.getByProject = async (projectId) => {
  const [rows] = await db.execute(
    `
    SELECT 
      id,
      project_id,
      DATE_FORMAT(delivery_month, '%Y-%m-%d') AS delivery_month,
      production_deadline,
      production_status,
      delivery_quantity,
      delivered_quantity,
      delivery_value,
      delivered_value,
      invoice_no,
      invoice_date,
      invoice_file,
      description,
      is_completed,
      status,
      completed_at,
      rescheduled_from,
      priority 
    FROM project_deliveries
    WHERE project_id = ?
    AND is_latest = 1
    ORDER BY is_completed ASC, delivery_month ASC
    `,
    [projectId]
  );

  return rows;
};

ProjectDelivery.createOrUpdate = async (projectId, deliveries) => {

  if (!Array.isArray(deliveries) || deliveries.length === 0) {
    throw new Error("Deliveries are required");
  }

  const connection = await db.getConnection();

  try {

    await connection.beginTransaction();

    const ids = deliveries
      .filter(d => d.id)
      .map(d => d.id);

    let existingMap = {};

    if (ids.length > 0) {

      const [existingRows] = await connection.query(
        `SELECT id, delivered_quantity
         FROM project_deliveries
         WHERE id IN (?)`,
        [ids]
      );

      existingRows.forEach(r => {
        existingMap[r.id] = r;
      });
    }

    const insertValues = [];
    const updatePromises = [];
    const parentUpdates = [];

    for (const d of deliveries) {

      const month =
        d.delivery_month &&
        d.delivery_month.length === 7
          ? d.delivery_month + "-01"
          : d.delivery_month;

      const qty = Number(d.delivery_quantity || 0);

      const value = Number(d.delivery_value || 0);

      const rescheduledFrom =
        d.rescheduled_from &&
        !isNaN(d.rescheduled_from)
          ? Number(d.rescheduled_from)
          : null;

      let deliveredQty =
        d.delivered_quantity !== undefined
          ? Number(d.delivered_quantity)
          : Number(existingMap[d.id]?.delivered_quantity || 0);

      // ================= DELIVERY STATUS =================

      let status = "PENDING";

      if (deliveredQty >= qty) {
        status = "DELIVERED";
      }
      else if (deliveredQty > 0) {
        status = "PARTIAL_DELIVERED";
      }

      const isCompleted =
        deliveredQty >= qty ? 1 : 0;

      const deliveredValue =
        deliveredQty * (value / qty || 0);

      // ================= PRODUCTION STATUS =================

      let productionStatus = "NOT_STARTED";

      if (d.production_status) {

        productionStatus = d.production_status;

      } else {

        if (deliveredQty > 0 && deliveredQty < qty) {
          productionStatus = "IN_PROGRESS";
        }
        else if (deliveredQty >= qty) {
          productionStatus = "READY";
        }
      }

      // ================= UPDATE =================

  if (d.id) {

  const [[oldRow]] = await connection.query(
    `SELECT * FROM project_deliveries WHERE id = ?`,
    [d.id]
  );

  if (oldRow) {

    // ================= CHECK CHANGES =================

const formattedMonth =
  month?.length === 7
    ? month + "-01"
    : month;

const oldDeadline = oldRow.production_deadline
  ? new Date(oldRow.production_deadline)
      .toISOString()
      .split("T")[0]
  : null;

const isChanged =
  oldRow.delivery_month
    ?.toISOString?.()
    .split("T")[0] !== formattedMonth ||

  Number(oldRow.delivery_quantity) !== qty ||

  Number(oldRow.delivery_value) !== value ||

  oldDeadline !== (d.production_deadline || null) ||

  oldRow.production_status !== productionStatus ||

  oldRow.priority !== (d.priority || "MEDIUM");

    // ================= ONLY IF CHANGED =================

    if (isChanged) {

      // old row inactive
      await connection.query(
        `
        UPDATE project_deliveries
        SET is_latest = 0
        WHERE id = ?
        `,
        [d.id]
      );

      // new version
      insertValues.push([
        projectId,

        oldRow.parent_delivery_id || oldRow.id,

        1,

        new Date(),

        month,

        d.production_deadline || null,

        productionStatus,

        qty,

        value,

        deliveredQty,

        deliveredValue,

        status,

        isCompleted,

        rescheduledFrom,

        d.invoice_file || null,

        d.priority || "MEDIUM"
      ]);
    }
  }
}
      // ================= INSERT =================
else {

 insertValues.push([
  projectId,
  null,
  1,
  new Date(),

  month,
  d.production_deadline || null,
  productionStatus,
  qty,
  value,
  deliveredQty,
  deliveredValue,
  status,
  isCompleted,
  rescheduledFrom,
  d.invoice_file || null,
  d.priority || "MEDIUM"
]);
        if (rescheduledFrom && deliveredQty > 0) {
          parentUpdates.push(rescheduledFrom);
        }
      }
    }

    // ================= BULK INSERT =================

    if (insertValues.length > 0) {

      await connection.query(
        `INSERT INTO project_deliveries
(
  project_id,
  parent_delivery_id,
  is_latest,
  edited_at,
  delivery_month,
  production_deadline,
  production_status,
  delivery_quantity,
  delivery_value,
  delivered_quantity,
  delivered_value,
  status,
  invoice_file,
  is_completed,
  rescheduled_from,
  priority
)
        VALUES ?`,
        [insertValues]
      );
    }

    // ================= BULK UPDATE =================

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    // ================= PARENT UPDATE =================

    if (parentUpdates.length > 0) {

      await connection.query(
        `UPDATE project_deliveries
         SET
           status='PARTIAL_DELIVERED',
           is_completed=0
         WHERE id IN (?)`,
        [parentUpdates]
      );
    }

    await connection.commit();

    return true;

  } catch (err) {

    await connection.rollback();

    console.error("🔥 MODEL ERROR:", err);

    throw err;

  } finally {

    connection.release();

  }
};

// ================= Delete Delivery =================
ProjectDelivery.deleteById = async (id) => {
  if (!id) {
    throw new Error("Delivery ID required");
  }

  const [rows] = await db.query(
    `
    SELECT
      delivered_quantity,
      is_completed
    FROM project_deliveries
    WHERE id = ?
    `,
    [id]
  );

  if (!rows[0]) {
    throw new Error("Delivery not found");
  }

  if (
    rows[0].is_completed === 1 ||
    Number(rows[0].delivered_quantity || 0) > 0
  ) {
    throw new Error(
      "Cannot delete completed or partially delivered row"
    );
  }

  await db.query(
    `
    DELETE FROM project_deliveries
    WHERE id = ?
    `,
    [id]
  );

  return true;
};

module.exports = ProjectDelivery;