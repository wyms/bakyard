import { formatPrice, calculateDiscount, applyPricingRule } from '@/lib/utils/pricing';

describe('pricing utilities', () => {
  // ---------------------------------------------------------------
  // formatPrice
  // ---------------------------------------------------------------
  describe('formatPrice', () => {
    it('formats zero cents as $0.00', () => {
      expect(formatPrice(0)).toBe('$0.00');
    });

    it('formats small amounts below one dollar', () => {
      expect(formatPrice(99)).toBe('$0.99');
    });

    it('formats a standard amount in whole dollars', () => {
      expect(formatPrice(2500)).toBe('$25.00');
    });

    it('formats a standard amount with cents', () => {
      expect(formatPrice(1999)).toBe('$19.99');
    });

    it('formats large amounts', () => {
      expect(formatPrice(100000)).toBe('$1000.00');
    });

    it('formats negative amounts with a minus sign', () => {
      expect(formatPrice(-500)).toBe('$-5.00');
    });

    it('formats single cent correctly', () => {
      expect(formatPrice(1)).toBe('$0.01');
    });
  });

  // ---------------------------------------------------------------
  // calculateDiscount
  // ---------------------------------------------------------------
  describe('calculateDiscount', () => {
    it('returns the original price when discount is 0%', () => {
      expect(calculateDiscount(10000, 0)).toBe(10000);
    });

    it('applies a 10% discount', () => {
      expect(calculateDiscount(10000, 10)).toBe(9000);
    });

    it('applies a 20% discount', () => {
      expect(calculateDiscount(10000, 20)).toBe(8000);
    });

    it('applies a 50% discount', () => {
      expect(calculateDiscount(10000, 50)).toBe(5000);
    });

    it('applies a 100% discount resulting in zero', () => {
      expect(calculateDiscount(10000, 100)).toBe(0);
    });

    it('rounds correctly with odd cents and odd percentages', () => {
      // 333 * (15 / 100) = 49.95 -> Math.round -> 50
      // 333 - 50 = 283
      expect(calculateDiscount(333, 15)).toBe(283);
    });

    it('rounds correctly for another edge case', () => {
      // 1001 * (33 / 100) = 330.33 -> Math.round -> 330
      // 1001 - 330 = 671
      expect(calculateDiscount(1001, 33)).toBe(671);
    });

    it('handles discount on 1 cent', () => {
      // 1 * (50 / 100) = 0.5 -> Math.round -> 1 (rounds to even: 1)
      // 1 - 1 = 0
      expect(calculateDiscount(1, 50)).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // applyPricingRule
  // ---------------------------------------------------------------
  describe('applyPricingRule', () => {
    it('returns the same price with a 1.0 multiplier', () => {
      expect(applyPricingRule(8000, 1.0)).toBe(8000);
    });

    it('applies a 1.5x multiplier', () => {
      expect(applyPricingRule(8000, 1.5)).toBe(12000);
    });

    it('applies a 0.5x multiplier (half price)', () => {
      expect(applyPricingRule(8000, 0.5)).toBe(4000);
    });

    it('applies a 2.0x multiplier', () => {
      expect(applyPricingRule(8000, 2.0)).toBe(16000);
    });

    it('rounds the result for non-integer products', () => {
      // 333 * 1.33 = 442.89 -> Math.round -> 443
      expect(applyPricingRule(333, 1.33)).toBe(443);
    });

    it('returns 0 when base price is 0', () => {
      expect(applyPricingRule(0, 1.5)).toBe(0);
    });

    it('returns 0 when multiplier is 0', () => {
      expect(applyPricingRule(8000, 0)).toBe(0);
    });
  });
});
