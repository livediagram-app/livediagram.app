import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSourceIsText } from '@liveworkspace/style-guards/source-is-text';

// Source files must be text, because the tools everyone navigates with give up
// on files that aren't.
//
// `useEditorState.ts` carried a literal NUL and SOH byte for a while: real
// control characters, used as unforgeable separators in a memo key. Runtime
// was fine. `file` classified the module as `data`, and ripgrep answered every
// search of it with "binary file matches" and moved on, which on the 2,800-line
// module that composes every editor hook meant "find all usages" silently
// under-reported: a dead-code sweep read a hook as having a definition and no
// callers, when every call site was in that file. The fix was \uXXXX escapes,
// identical at runtime.
//
// So this guards the property rather than that one file. Scoped to apps/live
// because that is where the hook-composition modules live and where the churn
// is, and because a workspace test reaching across the whole repo would be the
// wrong shape; the same check is cheap to copy if another package ever needs it.
// The rule itself is every editor's (packages/style-guards/src/source-is-text.ts).
const ROOT = fileURLToPath(new URL('../', import.meta.url));
// The editor code every editor shares (@liveworkspace/workbench) is scanned beside this app's own.
const WORKBENCH = join(ROOT, '../../../packages/workbench/src');

describe('apps/live source files are text', () => {
  it('contains no C0 control bytes outside tab / newline / carriage return', () => {
    expect(
      checkSourceIsText({ root: ROOT, dirs: [ROOT, WORKBENCH] }),
      'write control characters as \\uXXXX escapes: a raw byte makes the file unsearchable',
    ).toEqual([]);
  });
});
