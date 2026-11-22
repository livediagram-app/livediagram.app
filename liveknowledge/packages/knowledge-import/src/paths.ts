// Archive paths (docs/specs/020-import-export/blueprints/knowledgebase-import.md "Paths"): normalised once, so a
// path that climbs out of the archive root is refused before anything looks it up.

/** `raw` with forward slashes and no `.`, `..` or empty segments; null when it is empty or climbs out of the root. */
export function normalisePath(raw: string): string | null {
  const parts: string[] = [];
  for (const segment of raw.replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(segment);
    }
  }
  return parts.length > 0 ? parts.join('/') : null;
}

/** The key two spellings of one path share: composed Unicode, case-folded. */
export const keyOf = (path: string): string => path.normalize('NFC').toLowerCase();

export const dirOf = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

export const baseOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** The file name's extension, lower-cased and without its dot; empty when it has none. */
export function extOf(path: string): string {
  const base = baseOf(path);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** The file name without its extension. */
export function stemOf(path: string): string {
  const base = baseOf(path);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

/** A link's %-escapes decoded; a malformed one kept as written. */
export function decodeTarget(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

/** A link's target as an archive path: resolved against `dir`, or from the root when it starts with a slash. */
export function resolveFrom(dir: string, target: string): string | null {
  return normalisePath(target.startsWith('/') ? target : `${dir}/${target}`);
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Names in the order a person lists them: case-blind, `Page 2` before `Page 10`. */
export const compareNames = (a: string, b: string): number => collator.compare(a, b);

const PICTURE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp']);

export const isPicturePath = (path: string): boolean => PICTURE_EXTENSIONS.has(extOf(path));
