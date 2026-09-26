import "server-only";
import Stripe from "stripe";

/** Returns null when Stripe is not configured, and the app then simulates payments. */
export const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
