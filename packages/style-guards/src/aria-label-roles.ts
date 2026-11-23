import { readFileSync } from 'node:fs';
import { sourceFiles } from './source-files';

// A name needs a role (each product's docs/specs/004-interface-design/canvas-accessibility.md "Names on elements"):
// ARIA prohibits aria-label on a generic element (a plain span or div), and screen readers drop it, so a lock icon
// labelled "Locked" or a due-date pill labelled "Due Oct 24" said nothing. A labelled indicator is role="img", a
// loading skeleton role="status", a labelled wrapper role="group"; a pill whose words matter speaks them as sr-only
// text. This scans JSX for an opening span / div / text tag carrying aria-label but no role (a spread may bring
// one, so a tag with `{...` is left alone).

// An opening tag, attributes and all, allowing one level of nested braces inside an attribute's expression.
const TAG = /<(span|div|p|i|b|em|strong|small)\b((?:[^<>{}]|\{(?:[^{}]|\{[^{}]*\})*\})*?)\/?>/g;

/** The role-less tags in a JSX source that carry an aria-label: each one's line and tag name. */
export function unnamedRoleTags(source: string): { line: number; tag: string }[] {
  const found: { line: number; tag: string }[] = [];
  for (const m of source.matchAll(TAG)) {
    const attrs = m[2] ?? '';
    if (!/\baria-label=/.test(attrs) || /\brole=/.test(attrs) || /\{\.\.\./.test(attrs)) continue;
    found.push({ line: source.slice(0, m.index).split('\n').length, tag: m[1]! });
  }
  return found;
}

/** Every such tag in the .tsx files under `dirs` (absolute folders), as `path-from-root:line <tag>`. */
export function checkAriaLabelRoles({
  root,
  dirs,
}: {
  root: string;
  dirs: readonly string[];
}): string[] {
  const offenders: string[] = [];
  for (const dir of dirs)
    for (const file of sourceFiles(dir, /\.tsx$/))
      for (const { line, tag } of unnamedRoleTags(readFileSync(file, 'utf8')))
        offenders.push(`${file.slice(root.length)}:${line} <${tag}>`);
  return offenders;
}
