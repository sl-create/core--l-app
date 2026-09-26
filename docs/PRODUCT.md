# Ajo: Product Brief

**Ajo** (Yoruba for "journey") is a peer-to-peer document courier marketplace for the
Nigerian diaspora. It connects people who need important documents moved with trusted
travellers already flying the Lagos–London–New York corridors.

- Former name: **Fetch**. Runner-up name: **Karvaan**.
- Origin: the founder needed a birth certificate moved between countries.

## Documents in scope

Birth and marriage certificates, NIN slips, university certificates, transcripts, and
similar important paper documents.

## Core flows

1. **Senders** post a delivery request (document, origin, destination, ready date, deadline).
2. **Travellers** announce trips (route, departure, arrival, capacity, cancellation policy).
3. Requests and trips are **matched by route and date**.
4. **Payment** is held in **Stripe escrow** and released at each handoff milestone.

## Rules as implemented (MVP)

Values marked *placeholder* are first guesses to revisit with real data.

### Matching (`src/lib/domain/matching.ts`)
A trip matches a request when:
- origin and destination are the same;
- it departs at least 12h from now, and at least 12h after the document is ready (handoff time);
- it lands at least 24h before the deadline (last-mile time);
- it has a free seat;
- the traveller meets the request's minimum trust tier (and is at least ID Verified).

Matches are ranked by trust tier, then by earliest arrival.

### Urgency, pricing and claim windows (`urgency.ts`, `pricing.ts`)
Urgency is set by the time left until the deadline when the booking is made:

| Time to deadline | Urgency  | Fee multiplier | Claim window |
| ---------------- | -------- | -------------- | ------------ |
| 14 days or more  | Standard | 1×             | 72h          |
| 7–14 days        | Priority | 1.25×          | 48h          |
| 3–7 days         | Express  | 1.5×           | 24h          |
| under 3 days     | Urgent   | 2×             | 12h          |

The claim window is worked out again each time a milestone is claimed, so windows shrink
as the deadline gets closer.

- Traveller fee = corridor base × urgency multiplier. *Placeholder* bases: Lagos–London £40,
  Lagos–New York $55, London–New York $45.
- Ajo service fee, paid by the sender on top, uses tiered marginal bands on the traveller
  fee: 15% up to 50.00, 12% from 50–100, 10% above 100, with a 3.00 minimum. *Placeholder.*

### Escrow milestones (`milestones.ts`)
| Milestone                     | Share of traveller fee |
| ----------------------------- | ---------------------- |
| Document handed to traveller  | 25%                    |
| Traveller landed              | 25%                    |
| Delivered to recipient        | 50%                    |

The traveller claims each milestone in order. The sender confirms (which releases the
funds) or disputes it. An unanswered claim confirms automatically when its window ends.
A dispute freezes the booking for manual review.

### Cancellation (`cancellation.ts`), Airbnb-style, chosen by the traveller per trip
- **Flexible**: full refund up to 24h before departure, then 50% of the traveller fee.
- **Moderate**: full refund up to 5 days before departure, then 50% of the traveller fee.
- **Strict**: full refund within 48h of booking if departure is at least 14 days away. 50% of
  the traveller fee until 7 days before departure. Nothing after that.
- The service fee is refunded only with a full refund. The traveller keeps the part of
  their fee that is not refunded.
- A traveller cancelling always means a full refund for the sender.
- Once the document is handed over, cancellation is closed. Problems go through a dispute.

### Trust tiers (`trust.ts`)
- **Unverified**: email only. Can send, cannot carry.
- **ID Verified**: government ID + selfie through Stripe Identity. Can carry.
- **Ajo Verified**: ID Verified + 3 completed deliveries with no upheld disputes (automatic).
  Senders can require it, and it is required for "Other" document types.

### Disputes and trust & safety
- A sender can dispute a claimed milestone. That freezes the booking: no auto-release,
  no further payouts.
- An admin resolves it by **releasing** (the milestone is paid and the journey continues) or
  **refunding** (unreleased escrow goes back to the sender, the service fee optionally too,
  and the booking ends). A refund counts as an upheld dispute against the traveller, which
  blocks automatic Ajo Verified promotion.
- Admins can change trust tiers and suspend accounts. Every admin action is written to an
  audit log with a required reason.

### Messaging
- Each booking has one thread between the sender and traveller. Ajo support can join as
  admins, and support messages are labelled.
- Booking events are posted automatically, so the thread is also the audit trail both
  parties see.
- Contact and recipient details are still shared only after payment. Messages are not
  filtered for phone numbers or emails.

## Not built yet
- Real authentication (email magic links); sign-in is a development stand-in
- Split refunds (a partial release to the traveller) in dispute resolution
- Photo attachments in messages (proof for milestones)
- SMS/WhatsApp notifications and per-user notification settings
- Timezone-aware times (everything is shown in UTC)
- Mobile apps

## Open questions
- Stripe Connect payouts to travellers based in Nigeria. Check which account type and
  country setup Stripe supports, or whether a local provider (e.g. Paystack) is needed.
- Final fee levels, milestone split and cancellation terms.
- Legal and customs review of carrying official documents across borders.
