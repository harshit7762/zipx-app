const mongoose = require("mongoose");

const statusHistorySchema = new mongoose.Schema({
  status: String,
  changedBy: String,
  changedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  timestamp: Date,
  remark: String
}, { _id: false });

const stockistOrderSchema = new mongoose.Schema({
  orderId: String,
  orderRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "OrderRequest", default: null },

  agentName: { type: String, required: true },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  stockist: { type: String, required: true },

  chemist: { type: String, default: '' },

  purchaseAmount: Number,
  deliveryCharge: { type: Number, default: 0 },
  totalAmount: Number,
  cash: { type: Number, default: 0 },
  online: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  dues: { type: Number, default: 0 },
  cashback: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ["pending", "purchased", "outfordelivery", "delivered", "collected"],
    default: "pending"
  },
  statusHistory: [statusHistorySchema],

  purchasedAt: Date,
  dispatchedAt: Date,
  deliveredAt: Date,
  collectedAt: Date,

  date: String,

  trOrderId: { type: String, default: null },
  trackingDeleted: { type: Boolean, default: false },
  stockistLogDeleted: { type: Boolean, default: false },

  // Transfer fields
  transferredTo:       { type: String, default: null },
  transferredToId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  transferredFrom:     { type: String, default: null },
  transferStatus:      { type: String, enum: ['none', 'pending', 'accepted'], default: 'none' },
  transferredAtStatus: { type: String, default: null },
  originalAgentName:   { type: String, default: null },
  originalAgentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  photo: { type: String, default: null },

  chemistLogCreated: { type: Boolean, default: false },
  chemistLogId: { type: mongoose.Schema.Types.ObjectId, default: null }
}, { timestamps: true });

// ── Pre-save: assign orderId (ST) at creation only ──
// Simple sequential numbering: count existing non-deleted stockist logs + 1.
// Stockist log is scoped to the original creator (who initiated the order),
// not the current owner (who might have received it via transfer).
stockistOrderSchema.pre("save", async function () {
  if (!this.orderId) {
    const StockistOrder = mongoose.model("StockistOrder");
    const prefix = (this.agentName || "ORD").toUpperCase().replace(/\s+/g, "");

    // For stockist log counting, use the original creator's ID.
    // At creation time, originalAgentId is null, so use agentId.
    // After transfer, originalAgentId points to the creator.
    const creatorId = this.originalAgentId || this.agentId;

    const count = await StockistOrder.countDocuments({
      _id: { $ne: this._id },
      $or: [
        { agentId: creatorId, originalAgentId: null },           // orders created by this agent
        { originalAgentId: creatorId }                          // orders originally created by this agent (transferred)
      ],
      stockistLogDeleted: { $ne: true }
    });

    this.orderId   = `${prefix}_ST_${count + 1}`;
    this.trOrderId = null;
  }
});

// ── Static: assign trOrderId the first time an agent actually works on an order ──
// Simple sequential numbering: count existing non-deleted tracking logs + 1.
stockistOrderSchema.statics.assignTrOrderId = async function (order) {
  if (order.trOrderId) return;

  const prefix = (order.agentName || "ORD").toUpperCase().replace(/\s+/g, "");

  const count = await this.countDocuments({
    _id: { $ne: order._id },
    agentId: order.agentId,
    trackingDeleted: { $ne: true },
    trOrderId: { $ne: null }
  });

  order.trOrderId = `${prefix}_TR_${count + 1}`;
};

// ── Pre-save: validate payment invariant ──
stockistOrderSchema.pre("save", function () {
  const { cash = 0, online = 0, credit = 0, dues = 0, totalAmount } = this;

  if (cash < 0 || online < 0 || credit < 0 || dues < 0) {
    throw new Error("Payment fields cannot be negative");
  }

  if (totalAmount !== undefined && totalAmount !== null && totalAmount > 0) {
    const computed = Math.round((cash + online + credit + dues) * 100);
    const expected = Math.round(totalAmount * 100);
    if (computed !== expected) {
      throw new Error(
        `Payment breakdown (${cash + online + credit + dues}) does not match total (${totalAmount})`
      );
    }
  }
});

// Compound indexes
stockistOrderSchema.index({ agentId: 1, status: 1 });
stockistOrderSchema.index({ stockist: 1, date: -1 });
stockistOrderSchema.index({ status: 1, date: -1 });

module.exports = mongoose.model("StockistOrder", stockistOrderSchema);
