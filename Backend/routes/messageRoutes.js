const express = require("express");
const router  = express.Router();
const Message = require("../models/Message");
const User    = require("../models/User");
const auth    = require("../middleware/authMiddleware");

// Helper to get user name from token
async function getUserName(req) {
  const user = await User.findById(req.user.id).select('name');
  return user ? user.name : 'Unknown';
}

// Get messages for current user (admin gets all, agent gets their thread)
router.get("/", auth, async (req, res) => {
  try {
    const name = await getUserName(req);
    const query = req.user.role === 'admin'
      ? {}
      : { $or: [{ to: name }, { from: name }] };
    const messages = await Message.find(query).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Send a message
router.post("/", auth, async (req, res) => {
  try {
    const msg = new Message(req.body);
    await msg.save();
    res.json(msg);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Mark messages as read for current user
router.put("/read", auth, async (req, res) => {
  try {
    const name = await getUserName(req);
    const filter = req.user.role === 'admin' ? { to: 'admin' } : { to: name };
    await Message.updateMany(filter, { isNew: false });
    res.json({ msg: "Marked as read" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Mark a single message as parsed (import order)
router.put("/:id/parsed", auth, async (req, res) => {
  try {
    const msg = await Message.findByIdAndUpdate(req.params.id, { parsed: true }, { new: true });
    res.json(msg);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Clear all messages (admin only)
router.delete("/clear", auth, async (req, res) => {
  try {
    await Message.deleteMany({});
    res.json({ msg: "Cleared" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;
