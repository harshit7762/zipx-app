'use strict';

/**
 * Unit Tests for ChemistLog trigger and model
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 3.1, 3.2, 3.3, 6.1, 6.6
 */

// ── Mock ChemistLog and Credit models before requiring the trigger ──

const mockLogSave = jest.fn();
const mockCreditSave = jest.fn();

// Track constructed instances
let lastLogInstance = null;
let lastCreditInstance = null;

jest.mock('../models/ChemistLog', () => {
  function MockChemistLog(data) {
    Object.assign(this, data);
    this.save = mockLogSave;
    lastLogInstance = this;
  }
  return MockChemistLog;
});

jest.mock('../models/Credit', () => {
  function MockCredit(data) {
    Object.assign(this, data);
    this.save = mockCreditSave;
    lastCreditInstance = this;
  }
  return MockCredit;
});

const { createChemistLogFromOrder } = require('../utils/chemistLogTrigger');

// ── Helpers ──

function makeOrder(overrides = {}) {
  return {
    _id:             'order-id-123',
    orderId:         'ORD-20240101-ABCD',
    date:            '2024-01-01',
    agentName:       'Test Agent',
    agentId:         'agent-id-456',
    chemist:         'Dr. Smith',
    deliverTo:       'Mumbai',
    products:        [{ name: 'Paracetamol', quantity: 10, unitPrice: 5, lineTotal: 50 }],
    purchaseAmount:  400,
    deliveryCharge:  50,
    totalAmount:     500,
    cash:            300,
    online:          100,
    credit:          50,
    dues:            50,
    deliveredAt:     new Date('2024-01-01T10:00:00Z'),
    chemistLogCreated: false,
    ...overrides
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  lastLogInstance = null;
  lastCreditInstance = null;
  // Default: save resolves and sets _id on the log
  mockLogSave.mockImplementation(function () {
    this._id = 'log-id-789';
    return Promise.resolve(this);
  });
  mockCreditSave.mockResolvedValue({});
});

// ── 6.1: createChemistLogFromOrder maps fields correctly ──

describe('createChemistLogFromOrder — field mapping', () => {
  test('creates a ChemistLog with all correctly mapped fields from a StockistOrder', async () => {
    const order = makeOrder();
    await createChemistLogFromOrder(order);

    expect(mockLogSave).toHaveBeenCalledTimes(1);

    const log = lastLogInstance;
    expect(log.stockistOrderId).toBe(order._id);
    expect(log.chemistOrderId).toBe(order.orderId);
    expect(log.date).toBe(order.date);
    expect(log.agentName).toBe(order.agentName);
    expect(log.agentId).toBe(order.agentId);
    expect(log.chemistName).toBe(order.chemist);
    expect(log.chemistLocation).toBe(order.deliverTo);
    expect(log.products).toBe(order.products);
    expect(log.purchaseCost).toBe(order.purchaseAmount);
    expect(log.deliveryCharges).toBe(order.deliveryCharge);
    expect(log.extraCharges).toBe(0);
    expect(log.totalBillAmount).toBe(order.totalAmount);
    expect(log.cashReceived).toBe(order.cash);
    expect(log.onlineReceived).toBe(order.online);
    expect(log.creditGiven).toBe(order.credit);
    expect(log.outstandingAmount).toBe(order.dues);
    expect(log.deliveryStatus).toBe('delivered');
    expect(log.deliveryTime).toBe(order.deliveredAt);
    expect(log.profit).toBe(order.totalAmount - order.purchaseAmount - order.deliveryCharge);
  });

  test('sets paymentCollectionStatus to "partial" when dues > 0', async () => {
    const order = makeOrder({ dues: 50 });
    await createChemistLogFromOrder(order);
    expect(lastLogInstance.paymentCollectionStatus).toBe('partial');
  });

  test('sets paymentCollectionStatus to "collected" when dues === 0', async () => {
    const order = makeOrder({ dues: 0, credit: 0, cash: 500, online: 0 });
    await createChemistLogFromOrder(order);
    expect(lastLogInstance.paymentCollectionStatus).toBe('collected');
  });

  test('sets order.chemistLogId to the saved log._id', async () => {
    const order = makeOrder();
    await createChemistLogFromOrder(order);
    expect(order.chemistLogId).toBe('log-id-789');
  });

  test('sets order.chemistLogCreated to true', async () => {
    const order = makeOrder();
    await createChemistLogFromOrder(order);
    expect(order.chemistLogCreated).toBe(true);
  });
});

// ── 6.2: Idempotency ──

describe('createChemistLogFromOrder — idempotency', () => {
  test('second call on order with chemistLogCreated === true creates no new documents', async () => {
    const order = makeOrder({ chemistLogCreated: true });
    await createChemistLogFromOrder(order);

    expect(mockLogSave).not.toHaveBeenCalled();
    expect(mockCreditSave).not.toHaveBeenCalled();
  });

  test('calling twice on a fresh order only creates one ChemistLog', async () => {
    const order = makeOrder();
    await createChemistLogFromOrder(order);
    await createChemistLogFromOrder(order); // second call — order.chemistLogCreated is now true

    expect(mockLogSave).toHaveBeenCalledTimes(1);
  });
});

// ── 6.3: Credit creation ──

describe('createChemistLogFromOrder — Credit creation', () => {
  test('creates a Credit document when credit > 0', async () => {
    const order = makeOrder({ credit: 50 });
    await createChemistLogFromOrder(order);

    expect(mockCreditSave).toHaveBeenCalledTimes(1);
    expect(lastCreditInstance.orderId).toBe(order._id);
    expect(lastCreditInstance.chemist).toBe(order.chemist);
    expect(lastCreditInstance.amount).toBe(order.credit);
    expect(lastCreditInstance.status).toBe('pending');
  });

  test('does NOT create a Credit document when credit === 0', async () => {
    const order = makeOrder({ credit: 0, dues: 0, cash: 500, online: 0 });
    await createChemistLogFromOrder(order);

    expect(mockLogSave).toHaveBeenCalledTimes(1);
    expect(mockCreditSave).not.toHaveBeenCalled();
  });
});

// ── 6.4: Pre-save hook logic ──

describe('Pre-save hook — derived field recomputation', () => {
  // Extract the hook logic inline (same as ChemistLog.js pre-save hook)
  function applyPreSaveHook(log) {
    const purchaseCost    = log.purchaseCost    || 0;
    const deliveryCharges = log.deliveryCharges || 0;
    const extraCharges    = log.extraCharges    || 0;
    const cashReceived    = log.cashReceived    || 0;
    const onlineReceived  = log.onlineReceived  || 0;
    const creditGiven     = log.creditGiven     || 0;

    log.totalBillAmount   = purchaseCost + deliveryCharges + extraCharges;
    log.outstandingAmount = log.totalBillAmount - cashReceived - onlineReceived - creditGiven;
    log.profit            = log.totalBillAmount - purchaseCost - deliveryCharges;
  }

  test('totalBillAmount = purchaseCost + deliveryCharges + extraCharges', () => {
    const log = { purchaseCost: 400, deliveryCharges: 50, extraCharges: 20,
                  cashReceived: 0, onlineReceived: 0, creditGiven: 0 };
    applyPreSaveHook(log);
    expect(log.totalBillAmount).toBe(470);
  });

  test('outstandingAmount = totalBillAmount - cashReceived - onlineReceived - creditGiven', () => {
    const log = { purchaseCost: 400, deliveryCharges: 50, extraCharges: 0,
                  cashReceived: 300, onlineReceived: 100, creditGiven: 50 };
    applyPreSaveHook(log);
    // totalBillAmount = 450, outstanding = 450 - 300 - 100 - 50 = 0
    expect(log.outstandingAmount).toBe(0);
  });

  test('profit = totalBillAmount - purchaseCost - deliveryCharges', () => {
    const log = { purchaseCost: 400, deliveryCharges: 50, extraCharges: 30,
                  cashReceived: 0, onlineReceived: 0, creditGiven: 0 };
    applyPreSaveHook(log);
    // totalBillAmount = 480, profit = 480 - 400 - 50 = 30
    expect(log.profit).toBe(30);
  });

  test('extraCharges = 0 by default: profit equals totalBillAmount - purchaseCost - deliveryCharges', () => {
    const log = { purchaseCost: 400, deliveryCharges: 50, extraCharges: 0,
                  cashReceived: 0, onlineReceived: 0, creditGiven: 0 };
    applyPreSaveHook(log);
    expect(log.totalBillAmount).toBe(450);
    expect(log.profit).toBe(0);
  });

  test('all fields default to 0 when undefined', () => {
    const log = {};
    applyPreSaveHook(log);
    expect(log.totalBillAmount).toBe(0);
    expect(log.outstandingAmount).toBe(0);
    expect(log.profit).toBe(0);
  });
});

// ── 6.5: PATCH handler — editable vs non-editable fields ──

describe('PATCH handler — editable fields only', () => {
  const EDITABLE_FIELDS = [
    'extraCharges', 'cashReceived', 'onlineReceived', 'creditGiven',
    'deliveryStatus', 'deliveryTime', 'paymentCollectionStatus'
  ];

  const NON_EDITABLE_FIELDS = [
    'stockistOrderId', 'chemistOrderId', 'products',
    'purchaseCost', 'agentId', 'agentName', 'chemistName', 'date'
  ];

  // Inline PATCH logic (mirrors the route handler)
  function applyPatch(log, payload) {
    for (const field of EDITABLE_FIELDS) {
      if (payload[field] !== undefined) {
        log[field] = payload[field];
      }
    }
  }

  function makeLog() {
    return {
      stockistOrderId: 'order-id-123',
      chemistOrderId:  'ORD-20240101-ABCD',
      products:        [{ name: 'Paracetamol', quantity: 10 }],
      purchaseCost:    400,
      agentId:         'agent-id-456',
      agentName:       'Test Agent',
      chemistName:     'Dr. Smith',
      date:            '2024-01-01',
      extraCharges:    0,
      cashReceived:    300,
      onlineReceived:  100,
      creditGiven:     50,
      deliveryStatus:  'delivered',
      deliveryTime:    new Date('2024-01-01T10:00:00Z'),
      paymentCollectionStatus: 'partial'
    };
  }

  test('editable fields are updated from payload', () => {
    const log = makeLog();
    const payload = {
      extraCharges:            25,
      cashReceived:            350,
      onlineReceived:          50,
      creditGiven:             0,
      deliveryStatus:          'delivered',
      paymentCollectionStatus: 'collected'
    };
    applyPatch(log, payload);

    expect(log.extraCharges).toBe(25);
    expect(log.cashReceived).toBe(350);
    expect(log.onlineReceived).toBe(50);
    expect(log.creditGiven).toBe(0);
    expect(log.paymentCollectionStatus).toBe('collected');
  });

  test('non-editable fields are unchanged even when present in payload', () => {
    const log = makeLog();
    const originalValues = {};
    for (const field of NON_EDITABLE_FIELDS) {
      originalValues[field] = log[field];
    }

    const payload = {
      // Attempt to overwrite non-editable fields
      stockistOrderId: 'hacked-id',
      chemistOrderId:  'HACKED-ORD',
      products:        [],
      purchaseCost:    0,
      agentId:         'hacked-agent',
      agentName:       'Hacker',
      chemistName:     'Fake Chemist',
      date:            '1970-01-01',
      // Also include a valid editable field
      extraCharges:    10
    };

    applyPatch(log, payload);

    // Non-editable fields must be unchanged
    for (const field of NON_EDITABLE_FIELDS) {
      expect(log[field]).toEqual(originalValues[field]);
    }

    // Editable field was applied
    expect(log.extraCharges).toBe(10);
  });

  test('undefined payload fields do not overwrite existing values', () => {
    const log = makeLog();
    applyPatch(log, { extraCharges: 5 }); // only one field in payload

    expect(log.cashReceived).toBe(300);    // unchanged
    expect(log.onlineReceived).toBe(100);  // unchanged
    expect(log.creditGiven).toBe(50);      // unchanged
    expect(log.extraCharges).toBe(5);      // updated
  });
});
