// A share's email domains (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Sharing and access"): the
// names a sign-in rule admits, as a person types them in the Share dialog ("@acme.com, liveworkspace.app") and as the
// index stores and checks them. Read in one pass, left to right, with no regular expression, so a long or hostile
// text costs time in its length only.

// The most domains one item's rule holds.
export const SHARE_DOMAINS_MAX = 20;
// The longest domain name DNS allows, and one label of it.
export const SHARE_DOMAIN_MAX = 253;
const LABEL_MAX = 63;
// The longest typed text read at all: 20 domains of 253 characters, with room for separators and @s.
export const SHARE_DOMAINS_TEXT_MAX = 8000;

export type ShareDomainsParse =
  | { ok: true; domains: string[] }
  // `invalid`: the first name that is no domain, as typed; `tooMany`: more than SHARE_DOMAINS_MAX (or a text past
  // SHARE_DOMAINS_TEXT_MAX).
  | { ok: false; invalid: string; tooMany?: false }
  | { ok: false; tooMany: true; invalid?: undefined };

const isSeparator = (c: number) => c === 32 || c === 9 || c === 10 || c === 13 || c === 44; // space, tab, LF, CR, comma
const isLetterOrDigit = (c: number) => (c >= 97 && c <= 122) || (c >= 48 && c <= 57); // a-z 0-9, after lower-casing

/** One typed name as a domain: one leading `@` and one trailing `.` dropped, lower-cased, then each label checked
 *  (1 to 63 of `a-z 0-9 -`, never starting or ending in `-`), at least two labels, 253 characters at most. Null when
 *  it is no domain. */
export function normaliseShareDomain(typed: string): string | null {
  let start = 0;
  let end = typed.length;
  if (typed.charCodeAt(0) === 64) start = 1; // @
  if (end > start && typed.charCodeAt(end - 1) === 46) end -= 1; // .
  const name = typed.slice(start, end).toLowerCase();
  if (name.length === 0 || name.length > SHARE_DOMAIN_MAX) return null;
  let labels = 0;
  let labelStart = 0;
  for (let i = 0; i <= name.length; i++) {
    const c = i === name.length ? 46 : name.charCodeAt(i);
    if (c === 46) {
      const length = i - labelStart;
      if (length === 0 || length > LABEL_MAX) return null;
      if (name.charCodeAt(labelStart) === 45 || name.charCodeAt(i - 1) === 45) return null; // -
      labels += 1;
      labelStart = i + 1;
    } else if (!isLetterOrDigit(c) && c !== 45) {
      return null;
    }
  }
  return labels >= 2 ? name : null;
}

/** Typed text (or a list) as a rule's domains: split at spaces, tabs, new lines and commas, each normalised
 *  (`normaliseShareDomain`), repeats dropped, in the order typed. The first name that is no domain refuses the whole. */
export function parseShareDomains(input: string | readonly string[]): ShareDomainsParse {
  const tokens: string[] = [];
  const texts = typeof input === 'string' ? [input] : input;
  let length = 0;
  for (const text of texts) {
    length += text.length;
    if (length > SHARE_DOMAINS_TEXT_MAX) return { ok: false, tooMany: true };
    let start = -1;
    for (let i = 0; i <= text.length; i++) {
      const separator = i === text.length || isSeparator(text.charCodeAt(i));
      if (separator) {
        if (start !== -1) tokens.push(text.slice(start, i));
        start = -1;
      } else if (start === -1) start = i;
    }
  }
  const domains: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const domain = normaliseShareDomain(token);
    if (domain === null) return { ok: false, invalid: token };
    if (seen.has(domain)) continue;
    seen.add(domain);
    domains.push(domain);
    if (domains.length > SHARE_DOMAINS_MAX) return { ok: false, tooMany: true };
  }
  return { ok: true, domains };
}

/** The domain of an email address: what follows its last `@`, lower-cased; null for none. */
export function emailDomainOf(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

// The public mail providers whose domain says nothing about an organisation: a team item's domain box starts empty
// for someone at one of these, rather than admitting every one of the provider's users (coordinator, 2026-11-22).
export const PUBLIC_MAIL_DOMAINS: readonly string[] = [
  'aol.com',
  'gmail.com',
  'googlemail.com',
  'gmx.com',
  'gmx.de',
  'gmx.net',
  'hey.com',
  'hotmail.co.uk',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'mac.com',
  'mail.com',
  'me.com',
  'msn.com',
  'outlook.com',
  'pm.me',
  'proton.me',
  'protonmail.com',
  'qq.com',
  'yahoo.co.uk',
  'yahoo.com',
  'yandex.com',
  'yandex.ru',
  'zoho.com',
];
const PUBLIC_MAIL = new Set(PUBLIC_MAIL_DOMAINS);

/** Whether a domain is a public mail provider's. */
export const isPublicMailDomain = (domain: string): boolean =>
  PUBLIC_MAIL.has(domain.toLowerCase());

/** The domain a team item's domain box starts with: the sharer's own, unless it is a public mail provider's. */
export function suggestedShareDomain(email: string | null | undefined): string | null {
  const domain = emailDomainOf(email);
  return domain && !isPublicMailDomain(domain) && normaliseShareDomain(domain) ? domain : null;
}
