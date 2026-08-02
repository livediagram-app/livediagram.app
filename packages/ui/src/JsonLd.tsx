// Renders a schema.org payload as an inline `<script type="application/ld+json">`.
// Marketing and the help centre both emit structured data (spec/16, spec/55)
// and each had grown its own copy of this component.
//
// The two copies had diverged on the thing that matters: marketing replaced
// every `<` with its unicode escape, help did not. Without it, a payload string
// containing `</script>` closes the surrounding script tag and the rest of the
// JSON lands in the document as markup. Help's payloads are built from the
// article registry rather than from user input, so nothing exploited it, but
// one app being hardened and the other not is the drift worth removing. The
// escaping version is the one kept.
//
// Why dangerouslySetInnerHTML is safe here: the payload is built at build time
// on a static export, never from user input. The `</` escape is the only
// attack vector for inlined JSON-LD, and the replace covers it.
//
// `suppressHydrationWarning` comes from the help copy. React does not emit it
// as an attribute, so it changes no output; it silences a hydration warning on
// a tag whose content React does not own.
export function JsonLd({
  // The schema.org object (or array of them) to serialise. Typed as `unknown`
  // so each call site can hand in its own concrete shape without a cast.
  data,
}: {
  data: unknown;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
      suppressHydrationWarning
    />
  );
}
