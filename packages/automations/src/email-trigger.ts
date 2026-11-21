// An email trigger's From filter (an app whose items take email): one value, an exact address or
// a whole domain, kept trimmed and lower case (a domain as `@example.com`), and whether an email's sender is heard by
// it. Read with a split and a per-character check, never a backtracking pattern (CodeQL polynomial-regex). Pure.
import { automationAddress } from './email-addresses';

// The longest From a rule keeps: an address's most (RFC 5321), so a domain fits too.
export const EMAIL_SENDER_MAX = 254;
const DOMAIN_MAX = 253;
const LABEL_MAX = 63;

const isLabelChar = (c: string): boolean =>
  (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '-';

// A domain's label: 1 to 63 letters, digits or hyphens, never starting or ending with a hyphen.
function isLabel(label: string): boolean {
  if (label.length === 0 || label.length > LABEL_MAX) return false;
  if (label.startsWith('-') || label.endsWith('-')) return false;
  for (const c of label) if (!isLabelChar(c)) return false;
  return true;
}

// Whether `text` (lower case) is a domain of at least two labels.
function isDomain(text: string): boolean {
  if (text.length > DOMAIN_MAX) return false;
  const labels = text.split('.');
  return labels.length >= 2 && labels.every(isLabel);
}

/** The From filter as a rule keeps it, or null when `raw` is neither an address nor a domain: an address trimmed and
 *  lower case; a domain (`example.com` or `@example.com`) as `@example.com`. */
export function emailSenderFilter(raw: string): string | null {
  const text = raw.trim().toLowerCase();
  if (text.length === 0 || text.length > EMAIL_SENDER_MAX) return null;
  if (text.startsWith('@')) return isDomain(text.slice(1)) ? text : null;
  if (text.includes('@')) return automationAddress(text);
  return isDomain(text) ? `@${text}` : null;
}

/** Whether an email from `sender` is heard by the From filter: none hears every sender; a domain hears an address
 *  whose part after its last `@` is exactly that domain (never a subdomain); an address hears itself. Any case. */
export function senderHeard(filter: string | undefined, sender: string): boolean {
  if (!filter) return true;
  const from = sender.trim().toLowerCase();
  const kept = filter.trim().toLowerCase();
  if (!kept.startsWith('@')) return from === kept;
  const at = from.lastIndexOf('@');
  return at > 0 && from.slice(at) === kept;
}
