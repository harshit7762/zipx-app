const mongoose = require("mongoose");

const creditSchema = new mongoose.Schema({
  orderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'StockistOrder' },
  chemist:   String,
  agentName: String,
  amount:    Number,
  recovered: { type: Number, default: 0 },
  dueDate:   String,
  status:    { type: String, enum: ["pending", "overdue", "recovered"], default: "pending" }
});

module.exports = mongoose.model("Credit", creditSchema);