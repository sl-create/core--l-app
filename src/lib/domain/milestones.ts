export const MILESTONE_TYPES = ["PICKED_UP", "ARRIVED", "DELIVERED"] as const;
export type MilestoneType = (typeof MILESTONE_TYPES)[number];

export const MILESTONE_LABELS: Record<MilestoneType, string> = {
  PICKED_UP: "Document handed to traveller",
  ARRIVED: "Traveller landed at destination",
  DELIVERED: "Document delivered to recipient",
};

/** The share of the traveller payout released from escrow when each milestone is confirmed. */
export const MILESTONE_SHARES: Record<MilestoneType, number> = {
  PICKED_UP: 0.25,
  ARRIVED: 0.25,
  DELIVERED: 0.5,
};

/**
 * Splits the traveller payout across milestones. The final milestone absorbs
 * rounding, so the parts always add up to the payout exactly.
 */
export function milestonePayouts(travellerPayout: number): Record<MilestoneType, number> {
  const result = {} as Record<MilestoneType, number>;
  let allocated = 0;
  MILESTONE_TYPES.forEach((type, i) => {
    const isLast = i === MILESTONE_TYPES.length - 1;
    const amount = isLast
      ? travellerPayout - allocated
      : Math.floor(travellerPayout * MILESTONE_SHARES[type]);
    result[type] = amount;
    allocated += amount;
  });
  return result;
}

/** Traveller money not yet released, meaning every milestone that is not confirmed. */
export function unreleasedPayout(milestones: { status: string; payout: number }[]): number {
  return milestones.filter((m) => m.status !== "CONFIRMED").reduce((sum, m) => sum + m.payout, 0);
}
