"use client";

import { useState } from "react";
import { parseMoneyInput, splitEscrow } from "@/lib/domain/disputes";
import { formatMoney, type Currency } from "@/lib/domain/locations";

type Props = {
  currency: string;
  travellerName: string;
  senderName: string;
  /** What releasing the disputed milestone pays the traveller. */
  milestonePayout: number;
  /** Traveller money still held in escrow (every unconfirmed milestone). */
  unreleasedPayout: number;
  serviceFee: number;
};

/**
 * The three ways to resolve a dispute, each with a plain "who gets what" line that
 * updates as the admin picks options. Field names match what resolveDispute reads.
 */
export function ResolveOptions(p: Props) {
  const [refundFee, setRefundFee] = useState(true);
  const [splitAmount, setSplitAmount] = useState("");
  const [splitFee, setSplitFee] = useState(false);
  const money = (n: number) => formatMoney(n, p.currency as Currency);
  const traveller = p.travellerName.split(" ")[0];
  const sender = p.senderName.split(" ")[0];

  const typed = parseMoneyInput(splitAmount);
  const split =
    typed === null
      ? null
      : splitEscrow({
          unreleasedPayout: p.unreleasedPayout,
          serviceFee: p.serviceFee,
          toTraveller: typed,
          refundServiceFee: splitFee,
        });

  const outcome = (who: string, rest: string) => (
    <span className="mt-2 block rounded-md bg-background px-3 py-2 text-sm font-medium">
      {who} <span className="font-normal text-muted">· {rest}</span>
    </span>
  );

  return (
    <>
      <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-[input[type=radio]:checked]:border-brand">
        <input type="radio" name="outcome" value="release" defaultChecked className="mt-1" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">Release to traveller</span>
          <span className="block text-sm text-muted">The claim stands.</span>
          {outcome(`${traveller} gets ${money(p.milestonePayout)} · ${sender} gets ${money(0)}`, "the journey continues")}
        </span>
      </label>

      <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-[input[type=radio]:checked]:border-danger">
        <input type="radio" name="outcome" value="refund" className="mt-1" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">Refund sender and end booking</span>
          <span className="block text-sm text-muted">
            Returns everything still held. Counts as an upheld dispute against the traveller.
          </span>
          <span className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="includeServiceFee"
              checked={refundFee}
              onChange={(e) => setRefundFee(e.target.checked)}
            />{" "}
            Also refund the Ajo service fee ({money(p.serviceFee)})
          </span>
          {outcome(
            `${traveller} gets ${money(0)} · ${sender} gets ${money(p.unreleasedPayout + (refundFee ? p.serviceFee : 0))}`,
            "the booking ends",
          )}
        </span>
      </label>

      <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-[input[type=radio]:checked]:border-accent">
        <input type="radio" name="outcome" value="split" className="mt-1" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">Split and end booking</span>
          <span className="block text-sm text-muted">
            Pay the traveller part of the {money(p.unreleasedPayout)} still held for them and refund the rest.
          </span>
          <span className="mt-2 block">
            <span className="label text-sm" id="toTravellerLabel">{traveller} gets</span>
            <input
              className="input max-w-40"
              name="toTraveller"
              inputMode="decimal"
              placeholder="e.g. 12.50"
              aria-labelledby="toTravellerLabel"
              value={splitAmount}
              onChange={(e) => setSplitAmount(e.target.value)}
            />
          </span>
          <span className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="splitServiceFee" checked={splitFee} onChange={(e) => setSplitFee(e.target.checked)} />{" "}
            Also refund the Ajo service fee ({money(p.serviceFee)})
          </span>
          <span className="mt-1 flex items-center gap-2 text-sm">
            <input type="checkbox" name="upheld" /> Count as an upheld dispute against the traveller
          </span>
          {split?.ok
            ? outcome(`${traveller} gets ${money(split.toTraveller)} · ${sender} gets ${money(split.toSender)}`, "the booking ends")
            : (
              <span className={`mt-2 block text-sm ${split ? "text-danger" : "text-muted"}`}>
                {split ? split.error : splitAmount ? "Enter an amount like 12.50." : `Enter ${traveller}’s share to see the split.`}
              </span>
            )}
        </span>
      </label>
    </>
  );
}
