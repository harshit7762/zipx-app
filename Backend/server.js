const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();

// CORS configuration for production
app.use(cors({
  origin: [
    'https://zipx-backend.onrender.com',
    'http://localhost:5000',
    'http://localhost:3000',
    'capacitor://localhost',
    'http://localhost'
  ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../Frontend')));

// Routes
app.use("/api/auth",           require("./routes/authRoutes"));
app.use("/api/credits",        require("./routes/creditRoutes"));
app.use("/api/messages",       require("./routes/messageRoutes"));
app.use("/api/orderrequests",  require("./routes/orderRequestRoutes"));
app.use("/api/stockist-orders",require("./routes/stockistOrderRoutes"));
app.use("/api/chemist-logs",   require("./routes/chemistLogRoutes"));
app.use("/api/chemists",       require("./routes/chemistRoutes"));
app.use("/api/stockists",      require("./routes/stockistRoutes"));
app.use("/api/monthly-sheets", require("./routes/monthlySheetRoutes"));

// Admin: reset all orders, chemist logs and credits after monthly close
app.delete("/api/admin/reset-month", require("./middleware/authMiddleware"), async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const StockistOrder = require("./models/StockistOrder");
    const ChemistLog    = require("./models/ChemistLog");
    const Credit        = require("./models/Credit");
    const OrderRequest  = require("./models/OrderRequest");
    await Promise.all([
      StockistOrder.deleteMany({}),
      ChemistLog.deleteMany({}),
      Credit.deleteMany({}),
      OrderRequest.deleteMany({})
    ]);
    res.json({ msg: "Reset complete" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/admin/renumber-orders", async (req, res) => {
  try {
    const StockistOrder = require("./models/StockistOrder");
    const orders = await StockistOrder.find({}).sort({ createdAt: 1 });

    // Group by agentId, assign independent sequential numbers for ST and TR
    const stCounters = {};
    const trCounters = {};
    for (const order of orders) {
      const key = String(order.agentId || order.agentName);
      stCounters[key] = (stCounters[key] || 0) + 1;
      trCounters[key] = (trCounters[key] || 0) + 1;
      const prefix = (order.agentName || "ORD").toUpperCase().replace(/\s+/g, "");
      await StockistOrder.updateOne(
        { _id: order._id },
        { $set: {
          orderId:   `${prefix}_ST_${stCounters[key]}`,
          trOrderId: `${prefix}_TR_${trCounters[key]}`
        }}
      );
    }

    res.json({ msg: `Renumbered ${orders.length} orders` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend for any non-API route (must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));