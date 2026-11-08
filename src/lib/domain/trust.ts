export const TRUST_TIERS = ["UNVERIFIED", "ID_VERIFIED"] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

export const TRUST_TIER_LABELS: Record<TrustTier, string> = {
  UNVERIFIED: "Unverified",
  ID_VERIFIED: "ID Verified",
};

/** The verification checklist on the account page: one step per tier, ticked once reached. */
export const TRUST_TIER_STEPS: Record<TrustTier, { label: string; description: string }> = {
  UNVERIFIED: { label: "Email confirmed", description: "Can post requests to send documents." },
  ID_VERIFIED: {
    label: "ID verified",
    description: "Government ID and selfie checked (KYC). Can carry documents.",
  },
};

/** Verification is the safety gate. Traveller levels (levels.ts) reward a good track record. */
export const canCarry = (tier: TrustTier) => tier === "ID_VERIFIED";
