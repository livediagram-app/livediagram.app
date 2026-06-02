// Renders a schema.org payload as an inline `<script type="application/ld+json">`
// tag, with the canonical `</` -> `<` escape applied to the
// serialised JSON. Extracted because the same four-line pattern was
// duplicated across the root layout (WebSite + SoftwareApplication),
// `/faq` (FAQPage), `/alternatives` (ItemList), and the
// BreadcrumbJsonLd component, with each copy carrying its own
// near-identical "we escape `</` to prevent script-tag injection"
// comment. One canonical spot means a future change to the escape
// rule (e.g. also escaping U+2028 / U+2029 if a parser ever
// complains) lands in a single file, and a build-time misformat in
// the payload surfaces from a single stringify call site.
//
// Why dangerouslySetInnerHTML is safe here: the payload is built at
// build time on a static export, never from user input. The
// `</` escape is the only attack vector for inlined JSON-LD
// (a string value containing `</script>` would otherwise close the
// surrounding script tag), and the replace guards against it.
type JsonLdProps = {
  // The schema.org object to serialise. Typed as `unknown` so each
  // call site can hand in its own concrete shape without a cast.
  data: unknown;
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
