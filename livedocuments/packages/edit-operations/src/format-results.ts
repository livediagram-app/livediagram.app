// The text of a changeset's answer (blueprint "Result lines", EO43, EO44): the lines are one copy
// for every product; the footer names this product's revert command.

import { createFormatResultFooter } from '@liveworkspace/edit-operations/format-results';
import type { ResultFooter } from './types';

export { formatResultLines, formatValue } from '@liveworkspace/edit-operations/format-results';

export const formatResultFooter = createFormatResultFooter<ResultFooter>(
  (footer) => `livedocuments changeset revert ${footer.documentId} ${footer.changesetId}`,
);
