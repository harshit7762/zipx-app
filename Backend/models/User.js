const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  color: { type: String, default: "#3dcfc2" },
  role: { type: String, enum: ["admin", "agent", "semiadmin"], default: "agent" },
  approved: { type: Boolean, default: false }
});

module.exports = mongoose.model("User", userSchema);