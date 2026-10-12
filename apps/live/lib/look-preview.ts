// A look's card preview (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): the Finish preview's sample
// diagram with the look applied (theme colours, finish, font, canvas colour and pattern), drawn by the tab exporter so
// the card shows exactly what the tab will. Several cards share one page, so the exporter's fixed pattern id is made
// unique per look.
import type { Tab } from '@livediagram/document';
import { renderTabToSvg } from '@/lib/export-tab';
import { FINISH_PREVIEW_ELEMENTS } from '@/lib/finish-preview';
import { withLookApplied, type LookLike } from '@/lib/tab-looks';

const EXPORT_PATTERN_ID = 'lvd-export-bg';

/** The sample tab with the look applied, as a tab of its own. */
export function lookPreviewTab(look: LookLike): Tab {
  const blank = {
    id: `look-${look.id}`,
    name: look.label,
    elements: [...FINISH_PREVIEW_ELEMENTS],
  } as Tab;
  return withLookApplied(blank, look);
}

/** The look's card preview as SVG markup, its ids scoped to the look. */
export function lookPreviewSvg(look: LookLike): string {
  const svg = renderTabToSvg(lookPreviewTab(look));
  return svg.split(EXPORT_PATTERN_ID).join(`lvd-look-${look.id}-bg`);
}
