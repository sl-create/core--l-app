import "server-only";
import { LEVEL_INFO, levelOf, levelRank, type Level } from "@/lib/domain/levels";
import { db } from "./db";
import { notifyUsers } from "./notify";

export async function currentLevel(userId: string): Promise<Level | null> {
  return levelOf(await db.user.findUniqueOrThrow({ where: { id: userId } }));
}

/** Call after a traveller's stats change. Emails them if their level moved. */
export async function announceLevelChange(userId: string, before: Level | null) {
  const after = await currentLevel(userId);
  if (!before || !after || before === after) return;
  const info = LEVEL_INFO[after];
  const up = levelRank(after) > levelRank(before);
  notifyUsers([userId], {
    subject: up ? `You're now ${info.name} on Ajo!` : `Your Ajo level is now ${info.name}`,
    text: up
      ? `Congratulations! You've reached ${info.name} (${info.meaning}). ${info.blurb}`
      : `Your level has changed to ${info.name} (${info.meaning}) after recent activity. Keep delivering on time to move back up.`,
    path: "/account",
  });
}
