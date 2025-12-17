/**
 * Stripe Price ID mapping
 *
 * Goal: make Stripe Products/Prices the source of truth for amounts/currency.
 *
 * We map portal `featureType` -> Stripe `price_...` via environment variables:
 * - STRIPE_PRICE_MANUSCRIPT_REPORT=price_...
 * - STRIPE_PRICE_DNA_REPORT=price_...
 * - STRIPE_PRICE_MARKET_VALIDATION_REPORT=price_...
 * - STRIPE_PRICE_MARKET_READY_PACK=price_...
 *
 * (and optionally other feature types)
 */
export type FeatureType =
  | "summary"
  | "manuscript-report"
  | "dna-report"
  | "market-validation-report"
  | "market-ready-pack"
  | "growth-partnership"
  | "marketing-assets"
  | "book-covers"
  | "landing-page"
  | "book-upload";

export function featureTypeToPriceEnvVar(featureType: string): string {
  return `STRIPE_PRICE_${featureType.toUpperCase().replace(/-/g, "_")}`;
}

export function getStripePriceIdForFeature(featureType: FeatureType): string | undefined {
  // We don't sell a standalone "manuscript-report" SKU right now; it's an entitlement.
  // If callers still request manuscript-report checkout, charge the Market-Ready Pack price.
  const effectiveFeatureType = featureType === "manuscript-report" ? "market-ready-pack" : featureType;

  const key = featureTypeToPriceEnvVar(effectiveFeatureType);
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}


