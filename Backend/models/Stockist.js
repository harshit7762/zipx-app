const mongoose = require("mongoose");

const stockistSchema = new mongoose.Schema({
  name:  { type: String, required: true, unique: true, uppercase: true, trim: true },
  phone: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model("Stockist", stockistSchema);
