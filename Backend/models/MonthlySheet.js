const mongoose = require("mongoose");

const monthlySheetSchema = new mongoose.Schema({
  label:        { type: String, required: true },
  orders:       { type: Array, default: [] },
  chemistLogs:  { type: Array, default: [] },
  credits:      { type: Array, default: [] },
  totalAmount:  { type: Number, default: 0 },
  totalCash:    { type: Number, default: 0 },
  totalOnline:  { type: Number, default: 0 },
  totalCredit:  { type: Number, default: 0 },
  totalDues:    { type: Number, default: 0 },
  archivedAt:   { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("MonthlySheet", monthlySheetSchema);
