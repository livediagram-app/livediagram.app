// The text of a changeset's answer (blueprint "Result lines", EO43, EO44): the lines are one copy
// for every product; the footer names this product's revert command, and no lint: the diagram lint left livehuddle
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5, D32).

import { createFormatResultFooter } from '@liveworkspace/edit-operations/format-results';
import type { ResultFooter } from './types';

export { formatResultLines, formatValue } from '@liveworkspace/edit-operations/format-results';

type Printed = ResultFooter & { lint: string };

const printFooter = createFormatResultFooter<Printed>(
  (footer) => `livehuddle changeset revert ${footer.documentId} ${footer.changesetId}`,
);

// The shared footer prints a lint part between its others; livehuddle has none, so its place is marked and dropped.
const NO_LINT = '\u0000';

export function formatResultFooter(footer: ResultFooter): string {
  return printFooter({ ...footer, lint: NO_LINT }).replace(` · ${NO_LINT}`, '');
}
