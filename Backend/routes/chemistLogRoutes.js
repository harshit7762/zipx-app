const express = require("express");
const router = express.Router();
const ChemistLog = require("../models/ChemistLog");
const auth = require("../middleware/authMiddleware");

const EDITABLE_FIELDS = [
  "extraCharges",
  "deliveryCharges",
  "cashReceived",
  "onlineReceived",
  "creditGiven",
  "deliveryStatus",
  "deliveryTime",
  "paymentCollectionStatus"
];

// GET /api/chemist-logs — list with filters + role scoping
router.get("/", auth, async (req, res) => {
  try {
    const { chemist, agent, status, from, to } = req.query;
    const query = {};

    // Role scoping: agents see only their own logs
    if (req.user.role !== "admin") {
      query.agentId = req.user.id;
    }

    if (chemist) query.chemistName = chemist;
    if (status) query.paymentCollectionStatus = status;

    // ?agent filter is admin-only (filter by agentName field)
    if (agent && req.user.role === "admin") {
      query.agentName = agent;
    }

    // Date range filter on the `date` field (YYYY-MM-DD string)
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const logs = await ChemistLog.find(query).sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/chemist-logs/:id — single log
router.get("/:id", auth, async (req, res) => {
  try {
    const log = await ChemistLog.findById(req.params.id);
    if (!log) return res.status(404).json({ error: "ChemistLog not found" });

    if (req.user.role !== "admin" && String(log.agentId) !== String(req.user.id)) {
      return res.status(403).json({ error: "Not authorized to view this log" });
    }

    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/chemist-logs/:id — update editable fields only
router.patch("/:id", auth, async (req, res) => {
  try {
    const log = await ChemistLog.findById(req.params.id);
    if (!log) return res.status(404).json({ error: "ChemistLog not found" });

    if (req.user.role !== "admin" && String(log.agentId) !== String(req.user.id)) {
      return res.status(403).json({ error: "Not authorized to update this log" });
    }

    // Apply only editable fields, strip non-editable fields
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        log[field] = req.body[field];
      }
    }

    // pre-save hook recomputes totalBillAmount, outstandingAmount, profit
    await log.save();
    res.json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/chemist-logs/:id — admin only
router.delete("/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const log = await ChemistLog.findByIdAndDelete(req.params.id);
    if (!log) return res.status(404).json({ error: "ChemistLog not found" });
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
