// Tab -> text DSL (spec/66). The faithful, human-readable serialization that
// preserves the connection graph: every element keeps its id, and arrows write
// as `id: from -> to` where the endpoints reference node ids (the relationship
// Markdown export throws away). Common fields render positionally; everything
// else flows through the generic attribute codec, so a new model field
// round-trips with no change here. See parse.ts for the inverse.

import type { ArrowElement, Element, Endpoint, Tab } from '../index';
import { encodeValue, quoteString, serializeAttrs } from './codec';

// Tab settings written with a friendly alias instead of the raw field name.
// Everything else on the Tab (backgroundColor, patternColor, defaultTextSize, …)
// is emitted under its real field name by the generic pass below.
const TAB_ALIASES: ReadonlyArray<readonly [alias: string, field: keyof Tab]> = [
  ['theme', 'theme'],
  ['font', 'font'],
  ['background', 'backgroundPattern'],
];

// Never emitted as settings: id (regenerated on import), name (the header),
// elements (the body), and the live session tools (transient, not document
// content — they ride the realtime room, not the text file).
const SKIP_TAB_KEYS = new Set<string>(['id', 'name', 'elements', 'timer', 'vote']);

// Fields consumed positionally on each element, so the attribute block omits them.
const BOXED_CONSUMED = new Set(['id', 'type', 'shape', 'label', 'x', 'y', 'width', 'height']);
const ARROW_CONSUMED = new Set(['id', 'type', 'from', 'to', 'label']);

// A finite number formatted for the DSL (integers bare, decimals kept exact).
function num(n: number): string {
  return Number.isFinite(n) ? String(n) : '0';
}

// An endpoint in DSL syntax: `(x,y)` free, `arrowId@t` on-arrow, or
// `nodeId.anchor` pinned (`!` suffix marks a hand-set / manual anchor).
function encodeEndpoint(ep: Endpoint): string {
  if (ep.kind === 'free') return `(${num(ep.x)},${num(ep.y)})`;
  if (ep.kind === 'on-arrow') return `${ep.arrowId}@${num(ep.t)}`;
  return `${ep.elementId}.${ep.anchor}${ep.manual ? '!' : ''}`;
}

function serializeArrow(el: ArrowElement): string {
  const label = el.label ? ` ${quoteString(el.label)}` : '';
  const attrs = serializeAttrs(el as unknown as Record<string, unknown>, ARROW_CONSUMED);
  return `${el.id}: ${encodeEndpoint(el.from)} -> ${encodeEndpoint(el.to)}${label}${attrs}`;
}

function serializeBoxed(el: Element): string {
  const rec = el as unknown as Record<string, unknown>;
  // Shape elements key on their `shape`; every other boxed kind keys on `type`.
  const kind = el.type === 'shape' ? (rec.shape as string) : el.type;
  const label = typeof rec.label === 'string' && rec.label ? ` ${quoteString(rec.label)}` : '';
  const geo = ` @${num(rec.x as number)},${num(rec.y as number)} ${num(rec.width as number)}x${num(
    rec.height as number,
  )}`;
  const attrs = serializeAttrs(rec, BOXED_CONSUMED);
  return `${el.id} ${kind}${label}${geo}${attrs}`;
}

function serializeElement(el: Element): string {
  return el.type === 'arrow' ? serializeArrow(el) : serializeBoxed(el);
}

// Render a whole tab as a `.lvd` document. One `diagram` block: settings first,
// then a blank line, then one statement per element in array order (so z-order
// round-trips). The trailing newline keeps the file POSIX-clean.
export function serializeTab(tab: Tab): string {
  const lines: string[] = [`diagram ${quoteString(tab.name ?? '')} {`];

  const handled = new Set<string>(SKIP_TAB_KEYS);
  const settings: string[] = [];
  for (const [alias, field] of TAB_ALIASES) {
    handled.add(field);
    const value = tab[field];
    if (value !== undefined) settings.push(`  ${alias}: ${encodeValue(value)}`);
  }
  for (const key of Object.keys(tab)) {
    if (handled.has(key)) continue;
    const value = (tab as Record<string, unknown>)[key];
    if (value !== undefined) settings.push(`  ${key}: ${encodeValue(value)}`);
  }

  lines.push(...settings);
  if (settings.length > 0 && tab.elements.length > 0) lines.push('');
  for (const el of tab.elements) lines.push(`  ${serializeElement(el)}`);
  lines.push('}');
  return lines.join('\n') + '\n';
}
