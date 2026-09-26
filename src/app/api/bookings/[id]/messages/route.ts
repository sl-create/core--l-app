import { listMessages, markRead, threadFor } from "@/lib/server/messages";
import { currentUser } from "@/lib/server/session";

/** New messages since `?after=<ISO time>`. The message thread polls this. */
export async function GET(req: Request, ctx: RouteContext<"/api/bookings/[id]/messages">) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const thread = await threadFor(user, id);
  if (!thread) return new Response("Not found", { status: 404 });

  const afterParam = new URL(req.url).searchParams.get("after");
  const after = afterParam ? new Date(afterParam) : undefined;
  if (after && Number.isNaN(after.getTime())) return new Response("Bad after", { status: 400 });

  const messages = await listMessages(id, after);
  if (messages.length > 0) await markRead(user.id, id);
  return Response.json({ messages });
}
