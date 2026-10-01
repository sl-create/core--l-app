export const TRUST_TIERS = ["UNVERIFIED", "ID_VERIFIED"] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

export const TRUST_TIER_LABELS: Record<TrustTier, string> = {
  UNVERIFIED: "Unverified",
  ID_VERIFIED: "ID Verified",
};

export const TRUST_TIER_DESCRIPTIONS: Record<TrustTier, string> = {
  UNVERIFIED: "Email confirmed. Can post requests but cannot carry documents.",
  ID_VERIFIED: "Government ID and selfie checked (KYC). Can carry documents.",
};

/** Verification is the safety gate. Traveller levels (levels.ts) reward a good track record. */
export const canCarry = (tier: TrustTier) => tier === "ID_VERIFIED";
