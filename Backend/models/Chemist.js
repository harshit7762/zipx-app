const mongoose = require("mongoose");

const chemistSchema = new mongoose.Schema({
  name:  { type: String, required: true, unique: true, uppercase: true, trim: true },
  phone: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model("Chemist", chemistSchema);
