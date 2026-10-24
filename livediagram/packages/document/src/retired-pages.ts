// Pages mode moved out of livediagram to livedocuments. A tab stored while it was in Pages keeps its ordinary elements
// and opens in Diagram: its mode (`opensIn: 'pages'`, or its older names), its pages, its articles and the legacy
// single-page orientation are dropped, and so are the elements that only made sense on a page (a tab window, an
// article's margin note). Run on every stored or incoming tab by the stored-tab migration (./stored-tab), so no data
// migration is needed: a tab is read the new way wherever it is read, and saved the new way the next time it is saved.
// Pure; the same object back when there is nothing to drop, so the common read allocates nothing.
import { isRecord } from '@liveworkspace/document-core/is-record';

// The modes a stored tab may carry from Pages: its id, and its two older names.
const RETIRED_MODES: ReadonlySet<unknown> = new Set(['pages', 'illustrate', 'infographic']);

// The tab fields only Pages read.
const RETIRED_TAB_FIELDS = ['pages', 'articles', 'pageOrientation'] as const;

/** Whether an element only made sense in Pages: a tab window (a slide's window onto another tab), or an article's
 *  margin note (an annotation beside an article's text). */
export function isRetiredPagesElement(el: unknown): boolean {
  if (!isRecord(el)) return false;
  if (el.type === 'shape' && el.shape === 'tab-window') return true;
  return el.type === 'annotation' && el.articleNote !== undefined;
}

/** The tab as it reads with Pages gone: in Diagram, without its pages, articles or Pages-only elements. */
export function dropRetiredPages<T extends object>(tab: T): T {
  const t = tab as T & Record<string, unknown>;
  const retiredMode = RETIRED_MODES.has(t.opensIn);
  const fields = RETIRED_TAB_FIELDS.filter((k) => k in t);
  const elements = Array.isArray(t.elements) ? (t.elements as unknown[]) : undefined;
  const dropsElements = !!elements?.some(isRetiredPagesElement);
  if (!retiredMode && fields.length === 0 && !dropsElements) return tab;
  const out = { ...t } as Record<string, unknown>;
  // Absent reads as Diagram (opensInOf).
  if (retiredMode) delete out.opensIn;
  for (const k of fields) delete out[k];
  if (dropsElements) out.elements = elements!.filter((el) => !isRetiredPagesElement(el));
  return out as T;
}
