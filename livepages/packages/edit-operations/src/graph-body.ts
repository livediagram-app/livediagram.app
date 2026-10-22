// A `replace` body's graph checked before it is laid out (docs/specs/015-api/mcp-server.md §4.7, the
// shape the MCP's `graph` argument takes): `layoutGraph` trusts its input, and a changeset's body is
// untrusted JSON. Returns the first problem, naming the member, or null.

import {
  SEQUENCE_MAX_ITEMS,
  SEQUENCE_MAX_PARTICIPANTS,
  graphShapeError,
  isRecord,
  MAX_ELEMENTS_PER_TAB,
  type GraphInput,
} from '@livepages/document';
import { iconsLike, isIconId } from '@livepages/icons/search';

const isId = (v: unknown) => typeof v === 'string' && v !== '';
const optional =
  (check: (v: unknown) => boolean) =>
  (v: unknown): boolean =>
    v === undefined || check(v);
const isString = (v: unknown) => typeof v === 'string';
const isOneOf = (values: readonly string[]) => (v: unknown) => values.includes(v as string);
const isListOf = (v: unknown, check: (item: unknown) => boolean) =>
  Array.isArray(v) && v.every(check);

const isEntityField = (f: unknown) => isRecord(f) && isString(f.name) && optional(isString)(f.type);

const isNode = (n: unknown) =>
  isRecord(n) &&
  isId(n.id) &&
  ['label', 'shape', 'link', 'note', 'group', 'icon'].every((key) => optional(isString)(n[key])) &&
  optional(isOneOf(['strong', 'soft', 'muted', 'plain']))(n.tone) &&
  optional((v) => isListOf(v, isEntityField))(n.fields);

const isEdge = (e: unknown) =>
  isRecord(e) &&
  isId(e.from) &&
  isId(e.to) &&
  optional(isString)(e.label) &&
  optional(isOneOf(['solid', 'dashed', 'thick']))(e.line) &&
  optional(isOneOf(['to', 'none', 'both', 'from']))(e.ends) &&
  optional(isOneOf(['triangle', 'circle', 'cross']))(e.head);

const isGroup = (g: unknown) =>
  isRecord(g) &&
  isId(g.id) &&
  optional(isString)(g.label) &&
  optional((v) => isListOf(v, isString))(g.members);

// A sequence read from Mermaid (mermaid-sequence.ts), as the MCP sends it on: every participant and item checked,
// since the body is untrusted and the layout trusts its input.
const isParticipant = (p: unknown) =>
  isRecord(p) &&
  isId(p.id) &&
  isString(p.label) &&
  optional((v) => typeof v === 'boolean')(p.actor) &&
  optional(isString)(p.icon);
const isSequenceItem = (it: unknown): boolean => {
  if (!isRecord(it)) return false;
  switch (it.kind) {
    case 'message':
      return (
        isId(it.from) &&
        isId(it.to) &&
        isString(it.label) &&
        isOneOf(['call', 'async', 'reply'])(it.style) &&
        optional((v) => typeof v === 'boolean')(it.activate) &&
        optional((v) => typeof v === 'boolean')(it.deactivate)
      );
    case 'note':
      return (
        isOneOf(['over', 'left', 'right'])(it.placement) &&
        isListOf(it.who, isId) &&
        (it.who as unknown[]).length > 0 &&
        isString(it.text)
      );
    case 'activate':
    case 'deactivate':
      return isId(it.who);
    case 'fragment':
      return isString(it.op) && isString(it.label);
    case 'else':
      return isString(it.label);
    case 'end':
      return true;
    default:
      return false;
  }
};
const isSequence = (q: unknown) =>
  isRecord(q) &&
  isListOf(q.participants, isParticipant) &&
  (q.participants as unknown[]).length <= SEQUENCE_MAX_PARTICIPANTS &&
  isListOf(q.items, isSequenceItem) &&
  (q.items as unknown[]).length <= SEQUENCE_MAX_ITEMS &&
  optional(isString)(q.title) &&
  optional((v) => typeof v === 'boolean')(q.autonumber);

const MEMBER_RULES: readonly [string, (v: unknown) => boolean, string][] = [
  [
    'sequence',
    optional(isSequence),
    `a sequence: up to ${SEQUENCE_MAX_PARTICIPANTS} participants and ${SEQUENCE_MAX_ITEMS} items`,
  ],
  ['title', optional(isString), 'a string'],
  ['subtitle', optional(isString), 'a string'],
  [
    'key',
    optional(
      (v) =>
        typeof v === 'boolean' ||
        (isRecord(v) && Object.values(v).every((m) => typeof m === 'string')),
    ),
    'true, false or { shape: meaning }',
  ],
  [
    'nodes',
    (v) => isListOf(v, isNode),
    'an array of { id, label?, shape?, note?, group?, icon?, tone? (strong, soft, muted or plain) }',
  ],
  ['edges', (v) => isListOf(v, isEdge), 'an array of { from, to, label? }'],
  ['groups', optional((v) => isListOf(v, isGroup)), 'an array of { id, members }'],
  ['direction', optional(isOneOf(['down', 'right'])), 'down or right'],
  [
    'style',
    optional(isOneOf(['flow', 'tree', 'mindmap', 'lanes', 'cycle', 'sequence'])),
    'flow, tree, mindmap, lanes, cycle or sequence',
  ],
  ['lines', optional(isOneOf(['straight', 'angled', 'curved'])), 'straight, angled or curved'],
];

export function graphBodyIssue(graph: unknown): string | null {
  if (!isRecord(graph)) return 'graph: expected an object with nodes and edges';
  for (const [member, valid, rule] of MEMBER_RULES)
    if (!valid(graph[member])) return `graph.${member}: expected ${rule}`;
  const { nodes, edges } = graph as GraphInput;
  if (nodes.length + edges.length > MAX_ELEMENTS_PER_TAB)
    return `graph: at most ${MAX_ELEMENTS_PER_TAB} nodes and edges`;
  // An icon that names none would draw a question mark (docs/specs/015-api/mcp-server.md §4.4 "Values checked").
  const unknownIcon = nodes.find((n) => n.icon !== undefined && !isIconId(n.icon));
  if (unknownIcon) {
    const like = iconsLike(unknownIcon.icon!).map((i) => i.id);
    return (
      `graph.nodes: node "${unknownIcon.id}" icon ${JSON.stringify(unknownIcon.icon)} is not an icon` +
      (like.length
        ? `; icons like it: ${like.join(', ')}`
        : '; search_icons finds one by what it shows')
    );
  }
  // What it asks that cannot be drawn (nested groups, a node in no lane), refused as the MCP refuses it.
  return graphShapeError(graph as GraphInput) ?? null;
}
