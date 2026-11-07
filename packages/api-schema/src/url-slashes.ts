// Slashes off the ends of an address or path, by a scan rather than a regex. `/\/+$/` looks harmless and is not: it
// is unanchored at the start, so on a value with a long run of slashes not at its end the engine retries from every
// offset, which is quadratic in the length (CodeQL js/polynomial-redos). A base URL is configuration and a path
// comes from the address bar, so every app trims them here, in linear time.

const SLASH = 0x2f;

/** `value` without the slashes it ends with: `https://a.b//` → `https://a.b`, `///` → `''`. */
export function withoutTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === SLASH) end--;
  return value.slice(0, end);
}

/** `value` without the slashes it starts or ends with: `//a/b//` → `a/b`. */
export function withoutEdgeSlashes(value: string): string {
  let start = 0;
  while (start < value.length && value.charCodeAt(start) === SLASH) start++;
  return withoutTrailingSlashes(value.slice(start));
}
