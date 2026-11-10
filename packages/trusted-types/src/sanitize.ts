// The one HTML sanitiser for every app and liveworkspace.app (livediagram/docs/specs/016-platform/trusted-types.md
// "The sanitiser"): DOMPurify, in its own instance with our rules, minting its result through the markup policy.
// Every sink whose markup carries people's content (a document's drawing, an import, a paste, the network) goes
// through `sanitizedHtml`, whose `SafeHtml` goes into the page by html.ts's sinks like any other (`htmlProps`,
// `setSrcdoc`); `trustedConstant` and `builtMarkup` stay the escape hatch for our own and builder markup. A module of
// its own, so DOMPurify reaches only the chunks that render such markup, never a page's first load that has none.
import createDOMPurify, { type Config, type DOMPurify } from 'dompurify';
import { MARKUP_POLICY } from './csp';
import type { SafeHtml } from './html';
import { htmlPolicy } from './policies';

/**
 * What the markup is and where it goes:
 * - `svg`: a whole `<svg>` drawing, set into an HTML element (a `<div>`).
 * - `svg-content`: the children of an `<svg>` or `<g>`, set into that element.
 * - `document`: a whole HTML page, set as an iframe's `srcdoc`.
 */
export type MarkupProfile = 'svg' | 'svg-content' | 'document';

// DOMPurify's own URL rule, plus `blob:` (a picture's bytes this page holds); a blob: URL is kept on a picture alone.
const ALLOWED_URI =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;
// The elements whose href may load something: a link, and a picture. Every other href (a gradient's, a text path's)
// must point inside the drawing, so nothing outside it is pulled in.
const LOADS_HREF = new Set(['a', 'image', 'img']);
const PICTURE = new Set(['image', 'img']);

const SVG_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_ATTR: ['role', 'target'],
  ALLOWED_URI_REGEXP: ALLOWED_URI,
};
const DOCUMENT_CONFIG: Config = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  ADD_ATTR: ['target'],
  ALLOWED_URI_REGEXP: ALLOWED_URI,
  WHOLE_DOCUMENT: true,
};

const SVG_NS = 'http://www.w3.org/2000/svg';

type Purifier = { purify: DOMPurify; svg: Config; document: Config };
let purifier: Purifier | null | undefined;

// Our own instance (its hook reaches no one else's DOMPurify), made on first use. Under Trusted Types DOMPurify
// parses and answers through the markup policy, the one every header already names, rather than a policy of its own.
function instance(): Purifier | null {
  if (purifier !== undefined) return purifier;
  const win = (globalThis as { window?: Window & typeof globalThis }).window;
  const purify = win ? createDOMPurify(win) : null;
  if (!purify?.isSupported) return (purifier = null);
  purify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName !== 'href' && data.attrName !== 'xlink:href') return;
    const tag = node.nodeName.toLowerCase();
    const value = data.attrValue.trim();
    const kept = LOADS_HREF.has(tag)
      ? !/^blob:/i.test(value) || PICTURE.has(tag)
      : value.startsWith('#');
    if (!kept) data.keepAttr = false;
  });
  const policy = htmlPolicy(MARKUP_POLICY);
  const withPolicy = (config: Config): Config =>
    policy
      ? {
          ...config,
          TRUSTED_TYPES_POLICY: policy as unknown as NonNullable<Config['TRUSTED_TYPES_POLICY']>,
        }
      : config;
  return (purifier = {
    purify,
    svg: withPolicy(SVG_CONFIG),
    document: withPolicy(DOCUMENT_CONFIG),
  });
}

function clean(markup: string, profile: MarkupProfile): string {
  const made = instance();
  // No DOM to parse with (a server render, a worker): nothing is let through rather than everything.
  if (!made) return '';
  const { purify, svg, document } = made;
  if (profile === 'document') return String(purify.sanitize(markup, document));
  if (profile === 'svg') return String(purify.sanitize(markup, svg));
  // Children of an <svg> parse as SVG only inside one: wrapped, cleaned, and unwrapped again (the wrapper is an
  // allowed <svg>, so it always survives).
  const root = purify.sanitize(`<svg xmlns="${SVG_NS}">${markup}</svg>`, {
    ...svg,
    RETURN_DOM_FRAGMENT: true,
  }).firstChild as Element;
  return root.innerHTML;
}

/** `markup` with everything that could run or load script taken out, as a plain string (the sanitised text). */
export function sanitizeMarkup(markup: string, profile: MarkupProfile = 'svg'): string {
  return clean(markup, profile);
}

// The last results, so a re-render handing the same markup back costs a lookup, not a parse. Bounded by entries
// and by the characters held (inputs and results), least recently used first out.
export const SANITISE_CACHE_ENTRIES = 256;
export const SANITISE_CACHE_CHARS = 4_000_000;
type Cached = { profile: MarkupProfile; out: SafeHtml; chars: number };
const cache = new Map<string, Cached>();
let cachedChars = 0;

function forget(markup: string): void {
  cachedChars -= cache.get(markup)!.chars;
  cache.delete(markup);
}

/** Forgets the sanitiser's instance and its cache, so each test starts from a fresh page. */
export function resetSanitizerForTests(): void {
  purifier = undefined;
  cache.clear();
  cachedChars = 0;
}

/** How many results the cache holds, and their characters (for tests). */
export function sanitiseCacheSize(): { entries: number; chars: number } {
  return { entries: cache.size, chars: cachedChars };
}

/**
 * Markup carrying people's content, sanitised (DOMPurify: no script, no event handler, no `javascript:` URL, no
 * `<foreignObject>`, no `<use>`, no href that loads from outside the drawing but a link's or a picture's), as the
 * `SafeHtml` html.ts's sinks take: `htmlProps` for a React element, `setSrcdoc` for an iframe (profile `document`).
 * The sink mints it through the markup policy, so nothing is minted twice. Outside the browser it answers an empty
 * string: there is no DOM to sanitise with, and a server render of people's markup is never wanted.
 */
export function sanitizedHtml(markup: string, profile: MarkupProfile = 'svg'): SafeHtml {
  const hit = cache.get(markup);
  if (hit?.profile === profile) {
    // Most recently used goes last, so the oldest key is the least recently used.
    cache.delete(markup);
    cache.set(markup, hit);
    return hit.out;
  }
  if (hit) forget(markup);
  const out = clean(markup, profile) as SafeHtml;
  const chars = markup.length + out.length;
  if (out !== '' && chars <= SANITISE_CACHE_CHARS) {
    cache.set(markup, { profile, out, chars });
    cachedChars += chars;
    while (cache.size > SANITISE_CACHE_ENTRIES || cachedChars > SANITISE_CACHE_CHARS)
      forget(cache.keys().next().value!);
  }
  return out;
}
