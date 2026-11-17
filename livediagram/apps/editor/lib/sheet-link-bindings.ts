// Charts linked to a liveplanner sheet (docs/specs/009-elements/pie-chart.md "Charts linked to a liveplanner sheet"):
// what this editor hands the shared host (@liveworkspace/workbench components/sheet-links/), stable so its context is
// too. The document's grant, which asks the plan to say when a Sheet changes, and the two telemetry events.
import type { SheetLinkEvent } from '@liveworkspace/workbench/components/sheet-links/SheetLinkedCharts';
import { documentGrant } from '@/lib/api/document-grants';
import { track } from '@/lib/telemetry';

export const sheetLinkGrantOf = async (itemId: string): Promise<string | null> =>
  (await documentGrant(itemId))?.grant ?? null;

export const trackSheetLink = (event: SheetLinkEvent): void =>
  event === 'ChartSheetLink'
    ? track('Element', 'Changed', 'ChartSheetLink')
    : track('Element', 'Changed', 'ChartSheetUnlink');
