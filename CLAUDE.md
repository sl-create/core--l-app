@AGENTS.md

# Ajo

Peer-to-peer document courier marketplace (Lagos–London–New York). Product rules are in
`docs/PRODUCT.md`. Update that file whenever a business rule changes.

- Business rules live in `src/lib/domain/` as pure functions with unit tests. Keep I/O out of them.
- State changes go through `src/lib/server/bookings.ts`. Transitions use conditional
  `updateMany` so a double submit or a webhook retry cannot move money twice.
- Prisma enums mirror the string unions in `src/lib/domain/`. Keep them in sync.
- Without `STRIPE_SECRET_KEY`, payments, KYC and payouts are simulated.
- Check before pushing: `npm test && npm run lint && npm run typecheck && npm run build`.
