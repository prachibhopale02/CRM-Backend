const IOF = require('../models/iof.model');
const sendEmail = require('../utils/sendiofEmail');
const User = require('../models/user.model');
const Project = require('../models/project.model');
const { getProjectBOMData } = require("../models/projectBom.model");
const db = require("../config/db");

const formatDate = (d) => d ? new Date(d).toISOString().split("T")[0] : "-";
const processApproveIOF = async (projectId) => {

  // UPDATE STATUS
  await db.query(
    `UPDATE iof
     SET approval_status = 'APPROVED'
     WHERE project_id = ?`,
    [projectId]
  );

  const project = await Project.findById(projectId);

  const iof = await IOF.findByProjectId(projectId);

  const adminList = await User.findByType("CEO");
  const admin = adminList[0];

  const pmList = await User.findByType(
    "PRODUCTION_MANAGER"
  );

  const pm = pmList[0];

  const salesperson = await User.findById(
    project.salesperson_id
  );

  // FETCH BOM ITEMS
  const bomItems = await getProjectBOMData(projectId) || [];

  // IOF DETAILS TABLE
  const iofDetailsTable = `
    <table border="1" cellpadding="8" width="100%" style="border-collapse: collapse;">
      <tr><td><b>IOF No</b></td><td>${iof.iof_no || "-"}</td><td><b>IOF Date</b></td><td>${formatDate(iof.iof_date)}</td></tr>

      <tr><td><b>Customer Name</b></td><td colspan="3">${iof.customer_name || "-"}</td></tr>

      <tr><td><b>Address</b></td><td colspan="3">${iof.address || iof.customer_address || "-"}</td></tr>

      <tr><td><b>GSTIN</b></td><td>${iof.gst_no || "-"}</td><td><b>PAN No</b></td><td>${iof.pan_no || "-"}</td></tr>

      <tr><td><b>Contact Person</b></td><td>${iof.contact_person || "-"}</td><td><b>Email</b></td><td>${iof.email || "-"}</td></tr>

      <tr><td><b>Phone</b></td><td>${iof.phone || "-"}</td><td><b>Vendor Code</b></td><td>${iof.vendor_code || "-"}</td></tr>

      <tr><td><b>Customer PO No</b></td><td>${iof.po_no || "-"}</td><td><b>PO Date</b></td><td>${formatDate(iof.po_date)}</td></tr>

      <tr><td><b>Remarks</b></td><td colspan="3">${iof.remarks || "-"}</td></tr>

      <tr><td><b>Price Terms</b></td><td colspan="3">${iof.price_terms || "-"}</td></tr>

      <tr><td><b>FAT Required</b></td><td colspan="3">${iof.fat_required || "NO"}</td></tr>

      ${iof.fat_required === "YES"
        ? `<tr><td><b>FAT Details</b></td><td colspan="3">${iof.fat_details || "-"}</td></tr>`
        : ""}

      <tr><td><b>PBG / ABG / EMD</b></td><td colspan="3">${iof.pbg_abg_emd || "-"}</td></tr>

      <tr><td><b>Packing Type</b></td><td colspan="3">${iof.packing_forwarding || "-"}</td></tr>

      <tr><td><b>Payment Terms</b></td><td colspan="3">${iof.payment_terms || "-"}</td></tr>

      <tr><td><b>Delivery Schedule</b></td><td colspan="3">${formatDate(iof.delivery_schedule)}</td></tr>

      <tr><td><b>Delivery Address</b></td><td colspan="3">${iof.delivery_address || "-"}</td></tr>

      <tr><td><b>Installation & Commissioning</b></td><td colspan="3">${iof.installation || "-"}</td></tr>

      <tr><td><b>Software Version</b></td><td colspan="3">${iof.software || "-"}</td></tr>

      <tr><td><b>Special Instruction</b></td><td colspan="3">${iof.special_instruction || "-"}</td></tr>

      <tr><td><b>Certification</b></td><td colspan="3">${iof.certification || "-"}</td></tr>

      <tr><td><b>End User</b></td><td colspan="3">${iof.end_user || "-"}</td></tr>

      <tr><td><b>Project</b></td><td colspan="3">${iof.project_name || "-"}</td></tr>

      <tr><td><b>Expected Qty</b></td><td colspan="3">${iof.expected_qty || 0}</td></tr>

      <tr><td><b>Expected Time Period</b></td><td colspan="3">${iof.expected_period || "-"}</td></tr>

      <tr><td><b>Warranty</b></td><td colspan="3">${iof.warranty || "-"}</td></tr>
    </table>
  `;

  // BOM TABLE
  const selectedItems = bomItems.filter(
    item => Number(item.is_selected) === 1
  );

  const grandTotal = selectedItems.reduce((sum, item) => {

    const qty = Number(item.quantity || 0);

    const price = Number(item.item_price || 0);

    return sum + (qty * price);

  }, 0);

  const bomRows = selectedItems.length > 0
    ? selectedItems.map((item, i) => {

        const qty = Number(item.quantity || 0);

        const price = Number(item.item_price || 0);

        const total = qty * price;

        return `
          <tr>
            <td>${i + 1}</td>
            <td>${item.item_name || "-"}</td>
            <td>${qty}</td>

            <td>
              ${price.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR"
              })}
            </td>

            <td>
              ${total.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR"
              })}
            </td>
          </tr>
        `;

      }).join("")

    : `
      <tr>
        <td colspan="5" style="text-align:center;">
          No items selected
        </td>
      </tr>
    `;

  // FULL HTML
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px;">

      <h2 style="color:green;">
        ✅ IOF Approved
      </h2>

      <p>
        Project:
        <b>${project.project_title}</b>
      </p>

      <br/>

      ${iofDetailsTable}

      <br/>

      <h3>Order Details</h3>

      <table border="1" cellpadding="8" width="100%" style="border-collapse: collapse;">

        <thead>
          <tr>
            <th>Sr</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          ${bomRows}
        </tbody>

        <tfoot>
          <tr>
            <td colspan="4" style="text-align:right">
              <b>Grand Total</b>
            </td>

            <td>
              <b>
                ${grandTotal.toLocaleString("en-IN", {
                  style: "currency",
                  currency: "INR"
                })}
              </b>
            </td>
          </tr>
        </tfoot>

      </table>

    </div>
  `;

  // SEND MAIL
  await sendEmail(
    `"IOF System" <${process.env.EMAIL_USER}>`,
    pm.email,
    `IOF Approved - ${project.project_title}`,
    htmlContent,
    [
      admin?.email,
      salesperson?.email
    ]
  );
};

const processRejectIOF = async (
  projectId,
  reason
) => {

  await db.query(
    `UPDATE iof
     SET approval_status = 'REJECTED',
         rejection_reason = ?
     WHERE project_id = ?`,
    [reason, projectId]
  );

  const project = await Project.findById(projectId);

  const salesperson = await User.findById(
    project.salesperson_id
  );

  await sendEmail(
    `"IOF System" <${process.env.EMAIL_USER}>`,
    salesperson.email,
    `IOF Rejected - ${project.project_title}`,
    `
      <h2>IOF Rejected</h2>

      <p>
        Reason:
        ${reason}
      </p>
    `
  );
};
// Create IOF
exports.createOrUpdateIOF = async (req, res) => {
  try {
    const data = req.body;

    if (!data.project_id) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required"
      });
    }

    const result = await IOF.createOrUpdate(data);

    res.json({
      success: true,
      message: "IOF saved successfully",
      data: result
    });

  } catch (err) {
    console.error("IOF SAVE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Error saving IOF"
    });
  }
};

// Get all IOFs
exports.getAllIOFs = async (req, res) => {
  try {
    const result = await IOF.getAll();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Get all IOFs error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get by ID
exports.getIOFById = async (req, res) => {
  try {
    const iof = await IOF.findByPk(req.params.id);
    if (!iof) return res.status(404).json({ success: false, message: 'IOF not found' });
    res.json({ success: true, data: iof });
  } catch (err) {
    console.error('Get IOF by ID error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/* Update IOF
exports.updateIOF = async (req, res) => {
  try {
    await IOF.update(req.params.id, req.body);
    res.json({ success: true, message: 'IOF updated' });
  } catch (err) {
    console.error('Update IOF error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};*/

// Delete IOF
exports.deleteIOF = async (req, res) => {
  try {
    await IOF.delete(req.params.id);
    res.json({ success: true, message: 'IOF deleted' });
  } catch (err) {
    console.error('Delete IOF error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.getIOFByProjectId = async (req, res) => {
  try {
    const iof = await IOF.findByProjectId(req.params.project_id);
    res.json({ success: true, data: iof || null });
  } catch (err) {
    console.error('Get IOF by project error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
/*exports.updateIOFByProjectId = async (req, res) => {
  try {
    await IOF.updateByProjectId(req.params.project_id, req.body);
    res.json({ success: true, message: 'IOF updated' });
  } catch (err) {
    console.error('Update IOF error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};*/
exports.sendIOFEmail = async (req, res) => {
  try {
    const projectId = req.params.id;
    if (!projectId) return res.status(400).json({ success: false, message: "Project ID is required" });

    // Fetch project
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    // Fetch salesperson
    const salesperson = await User.findById(project.salesperson_id);
    if (!salesperson || !salesperson.username) {
      return res.status(400).json({ success: false, message: "Salesperson info invalid" });
    }

   
// Fetch Admin
const adminList = await User.findByType("CEO");
const admin = adminList[0];

if (!admin || !admin.email) {
  return res.status(400).json({
    success: false,
    message: "CEO email invalid"
  });
}
    // Fetch IOF
    const iof = await IOF.findByProjectId(projectId);
    if (!iof) return res.status(404).json({ success: false, message: "IOF not found for this project" });

    // Fetch BOM items
    const bomItems = await getProjectBOMData(projectId) || [];

    // Build IOF details + Terms & Conditions table
    const iofDetailsTable = `
      <table border="1" cellpadding="8" width="100%" style="border-collapse: collapse;">
        <tr><td><b>IOF No</b></td><td>${iof.iof_no || "-"}</td><td><b>IOF Date</b></td><td>${formatDate(iof.iof_date)}</td></tr>
        <tr><td><b>Customer Name</b></td><td colspan="3">${iof.customer_name || "-"}</td></tr>
        <tr><td><b>Address</b></td><td colspan="3">${iof.address || iof.customer_address || "-"}</td></tr>
        <tr><td><b>GSTIN</b></td><td>${iof.gst_no || "-"}</td><td><b>PAN No</b></td><td>${iof.pan_no || "-"}</td></tr>
        <tr><td><b>Contact Person</b></td><td>${iof.contact_person || "-"}</td><td><b>Email</b></td><td>${iof.email || "-"}</td></tr>
        <tr><td><b>Phone</b></td><td>${iof.phone || "-"}</td><td><b>Vendor Code</b></td><td>${iof.vendor_code || "-"}</td></tr>
        <tr><td><b>Customer PO No</b></td><td>${iof.po_no || "-"}</td><td><b>PO Date</b></td><td>${formatDate(iof.po_date)}</td></tr>
        <tr><td><b>Remarks</b></td><td colspan="3">${iof.remarks || "-"}</td></tr>

        <!-- Terms & Conditions -->
        <tr><td><b>Price Terms</b></td><td colspan="3">${iof.price_terms || "-"}</td></tr>
        <tr><td><b>FAT Required</b></td><td colspan="3">${iof.fat_required || "NO"}</td></tr>
        ${iof.fat_required === "YES" ? `<tr><td><b>FAT Details</b></td><td colspan="3">${iof.fat_details || "-"}</td></tr>` : ""}
        <tr><td><b>PBG / ABG / EMD</b></td><td colspan="3">${iof.pbg_abg_emd || "-"}</td></tr>
        <tr><td><b>Packing Type</b></td><td colspan="3">${iof.packing_forwarding || "-"}</td></tr>
        <tr><td><b>Payment Terms</b></td><td colspan="3">${iof.payment_terms || "-"}</td></tr>
        <tr><td><b>Delivery Schedule</b></td><td colspan="3">${formatDate(iof.delivery_schedule)}</td></tr>
        <tr><td><b>Delivery Address</b></td><td colspan="3">${iof.delivery_address || "-"}</td></tr>
        <tr><td><b>Installation & Commissioning</b></td><td colspan="3">${iof.installation || "-"}</td></tr>
        <tr><td><b>Software Version</b></td><td colspan="3">${iof.software || "-"}</td></tr>
        <tr><td><b>Special Instruction</b></td><td colspan="3">${iof.special_instruction || "-"}</td></tr>
        <tr><td><b>Certification</b></td><td colspan="3">${iof.certification || "-"}</td></tr>
        <tr><td><b>End User</b></td><td colspan="3">${iof.end_user || "-"}</td></tr>
        <tr><td><b>Project</b></td><td colspan="3">${iof.project_name || "-"}</td></tr>
        <tr><td><b>Expected Qty</b></td><td colspan="3">${iof.expected_qty || 0}</td></tr>
        <tr><td><b>Expected Time Period</b></td><td colspan="3">${iof.expected_period || "-"}</td></tr>
        <tr><td><b>Warranty</b></td><td colspan="3">${iof.warranty || "-"}</td></tr>
      </table>
    `;

    // Build BOM table rows
const selectedItems = bomItems.filter(item => Number(item.is_selected) === 1);

const grandTotal = selectedItems.reduce((sum, item) => {
  const perUnitQty = Number(item.per_unit_qty || 0);
  const qty = Number(item.quantity || 0);
  const price = Number(item.item_price || 0);

  return sum + (perUnitQty * qty * price);
}, 0);

const bomRows = selectedItems.length > 0
  ? selectedItems.map((item, i) => {
      const qty = Math.round(Number(item.quantity || 0));
      const price = Number(item.item_price || 0);
      const total = qty * price;

      return `<tr>
        <td>${i + 1}</td>
        <td>${item.item_name || "-"}</td>
        <td>${qty}</td>
        <td>${price.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR"
  })}</td>
        <td>${total.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR"
  })}</td>
      </tr>`;
    }).join("")
  : `<tr><td colspan="5" style="text-align:center;">No items selected</td></tr>`;
    // Full HTML content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h3 style="text-align:center;">Chemito Infotech Pvt Ltd</h3>
        <h2 style="text-align:center;">INTERNAL ORDER FORM (IOF)</h2>
        ${iofDetailsTable}

        <br/>
        <h3>Order Details</h3>
        <table border="1" cellpadding="8" width="100%" style="border-collapse: collapse;">
          <thead>
            <tr><th>Sr</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
          </thead>
          <tbody>${bomRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align:right"><b>Grand Total</b></td>
              <td><b>${grandTotal.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR"
  })}</b></td>
            </tr>
          </tfoot>
      </table>

<br/><br/>

<div style="text-align:center;">

  <a
  href="http://192.168.1.144:1051/api/iof/email-approve/${projectId}"
    style="
      background:#28a745;
      color:white;
      padding:12px 20px;
      text-decoration:none;
      border-radius:5px;
      margin-right:10px;
      display:inline-block;
    "
  >
    ✅ Approve IOF
  </a>

  <a
  href="http://192.168.1.144:1051/api/iof/reject/${projectId}"
    style="
      background:#dc3545;
      color:white;
      padding:12px 20px;
      text-decoration:none;
      border-radius:5px;
      display:inline-block;
    "
  >
    ❌ Reject IOF
  </a>

</div>

</div>
`;
await db.query(
  `UPDATE iof
   SET approval_status = 'PENDING_APPROVAL',
       rejection_reason = NULL
   WHERE project_id = ?`,
  [projectId]
);
    // Send email
await sendEmail(
  `"${salesperson.username}" <${process.env.EMAIL_USER}>`,
  admin.email,
  `IOF Approval Required: ${project.project_title}`,
  htmlContent
);

    res.json({ success: true, message: "Email sent successfully" });

  } catch (err) {
    console.error("❌ IOF Email Route Error:", err);
    res.status(500).json({ success: false, message: "Unexpected server error", error: err.message });
  }
};
exports.approveIOF = async (req, res) => {
  try {

    await processApproveIOF(
      req.params.id
    );

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }
};
exports.rejectIOF = async (req, res) => {
  try {

    await processRejectIOF(
      req.params.id,
      req.body.reason
    );

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      message: err.message
    });

  }
};
exports.emailApproveIOF = async (req, res) => {
  try {

    await processApproveIOF(
      req.params.id
    );

    res.send(`
      <h2>
        IOF Approved Successfully
      </h2>
    `);

  } catch (err) {

    console.error(err);

    res.status(500).send(
      err.message
    );

  }
};

exports.emailRejectIOF = async (req, res) => {
  try {

    await processRejectIOF(
      req.params.id,
      req.query.reason ||
      "Rejected from email"
    );

    res.send(`
      <h2>
        IOF Rejected Successfully
      </h2>
    `);

  } catch (err) {

    console.error(err);

    res.status(500).send(
      err.message
    );

  }
};
exports.renderRejectPage = async (req, res) => {

  const projectId = req.params.id;

  res.send(`
    <html>

      <body style="font-family:Arial;padding:40px;">

        <h2>
          Reject IOF
        </h2>

      <form method="POST" action="/api/iof/reject/${projectId}">

          <textarea
            name="reason"
            rows="6"
            cols="50"
            placeholder="Enter rejection reason..."
            required
            style="
              width:100%;
              padding:10px;
            "
          ></textarea>

          <br/><br/>

          <button
            type="submit"
            style="
              background:red;
              color:white;
              border:none;
              padding:12px 20px;
              cursor:pointer;
            "
          >
            Submit Rejection
          </button>

        </form>

      </body>

    </html>
  `);

};
exports.submitRejectPage = async (req, res) => {

  try {

    const projectId = req.params.id;

    const reason = req.body.reason;

    await processRejectIOF(
      projectId,
      reason
    );

    res.send(`
      <h2>
        IOF Rejected Successfully
      </h2>

      <p>
        Reason:
        ${reason}
      </p>
    `);

  } catch (err) {

    console.error(err);

    res.status(500).send(
      err.message
    );

  }

};