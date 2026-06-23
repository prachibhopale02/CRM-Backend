const db = require("../config/db");

const IOF = {};

// ================= CREATE / UPDATE IOF =================
IOF.createOrUpdate = async (data) => {
  try {
    console.log("IOF createOrUpdate called with data:", data);

    // ✅ Default IOF date
    if (!data.iof_date) {
      data.iof_date = new Date();
    }
    const iofDateStr = new Date(data.iof_date).toISOString().slice(0, 10);

    // ================= FETCH PROJECT =================
    const [projectRows] = await db.query(
      `SELECT project_title, customer_id FROM projects WHERE id = ?`,
      [data.project_id]
    );

    if (!projectRows.length) {
      throw new Error("Project not found");
    }

    const project = projectRows[0];
    data.customer_id = data.customer_id || project.customer_id;
    data.project_name = data.project_name || project.project_title;

    // ================= FETCH CUSTOMER (ALWAYS) =================
    if (data.customer_id) {
      const [customerRows] = await db.query(
        `SELECT customer_name, address, pan_no, gst_no, contact_person, email, phone
         FROM customers WHERE id = ?`,
        [data.customer_id]
      );

      if (customerRows.length) {
        const c = customerRows[0];

        data.customer_name = data.customer_name || c.customer_name;
        data.customer_address = data.customer_address || c.address;
        data.pan_no = data.pan_no || c.pan_no;
        data.gst_no = data.gst_no || c.gst_no;
        data.contact_person = data.contact_person || c.contact_person;
        data.email = data.email || c.email;
        data.phone = data.phone || c.phone;
        data.end_user = data.end_user || c.customer_name;
      }
    }
// ✅ DEFAULT "TO" (Production Manager)
data.department_to = data.department_to || "Manish Pathak";
  

    console.log("FINAL DATA BEFORE INSERT:", {
      contact_person: data.contact_person,
      email: data.email,
      phone: data.phone
    });

    // ================= AUTO IOF NO =================
    if (!data.iof_no) {
      const [rows] = await db.query(
        `SELECT p.project_title, p.order_date,
                u.username AS salesperson_name,
                pr.product_name
         FROM projects p
         LEFT JOIN users u ON p.salesperson_id = u.id
         LEFT JOIN products pr ON p.product_id = pr.id
         WHERE p.id = ?`,
        [data.project_id]
      );

      if (rows.length) {
        const p = rows[0];

        const date = new Date(p.order_date || new Date());
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = String(date.getFullYear()).slice(-2);
        const monthYear = `${month}-${year}`;

        const initials =
          p.salesperson_name
            ?.split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase() || "XX";

        const [countRows] = await db.query(
          `SELECT COUNT(*) AS count 
           FROM iof 
           WHERE DATE_FORMAT(iof_date, '%m-%y') = ?`,
          [monthYear]
        );

        const nextNo = String((countRows[0]?.count || 0) + 1).padStart(2, "0");

        data.iof_no = `${p.project_title}/IOF/${monthYear}/${initials}/${nextNo} - ${p.product_name}`;
      }
    }
console.log("🔥 FINAL BEFORE INSERT:", {
  customer_id: data.customer_id,
  contact_person: data.contact_person,
  email: data.email,
  phone: data.phone
});
// ================= AUTO PO NO + PO DATE FROM FOLLOWUP =================
const [followRows] = await db.query(
  `SELECT follow_up_date 
   FROM project_followups 
   WHERE project_id = ? AND temperature = 100
   ORDER BY created_at DESC LIMIT 1`,
  [data.project_id]
);

if (followRows.length) {
  const follow = followRows[0];

  // ✅ PO DATE = last followup date (temp 100)
  data.po_date = data.po_date || follow.follow_up_date;

  // ✅ PO NO generate (only if not already present)
  if (!data.po_no) {
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS count FROM iof`
    );
// ================= CHECK DELIVERY PLAN =================
const [deliveryRows] = await db.query(
  `SELECT COUNT(*) AS count 
   FROM project_deliveries 
   WHERE project_id = ? AND is_deleted = 0`,
  [data.project_id]
);

if (deliveryRows[0].count > 0) {
  throw new Error("IOF cannot be created or updated after delivery planning is done.");
}
    const nextNo = String((countRows[0]?.count || 0) + 1).padStart(3, "0");

    data.po_no = `ORD-${nextNo}`;
  }
}
data.fat_required = (data.fat_required || "NO").toUpperCase();

if (data.fat_required === "NO") {
  data.fat_details = null;
}
    // ================= INSERT / UPDATE =================
    const [result] = await db.query(
      `INSERT INTO iof (
  project_id,
  customer_id,
  iof_no,
  iof_date,
  department_to,
  approval_status,
rejection_reason,
        vendor_code, po_no, po_date, remarks,
        customer_name, customer_address, pan_no, gst_no,
        contact_person, email, phone,
        delivery_address,
        price_terms, tax_info, packing_forwarding, payment_terms,
        delivery_schedule, installation, software,
        special_instruction, certification,
        project_name, expected_qty, expected_period, warranty,
        fat_required, fat_details, pbg_abg_emd, end_user
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        customer_id = VALUES(customer_id),
        iof_no = VALUES(iof_no),
        iof_date = VALUES(iof_date),
       department_to = COALESCE(VALUES(department_to), department_to),
       approval_status = VALUES(approval_status),
       rejection_reason = VALUES(rejection_reason),
        vendor_code = VALUES(vendor_code),
        po_no = VALUES(po_no),
        po_date = VALUES(po_date),
        remarks = VALUES(remarks),
        customer_name = VALUES(customer_name),
        customer_address = VALUES(customer_address),
        pan_no = VALUES(pan_no),
        gst_no = VALUES(gst_no),
        contact_person = COALESCE(VALUES(contact_person), contact_person),
        email = COALESCE(VALUES(email), email),
        phone = COALESCE(VALUES(phone), phone),
        delivery_address = VALUES(delivery_address),
        price_terms = VALUES(price_terms),
        tax_info = VALUES(tax_info),
        packing_forwarding = VALUES(packing_forwarding),
        payment_terms = VALUES(payment_terms),
        delivery_schedule = VALUES(delivery_schedule),
        installation = VALUES(installation),
        software = VALUES(software),
        special_instruction = VALUES(special_instruction),
        certification = VALUES(certification),
        project_name = VALUES(project_name),
        expected_qty = VALUES(expected_qty),
        expected_period = VALUES(expected_period),
        warranty = VALUES(warranty),
        fat_required = VALUES(fat_required),
        fat_details = VALUES(fat_details),
        pbg_abg_emd = VALUES(pbg_abg_emd),
       end_user = COALESCE(VALUES(end_user), end_user)
      `,
      [
        data.project_id,
        data.customer_id,
        data.iof_no,
        iofDateStr,
        data.department_to,
        data.approval_status || "DRAFT",
        data.rejection_reason || null,
        data.vendor_code,
        data.po_no,
        data.po_date ? new Date(data.po_date).toISOString().slice(0, 10) : null,
        data.remarks,
        data.customer_name,
        data.customer_address,
        data.pan_no,
        data.gst_no,
        data.contact_person,
        data.email,
        data.phone,
        data.delivery_address,
        data.price_terms,
        data.tax_info,
        data.packing_forwarding,
        data.payment_terms,
        data.delivery_schedule
          ? new Date(data.delivery_schedule).toISOString().slice(0, 10)
          : null,
        data.installation,
        data.software,
        data.special_instruction,
        data.certification,
        data.project_name,
        data.expected_qty,
        data.expected_period,
        data.warranty,
        data.fat_required,
        data.fat_details,
        data.pbg_abg_emd,
        data.end_user,
      ]
    );

    // ================= FIX IOF ID =================
    let iofId = result.insertId;

    if (!iofId) {
      const [rows] = await db.query(
        "SELECT id FROM iof WHERE project_id = ?",
        [data.project_id]
      );
      iofId = rows[0]?.id;
    }

    // ================= BOM =================
    await db.query("DELETE FROM iof_items WHERE iof_id = ?", [iofId]);

    if (data.bom_items?.length) {
      for (const item of data.bom_items) {
        const [rows] = await db.query(
          `SELECT im.hsn_code, p.product_code
           FROM items_master im
           CROSS JOIN products p
           WHERE im.id = ? AND p.id = ?`,
          [item.item_id, data.product_id]
        );

        const info = rows[0] || {};

        const qty = Number(item.quantity || 0);
        const price = Number(item.item_price || 0);

        await db.query(
          `INSERT INTO iof_items 
           (iof_id, item_name, customer_product_code, hsn_code, qty, unit_price, total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            iofId,
            item.item_name,
            info.product_code || "",
            info.hsn_code || "",
            qty,
            price,
            qty * price,
          ]
        );
      }
    }

    // ================= UPDATE PROJECT =================
    await db.query(
      "UPDATE projects SET iof_no=? WHERE id=?",
      [data.iof_no, data.project_id]
    );

    return { success: true, iof_id: iofId };

  } catch (err) {
    console.error("IOF ERROR:", err);
    throw err;
  }
};
// ================= GET BY PROJECT =================
IOF.findByProjectId = async (projectId) => {
  const [rows] = await db.query(
    "SELECT * FROM iof WHERE project_id = ?",
    [projectId]
  );
let iof;

  if (rows.length) {
  iof = rows[0];

  // ✅ NORMALIZE VALUE
  iof.fat_required = (iof.fat_required || "NO").toUpperCase();

} else {
  const [projectRows] = await db.query(
    `SELECT 
      p.project_title,
      p.customer_id,
      c.customer_name,
      c.address AS customer_address,
      c.gst_no,
      c.pan_no
     FROM projects p
     LEFT JOIN customers c ON p.customer_id = c.id
     WHERE p.id = ?`,
    [projectId]
  );

  const p = projectRows[0] || {};

  iof = {
    project_id: projectId,
    customer_id: p.customer_id,
    project_name: p.project_title,
    customer_name: p.customer_name,
    customer_address: p.customer_address,
    gst_no: p.gst_no,
    pan_no: p.pan_no,
    fat_required: "NO", // ✅ default yaha bhi de do
    items: []
  };
}

let items = [];
if (iof.id) {
  const [itemsRows] = await db.query(
    "SELECT * FROM iof_items WHERE iof_id = ?",
    [iof.id]
  );
  items = itemsRows;
}

  iof.items = items;

  return iof;
};

module.exports = IOF;