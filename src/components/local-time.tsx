"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * A moment not tied to a city (a message, a claim, an audit entry), shown in the viewer's
 * own timezone. The server doesn't know that timezone, so it renders UTC and the browser
 * swaps in local time once it hydrates.
 */
export function LocalTime({ date, short = false }: { date: Date | string; short?: boolean }) {
  const inBrowser = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const d = new Date(date);
  const text = new Intl.DateTimeFormat("en-GB", {
    ...(short ? {} : { weekday: "short", year: "numeric" }),
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: inBrowser ? undefined : "UTC",
    timeZoneName: "short",
  }).format(d);
  return <time dateTime={d.toISOString()}>{text}</time>;
}
