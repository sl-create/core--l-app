"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CANCELLATION_POLICIES } from "@/lib/domain/cancellation";
import { DOCUMENT_MIN_TIER, DOCUMENT_TYPES } from "@/lib/domain/documents";
import { LOCATIONS } from "@/lib/domain/locations";
import { meetsTier, TRUST_TIERS } from "@/lib/domain/trust";
import { startIdentityVerification, startPayoutOnboarding } from "@/lib/server/accounts";
import * as bookings from "@/lib/server/bookings";
import { db } from "@/lib/server/db";
import { ActionError } from "@/lib/server/errors";
import * as messages from "@/lib/server/messages";
import type { MessageDTO } from "@/lib/server/messages";
import { requestLoginLink, signInWithToken } from "@/lib/server/auth";
import { endSession, requireSignedIn, requireUser } from "@/lib/server/session";

/** Runs an action. A user-facing error sends the user back to `path` with the message. */
async function run<T>(path: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ActionError) {
      redirect(`${path}?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
}

function parse<T extends z.ZodType>(schema: T, form: FormData, path: string): z.infer<T> {
  const result = schema.safeParse(Object.fromEntries(form));
  if (!result.success) {
    const issue = result.error.issues[0];
    const message = `${issue.path.join(".") || "Form"}: ${issue.message}`;
    redirect(`${path}?error=${encodeURIComponent(message)}`);
  }
  return result.data;
}

// <input type="datetime-local"> has no timezone. Ajo treats every time as UTC.
const utcDate = z
  .string()
  .min(1, "Required")
  .transform((v) => new Date(v.length === 16 ? `${v}:00Z` : v))
  .refine((d) => !Number.isNaN(d.getTime()), "Invalid date");

// ── Session ────────────────────────────────────────────────────────────

export async function requestLogin(form: FormData) {
  const { email } = parse(z.object({ email: z.email().toLowerCase() }), form, "/login");
  const devLink = await run("/login", () => requestLoginLink(email));
  const qs = new URLSearchParams({ email });
  if (devLink) qs.set("dev", devLink);
  redirect(`/login/check?${qs}`);
}

export async function verifyLogin(token: string) {
  const user = await run("/login", () => signInWithToken(token));
  redirect(user.name ? "/dashboard" : "/welcome");
}

export async function completeProfile(form: FormData) {
  const user = await requireSignedIn();
  const { name } = parse(z.object({ name: z.string().trim().min(1).max(80) }), form, "/welcome");
  await db.user.update({ where: { id: user.id }, data: { name } });
  redirect("/dashboard");
}

export async function logout() {
  await endSession();
  redirect("/");
}

// ── Account ────────────────────────────────────────────────────────────

export async function verifyIdentity() {
  const user = await requireUser();
  const url = await startIdentityVerification(user);
  if (url) redirect(url);
  revalidatePath("/account");
}

export async function setUpPayouts() {
  const user = await requireUser();
  const url = await startPayoutOnboarding(user);
  if (url) redirect(url);
  revalidatePath("/account");
}

// ── Requests ───────────────────────────────────────────────────────────

const requestSchema = z
  .object({
    documentType: z.enum(DOCUMENT_TYPES),
    description: z.string().trim().max(500).optional(),
    origin: z.enum(LOCATIONS),
    destination: z.enum(LOCATIONS),
    availableFrom: utcDate,
    deadline: utcDate,
    minTrustTier: z.enum(TRUST_TIERS),
    pickupCity: z.string().trim().min(1).max(80),
    recipientName: z.string().trim().min(1).max(80),
    recipientPhone: z.string().trim().min(5).max(30),
  })
  .refine((r) => r.origin !== r.destination, {
    path: ["destination"],
    message: "Must differ from origin",
  })
  .refine((r) => r.deadline > r.availableFrom, {
    path: ["deadline"],
    message: "Must be after the document is ready",
  })
  .refine((r) => r.deadline > new Date(), { path: ["deadline"], message: "Must be in the future" });

export async function createRequest(form: FormData) {
  const user = await requireUser();
  const data = parse(requestSchema, form, "/requests/new");
  // Never allow a lower bar than the document type needs.
  const minTrustTier = meetsTier(data.minTrustTier, DOCUMENT_MIN_TIER[data.documentType])
    ? data.minTrustTier
    : DOCUMENT_MIN_TIER[data.documentType];
  const request = await db.deliveryRequest.create({
    data: { ...data, minTrustTier, description: data.description || null, senderId: user.id },
  });
  redirect(`/requests/${request.id}`);
}

export async function cancelRequest(requestId: string) {
  const user = await requireUser();
  const path = `/requests/${requestId}`;
  await run(path, () => bookings.cancelRequest(user.id, requestId));
  revalidatePath(path);
}

// ── Trips ──────────────────────────────────────────────────────────────

const tripSchema = z
  .object({
    origin: z.enum(LOCATIONS),
    destination: z.enum(LOCATIONS),
    departureAt: utcDate,
    arrivalAt: utcDate,
    capacity: z.coerce.number().int().min(1).max(10),
    cancellationPolicy: z.enum(CANCELLATION_POLICIES),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((t) => t.origin !== t.destination, {
    path: ["destination"],
    message: "Must differ from origin",
  })
  .refine((t) => t.arrivalAt > t.departureAt, {
    path: ["arrivalAt"],
    message: "Must be after departure",
  })
  .refine((t) => t.departureAt > new Date(), {
    path: ["departureAt"],
    message: "Must be in the future",
  });

export async function createTrip(form: FormData) {
  const user = await requireUser();
  const data = parse(tripSchema, form, "/trips/new");
  const trip = await db.trip.create({
    data: { ...data, notes: data.notes || null, travellerId: user.id },
  });
  redirect(`/trips/${trip.id}`);
}

export async function cancelTrip(tripId: string) {
  const user = await requireUser();
  const path = `/trips/${tripId}`;
  await run(path, () => bookings.cancelTrip(user.id, tripId));
  revalidatePath(path);
}

// ── Bookings ───────────────────────────────────────────────────────────

export async function proposeBooking(requestId: string, tripId: string) {
  const user = await requireUser();
  const booking = await run(`/requests/${requestId}`, () =>
    bookings.proposeBooking(user.id, requestId, tripId),
  );
  redirect(`/bookings/${booking.id}`);
}

async function bookingAction(
  bookingId: string,
  fn: (userId: string, bookingId: string) => Promise<unknown>,
) {
  const user = await requireUser();
  const path = `/bookings/${bookingId}`;
  await run(path, () => fn(user.id, bookingId));
  revalidatePath(path);
}

export async function acceptBooking(bookingId: string) {
  await bookingAction(bookingId, bookings.acceptBooking);
}

export async function declineBooking(bookingId: string) {
  await bookingAction(bookingId, bookings.declineBooking);
}

export async function cancelBooking(bookingId: string) {
  await bookingAction(bookingId, bookings.cancelBooking);
}

export async function payBooking(bookingId: string) {
  const user = await requireUser();
  const path = `/bookings/${bookingId}`;
  const url = await run(path, () => bookings.startPayment(user.id, bookingId));
  if (url) redirect(url);
  revalidatePath(path);
}

// ── Milestones ─────────────────────────────────────────────────────────

export async function claimMilestone(bookingId: string, milestoneId: string, form: FormData) {
  const user = await requireUser();
  const path = `/bookings/${bookingId}`;
  const note = String(form.get("note") ?? "").slice(0, 500);
  await run(path, () => bookings.claimMilestone(user.id, milestoneId, note));
  revalidatePath(path);
}

export async function confirmMilestone(bookingId: string, milestoneId: string) {
  const user = await requireUser();
  const path = `/bookings/${bookingId}`;
  await run(path, () => bookings.confirmMilestone(user.id, milestoneId));
  revalidatePath(path);
}

export async function disputeMilestone(bookingId: string, milestoneId: string, form: FormData) {
  const user = await requireUser();
  const path = `/bookings/${bookingId}`;
  const note = String(form.get("note") ?? "").slice(0, 1000);
  await run(path, () => bookings.disputeMilestone(user.id, milestoneId, note));
  revalidatePath(path);
}

// ── Messages ───────────────────────────────────────────────────────────

export async function sendMessage(
  bookingId: string,
  body: string,
): Promise<{ message: MessageDTO } | { error: string }> {
  const user = await requireUser();
  try {
    return { message: await messages.sendMessage(user, bookingId, body) };
  } catch (err) {
    if (err instanceof ActionError) return { error: err.message };
    throw err;
  }
}
