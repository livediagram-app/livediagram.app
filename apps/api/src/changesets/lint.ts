// The lint of a changeset's result tab (docs/specs/024-agents/diagram-lint.md "Where it runs", LN23,
// LN31): writes, dry runs and reverts lint the whole tab they leave. A lint that throws never fails the
// write: it logs `[lint] failed` and answers null, which the footer prints as `lint unavailable`.

import type { LintReport } from '@livediagram/api-schema';
import { lintTab, type LintLogger } from '@livediagram/diagram-lint';
import type { Tab } from '@livediagram/document';

type Where = { documentId: string; tabId: string };

// The lint's own lines, prefixed with where they happened, at the level each names.
function lintLog(where: Where): LintLogger {
  return (fingerprint, fields) => {
    const line = { ...where, ...fields };
    if (fingerprint === '[lint] crossings skipped') console.warn(fingerprint, line);
    else if (fingerprint === '[lint] theme unresolved') console.debug(fingerprint, line);
    else console.info(fingerprint, line);
  };
}

export function lintResult(
  tab: Pick<Tab, 'elements' | 'layers' | 'theme'>,
  where: Where,
): LintReport | null {
  try {
    return lintTab(tab, { log: lintLog(where) });
  } catch (err) {
    console.error('[lint] failed', { where: 'changeset', ...where, error: String(err) });
    return null;
  }
}
