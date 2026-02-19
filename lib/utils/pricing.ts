/**
 * Format a price in cents to a display string.
 * e.g. 2500 -> "$25.00"
 */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

/**
 * Calculate the discounted price in cents.
 * e.g. calculateDiscount(10000, 20) -> 8000
 */
export function calculateDiscount(
  cents: number,
  discountPercent: number
): number {
  const discount = Math.round(cents * (discountPercent / 100));
  return cents - discount;
}

/**
 * Apply a pricing multiplier to a base price in cents.
 * Useful for peak/off-peak dynamic pricing.
 * e.g. applyPricingRule(8000, 1.5) -> 12000
 */
export function applyPricingRule(
  baseCents: number,
  multiplier: number
): number {
  return Math.round(baseCents * multiplier);
}
