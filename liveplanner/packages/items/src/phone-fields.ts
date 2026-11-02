// Phone fields (docs/specs/026-plan/item-types.md "Phone"): one phone number, typed freely and kept as typed, checked
// loosely, and called through a `tel:` link. Personal data, treated as an Email is. Pure.

// The longest number a field keeps, and the fewest digits a number has.
export const PHONE_MAX = 32;
export const PHONE_DIGITS_MIN = 3;

// What a number may be made of: one leading +, then digits, spaces, brackets and dashes. One character class, so
// nothing backtracks.
const PHONE_CHARS = /^\+?[\d ()-]+$/;

export const PHONE_HINT = 'Write a phone number like +44 20 7946 0958';

const digitCount = (v: string) => v.replace(/\D/g, '').length;

// Whether `value` (trimmed) is a phone number a field keeps.
export function isPhoneNumber(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return v.length <= PHONE_MAX && PHONE_CHARS.test(v) && digitCount(v) >= PHONE_DIGITS_MIN;
}

// The link that calls a number: `tel:` and its + and digits (`+44 20 7946 0958` → `tel:+442079460958`).
export function phoneHref(value: string): string {
  const v = value.trim();
  return `tel:${v.startsWith('+') ? '+' : ''}${v.replace(/\D/g, '')}`;
}
