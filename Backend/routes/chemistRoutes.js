const express = require("express");
const router  = express.Router();
const Chemist = require("../models/Chemist");
const auth    = require("../middleware/authMiddleware");

router.get("/", auth, async (req, res) => {
  try {
    const chemists = await Chemist.find().sort({ name: 1 });
    res.json(chemists.map(c => ({ name: c.name, phone: c.phone || '' })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const name  = (req.body.name  || '').trim().toUpperCase();
    const phone = (req.body.phone || '').trim();
    if (!name) return res.status(400).json({ error: "Name required" });
    const existing = await Chemist.findOne({ name });
    if (existing) return res.status(400).json({ error: "Chemist already exists" });
    const chemist = await Chemist.create({ name, phone });
    res.status(201).json({ name: chemist.name, phone: chemist.phone });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete("/:name", auth, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name).toUpperCase();
    await Chemist.deleteOne({ name });
    res.json({ msg: "Deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
