// Text DSL -> Tab (spec/66). The inverse of serialize.ts, and the import side of
// the round-trip. Tolerant by design: comments + whitespace are free, edges may
// reference nodes declared later (the whole body is read before elements are
// built), an unknown id resolves to an implicit node so a rough sketch still
// renders, and unknown attribute keys are kept verbatim rather than rejected.
//
// Hand-authored files routinely omit geometry (`a -> b` with no coordinates);
// when the nodes carry no real arrangement we hand the graph to the shared
// auto-layout (spec/47), exactly as the MCP server does for un-positioned
// model output (spec/62). Bare pinned endpoints (`a -> b`, no `.anchor`) get an
// anchor chosen from the final node positions so the arrows look deliberate.

import type { Anchor, ArrowElement, Element, Endpoint, ShapeKind, Tab } from '../index';
import { autoLayoutElements } from '../auto-layout';
import { SHAPE_DEFAULT_SIZE } from '../factories';
import { ANCHORS, ELEMENT_TYPES, isValidTab, SHAPE_KINDS } from '../validate';
import { parseAttrs, splitTrailingAttrs } from './codec';

export type ParseResult = { tab: Tab; warnings: string[] };

// Default box for a non-shape element kind that omitted its `WxH`. Shapes fall
// back to SHAPE_DEFAULT_SIZE instead. Mirrors the editor's element factories.
const NONSHAPE_DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
  text: { width: 220, height: 64 },
  sticky: { width: 200, height: 200 },
  table: { width: 360, height: 150 },
  image: { width: 200, height: 150 },
  freehand: { width: 200, height: 150 },
  annotation: { width: 56, height: 56 },
  'link-card': { width: 280, height: 120 },
};

// Non-arrow element types the DSL keys on directly (`<id> table …`). Shape kinds
// are handled separately so a kind like `square` resolves to a shape element.
const NONSHAPE_TYPES = new Set([...ELEMENT_TYPES].filter((t) => t !== 'arrow' && t !== 'shape'));

// A pinned endpoint whose anchor the author left implicit — resolved to a real
// Anchor from final geometry once every node is placed (see resolveAutoAnchors).
type EndpointDraft = Endpoint | { kind: 'pinned-auto'; elementId: string };

type ArrowDraft = {
  id: string;
  from: EndpointDraft;
  to: EndpointDraft;
  label?: string;
  attrs: Record<string, unknown>;
  order: number;
};

// Parse a `.lvd` document into a Tab + any non-fatal warnings. Throws only on a
// structurally broken file (no `diagram { … }` block, malformed attribute JSON);
// callers wrap that to surface a friendly message.
export function parseTab(source: string): ParseResult {
  const warnings: string[] = [];
  const { name, body } = extractBlock(source);

  // Ordered placeholders so element order (z-order) survives the round-trip:
  // nodes fill their slot immediately, edges leave a hole filled after the
  // whole body is read (so an edge can reference a later-declared node).
  const slots: (Element | null)[] = [];
  const nodesById = new Map<string, Element>();
  const arrowDrafts: ArrowDraft[] = [];
  const settings: Record<string, unknown> = {};
  // Endpoints written without an explicit anchor (`a -> b`): keyed `id|from` /
  // `id|to` so resolveAutoAnchors knows which to fill from geometry.
  const autoEnds = new Set<string>();
  let anyExplicitPos = false;
  let autoArrowSeq = 0;

  for (const stmt of splitStatements(body)) {
    if (hasArrow(stmt)) {
      arrowDrafts.push(parseEdge(stmt, slots.length, () => `arrow-${++autoArrowSeq}`, warnings));
      slots.push(null);
    } else if (/^[A-Za-z_][A-Za-z0-9_-]*\s*:/.test(stmt)) {
      Object.assign(settings, parseAttrs(stmt));
    } else {
      const node = parseNode(stmt, warnings);
      if (!node) continue;
      anyExplicitPos = anyExplicitPos || node.explicitPos;
      nodesById.set(node.el.id, node.el);
      slots.push(node.el);
    }
  }

  // Materialize arrows, back-filling their slots and recording bare endpoints.
  for (const draft of arrowDrafts) {
    if (draft.from.kind === 'pinned-auto') autoEnds.add(`${draft.id}|from`);
    if (draft.to.kind === 'pinned-auto') autoEnds.add(`${draft.id}|to`);
    slots[draft.order] = buildArrow(draft, nodesById, warnings);
  }

  let elements = slots.filter((e): e is Element => e !== null);

  // No coordinates anywhere (hand-authored `a -> b`): let the shared graph
  // layout place the nodes + anchor the arrows. When ANY node carried an
  // explicit `@x,y` we trust the author's positions verbatim — so an exported
  // diagram round-trips position-exact even when its nodes sit close together.
  if (!anyExplicitPos) {
    elements = autoLayoutElements(elements);
  }

  // Bare pinned endpoints still need a concrete anchor facing the other end.
  elements = resolveAutoAnchors(elements, autoEnds);

  const tab: Tab = { id: crypto.randomUUID(), name, elements, ...applyTabSettings(settings) };
  if (!isValidTab(tab)) {
    warnings.push('The parsed diagram failed structural validation; some elements may be invalid.');
  }
  return { tab, warnings };
}

// --- Block + statement splitting ------------------------------------------

// Pull the diagram name + body out of `diagram "Name" { … }`. The body is the
// text between the opening brace and its match (brace-aware, so attribute blocks
// inside don't end it early).
function extractBlock(source: string): { name: string; body: string } {
  const header = /diagram\s+("(?:[^"\\]|\\.)*")\s*\{/.exec(source);
  if (!header) throw new Error('Expected a `diagram "…" { … }` block.');
  const name = JSON.parse(header[1]!) as string;
  // The block brace is the one the header regex matched (its last char), NOT
  // the first `{` after `diagram` — a `{` inside the quoted name would fool an
  // indexOf search.
  const open = header.index + header[0].length - 1;
  const close = matchBrace(source, open);
  return { name, body: source.slice(open + 1, close) };
}

// Index of the `}` matching the `{` at `open`, ignoring braces inside strings.
function matchBrace(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      i = skipString(s, i);
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  throw new Error('Unterminated `diagram { … }` block.');
}

function skipString(s: string, start: number): number {
  for (let i = start + 1; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === '"') return i;
  }
  return s.length;
}

// One statement per non-empty line, with `#` line comments stripped (quote-aware
// so a `#` inside a label survives).
function splitStatements(body: string): string[] {
  return body
    .split('\n')
    .map(stripComment)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function stripComment(line: string): string {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '#') return line.slice(0, i);
  }
  return line;
}

// True when the statement has a top-level `->` (the edge marker) outside any
// quoted string, so a node whose label contains "A -> B" isn't misread as an
// edge. Attribute-block JSON only carries `->` inside quoted values, which this
// also skips. Backslash-aware so an escaped quote inside a label doesn't flip
// the in-string state.
function hasArrow(line: string): boolean {
  let inStr = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '-' && line[i + 1] === '>') return true;
  }
  return false;
}

// --- Settings -------------------------------------------------------------

// Friendly setting alias -> real Tab field. The inverse of serialize.ts's
// TAB_ALIASES; any other key is applied to the Tab under its own name.
const SETTING_ALIASES: Record<string, string> = {
  theme: 'theme',
  font: 'font',
  background: 'backgroundPattern',
};

function applyTabSettings(settings: Record<string, unknown>): Partial<Tab> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    out[SETTING_ALIASES[key] ?? key] = value;
  }
  return out as Partial<Tab>;
}

// --- Nodes ----------------------------------------------------------------

function parseNode(stmt: string, warnings: string[]): { el: Element; explicitPos: boolean } | null {
  const { head, attrs } = splitTrailingAttrs(stmt);
  const m = /^(\S+)\s+(\S+)\s*([\s\S]*)$/.exec(head);
  if (!m) {
    warnings.push(`Skipped unrecognized line: "${stmt}"`);
    return null;
  }
  const id = m[1]!;
  const kind = m[2]!;
  const rest = m[3]!;

  let label: string | undefined;
  let x: number | undefined;
  let y: number | undefined;
  let width: number | undefined;
  let height: number | undefined;
  const toks = tokenizeRest(rest);
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i]!;
    if (tok.startsWith('"')) {
      label = JSON.parse(tok) as string;
    } else if (tok.startsWith('@')) {
      // Accept both `@40,120` (what the serializer writes) and the
      // spec's spaced `@ 40,120` — a lone `@` consumes the next token
      // as its coordinate pair. A malformed pair is a warning, never a
      // half-parsed NaN position: `explicitPos` from a NaN silently
      // disabled the auto-layout pass for the whole document.
      const pair = tok === '@' ? (toks[++i] ?? '') : tok.slice(1);
      const [px, py] = pair.split(',');
      const nx = Number(px);
      const ny = Number(py);
      if (pair.includes(',') && Number.isFinite(nx) && Number.isFinite(ny)) {
        x = nx;
        y = ny;
      } else {
        warnings.push(`Ignored malformed position "@ ${pair}" on node "${id}".`);
      }
    } else if (/^-?\d+(\.\d+)?x-?\d+(\.\d+)?$/.test(tok)) {
      const [w, h] = tok.split('x');
      width = Number(w);
      height = Number(h);
    } else {
      warnings.push(`Ignored token "${tok}" on node "${id}".`);
    }
  }

  const explicitPos = x !== undefined && y !== undefined;
  const isShape = SHAPE_KINDS.has(kind);
  const known = isShape || NONSHAPE_TYPES.has(kind);
  if (!known) {
    warnings.push(`Unknown element kind "${kind}" on "${id}" — treated as a square shape.`);
  }
  const size = isShape
    ? SHAPE_DEFAULT_SIZE[kind as ShapeKind]
    : (NONSHAPE_DEFAULT_SIZE[kind] ?? { width: 160, height: 80 });

  const base: Record<string, unknown> = isShape
    ? { id, type: 'shape', shape: kind }
    : known
      ? { id, type: kind, ...defaultsForType(kind) }
      : { id, type: 'shape', shape: 'square' };

  // Generic field restore — every non-positional field the serializer wrote.
  Object.assign(base, attrs);
  base.x = x ?? 0;
  base.y = y ?? 0;
  base.width = width ?? size.width;
  base.height = height ?? size.height;
  if (label !== undefined) base.label = label;

  return { el: base as unknown as Element, explicitPos };
}

// Required-field seeds so a freshly parsed non-shape element is structurally
// valid even before its attribute block (which usually overwrites these).
function defaultsForType(kind: string): Record<string, unknown> {
  if (kind === 'table') return { cells: [['']] };
  if (kind === 'image') return { imageId: null };
  if (kind === 'freehand') return { points: [], closed: false };
  return {};
}

// Whitespace-split the trailing part of a node line, keeping quoted labels
// (which may contain spaces) intact.
function tokenizeRest(rest: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < rest.length) {
    while (i < rest.length && /\s/.test(rest[i]!)) i++;
    if (i >= rest.length) break;
    if (rest[i] === '"') {
      // Backslash-aware close-quote scan: a label like `"C:\\"` ends at its real
      // closing quote, not the escaped one (else JSON.parse on the token throws).
      let j = i + 1;
      while (j < rest.length) {
        if (rest[j] === '\\') {
          j += 2;
          continue;
        }
        if (rest[j] === '"') break;
        j++;
      }
      tokens.push(rest.slice(i, j + 1));
      i = j + 1;
    } else {
      let j = i;
      while (j < rest.length && !/\s/.test(rest[j]!)) j++;
      tokens.push(rest.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

// --- Edges ----------------------------------------------------------------

function parseEdge(
  stmt: string,
  order: number,
  nextId: () => string,
  warnings: string[],
): ArrowDraft {
  const { head, attrs } = splitTrailingAttrs(stmt);
  const arrowIdx = head.indexOf('->');
  const left = head.slice(0, arrowIdx).trim();
  const right = head.slice(arrowIdx + 2).trim();

  // Optional `id:` prefix on the left; the rest of the left is the from-endpoint.
  let id: string;
  let fromStr: string;
  const colon = left.indexOf(':');
  if (colon >= 0) {
    id = left.slice(0, colon).trim();
    fromStr = left.slice(colon + 1).trim();
  } else {
    id = nextId();
    fromStr = left;
  }

  const to = takeEndpoint(right);
  return {
    id,
    from: parseEndpoint(fromStr, warnings),
    to: parseEndpoint(to.tok, warnings),
    label: to.label,
    attrs,
    order,
  };
}

// Pull the leading endpoint token (and an optional trailing quoted label) off
// the right side of an edge. A free `(x, y)` endpoint may contain a space, so
// it's read to its closing paren rather than the next whitespace.
function takeEndpoint(s: string): { tok: string; label?: string } {
  let tok: string;
  let rest: string;
  if (s.startsWith('(')) {
    const close = s.indexOf(')');
    tok = s.slice(0, close + 1);
    rest = s.slice(close + 1).trim();
  } else {
    const m = /^(\S+)([\s\S]*)$/.exec(s)!;
    tok = m[1]!;
    rest = m[2]!.trim();
  }
  // Accept the spec's optional `: "label"` form as well as the bare `"label"`
  // the serializer emits, so a hand-authored `a -> b : "x"` keeps its label.
  rest = rest.replace(/^:\s*/, '');
  const label = rest.startsWith('"') ? (JSON.parse(rest) as string) : undefined;
  return { tok, label };
}

// Decode one endpoint token: `(x,y)` free, `arrowId@t` on-arrow, `id.anchor[!]`
// pinned with an explicit (optionally manual) anchor, or a bare `id` whose
// anchor is filled in later from geometry.
function parseEndpoint(tok: string, warnings: string[]): EndpointDraft {
  tok = tok.trim();
  if (tok.startsWith('(') && tok.endsWith(')')) {
    const [x, y] = tok.slice(1, -1).split(',');
    return { kind: 'free', x: Number(x), y: Number(y) };
  }
  if (tok.includes('@')) {
    const at = tok.indexOf('@');
    return { kind: 'on-arrow', arrowId: tok.slice(0, at), t: Number(tok.slice(at + 1)) };
  }
  // `group:groupId.anchor` — pinned to a group's union box (spec/09).
  if (tok.startsWith('group:')) {
    const rest = tok.slice('group:'.length);
    const dot = rest.lastIndexOf('.');
    const groupId = dot > 0 ? rest.slice(0, dot) : '';
    const anchorPart = dot > 0 ? rest.slice(dot + 1) : '';
    if (groupId && ANCHORS.has(anchorPart)) {
      return { kind: 'pinned-group', groupId, anchor: anchorPart as Anchor };
    }
    warnings.push(`Malformed group endpoint "${tok}" — treated as a plain pin.`);
  }
  if (tok.includes('.')) {
    const dot = tok.indexOf('.');
    const elementId = tok.slice(0, dot);
    let anchorPart = tok.slice(dot + 1);
    const manual = anchorPart.endsWith('!');
    if (manual) anchorPart = anchorPart.slice(0, -1);
    if (!ANCHORS.has(anchorPart)) {
      warnings.push(`Unknown anchor "${anchorPart}" on "${elementId}" — chosen automatically.`);
      return { kind: 'pinned-auto', elementId };
    }
    const ep: Endpoint = { kind: 'pinned', elementId, anchor: anchorPart as Anchor };
    if (manual) ep.manual = true;
    return ep;
  }
  return { kind: 'pinned-auto', elementId: tok };
}

// Friendly edge-attr alias -> real ArrowElement field (spec/66's
// documented hand-author vocabulary: `{ ends: both, head:
// hollow-triangle, style: curved, line: dashed, width: thick }`). The
// serializer writes the real field names, so these only fire on
// hand-authored input; unknown keys still pass through under their own
// name, same as node attrs. Deliberately NOT applied to nodes, where
// `width` must keep meaning the box width.
const EDGE_ATTR_ALIASES: Record<string, string> = {
  style: 'arrowStyle',
  ends: 'arrowEnds',
  head: 'arrowheadShape',
  line: 'strokeStyle',
  width: 'strokeWidth',
};

// Friendly VALUES for the aliased keys — mapping the key alone isn't
// enough: spec/66 writes `head: hollow-triangle` where the model enum
// is `triangle-hollow`, and `width` is a friendly thickness name while
// the model's `strokeWidth` is raw px (ARROW_THICKNESS_PX). Unmapped
// values pass through untouched (the model vocabulary is also valid
// hand-authored input).
const EDGE_ATTR_VALUE_ALIASES: Record<string, Record<string, unknown>> = {
  head: {
    'hollow-triangle': 'triangle-hollow',
    'hollow-circle': 'circle-hollow',
    'hollow-diamond': 'diamond-hollow',
  },
  width: { thin: 1, medium: 2, thick: 4, 'extra-thick': 7 },
};

function buildArrow(
  draft: ArrowDraft,
  nodesById: Map<string, Element>,
  warnings: string[],
): ArrowElement {
  for (const end of [draft.from, draft.to]) {
    const refId = end.kind === 'pinned' || end.kind === 'pinned-auto' ? end.elementId : undefined;
    if (refId && !nodesById.has(refId)) {
      warnings.push(`Arrow "${draft.id}" references unknown node "${refId}".`);
    }
  }
  const arrow: Record<string, unknown> = {
    id: draft.id,
    type: 'arrow',
    from: draftToEndpoint(draft.from),
    to: draftToEndpoint(draft.to),
  };
  for (const [key, value] of Object.entries(draft.attrs)) {
    const mapped =
      typeof value === 'string' ? (EDGE_ATTR_VALUE_ALIASES[key]?.[value] ?? value) : value;
    arrow[EDGE_ATTR_ALIASES[key] ?? key] = mapped;
  }
  if (draft.label !== undefined) arrow.label = draft.label;
  return arrow as unknown as ArrowElement;
}

// A draft endpoint as a real Endpoint — auto-pinned ones get a placeholder
// anchor that resolveAutoAnchors replaces once geometry is final.
function draftToEndpoint(ep: EndpointDraft): Endpoint {
  if (ep.kind === 'pinned-auto') return { kind: 'pinned', elementId: ep.elementId, anchor: 'e' };
  return ep;
}

// --- Auto-anchor resolution ----------------------------------------------

// Give every bare pinned endpoint (tracked in `autoEnds`) a concrete anchor on
// the face pointing at the other end of its arrow. Explicit + manual anchors are
// left untouched. Auto-layout already chose good anchors for connected graphs;
// this recomputes the same dominant-axis choice (and covers the endpoints layout
// skipped — those facing a free point or another arrow).
function resolveAutoAnchors(elements: Element[], autoEnds: Set<string>): Element[] {
  if (autoEnds.size === 0) return elements;
  const centers = new Map<string, { x: number; y: number }>();
  for (const el of elements) {
    if (el.type === 'arrow') continue;
    const b = el as unknown as { x: number; y: number; width: number; height: number };
    centers.set(el.id, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
  }

  const targetPoint = (ep: Endpoint): { x: number; y: number } | undefined => {
    if (ep.kind === 'free') return { x: ep.x, y: ep.y };
    if (ep.kind === 'pinned') return centers.get(ep.elementId);
    return undefined; // on-arrow: leave the auto anchor as-is
  };

  return elements.map((el) => {
    if (el.type !== 'arrow') return el;
    let next = el;
    for (const end of ['from', 'to'] as const) {
      if (!autoEnds.has(`${el.id}|${end}`)) continue;
      const ep = next[end];
      if (ep.kind !== 'pinned') continue;
      const self = centers.get(ep.elementId);
      const target = targetPoint(next[end === 'from' ? 'to' : 'from']);
      if (!self || !target) continue;
      next = { ...next, [end]: { ...ep, anchor: faceToward(self, target) } };
    }
    return next;
  });
}

// The box face (n/e/s/w) pointing from `center` toward `target`, by dominant axis.
function faceToward(center: { x: number; y: number }, target: { x: number; y: number }): Anchor {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'e' : 'w';
  return dy >= 0 ? 's' : 'n';
}
