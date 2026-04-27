const express = require("express");
const router = express.Router();
const Credit = require("../models/Credit");
const auth = require("../middleware/authMiddleware");

// Get All Credits — admin sees all, agents see only their own
router.get("/", auth, async (req, res) => {
  try {
    const query = req.user.role !== 'admin' ? { agentName: req.user.name } : {};
    const credits = await Credit.find(query)
      .populate('orderId', 'orderId')
      .sort({ createdAt: -1 });
    res.json(credits);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Create Credit
router.post("/", auth, async (req, res) => {
  try {
    const credit = new Credit(req.body);
    await credit.save();
    res.json(credit);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Update Credit (mark recovered, etc.)
router.put("/:id", auth, async (req, res) => {
  try {
    const credit = await Credit.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    res.json(credit);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Delete Credit
router.delete("/:id", auth, async (req, res) => {
  try {
    await Credit.findByIdAndDelete(req.params.id);
    res.json({ msg: "Credit deleted" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;