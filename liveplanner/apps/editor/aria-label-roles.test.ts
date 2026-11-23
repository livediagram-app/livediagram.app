import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkAriaLabelRoles } from '@liveworkspace/style-guards/aria-label-roles';

// A name needs a role (docs/specs/004-interface-design/canvas-accessibility.md "Names on elements"): ARIA prohibits
// aria-label on a generic element (a plain span or div), and screen readers drop it, so a lock icon labelled
// "Locked" or a due-date pill labelled "Due Oct 24" said nothing. A labelled indicator is role="img", a loading
// skeleton role="status", a labelled wrapper role="group"; a pill whose words matter speaks them as sr-only text.
// This scans the JSX for an opening span / div / text tag carrying aria-label but no role (a spread may bring one,
// so a tag with `{...` is left alone).
// The rule itself is every editor's (packages/style-guards/src/aria-label-roles.ts); this runs it over this editor's folders.

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIRS = [
  join(ROOT, 'app'),
  join(ROOT, 'components'),
  join(ROOT, '../../packages/ui/src'),
  join(ROOT, '../../../packages/ui/src'),
  // The editor code every editor shares (@liveworkspace/workbench) renders here too, so it is held to the rule as well.
  join(ROOT, '../../../packages/workbench/src'),
];

describe('a name needs a role', () => {
  it('puts no aria-label on a role-less span, div or text tag', () => {
    expect(checkAriaLabelRoles({ root: ROOT, dirs: DIRS })).toEqual([]);
  });
});
