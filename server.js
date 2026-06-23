const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");
const path = require("path");
const app = express();

// Import routes
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const customerRoutes = require("./routes/customer.routes");
const projectRoutes = require("./routes/project.routes");
const segmentRoutes = require("./routes/segment.routes");
const productRoutes = require("./routes/product.routes");
const bomRoutes = require("./routes/bom.routes");
const projectDeliveriesRoutes = require("./routes/projectDeliveries.routes");
const itemRoutes = require("./routes/item.routes");
const ceoRoutes = require("./routes/ceo");
const reportsRouter = require("./routes/reports.routes");
const iofRoutes = require('./routes/iof.routes');
const followupRoutes = require("./routes/followup.routes");
const productionUpdateRoutes = require("./routes/productionUpdates.routes");
// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*", // "*" for testing locally
    credentials: true,
  })
);

app.use(express.json());

app.use(express.urlencoded({
  extended: true
}));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/segments", segmentRoutes);
app.use("/api/products", productRoutes);
// old
app.use("/api/bom", bomRoutes);

// new
app.use("/api/items-bom", bomRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/project-deliveries", projectDeliveriesRoutes);
app.use("/api/ceo", ceoRoutes);
app.use("/api/project-bom", require("./routes/projectBom.routes"));
// server.js
app.use("/api/uploads", express.static("uploads"));
app.use("/api/reports", reportsRouter);
app.use('/api/iof', iofRoutes);
app.use("/api/followups", followupRoutes);
app.use(
  "/api/production-updates",
  productionUpdateRoutes
);
// Serve React static files first
app.use(express.static(path.join(__dirname, "build")));


// Only fallback for non-API routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// Test database connection
app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS result");
    res.json({ message: "Database Connected", result: rows[0].result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listen on network IP for IIS / local network access
const PORT = process.env.PORT || 3000; // Port matches IIS binding
const HOST = "0.0.0.0"; // Listen on all network interfaces

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://192.168.1.144:${PORT}`);
});