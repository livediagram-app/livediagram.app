// Plan mode moved out of livediagram to liveplanner. A tab stored while it was a Board, Sheet, Dashboard or Form tab,
// or while it was in Plan, keeps its ordinary elements and opens in Diagram: its kind and mode, its dashboard and its
// form are dropped, and so are the elements that only drew from Plan's stores (a Plan board, card or view, a Sheet).
// A chart drawn from a sheet keeps its last read data as its own, and loses the range it read it from. Run on every
// stored or incoming tab by the stored-tab migration (./stored-tab), as ./retired-pages is, so no data migration is
// needed: a tab is read the new way wherever it is read, and saved the new way the next time it is saved.
// Pure; the same object back when there is nothing to drop, so the common read allocates nothing.
import { isRecord } from './is-record';

// The tab kinds Plan had.
const RETIRED_KINDS: ReadonlySet<unknown> = new Set(['board', 'sheet', 'dashboard', 'form']);

// The tab fields only Plan read.
const RETIRED_TAB_FIELDS = ['dashboard', 'form'] as const;

// The shapes that drew from Plan's item and sheet stores.
const RETIRED_SHAPES: ReadonlySet<unknown> = new Set([
  'plan-board',
  'plan-card',
  'plan-view',
  'plan-sheet',
]);

// The element fields only a chart drawn from a sheet carried.
const RETIRED_ELEMENT_FIELDS = ['chartSource', 'sheetAnchor'] as const;

/** Whether an element only made sense in Plan: a Plan board, card or view, or a Sheet. */
export function isRetiredPlanElement(el: unknown): boolean {
  return isRecord(el) && el.type === 'shape' && RETIRED_SHAPES.has(el.shape);
}

const carriesRetiredFields = (el: unknown): boolean =>
  isRecord(el) && RETIRED_ELEMENT_FIELDS.some((k) => k in el);

function withoutRetiredFields(el: unknown): unknown {
  if (!carriesRetiredFields(el)) return el;
  const out = { ...(el as Record<string, unknown>) };
  for (const k of RETIRED_ELEMENT_FIELDS) delete out[k];
  return out;
}

/** The tab as it reads with Plan gone: an ordinary tab in Diagram, without its dashboard, form or Plan-only
 *  elements, its sheet charts keeping their data. */
export function dropRetiredPlan<T extends object>(tab: T): T {
  const t = tab as T & Record<string, unknown>;
  const retiredKind = RETIRED_KINDS.has(t.kind);
  const retiredMode = t.opensIn === 'plan';
  const fields = RETIRED_TAB_FIELDS.filter((k) => k in t);
  const elements = Array.isArray(t.elements) ? (t.elements as unknown[]) : undefined;
  const dropsElements = !!elements?.some(isRetiredPlanElement);
  const stripsElements = !!elements?.some(carriesRetiredFields);
  if (!retiredKind && !retiredMode && fields.length === 0 && !dropsElements && !stripsElements) {
    return tab;
  }
  const out = { ...t } as Record<string, unknown>;
  // Absent reads as an ordinary tab (tabKindOf) in Diagram (opensInOf); the editor stamps 'diagram' on its next save.
  if (retiredKind) delete out.kind;
  if (retiredKind || retiredMode) delete out.opensIn;
  for (const k of fields) delete out[k];
  if (dropsElements || stripsElements) {
    out.elements = elements!.filter((el) => !isRetiredPlanElement(el)).map(withoutRetiredFields);
  }
  return out as T;
}
