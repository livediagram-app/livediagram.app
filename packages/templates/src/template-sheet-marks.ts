// Whether tabs hold a template's Sheet not yet made (docs/specs/029-sheets/sheet-store.md "Template starts"): a Sheet
// element naming its `start`. Engine-free, so a caller can ask before loading template-sheets.ts and the sheets
// engine it carries.
import type { Tab } from '@livediagram/document';

export function hasTemplateSheets(tabs: readonly Pick<Tab, 'elements'>[]): boolean {
  return tabs.some((t) =>
    t.elements.some(
      (el) => el.type === 'shape' && el.shape === 'plan-sheet' && !!el.planSheet?.start,
    ),
  );
}
