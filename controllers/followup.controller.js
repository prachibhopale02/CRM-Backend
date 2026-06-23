const FollowUp = require("../models/followup.model");
const db = require("../config/db");


// ➤ Create Follow-up
exports.createFollowUp = async (req, res) => {
  try {
const { 
  project_id, 
  temperature, 
  follow_up_date, 
  next_followup_date, 
  remark,
  order_booking_status
} = req.body;

    if (!project_id) {
      return res.status(400).json({ success: false, message: "Project ID required" });
    }

    // ❌ Already closed check
    const [projectRows] = await db.query(
      `SELECT temperature, project_title FROM projects WHERE id = ?`,
      [project_id]
    );

    if (projectRows.length && projectRows[0].temperature === 100) {
      return res.status(400).json({
        success: false,
        message: "Follow-up already closed (Temperature = 100)"
      });
    }

    // ✅ Insert follow-up
  await FollowUp.create({
  project_id,
  temperature,
  follow_up_date,
  next_followup_date,
  remark,
  order_booking_status,
  reminder_seen: false
});

    // ✅ Update project temperature
    await db.query(
      `UPDATE projects SET temperature = ?, remarks = ?, order_booking_status = ? WHERE id = ?`,
      [temperature, remark, order_booking_status, project_id]
    );

    // 🔥🔥🔥 MAIN LOGIC (WHEN TEMP = 100)
    if (Number(temperature) === 100) {

      // 1️⃣ Generate Order No
      const date = new Date(follow_up_date || new Date());
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();

      // count for running number
      const [countRows] = await db.query(
        `SELECT COUNT(*) AS count 
         FROM iof 
         WHERE MONTH(po_date) = ? AND YEAR(po_date) = ?`,
        [month, year]
      );

      const nextNo = String((countRows[0]?.count || 0) + 1).padStart(3, "0");

      const projectTitle = projectRows[0]?.project_title || "PROJECT";

      const orderNo = `${projectTitle}/PO/${month}-${year}/${nextNo}`;

      // 2️⃣ Get customer_id (IMPORTANT FIX)
      const [proj] = await db.query(
        `SELECT customer_id FROM projects WHERE id = ?`,
        [project_id]
      );

      const customer_id = proj[0]?.customer_id;

      // 3️⃣ Save in IOF
      await db.query(
        `INSERT INTO iof (project_id, customer_id, po_no, po_date)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           po_no = VALUES(po_no),
           po_date = VALUES(po_date)`,
        [project_id, customer_id, orderNo, follow_up_date]
      );
    }

    res.json({
      success: true,
      message: "Follow-up added successfully"
    });

  } catch (err) {
    console.error("Create FollowUp Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ➤ Get Follow-up history
exports.getFollowUps = async (req, res) => {
  try {
    const { project_id } = req.params;

    const data = await FollowUp.getByProjectId(project_id);

    res.json({
      success: true,
      data
    });

  } catch (err) {
    console.error("Get FollowUps Error:", err);
    res.status(500).json({ success: false });
  }
};
// ➤ Get Due Follow-ups (for popup)
exports.getDueFollowUps = async (req, res) => {
  try {
    const user_id = req.user.id;

    const [rows] = await db.query(`
      SELECT f.id, f.next_followup_date, p.project_title
      FROM project_followups f
      JOIN projects p ON f.project_id = p.id
    WHERE 
  p.salesperson_id = ?
  AND DATE(f.next_followup_date) <= CURDATE()
    
    `, [user_id]);

    res.json({
      success: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};
exports.markReminderSeen = async (req, res) => {
  try {
    const { id } = req.body;

    await db.query(`
      UPDATE project_followups 
      SET reminder_seen = TRUE 
      WHERE id = ?
    `, [id]);

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
};