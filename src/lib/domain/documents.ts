import type { TrustTier } from "./trust";

export const DOCUMENT_TYPES = [
  "BIRTH_CERTIFICATE",
  "MARRIAGE_CERTIFICATE",
  "NIN_SLIP",
  "UNIVERSITY_CERTIFICATE",
  "TRANSCRIPT",
  "OTHER",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  BIRTH_CERTIFICATE: "Birth certificate",
  MARRIAGE_CERTIFICATE: "Marriage certificate",
  NIN_SLIP: "NIN slip",
  UNIVERSITY_CERTIFICATE: "University certificate",
  TRANSCRIPT: "Academic transcript",
  OTHER: "Other document",
};

/** The default minimum traveller tier for each document type. Senders can require a higher one. */
export const DOCUMENT_MIN_TIER: Record<DocumentType, TrustTier> = {
  BIRTH_CERTIFICATE: "ID_VERIFIED",
  MARRIAGE_CERTIFICATE: "ID_VERIFIED",
  NIN_SLIP: "ID_VERIFIED",
  UNIVERSITY_CERTIFICATE: "ID_VERIFIED",
  TRANSCRIPT: "ID_VERIFIED",
  OTHER: "AJO_VERIFIED",
};
