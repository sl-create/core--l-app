import type { Level } from "./levels";

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

/** The minimum traveller level for each document type. Senders can require a higher one. */
export const DOCUMENT_MIN_LEVEL: Record<DocumentType, Level> = {
  BIRTH_CERTIFICATE: "ARINRIN_AJO",
  MARRIAGE_CERTIFICATE: "ARINRIN_AJO",
  NIN_SLIP: "ARINRIN_AJO",
  UNIVERSITY_CERTIFICATE: "ARINRIN_AJO",
  TRANSCRIPT: "ARINRIN_AJO",
  OTHER: "OLOOOTO",
};
