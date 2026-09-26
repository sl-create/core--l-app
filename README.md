# Ajo

A peer-to-peer document courier marketplace for the Nigerian diaspora. Senders post
documents that need moving (birth certificates, NIN slips, degree certificates), travellers
post trips on the Lagos–London–New York corridors, and Ajo matches them by route and date.
Payment sits in Stripe escrow and is released milestone by milestone.

See [`docs/PRODUCT.md`](docs/PRODUCT.md) for the product brief and the business rules.

## Stack

- Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4
- Postgres with Prisma 6
- Stripe Checkout, Connect (traveller payouts) and Identity (KYC)

## Getting started

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and SESSION_SECRET
npm run db:migrate            # create the schema
npm run dev
```

Leave `STRIPE_SECRET_KEY` empty to run with **simulated payments**. Checkout, ID
verification and payout onboarding complete straight away with fake ids, so you can
walk through the whole flow locally. Use two browsers (or a private window) to act as
sender and traveller at the same time.

Sign-in is a passwordless development stand-in: enter any name and email. It is off in
production unless `ALLOW_DEMO_LOGIN=true`.

## Scripts

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Start the dev server                |
| `npm test`          | Unit tests for the business rules   |
| `npm run typecheck` | Generate route types and run `tsc`  |
| `npm run lint`      | ESLint                              |
| `npm run build`     | Production build                    |
| `npm run db:deploy` | Apply migrations in production      |
| `npm run admin:grant -- <email>` | Make an existing user an admin |

## Code map

```
src/lib/domain/     Pure business rules, no I/O and fully unit tested
  matching.ts       Route + date matching and ranking
  pricing.ts        Corridor base fee × urgency, tiered service fee
  urgency.ts        Urgency tiers and the 72/48/24/12h claim windows
  cancellation.ts   Flexible / Moderate / Strict refunds
  milestones.ts     Escrow split across milestones
  trust.ts          Trust tiers and Ajo Verified promotion
src/lib/server/     Database, session, Stripe and the booking state machine
  bookings.ts       propose → accept → fund → claim/confirm milestones → complete
  escrow.ts         Stripe separate charges & transfers (or simulated)
src/app/            Pages, server actions (actions.ts) and API routes
```

## Booking lifecycle

```
PROPOSED ──accept──▶ ACCEPTED ──pay──▶ FUNDED ──all milestones confirmed──▶ COMPLETED
   │                    │                 │
 decline             cancel     cancel before pickup (refund per policy)
                                          │
                                 dispute a claim ──▶ DISPUTED (manual review)
```

Each funded booking has three milestones: **handed to traveller (25%)**, **landed (25%)**
and **delivered (50%)**. The traveller claims a milestone. The sender then has a claim
window to confirm or dispute it, and when the window lapses the claim confirms
automatically. Confirming a milestone transfers its share to the traveller.

## Admin

Admins see an **Admin** link in the header, and everyone else gets a 404 at `/admin`.
Grant the role with `npm run admin:grant -- you@example.com` after that person has signed in once.

- **Disputes**: see the complaint, the traveller's claim note and the escrow state, then
  either *release to traveller* (pay the milestone, resume the journey) or *refund sender*
  (return what is still in escrow, optionally with the service fee, end the booking, and count
  an upheld dispute against the traveller). The resolution note is shown to both parties.
- **Users**: search, change trust tier, suspend or lift a suspension. Suspended users are
  signed out and their trips disappear from matching.
- **Audit log**: every admin action with who, when and why. Reasons are required.

## Stripe setup

1. Set `STRIPE_SECRET_KEY` and enable Connect and Identity in the Stripe dashboard.
2. Point a webhook at `/api/stripe/webhook` with the events
   `checkout.session.completed` and `identity.verification_session.verified`,
   then set `STRIPE_WEBHOOK_SECRET`.
3. Schedule `GET /api/cron/release-milestones` every 15 minutes with the header
   `Authorization: Bearer $CRON_SECRET`. It auto-confirms lapsed claims and retries
   failed payouts.
