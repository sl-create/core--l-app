import "server-only";
import type { Prisma, TrustTier, User } from "@prisma/client";
import { notFound } from "next/navigation";
import { unreleasedPayout } from "@/lib/domain/milestones";
import { completeIfDone, payOut } from "./bookings";
import { db } from "./db";
import { refundSender } from "./escrow";
import { assert } from "./errors";
import { postSystemMessage } from "./messages";
import { formatMoney, type Currency } from "@/lib/domain/locations";
import { requireUser } from "./session";

export async function requireAdmin() {
  const user = await requireUser();
  // Pretend the admin area does not exist for everyone else.
  if (user.role !== "ADMIN") notFound();
  return user;
}

async function audit(
  tx: Prisma.TransactionClient,
  admin: User,
  action: string,
  target: { type: string; id: string },
  details?: Prisma.InputJsonValue,
) {
  await tx.auditLog.create({
    data: { adminId: admin.id, action, targetType: target.type, targetId: target.id, details },
  });
}

/** The traveller's claim stands: pay the disputed milestone and resume the journey. */
export async function releaseDispute(admin: User, disputeId: string, note: string) {
  assert(note.trim(), "Add a resolution note");
  const dispute = await db.dispute.findUnique({ where: { id: disputeId } });
  assert(dispute, "Dispute not found");
  await db.$transaction(async (tx) => {
    const { count } = await tx.dispute.updateMany({
      where: { id: disputeId, status: "OPEN" },
      data: {
        status: "RESOLVED",
        outcome: "RELEASED_TO_TRAVELLER",
        resolutionNote: note.trim(),
        resolvedById: admin.id,
        resolvedAt: new Date(),
      },
    });
    assert(count === 1, "This dispute is already resolved");
    await tx.milestone.update({
      where: { id: dispute.milestoneId },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
    });
    await tx.booking.update({ where: { id: dispute.bookingId }, data: { status: "FUNDED" } });
    await audit(tx, admin, "dispute.release", { type: "Dispute", id: disputeId }, { note });
  });
  await payOut(dispute.milestoneId);
  await announceResolution(dispute.bookingId, `The Ajo team reviewed the dispute and confirmed the milestone. The payment has been released and the journey continues. Note from Ajo: ${note.trim()}`);
  await completeIfDone(dispute.milestoneId);
}

/** Everything still held in escrow for a booking, which is what a refund can return. */
export function refundableAmount(
  booking: { serviceFee: number; milestones: { status: string; payout: number }[] },
  includeServiceFee: boolean,
) {
  return unreleasedPayout(booking.milestones) + (includeServiceFee ? booking.serviceFee : 0);
}

/** The sender is right: refund whatever is still in escrow and end the booking. */
export async function refundDispute(
  admin: User,
  disputeId: string,
  note: string,
  includeServiceFee: boolean,
) {
  assert(note.trim(), "Add a resolution note");
  const dispute = await db.dispute.findUnique({
    where: { id: disputeId },
    include: { booking: { include: { milestones: true, trip: true } } },
  });
  assert(dispute && dispute.status === "OPEN", "This dispute is already resolved");
  const { booking } = dispute;
  const amount = refundableAmount(booking, includeServiceFee);

  // Refund first. The idempotency key means a retry or a second admin cannot refund twice.
  await refundSender(booking, amount);

  await db.$transaction(async (tx) => {
    const { count } = await tx.dispute.updateMany({
      where: { id: disputeId, status: "OPEN" },
      data: {
        status: "RESOLVED",
        outcome: "REFUNDED_TO_SENDER",
        resolutionNote: note.trim(),
        refundAmount: amount,
        resolvedById: admin.id,
        resolvedAt: new Date(),
      },
    });
    assert(count === 1, "This dispute is already resolved");
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: "ADMIN",
        refundedAmount: amount,
      },
    });
    await tx.deliveryRequest.update({
      where: { id: booking.requestId },
      data: { status: "CANCELLED" },
    });
    await tx.user.update({
      where: { id: booking.trip.travellerId },
      data: { upheldDisputes: { increment: 1 } },
    });
    await audit(tx, admin, "dispute.refund", { type: "Dispute", id: disputeId }, {
      note,
      amount,
      includeServiceFee,
    });
  });
  await announceResolution(
    booking.id,
    `The Ajo team reviewed the dispute and refunded ${formatMoney(amount, booking.currency as Currency)} to the sender. This booking is closed. Note from Ajo: ${note.trim()}`,
  );
}

async function announceResolution(bookingId: string, body: string) {
  const b = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { request: { select: { senderId: true } }, trip: { select: { travellerId: true } } },
  });
  await postSystemMessage(bookingId, body, {
    userIds: [b.request.senderId, b.trip.travellerId],
    subject: "Your dispute has been resolved",
  });
}

export async function setTrustTier(admin: User, userId: string, tier: TrustTier, reason: string) {
  assert(reason.trim(), "Add a reason");
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    assert(user, "User not found");
    await tx.user.update({ where: { id: userId }, data: { trustTier: tier } });
    await audit(tx, admin, "user.trust_tier", { type: "User", id: userId }, {
      from: user.trustTier,
      to: tier,
      reason,
    });
  });
}

export async function setSuspended(admin: User, userId: string, suspended: boolean, reason: string) {
  assert(reason.trim(), "Add a reason");
  assert(userId !== admin.id, "You cannot suspend yourself");
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { suspendedAt: suspended ? new Date() : null },
    });
    await audit(tx, admin, suspended ? "user.suspend" : "user.unsuspend", { type: "User", id: userId }, {
      reason,
    });
  });
}
