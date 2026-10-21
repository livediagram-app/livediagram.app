// Slug ids: a name folded to lowercase letters and digits joined by single hyphens, cut to a
// length, with `-2`, `-3` … on a clash. Shared by item type, field and tab ids here and by the
// element ids agents add (@livediagram/document element-refs), so both mint ids the same way.

// A name's slug: accents folded away, every other run of non-alphanumerics one hyphen, none at
// either end. Uncut.
export function slugText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// A slug cut to `max` characters, without a hyphen left dangling at the cut.
export function cutSlug(base: string, max: number): string {
  return base.slice(0, max).replace(/-+$/, '');
}

// `base`, or the first of `base-2`, `base-3` … not in `taken`, every candidate at most `max` long.
export function uniqueSlug(base: string, taken: ReadonlySet<string>, max: number): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${cutSlug(base, max - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
