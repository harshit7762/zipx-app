'use strict';

// Standalone validation function mirroring the pre-save hook logic in StockistOrder.js
function validatePayment(cash, online, credit, dues, totalAmount) {
  if (cash < 0 || online < 0 || credit < 0 || dues < 0) {
    return { valid: false, message: 'Payment fields cannot be negative' };
  }
  const computed = cash + online + credit + dues;
  if (computed !== totalAmount) {
    return {
      valid: false,
      message: `Payment breakdown (${computed}) does not match total (${totalAmount})`
    };
  }
  return { valid: true, message: '' };
}

describe('validatePayment', () => {
  test('valid: 100+200+50+50 === 400', () => {
    const result = validatePayment(100, 200, 50, 50, 400);
    expect(result.valid).toBe(true);
  });

  test('valid: all zeros === 0', () => {
    const result = validatePayment(0, 0, 0, 0, 0);
    expect(result.valid).toBe(true);
  });

  test('mismatch: 100+200+50+50 !== 500 → invalid with message', () => {
    const result = validatePayment(100, 200, 50, 50, 500);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/400.*500|does not match/i);
  });

  test('negative cash: -10+200+50+50 → invalid', () => {
    const result = validatePayment(-10, 200, 50, 50, 290);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/negative/i);
  });

  test('negative credit: 100+200+(-50)+50 → invalid', () => {
    const result = validatePayment(100, 200, -50, 50, 300);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/negative/i);
  });

  test('all zeros but total is 100 → invalid', () => {
    const result = validatePayment(0, 0, 0, 0, 100);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/0.*100|does not match/i);
  });
});
