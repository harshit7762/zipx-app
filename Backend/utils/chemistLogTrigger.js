const ChemistLog = require('../models/ChemistLog');

async function createChemistLogFromOrder(order) {
  if (order.chemistLogCreated === true) return;

  const agentPrefix = (order.agentName || 'ORD').toUpperCase().replace(/\s+/g, '');
  
  // Count existing chemist logs for this agent
  const count = await ChemistLog.countDocuments({
    agentId: order.agentId,
    chOrderId: { $ne: null }
  });
  
  const chOrderId = `${agentPrefix}_CH_${count + 1}`;

  const log = new ChemistLog({
    stockistOrderId:         order._id,
    chemistOrderId:          order.orderId,  // legacy
    chOrderId,
    date:                    order.date,
    dateTime:                order.collectedAt || new Date(),
    deliveryTime:            order.deliveredAt  || null,
    agentName:               order.agentName,
    agentId:                 order.agentId,
    chemistName:             order.chemist,
    stockist:                order.stockist || '',
    purchaseCost:            order.purchaseAmount  || 0,
    deliveryCharges:         0,
    cashReceived:            0,
    onlineReceived:          0,
    creditGiven:             0,
    paymentCollectionStatus: 'pending'
  });
  await log.save();
  order.chemistLogId      = log._id;
  order.chemistLogCreated = true;
}

module.exports = { createChemistLogFromOrder };
