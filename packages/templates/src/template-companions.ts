// Companion Sheets (docs/specs/026-plan/plan-templates.md "How a template with tabs is made"): three Diagram
// templates make a second tab after their drawing, a Sheet of the live numbers behind it, filling its tab and opening
// in Plan. The drawing keeps the template's own canvas (pattern, layers, mode); the companion takes the theme only,
// so it is the same Sheet tab Start Planning would make.
import type { TemplateStartId } from '@livediagram/sheets';
import type { Element } from '@livediagram/document';
import type { TemplateTabDef } from './build-template';
import { sheetTabDef } from './template-builders-plan';
import type { TemplateKind } from './templates';

type Companion = {
  // The drawing's tab name, then the Sheet's.
  diagram: string;
  sheet: string;
  start: TemplateStartId;
};

// The Sheet's size before it fills its tab (a fresh tab frames itself), as the spreadsheet templates' are.
const SHEET_W = 1100;
const SHEET_H = 560;

// The templates that make one, each named for its kind (and its Sheet's template start).
export type CompanionTemplateKind = 'threat-model' | 'metric-tree' | 'value-stream-map';

export const TEMPLATE_COMPANION_SHEETS: Readonly<Record<CompanionTemplateKind, Companion>> = {
  'threat-model': { diagram: 'Threat Model', sheet: 'Threat Register', start: 'threat-model' },
  'metric-tree': { diagram: 'Metric Tree', sheet: 'Driver Model', start: 'metric-tree' },
  'value-stream-map': { diagram: 'Value Stream', sheet: 'Flow Data', start: 'value-stream-map' },
};

// A companion template's two tabs: the drawing (`build`), then its Sheet; null for every other template.
export function companionTemplateTabs(
  kind: TemplateKind,
  build: (cx: number, cy: number) => Element[],
): TemplateTabDef[] | null {
  const c = (TEMPLATE_COMPANION_SHEETS as Partial<Record<string, Companion>>)[kind];
  if (!c) return null;
  return [
    { name: c.diagram, build },
    {
      ...sheetTabDef(c.sheet, { start: c.start, width: SHEET_W, height: SHEET_H, fillTab: true }),
      ownCanvas: true,
    },
  ];
}
