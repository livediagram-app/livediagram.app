// The lint of a changeset's result tab (docs/specs/024-agents/page-lint.md "Where it runs", LN23,
// LN31): writes, dry runs and reverts lint the whole tab they leave. A lint that throws never fails the
// write: it logs `[lint] failed` and answers null, which the footer prints as `lint unavailable`.

import type { LintReport } from '@livedesign/api-schema';
import { lintTab, type LintLogger } from '@livedesign/page-lint';
import type { Tab } from '@livedesign/document';

type Where = { documentId: string; tabId: string };

// The lint's own lines, prefixed with where they happened.
export function lintLog(where: Where): LintLogger {
  return (fingerprint, fields) => console.info(fingerprint, { ...where, ...fields });
}

export function lintResult(tab: Pick<Tab, 'elements' | 'layers'>, where: Where): LintReport | null {
  try {
    return lintTab(tab, { log: lintLog(where) });
  } catch (err) {
    console.error('[lint] failed', { where: 'changeset', ...where, error: String(err) });
    return null;
  }
}
