// The features index's meta description, made from the catalogue (docs/specs/018-help/help-app.md "SEO"), so it
// names every feature category in the registry's order and never drifts from the page, which lists the same ones:
// "Browse <product> feature guides by area: A, B, and C." A search result shows about 160 characters; a catalogue
// whose list would run past that names as many as fit and ends "and more.".

export const FEATURES_DESCRIPTION_MAX = 160;

export function featuresDescription(product: string, areas: readonly string[]): string {
  const lead = `Browse ${product} feature guides by area`;
  if (areas.length === 0) return `${lead}.`;
  const list = (names: readonly string[]) =>
    names.length === 1
      ? names[0]!
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
  const whole = `${lead}: ${list(areas)}.`;
  if (whole.length <= FEATURES_DESCRIPTION_MAX) return whole;
  for (let n = areas.length - 1; n > 0; n--) {
    const some = `${lead}: ${areas.slice(0, n).join(', ')}, and more.`;
    if (some.length <= FEATURES_DESCRIPTION_MAX) return some;
  }
  return `${lead}.`;
}
