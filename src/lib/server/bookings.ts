import "server-only";
import type { BookingStatus, Prisma } from "@prisma/client";
import { senderCancellationRefund, travellerCancellationRefund } from "@/lib/domain/cancellation";
import { DOCUMENT_LABELS } from "@/lib/domain/documents";
import { formatMoney, LOCATION_LABELS, type Currency } from "@/lib/domain/locations";
import { ineligibilityReasons } from "@/lib/domain/matching";
import { MILESTONE_LABELS, MILESTONE_TYPES, milestonePayouts } from "@/lib/domain/milestones";
import { quote } from "@/lib/domain/pricing";
import { earnedTier } from "@/lib/domain/trust";
import { claimWindowEndsAt } from "@/lib/domain/urgency";
import { db } from "./db";
import {
  createCheckout,
  paymentsSimulated,
  refundSender,
  releaseMilestoneFunds,
  transferToTraveller,
} from "./escrow";
import { ActionError, assert } from "./errors";
import { postSystemMessage } from "./messages";
import { formatUtc } from "@/lib/format";

/** Bookings in these states hold a seat on the trip. */
export const SEAT_HOLDING: BookingStatus[] = ["ACCEPTED", "FUNDED", "COMPLETED", "DISPUTED"];
/** A request can have at most one booking in these states. */
const ACTIVE: BookingStatus[] = ["PROPOSED", "ACCEPTED", "FUNDED", "DISPUTED"];

export async function seatsTaken(tripId: string, tx: Prisma.TransactionClient = db) {
  return tx.booking.count({ where: { tripId, status: { in: SEAT_HOLDING } } });
}

const withParties = {
  request: { include: { sender: true } },
  trip: { include: { traveller: true } },
  milestones: { orderBy: { sequence: "asc" } },
} satisfies Prisma.BookingInclude;

async function parties(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: {
      currency: true,
      request: { select: { sender: true } },
      trip: { select: { traveller: true } },
    },
  });
  const money = (amount: number) => formatMoney(amount, b.currency as Currency);
  return { sender: b.request.sender, traveller: b.trip.traveller, money };
}

async function loadBooking(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: withParties });
  assert(booking, "Booking not found");
  return booking;
}

export async function proposeBooking(senderId: string, requestId: string, tripId: string) {
  const booking = await db.$transaction(async (tx) => {
    const request = await tx.deliveryRequest.findUnique({ where: { id: requestId } });
    assert(request && request.senderId === senderId, "Request not found");
    assert(request.status === "OPEN", "This request is no longer open");
    const active = await tx.booking.count({ where: { requestId, status: { in: ACTIVE } } });
    assert(active === 0, "This request already has an active booking");

    const trip = await tx.trip.findUnique({ where: { id: tripId }, include: { traveller: true } });
    assert(trip && trip.status === "OPEN" && !trip.traveller.suspendedAt, "Trip not available");
    assert(trip.travellerId !== senderId, "You cannot book your own trip");

    const reasons = ineligibilityReasons(request, {
      ...trip,
      capacityRemaining: trip.capacity - (await seatsTaken(tripId, tx)),
      travellerTier: trip.traveller.trustTier,
    });
    assert(reasons.length === 0, `This trip does not match your request (${reasons.join(", ")})`);

    const q = quote(request);
    return tx.booking.create({
      data: {
        requestId,
        tripId,
        currency: q.currency,
        urgency: q.urgency,
        travellerPayout: q.travellerPayout,
        serviceFee: q.serviceFee,
        total: q.total,
        cancellationPolicy: trip.cancellationPolicy,
      },
    });
  });
  const { sender, traveller, money } = await parties(booking.id);
  await postSystemMessage(
    booking.id,
    `${sender.name} asked ${traveller.name} to carry this document for ${money(booking.travellerPayout)}.`,
    { userIds: [traveller.id], subject: `New booking request from ${sender.name}` },
  );
  return booking;
}

export async function acceptBooking(travellerId: string, bookingId: string) {
  const booking = await loadBooking(bookingId);
  assert(booking.trip.travellerId === travellerId, "Booking not found");
  assert(booking.status === "PROPOSED", "This booking can no longer be accepted");
  assert(
    paymentsSimulated() || booking.trip.traveller.stripeAccountId,
    "Set up payouts on your account page before accepting bookings",
  );
  await db.$transaction(async (tx) => {
    // Re-check the match, since trust tier or capacity may have changed since the proposal.
    const reasons = ineligibilityReasons(booking.request, {
      ...booking.trip,
      capacityRemaining: booking.trip.capacity - (await seatsTaken(booking.tripId, tx)),
      travellerTier: booking.trip.traveller.trustTier,
    });
    assert(reasons.length === 0, `This booking no longer matches (${reasons.join(", ")})`);
    const { count } = await tx.booking.updateMany({
      where: { id: bookingId, status: "PROPOSED" },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    assert(count === 1, "This booking can no longer be accepted");
  });
  const { sender, traveller } = await parties(bookingId);
  await postSystemMessage(
    bookingId,
    `${traveller.name} accepted. Waiting for ${sender.name} to pay.`,
    { userIds: [sender.id], subject: `${traveller.name} accepted your booking` },
  );
}

export async function declineBooking(travellerId: string, bookingId: string) {
  const { count } = await db.booking.updateMany({
    where: { id: bookingId, status: "PROPOSED", trip: { travellerId } },
    data: { status: "DECLINED" },
  });
  assert(count === 1, "This booking can no longer be declined");
  const { sender, traveller } = await parties(bookingId);
  await postSystemMessage(bookingId, `${traveller.name} declined this request.`, {
    userIds: [sender.id],
    subject: `${traveller.name} declined your booking`,
  });
}

/** Starts payment. Returns a URL to redirect to, or null once a simulated payment is funded. */
export async function startPayment(senderId: string, bookingId: string): Promise<string | null> {
  const booking = await loadBooking(bookingId);
  assert(booking.request.senderId === senderId, "Booking not found");
  assert(booking.status === "ACCEPTED", "This booking is not waiting for payment");
  const { request } = booking;
  const result = await createCheckout(
    booking,
    `Ajo: ${DOCUMENT_LABELS[request.documentType]}, ${LOCATION_LABELS[request.origin]} → ${LOCATION_LABELS[request.destination]}`,
  );
  if ("url" in result) return result.url;
  await markFunded(bookingId, result.simulatedPaymentIntentId);
  return null;
}

/**
 * Called once payment succeeds. Safe to call more than once. Returns false when
 * the booking can no longer be funded (for example, it was cancelled while the
 * checkout page was open). The caller must then refund the payment.
 */
export async function markFunded(bookingId: string, paymentIntentId: string): Promise<boolean> {
  const result = await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return "invalid";
    if (booking.status !== "ACCEPTED") {
      return booking.paymentIntentId === paymentIntentId ? "already" : "invalid";
    }
    const payouts = milestonePayouts(booking.travellerPayout);
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "FUNDED",
        paymentIntentId,
        fundedAt: new Date(),
        milestones: {
          create: MILESTONE_TYPES.map((type, i) => ({ type, sequence: i, payout: payouts[type] })),
        },
      },
    });
    await tx.deliveryRequest.update({
      where: { id: booking.requestId },
      data: { status: "BOOKED" },
    });
    return "funded";
  });
  if (result === "funded") {
    const { sender, traveller } = await parties(bookingId);
    await postSystemMessage(
      bookingId,
      `Payment received and held in escrow. ${traveller.name}, use this thread to arrange the handover with ${sender.name}.`,
      { userIds: [traveller.id], subject: "Booking paid: arrange the handover" },
    );
  }
  return result !== "invalid";
}

export async function claimMilestone(travellerId: string, milestoneId: string, note?: string) {
  const milestone = await db.milestone.findUnique({
    where: { id: milestoneId },
    include: { booking: { include: { trip: true, request: true, milestones: true } } },
  });
  assert(milestone && milestone.booking.trip.travellerId === travellerId, "Milestone not found");
  assert(milestone.booking.status === "FUNDED", "This booking is not in progress");
  assert(milestone.status === "PENDING", "This milestone has already been claimed");
  const earlierPending = milestone.booking.milestones.some(
    (m) => m.sequence < milestone.sequence && m.status === "PENDING",
  );
  assert(!earlierPending, "Claim the earlier milestones first");

  const now = new Date();
  const claimExpiresAt = claimWindowEndsAt(milestone.booking.request.deadline, now);
  const { count } = await db.milestone.updateMany({
    where: { id: milestoneId, status: "PENDING" },
    data: { status: "CLAIMED", note: note || null, claimedAt: now, claimExpiresAt },
  });
  assert(count === 1, "This milestone has already been claimed");
  const { sender, traveller } = await parties(milestone.bookingId);
  const label = MILESTONE_LABELS[milestone.type];
  await postSystemMessage(
    milestone.bookingId,
    `${traveller.name} marked "${label}" as done${note ? ` ("${note}")` : ""}. ${sender.name}, please confirm or dispute by ${formatUtc(claimExpiresAt)}, or it confirms automatically.`,
    { userIds: [sender.id], subject: `Please confirm: ${label}` },
  );
}

export async function confirmMilestone(senderId: string, milestoneId: string) {
  const milestone = await db.milestone.findUnique({
    where: { id: milestoneId },
    include: { booking: { include: { request: true } } },
  });
  assert(milestone && milestone.booking.request.senderId === senderId, "Milestone not found");
  assert(milestone.status === "CLAIMED", "This milestone is not waiting for confirmation");
  await releaseMilestone(milestoneId, "sender");
}

export async function disputeMilestone(senderId: string, milestoneId: string, reason: string) {
  const milestone = await db.milestone.findUnique({
    where: { id: milestoneId },
    include: { booking: { include: { request: true } } },
  });
  assert(milestone && milestone.booking.request.senderId === senderId, "Milestone not found");
  assert(reason.trim().length > 0, "Tell us what went wrong");
  const dispute = await db.$transaction(async (tx) => {
    const { count } = await tx.milestone.updateMany({
      where: { id: milestoneId, status: "CLAIMED" },
      data: { status: "DISPUTED" },
    });
    assert(count === 1, "This milestone is not waiting for confirmation");
    await tx.booking.update({ where: { id: milestone.bookingId }, data: { status: "DISPUTED" } });
    return tx.dispute.create({
      data: {
        bookingId: milestone.bookingId,
        milestoneId,
        openedById: senderId,
        reason: reason.trim(),
      },
    });
  });
  const { sender, traveller } = await parties(milestone.bookingId);
  await postSystemMessage(
    milestone.bookingId,
    `${sender.name} disputed "${MILESTONE_LABELS[milestone.type]}": "${dispute.reason}". Payments are paused while the Ajo team reviews. You can both add details here.`,
    { userIds: [traveller.id], subject: "A milestone on your booking was disputed" },
  );
  return dispute;
}

/**
 * Confirms a claimed milestone and pays out its share. The status change is
 * committed first, so money is never released twice. If the transfer fails,
 * `retryFailedTransfers` picks it up.
 */
async function releaseMilestone(milestoneId: string, by: "sender" | "timer") {
  const { count } = await db.milestone.updateMany({
    where: { id: milestoneId, status: "CLAIMED" },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  if (count === 0) return;
  await payOut(milestoneId);
  const milestone = await db.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
  const { traveller, money } = await parties(milestone.bookingId);
  await postSystemMessage(
    milestone.bookingId,
    `"${MILESTONE_LABELS[milestone.type]}" confirmed${by === "timer" ? " automatically after the claim window ended" : ""}. ${money(milestone.payout)} released to ${traveller.name}.`,
    { userIds: [traveller.id], subject: `Payment released: ${money(milestone.payout)}` },
  );
  await completeIfDone(milestoneId);
}

export async function payOut(milestoneId: string) {
  const milestone = await db.milestone.findUniqueOrThrow({
    where: { id: milestoneId },
    include: { booking: { include: { trip: { include: { traveller: true } } } } },
  });
  if (milestone.transferId) return;
  try {
    const transferId = await releaseMilestoneFunds(
      milestone.booking,
      milestone,
      milestone.booking.trip.traveller.stripeAccountId,
    );
    await db.milestone.update({ where: { id: milestoneId }, data: { transferId } });
  } catch (err) {
    console.error(`Payout for milestone ${milestoneId} failed`, err);
  }
}

export async function completeIfDone(milestoneId: string) {
  const { bookingId } = await db.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
  const completed = await db.$transaction(async (tx) => {
    const remaining = await tx.milestone.count({
      where: { bookingId, status: { not: "CONFIRMED" } },
    });
    if (remaining > 0) return false;
    const { count } = await tx.booking.updateMany({
      where: { id: bookingId, status: "FUNDED" },
      data: { status: "COMPLETED" },
    });
    if (count === 0) return false;
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { trip: { include: { traveller: true } } },
    });
    await tx.deliveryRequest.update({
      where: { id: booking.requestId },
      data: { status: "DELIVERED" },
    });
    const traveller = booking.trip.traveller;
    const completedDeliveries = traveller.completedDeliveries + 1;
    await tx.user.update({
      where: { id: traveller.id },
      data: {
        completedDeliveries,
        trustTier: earnedTier(traveller.trustTier, {
          completedDeliveries,
          upheldDisputes: traveller.upheldDisputes,
        }),
      },
    });
    return true;
  });
  if (completed) {
    const { sender, traveller } = await parties(bookingId);
    await postSystemMessage(bookingId, "Delivery complete. Thank you both for using Ajo!", {
      userIds: [sender.id, traveller.id],
      subject: "Delivery complete",
    });
  }
}

/** Auto-confirms claims whose window has lapsed. Run on a schedule. */
export async function releaseExpiredClaims(now: Date = new Date()) {
  const expired = await db.milestone.findMany({
    where: { status: "CLAIMED", claimExpiresAt: { lte: now }, booking: { status: "FUNDED" } },
    select: { id: true },
  });
  for (const { id } of expired) await releaseMilestone(id, "timer");
  return expired.length;
}

export async function retryFailedTransfers() {
  const pending = await db.milestone.findMany({
    where: { status: "CONFIRMED", transferId: null },
    select: { id: true },
  });
  for (const { id } of pending) await payOut(id);
  return pending.length;
}

export async function cancelBooking(userId: string, bookingId: string) {
  const booking = await loadBooking(bookingId);
  const isSender = booking.request.senderId === userId;
  const isTraveller = booking.trip.travellerId === userId;
  assert(isSender || isTraveller, "Booking not found");
  const actor = isSender ? booking.request.sender : booking.trip.traveller;
  const other = isSender ? booking.trip.traveller : booking.request.sender;
  const announce = (extra = "") =>
    postSystemMessage(bookingId, `${actor.name} cancelled this booking.${extra}`, {
      userIds: [other.id],
      subject: `${actor.name} cancelled your booking`,
    });

  if (booking.status === "PROPOSED" || booking.status === "ACCEPTED") {
    const { count } = await db.booking.updateMany({
      where: { id: bookingId, status: booking.status },
      data: {
        status: isTraveller && booking.status === "PROPOSED" ? "DECLINED" : "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: isSender ? "SENDER" : "TRAVELLER",
      },
    });
    assert(count === 1, "This booking has changed, refresh and try again");
    await announce();
    return;
  }

  assert(booking.status === "FUNDED", "This booking can no longer be cancelled");
  const pickedUp = booking.milestones.some((m) => m.type === "PICKED_UP" && m.status !== "PENDING");
  assert(!pickedUp, "The document has already been handed over. Open a dispute instead.");

  const terms = {
    policy: booking.cancellationPolicy,
    travellerPayout: booking.travellerPayout,
    serviceFee: booking.serviceFee,
    bookedAt: booking.fundedAt ?? booking.proposedAt,
    departureAt: booking.trip.departureAt,
  };
  const refund = isSender ? senderCancellationRefund(terms) : travellerCancellationRefund(terms);

  const { count } = await db.booking.updateMany({
    where: { id: bookingId, status: "FUNDED" },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: isSender ? "SENDER" : "TRAVELLER",
      refundedAmount: refund.total,
    },
  });
  assert(count === 1, "This booking has changed, refresh and try again");
  // A sender who cancels closes the request. If the traveller cancels, the sender can book another trip.
  await db.deliveryRequest.update({
    where: { id: booking.requestId },
    data: { status: isSender ? "CANCELLED" : "OPEN" },
  });

  await refundSender(booking, refund.total);
  // The traveller keeps whatever part of their fee was not refunded.
  const compensation = booking.travellerPayout - refund.travellerPayoutRefund;
  if (compensation > 0) {
    await transferToTraveller({
      booking,
      amount: compensation,
      destinationAccountId: booking.trip.traveller.stripeAccountId,
      idempotencyKey: `cancel-${booking.id}`,
    });
  }
  const money = (n: number) => formatMoney(n, booking.currency as Currency);
  await announce(
    ` ${money(refund.total)} refunded to ${booking.request.sender.name}` +
      (compensation > 0 ? `, ${money(compensation)} paid to ${booking.trip.traveller.name}.` : "."),
  );
  return refund;
}

export async function cancelRequest(senderId: string, requestId: string) {
  const request = await db.deliveryRequest.findUnique({ where: { id: requestId } });
  assert(request && request.senderId === senderId, "Request not found");
  const active = await db.booking.count({
    where: { requestId, status: { in: ["ACCEPTED", "FUNDED", "DISPUTED"] } },
  });
  if (active > 0) throw new ActionError("Cancel the booking first");
  await db.$transaction([
    db.booking.updateMany({
      where: { requestId, status: "PROPOSED" },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "SENDER" },
    }),
    db.deliveryRequest.updateMany({
      where: { id: requestId, senderId, status: "OPEN" },
      data: { status: "CANCELLED" },
    }),
  ]);
}

export async function cancelTrip(travellerId: string, tripId: string) {
  const trip = await db.trip.findUnique({ where: { id: tripId } });
  assert(trip && trip.travellerId === travellerId, "Trip not found");
  const funded = await db.booking.count({
    where: { tripId, status: { in: ["FUNDED", "DISPUTED"] } },
  });
  if (funded > 0) throw new ActionError("Cancel each paid booking on this trip first");
  await db.$transaction([
    db.booking.updateMany({
      where: { tripId, status: { in: ["PROPOSED", "ACCEPTED"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: "TRAVELLER" },
    }),
    db.trip.updateMany({
      where: { id: tripId, travellerId, status: "OPEN" },
      data: { status: "CANCELLED" },
    }),
  ]);
}
