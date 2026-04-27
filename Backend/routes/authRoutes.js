const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/authMiddleware");

// Register Agent Request
router.post("/register", async (req, res) => {
  try {
    const { name, username, password, phone, role } = req.body;
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ msg: "Username already taken" });

    // Only one semiadmin allowed
    if (role === 'semiadmin') {
      const existingSA = await User.findOne({ role: 'semiadmin' });
      if (existingSA) return res.status(400).json({ msg: "A semiadmin already exists. Only one is allowed." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      username,
      password: hashedPassword,
      phone: phone || "",
      role: role || "agent",
      approved: false
    });

    await user.save();
    res.json({ msg: "Registration request sent. Awaiting admin approval." });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ msg: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

    if (!user.approved && user.role !== 'admin' && user.role !== 'semiadmin') {
      return res.status(403).json({ msg: "Account pending admin approval" });
    }

    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { name: user.name, username: user.username, role: user.role, color: user.color } });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Get current user (session restore)
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json({ name: user.name, username: user.username, role: user.role, color: user.color });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Get all agents (admin + semiadmin)
router.get("/agents", auth, async (req, res) => {
  try {
    const users = await User.find({ role: "agent" }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Get all semiadmins (admin only)
router.get("/semiadmins", auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: "Admin only" });
    const users = await User.find({ role: "semiadmin" }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Approve agent (admin only)
router.put("/approve/:id", auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { approved: true }, { returnDocument: 'after' }).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Delete agent (admin only)
router.delete("/agents/:id", auth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: "Agent deleted" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;