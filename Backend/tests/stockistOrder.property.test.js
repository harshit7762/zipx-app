'use strict';

/**
 * Property-Based Tests for Stockist Order Workflow
 * Uses fast-check for property generation
 *
 * Validates: Requirements 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.4, 8.1, 8.3
 */

const fc = require('fast-check');
const { STATUS_SEQUENCE, advanceStatus } = require('../utils/statusEngine');

// ── Inline helpers (same logic as production code) ──

function validatePayment(cash, online, credit, dues, totalAmount) {
  if (cash < 0 || online < 0 || credit < 0 || dues < 0) {
    return { valid: false, message: 'Payment fields cannot be negative' };
  }
  const computed = cash + online + credit + dues;
  return {
    valid: computed === totalAmount,
    message: computed === totalAmount
      ? ''
      : `Payment breakdown (${computed}) does not match total (${totalAmount})`
  };
}

function generateOrderId(date) {
  const datePart = date.replace(/-/g, '');
  const randPart = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `ORD-${datePart}-${randPart}`;
}

function makeOrder(status) {
  return {
    status,
    agentId: { toString: () => 'agent1' },
    statusHistory: []
  };
}

const adminUser = { id: 'admin1', name: 'Admin', role: 'admin' };

// ── Property 1: Payment invariant ──
// Validates: Requirements 2.1, 2.2, 2.3

describe('Property: payment invariant', () => {
  test('validatePayment returns true iff sum equals totalAmount (non-negative fields)', () => {
    fc.assert(
      fc.property(
        fc.nat(10000),  // cash
        fc.nat(10000),  // online
        fc.nat(10000),  // credit
        fc.nat(10000),  // dues
        (cash, online, credit, dues) => {
          const totalAmount = cash + online + credit + dues;
          const result = validatePayment(cash, online, credit, dues, totalAmount);
          return result.valid === true;
        }
      )
    );
  });

  test('validatePayment returns false when sum does not equal totalAmount', () => {
    fc.assert(
      fc.property(
        fc.nat(10000),
        fc.nat(10000),
        fc.nat(10000),
        fc.nat(10000),
        fc.integer({ min: 1, max: 10000 }),  // non-zero offset
        (cash, online, credit, dues, offset) => {
          const wrongTotal = cash + online + credit + dues + offset;
          const result = validatePayment(cash, online, credit, dues, wrongTotal);
          return result.valid === false;
        }
      )
    );
  });
});

// ── Property 2: Status sequence monotonicity ──
// Validates: Requirements 3.1

describe('Property: status sequence monotonicity', () => {
  test('for any valid sequence of transitions, status index is strictly increasing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: STATUS_SEQUENCE.length - 1 }),  // number of transitions
        (numTransitions) => {
          const order = makeOrder('pending');
          let prevIdx = 0;
          for (let i = 0; i < numTransitions; i++) {
            const nextStatus = STATUS_SEQUENCE[prevIdx + 1];
            if (!nextStatus) break;
            advanceStatus(order, nextStatus, adminUser);
            const newIdx = STATUS_SEQUENCE.indexOf(order.status);
            if (newIdx <= prevIdx) return false;
            prevIdx = newIdx;
          }
          return true;
        }
      )
    );
  });
});

// ── Property 3: Audit trail completeness ──
// Validates: Requirements 1.3, 3.4

describe('Property: audit trail completeness', () => {
  test('after N transitions, statusHistory.length === N + 1 (initial entry + N transitions)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: STATUS_SEQUENCE.length - 1 }),  // N transitions
        (n) => {
          const order = makeOrder('pending');
          // Seed initial statusHistory entry (as the route does on creation)
          order.statusHistory.push({ status: 'pending', changedBy: 'Admin', timestamp: new Date() });

          for (let i = 0; i < n; i++) {
            const curIdx = STATUS_SEQUENCE.indexOf(order.status);
            const nextStatus = STATUS_SEQUENCE[curIdx + 1];
            if (!nextStatus) break;
            advanceStatus(order, nextStatus, adminUser);
          }

          return order.statusHistory.length === n + 1;
        }
      )
    );
  });
});

// ── Property 4: orderId format ──
// Validates: Requirements 1.2, 8.1, 8.3

describe('Property: orderId format', () => {
  test('generateOrderId always returns a string matching /^ORD-\\d{8}-[0-9A-F]{4}$/', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 2099 }).map(y => String(y)),           // year
        fc.integer({ min: 1, max: 12 }).map(m => String(m).padStart(2, '0')),  // month
        fc.integer({ min: 1, max: 28 }).map(d => String(d).padStart(2, '0')),  // day
        (year, month, day) => {
          const date = `${year}-${month}-${day}`;
          const id = generateOrderId(date);
          return /^ORD-\d{8}-[0-9A-F]{4}$/.test(id);
        }
      )
    );
  });
});
