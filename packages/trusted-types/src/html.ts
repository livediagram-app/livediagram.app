// The one path markup takes into a page (livediagram/docs/specs/016-platform/trusted-types.md "One path for markup").
// Every raw HTML sink of ours lives in this module and nowhere else: `htmlProps` for a React element, `setHtml` and
// `setSrcdoc` for the DOM. Each takes a `SafeHtml`, which only the three constructors below make, so a plain string
// never type-checks at a sink and every place markup enters is one named call to review. The raw HTML guard
// (.github/scripts/raw-html-guard.mjs) fails CI on a sink anywhere else.
import { INERT_PARSE_POLICY, MARKUP_POLICY } from './csp';

declare const vetted: unique symbol;

/**
 * Markup whose source is known: one of our own constants, one of our escaping builders' output, or inline JSON. A
 * branded string, so it reads and concatenates as one, but a plain string is not one.
 */
export type SafeHtml = string & { readonly [vetted]: true };

/**
 * Markup or an inline script written in our own source and fixed at build time (a layout's boot script, an
 * authored SVG string), its only inputs our own constants. Never anything a person or a document supplied.
 */
export function trustedConstant(source: string): SafeHtml {
  return source as SafeHtml;
}

/**
 * What one of our builders produced: the icon, sticker and template SVG builders, the headless tab renderer and its
 * thumbnails and previews. Each escapes every piece of content it places. It is not a sanitiser: call it only on
 * such a builder's output, which is the one way content from a document reaches a sink.
 */
export function builtMarkup(markup: string): SafeHtml {
  return markup as SafeHtml;
}

/** JSON for an inline `<script>` (JSON-LD): no raw `<`, so nothing in it can close the script element. */
export function jsonScript(data: unknown): SafeHtml {
  return JSON.stringify(data).replace(/</g, '\\u003c') as SafeHtml;
}

type HtmlPolicy = { createHTML(input: string): TrustedHTML };
type TrustedTypesFactory = {
  createPolicy(name: string, rules: { createHTML: (input: string) => string }): HtmlPolicy;
};

// One policy per name per page (a second createPolicy with the same name throws); null where the browser has no
// Trusted Types. One module for every app's UI, so a page that renders two apps' components still creates each once.
const policies = new Map<string, HtmlPolicy | null>();
function htmlPolicy(name: string): HtmlPolicy | null {
  if (!policies.has(name)) {
    const factory = (globalThis as { trustedTypes?: TrustedTypesFactory }).trustedTypes;
    policies.set(
      name,
      factory ? factory.createPolicy(name, { createHTML: (input) => input }) : null,
    );
  }
  return policies.get(name)!;
}

/** Forgets the policies made so far, so each test starts from a fresh page. */
export function resetTrustedTypesForTests(): void {
  policies.clear();
}

/**
 * Vetted markup as `TrustedHTML`, through the markup policy. Call it in the browser (a client component, or a root
 * layout): in a server component it runs in the prerender, where there are no Trusted Types, and a client render
 * then meets a plain string. The sinks below call it; nothing else needs to.
 */
export function trustedHtml(markup: SafeHtml): TrustedHTML | string {
  return htmlPolicy(MARKUP_POLICY)?.createHTML(markup) ?? markup;
}

/** The props that give a React element vetted markup, spread into its own props. */
export function htmlProps(markup: SafeHtml): {
  dangerouslySetInnerHTML: { __html: TrustedHTML | string };
} {
  return { dangerouslySetInnerHTML: { __html: trustedHtml(markup) } };
}

/** Replaces an element's children with vetted markup. */
export function setHtml(element: Element, markup: SafeHtml): void {
  element.innerHTML = trustedHtml(markup) as string;
}

/** Sets an iframe's document to vetted markup. */
export function setSrcdoc(frame: HTMLIFrameElement, markup: SafeHtml): void {
  frame.srcdoc = trustedHtml(markup) as string;
}

/** A file a person opened, read through `DOMParser`. The document is inert: nothing in it runs or is inserted. */
export function parseInert(source: string, type: DOMParserSupportedType): Document {
  const policy = htmlPolicy(INERT_PARSE_POLICY);
  return new DOMParser().parseFromString((policy?.createHTML(source) ?? source) as string, type);
}
