// The element format as an agent writes it (livediagram/docs/specs/015-api/blueprints/cli.md CLI73): the kinds `add` makes, and
// for one kind its first size, the aliases `set` takes with their values, and the stored fields it also takes by
// name. Read off the engine's own factories, aliases and value lists, so it says what the engine accepts.

import {
  ELEMENT_FIELD_NAMES,
  LIVE_ELEMENT_FIELDS,
  STICKY_PRESETS,
  TEXT_PX_MAX,
  TEXT_PX_MIN,
  THEMES,
  TURNING_SHAPES,
  type Element,
  withArticle,
} from '@livehuddle/document';
import { fillSlotNames } from './colours';
import { aliasesOf, BORDER_STYLES, NOTE_FIELDS, TEXT_SIZES } from './fields';
import {
  AGENT_SHAPE_KINDS,
  buildKind,
  NOT_ADDED,
  OTHER_KINDS,
  type Built,
} from './operations/add-kind';

export const SCHEMA_KIND_MAX_TOKENS = 300;

const LINE_WIDTH = 100;

// Words joined with `sep`, wrapped at LINE_WIDTH, each line indented.
function wrapped(words: readonly string[], indent: string, sep = ' '): string[] {
  const lines = [''];
  for (const word of words) {
    const last = lines.at(-1)!;
    const next = last ? `${last}${sep}${word}` : word;
    if (last && indent.length + next.length > LINE_WIDTH) {
      lines[lines.length - 1] = `${last}${sep.trimEnd()}`;
      lines.push(word);
    } else lines[lines.length - 1] = next;
  }
  return lines.map((line) => `${indent}${line}`);
}

// Every kind `add` makes: the boxed kinds, then the shape kinds.
export function addableKinds(): string[] {
  return [...OTHER_KINDS, ...AGENT_SHAPE_KINDS];
}

// A kind `add` refuses because livehuddle no longer has it, not because the editor makes it.
const isRetiredKind = (kind: string) => NOT_ADDED[kind]!.includes('no longer supported');

export function elementKindsText(): string {
  return [
    'Element kinds: add <kind> makes one; livehuddle schema <kind> shows its fields.',
    `  ${OTHER_KINDS.join(', ')}`,
    '  shapes:',
    ...wrapped(AGENT_SHAPE_KINDS, '    ', ', '),
    `  ${Object.keys(NOT_ADDED)
      .filter((k) => !isRetiredKind(k))
      .join(', ')}: made in the editor`,
    // The retired kinds (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
    '  no longer supported in livehuddle:',
    ...wrapped(Object.keys(NOT_ADDED).filter(isRetiredKind), '    ', ', '),
  ].join('\n');
}

const fillValues = (el: Element) =>
  el.type === 'sticky'
    ? [...STICKY_PRESETS.map((p) => p.id.replace(/^sticky-/, '')), '#rrggbb']
    : [...fillSlotNames(THEMES[0]!).keys(), '#rrggbb'];

type Alias = ReturnType<typeof aliasesOf>[number];
// `line` is a stored arrow's alias, and a stored arrow is never a kind `add` makes (part 4 of the element engine).
type MadeAlias = Exclude<Alias, 'line'>;
const isMadeAlias = (alias: Alias): alias is MadeAlias => alias !== 'line';

function aliasValue(el: Element, alias: MadeAlias): string {
  switch (alias) {
    case 'label':
      return '<text>';
    case 'shape':
      return '<shape kind>';
    case 'fill':
      return fillValues(el).join('|');
    case 'stroke':
    case 'text-color':
      return '#rrggbb';
    case 'border':
      return BORDER_STYLES.join('|');
    case 'text':
      return `${TEXT_SIZES.join('|')}|${TEXT_PX_MIN}-${TEXT_PX_MAX}`;
  }
}

// A note is never written (Work Tracker 737), so no format offers one.
const HIDDEN_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'type',
  ...LIVE_ELEMENT_FIELDS,
  ...NOTE_FIELDS,
]);

// A shape's stored fields cover every shape kind at once, more than one kind's budget: a shape names the fields
// every shape uses, then its kind's own (its content, as the API's changeset docs describe it).
export const SHAPE_COMMON_FIELDS = [
  'x',
  'y',
  'width',
  'height',
  'textAlignX',
  'textAlignY',
  'textBold',
  'textItalic',
  'font',
  'finish',
  'strokeWidth',
  'borderRadius',
  'opacity',
  'rotation',
  'shadow',
  'link',
  'iconId',
  'padding',
] as const;

export const SHAPE_KIND_FIELDS: Readonly<Record<string, readonly string[]>> = {
  icon: ['iconSize', 'iconWeight'],
  sticker: ['stickerId'],
  // docs/specs/009-elements/furniture-facing.md: every piece of furniture that turns takes a facing.
  ...Object.fromEntries(TURNING_SHAPES.map((kind) => [kind, ['chairFacing']])),
  // docs/specs/009-elements/office.md: which wall a room's doorway is in.
  // And its walls (office.md "Glass walls"): Solid or Glass.
  room: ['roomDoor', 'variant'],
  // docs/specs/009-elements/room-builder.md "Opening and closing": whether a door is shut.
  door: ['doorClosed', 'variant'],
  // docs/specs/009-elements/office.md "Rug types", corridor.md: a rug's pattern and a corridor's shape.
  rug: ['variant'],
  // office.md "Long Table": a Meeting Table's type.
  'meeting-table': ['variant'],
  corridor: ['variant'],
  // docs/specs/009-elements/office.md "Stage": who may speak from it, and whether its speakers are seen tab-wide.
  stage: ['stageSpeakers', 'stageCameras'],
  // docs/specs/008-canvas/receptionist.md "Asking him to leave": whether the pad's Receptionist was asked to leave.
  'avatar-pad': ['receptionistLeft'],
  // docs/specs/009-elements/social-pieces.md: a world clock's zones and a jukebox's source.
  'world-clock': ['clockZones'],
  jukebox: ['jukeboxSource', 'chairFacing'],
  portal: ['portalTarget'],
  // docs/specs/009-elements/screen-and-room-sign.md "Screen": its Video Link.
  screen: ['screenUrl'],
};

function storedFieldsOf(kind: string, el: Element): readonly string[] {
  if (el.type === 'shape') return [...SHAPE_COMMON_FIELDS, ...(SHAPE_KIND_FIELDS[kind] ?? [])];
  return ELEMENT_FIELD_NAMES[el.type].filter((f) => !HIDDEN_FIELDS.has(f));
}

// One kind's format, or null for a kind `add` does not make.
export function elementFormatText(kind: string): string | null {
  if (!addableKinds().includes(kind)) return null;
  // Every kind `add` makes builds, as a box: the refused kinds are not addable (part 4 of the element engine).
  const { el } = buildKind(kind) as Built;
  const head = `${kind}: ${el.type === 'shape' ? 'a shape' : withArticle(el.type)}. add ${kind} [id=<id>] key=value… [<placement>]`;
  const size = [`Size: ${el.width}×${el.height} at first, grown to fit its label.`];
  const aliases = aliasesOf(el)
    .filter(isMadeAlias)
    .map((a) => `${a}=${aliasValue(el, a)}`);
  const fields = storedFieldsOf(kind, el);
  return [
    head,
    ...size,
    'Set with:',
    ...wrapped(aliases, '  ', '  '),
    'And by stored name:',
    ...wrapped(fields, '  '),
    el.type === 'shape'
      ? 'Any other stored field by name; a wrong one is refused with the list.'
      : null,
    'key= unsets a field; the theme paints the colours left unset.',
  ]
    .filter((line) => line !== null)
    .join('\n');
}
