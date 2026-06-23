const db = require("../config/db");

/* ===================================================
   🔹 Booking Report
=================================================== */
exports.getBookingReport = async (req, res) => {
  try {

    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        message: "Start and end dates required"
      });
    }

    const [rows] = await db.execute(
      `SELECT 
          p.id AS project_id,
          p.project_title,
          c.customer_name,
          p.order_quantity,
          p.total_value,
          p.order_month,
          p.status
       FROM projects p
       LEFT JOIN customers c
         ON p.customer_id = c.id
       WHERE p.order_month BETWEEN ? AND ?
       ORDER BY p.order_month ASC`,
      [start, end]
    );

    res.json(rows);

  } catch (err) {

    console.error("Booking report error:", err);

    res.status(500).json({
      message: err.message
    });

  }
};

exports.getRevenueReport = async (req, res) => {
  try {
    const { start, end, salesperson } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        message: "Start and end dates required"
      });
    }

    let query = `
      SELECT 
        DATE(pd.invoice_date) AS invoice_date,

        SUM(
          (
            CASE 
              -- ✅ Parent delivery (minus rescheduled qty)
              WHEN pd.rescheduled_from IS NULL THEN 
                pd.delivered_quantity - IFNULL(
                  (
                    SELECT SUM(child.delivered_quantity)
                    FROM project_deliveries child
                    WHERE child.rescheduled_from = pd.id
                  ), 0
                )

              -- ✅ Child delivery (full count)
              ELSE pd.delivered_quantity
            END
          )
          *
          (
            -- ✅ ONLY valid BOM items (ignore per_unit_qty = 0)
            SELECT IFNULL(SUM(
              b.per_unit_qty * b.quantity * b.item_price
            ), 0)
            FROM project_bom_items b
            WHERE b.project_id = pd.project_id
              AND b.is_selected = 1
              AND b.per_unit_qty > 0
          )
        ) AS revenue

      FROM project_deliveries pd
      LEFT JOIN projects p ON pd.project_id = p.id

      WHERE pd.invoice_no IS NOT NULL
        AND DATE(pd.invoice_date) BETWEEN ? AND ?

        -- ✅ EXCLUDE projects having no valid BOM
        AND EXISTS (
          SELECT 1 
          FROM project_bom_items b
          WHERE b.project_id = pd.project_id
            AND b.is_selected = 1
            AND b.per_unit_qty > 0
        )
    `;

    const params = [start, end];

    // ✅ Salesperson filter
    if (salesperson && salesperson !== "ALL") {
      query += ` AND p.salesperson_id = ?`;
      params.push(salesperson);
    }

    query += `
      GROUP BY DATE(pd.invoice_date)
      HAVING revenue > 0   -- ✅ remove zero revenue rows
      ORDER BY DATE(pd.invoice_date) ASC
    `;

    const [rows] = await db.execute(query, params);

    res.json(rows);

  } catch (err) {
    console.error("Revenue report error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* ===================================================
   🔹 Delivery Report (Manager)
=================================================== */
exports.getDeliveryReport = async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        message: "Start and end dates required"
      });
    }

    const [rows] = await db.execute(
      `SELECT
        pd.id,
        p.project_title,
        c.customer_name,
        pd.delivery_month,
        pd.delivery_quantity,
        pd.delivered_quantity,
        pd.status,
        pd.is_completed,
        pd.invoice_no,
        pd.invoice_date,
        CASE 
          WHEN pd.rescheduled_from IS NULL THEN pd.delivered_quantity - IFNULL(
              (SELECT SUM(child.delivery_quantity)  -- 👈 change here
               FROM project_deliveries child
               WHERE child.rescheduled_from = pd.id), 0)
          ELSE pd.delivered_quantity
        END AS delivered_quantity_adjusted
      FROM project_deliveries pd
      LEFT JOIN projects p ON pd.project_id = p.id
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE DATE(pd.delivery_month) BETWEEN ? AND ?
      ORDER BY pd.delivery_month ASC;`,
      [start, end]
    );

    res.json(rows);

  } catch (err) {
    console.error("Delivery report error:", err);
    res.status(500).json({ message: err.message });
  }
};
/* ===================================================
   🔥 NEW: Customer Product Delivery Report
=================================================== */
exports.getCustomerProductReport = async (req, res) => {
  try {
    const { customer_id } = req.query;

    let query = `
      SELECT 
        p.id AS project_id,   
        c.customer_name,
        p.project_title,
        pr.product_name,
        p.order_quantity,
        SUM(
          CASE 
            WHEN pd.rescheduled_from IS NULL THEN 
              pd.delivered_quantity - IFNULL(
                (SELECT SUM(child.delivered_quantity)
                 FROM project_deliveries child
                 WHERE child.rescheduled_from = pd.id), 0)
            ELSE pd.delivered_quantity
          END
        ) AS total_delivered_qty
      FROM project_deliveries pd
      LEFT JOIN projects p ON pd.project_id = p.id
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN products pr ON pr.id = p.product_id
      WHERE 1=1
    `;

    const params = [];

    // ✅ customer filter
    if (customer_id && customer_id !== "ALL") {
      query += ` AND c.id = ?`;
      params.push(customer_id);
    }

    // ✅ IMPORTANT: GROUP BY me order_quantity bhi add karo
    query += `
      GROUP BY 
        p.id,
        c.customer_name, 
        p.project_title, 
        pr.product_name, 
        p.order_quantity
      ORDER BY c.customer_name ASC
    `;

    const [rows] = await db.execute(query, params);

    res.json(rows);

  } catch (err) {
    console.error("🔥 Customer Product Report ERROR:", err); // 👈 IMPORTANT
    res.status(500).json({ message: err.message });
  }
};
exports.getYearlySalesReport = async (req, res) => {
  try {
    const { year, userId } = req.query;

    if (!year) {
      return res.status(400).json({
        message: "Year is required"
      });
    }

    let startYear;

    if (year.includes("-")) {
      startYear = parseInt(year.split("-")[0]);
    } else {
      startYear = parseInt(year);
    }

    let query = `
      SELECT 
        DATE_FORMAT(p.order_month, '%Y-%m-01') AS month,
        p.id AS project_id,
        p.project_title,
        c.customer_name,   -- 🔥 ADD THIS

        SUM(p.order_quantity) AS total_order_qty,

        SUM(
          p.order_quantity * (
            SELECT IFNULL(SUM(
              b.per_unit_qty * b.item_price
            ), 0)
            FROM project_bom_items b
            WHERE b.project_id = p.id
            AND b.is_selected = 1
          )
        ) AS total_order_value

      FROM projects p

      LEFT JOIN customers c 
        ON c.id = p.customer_id   -- 🔥 ADD JOIN

      WHERE 
      (
        (MONTH(p.order_month) >= 4 AND YEAR(p.order_month) = ?) 
        OR 
        (MONTH(p.order_month) < 4 AND YEAR(p.order_month) = ? + 1)
      )
    `;

    const params = [startYear, startYear];

    // 🔥 salesperson filter SAME as before
    if (userId) {
      query += ` AND p.salesperson_id = ?`;
      params.push(userId);
    }

    query += `
      GROUP BY 
        month, 
        p.id, 
        p.project_title,
        c.customer_name   -- 🔥 ADD THIS

      ORDER BY month ASC
    `;

    const [rows] = await db.execute(query, params);

    res.json(rows);

  } catch (err) {
    console.error("Yearly Sales Report error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getDeliveryPlanGraph = async (req, res) => {
  try {
    const { year, salesperson_id } = req.query;

    if (!year) {
      return res.status(400).json({ message: "Year is required" });
    }

    // 🔥 Convert FY (2025-26 → 2025-04-01 to 2026-03-31)
    const startYear = parseInt(year.split("-")[0]);

    const startDate = `${startYear}-04-01`;
    const endDate = `${startYear + 1}-03-31`;

    let query = `
  SELECT 
    DATE_FORMAT(pd.delivery_month, '%Y-%m-01') AS month,
    TRIM(p.project_title) AS project_title,
    u.username AS salesperson_name,

    -- ✅ PLANNED QTY
    SUM(
      CASE 
        WHEN pd.rescheduled_from IS NULL THEN 
          pd.delivery_quantity - IFNULL(
            (
              SELECT SUM(child.delivery_quantity)
              FROM project_deliveries child
              WHERE child.rescheduled_from = pd.id
            ), 0
          )
        ELSE pd.delivery_quantity
      END
    ) AS planned_qty,

    -- ✅ DELIVERED QTY
    SUM(
      CASE 
        WHEN pd.rescheduled_from IS NULL THEN 
          pd.delivered_quantity - IFNULL(
            (
              SELECT SUM(child.delivered_quantity)
              FROM project_deliveries child
              WHERE child.rescheduled_from = pd.id
            ), 0
          )
        ELSE pd.delivered_quantity
      END
    ) AS delivered_qty,

    -- ✅ PLANNED VALUE
    SUM(
      (
        CASE 
          WHEN pd.rescheduled_from IS NULL THEN 
            pd.delivery_quantity - IFNULL(
              (
                SELECT SUM(child.delivery_quantity)
                FROM project_deliveries child
                WHERE child.rescheduled_from = pd.id
              ), 0
            )
          ELSE pd.delivery_quantity
        END
      )
      *
      (
        SELECT IFNULL(SUM(
          b.per_unit_qty * b.item_price
        ), 0)
        FROM project_bom_items b
        WHERE b.project_id = pd.project_id
          AND b.is_selected = 1
          AND b.per_unit_qty > 0
      )
    ) AS planned_value,

    -- ✅ DELIVERED VALUE
    SUM(
      (
        CASE 
          WHEN pd.rescheduled_from IS NULL THEN 
            pd.delivered_quantity - IFNULL(
              (
                SELECT SUM(child.delivered_quantity)
                FROM project_deliveries child
                WHERE child.rescheduled_from = pd.id
              ), 0
            )
          ELSE pd.delivered_quantity
        END
      )
      *
      (
        SELECT IFNULL(SUM(
          b.per_unit_qty * b.item_price
        ), 0)
        FROM project_bom_items b
        WHERE b.project_id = pd.project_id
          AND b.is_selected = 1
          AND b.per_unit_qty > 0
      )
    ) AS delivered_value

  FROM project_deliveries pd
  LEFT JOIN projects p ON pd.project_id = p.id
  LEFT JOIN users u ON p.salesperson_id = u.id

  WHERE pd.delivery_month BETWEEN ? AND ?
`;

    const params = [startDate, endDate];

    if (salesperson_id && salesperson_id !== "ALL") {
      query += ` AND p.salesperson_id = ?`;
      params.push(salesperson_id);
    }

    query += `
      GROUP BY 
        DATE_FORMAT(pd.delivery_month, '%Y-%m-01'),
        p.project_title,
        u.username
      ORDER BY month ASC
    `;

    const [rows] = await db.execute(query, params);

    const formatted = rows.map(r => ({
      ...r,
      planned_qty: Number(r.planned_qty || 0),
      delivered_qty: Number(r.delivered_qty || 0),
      planned_value: Number(r.planned_value || 0),
      delivered_value: Number(r.delivered_value || 0)
    }));

    res.json(formatted);

  } catch (err) {
    console.error("Delivery Plan Graph Error:", err);
    res.status(500).json({ message: err.message });
  }
};
exports.getAvailableYears = async (req, res) => {
  try {
    const { userId } = req.query;

    let query = `
      SELECT DISTINCT 
        CASE 
          WHEN MONTH(order_month) >= 4 
            THEN CONCAT(YEAR(order_month), '-', RIGHT(YEAR(order_month)+1,2))
          ELSE 
            CONCAT(YEAR(order_month)-1, '-', RIGHT(YEAR(order_month),2))
        END AS financial_year
      FROM projects
      WHERE order_month IS NOT NULL
    `;

    const params = [];

    if (userId) {
      query += ` AND salesperson_id = ?`;
      params.push(userId);
    }

    query += ` ORDER BY financial_year DESC`;

    const [rows] = await db.execute(query, params);

    res.json(rows);

  } catch (err) {
    console.error("Available Years error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getDeliveryPlanGraphAll = async (req, res) => {
  try {
    const { year, salesperson_id } = req.query;

    if (!year) {
      return res.status(400).json({ message: "Year is required" });
    }

    const startYear = parseInt(year.split("-")[0]);

    let query = `
      SELECT 
        DATE_FORMAT(pd.delivery_month, '%Y-%m-01') AS month,
        p.project_title,
        u.username AS salesperson_name,

        -- ✅ PLANNED QTY
        SUM(
          CASE 
            WHEN pd.invoice_no IS NULL THEN
              CASE 
                WHEN pd.rescheduled_from IS NULL THEN 
                  pd.delivery_quantity - IFNULL(
                    (SELECT SUM(child.delivery_quantity)
                     FROM project_deliveries child
                     WHERE child.rescheduled_from = pd.id), 0)
                ELSE pd.delivery_quantity
              END
            ELSE 0
          END
        ) AS planned_qty,

        -- ✅ PLANNED VALUE
        SUM(
          CASE 
            WHEN pd.invoice_no IS NULL THEN
              (
                CASE 
                  WHEN pd.rescheduled_from IS NULL THEN 
                    pd.delivery_quantity - IFNULL(
                      (
                        SELECT SUM(child.delivery_quantity)
                        FROM project_deliveries child
                        WHERE child.rescheduled_from = pd.id
                      ), 0
                    )
                  ELSE pd.delivery_quantity
                END
              )
              *
              (
                SELECT IFNULL(SUM(
                  b.per_unit_qty * b.item_price
                ), 0)
                FROM project_bom_items b
                WHERE b.project_id = pd.project_id
                  AND b.is_selected = 1
                  AND b.per_unit_qty > 0
              )
            ELSE 0
          END
        ) AS planned_value,

        -- ✅ DELIVERED QTY
        SUM(
          CASE 
            WHEN pd.invoice_no IS NOT NULL THEN
              CASE 
                WHEN pd.rescheduled_from IS NULL THEN 
                  pd.delivered_quantity - IFNULL(
                    (SELECT SUM(child.delivered_quantity)
                     FROM project_deliveries child
                     WHERE child.rescheduled_from = pd.id), 0)
                ELSE pd.delivered_quantity
              END
            ELSE 0
          END
        ) AS delivered_qty,

        -- ✅ DELIVERED VALUE
        SUM(
          CASE 
            WHEN pd.invoice_no IS NOT NULL THEN
              (
                CASE 
                  WHEN pd.rescheduled_from IS NULL THEN 
                    pd.delivered_quantity - IFNULL(
                      (
                        SELECT SUM(child.delivered_quantity)
                        FROM project_deliveries child
                        WHERE child.rescheduled_from = pd.id
                      ), 0
                    )
                  ELSE pd.delivered_quantity
                END
              )
              *
              (
                SELECT IFNULL(SUM(
                  b.per_unit_qty * b.item_price
                ), 0)
                FROM project_bom_items b
                WHERE b.project_id = pd.project_id
                  AND b.is_selected = 1
                  AND b.per_unit_qty > 0
              )
            ELSE 0
          END
        ) AS delivered_value

      FROM project_deliveries pd
      LEFT JOIN projects p ON pd.project_id = p.id
      LEFT JOIN users u ON p.salesperson_id = u.id

      WHERE 
      (
        (YEAR(pd.delivery_month) = ? AND MONTH(pd.delivery_month) >= 4)
        OR
        (YEAR(pd.delivery_month) = ? + 1 AND MONTH(pd.delivery_month) <= 3)
      )
    `;

    const params = [startYear, startYear];

    if (salesperson_id && salesperson_id !== "ALL") {
      query += ` AND u.username = ?`;
      params.push(salesperson_id);
    }

    query += `
      GROUP BY month, p.project_title, u.username
      ORDER BY month ASC
    `;

    const [rows] = await db.execute(query, params);

    res.json(rows);

  } catch (err) {
    console.error("Delivery Plan Graph Error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getBookingVsRevenueFY = async (req, res) => {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ message: "Year required" });
    }

    const startYear = parseInt(year.split("-")[0]);
    const months = [];

    for (let m = 4; m <= 12; m++) months.push(`${startYear}-${String(m).padStart(2,"0")}`);
    for (let m = 1; m <= 3; m++) months.push(`${startYear+1}-${String(m).padStart(2,"0")}`);

    const [bookingRows] = await db.execute(
      `SELECT 
  DATE_FORMAT(p.order_month, '%Y-%m') AS month,
  SUM(IFNULL(p.order_quantity * b.total_bom, 0)) AS booking
FROM projects p
LEFT JOIN (
  SELECT project_id, SUM(per_unit_qty * item_price) AS total_bom
  FROM project_bom_items
  WHERE is_selected = 1
  GROUP BY project_id
) b ON b.project_id = p.id

WHERE (
  (YEAR(p.order_month) = ? AND MONTH(p.order_month) >= 4)
  OR (YEAR(p.order_month) = ? + 1 AND MONTH(p.order_month) <= 3)
)

AND p.temperature >= 100
AND COALESCE(
  (SELECT SUM(pd.delivered_quantity)
   FROM project_deliveries pd
   WHERE pd.project_id = p.id), 0
) = 0

GROUP BY DATE_FORMAT(p.order_month, '%Y-%m')`,
      [startYear, startYear]
    );

  const [revenueRows] = await db.execute(
  `SELECT 
     DATE_FORMAT(pd.invoice_date, '%Y-%m') AS month,
     SUM(
       (pd.delivered_quantity - IFNULL(
          (SELECT SUM(child.delivered_quantity)
           FROM project_deliveries child
           WHERE child.rescheduled_from = pd.id),
          0
        ))
       *
       (SELECT IFNULL(SUM(b.per_unit_qty * b.item_price), 0)
        FROM project_bom_items b
        WHERE b.project_id = pd.project_id AND b.is_selected = 1)
     ) AS revenue
   FROM project_deliveries pd
   WHERE pd.invoice_no IS NOT NULL
     AND ((YEAR(pd.invoice_date) = ? AND MONTH(pd.invoice_date) >= 4)
       OR (YEAR(pd.invoice_date) = ? + 1 AND MONTH(pd.invoice_date) <= 3))
   GROUP BY DATE_FORMAT(pd.invoice_date, '%Y-%m')`,
  [startYear, startYear]
);

    const bookingMap = {};
    bookingRows.forEach(r => { bookingMap[r.month] = Number(r.booking || 0); });

    const revenueMap = {};
    revenueRows.forEach(r => { revenueMap[r.month] = Number(r.revenue || 0); });

    const result = months.map(m => ({
      month: m,
      booking: bookingMap[m] || 0,
      revenue: revenueMap[m] || 0
    }));

    res.json(result);

  } catch (err) {
    console.error("FY Graph error:", err);
    res.status(500).json({ message: err.message });
  }
};
exports.getLeadsFYGraph = async (req, res) => {
  try {
    const { year, salesperson_id, type } = req.query;

    if (!year) {
      return res.status(400).json({ message: "Year is required" });
    }

    const startYear = parseInt(year.split("-")[0]);
    const reportType = type || "LEAD";

    // 🔥 FY months
    const months = [];
    for (let m = 4; m <= 12; m++) {
      months.push(`${startYear}-${String(m).padStart(2, "0")}`);
    }
    for (let m = 1; m <= 3; m++) {
      months.push(`${startYear + 1}-${String(m).padStart(2, "0")}`);
    }

    let dateField = "p.order_month";
    let joinIOF = "";
    let condition = "";

    // ✅ BOOKED
    if (reportType === "BOOKED") {
      condition = `
        p.temperature >= 100
        AND COALESCE(d.delivered_qty, 0) = 0
      `;
    }

    // ✅ IOF
    else if (reportType === "IOF") {
      joinIOF = `
        LEFT JOIN (
          SELECT 
            project_id,
            MIN(iof_date) AS iof_date
          FROM iof
          GROUP BY project_id
        ) i ON i.project_id = p.id
      `;

      dateField = "i.iof_date";
      condition = `i.iof_date IS NOT NULL`;
    }

    // ✅ LEAD
    else {
      condition = `(p.temperature < 100 OR p.temperature IS NULL)`;
    }

    let query = `
      SELECT 
        DATE_FORMAT(${dateField}, '%Y-%m') AS month,
        u.username AS salesperson_name,
        p.project_title,
        c.customer_name,
        p.order_quantity,
       IFNULL(COALESCE(b.total_bom, 0), 0) AS project_value

      FROM projects p

      LEFT JOIN users u 
        ON p.salesperson_id = u.id

      JOIN customers c 
        ON c.id = p.customer_id

      ${joinIOF}

      LEFT JOIN (
        SELECT 
          project_id, 
          SUM(per_unit_qty * quantity * item_price) AS total_bom
        FROM project_bom_items
        WHERE is_selected = 1
        GROUP BY project_id
      ) b ON b.project_id = p.id

      LEFT JOIN (
        SELECT 
          project_id, 
          SUM(delivered_quantity) AS delivered_qty
        FROM project_deliveries
        GROUP BY project_id
      ) d ON d.project_id = p.id

      WHERE ${condition}
        AND ${dateField} IS NOT NULL
        AND (
          (YEAR(${dateField}) = ? AND MONTH(${dateField}) >= 4)
          OR
          (YEAR(${dateField}) = ? AND MONTH(${dateField}) <= 3)
        )
    `;

    const params = [startYear, startYear + 1];

    if (salesperson_id && salesperson_id !== "ALL") {
      query += ` AND u.username = ?`;
      params.push(salesperson_id);
    }

    query += ` ORDER BY month ASC`;

    const [rows] = await db.query(query, params);

    // 🔥 GROUPING
    const grouped = {};

    rows.forEach(r => {
      if (!grouped[r.month]) {
        grouped[r.month] = { projects: {} };
      }

      if (!grouped[r.month][r.salesperson_name]) {
        grouped[r.month][r.salesperson_name] = 0;
        grouped[r.month].projects[r.salesperson_name] = [];
      }

      if (reportType === "IOF") {
        grouped[r.month][r.salesperson_name] += Number(r.project_value || 0);
      } else {
        grouped[r.month][r.salesperson_name] += 1;
      }

      grouped[r.month].projects[r.salesperson_name].push({
        name: r.project_title,
        customer_name: r.customer_name,
        value: r.project_value,
        order_qty: r.order_quantity
      });
    });

    const result = months.map(m => ({
      month: m,
      ...(grouped[m] || { projects: {} })
    }));

    res.json(result);

  } catch (err) {
    console.error("FY Graph Error:", err);
    res.status(500).json({ error: err.message });
  }
};
exports.getProjectWiseOrderDelivered = async (req, res) => {
  try {

    const [rows] = await db.execute(`
      SELECT 
        p.id,
        p.project_title,
        c.customer_name,

        -- ✅ BOM VALUE (fixed once per project)
        COALESCE((
          SELECT SUM(b.per_unit_qty * b.item_price)
          FROM project_bom_items b
          WHERE b.project_id = p.id
            AND b.is_selected = 1
            AND b.per_unit_qty > 0
        ),0) AS bom_value,

        -- ✅ TOTAL ORDER QTY
        COALESCE(p.order_quantity,0) AS order_qty,

        -- ✅ TOTAL DELIVERED QTY (correct reschedule logic)
        COALESCE((
          SELECT SUM(
            CASE 
              WHEN pd.rescheduled_from IS NULL THEN 
                pd.delivered_quantity - IFNULL(
                  (SELECT SUM(child.delivered_quantity)
                   FROM project_deliveries child
                   WHERE child.rescheduled_from = pd.id), 0
                )
              ELSE pd.delivered_quantity
            END
          )
          FROM project_deliveries pd
          WHERE pd.project_id = p.id
        ),0) AS delivered_qty

      FROM projects p
      LEFT JOIN customers c ON c.id = p.customer_id
    `);

    res.json(rows);

  } catch (err) {
    console.error("Project Graph Error:", err);
    res.status(500).json({ message: err.message });
  }
};


exports.getMarginComparison = async (req, res) => {
  try {

    const [rows] = await db.query(`
      SELECT
        p.id,
        p.project_title,
        p.order_booking_status,
        c.customer_name,

        pb.quantity,
        pb.per_unit_qty,
        pb.item_price,
        pb.unit_cost,
        pb.production_cost

      FROM project_bom_items pb

      JOIN projects p
        ON p.id = pb.project_id

      LEFT JOIN customers c
        ON c.id = p.customer_id

      WHERE pb.is_selected = 1
    `);

    const grouped = {};

    rows.forEach(r => {

      if (!grouped[r.id]) {
        grouped[r.id] = {
          id: r.id,
          project_title: r.project_title,
          customer_name: r.customer_name,
          booking_status: r.order_booking_status,

          sales: 0,
          adminCost: 0,
          pmCost: 0
        };
      }

      const qty =
        Number(r.quantity || 0) *
        Number(r.per_unit_qty || 0);

      const sales =
        qty * Number(r.item_price || 0);

      const adminCost =
        qty * Number(r.unit_cost || 0);

      const pmCost =
        qty * Number(r.production_cost || 0);

      grouped[r.id].sales += sales;
      grouped[r.id].adminCost += adminCost;
      grouped[r.id].pmCost += pmCost;
    });

    const finalData = Object.values(grouped).map(r => {

      const adminMargin =
        r.sales - r.adminCost;

      const pmMargin =
        r.sales - r.pmCost;

      return {
        ...r,

        adminMargin,
        pmMargin,

        adminMarginPercent:
          r.sales > 0
            ? ((adminMargin / r.sales) * 100).toFixed(2)
            : 0,

        pmMarginPercent:
          r.sales > 0
            ? ((pmMargin / r.sales) * 100).toFixed(2)
            : 0,

        difference:
          adminMargin - pmMargin
      };
    });

    res.json({
      success: true,
      data: finalData
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch margin report"
    });
  }
};