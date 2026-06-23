const nodemailer = require("nodemailer");
const db = require("../config/db");

exports.sendDeliveryEmail = async (projectId, deliveries) => {
  try {
    // 1️⃣ Get project + production manager email
    const [rows] = await db.execute(`
      SELECT 
        p.project_title,
        u.username AS production_manager_name,
        u.email
      FROM projects p
      JOIN users u ON u.user_type = 'PRODUCTION_MANAGER'
      WHERE p.id = ?
      LIMIT 1
    `, [projectId]);

    if (!rows.length) return;

    const project = rows[0];

    // 🔥 2️⃣ FETCH BOM ITEMS
    const [bomRows] = await db.execute(
      `SELECT per_unit_qty, item_price 
       FROM project_bom_items
       WHERE project_id = ? AND is_selected = 1`,
      [projectId]
    );

    // 🔥 BOM calculation function
    const calculateDeliveredValue = (qty) => {
      return bomRows.reduce((sum, item) => {
        return sum +
          Number(item.per_unit_qty || 0) *
          Number(item.item_price || 0) *
          Number(qty || 0);
      }, 0);
    };

    // 🔥 3️⃣ PARENT-CHILD ADJUSTMENT + VALUE CALCULATION
    let totalValue = 0;

   let deliveryRows = deliveries.map((d, i, all) => {

  // ✅ Planned Qty use karo
  let finalQty = Number(d.delivery_quantity || 0);

  // ✅ Parent-child adjustment (PLANNED qty ke saath)
  if (!d.rescheduled_from) {
    const rescheduledQty = all
      .filter(cd => cd.rescheduled_from === d.id)
      .reduce((sum, r) => sum + Number(r.delivery_quantity || 0), 0);

    finalQty -= rescheduledQty;
  }

  // ❌ Negative avoid
  if (finalQty < 0) finalQty = 0;

  // ✅ Delivery VALUE (BOM based)
  const deliveryValue = calculateDeliveredValue(finalQty);

  totalValue += deliveryValue;

  return `
    <tr>
      <td style="padding:5px;border:1px solid #ccc;">${i + 1}</td>
      <td style="padding:5px;border:1px solid #ccc;">${d.delivery_month}</td>

      <!-- ✅ Planned Qty -->
      <td style="padding:5px;border:1px solid #ccc;">${finalQty}</td>

      <!-- ✅ Delivery Value -->
      <td style="padding:5px;border:1px solid #ccc;">
        ₹${deliveryValue.toLocaleString("en-IN")}
      </td>
    </tr>
  `;
}).join("");

    // 🔥 4️⃣ HTML with TOTAL ROW
    const htmlContent = `
      <p>Hello ${project.production_manager_name},</p>
      <p>Your delivery plan for <strong>${project.project_title}</strong> has been scheduled:</p>

      <table style="border-collapse:collapse;width:100%;max-width:600px;">
        <thead>
          <tr>
            <th style="padding:5px;border:1px solid #ccc;">#</th>
            <th style="padding:5px;border:1px solid #ccc;">Month</th>
            <th style="padding:5px;border:1px solid #ccc;">Delivery Qty</th>
            <th style="padding:5px;border:1px solid #ccc;">Delivery Value</th>
          </tr>
        </thead>
        <tbody>
          ${deliveryRows}

          <!-- ✅ TOTAL ROW -->
          <tr style="font-weight:bold;background:#f5f5f5;">
            <td colspan="3" style="padding:5px;border:1px solid #ccc;text-align:right;">
              Total
            </td>
            <td style="padding:5px;border:1px solid #ccc;">
              ₹${totalValue.toLocaleString("en-IN")}
            </td>
          </tr>

        </tbody>
      </table>

      <p>Thank you.</p>
    `;

    // 5️⃣ Outlook transporter (unchanged)
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        ciphers: "SSLv3",
      },
    });

    // 6️⃣ Send mail
    await transporter.sendMail({
      from: `"Chemito CRM" <${process.env.EMAIL_USER}>`,
      to: project.email,
      subject: `Delivery Plan Confirmation - ${project.project_title}`,
      html: htmlContent,
    });

    console.log("✅ Delivery email sent successfully with BOM values!");
  } catch (error) {
    console.error("❌ Delivery Email Error:", error);
  }
};