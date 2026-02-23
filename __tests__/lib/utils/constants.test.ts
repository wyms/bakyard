import { COLORS, MEMBERSHIP_TIERS } from '@/lib/utils/constants';
import type { MembershipTierConfig } from '@/lib/utils/constants';

describe('constants', () => {
  // ---------------------------------------------------------------
  // COLORS
  // ---------------------------------------------------------------
  describe('COLORS', () => {
    const expectedKeys = [
      'PRIMARY',
      'SECONDARY',
      'BACKGROUND',
      'SURFACE',
      'TEXT',
      'SUCCESS',
      'ACCENT',
      'ERROR',
      'WHITE',
      'BORDER',
      'TEXT_SECONDARY',
      'MUTED',
    ];

    it('has all expected color keys', () => {
      for (const key of expectedKeys) {
        expect(COLORS).toHaveProperty(key);
      }
    });

    it('has exactly the expected number of keys', () => {
      expect(Object.keys(COLORS)).toHaveLength(expectedKeys.length);
    });

    it('has valid color strings for every value', () => {
      const colorRegex = /^(#[0-9A-Fa-f]{6}|rgba?\(.+\))$/;
      for (const key of Object.keys(COLORS)) {
        expect(COLORS[key as keyof typeof COLORS]).toMatch(colorRegex);
      }
    });

    it('has the correct primary color', () => {
      expect(COLORS.PRIMARY).toBe('#E8C97A');
    });

    it('has the correct secondary color', () => {
      expect(COLORS.SECONDARY).toBe('#C8A84B');
    });

    it('has white as #FFFFFF', () => {
      expect(COLORS.WHITE).toBe('#FFFFFF');
    });
  });

  // ---------------------------------------------------------------
  // MEMBERSHIP_TIERS
  // ---------------------------------------------------------------
  describe('MEMBERSHIP_TIERS', () => {
    it('contains exactly 3 tiers', () => {
      expect(MEMBERSHIP_TIERS).toHaveLength(3);
    });

    it('has tiers ordered by price ascending', () => {
      const prices = MEMBERSHIP_TIERS.map((t) => t.price_cents);
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThan(prices[i - 1]);
      }
    });

    it('has discount_percent increasing with each tier', () => {
      const discounts = MEMBERSHIP_TIERS.map((t) => t.discount_percent);
      for (let i = 1; i < discounts.length; i++) {
        expect(discounts[i]).toBeGreaterThan(discounts[i - 1]);
      }
    });

    it('has priority_hours increasing with each tier', () => {
      const hours = MEMBERSHIP_TIERS.map((t) => t.priority_hours);
      for (let i = 1; i < hours.length; i++) {
        expect(hours[i]).toBeGreaterThan(hours[i - 1]);
      }
    });

    it('has all required fields on every tier', () => {
      const requiredFields: (keyof MembershipTierConfig)[] = [
        'tier',
        'name',
        'price_cents',
        'interval',
        'discount_percent',
        'priority_hours',
        'benefits',
      ];

      for (const tierConfig of MEMBERSHIP_TIERS) {
        for (const field of requiredFields) {
          expect(tierConfig).toHaveProperty(field);
        }
      }
    });

    it('has the interval set to "month" for every tier', () => {
      for (const tierConfig of MEMBERSHIP_TIERS) {
        expect(tierConfig.interval).toBe('month');
      }
    });

    it('has a non-empty benefits array for every tier', () => {
      for (const tierConfig of MEMBERSHIP_TIERS) {
        expect(Array.isArray(tierConfig.benefits)).toBe(true);
        expect(tierConfig.benefits.length).toBeGreaterThan(0);
      }
    });

    it('contains the expected tier identifiers', () => {
      const tierIds = MEMBERSHIP_TIERS.map((t) => t.tier);
      expect(tierIds).toEqual(['local_player', 'sand_regular', 'founders']);
    });

    it('has the correct prices for each tier', () => {
      expect(MEMBERSHIP_TIERS[0].price_cents).toBe(4900);
      expect(MEMBERSHIP_TIERS[1].price_cents).toBe(9900);
      expect(MEMBERSHIP_TIERS[2].price_cents).toBe(19900);
    });

    it('has positive price_cents for all tiers', () => {
      for (const tierConfig of MEMBERSHIP_TIERS) {
        expect(tierConfig.price_cents).toBeGreaterThan(0);
      }
    });
  });
});
