// A page design read from an agent's change (docs/specs/024-agents/pages-for-agents.md "Page designs"): strictly, so
// a misspelt field or a value out of range is refused by name, and an unknown design names the closest ids and the
// families. A design id alone, or its name ("Soft Mesh"), is the design with its own defaults.
import { layoutNamed } from '@liveworkspace/edit-operations/layout-named';
import {
  DESIGN_RANGES,
  PAGE_DESIGNS,
  PAGE_DESIGN_BY_ID,
  PAGE_DESIGN_FAMILIES,
  compactPageDesign,
  isArticleHex,
  isRecord,
  pagesOf,
  pickPageDesign,
  type Tab,
  type PageDesign,
  type PageDesignId,
} from '@livedocuments/document';

export type DesignInputRefusal = { code: 'invalid_value' | 'design_unknown'; message: string };

const PAGE_FIELDS = [
  'id',
  'colors',
  'intensity',
  'scale',
  'angle',
  'focus',
  'seed',
  'blur',
  'grain',
  'calm',
  'variant',
  'animate',
  'speed',
  'guard',
] as const;
// The tab design's switches besides (rhythm and continuity).
const TAB_FIELDS = [...PAGE_FIELDS, 'rhythm', 'flow'] as const;

class DesignRefused extends Error {
  readonly refusal: DesignInputRefusal;
  constructor(refusal: DesignInputRefusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}
const bad = (message: string): never => {
  throw new DesignRefused({ code: 'invalid_value', message });
};

/** The design `asked` names, by id or name; else a refusal naming the closest and the families. */
export function designNamed(asked: string): PageDesignId | DesignInputRefusal {
  const named = layoutNamed(PAGE_DESIGNS, asked);
  if (named.layout) return named.layout.id;
  const families = PAGE_DESIGN_FAMILIES.map(
    (f) =>
      `${f.label}: ${PAGE_DESIGNS.filter((d) => d.family === f.id)
        .map((d) => d.id)
        .join(', ')}`,
  ).join('; ');
  return {
    code: 'design_unknown',
    message: `No page design "${asked}".${named.closest.length ? ` Closest: ${named.closest.join(', ')}.` : ''} The designs, by family: ${families}.`,
  };
}

const num = (v: unknown, field: string, [lo, hi]: readonly [number, number]): number => {
  if (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi) return v;
  return bad(`"design.${field}" is a number from ${lo} to ${hi}.`);
};

function designObject(v: Record<string, unknown>, tab: boolean): PageDesign {
  const allowed: readonly string[] = tab ? TAB_FIELDS : PAGE_FIELDS;
  for (const key of Object.keys(v))
    if (!allowed.includes(key))
      bad(
        `"design" takes no "${key}" (it takes ${allowed.join(', ')})${!tab && (key === 'rhythm' || key === 'flow') ? `; "${key}" is the tab design's, set by tab_design` : ''}.`,
      );
  if (typeof v.id !== 'string') return bad('"design.id" names a design, such as "aurora".');
  const id = designNamed(v.id);
  if (typeof id !== 'string') throw new DesignRefused(id);
  const def = PAGE_DESIGN_BY_ID[id];
  const out: PageDesign = { id };
  if (v.colors !== undefined) {
    if (!Array.isArray(v.colors) || v.colors.length !== 3 || !v.colors.every(isArticleHex))
      bad('"design.colors" is three hex colours, such as ["#0f172a", "#6366f1", "#f59e0b"].');
    out.colors = (v.colors as string[]).map((c) => c.toLowerCase()) as [string, string, string];
  }
  for (const key of ['intensity', 'scale', 'blur', 'grain', 'calm', 'speed'] as const)
    if (v[key] !== undefined) out[key] = num(v[key], key, DESIGN_RANGES[key]);
  if (v.angle !== undefined) out.angle = Math.round(num(v.angle, 'angle', [0, 359]));
  if (v.seed !== undefined) out.seed = Math.round(num(v.seed, 'seed', DESIGN_RANGES.seed));
  if (v.focus !== undefined) {
    if (!Array.isArray(v.focus) || v.focus.length !== 2)
      bad('"design.focus" is [x, y], each 0 to 1 across the page.');
    const [x, y] = v.focus as unknown[];
    out.focus = [num(x, 'focus', [0, 1]), num(y, 'focus', [0, 1])];
  }
  if (v.variant !== undefined) {
    const styles = def.variants?.map((s) => s.id) ?? [];
    if (typeof v.variant !== 'string' || !styles.includes(v.variant))
      bad(
        styles.length
          ? `"design.variant" for ${def.label} is one of ${styles.join(', ')}.`
          : `${def.label} has no styles: leave "variant" out.`,
      );
    out.variant = v.variant as string;
  }
  if (v.animate !== undefined) {
    if (typeof v.animate !== 'boolean') bad('"design.animate" is true or false.');
    if (v.animate && !def.animates)
      bad(
        `${def.label} does not move. The designs that do: ${PAGE_DESIGNS.filter((d) => d.animates)
          .map((d) => d.id)
          .join(', ')}.`,
      );
    if (v.animate) out.animate = true;
  }
  if (v.guard !== undefined && v.guard !== 'scrim' && v.guard !== 'warn')
    bad('"design.guard" is "scrim" (a plate under a hard-to-read text) or "warn".');
  if (v.guard === 'warn') out.guard = 'warn';
  for (const key of ['rhythm', 'flow'] as const) {
    if (v[key] === undefined) continue;
    if (typeof v[key] !== 'boolean') bad(`"design.${key}" is true or false.`);
    if (key === 'flow' && v.flow && !def.flows)
      bad(
        `${def.label} cannot flow across pages. The designs that can: ${PAGE_DESIGNS.filter(
          (d) => d.flows,
        )
          .map((d) => d.id)
          .join(', ')}.`,
      );
    if (v[key]) out[key] = true;
  }
  return compactPageDesign(out);
}

/** A page's design choice: a design, "none" or "tab". */
export function readPageDesign(
  v: unknown,
): PageDesign | 'none' | 'tab' | { refused: DesignInputRefusal } {
  return read(() => {
    if (v === 'none' || v === 'tab') return v;
    if (typeof v === 'string') return { id: designOrThrow(v) };
    if (isRecord(v)) return designObject(v, false);
    return bad(
      '"design" is a design (an id such as "aurora", or {"id": "aurora", ...tuning}), "none" or "tab".',
    );
  });
}

/** The tab's design choice: a design, null or "auto". */
export function readTabDesign(
  v: unknown,
): PageDesign | null | 'auto' | { refused: DesignInputRefusal } {
  return read(() => {
    if (v === null || v === 'auto') return v;
    if (typeof v === 'string') return { id: designOrThrow(v) };
    if (isRecord(v)) return designObject(v, true);
    return bad(
      '"design" is a design (an id such as "aurora", or {"id": "aurora", ...tuning}), null to clear it, or "auto".',
    );
  });
}

function designOrThrow(asked: string): PageDesignId {
  const id = designNamed(asked);
  if (typeof id !== 'string') throw new DesignRefused(id);
  return id;
}

function read<T>(fn: () => T): T | { refused: DesignInputRefusal } {
  try {
    return fn();
  } catch (err) {
    if (err instanceof DesignRefused) return { refused: err.refusal };
    throw err;
  }
}

// The tab's words, for an "auto" design: its name, its pages' names and its texts.
export function tabWords(tab: Tab): string {
  const words = [tab.name ?? ''];
  for (const p of pagesOf(tab)) if (p.name) words.push(p.name);
  for (const el of tab.elements) {
    const label = (el as { label?: unknown }).label;
    if (typeof label === 'string') words.push(label);
  }
  return words.join(' ').slice(0, 20_000);
}

/** The design a tab design choice gives `tab`: "auto" picked for its words. */
export function tabDesignFor(tab: Tab, choice: PageDesign | null | 'auto'): PageDesign | null {
  return choice === 'auto' ? { id: pickPageDesign(tabWords(tab)) } : choice;
}
