// A model's raw elements made safe to author (livediagram/docs/specs/015-api/mcp-server.md §4.7a). Runs BEFORE
// validation, so a near miss draws correctly rather than failing the call or drawing wrongly. Every
// element takes the text size and layout defaults the editor's own factory
// gives a new one of its kind, and the content-carrying kinds get their fields
// tidied. Input is untrusted JSON: anything not shaped like the field it claims
// to be is left for isValidTab to judge.

import { asText } from '@liveworkspace/model-core/as-text';
import { LOOK_MD_MAX_NODES } from '@liveworkspace/model-core/look-size';
import { createShape } from './shape-factory';
import { createSticky, createText } from './factories';
import { migrateStoredElements } from './stored-elements';
import type { Element as DocElement, ShapeKind } from './index';
import { isRecord } from '@liveworkspace/model-core/is-record';
import { isRetiredElement } from './retired-kinds';

type Raw = Record<string, unknown>;

const str = asText;

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
  // A retired element (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements") is kept exactly as it
  // came: no factory defaults, no tidying.
  if (isRetiredElement(el as { type: string; shape?: unknown })) return el;
  // Every stored-element migration runs first, as on a load (./stored-elements).
  const [current] = migrateStoredElements([el] as unknown as DocElement[]) as unknown as Raw[];
  return normaliseContent(withFactoryDefaults(withTextLabel(current!)));
}

// A label is text. An agent's number or yes/no (a step labelled 5) is written as its text; anything else is left for
// validation to refuse.
function withTextLabel(el: Raw): Raw {
  const label = el.label;
  return typeof label === 'number' || typeof label === 'boolean'
    ? { ...el, label: String(label) }
    : el;
}

// A new element of this kind, as the editor's own factory makes it, one per
// kind (cached: every element of a large diagram asks).
const factoryCache = new Map<string, Raw>();
function factoryOf(el: Raw): Raw | undefined {
  // A shape here is of a kind livehuddle has: normaliseElement returns a retired one before asking.
  const kind = el.type === 'shape' ? `shape:${str(el.shape)}` : str(el.type);
  if (factoryCache.has(kind)) return factoryCache.get(kind);
  const made: Raw | undefined =
    el.type === 'text'
      ? createText(0, 0)
      : el.type === 'sticky'
        ? createSticky(0, 0)
        : el.type === 'shape'
          ? createShape(str(el.shape) as ShapeKind, 0, 0)
          : undefined;
  if (made) factoryCache.set(kind, made);
  return made;
}

// The presentation fields the factory sets that raw JSON usually leaves out.
// Unset, text falls back to 'scale' (filling the box), so a label came out as one giant word; a box drawn in the
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
  return el.type === 'sticky' ? normaliseSticky(el) : el;
}

// A whole element list from the model made safe. Anything that is not an
// array comes back as it was, for validation to reject.
/** An ops-mode update: the model's fields over the element's. */
export function mergeElementUpdate(prev: unknown, patch: unknown): Raw {
  const base = isRecord(prev) ? prev : {};
  if (!isRecord(patch)) return { ...base };
  return { ...base, ...patch };
}

// Raw boxes take the graph look's text size by count (look-size.ts): past LOOK_MD_MAX_NODES labelled boxes, one that
// gives no `textSize` takes `sm` before the factory's `md` fills in, so twenty hand-placed boxes do not wrap their
// names mid-word.
const PLAIN_BOX_EXCLUDED = new Set([
  'code-block',
  'bar-chart',
  'pie-chart',
  'line-chart',
  'legend',
]);
const isPlainBox = (el: unknown): el is Raw =>
  isRecord(el) &&
  el.type === 'shape' &&
  typeof el.label === 'string' &&
  el.label.trim() !== '' &&
  !PLAIN_BOX_EXCLUDED.has(String(el.shape)) &&
  !isRetiredElement(el as { type: string; shape?: unknown });
function withLookTextSize(elements: unknown[], kept: ReadonlySet<string>): unknown[] {
  if (elements.filter(isPlainBox).length <= LOOK_MD_MAX_NODES) return elements;
  return elements.map((el) =>
    isPlainBox(el) && el.textSize === undefined && !kept.has(String(el.id))
      ? { ...el, textSize: 'sm' }
      : el,
  );
}

// `kept` names elements that already exist (a replace that sends a tab's own elements back): the look defaults a new
// raw element takes (`sm` text past 12 boxes) are for content arriving fresh, never a restyle of what
// the person made.
export function normaliseElements<T>(
  elements: T,
  { kept = new Set<string>() }: { kept?: ReadonlySet<string> } = {},
): T {
  if (!Array.isArray(elements)) return elements;
  const sized = withLookTextSize(elements, kept);
  return sized.map(normaliseElement) as T;
}
