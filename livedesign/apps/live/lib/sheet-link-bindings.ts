// Charts linked to a liveplanner sheet (docs/specs/009-elements/pie-chart.md "Charts linked to a liveplanner sheet"):
// what this editor hands the shared host (@liveworkspace/workbench components/sheet-links/), stable so its context is
// too. The design's grant, which asks the plan to say when a Sheet changes, and the two telemetry events.
import type { SheetLinkEvent } from '@liveworkspace/workbench/components/sheet-links/SheetLinkedCharts';
import { designGrant } from '@/lib/api/design-grants';
import { track } from '@/lib/telemetry';

export const sheetLinkGrantOf = async (itemId: string): Promise<string | null> =>
  (await designGrant(itemId))?.grant ?? null;

export const trackSheetLink = (event: SheetLinkEvent): void =>
  event === 'ChartSheetLink'
    ? track('Element', 'Changed', 'ChartSheetLink')
    : track('Element', 'Changed', 'ChartSheetUnlink');
