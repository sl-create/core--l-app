# Ajo — Product Brief

**Ajo** (Yoruba for "journey") is a peer-to-peer document courier marketplace for the
Nigerian diaspora. It connects people who need important documents moved with trusted
travellers already flying the Lagos–London–New York corridors.

- Former name: **Fetch**. Runner-up name: **Karvaan**.
- Origin: the founder needed a birth certificate moved between countries.

## Documents in scope

Birth and marriage certificates, NIN slips, university certificates, and similar
important paper documents.

## Core flows

1. **Senders** post a delivery request (document, origin, destination, deadline).
2. **Travellers** announce trips (route, travel dates).
3. Requests and trips are **matched by route and date**.
4. **Payment** is held in **Stripe escrow** and released at each handoff milestone.

## Trust & safety

- **Trust tiers**, including **"Ajo Verified"**, covering identity and KYC.

## Pricing & policy

- **Tiered fees.**
- **Airbnb-style cancellation policy.**

## Milestone timer

Claim windows scale with how close the deadline is: **72h, 48h, 24h, or 12h**.

## Open questions

- Platform: mobile (iOS/Android), web, or both?
- Exact milestone list (e.g. pickup → departure → arrival → delivery) and the escrow
  release percentage at each.
- Fee tiers and cancellation tiers (flexible / moderate / strict?).
- Requirements for each trust tier and the KYC provider.
- Deadline thresholds that map to each claim window.
