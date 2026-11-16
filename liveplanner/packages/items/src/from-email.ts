// The sender an email card came from (docs/specs/026-plan/email-to-board.md "What a message makes"): the address,
// kept on the card in a plain string field the item store keeps as any unknown field, so no card face draws it and
// the card panel's footer names it ("From email").
export const FROM_EMAIL_FIELD = 'fromEmail';

// The longest address kept (RFC 5321's path limit).
export const FROM_EMAIL_MAX = 254;

/** The field's value for a sender's address, or null for one that cannot be one. */
export function fromEmailValue(address: string): string | null {
  const value = address.trim().toLowerCase();
  const at = value.indexOf('@');
  if (at < 1 || at === value.length - 1 || value.length > FROM_EMAIL_MAX) return null;
  return value;
}

/** The sender's address a card holds, or null. */
export function readFromEmail(v: unknown): string | null {
  return typeof v === 'string' ? fromEmailValue(v) : null;
}
