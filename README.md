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
cp .env.example .env          # then fill in DATABASE_URL
npm run db:migrate            # create the schema
npm run dev
```

Leave `STRIPE_SECRET_KEY` empty to run with **simulated payments**. Checkout, ID
verification and payout onboarding complete straight away with fake ids, so you can
walk through the whole flow locally. Use two browsers (or a private window) to act as
sender and traveller at the same time.

## Sign-in

Passwordless email links, used for both sign-up and sign-in.

1. The user enters an email, and Ajo emails a single-use link that expires after 15 minutes.
   Each email gets at most 5 links per hour.
2. The link opens a page with a **Continue** button. Signing in on page load would let email
   security scanners, which open links, use up the token.
3. New users choose their display name on `/welcome`.

Only SHA-256 hashes of link and session tokens are stored. Sessions live in the database
for 30 days. Signing out deletes the session, and suspending a user deletes all of theirs.

In development without `RESEND_API_KEY`, the "check your email" page shows the link
directly so you can sign in locally. In production, sign-in needs Resend configured, or
`DEMO_ACCESS_CODE` on a private test deploy (see below).

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
  trust.ts          ID verification (who may carry)
  levels.ts         Traveller levels, bonuses, early access and progress
src/lib/server/     Database, session, Stripe and the booking state machine
  bookings.ts       propose → accept → fund → claim/confirm milestones → complete
  escrow.ts         Stripe separate charges & transfers (or simulated)
  messages.ts       Booking threads, system messages, unread counts
  notify.ts         Email notifications, sent after the response
  admin.ts          Dispute resolution, trust tiers, suspension, audit log
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

## Traveller levels

Arìnrìn-àjò → Olóòótọ́ → Atọ́nà → Àgbà, computed from deliveries, ratings, on-time rate and
strikes (`src/lib/domain/levels.ts`, rules in `docs/PRODUCT.md`). Higher levels get a share of
Ajo's fee as a bonus, rank higher in matching, and see new requests in their trip feed
sooner. `/levels` explains it to travellers, and `/travellers/:id` is the public profile.

## Admin

Admins see an **Admin** link in the header, and everyone else gets a 404 at `/admin`.
Grant the role by listing the email in `ADMIN_EMAILS` (applied at their next sign-in), or with
`npm run admin:grant -- you@example.com` after that person has signed in once.

- **Disputes**: see the complaint, the traveller's claim note and the escrow state, then
  either *release to traveller* (pay the milestone, resume the journey) or *refund sender*
  (return what is still in escrow, optionally with the service fee, end the booking, and count
  an upheld dispute against the traveller). The resolution note is shown to both parties.
- **Users**: search, change verification, approve Àgbà, suspend or lift a suspension. Suspended users are
  signed out and their trips disappear from matching.
- **Audit log**: every admin action with who, when and why. Reasons are required.

## Messaging

Every booking has one thread shared by the sender, the traveller and Ajo support (admins).

- **System messages**: each state change (proposed, accepted, paid, milestone claimed,
  confirmed, disputed, resolved, cancelled, completed) is posted into the thread, so the
  thread doubles as the booking history, and the relevant party is emailed.
- **Delivery**: the thread asks `GET /api/bookings/:id/messages?after=` every 5 seconds
  while the tab is visible. It's simple and works on any host. Swap in SSE or websockets later.
- **Unread counts** are tracked per user per booking (`MessageRead`) and shown on the dashboard.
- **Email** (`src/lib/server/mailer.ts`) uses Resend when `RESEND_API_KEY` is set, and
  otherwise prints to the server log. A chat message is emailed only when it is the first
  one the recipient hasn't read yet, so conversations don't flood inboxes.

## Deploying a test version (Vercel + Neon)

A free, permanent test deploy you can open on any device. Payments stay simulated.

1. On [vercel.com](https://vercel.com), sign up with GitHub and import this repository.
   Pick this branch as the production branch, or merge it to your default branch first.
2. In the project, open **Storage**, add a **Neon** Postgres database and connect it. This
   sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. In **Settings → Environment Variables**, add:
   - `DEMO_ACCESS_CODE`: a code you choose. You type it on the sign-in form.
   - `ADMIN_EMAILS`: your email (comma-separate several). Those accounts become admins
     when they sign in. Anyone with the access code can sign in as any email, so on a
     demo deploy keep the code private.
   - `CRON_SECRET`: a long random string. Vercel sends it to the cron route.
4. Deploy (or redeploy after adding the variables). `vercel.json` runs
   `prisma migrate deploy` before each build, so the schema is created automatically.
5. Open the site and sign in with any email and the access code. If you skipped
   `ADMIN_EMAILS`, make an account an admin in Neon's **SQL Editor**:
   `UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';`

`vercel.json` also schedules the milestone release job once a day, the most often the
Hobby plan allows. Every push to the production branch redeploys.

## Stripe setup

1. Set `STRIPE_SECRET_KEY` and enable Connect and Identity in the Stripe dashboard.
2. Point a webhook at `/api/stripe/webhook` with the events
   `checkout.session.completed` and `identity.verification_session.verified`,
   then set `STRIPE_WEBHOOK_SECRET`.
3. Schedule `GET /api/cron/release-milestones` every 15 minutes with the header
   `Authorization: Bearer $CRON_SECRET`. It auto-confirms lapsed claims and retries
   failed payouts.
