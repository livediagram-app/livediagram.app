// A model's raw elements made safe to author (docs/specs/015-api/mcp-server.md §4.7a). Runs BEFORE
// validation, so a near miss draws correctly rather than failing the call (an
// unknown code language used to reject the whole tab) or drawing wrongly (a
// lane with no title alignment put its title strip down the middle). Every
// element takes the text size and layout defaults the editor's own factory
// gives a new one of its kind, and the content-carrying kinds get their fields
// tidied. Input is untrusted JSON: anything not shaped like the field it claims
// to be is left for isValidTab to judge.

import { CODE_LANGUAGES } from './data-shapes';
import { isCodeThemeId } from './code-themes';
import { variantFitsKind } from './chart-types';
import { entityHeight } from './entity-geometry';
import { settleChips } from './attachment';
import { createShape } from './shape-factory';
import { createSticky, createTable, createText } from './factories';
import { migrateStoredElementsUnsettled } from './stored-elements';
import { normalizeTable } from './table';
import { coerceShapeKind } from './validate';
import type { Element as DocElement, TableElement, TextSize } from './index';
import { isRecord } from './is-record';
import {
  cleanSankeyName,
  SANKEY_ALIGNS,
  SANKEY_LEFTOVERS,
  SANKEY_ANIMS,
  SANKEY_LINK_COLORS,
  SANKEY_MAX_FLOWS,
  SANKEY_MAX_NODES,
  SANKEY_UNIT_MAX,
  SANKEY_VALUE_LABELS,
  SANKEY_VALUE_MAX,
} from './sankey-model';
import { readSankeyNumber } from './sankey-text';

type Raw = Record<string, unknown>;

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function normaliseTable(el: Raw): Raw {
  const cells = el.cells;
  if (!Array.isArray(cells) || !cells.every(Array.isArray)) return el;
  const stringCells = (cells as unknown[][]).map((row) => row.map(str));
  return normalizeTable({ ...el, cells: stringCells } as unknown as TableElement) as unknown as Raw;
}

function normaliseCodeBlock(el: Raw): Raw {
  const out = { ...el };
  if (
    out.codeLanguage !== undefined &&
    !(CODE_LANGUAGES as readonly unknown[]).includes(out.codeLanguage)
  )
    out.codeLanguage = 'plain';
  if (out.codeTheme !== undefined && !isCodeThemeId(out.codeTheme as string)) delete out.codeTheme;
  return out;
}

// An entity grows to show every row: the render stops drawing rows that run
// past the box.
function normaliseEntity(el: Raw): Raw {
  const rows = Array.isArray(el.entityFields) ? el.entityFields.length : 0;
  const needed = entityHeight(rows, el.textSize as TextSize | undefined);
  return typeof el.height === 'number' && el.height < needed ? { ...el, height: needed } : el;
}

function normaliseChart(el: Raw): Raw {
  const out = { ...el };
  // A variant its kind does not take (docs/specs/009-elements/pie-chart.md "Chart types") draws as the kind's first
  // type anyway; dropped, so what is stored says what is drawn.
  if (out.chartVariant !== undefined && !variantFitsKind(String(el.shape), out.chartVariant))
    delete out.chartVariant;
  if (Array.isArray(el.pieSlices))
    out.pieSlices = el.pieSlices.filter(isRecord).map((s) => ({
      ...s,
      label: str(s.label),
      value: Math.max(0, num(s.value)),
    }));
  if (Array.isArray(el.lineCategories)) out.lineCategories = el.lineCategories.map(str);
  if (Array.isArray(el.lineSeries)) {
    const count = Array.isArray(out.lineCategories) ? out.lineCategories.length : undefined;
    out.lineSeries = el.lineSeries.filter(isRecord).map((s) => {
      const values = Array.isArray(s.values) ? s.values.map(num) : [];
      const fitted =
        count === undefined ? values : Array.from({ length: count }, (_, i) => values[i] ?? 0);
      return { ...s, name: str(s.name), values: fitted };
    });
  }
  return out;
}

// A Sankey's flows as a model writes them (docs/specs/009-elements/sankey.md): `source` / `target` (the
// d3-sankey spelling) read as `from` / `to`, an amount given as text ("3,200") is read as a number, names are
// cleaned as the editor cleans them, and the lists are capped. An option the diagram does not know is dropped,
// so it draws its default rather than failing the call.
function normaliseSankey(el: Raw): Raw {
  const out = { ...el };
  if (Array.isArray(el.sankeyFlows))
    out.sankeyFlows = el.sankeyFlows
      .filter(isRecord)
      .slice(0, SANKEY_MAX_FLOWS)
      .map((f) => {
        const raw = f.value ?? f.amount;
        const value = typeof raw === 'number' ? raw : readSankeyNumber(str(raw));
        return {
          from: cleanSankeyName(str(f.from ?? f.source)),
          to: cleanSankeyName(str(f.to ?? f.target)),
          value: Number.isFinite(value)
            ? Math.max(-SANKEY_VALUE_MAX, Math.min(SANKEY_VALUE_MAX, value))
            : 0,
        };
      });
  if (Array.isArray(el.sankeyNodes))
    out.sankeyNodes = el.sankeyNodes
      .filter(isRecord)
      .slice(0, SANKEY_MAX_NODES)
      .map((n) => ({
        name: cleanSankeyName(str(n.name)),
        ...(typeof n.color === 'string' && n.color ? { color: n.color.slice(0, 64) } : {}),
        ...(n.leftover === false ? { leftover: false } : {}),
      }));
  const options: [string, readonly string[]][] = [
    ['sankeyLinkColor', SANKEY_LINK_COLORS],
    ['sankeyAlign', SANKEY_ALIGNS],
    ['sankeyValueLabel', SANKEY_VALUE_LABELS],
    ['sankeyAnim', SANKEY_ANIMS],
    ['sankeyLeftover', SANKEY_LEFTOVERS],
  ];
  for (const [field, values] of options)
    if (out[field] !== undefined && !values.includes(out[field] as string)) delete out[field];
  if (out.sankeyUnit !== undefined) {
    const unit = str(out.sankeyUnit).trim().slice(0, SANKEY_UNIT_MAX);
    if (unit) out.sankeyUnit = unit;
    else delete out.sankeyUnit;
  }
  if (out.sankeyLeftoverName !== undefined) {
    const name = cleanSankeyName(str(out.sankeyLeftoverName));
    if (name) out.sankeyLeftoverName = name;
    else delete out.sankeyLeftoverName;
  }
  return out;
}

// A sticky given a colour takes the palette's borderless look: its default
// border is the classic amber, which ringed a blue note in yellow.
function normaliseSticky(el: Raw): Raw {
  return el.fillColor !== undefined && el.strokeColor === undefined
    ? { ...el, strokeColor: 'transparent' }
    : el;
}

// One element made safe (the edits path runs this on just the elements an
// edit touched, leaving the rest of the diagram as it is).
export function normaliseElement(el: unknown): unknown {
  if (!isRecord(el)) return el;
  // A stroke in a former stored shape (docs/specs/006-document/stroke-points.md) is packed first.
  // Unsettled: a lone element's host is not beside it, so settling it here would detach it; normaliseElements settles
  // the whole list.
  const [current] = migrateStoredElementsUnsettled([
    el,
  ] as unknown as DocElement[]) as unknown as Raw[];
  return normaliseContent(withFactoryDefaults(current!));
}

// A new element of this kind, as the editor's own factory makes it, one per
// kind (cached: every element of a large diagram asks).
const factoryCache = new Map<string, Raw>();
function factoryOf(el: Raw): Raw | undefined {
  const kind = el.type === 'shape' ? `shape:${coerceShapeKind(str(el.shape))}` : str(el.type);
  if (factoryCache.has(kind)) return factoryCache.get(kind);
  const made: Raw | undefined =
    el.type === 'text'
      ? createText(0, 0)
      : el.type === 'sticky'
        ? createSticky(0, 0)
        : el.type === 'table'
          ? createTable(0, 0)
          : el.type === 'shape'
            ? createShape(coerceShapeKind(str(el.shape)), 0, 0)
            : undefined;
  if (made) factoryCache.set(kind, made);
  return made;
}

// The presentation fields the factory sets that raw JSON usually leaves out.
// Unset, text falls back to 'scale' (filling the box), so a lane or entity
// title came out as one giant word across its contents, and a lane or entity
// with no title alignment put its title in the wrong place; a box drawn in the
// editor never arrives that way.
const FACTORY_DEFAULTS = ['textSize', 'textAlignX', 'textAlignY', 'padding'] as const;

function withFactoryDefaults(el: Raw): Raw {
  const made = factoryOf(el);
  if (!made) return el;
  const defaults: Raw = {};
  for (const key of FACTORY_DEFAULTS) if (made[key] !== undefined) defaults[key] = made[key];
  return { ...defaults, ...el };
}

function normaliseContent(el: Raw): unknown {
  if (el.type === 'table') return normaliseTable(el);
  if (el.type === 'sticky') return normaliseSticky(el);
  if (el.type !== 'shape') return el;
  switch (el.shape) {
    case 'code-block':
      return normaliseCodeBlock(el);
    case 'entity':
      return normaliseEntity(el);
    case 'bar-chart':
    case 'pie-chart':
    case 'line-chart':
      return normaliseChart(el);
    case 'sankey':
      return normaliseSankey(el);
    default:
      return el;
  }
}

const isLane = (el: unknown) => isRecord(el) && el.type === 'shape' && el.shape === 'lane';

// Lanes moved to the front (their order kept) so they paint behind what they
// hold, and so each is the backmost box under its contents.
export function lanesToFront<T>(elements: T[]): T[] {
  if (!elements.some(isLane)) return elements;
  return [...elements.filter(isLane), ...elements.filter((el) => !isLane(el))];
}

// A whole element list from the model made safe. Anything that is not an
// array comes back as it was, for validation to reject.
/**
 * An ops-mode update: the model's fields over the element's. Points the model sends in the former
 * `{ nx, ny }` shape replace the stroke's packed ones (docs/specs/006-document/stroke-points.md):
 * left beside them, the migration would keep the old block and drop the new points.
 */
export function mergeElementUpdate(prev: unknown, patch: unknown): Raw {
  const base = isRecord(prev) ? prev : {};
  if (!isRecord(patch)) return { ...base };
  if (!('points' in patch)) return { ...base, ...patch };
  const { packedPoints: _replaced, ...unpacked } = base;
  return { ...unpacked, ...patch };
}

export function normaliseElements<T>(elements: T): T {
  if (!Array.isArray(elements)) return elements;
  // An agent's badges and step numbers land fitted, numbered and on their hosts' points, as the editor's commits
  // keep them (docs/specs/009-elements/badge.md "Agents").
  const normalised = lanesToFront(elements.map(normaliseElement));
  // Only a list of element records is settled; anything else is left for validation to refuse.
  if (!normalised.every(isRecord)) return normalised as T;
  return settleChips([], normalised as DocElement[]) as T;
}
