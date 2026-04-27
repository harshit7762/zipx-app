const express  = require("express");
const router   = express.Router();
const Stockist = require("../models/Stockist");
const auth     = require("../middleware/authMiddleware");

router.get("/", auth, async (req, res) => {
  try {
    const stockists = await Stockist.find().sort({ name: 1 });
    res.json(stockists.map(s => ({ name: s.name, phone: s.phone || '' })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const name  = (req.body.name  || '').trim().toUpperCase();
    const phone = (req.body.phone || '').trim();
    if (!name) return res.status(400).json({ error: "Name required" });
    const existing = await Stockist.findOne({ name });
    if (existing) return res.status(400).json({ error: "Stockist already exists" });
    const stockist = await Stockist.create({ name, phone });
    res.status(201).json({ name: stockist.name, phone: stockist.phone });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete("/:name", auth, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name).toUpperCase();
    await Stockist.deleteOne({ name });
    res.json({ msg: "Deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
