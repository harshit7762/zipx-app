const express = require("express");
const router  = express.Router();
const OrderRequest = require("../models/OrderRequest");
const User    = require("../models/User");
const auth    = require("../middleware/authMiddleware");

// Get requests — admin/semiadmin sees all, agent sees their own
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name role');
    const query = (user.role === 'admin' || user.role === 'semiadmin') ? {} : { agent: user.name };
    const requests = await OrderRequest.find(query).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) { res.status(500).send("Server Error"); }
});

// Admin/semiadmin creates a request
router.post("/", auth, async (req, res) => {
  try {
    const req_ = new OrderRequest({ ...req.body, sentBy: req.user.role });
    await req_.save();
    res.json(req_);
  } catch (err) { res.status(500).send("Server Error"); }
});

// Agent updates status (accept/reject)
router.put("/:id", auth, async (req, res) => {
  try {
    const updated = await OrderRequest.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    res.json(updated);
  } catch (err) { res.status(500).send("Server Error"); }
});

// Delete request
router.delete("/:id", auth, async (req, res) => {
  try {
    await OrderRequest.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch (err) { res.status(500).send("Server Error"); }
});

module.exports = router;
