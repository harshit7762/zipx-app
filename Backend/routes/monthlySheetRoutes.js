const express      = require("express");
const router       = express.Router();
const MonthlySheet = require("../models/MonthlySheet");
const auth         = require("../middleware/authMiddleware");

router.get("/", auth, async (req, res) => {
  try {
    const sheets = await MonthlySheet.find().sort({ archivedAt: -1 });
    res.json(sheets);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", auth, async (req, res) => {
  try {
    const sheet = await MonthlySheet.create(req.body);
    res.status(201).json(sheet);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put("/:id", auth, async (req, res) => {
  try {
    const sheet = await MonthlySheet.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!sheet) return res.status(404).json({ error: "Sheet not found" });
    res.json(sheet);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await MonthlySheet.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
