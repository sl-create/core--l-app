import { describe, expect, it } from "vitest";
import { senderCancellationRefund, travellerCancellationRefund } from "./cancellation";
import { corridorFor } from "./locations";
import { ineligibilityReasons, rankMatches, type MatchableTrip } from "./matching";
import { milestonePayouts, unreleasedPayout } from "./milestones";
import { quote, serviceFeeFor } from "./pricing";
import { levelBonus, levelChecks, levelFor, visibleFrom, type TravellerStats } from "./levels";
import { claimWindowEndsAt, claimWindowHours } from "./urgency";

const now = new Date("2026-10-01T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
const hours = (n: number) => new Date(now.getTime() + n * 60 * 60 * 1000);

describe("claim windows", () => {
  it.each([
    [30, 72],
    [14, 72],
    [10, 48],
    [7, 48],
    [5, 24],
    [3, 24],
    [2, 12],
    [0.1, 12],
    [-1, 12],
  ])("%d days to deadline gives %d hours", (d, expected) => {
    expect(claimWindowHours(days(d), now)).toBe(expected);
  });

  it("computes the window end from the claim time", () => {
    expect(claimWindowEndsAt(days(10), now)).toEqual(hours(48));
  });
});

describe("pricing", () => {
  it("uses the corridor regardless of direction", () => {
    expect(corridorFor("LONDON", "LAGOS")).toEqual(corridorFor("LAGOS", "LONDON"));
  });

  it("applies service fee bands marginally", () => {
    expect(serviceFeeFor(4000)).toBe(600);
    expect(serviceFeeFor(8000)).toBe(750 + 360);
    expect(serviceFeeFor(12000)).toBe(750 + 600 + 200);
    expect(serviceFeeFor(1000)).toBe(300); // minimum
  });

  it("scales the traveller payout with urgency", () => {
    const standard = quote({ origin: "LAGOS", destination: "LONDON", deadline: days(20), now });
    const urgent = quote({ origin: "LAGOS", destination: "LONDON", deadline: days(2), now });
    expect(standard).toMatchObject({ currency: "gbp", urgency: "STANDARD", travellerPayout: 4000 });
    expect(urgent).toMatchObject({ urgency: "URGENT", travellerPayout: 8000 });
    expect(urgent.total).toBe(urgent.travellerPayout + urgent.serviceFee);
  });
});

describe("milestone payouts", () => {
  it("always sums to the payout", () => {
    for (const payout of [4000, 5001, 6875, 1]) {
      const parts = milestonePayouts(payout);
      expect(parts.PICKED_UP + parts.ARRIVED + parts.DELIVERED).toBe(payout);
    }
    expect(milestonePayouts(4000)).toEqual({ PICKED_UP: 1000, ARRIVED: 1000, DELIVERED: 2000 });
  });

  it("counts everything not yet confirmed as still in escrow", () => {
    expect(
      unreleasedPayout([
        { status: "CONFIRMED", payout: 1000 },
        { status: "DISPUTED", payout: 1000 },
        { status: "PENDING", payout: 2000 },
      ]),
    ).toBe(3000);
  });
});

describe("cancellation", () => {
  const base = { travellerPayout: 4000, serviceFee: 600, bookedAt: now };

  it("flexible: full refund until 24h before departure", () => {
    const b = { ...base, policy: "FLEXIBLE" as const, departureAt: days(2) };
    expect(senderCancellationRefund(b, now).total).toBe(4600);
    expect(senderCancellationRefund(b, hours(30)).total).toBe(2000);
  });

  it("moderate: full refund until 5 days before departure", () => {
    const b = { ...base, policy: "MODERATE" as const, departureAt: days(10) };
    expect(senderCancellationRefund(b, days(4)).total).toBe(4600);
    expect(senderCancellationRefund(b, days(6))).toMatchObject({
      travellerPayoutRefund: 2000,
      serviceFeeRefund: 0,
    });
  });

  it("strict: 48h grace only when booked 14+ days out", () => {
    const early = { ...base, policy: "STRICT" as const, departureAt: days(20) };
    expect(senderCancellationRefund(early, hours(47)).total).toBe(4600);
    expect(senderCancellationRefund(early, days(5)).total).toBe(2000);
    expect(senderCancellationRefund(early, days(15)).total).toBe(0);

    const late = { ...base, policy: "STRICT" as const, departureAt: days(10) };
    expect(senderCancellationRefund(late, hours(1)).total).toBe(2000);
  });

  it("traveller cancellation is always a full refund", () => {
    const b = { ...base, policy: "STRICT" as const, departureAt: hours(1) };
    expect(travellerCancellationRefund(b).total).toBe(4600);
  });
});

describe("matching", () => {
  const request = {
    origin: "LAGOS" as const,
    destination: "LONDON" as const,
    availableFrom: now,
    deadline: days(10),
    minLevel: "ARINRIN_AJO" as const,
  };
  const trip: MatchableTrip = {
    origin: "LAGOS",
    destination: "LONDON",
    departureAt: days(3),
    arrivalAt: days(3.5),
    capacityRemaining: 2,
    travellerLevel: "ARINRIN_AJO",
  };

  it("matches on route and dates", () => {
    expect(ineligibilityReasons(request, trip, now)).toEqual([]);
  });

  it("explains why a trip does not match", () => {
    expect(ineligibilityReasons(request, { ...trip, destination: "NEW_YORK" }, now)).toContain("ROUTE");
    expect(ineligibilityReasons(request, { ...trip, arrivalAt: days(9.5) }, now)).toContain(
      "ARRIVES_TOO_LATE",
    );
    expect(ineligibilityReasons(request, { ...trip, departureAt: hours(6) }, now)).toContain(
      "DEPARTS_TOO_SOON",
    );
    expect(
      ineligibilityReasons({ ...request, availableFrom: days(3) }, trip, now),
    ).toContain("DEPARTS_BEFORE_DOCUMENT_READY");
    expect(ineligibilityReasons(request, { ...trip, capacityRemaining: 0 }, now)).toContain("FULL");
    expect(ineligibilityReasons(request, { ...trip, travellerLevel: null }, now)).toContain(
      "NOT_VERIFIED",
    );
    expect(ineligibilityReasons({ ...request, minLevel: "ATONA" }, trip, now)).toContain("LEVEL");
    expect(
      ineligibilityReasons({ ...request, minLevel: "ATONA" }, { ...trip, travellerLevel: "AGBA" }, now),
    ).toEqual([]);
  });

  it("ranks by level, then earliest arrival", () => {
    const a = { ...trip, arrivalAt: days(4) };
    const b = { ...trip, arrivalAt: days(3.5) };
    const c = { ...trip, arrivalAt: days(5), travellerLevel: "OLOOOTO" as const };
    expect(rankMatches(request, [a, b, c], now)).toEqual([c, b, a]);
  });
});

describe("traveller levels", () => {
  const base: TravellerStats = {
    trustTier: "ID_VERIFIED",
    completedDeliveries: 0,
    onTimeDeliveries: 0,
    ratingCount: 0,
    ratingSum: 0,
    upheldDisputes: 0,
    travellerCancellations: 0,
    elderApproved: false,
  };
  const rated = (n: number, avg: number) => ({ ratingCount: n, ratingSum: n * avg });

  it("has no level until verified", () => {
    expect(levelFor({ ...base, trustTier: "UNVERIFIED", completedDeliveries: 50 })).toBeNull();
    expect(levelFor(base)).toBe("ARINRIN_AJO");
  });

  it("reaches Olóòótọ́ after 3 deliveries", () => {
    expect(levelFor({ ...base, completedDeliveries: 2 })).toBe("ARINRIN_AJO");
    expect(levelFor({ ...base, completedDeliveries: 3 })).toBe("OLOOOTO");
  });

  it("ignores ratings until there are enough of them", () => {
    expect(levelFor({ ...base, completedDeliveries: 3, ...rated(2, 3) })).toBe("OLOOOTO");
    expect(levelFor({ ...base, completedDeliveries: 3, ...rated(3, 3) })).toBe("ARINRIN_AJO");
  });

  it("needs on-time deliveries and a clean record for Atọ́nà", () => {
    const good = { ...base, completedDeliveries: 10, onTimeDeliveries: 10, ...rated(8, 4.9) };
    expect(levelFor(good)).toBe("ATONA");
    expect(levelFor({ ...good, onTimeDeliveries: 9 })).toBe("OLOOOTO"); // 90% < 95%
    expect(levelFor({ ...good, travellerCancellations: 1 })).toBe("OLOOOTO"); // 1/11 strikes > 5%
  });

  it("goes down as well as up", () => {
    const good = { ...base, completedDeliveries: 4, ...rated(4, 5) };
    expect(levelFor(good)).toBe("OLOOOTO");
    expect(levelFor({ ...good, upheldDisputes: 1 })).toBe("ARINRIN_AJO"); // 25% strikes
  });

  it("requires admin approval for Àgbà", () => {
    const elder = { ...base, completedDeliveries: 30, onTimeDeliveries: 30, ...rated(25, 4.9) };
    expect(levelFor(elder)).toBe("ATONA");
    expect(levelFor({ ...elder, elderApproved: true })).toBe("AGBA");
  });

  it("reports progress towards each requirement", () => {
    const checks = levelChecks("ATONA", { ...base, completedDeliveries: 5, onTimeDeliveries: 5 });
    expect(checks.find((c) => c.label === "Completed deliveries")).toMatchObject({
      met: false,
      progress: 0.5,
    });
    expect(checks.find((c) => c.label === "On time")?.met).toBe(true);
  });

  it("pays a share of the service fee as a bonus", () => {
    expect(levelBonus("ARINRIN_AJO", 600)).toBe(0);
    expect(levelBonus("OLOOOTO", 600)).toBe(120);
    expect(levelBonus("AGBA", 600)).toBe(300);
  });

  it("shows new requests to higher levels first", () => {
    expect(visibleFrom(now, "AGBA")).toEqual(now);
    expect(visibleFrom(now, "ARINRIN_AJO")).toEqual(hours(24));
  });
});
