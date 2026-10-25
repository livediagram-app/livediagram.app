// The order findings are reported in (blueprint step 4, LN18), shared in `@liveworkspace/diagram-lint`,
// bound to this product's codes in its spec's table order.

import { LINT_CODES, LINT_SEVERITIES, LINT_SEVERITY } from '@livedocuments/api-schema';
import { createSortFindings } from '@liveworkspace/diagram-lint/order';

export const sortFindings = createSortFindings({
  codes: LINT_CODES,
  severities: LINT_SEVERITIES,
  severity: LINT_SEVERITY,
});
