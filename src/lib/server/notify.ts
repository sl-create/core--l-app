import "server-only";
import { after } from "next/server";
import { db } from "./db";
import { sendEmail } from "./mailer";
import { appUrl } from "./stripe";

/**
 * Runs side effects after the response is sent, so a slow email provider never
 * blocks the user. Outside a request (scripts, tests) it runs straight away.
 */
export function defer(task: () => Promise<unknown>) {
  const safe = () => task().catch((err) => console.error("Deferred task failed", err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

/** Emails users about something that happened. Email is the only channel for now. */
export function notifyUsers(userIds: string[], message: { subject: string; text: string; path: string }) {
  if (userIds.length === 0) return;
  defer(async () => {
    const users = await db.user.findMany({
      where: { id: { in: userIds }, suspendedAt: null },
      select: { email: true, name: true },
    });
    await Promise.all(
      users.map((u) =>
        sendEmail({
          to: u.email,
          subject: message.subject,
          text: `Hi ${u.name || "there"},\n\n${message.text}\n\n${appUrl()}${message.path}\n\nAjo`,
        }),
      ),
    );
  });
}
