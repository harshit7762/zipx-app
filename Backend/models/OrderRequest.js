const mongoose = require("mongoose");

const orderRequestSchema = new mongoose.Schema({
  chemist:   { type: String, required: true },
  stockists: [{ type: String }],
  agent:     { type: String, required: true }, // agent name
  date:      { type: String, required: true },
  status:    { type: String, enum: ['pending','accepted','rejected'], default: 'pending' },
  notes:     { type: String, default: '' },
  sentBy:    { type: String, default: 'admin' },
  stockistOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockistOrder', default: null }
}, { timestamps: true });

module.exports = mongoose.model("OrderRequest", orderRequestSchema);
