'use strict';

// Standalone function mirroring the pre-save hook logic in StockistOrder.js
function generateOrderId(date) {
  const datePart = date.replace(/-/g, '');
  const randPart = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0');
  return `ORD-${datePart}-${randPart}`;
}

describe('generateOrderId', () => {
  test('result matches /^ORD-\\d{8}-[0-9A-F]{4}$/', () => {
    const id = generateOrderId('2025-01-15');
    expect(id).toMatch(/^ORD-\d{8}-[0-9A-F]{4}$/);
  });

  test("date part for '2025-01-15' is '20250115'", () => {
    // Run several times to confirm the date part is always correct
    for (let i = 0; i < 10; i++) {
      const id = generateOrderId('2025-01-15');
      expect(id.startsWith('ORD-20250115-')).toBe(true);
    }
  });

  test('multiple calls produce at least 2 unique values (probabilistic)', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateOrderId('2025-06-01'));
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  test("edge: '2025-12-31' produces 'ORD-20251231-XXXX' format", () => {
    const id = generateOrderId('2025-12-31');
    expect(id).toMatch(/^ORD-20251231-[0-9A-F]{4}$/);
  });
});
