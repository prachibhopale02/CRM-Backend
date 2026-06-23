const Project = require("../models/project.model");
const db = require("../config/db");
const fs = require("fs");
const path = require("path");
/* =========================
   CREATE PROJECT
========================= */
exports.createProject = async (req, res) => {
  try {

const data = {
  ...req.body,
  salesperson_id: req.body.salesperson_id || req.user.id,
  created_by: req.user.id,

  delivered_quantity: 0,
  scheduled_quantity: 0,
  project_remark: req.body.project_remark ?? null,

  // ✅ FIX
  temperature: req.body.temperature ?? null
};

   if (data.temperature !== null && data.temperature < 100) {
  data.order_no = null;
  data.order_date = null;
  data.address = null;
}

    const result = await Project.create(data);

    res.status(201).json({
      message: "Project created successfully",
      project_id: result.insertId
    });

  } catch (err) {
    console.error("CREATE ERROR:", err);
   res.status(500).json({
  message: err.message || "Server error"
});
  }
};


/* =========================
   GET PROJECTS (Role Based)
========================= */
exports.getProjects = async (req, res) => {
  try {

    let projects;

    if (req.user.role === "CEO") {
      projects = await Project.getAll();
    }

    else if (req.user.role === "PRODUCTION_MANAGER") {
      projects = await Project.getAll();
    }

    else if (req.user.role === "SALESPERSON") {
      projects = await Project.getBySalesperson(req.user.id);
    }

    else {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(projects);

  } catch (err) {
    console.error("GET PROJECT ERROR:", err);
    res.status(500).json({
  message: err.message || "Server error"
});
  }
};


/* =========================
   GET SINGLE PROJECT
========================= */
exports.getProjectById = async (req, res) => {
  try {

    const data = await Project.getById(req.params.id);

    if (!data) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(data);

  } catch (err) {
    console.error("GET PROJECT BY ID ERROR:", err);
    res.status(500).json({
  message: err.message || "Server error"
});
  }
};


/* =========================
   UPDATE STATUS
========================= */
exports.updateStatus = async (req, res) => {
  try {

    await Project.updateStatus(req.params.id, req.body.status);

    res.json({ message: "Status updated successfully" });

  } catch (err) {
    console.error("STATUS UPDATE ERROR:", err);
    res.status(500).json({
  message: err.message || "Server error"
});
  }
};


/* =========================
   UPDATE PROJECT (with follow-up)
========================= */
exports.updateProject = async (req, res) => {
  try {
    // Prepare data safely
    const data = {
      ...req.body,
      follow_up_date: req.body.follow_up_date ?? null,
      remark: req.body.remark ?? null,
        project_remark: req.body.project_remark ?? null,
      temperature: req.body.temperature ?? null, // default 0 if missing
    };

    // Prevent manual modification of system fields
    delete data.delivered_quantity;
    delete data.scheduled_quantity;

    // Temperature rule: if < 100, reset order fields
   if (typeof data.temperature === "number" && data.temperature < 100) {
  data.order_no = null;
  data.order_date = null;
  data.address = null;
} 

    // Perform the update
    const result = await Project.update(req.params.id, data);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json({ message: "Project updated successfully" });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    // Send actual error message so you know what failed
    res.status(500).json({
  message: err.message || "Server error"
});
  }
};

/* =========================
   DELETE PROJECT
========================= */
exports.deleteProject = async (req, res) => {
  try {

    const projectId = req.params.id;

    const result = await Project.deleteProject(projectId);

    // ❌ If not deleted (either not found OR not LEAD)
    if (result.affectedRows === 0) {
      return res.status(400).json({
      message: "Only BIDDING, LEAD or SUBMITTED projects can be deleted"
      });
    }

    // ✅ Success
    res.json({
      message: "Project deleted successfully"
    });

  } catch (err) {

    console.error("DELETE PROJECT ERROR:", err);

    res.status(500).json({
      message: "Server error while deleting project"
    });

  }
};
exports.uploadDocuments = async (req, res) => {
  try {

    const projectId = req.params.id;

    const purchaseOrder =
      req.files?.purchase_order_file?.[0]?.filename || null;

    const quotation =
      req.files?.quotation_file?.[0]?.filename || null;

    const iof =
      req.files?.iof_file?.[0]?.filename || null;
    const costing =
      req.files?.costing_file?.[0]?.filename || null;

    await Project.uploadDocuments(
      projectId,
      {
        purchaseOrder,
        quotation,
        iof,
        costing
      }
    );

    // 🔥 GET UPDATED PROJECT
    const [rows] = await db.query(
      "SELECT * FROM projects WHERE id=?",
      [projectId]
    );

    res.json({
      success: true,
      message: "Documents uploaded successfully",
      project: rows[0]
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Upload failed"
    });
  }
};
exports.deleteDocument = async (req, res) => {
  try {

    const { id, field } = req.params;

    const allowedFields = [
      "purchase_order_file",
      "quotation_file",
      "iof_file",
      "costing_file",
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: "Invalid field",
      });
    }

    const [rows] = await db.query(
      "SELECT * FROM projects WHERE id=?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const project = rows[0];

    // DELETE FILE FROM FOLDER
    if (project[field]) {

      const filePath = path.join(
        __dirname,
        "../uploads",
        project[field]
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // REMOVE FROM DB
    await db.query(
      `UPDATE projects SET ${field}=NULL WHERE id=?`,
      [id]
    );

    res.json({
      success: true,
      message: "Document deleted",
    });

  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
};