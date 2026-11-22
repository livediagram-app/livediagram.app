// UI·Opened charts, each a home for what it counts: Other Panels Opened (./features.ts) counts what no home claims.
// Not re-exported by ../metric-catalogue, which lists charts only.

import type { Metric } from '../../_shared/metric-series';
import { chart } from '../../_shared/catalogue-helpers';

export const OPENED_HOMES: ((type: string | null) => boolean)[] = [];

export const openedChart = (
  title: string,
  blurb: string,
  typeIn: (type: string | null) => boolean,
): Metric => {
  OPENED_HOMES.push(typeIn);
  return chart('UI', 'Opened', title, blurb, { typeIn });
};
