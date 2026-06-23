const db = require("../config/db");

const FollowUp = {};

// ➤ Create follow-up
FollowUp.create = async ({
  project_id,
  temperature,
  follow_up_date,
  next_followup_date,
  remark,
  order_booking_status   // 🔥 ADD THIS
}) => {

  // 🔹 UPDATED INSERT
  const [result] = await db.query(
    `INSERT INTO project_followups 
     (project_id, temperature, follow_up_date, next_followup_date, remark, reminder_seen)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      project_id,
      temperature,
      follow_up_date,
      next_followup_date,
      remark,
      false
    ]
  );
await db.query(
  `
  UPDATE projects
  SET
    temperature = ?,
    order_booking_status = ?
  WHERE id = ?
`,
  [
    temperature,
    order_booking_status,
    project_id
  ]
);
  // 🔥 EXISTING LOGIC (UNCHANGED)
  if (Number(temperature) === 100) {

    const [projectRows] = await db.query(
      `SELECT customer_id, project_title FROM projects WHERE id = ?`,
      [project_id]
    );

    const customer_id = projectRows[0]?.customer_id;
    const projectName = projectRows[0]?.project_title || "PO";

    const [countRows] = await db.query(`SELECT COUNT(*) AS count FROM iof`);
    const nextNo = String((countRows[0]?.count || 0) + 1).padStart(3, "0");

    const orderNo = `${projectName}/PO/${nextNo}`;

    await db.query(
      `INSERT INTO iof (project_id, customer_id, po_no, po_date)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         po_no = VALUES(po_no),
         po_date = VALUES(po_date)`,
      [
        project_id,
        customer_id,
        orderNo,
        follow_up_date || new Date().toISOString().slice(0, 10)
      ]
    );
  }

  return result;
};

// ➤ Get all follow-ups for a project
FollowUp.getByProjectId = async (project_id) => {
  const [rows] = await db.query(
    `SELECT * FROM project_followups
     WHERE project_id = ?
     ORDER BY created_at DESC`,
    [project_id]
  );

  return rows;
};


// 🔥 NEW FUNCTION (IMPORTANT)

// ➤ Get due follow-ups (for popup)
FollowUp.getDueFollowUps = async (user_id) => {
  const [rows] = await db.query(`
    SELECT f.id, f.next_followup_date, p.project_title
    FROM project_followups f
    JOIN projects p ON f.project_id = p.id
    WHERE p.salesperson_id = ?
    AND f.next_followup_date <= CURDATE()
    AND f.reminder_seen = FALSE
  `, [user_id]);

  return rows;
};


// ➤ Mark reminder as seen
FollowUp.markAsSeen = async (id) => {
  await db.query(`
    UPDATE project_followups
    SET reminder_seen = TRUE
    WHERE id = ?
  `, [id]);
};


module.exports = FollowUp;