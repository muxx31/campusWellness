import crypto from "node:crypto";

// Unambiguous characters only (no 0/O, 1/I/L) so aliases are easy to read aloud.
const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Random, unlinkable to the student's ID or name: e.g. "Anon-7K2QXM".
export const generateAlias = () => {
  const bytes = crypto.randomBytes(6);
  let s = "";
  for (const b of bytes) s += CHARS[b % CHARS.length];
  return `Anon-${s}`;
};
