export const TRUST_TIERS = ["UNVERIFIED", "ID_VERIFIED", "AJO_VERIFIED"] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

export const TRUST_TIER_LABELS: Record<TrustTier, string> = {
  UNVERIFIED: "Unverified",
  ID_VERIFIED: "ID Verified",
  AJO_VERIFIED: "Ajo Verified",
};

export const TRUST_TIER_DESCRIPTIONS: Record<TrustTier, string> = {
  UNVERIFIED: "Email confirmed. Can post requests but cannot carry documents.",
  ID_VERIFIED: "Government ID and selfie checked (KYC). Can carry documents.",
  AJO_VERIFIED:
    "ID verified, plus 3 or more completed deliveries with no upheld disputes. Can carry any document.",
};

export const AJO_VERIFIED_MIN_DELIVERIES = 3;

export function tierRank(tier: TrustTier): number {
  return TRUST_TIERS.indexOf(tier);
}

export function meetsTier(actual: TrustTier, required: TrustTier): boolean {
  return tierRank(actual) >= tierRank(required);
}

/** The minimum tier a traveller needs before they can carry documents at all. */
export const MIN_TRAVELLER_TIER: TrustTier = "ID_VERIFIED";

/**
 * Promotes an ID-verified traveller to Ajo Verified once they have a clean
 * delivery record. It never demotes: removing a tier is a manual trust & safety action.
 */
export function earnedTier(
  current: TrustTier,
  stats: { completedDeliveries: number; upheldDisputes: number },
): TrustTier {
  if (
    current === "ID_VERIFIED" &&
    stats.completedDeliveries >= AJO_VERIFIED_MIN_DELIVERIES &&
    stats.upheldDisputes === 0
  ) {
    return "AJO_VERIFIED";
  }
  return current;
}
