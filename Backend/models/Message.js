const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  from:     { type: String, required: true },
  to:       { type: String, required: true }, // agent name or 'admin'
  text:     { type: String, required: true },
  dir:      { type: String, enum: ['in','out'], default: 'in' },
  isNew:    { type: Boolean, default: true },
  parsed:   { type: Boolean, default: false },
  amount:   Number,
  chemist:  String,
  stockist: String
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);
