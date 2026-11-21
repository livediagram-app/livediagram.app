// The addresses of a public site (docs/specs/030-knowledgebase/publishing.md "The public site", blueprint P5 and P6):
// the site's own (`/kb/<site>`), chosen by its Editor, and each page's (`/kb/<site>/<page>`), made from its title.
// Read left to right, character by character: no pattern with repeats, so no input is slow.

export const SITE_ADDRESS_MIN = 3;
export const SITE_ADDRESS_MAX = 48;
export const PAGE_ADDRESS_MAX = 80;

/** Addresses the product keeps for itself or that read as one of its own pages. */
export const RESERVED_SITE_ADDRESSES: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'community',
  'docs',
  'document',
  'explorer',
  'help',
  'home',
  'index',
  'kb',
  'live',
  'liveknowledge',
  'liveworkspace',
  'login',
  'new',
  'og',
  'privacy',
  'robots',
  'search',
  'settings',
  'sign-in',
  'sign-up',
  'sitemap',
  'static',
  'status',
  'support',
  'telemetry',
  'terms',
  'www',
]);

/** Page addresses a site's own routes take (`/kb/<site>/search`, `/kb/<site>/og/...`): a page titled "Search" is
 *  `search-2`. */
export const RESERVED_PAGE_ADDRESSES: ReadonlySet<string> = new Set(['search', 'og']);

const isLowerAlnum = (c: string) => (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');

/** Why a site address cannot be used, or null when it can. */
export function siteAddressRefusal(address: string): 'invalid_address' | 'address_reserved' | null {
  if (address.length < SITE_ADDRESS_MIN || address.length > SITE_ADDRESS_MAX)
    return 'invalid_address';
  let previous = '-';
  for (const c of address) {
    if (c === '-') {
      if (previous === '-') return 'invalid_address';
    } else if (!isLowerAlnum(c)) return 'invalid_address';
    previous = c;
  }
  if (previous === '-') return 'invalid_address';
  return RESERVED_SITE_ADDRESSES.has(address) ? 'address_reserved' : null;
}

/** An address made from a title: accents dropped, lowercased, every run of other characters one hyphen, trimmed,
 *  at most `max` characters (cut at a hyphen where one is near), `fallback` when nothing is left. */
export function addressFrom(title: string, max = PAGE_ADDRESS_MAX, fallback = 'page'): string {
  const plain = title.normalize('NFKD').toLowerCase();
  let out = '';
  let gap = false;
  for (const c of plain) {
    if (isLowerAlnum(c)) {
      if (gap && out) out += '-';
      out += c;
      gap = false;
      if (out.length >= max) break;
    } else if (c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f) {
      // A combining mark (an accent the NFKD split off) joins its letter; anything else is a gap.
      gap = true;
    }
  }
  const cut = out.lastIndexOf('-');
  if (out.length === max && cut > max / 2) out = out.slice(0, cut);
  return out || fallback;
}

/** The site address a knowledgebase is offered first: its name's, padded to the minimum. */
export function defaultSiteAddress(name: string): string {
  let address = addressFrom(name, SITE_ADDRESS_MAX, 'knowledgebase');
  while (address.length < SITE_ADDRESS_MIN) address += '-kb';
  return RESERVED_SITE_ADDRESSES.has(address) ? `${address}-kb` : address;
}

/** `base`, or `base-2`, `base-3` and on: the first that `taken` does not hold. */
export function uniqueAddress(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
