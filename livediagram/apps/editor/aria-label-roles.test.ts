import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A name needs a role (docs/specs/004-interface-design/canvas-accessibility.md "Names on elements"): ARIA prohibits
// aria-label on a generic element (a plain span or div), and screen readers drop it, so a lock icon labelled
// "Locked" or a due-date pill labelled "Due Oct 24" said nothing. A labelled indicator is role="img", a loading
// skeleton role="status", a labelled wrapper role="group"; a pill whose words matter speaks them as sr-only text.
// This scans the JSX for an opening span / div / text tag carrying aria-label but no role (a spread may bring one,
// so a tag with `{...` is left alone).

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIRS = [
  join(ROOT, 'app'),
  join(ROOT, 'components'),
  join(ROOT, '../../packages/ui/src'),
  join(ROOT, '../../../packages/ui/src'),
];
// An opening tag, attributes and all, allowing one level of nested braces inside an attribute's expression.
const TAG = /<(span|div|p|i|b|em|strong|small)\b((?:[^<>{}]|\{(?:[^{}]|\{[^{}]*\})*\})*?)\/?>/g;

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) yield path;
  }
}

describe('a name needs a role', () => {
  it('puts no aria-label on a role-less span, div or text tag', () => {
    const offenders: string[] = [];
    for (const dir of DIRS)
      for (const file of sources(dir)) {
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(TAG)) {
          const attrs = m[2] ?? '';
          if (!/\baria-label=/.test(attrs) || /\brole=/.test(attrs) || /\{\.\.\./.test(attrs))
            continue;
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${file.slice(ROOT.length)}:${line} <${m[1]}>`);
        }
      }
    expect(offenders).toEqual([]);
  });
});
