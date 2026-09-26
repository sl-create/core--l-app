"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { sendMessage } from "@/app/actions";
import type { MessageDTO } from "@/lib/server/messages";

const POLL_MS = 5000;

function time(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function MessageThread({
  bookingId,
  userId,
  initial,
  canPost,
  maxLength,
}: {
  bookingId: string;
  userId: string;
  initial: MessageDTO[];
  canPost: boolean;
  maxLength: number;
}) {
  // `initial` is refreshed by the server whenever the page re-renders (after pay,
  // claim, confirm…). `received` holds what arrived since then by polling or sending.
  const [received, setReceived] = useState<MessageDTO[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLOListElement>(null);
  const messages = useMemo(() => {
    const byId = new Map(initial.map((m) => [m.id, m]));
    for (const m of received) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [initial, received]);
  const lastAt = messages.at(-1)?.createdAt;

  const merge = useCallback((incoming: MessageDTO[]) => {
    if (incoming.length > 0) setReceived((prev) => [...prev, ...incoming]);
  }, []);

  // Poll for new messages while the tab is visible.
  useEffect(() => {
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      const qs = lastAt ? `?after=${encodeURIComponent(lastAt)}` : "";
      try {
        const res = await fetch(`/api/bookings/${bookingId}/messages${qs}`, { cache: "no-store" });
        if (res.ok) merge((await res.json()).messages);
      } catch {
        // Offline or server hiccup: try again on the next tick.
      }
    };
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [bookingId, lastAt, merge]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const result = await sendMessage(bookingId, body);
      if ("error" in result) {
        setError(result.error);
      } else {
        setError(null);
        setDraft("");
        merge([result.message]);
      }
    });
  }

  return (
    <div className="card p-0">
      <ol ref={listRef} className="max-h-[28rem] space-y-3 overflow-y-auto p-5" aria-live="polite">
        {messages.length === 0 && <li className="text-sm text-muted">No messages yet.</li>}
        {messages.map((m) => {
          if (m.kind === "SYSTEM") {
            return (
              <li key={m.id} className="mx-auto max-w-lg text-center text-xs text-muted">
                {m.body} <span className="whitespace-nowrap">· {time(m.createdAt)}</span>
              </li>
            );
          }
          const mine = m.authorId === userId;
          const support = m.kind === "SUPPORT";
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                  mine
                    ? "bg-brand text-white dark:text-black"
                    : support
                      ? "border border-accent/50 bg-amber-50 dark:bg-amber-950/40"
                      : "bg-background"
                }`}
              >
                {!mine && (
                  <p className="mb-0.5 text-xs font-semibold">
                    {support ? `${m.authorName} · Ajo support` : m.authorName}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-white/70 dark:text-black/60" : "text-muted"}`}>
                  {time(m.createdAt)} UTC
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {canPost && (
        <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
          <textarea
            className="input min-h-10 flex-1 resize-y"
            rows={1}
            name="body"
            value={draft}
            maxLength={maxLength}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            placeholder="Write a message…"
            aria-label="Message"
          />
          <button type="submit" className="btn-primary self-end" disabled={pending || !draft.trim()}>
            {pending ? "Sending…" : "Send"}
          </button>
        </form>
      )}
      {error && <p className="px-4 pb-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
