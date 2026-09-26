import "server-only";
import type { Message, User } from "@prisma/client";
import { db } from "./db";
import { assert } from "./errors";
import { notifyUsers } from "./notify";

export const MAX_MESSAGE_LENGTH = 2000;

export type MessageDTO = {
  id: string;
  kind: Message["kind"];
  body: string;
  createdAt: string;
  authorId: string | null;
  authorName: string | null;
};

type Thread = { bookingId: string; senderId: string; travellerId: string };

async function loadThread(bookingId: string): Promise<Thread | null> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { request: { select: { senderId: true } }, trip: { select: { travellerId: true } } },
  });
  return booking
    ? { bookingId, senderId: booking.request.senderId, travellerId: booking.trip.travellerId }
    : null;
}

const isParty = (t: Thread, userId: string) => t.senderId === userId || t.travellerId === userId;

/** Loads the thread if `user` may read it (a party to the booking, or an admin). */
export async function threadFor(user: User, bookingId: string): Promise<Thread | null> {
  const thread = await loadThread(bookingId);
  return thread && (isParty(thread, user.id) || user.role === "ADMIN") ? thread : null;
}

function toDTO(m: Message & { author: { name: string } | null }): MessageDTO {
  return {
    id: m.id,
    kind: m.kind,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    authorId: m.authorId,
    authorName: m.author?.name ?? null,
  };
}

export async function listMessages(bookingId: string, after?: Date): Promise<MessageDTO[]> {
  const messages = await db.message.findMany({
    where: { bookingId, ...(after && { createdAt: { gt: after } }) },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return messages.map(toDTO);
}

export async function markRead(userId: string, bookingId: string) {
  const now = new Date();
  await db.messageRead.upsert({
    where: { bookingId_userId: { bookingId, userId } },
    create: { bookingId, userId, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

async function hasUnread(userId: string, bookingId: string): Promise<boolean> {
  const read = await db.messageRead.findUnique({
    where: { bookingId_userId: { bookingId, userId } },
  });
  const count = await db.message.count({
    where: {
      bookingId,
      OR: [{ authorId: null }, { authorId: { not: userId } }],
      ...(read && { createdAt: { gt: read.lastReadAt } }),
    },
  });
  return count > 0;
}

export async function sendMessage(user: User, bookingId: string, rawBody: string): Promise<MessageDTO> {
  const body = rawBody.trim();
  assert(body.length > 0, "Write a message first");
  assert(body.length <= MAX_MESSAGE_LENGTH, `Messages can be up to ${MAX_MESSAGE_LENGTH} characters`);
  const thread = await threadFor(user, bookingId);
  assert(thread, "Booking not found");
  const party = isParty(thread, user.id);

  // Email each recipient only for the first message they have not read yet, so a
  // back-and-forth chat does not flood their inbox.
  const recipients = [thread.senderId, thread.travellerId].filter((id) => id !== user.id);
  const toNotify = (
    await Promise.all(recipients.map(async (id) => ((await hasUnread(id, bookingId)) ? null : id)))
  ).filter((id): id is string => id !== null);

  const message = await db.message.create({
    data: { bookingId, authorId: user.id, kind: party ? "USER" : "SUPPORT", body },
    include: { author: { select: { name: true } } },
  });
  await markRead(user.id, bookingId);

  notifyUsers(toNotify, {
    subject: party ? `New message from ${user.name}` : "New message from Ajo support",
    text: `"${body.length > 300 ? `${body.slice(0, 300)}…` : body}"`,
    path: `/bookings/${bookingId}`,
  });
  return toDTO(message);
}

/**
 * Posts an automatic update into the booking thread and emails the given users.
 * Use it for every booking state change so the thread doubles as a history.
 */
export async function postSystemMessage(
  bookingId: string,
  body: string,
  notify: { userIds: string[]; subject: string } | null = null,
) {
  await db.message.create({ data: { bookingId, kind: "SYSTEM", body } });
  if (notify) {
    notifyUsers(notify.userIds, { subject: notify.subject, text: body, path: `/bookings/${bookingId}` });
  }
}

/** Unread message counts per booking for everything the user is a party to. */
export async function unreadCounts(userId: string): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ bookingId: string; count: bigint }[]>`
    SELECT m."bookingId", COUNT(*) AS count
    FROM "Message" m
    JOIN "Booking" b ON b.id = m."bookingId"
    JOIN "DeliveryRequest" r ON r.id = b."requestId"
    JOIN "Trip" t ON t.id = b."tripId"
    LEFT JOIN "MessageRead" mr ON mr."bookingId" = m."bookingId" AND mr."userId" = ${userId}
    WHERE (r."senderId" = ${userId} OR t."travellerId" = ${userId})
      AND (m."authorId" IS NULL OR m."authorId" <> ${userId})
      AND (mr."lastReadAt" IS NULL OR m."createdAt" > mr."lastReadAt")
    GROUP BY m."bookingId"`;
  return new Map(rows.map((r) => [r.bookingId, Number(r.count)]));
}
