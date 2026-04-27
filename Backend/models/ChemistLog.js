const mongoose = require("mongoose");

const chemistLogSchema = new mongoose.Schema({
  stockistOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "StockistOrder", required: true },
  chemistOrderId:  String,  // legacy field
  chOrderId:       String,  // new format: ANOJ_CH_1
  date:     String,
  dateTime: Date,
  agentName:   { type: String, required: true },
  agentId:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  chemistName: { type: String, required: true },
  stockist:    { type: String, default: '' },
  purchaseCost:    { type: Number, default: 0 },
  deliveryCharges: { type: Number, default: 0 },
  gstAmount:       { type: Number, default: 0 },
  totalBillAmount: Number,
  cashReceived:     { type: Number, default: 0 },
  onlineReceived:   { type: Number, default: 0 },
  creditGiven:      { type: Number, default: 0 },
  outstandingAmount: Number,
  paymentCollectionStatus: {
    type: String,
    enum: ["pending", "partial", "collected"],
    default: "pending"
  }
}, { timestamps: true });

chemistLogSchema.pre("save", function () {
  const purchaseCost   = this.purchaseCost   || 0;
  const deliveryCharge = this.deliveryCharges || 0;
  const cashReceived   = this.cashReceived   || 0;
  const onlineReceived = this.onlineReceived || 0;
  const creditGiven    = this.creditGiven    || 0;
  this.gstAmount       = Math.round(deliveryCharge * 0.18 * 100) / 100;
  this.totalBillAmount   = purchaseCost + deliveryCharge + this.gstAmount;
  this.outstandingAmount = purchaseCost - cashReceived - onlineReceived - creditGiven;
});

chemistLogSchema.index({ agentId: 1, date: -1 });
chemistLogSchema.index({ chemistName: 1, date: -1 });
chemistLogSchema.index({ paymentCollectionStatus: 1, date: -1 });

module.exports = mongoose.model("ChemistLog", chemistLogSchema);
