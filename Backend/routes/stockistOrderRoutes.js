const express = require("express");
const router = express.Router();
const StockistOrder = require("../models/StockistOrder");
const Credit = require("../models/Credit");
const auth = require("../middleware/authMiddleware");
const { advanceStatus } = require("../utils/statusEngine");
const { createChemistLogFromOrder } = require("../utils/chemistLogTrigger");

// POST /api/stockist-orders — create new order
router.post("/", auth, async (req, res) => {
  try {
    const { agentName, stockist } = req.body;

    if (!agentName || !stockist) {
      return res.status(400).json({ error: "agentName and stockist are required" });
    }

    let agentId = req.user.id;
    if (req.user.role === "admin" && agentName !== req.user.name) {
      const User = require("../models/User");
      const agent = await User.findOne({ name: agentName, role: "agent" });
      if (agent) agentId = agent._id;
    }

    const order = new StockistOrder({
      ...req.body,
      chemist: req.body.chemist || '',
      products: Array.isArray(req.body.products) ? req.body.products : [],
      agentId,
      statusHistory: [{
        status: "pending",
        changedBy: agentName,
        changedById: agentId,
        timestamp: new Date()
      }]
    });

    await order.save();

    if ((req.body.credit || 0) > 0) {
      await Credit.create({
        orderId:   order._id,
        chemist:   order.chemist,
        agentName: order.agentName,
        amount:    order.credit,
        recovered: 0,
        status:    "pending"
      });
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/stockist-orders — list with filters + role scoping
router.get("/", auth, async (req, res) => {
  try {
    const { stockist, agent, status, from, to } = req.query;
    const query = {};

    if (req.user.role !== "admin") {
      query.$or = [
        { agentId: req.user.id },
        { transferredToId: req.user.id, transferStatus: 'pending' },
        { originalAgentId: req.user.id }
      ];
    }

    if (stockist) query.stockist = stockist;
    if (status)   query.status   = status;

    if (agent && req.user.role === "admin") {
      query.agentName = agent;
    }

    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to)   query.date.$lte = to;
    }

    const orders = await StockistOrder.find(query).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stockist-orders/:id — single order
router.get("/:id", auth, async (req, res) => {
  try {
    const order = await StockistOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/stockist-orders/:id/status — advance status
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const order = await StockistOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.transferStatus === 'pending') {
      return res.status(400).json({ error: "Cannot advance status while transfer is pending" });
    }

    const { status, remark } = req.body;

    advanceStatus(order, status, req.user, remark);

    // Assign trOrderId the first time this agent actually works on the order.
    // Uses max-based lookup so it always increments from the highest existing TR number.
    await StockistOrder.assignTrOrderId(order);

    if (status === "collected") {
      await createChemistLogFromOrder(order);
    }

    await order.save();
    res.json(order);
  } catch (err) {
    const statusCode = err.status || 500;
    res.status(statusCode).json({ error: err.message });
  }
});

// PUT /api/stockist-orders/:id — admin only, edit pending/purchased orders
router.put("/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const order = await StockistOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.status !== "pending" && order.status !== "purchased") {
      return res.status(400).json({ error: "Can only edit orders with status 'pending' or 'purchased'" });
    }

    Object.assign(order, req.body);
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/stockist-orders/:id/photo — upload or remove photo
router.patch("/:id/photo", auth, async (req, res) => {
  try {
    const order = await StockistOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (req.user.role !== "admin" && String(order.agentId) !== String(req.user.id)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    order.photo = req.body.photo || null;
    await order.save();
    res.json({ photo: order.photo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/stockist-orders/:id/transfer — agent initiates transfer to another agent
router.patch("/:id/transfer", auth, async (req, res) => {
  try {
    const order = await StockistOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.status === 'collected') {
      return res.status(400).json({ error: "Cannot transfer a collected order" });
    }
    if (order.transferStatus === 'accepted') {
      return res.status(400).json({ error: "Order already transferred" });
    }

    const { toAgentName } = req.body;
    if (!toAgentName) return res.status(400).json({ error: "toAgentName required" });

    const User = require("../models/User");
    const toAgent = await User.findOne({ name: toAgentName, role: "agent" });
    if (!toAgent) return res.status(404).json({ error: "Agent not found" });

    order.transferredTo       = toAgentName;
    order.transferredToId     = toAgent._id;
    order.transferredFrom     = order.agentName;
    order.transferStatus      = 'pending';
    order.transferredAtStatus = order.status;
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/stockist-orders/:id/reject-transfer — receiving agent rejects transfer
router.patch("/:id/reject-transfer", auth, async (req, res) => {
  try {
    const order = await StockistOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.transferStatus !== 'pending') {
      return res.status(400).json({ error: "No pending transfer for this order" });
    }

    order.transferStatus      = 'none';
    order.transferredTo       = null;
    order.transferredToId     = null;
    order.transferredFrom     = null;
    order.transferredAtStatus = null;

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/stockist-orders/:id/accept-transfer — receiving agent accepts transfer
router.patch("/:id/accept-transfer", auth, async (req, res) => {
  try {
    const order = await StockistOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.transferStatus !== 'pending') {
      return res.status(400).json({ error: "No pending transfer for this order" });
    }

    // Preserve original agent info before changing ownership
    order.originalAgentName = order.agentName;
    order.originalAgentId   = order.agentId;

    // Transfer ownership to the receiving agent (for tracking purposes)
    order.agentName      = order.transferredTo;
    order.agentId        = order.transferredToId;
    order.transferStatus = 'accepted';

    // Clear the old trOrderId (if any) and reassign with the new agent's prefix.
    // This ensures the tracking ID reflects the current owner, not the original creator.
    order.trOrderId = null;
    await StockistOrder.assignTrOrderId(order);

    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/stockist-orders/:id — admin only, soft-deletes stockist log but keeps tracking
router.delete("/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const order = await StockistOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Soft delete — hide from stockist log, keep tracking alive
    // Clear orderId so it no longer counts toward the ST sequence
    order.stockistLogDeleted = true;
    order.orderId = null;
    await order.save();

    await Credit.deleteMany({ orderId: order._id });

    res.json({ msg: "Stockist log deleted, tracking preserved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/stockist-orders/:id/tracking — admin only, marks tracking as deleted but keeps stockist log
router.delete("/:id/tracking", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const order = await StockistOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.trackingDeleted = true;
    await order.save();

    res.json({ msg: "Tracking log deleted, stockist log preserved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
