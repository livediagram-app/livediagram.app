// A chart's ink on a page (docs/specs/007-editor/pages-mode.md "Re-inking", "Charts adapt
// as they are drawn"): a chart's series take their colours from a palette (the tab theme's, the
// chart's own, a slice's own), not from fields re-inking writes, so a page's fill can leave a
// series unreadable (Boardroom's dark slate line on a dark page). Each colour is instead adapted
// as the chart is drawn, against what the chart sits on: under 3:1 it is lightened or darkened,
// keeping its hue, by the least that reaches 3:1; the chart's own small text (axis labels, the
// key) is held to 4.5:1. Never stored. The canvas and every export draw through these, so the two
// match. Pure.
// What finds the ground a chart sits on is @liveworkspace/element-model/chart-page-grounds, bound here to this
// model's pages.
import { chartPageGroundsFor } from '@liveworkspace/element-model/chart-page-grounds';
import { pageAt } from './page';
import { elementAnchorPoint, pageFillTone } from './page-content';
import { layerBands } from './layers';
import { pageGroundUnder } from './page-ink-ground';
import { isBoxed } from './index';

// The adapting itself (the floors, the memory, chartMarkInk and chartTextInk): one copy for every product,
// @liveworkspace/element-model/chart-mark-ink.
export {
  CHART_MARK_CONTRAST,
  CHART_TEXT_CONTRAST,
  CHART_TEXT_TARGET,
  chartMarkInk,
  chartTextInk,
} from '@liveworkspace/element-model/chart-mark-ink';

/**
 * What each chart on a page with a fill of its own sits on, by element id: the tones re-inking
 * would measure it against. A chart on the plain paper, on no page, or over a surface of unknown
 * tone is absent and drawn as it is.
 */
export const chartPageGrounds = chartPageGroundsFor({
  isBoxed,
  pageAt,
  elementAnchorPoint,
  pageFillTone,
  layerBands,
  pageGroundUnder,
});
