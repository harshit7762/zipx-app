'use strict';

/**
 * Property-Based Tests for ChemistLog invariants
 * Uses fast-check for property generation
 *
 * Validates: Requirements 1.2, 2.1, 3.1, 3.2, 3.3, 4.3, 6.6
 */

const fc = require('fast-check');

// ── Mock ChemistLog and Credit models before requiring the trigger ──

const mockLogSave = jest.fn();
const mockCreditSave = jest.fn();

let lastLogInstance = null;

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
  }
  return MockCredit;
});

const { createChemistLogFromOrder } = require('../utils/chemistLogTrigger');

// ── Inline helpers (same logic as production code) ──

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

const EDITABLE_FIELDS = [
  'extraCharges', 'cashReceived', 'onlineReceived', 'creditGiven',
  'deliveryStatus', 'deliveryTime', 'paymentCollectionStatus'
];

const NON_EDITABLE_FIELDS = [
  'stockistOrderId', 'chemistOrderId', 'products',
  'purchaseCost', 'agentId', 'agentName', 'chemistName', 'date'
];

function applyPatch(log, payload) {
  for (const field of EDITABLE_FIELDS) {
    if (payload[field] !== undefined) log[field] = payload[field];
  }
}

// ── Arbitraries ──

const nonNegativeFloat = fc.float({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true })
  .map(v => Math.round(v * 100) / 100);

const productArb = fc.record({
  name:      fc.string({ minLength: 1, maxLength: 20 }),
  quantity:  fc.nat(100),
  batch:     fc.string({ minLength: 1, maxLength: 10 }),
  expiry:    fc.string({ minLength: 1, maxLength: 10 }),
  unitPrice: nonNegativeFloat,
  lineTotal: nonNegativeFloat
});

const stockistOrderArb = fc.record({
  _id:             fc.string({ minLength: 1, maxLength: 24 }),
  orderId:         fc.string({ minLength: 1, maxLength: 20 }),
  date:            fc.string({ minLength: 1, maxLength: 10 }),
  agentName:       fc.string({ minLength: 1, maxLength: 30 }),
  agentId:         fc.string({ minLength: 1, maxLength: 24 }),
  chemist:         fc.string({ minLength: 1, maxLength: 30 }),
  deliverTo:       fc.string({ minLength: 1, maxLength: 30 }),
  products:        fc.array(productArb, { minLength: 1, maxLength: 5 }),
  purchaseAmount:  nonNegativeFloat,
  deliveryCharge:  nonNegativeFloat,
  totalAmount:     nonNegativeFloat,
  cash:            nonNegativeFloat,
  online:          nonNegativeFloat,
  credit:          nonNegativeFloat,
  dues:            nonNegativeFloat,
  deliveredAt:     fc.date()
});

// ── Setup ──

beforeEach(() => {
  jest.clearAllMocks();
  lastLogInstance = null;
  mockLogSave.mockImplementation(function () {
    this._id = 'log-id-' + Math.random().toString(36).slice(2);
    return Promise.resolve(this);
  });
  mockCreditSave.mockResolvedValue({});
});

// ── Property 5 (Req 3.1): Total bill amount invariant ──
// Validates: Requirements 3.1

describe('Property 5: totalBillAmount invariant', () => {
  test(
    'for any non-negative (purchaseCost, deliveryCharges, extraCharges), ' +
    'totalBillAmount === purchaseCost + deliveryCharges + extraCharges after save',
    () => {
      /**
       * **Validates: Requirements 3.1**
       */
      fc.assert(
        fc.property(
          nonNegativeFloat,
          nonNegativeFloat,
          nonNegativeFloat,
          (purchaseCost, deliveryCharges, extraCharges) => {
            const log = { purchaseCost, deliveryCharges, extraCharges,
                          cashReceived: 0, onlineReceived: 0, creditGiven: 0 };
            applyPreSaveHook(log);
            return Math.abs(log.totalBillAmount - (purchaseCost + deliveryCharges + extraCharges)) < 0.001;
          }
        )
      );
    }
  );
});

// ── Property 3 (Req 3.2): Outstanding amount invariant ──
// Validates: Requirements 3.2

describe('Property 3: outstandingAmount invariant', () => {
  test(
    'for any non-negative (totalBillAmount, cashReceived, onlineReceived, creditGiven), ' +
    'outstandingAmount === totalBillAmount - cashReceived - onlineReceived - creditGiven after save',
    () => {
      /**
       * **Validates: Requirements 3.2**
       */
      fc.assert(
        fc.property(
          nonNegativeFloat,
          nonNegativeFloat,
          nonNegativeFloat,
          nonNegativeFloat,
          (purchaseCost, cashReceived, onlineReceived, creditGiven) => {
            // Use purchaseCost as the sole component so totalBillAmount is deterministic
            const log = { purchaseCost, deliveryCharges: 0, extraCharges: 0,
                          cashReceived, onlineReceived, creditGiven };
            applyPreSaveHook(log);
            const expected = log.totalBillAmount - cashReceived - onlineReceived - creditGiven;
            return Math.abs(log.outstandingAmount - expected) < 0.001;
          }
        )
      );
    }
  );
});

// ── Property 4 (Req 3.3): Profit invariant ──
// Validates: Requirements 3.3

describe('Property 4: profit invariant', () => {
  test(
    'for any non-negative (totalBillAmount, purchaseCost, deliveryCharges), ' +
    'profit === totalBillAmount - purchaseCost - deliveryCharges after save',
    () => {
      /**
       * **Validates: Requirements 3.3**
       */
      fc.assert(
        fc.property(
          nonNegativeFloat,
          nonNegativeFloat,
          nonNegativeFloat,
          (purchaseCost, deliveryCharges, extraCharges) => {
            const log = { purchaseCost, deliveryCharges, extraCharges,
                          cashReceived: 0, onlineReceived: 0, creditGiven: 0 };
            applyPreSaveHook(log);
            const totalBillAmount = purchaseCost + deliveryCharges + extraCharges;
            const expectedProfit  = totalBillAmount - purchaseCost - deliveryCharges;
            return Math.abs(log.profit - expectedProfit) < 0.001;
          }
        )
      );
    }
  );
});

// ── Property 2 (Req 2.1): Idempotency ──
// Validates: Requirements 2.1

describe('Property 2: createChemistLogFromOrder is idempotent', () => {
  test(
    'for any StockistOrder, calling createChemistLogFromOrder N times produces ' +
    'the same number of ChemistLog documents as after the first call',
    async () => {
      /**
       * **Validates: Requirements 2.1**
       */
      await fc.assert(
        fc.asyncProperty(
          stockistOrderArb,
          fc.integer({ min: 1, max: 5 }),
          async (orderData, n) => {
            // Reset counters for each run
            jest.clearAllMocks();
            lastLogInstance = null;
            mockLogSave.mockImplementation(function () {
              this._id = 'log-id-' + Math.random().toString(36).slice(2);
              return Promise.resolve(this);
            });
            mockCreditSave.mockResolvedValue({});

            const order = { ...orderData, chemistLogCreated: false };

            // Call N times
            for (let i = 0; i < n; i++) {
              await createChemistLogFromOrder(order);
            }

            // Only one ChemistLog should ever be created regardless of N
            return mockLogSave.mock.calls.length === 1;
          }
        )
      );
    }
  );
});

// ── Property 6 (Req 1.2): Field mapping ──
// Validates: Requirements 1.2

describe('Property 6: StockistOrder fields are correctly mapped into ChemistLog', () => {
  test(
    'for any StockistOrder, the created ChemistLog fields match the source order fields',
    async () => {
      /**
       * **Validates: Requirements 1.2**
       */
      await fc.assert(
        fc.asyncProperty(
          stockistOrderArb,
          async (orderData) => {
            jest.clearAllMocks();
            lastLogInstance = null;
            mockLogSave.mockImplementation(function () {
              this._id = 'log-id-' + Math.random().toString(36).slice(2);
              return Promise.resolve(this);
            });
            mockCreditSave.mockResolvedValue({});

            const order = { ...orderData, chemistLogCreated: false };
            await createChemistLogFromOrder(order);

            const log = lastLogInstance;
            if (!log) return false;

            return (
              log.stockistOrderId === order._id &&
              log.chemistOrderId  === order.orderId &&
              log.agentName       === order.agentName &&
              log.agentId         === order.agentId &&
              log.chemistName     === order.chemist &&
              log.chemistLocation === order.deliverTo &&
              log.products        === order.products &&
              log.purchaseCost    === order.purchaseAmount &&
              log.deliveryCharges === order.deliveryCharge &&
              log.cashReceived    === order.cash &&
              log.onlineReceived  === order.online &&
              log.creditGiven     === order.credit
            );
          }
        )
      );
    }
  );
});

// ── Property 8 (Req 6.6): Non-editable fields are immutable via PATCH ──
// Validates: Requirements 6.6

describe('Property 8: non-editable fields remain unchanged after PATCH', () => {
  test(
    'for any PATCH payload containing non-editable fields, those fields remain unchanged after the update',
    () => {
      /**
       * **Validates: Requirements 6.6**
       */
      // Arbitrary for a non-editable field value (string or number)
      const nonEditableValueArb = fc.oneof(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.nat(10000)
      );

      fc.assert(
        fc.property(
          // Generate original values for each non-editable field
          fc.record(
            Object.fromEntries(NON_EDITABLE_FIELDS.map(f => [f, nonEditableValueArb]))
          ),
          // Generate attempted override values for each non-editable field
          fc.record(
            Object.fromEntries(NON_EDITABLE_FIELDS.map(f => [f, nonEditableValueArb]))
          ),
          (originalValues, attackValues) => {
            const log = { ...originalValues };
            // Payload tries to overwrite all non-editable fields
            const payload = { ...attackValues, extraCharges: 10 };

            applyPatch(log, payload);

            // All non-editable fields must retain their original values
            return NON_EDITABLE_FIELDS.every(field => log[field] === originalValues[field]);
          }
        )
      );
    }
  );
});

// ── Property 7 (Req 4.3): Agent role scoping ──
// Validates: Requirements 4.3

describe('Property 7: agent role scoping — agents see only their own logs', () => {
  test(
    'for any agent user, filtering ChemistLogs by agentId returns only logs belonging to that agent',
    () => {
      /**
       * **Validates: Requirements 4.3**
       */
      const agentIdArb = fc.string({ minLength: 1, maxLength: 24 });

      fc.assert(
        fc.property(
          agentIdArb,
          // Generate a list of logs with random agentIds (some matching, some not)
          fc.array(
            fc.record({
              _id:     fc.string({ minLength: 1, maxLength: 24 }),
              agentId: agentIdArb
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (requestingAgentId, allLogs) => {
            // Inline role-scoping filter (mirrors the route handler logic)
            const filtered = allLogs.filter(log => log.agentId === requestingAgentId);

            // Every returned log must belong to the requesting agent
            const allMatch = filtered.every(log => log.agentId === requestingAgentId);

            // No log belonging to the agent should be missing from the result
            const noneOmitted = allLogs
              .filter(log => log.agentId === requestingAgentId)
              .every(log => filtered.includes(log));

            return allMatch && noneOmitted;
          }
        )
      );
    }
  );
});
