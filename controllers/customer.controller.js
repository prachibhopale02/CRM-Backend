const Customer = require("../models/customer.model");

const phoneRegex = /^[6-9]\d{9}$/;

/* =========================
   CREATE CUSTOMER
========================= */
exports.createCustomer = async (req, res) => {
  try {
 const { phone, gst_no, website, plant_location, industry_type, pan_no } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "phone number is required" });
    }

    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        message: "Invalid phone number. Must be 10 digits and start with 6-9."
      });
    }
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

if (pan_no && !panRegex.test(pan_no)) {
  return res.status(400).json({
    message: "Invalid PAN number format"
  });
}

    const existing = await Customer.findByMobile(phone);
    if (existing) {
      return res.status(400).json({ message: "Customer phone already exists" });
    }

   const data = {
  ...req.body,
  created_by: req.user.id,
  gst_no: gst_no || null,
  website: website || null,
  plant_location: plant_location || null,
  industry_type: industry_type || null,
  pan_no: pan_no || null   // ✅ ADD THIS
};

    const result = await Customer.create(data);

    res.status(201).json({
      message: "Customer created successfully",
      customer_id: result.insertId,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


/* =========================
   GET ALL CUSTOMERS
========================= */
exports.getCustomers = async (req, res) => {
  try {
    let customers;

    if (req.user.role === "SALESPERSON") {
      customers = await Customer.getBySalesperson(req.user.id);
    } else {
      customers = await Customer.getAll();
    }

    res.json(customers);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


/* =========================
   UPDATE CUSTOMER
========================= */
exports.updateCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;

    const {
      phone,
      gst_no,
      website,
      plant_location,
      industry_type,
      pan_no
    } = req.body;

    if (!phone) {
      return res.status(400).json({
        message: "phone number is required"
      });
    }

    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        message:
          "Invalid phone number. Must be 10 digits and start with 6-9."
      });
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

    const formattedPan = pan_no
      ? pan_no.toUpperCase()
      : null;

    if (formattedPan && !panRegex.test(formattedPan)) {
      return res.status(400).json({
        message: "Invalid PAN number format"
      });
    }

const existing = await Customer.findByMobile(phone);

if (
  existing &&
  Number(existing.id) !== Number(customerId)
) {
  return res.status(400).json({
    message: "Customer phone already exists"
  });
}


    const data = {
      ...req.body,
      gst_no: gst_no || null,
      website: website || null,
      plant_location: plant_location || null,
      industry_type: industry_type || null,
      pan_no: formattedPan || null
    };

    await Customer.update(customerId, data);

    res.json({
      message: "Customer updated successfully"
    });

  } catch (err) {
  console.error("UPDATE CUSTOMER ERROR:", err);

  res.status(500).json({
    message: err.message,
    error: err.sqlMessage || err
  });
}
};

/* =========================
   DELETE CUSTOMER
========================= */
exports.deleteCustomer = async (req, res) => {
  try {
    await Customer.delete(req.params.id);

    res.json({
      message: "Customer deleted successfully"
    });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};