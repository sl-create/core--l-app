"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TRUST_TIERS, type TrustTier } from "@/lib/domain/trust";
import { parseMoneyInput } from "@/lib/domain/disputes";
import * as admin from "@/lib/server/admin";
import { assert } from "@/lib/server/errors";
import { ActionError } from "@/lib/server/errors";

async function run(path: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ActionError) redirect(`${path}?error=${encodeURIComponent(err.message)}`);
    throw err;
  }
  revalidatePath(path);
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").slice(0, 2000);

export async function resolveDispute(disputeId: string, form: FormData) {
  const me = await admin.requireAdmin();
  const path = `/admin/disputes/${disputeId}`;
  const note = text(form, "note");
  const outcome = form.get("outcome");
  await run(path, async () => {
    if (outcome === "refund") {
      return admin.refundDispute(me, disputeId, note, form.get("includeServiceFee") === "on");
    }
    if (outcome === "split") {
      const toTraveller = parseMoneyInput(text(form, "toTraveller"));
      assert(toTraveller !== null, "Enter the traveller's share as an amount, e.g. 12.50");
      return admin.splitDispute(me, disputeId, note, {
        toTraveller,
        refundServiceFee: form.get("splitServiceFee") === "on",
        upheld: form.get("upheld") === "on",
      });
    }
    return admin.releaseDispute(me, disputeId, note);
  });
}

export async function setTrustTier(userId: string, form: FormData) {
  const me = await admin.requireAdmin();
  const tier = String(form.get("tier")) as TrustTier;
  const path = `/admin/users/${userId}`;
  if (!TRUST_TIERS.includes(tier)) redirect(`${path}?error=Invalid%20tier`);
  await run(path, () => admin.setTrustTier(me, userId, tier, text(form, "reason")));
}

export async function setSuspended(userId: string, suspended: boolean, form: FormData) {
  const me = await admin.requireAdmin();
  await run(`/admin/users/${userId}`, () =>
    admin.setSuspended(me, userId, suspended, text(form, "reason")),
  );
}

export async function setElderApproval(userId: string, approved: boolean, form: FormData) {
  const me = await admin.requireAdmin();
  await run(`/admin/users/${userId}`, () =>
    admin.setElderApproval(me, userId, approved, text(form, "reason")),
  );
}
