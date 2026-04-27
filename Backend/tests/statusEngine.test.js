'use strict';

const { STATUS_SEQUENCE, advanceStatus } = require('../utils/statusEngine');

function makeOrder(status = 'pending') {
  return {
    status,
    agentId: { toString: () => 'agent1' },
    statusHistory: []
  };
}

const agentUser  = { id: 'agent1', name: 'Test Agent', role: 'agent' };
const otherAgent = { id: 'agent2', name: 'Other Agent', role: 'agent' };
const adminUser  = { id: 'admin1', name: 'Admin User', role: 'admin' };

describe('STATUS_SEQUENCE', () => {
  test('contains the five expected statuses in order', () => {
    expect(STATUS_SEQUENCE).toEqual([
      'pending', 'purchased', 'outfordelivery', 'delivered', 'collected'
    ]);
  });
});

describe('advanceStatus — valid one-step transitions', () => {
  test('pending → purchased', () => {
    const order = makeOrder('pending');
    advanceStatus(order, 'purchased', agentUser);
    expect(order.status).toBe('purchased');
    expect(order.purchasedAt).toBeInstanceOf(Date);
    expect(order.statusHistory).toHaveLength(1);
  });

  test('purchased → outfordelivery', () => {
    const order = makeOrder('purchased');
    advanceStatus(order, 'outfordelivery', agentUser);
    expect(order.status).toBe('outfordelivery');
    expect(order.dispatchedAt).toBeInstanceOf(Date);
  });

  test('outfordelivery → delivered', () => {
    const order = makeOrder('outfordelivery');
    advanceStatus(order, 'delivered', agentUser);
    expect(order.status).toBe('delivered');
    expect(order.deliveredAt).toBeInstanceOf(Date);
  });

  test('delivered → collected', () => {
    const order = makeOrder('delivered');
    advanceStatus(order, 'collected', agentUser);
    expect(order.status).toBe('collected');
    expect(order.collectedAt).toBeInstanceOf(Date);
  });
});

describe('advanceStatus — skip transitions (should throw 400)', () => {
  test('pending → outfordelivery throws 400', () => {
    const order = makeOrder('pending');
    expect(() => advanceStatus(order, 'outfordelivery', agentUser))
      .toThrow(expect.objectContaining({ status: 400 }));
  });

  test('pending → collected throws 400', () => {
    const order = makeOrder('pending');
    expect(() => advanceStatus(order, 'collected', agentUser))
      .toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe('advanceStatus — backward transitions (should throw 400)', () => {
  test('purchased → pending throws 400', () => {
    const order = makeOrder('purchased');
    expect(() => advanceStatus(order, 'pending', agentUser))
      .toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe('advanceStatus — invalid status string (should throw 400)', () => {
  test("pending → 'shipped' throws 400", () => {
    const order = makeOrder('pending');
    expect(() => advanceStatus(order, 'shipped', agentUser))
      .toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe('advanceStatus — ownership check', () => {
  test('different agent throws 403', () => {
    const order = makeOrder('pending');
    expect(() => advanceStatus(order, 'purchased', otherAgent))
      .toThrow(expect.objectContaining({ status: 403 }));
  });

  test('admin can advance any order regardless of agentId', () => {
    const order = makeOrder('pending');
    advanceStatus(order, 'purchased', adminUser);
    expect(order.status).toBe('purchased');
  });
});
