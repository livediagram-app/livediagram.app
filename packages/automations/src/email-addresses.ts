// Send Email's typed-in addresses (liveworkspace/docs/specs/018-automations/automations.md "Steps every app has"):
// what counts as one, how a step's list reads ("ana@example.com and 2 more"), and how typed or pasted text splits
// into addresses. Pure.

// An email address as it is kept: something@domain.tld, no spaces, up to 254 characters.
export const EMAIL_MAX = 254;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmailAddress = (v: string) => v.length <= EMAIL_MAX && EMAIL_PATTERN.test(v);

// Characters a mail header could read as more than one address, or as a name: never in a typed-in address.
const HEADER_UNSAFE = /[<>,;:"()[\]\\]/;

/** The address as a rule keeps it (trimmed, lower case), or null when it is not one: the email check above, with
 *  nothing a header could misread. */
export function automationAddress(raw: string): string | null {
  const address = raw.trim().toLowerCase();
  return address && isEmailAddress(address) && !HEADER_UNSAFE.test(address) ? address : null;
}

/** A step's addresses in words: the first, and how many more ("ana@example.com and 2 more"). */
export function addressWords(addresses: readonly string[], more = 'more'): string {
  const [first = 'nobody'] = addresses;
  return addresses.length > 1 ? `${first} and ${addresses.length - 1} ${more}` : first;
}

/** Typed or pasted text as the addresses in it: split at commas, semicolons, spaces and line breaks, empty parts
 *  dropped. Each is as typed: the caller checks it (automationAddress). */
export const splitAddresses = (text: string): string[] =>
  text.split(/[\s,;]+/).filter((part) => part !== '');
