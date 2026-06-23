const db = require("../config/db");

const Project = {};
const MANUAL_STATUSES = [
  "BIDDING",
  "LEAD",
  "SUBMITTED",
  "ALLOTTED_TO_CUSTOMER",
  "UNDER_NEGOTIATION",
  "BOOKED",
  "UNDER_EXECUTION"
];

const AUTO_STATUSES = [
  "PARTIAL_DELIVERED",
  "DELIVERED"
];

const ALL_STATUSES = [
  ...MANUAL_STATUSES,
  ...AUTO_STATUSES
];
// Generate unique Project No
const generateProjectNo = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

  return `PN-${day}${month}${year}${hours}${minutes}${seconds}${milliseconds}`;
};
const generateIOFNo = async (conn, data) => {
  const { project_title, order_date, salesperson_name, product_name, salesperson_id } = data;

  const date = new Date(order_date || new Date());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const monthYear = `${month}-${year}`;

  const initials = salesperson_name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase();

  const [rows] = await conn.execute(
    `SELECT COUNT(*) as count 
     FROM projects 
     WHERE salesperson_id = ? 
     AND DATE_FORMAT(order_date, '%m-%y') = ?`,
    [salesperson_id, monthYear]
  );

  const nextNo = String(rows[0].count + 1).padStart(2, "0");

  return `${project_title}/IOF/${monthYear}/${initials}/${nextNo} - ${product_name}`;
};
Project.calculateAutoStatus = (
  currentStatus,
  deliveredQty,
  orderQty
) => {

  // fully delivered
  if (Number(deliveredQty) >= Number(orderQty)) {
    return "DELIVERED";
  }

  // partial delivery
  if (Number(deliveredQty) > 0) {
    return "PARTIAL_DELIVERED";
  }

  // otherwise preserve manual status
  return currentStatus;
};

Project.create = async (data) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Ensure required fields
    if (!data.project_title) throw new Error("Project title is required");
    if (!data.customer_id) throw new Error("Customer ID is required");
    if (!data.product_id) throw new Error("Product ID is required");
if (
  data.order_booking_status &&
  !ALL_STATUSES.includes(data.order_booking_status)
) {
  throw new Error("Invalid order booking status");
}

if (
  data.order_booking_status &&
  AUTO_STATUSES.includes(data.order_booking_status)
) {
  throw new Error(
    "PARTIAL_DELIVERED and DELIVERED are system controlled statuses"
  );
}
    const projectNo = generateProjectNo();
    const perUnitValue = Number(data.per_unit_value || 1); // default 1
    const orderQty = Number(data.order_quantity || 1);     // default 1
    const totalValue = perUnitValue * orderQty;

 const formattedMonth = data.order_month || new Date().toISOString().split("T")[0];

const [result] = await conn.execute(
  `INSERT INTO projects
  (project_no, project_title, customer_id, product_id, salesperson_id,
   order_quantity, order_month, per_unit_value, total_value,
   is_order_confirmed, remarks, project_remark, order_in_hand_qty, delivery_months,
   address, delivered_quantity, scheduled_quantity, temperature, order_no,created_by,
   order_date, order_booking_status, vendor_code, department_to, iof_no)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)`,
  [
    projectNo,
    data.project_title,
    data.customer_id,
    data.product_id,
    data.salesperson_id || null,
    orderQty,
    formattedMonth,
    perUnitValue,
    totalValue,
    data.is_order_confirmed || "NO",
    data.remarks || null,
    data.project_remark || null,
    data.order_in_hand_qty || 0,
    data.delivery_months || 1,
    data.address || null,
    0,
    0,
    data.temperature ?? null,
    data.order_no || null,
    data.created_by || null,
    data.order_date || null,
   (
  data.order_booking_status
    ? data.order_booking_status
    : Number(data.temperature) >= 100
    ? "BOOKED"
    : "LEAD"
),
    data.vendor_code || null,      // ✅ ADD
    data.department_to || null,    // ✅ ADD
  null                      // iof_no
  ]
);

const projectId = result.insertId;

    // Save deliveries if any
    if (Array.isArray(data.deliveries) && data.deliveries.length > 0) {
      for (const d of data.deliveries) {
        const deliveryQty = Number(d.delivery_quantity || 0);
        if (deliveryQty <= 0) continue;

        await conn.execute(
          `INSERT INTO project_deliveries
          (project_id, delivery_month, delivery_quantity, delivery_value)
          VALUES (?, ?, ?, ?)`,
          [projectId, d.delivery_month, deliveryQty, deliveryQty * perUnitValue]
        );
      }
    }

    await conn.commit();
    conn.release();

    return { success: true, project_id: projectId, project_no: projectNo };
  } catch (error) {
    await conn.rollback();
    conn.release();
    console.error("Project creation failed:", error.message);
    throw error;
  }
};


/* =========================
   GET ALL PROJECTS
========================= */
Project.getAll = async () => {
const [rows] = await db.execute(`
SELECT 
  p.id,
  p.project_no,
  p.project_title,
  p.iof_no,
  p.vendor_code,
  p.department_to,
  p.customer_id,
  p.product_id,
  p.salesperson_id,
  u.username AS salesperson_name,
  p.order_quantity,
  p.order_month,
  p.per_unit_value,
  p.total_value,
  p.status,
  p.temperature,
  p.order_no,
  p.order_date,
  p.address,
  p.created_at,
  p.remarks,
  p.project_remark,
  pr.product_name,
p.purchase_order_file,
p.quotation_file,
p.iof_file,
  -- ✅ CUSTOMER DATA FULL
  c.customer_name,
  c.pan_no,
  c.gst_no,
  c.address,
  c.contact_person,
  c.email,
  c.phone,
cu.username AS created_by_name,
  COALESCE(SUM(pd.delivery_quantity),0) AS scheduled_quantity,
  COALESCE(SUM(CASE WHEN pd.is_completed = 1 THEN pd.delivered_quantity ELSE 0 END),0) AS delivered_quantity,

p.order_booking_status
FROM projects p
LEFT JOIN customers c ON p.customer_id = c.id
LEFT JOIN users u ON p.salesperson_id = u.id
LEFT JOIN products pr ON p.product_id = pr.id
LEFT JOIN project_deliveries pd ON pd.project_id = p.id
LEFT JOIN users cu ON p.created_by = cu.id
GROUP BY p.id
ORDER BY p.id DESC;
`);
  return rows;
};


/* =========================
   GET BY SALESPERSON
========================= */
Project.getBySalesperson = async (salespersonId) => {

  const [rows] = await db.execute(
`SELECT 
  p.id,
  p.project_no,
  p.project_title,
  p.iof_no,
  p.vendor_code,
  p.department_to,
  p.customer_id,
  p.product_id,
  p.salesperson_id,
  u.username AS salesperson_name,
  p.order_quantity,
  p.order_month,
  p.per_unit_value,
  p.total_value,
  p.status,
  p.temperature,
  p.order_no,
  p.order_date,
  p.address,
  p.created_at,
  p.remarks,
  p.project_remark,
  pr.product_name,
p.purchase_order_file,
p.quotation_file,
p.iof_file,
  -- ✅ CUSTOMER DATA FULL
  c.customer_name,
  c.pan_no,
  c.gst_no,
  c.address,
  c.contact_person,
  c.email,
  c.phone,

  COALESCE(SUM(pd.delivery_quantity),0) AS scheduled_quantity,
  COALESCE(SUM(CASE WHEN pd.is_completed = 1 THEN pd.delivered_quantity ELSE 0 END),0) AS delivered_quantity,

p.order_booking_status

FROM projects p
LEFT JOIN customers c ON p.customer_id = c.id
LEFT JOIN users u ON p.salesperson_id = u.id
LEFT JOIN products pr ON p.product_id = pr.id
LEFT JOIN project_deliveries pd ON pd.project_id = p.id
WHERE p.salesperson_id = ?
GROUP BY p.id
ORDER BY p.id DESC;`,
    [salespersonId]
  );

  return rows;
};


/* =========================
   GET SINGLE PROJECT
========================= */
Project.getById = async (id) => {

  const [project] = await db.execute(
    `SELECT 
  p.*,
  c.customer_name,
  c.pan_no,
  c.gst_no,
  c.address,
  c.contact_person,
  c.email,
  c.phone
FROM projects p
LEFT JOIN customers c ON p.customer_id = c.id
WHERE p.id = ?;`,
    [id]
  );

  const [deliveries] = await db.execute(
    `SELECT * FROM project_deliveries WHERE project_id = ?`,
    [id]
  );

  const [boms] = await db.execute(
    `SELECT * FROM boms WHERE project_id = ?`,
    [id]
  );

  return {
    project: project[0],
    deliveries,
    boms
  };
};


/* =========================
   UPDATE STATUS
========================= */
Project.updateStatus = async (id, status) => {

  const [result] = await db.execute(
`UPDATE projects 
SET status = ?
WHERE id = ?`,
    [status, id]
  );

  return result;
};



/* =========================
   UPDATE PROJECT
========================= */
Project.update = async (id, data) => {

  // Get existing project first
  const [rows] = await db.execute(
    `SELECT * FROM projects WHERE id=?`,
    [id]
  );

  if (!rows.length) return { affectedRows: 0 };
if (
  data.order_booking_status &&
  !ALL_STATUSES.includes(data.order_booking_status)
) {
  throw new Error("Invalid order booking status");
}

if (
  data.order_booking_status &&
  AUTO_STATUSES.includes(data.order_booking_status)
) {
  throw new Error(
    "PARTIAL_DELIVERED and DELIVERED are system controlled statuses"
  );
}
  const existing = rows[0];
let iof_no = existing.iof_no;
let finalStatus;

const statusTemperatureMap = {
  BIDDING: 10,
  LEAD: 10,
  SUBMITTED: 25,
  ALLOTTED_TO_CUSTOMER: 50,
  UNDER_NEGOTIATION: 75,
  BOOKED: 100,
  UNDER_EXECUTION: 100
};
// ✅ Status priority
finalStatus =
  data.order_booking_status ||
  existing.order_booking_status ||
  "LEAD";

// ✅ Auto set temperature from status
const autoTemperature =
  statusTemperatureMap[finalStatus] ?? existing.temperature;
// ✅ Generate IOF if not exists
if (!iof_no) {

  // salesperson name
  const [[user]] = await db.execute(
    `SELECT username FROM users WHERE id=?`,
    [existing.salesperson_id]
  );

  // product name
  const [[product]] = await db.execute(
    `SELECT product_name FROM products WHERE id=?`,
    [existing.product_id]
  );

  // ✅ fallback logic
  const dateToUse = data.order_date || existing.order_date || new Date();

  iof_no = await generateIOFNo(db, {
    project_title: existing.project_title,
    order_date: dateToUse,
    salesperson_name: user.username,
    product_name: product.product_name,
    salesperson_id: existing.salesperson_id
  });
}
  // Use existing values if field not sent
  const project_title = data.project_title ?? existing.project_title;
  const customer_id = data.customer_id ?? existing.customer_id;
  const product_id = data.product_id ?? existing.product_id;
  const order_quantity = data.order_quantity ?? existing.order_quantity;
  const order_month = data.order_month ?? existing.order_month;
  const per_unit_value = data.per_unit_value ?? existing.per_unit_value;

  const total_value = Number(order_quantity) * Number(per_unit_value);

  const isConfirmed =
    data.is_order_confirmed === true ||
    data.is_order_confirmed === 1 ||
    data.is_order_confirmed === "YES"
      ? "YES"
      : existing.is_order_confirmed;

const [result] = await db.execute(
`UPDATE projects
SET project_title=?,
iof_no=?,
customer_id=?,
product_id=?,
order_quantity=?,
order_month=?,
per_unit_value=?,
total_value=?,
is_order_confirmed=?,
remarks=?,
project_remark=?,
order_in_hand_qty=?,
delivery_months=?,
address=?,
temperature=?,
order_no=?,
order_date=?,
vendor_code=?,
department_to=?,
order_booking_status=?
WHERE id=?`,
[
  project_title,
  iof_no,
  customer_id,
  product_id,
  Number(order_quantity),
  order_month,
  Number(per_unit_value),
  total_value,
  isConfirmed,
  data.remarks ?? existing.remarks,
  data.project_remark ?? existing.project_remark,
  data.order_in_hand_qty ?? existing.order_in_hand_qty,
  data.delivery_months ?? existing.delivery_months,
  data.address ?? existing.address,

  autoTemperature,

  data.order_no ?? existing.order_no,
  data.order_date ?? existing.order_date,
  data.vendor_code ?? existing.vendor_code,
  data.department_to ?? existing.department_to,

  finalStatus,

  id
]
);

  return result;
};

/* =========================
   DELETE PROJECT
========================= */
Project.deleteProject = async (id) => {

  const [result] = await db.execute(
`DELETE FROM projects
WHERE id=? 
AND order_booking_status IN (
  'BIDDING',
  'LEAD',
  'SUBMITTED'
)`,
    [id]
  );

  return result;
};
Project.findById = async (id) => {
  const [rows] = await db.execute(
    "SELECT * FROM projects WHERE id = ?",
    [id]
  );
  return rows[0];
};
Project.uploadDocuments = async (id, files) => {

  // Existing project fetch karo
  const [rows] = await db.execute(
    `SELECT 
      purchase_order_file,
      quotation_file,
      iof_file,
      costing_file
     FROM projects
     WHERE id=?`,
    [id]
  );

  if (!rows.length) {
    throw new Error("Project not found");
  }

  const existing = rows[0];

  // Agar new file nahi aayi toh old preserve karo
  const purchaseOrder =
    files.purchaseOrder || existing.purchase_order_file;

  const quotation =
    files.quotation || existing.quotation_file;

  const iof =
    files.iof || existing.iof_file;
  
  const costing =
    files.costing || existing.costing_file;
  // Update
  const [result] = await db.execute(
    `UPDATE projects
     SET
       purchase_order_file = ?,
       quotation_file = ?,
       iof_file = ?,
       costing_file = ?
     WHERE id = ?`,
    [
      purchaseOrder,
      quotation,
      iof,
      costing,
      id
    ]
  );

  return result;
};
module.exports = Project;