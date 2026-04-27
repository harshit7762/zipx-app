const STATUS_SEQUENCE = [
  'pending',
  'purchased',
  'outfordelivery',
  'delivered',
  'collected'
];

/**
 * Advance an order's status by one step.
 * @param {Object} order - Mongoose document (mutated in place; caller must save)
 * @param {string} newStatus - Target status
 * @param {{ id: string, name: string, role: string }} requestingUser - From JWT middleware
 * @param {string} [remark] - Optional remark for audit trail
 * @returns {Object} The mutated order
 * @throws {{ status: 400|403, message: string }}
 */
function advanceStatus(order, newStatus, requestingUser, remark) {
  // Ownership check: agents may only update their own orders
  // After transfer, originalAgentId is the old owner — block them
  if (requestingUser.role !== 'admin') {
    const isCurrentAgent  = order.agentId.toString() === requestingUser.id;
    const isOriginalAgent = order.originalAgentId && order.originalAgentId.toString() === requestingUser.id;
    if (!isCurrentAgent || isOriginalAgent) {
      throw { status: 403, message: 'Not authorized to update this order' };
    }
  }

  const currentIdx = STATUS_SEQUENCE.indexOf(order.status);
  const newIdx = STATUS_SEQUENCE.indexOf(newStatus);

  if (newIdx === -1) {
    throw { status: 400, message: `Invalid status value: '${newStatus}'` };
  }

  if (newIdx !== currentIdx + 1) {
    throw {
      status: 400,
      message: `Invalid transition: cannot move from '${order.status}' to '${newStatus}'`
    };
  }

  // Stamp per-status timestamp
  if (newStatus === 'purchased')      order.purchasedAt  = new Date();
  if (newStatus === 'outfordelivery') order.dispatchedAt = new Date();
  if (newStatus === 'delivered')      order.deliveredAt  = new Date();
  if (newStatus === 'collected')      order.collectedAt  = new Date();

  // Append audit entry
  order.statusHistory.push({
    status:      newStatus,
    changedBy:   requestingUser.name,
    changedById: requestingUser.id,
    timestamp:   new Date(),
    remark:      remark
  });

  order.status = newStatus;

  return order;
}

module.exports = { STATUS_SEQUENCE, advanceStatus };
