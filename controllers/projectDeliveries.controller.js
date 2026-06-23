const ProjectDelivery = require("../models/projectDeliveries.model");
const { sendDeliveryEmail } = require("../utils/sendDeliveryEmail");
const db = require("../config/db");
const sendEmail = require("../utils/sendiofEmail");
const User = require("../models/user.model");
const Project = require("../models/project.model");


// ================= Get deliveries for a project =================
exports.getByProject = async (req, res) => {
  try {
    const projectId = req.params.projectId;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID required"
      });
    }

    const deliveries = await ProjectDelivery.getByProject(projectId);

    res.json({
      success: true,
      data: deliveries
    });

  } catch (err) {
    console.error("Get Delivery Error:", err.message);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};


// ================= Create / Update Delivery Plan =================
exports.createOrUpdate = async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { deliveries } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, message: "Project ID required" });
    }

    if (!deliveries || !Array.isArray(deliveries) || deliveries.length === 0) {
      return res.status(400).json({ success: false, message: "Deliveries must be an array" });
    }

    // 🔹 Fetch project order date
    const [projectRows] = await db.query(
      "SELECT order_month FROM projects WHERE id = ?",
      [projectId]
    );

    if (!projectRows[0]) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const orderDate = projectRows[0].order_month; // YYYY-MM-DD

    // 🔹 Validation: delivery date cannot be before order date
  const invalidRow = deliveries.find(
  d => d.delivery_month && new Date(d.delivery_month) < new Date(orderDate)
);
    if (invalidRow) {
      return res.status(400).json({
        success: false,
        message: "Delivery date cannot be before project order date!"
      });
    }
// 🔥 VALIDATION
const invalidQtyRow = deliveries.find(d => {
  const plannedQty = Number(d.delivery_quantity || 0);
  const deliveredQty = Number(d.delivered_quantity || 0);

  return plannedQty < deliveredQty;
});

if (invalidQtyRow) {
  return res.status(400).json({
    success: false,
    message:
      "Planned quantity cannot be less than delivered quantity"
  });
}
    const cleanedDeliveries = deliveries.map(d => ({
      ...d,
      rescheduled_from: d.rescheduled_from || null
    }));

    await ProjectDelivery.createOrUpdate(projectId, cleanedDeliveries);

    await sendDeliveryEmail(projectId, cleanedDeliveries);

    res.json({ success: true, message: "Deliveries saved successfully" });

  } catch (err) {
  console.error("🔥 DELIVERY ERROR FULL:", err);

  res.status(500).json({
    success: false,
    message: err.message,   // 🔥 ACTUAL ERROR भेजो
    error: err
  });
}
};

// ================= Mark Delivery Completed =================
exports.markCompleted = async (req, res) => {
  try {
    const { id } = req.params;
  const {
  invoice_no,
  invoice_date,
  description,
  delivered_quantity
} = req.body;

const invoice_file = req.file
  ? req.file.filename
  : null;
const file = req.file;

let invoiceFilePath = null;

if (file) {
  invoiceFilePath = file.path; // save path in DB if needed
}
    // 🔹 Fetch current delivery row
    const [deliveryRows] = await db.query(
      `SELECT project_id, delivery_quantity, delivery_value, delivery_month, rescheduled_from
       FROM project_deliveries
       WHERE id = ?`,
      [id]
    );

    if (!deliveryRows[0]) {
      return res.status(404).json({ success: false, message: "Delivery not found" });
    }

    const deliveryRow = deliveryRows[0];
    const projectId = deliveryRow.project_id;
    const plannedQty = Number(deliveryRow.delivery_quantity || 0);
    const plannedValue = Number(deliveryRow.delivery_value || 0);
    const deliveredQtyInput = Number(delivered_quantity || 0);
    const unitValue = plannedQty > 0 ? plannedValue / plannedQty : 0;
    const deliveredValue = deliveredQtyInput * unitValue;

    // 🔹 Determine current delivery status
    let status = "PENDING";
    if (deliveredQtyInput > 0 && deliveredQtyInput < plannedQty) {
      status = "PARTIAL_DELIVERED";
    } else if (deliveredQtyInput >= plannedQty) {
      status = "DELIVERED";
    }

    // 🔹 Update current delivery
    await db.query(
      `UPDATE project_deliveries
       SET invoice_no = ?, invoice_date = ?, description = ?, invoice_file = ?, delivered_quantity = ?, delivered_value = ?, 
           is_completed = 1, status = ?, completed_at = NOW()
       WHERE id = ?`,
      [
        invoice_no,
        invoice_date,
        description,
        invoice_file,
        deliveredQtyInput,
        deliveredValue,
        status,
        id
      ]
    );

    // 🔹 Update parent delivery if this is a rescheduled row
    if (deliveryRow.rescheduled_from) {
      const parentId = deliveryRow.rescheduled_from;

      // 🔹 Total delivered including parent + all children
      const [[sumRows]] = await db.query(
        `SELECT COALESCE(SUM(delivered_quantity),0) AS totalDelivered
         FROM project_deliveries
         WHERE id = ? OR rescheduled_from = ?`,
        [parentId, parentId]
      );

      const totalDeliveredQty = Number(sumRows?.totalDelivered || 0);

      // 🔹 Parent planned qty
      const [[parentRow]] = await db.query(
        `SELECT delivery_quantity FROM project_deliveries WHERE id = ?`,
        [parentId]
      );

      const parentQty = Number(parentRow?.delivery_quantity || 0);

      // 🔹 Determine parent status
      let parentStatus = "PENDING";
      if (totalDeliveredQty > 0 && totalDeliveredQty < parentQty) {
        parentStatus = "PARTIAL_DELIVERED";
      } else if (totalDeliveredQty >= parentQty) {
        parentStatus = "DELIVERED";
      }

      // 🔹 Update parent delivery with total delivered and status
    // 🔹 completed flag
const isCompleted =
  deliveredQtyInput >= plannedQty ? 1 : 0;

// 🔹 Update current delivery
await db.query(
  `UPDATE project_deliveries
   SET
       invoice_no = ?,
       invoice_date = ?,
       description = ?,
       delivered_quantity = ?,
       delivered_value = ?,
       is_completed = ?,
       status = ?,
       completed_at = NOW()
   WHERE id = ?`,
  [
    invoice_no,
    invoice_date,
    description,
    deliveredQtyInput,
    deliveredValue,
    isCompleted,
    status,
    id
  ]
);
    }

    // 🔹 Update overall project status
    const [[sumRowsProject]] = await db.query(
      `SELECT COALESCE(SUM(delivered_quantity),0) AS totalDelivered
       FROM project_deliveries
       WHERE project_id = ?`,
      [projectId]
    );

    const deliveredQty = Number(sumRowsProject?.totalDelivered || 0);

    const [[projectRow]] = await db.query(
      `SELECT 
  order_quantity,
  is_order_confirmed,
  order_booking_status
FROM projects
WHERE id = ?`,
      [projectId]
    );

    if (!projectRow) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

  const orderQty = Number(projectRow.order_quantity || 0);

const currentBookingStatus =
  projectRow.order_booking_status;

let newBookingStatus = currentBookingStatus;

// =========================
// AUTO DELIVERY STATUS
// =========================

if (deliveredQty >= orderQty) {
  newBookingStatus = "DELIVERED";
}
else if (deliveredQty > 0) {
  newBookingStatus = "PARTIAL_DELIVERED";
}

// =========================
// PRODUCTION STATUS
// =========================

let productionStatus = "PENDING";

if (deliveredQty > 0 && deliveredQty < orderQty) {
  productionStatus = "IN_PRODUCTION";
}
else if (deliveredQty >= orderQty) {
  productionStatus = "COMPLETED";
}

// =========================
// UPDATE PROJECT
// =========================

await db.query(
  `UPDATE projects
   SET
     status = ?,
     is_order_confirmed = ?,
     order_booking_status = ?
   WHERE id = ?`,
  [
    productionStatus,
    "YES",
    newBookingStatus,
    projectId
  ]
);

    res.json({
      success: true,
      message: "Delivery marked completed",
    productionStatus,
bookingStatus: newBookingStatus,
      deliveredQty,
      orderQty
    });
  } catch (err) {
    console.error("Mark Completed Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// ================= CEO Monthly Delivery Report =================
exports.getMonthlyDeliveryReport = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) return res.status(400).json({ success: false, message: "Month and year are required" });

    const [rows] = await db.query(
      `SELECT
pd.id,
p.project_title,
c.customer_name,
u.username AS salesperson_name,
pd.delivery_month,
pd.delivery_quantity AS planned_quantity,
pd.delivery_value AS planned_value,
COALESCE((
  SELECT SUM(delivered_quantity)
  FROM project_deliveries rd
  WHERE rd.rescheduled_from = pd.id
), 0) AS delivered_quantity,
pd.status,
pd.is_completed
FROM project_deliveries pd
JOIN projects p ON pd.project_id = p.id
LEFT JOIN customers c ON p.customer_id = c.id
LEFT JOIN users u ON p.salesperson_id = u.id
WHERE pd.rescheduled_from IS NULL
AND MONTH(pd.delivery_month) = ?
AND YEAR(pd.delivery_month) = ?
ORDER BY pd.delivery_month;`,
      [month, year]
    );

    // 🔹 Compute remaining quantity
    rows.forEach(r => {
      r.planned_quantity = Number(r.planned_quantity || 0);
      r.planned_value = Number(r.planned_value || 0);
      r.delivered_quantity = Number(r.delivered_quantity || 0);
      r.delivered_value = Number(r.delivered_value || 0);
      r.remaining_quantity = r.planned_quantity - r.delivered_quantity;
    });

    const total = rows.length;
    const completed = rows.filter(r => r.status === "DELIVERED").length;
    const partial = rows.filter(r => r.status === "PARTIAL_DELIVERED").length;
    const pending = rows.filter(r => r.status === "PENDING").length;

    res.json({
      success: true,
      summary: { total, completed, partial, pending },
      data: rows
    });

  } catch (err) {
    console.error("Monthly Report Error:", err);
    res.status(500).json({ success: false, message: "Error fetching monthly report" });
  }
};


exports.getAll = async (req,res)=>{
try{

const [rows] = await db.query(`
SELECT 
pd.*,
p.project_title,
c.customer_name,
p.salesperson_id,
u.username AS salesperson_name,
pr.product_name,
pd.invoice_file
FROM project_deliveries pd
LEFT JOIN projects p ON p.id = pd.project_id
LEFT JOIN customers c ON c.id = p.customer_id
 LEFT JOIN users u
ON p.salesperson_id = u.id
LEFT JOIN products pr ON pr.id = p.product_id
`);

res.json(rows);

}catch(err){

console.error("Get All Deliveries Error:",err);
res.status(500).json({error:err.message});

}
};
// ================= Delete Delivery =================
exports.deleteDelivery = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Delivery ID required"
      });
    }

    await ProjectDelivery.deleteById(id);

    res.json({
      success: true,
      message: "Delivery deleted successfully"
    });
  } catch (err) {
    console.error("Delete Delivery Error:", err.message);
    res.status(400).json({
      success: false,
      message: err.message || "Cannot delete delivery"
    });
  }
};
exports.getPendingDeliveries = async (req, res) => {
  try {
    const user_id = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        pd.id,
        pd.delivery_month,
        pd.delivery_quantity,
        pd.delivered_quantity,
        p.project_title
      FROM project_deliveries pd
      JOIN projects p ON pd.project_id = p.id
      WHERE 
        MONTH(pd.delivery_month) <= MONTH(CURDATE())
        AND YEAR(pd.delivery_month) = YEAR(CURDATE())
        AND pd.delivered_quantity < pd.delivery_quantity
    `);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error("Pending Deliveries Error:", err);
    res.status(500).json({ success: false });
  }
};
exports.sendInvoiceMail = async (req, res) => {
  try {
    const deliveryId = req.params.id;

    // ================= FETCH DELIVERY =================
    const [deliveryRows] = await db.query(
      `SELECT * FROM project_deliveries WHERE id = ?`,
      [deliveryId]
    );

    const delivery = deliveryRows[0];

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery not found"
      });
    }

    // ================= FETCH RELATED DATA =================
    const project = await Project.findById(delivery.project_id);
    const salesperson = await User.findById(project.salesperson_id);

    const ceoList = await User.findByType("CEO");
    const pmList = await User.findByType("PRODUCTION_MANAGER");

    const ceo = ceoList[0];
    const pm = pmList[0];

    // ================= EMAIL HTML =================
    const html = `
      <div style="font-family:Arial;padding:20px;">

        <h2 style="color:green;">Invoice Generated</h2>

        <p><b>Project:</b> ${project.project_title}</p>
        <p><b>Invoice No:</b> ${delivery.invoice_no || "-"}</p>
        <p><b>Invoice Date:</b> ${delivery.invoice_date || "-"}</p>
        <p><b>Delivered Quantity:</b> ${delivery.delivered_quantity || 0}</p>
        <p><b>Description:</b> ${delivery.description || "-"}</p>

        ${
          delivery.invoice_file
            ? `<p><b>Invoice File:</b> Attached below</p>`
            : `<p><b>Invoice File:</b> Not uploaded</p>`
        }

      </div>
    `;

    // ================= ATTACHMENT LOGIC =================
    const attachments = [];

    if (delivery.invoice_file) {
      attachments.push({
        filename: delivery.invoice_file.split("/").pop(),
        path: delivery.invoice_file
      });
    }

    // ================= SEND EMAIL =================
    await sendEmail(
      `"${pm?.username || "Production Manager"}" <${process.env.EMAIL_USER}>`,
      salesperson.email,
      `Invoice Generated - ${project.project_title}`,
      html,
      [ceo?.email],
      attachments.length > 0 ? attachments : undefined
    );

    res.json({
      success: true,
      message: "Invoice mail sent successfully"
    });

  } catch (err) {
    console.error("Send Invoice Mail Error:", err);

    res.status(500).json({
      success: false,
      message: err.message || "Failed to send invoice mail"
    });
  }
};
exports.getHistory = async (req, res) => {

  try {

    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT *
      FROM project_deliveries
      WHERE
        id = (
          SELECT COALESCE(parent_delivery_id, id)
          FROM project_deliveries
          WHERE id = ?
        )

      OR

        parent_delivery_id = (
          SELECT COALESCE(parent_delivery_id, id)
          FROM project_deliveries
          WHERE id = ?
        )

      ORDER BY edited_at DESC
      `,
      [id, id]
    );

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false
    });

  }
};
exports.rescheduleByProduction = async (req, res) => {
  try {

    const { id } = req.params;

    const {
      remaining_quantity,
      new_delivery_month
    } = req.body;

    // 🔥 FIRST FETCH DELIVERY
    const [[delivery]] = await db.execute(
      `SELECT * FROM project_deliveries
       WHERE id = ?`,
      [id]
    );

    if (!delivery) {
      return res.status(404).json({
        message: "Delivery not found"
      });
    }

    // 🔥 VALIDATION
    const alreadyRescheduledQty =
      Number(delivery.rescheduled_quantity || 0);

    const currentRemaining =
      Number(delivery.delivery_quantity || 0)
      - Number(delivery.delivered_quantity || 0)
      - alreadyRescheduledQty;

    if (remaining_quantity > currentRemaining) {
      return res.status(400).json({
        message: `Only ${currentRemaining} qty remaining`
      });
    }

    // 🔥 PER UNIT VALUE
    const perUnitValue =
      Number(delivery.delivery_quantity || 0) > 0
        ? Number(delivery.delivery_value || 0)
          / Number(delivery.delivery_quantity || 0)
        : 0;

    // 🔥 NEW DELIVERY VALUE
    const newDeliveryValue =
      perUnitValue * Number(remaining_quantity);

    // 🔥 CREATE CHILD DELIVERY
    await db.execute(
      `INSERT INTO project_deliveries
      (
        project_id,
        delivery_month,
        delivery_quantity,
        delivery_value,
        delivered_quantity,
        delivered_value,
        status,
        rescheduled_from,
        priority
      )
      VALUES (?, ?, ?, ?, 0, 0, 'PENDING', ?, ?)`,
      [
        delivery.project_id,
        new_delivery_month,
        remaining_quantity,
        newDeliveryValue,
        id,
        delivery.priority || "MEDIUM"
      ]
    );

    // 🔥 UPDATE RESCHEDULED QTY
    await db.execute(
      `UPDATE project_deliveries
       SET rescheduled_quantity =
         COALESCE(rescheduled_quantity,0) + ?
       WHERE id = ?`,
      [
        remaining_quantity,
        id
      ]
    );

    res.json({
      success: true
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      message: err.message
    });

  }
};