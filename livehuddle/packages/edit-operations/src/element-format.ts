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
  type Element,
  withArticle,
} from '@livehuddle/document';
import { fillSlotNames } from './colours';
import { aliasesOf, ARROW_STYLES, BORDER_STYLES, TEXT_SIZES } from './fields';
import { AGENT_SHAPE_KINDS, buildKind, NOT_ADDED, OTHER_KINDS } from './operations/add-kind';

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

export function elementKindsText(): string {
  return [
    'Element kinds: add <kind> makes one; livehuddle schema <kind> shows its fields.',
    `  ${OTHER_KINDS.join(', ')}`,
    '  shapes:',
    ...wrapped(AGENT_SHAPE_KINDS, '    ', ', '),
    '  arrow: connect <a> -> <b>',
    `  ${Object.keys(NOT_ADDED)
      .filter((k) => k !== 'arrow')
      .join(', ')}: made in the editor`,
  ].join('\n');
}

const fillValues = (el: Element) =>
  el.type === 'sticky'
    ? [...STICKY_PRESETS.map((p) => p.id.replace(/^sticky-/, '')), '#rrggbb']
    : [...fillSlotNames(THEMES[0]!).keys(), '#rrggbb'];

function aliasValue(el: Element, alias: ReturnType<typeof aliasesOf>[number]): string {
  switch (alias) {
    case 'label':
    case 'note':
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
    case 'line':
      return ARROW_STYLES.join('|');
  }
}

const HIDDEN_FIELDS: ReadonlySet<string> = new Set(['id', 'type', ...LIVE_ELEMENT_FIELDS]);

// A shape's stored fields cover every shape kind at once, more than one kind's budget: a shape names the fields
// every shape uses, then its kind's own (its content, as the MCP's schema describes it).
export const SHAPE_COMMON_FIELDS = [
  'x',
  'y',
  'width',
  'height',
  'locked',
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
  'code-block': ['code', 'codeLanguage', 'codeTheme', 'codeWrap'],
  'pie-chart': ['pieSlices', 'chartVariant', 'chartLegend', 'chartValues', 'chartPalette'],
  'bar-chart': [
    'pieSlices',
    'chartVariant',
    'chartLegend',
    'chartValues',
    'chartAxis',
    'chartPalette',
  ],
  'line-chart': [
    'lineCategories',
    'chartVariant',
    'lineSeries',
    'chartLegend',
    'chartValues',
    'chartAxis',
    'chartPalette',
  ],
  checklist: ['checklistItems'],
  lane: ['headerFill', 'headerSize', 'titleOrientation'],
  'progress-bar': ['progress'],
  'progress-ring': ['progress'],
  rating: ['rating'],
  legend: ['legendItems'],
  'stat-row': ['stats'],
  process: ['processSteps'],
  'site-header': ['navLinks'],
  icon: ['iconSize', 'iconWeight'],
  sticker: ['stickerId'],
  chair: ['chairFacing'],
  desk: ['chairFacing'],
  sofa: ['chairFacing'],
  // docs/specs/009-elements/office.md: which wall a room's doorway is in.
  room: ['roomDoor'],
  // docs/specs/009-elements/room-builder.md "Opening and closing": whether a door is shut.
  door: ['doorClosed', 'variant'],
  // docs/specs/009-elements/office.md "Rug types", corridor.md: a rug's pattern and a corridor's shape.
  rug: ['variant'],
  corridor: ['variant'],
  // docs/specs/009-elements/office.md "Stage": who may speak from it, and whether its speakers are seen tab-wide.
  stage: ['stageSpeakers', 'stageCameras'],
  // docs/specs/009-elements/social-pieces.md: a world clock's zones and a jukebox's source.
  'world-clock': ['clockZones'],
  jukebox: ['jukeboxSource'],
  portal: ['portalTarget'],
  // docs/specs/009-elements/screen-and-room-sign.md "Screen": its Video Link.
  screen: ['screenUrl'],
};

function storedFieldsOf(kind: string, el: Element): readonly string[] {
  if (el.type === 'shape') return [...SHAPE_COMMON_FIELDS, ...(SHAPE_KIND_FIELDS[kind] ?? [])];
  return ELEMENT_FIELD_NAMES[el.type].filter((f) => !HIDDEN_FIELDS.has(f));
}

// One kind's format, or null for a kind `add` and `connect` do not know.
export function elementFormatText(kind: string): string | null {
  const isArrow = kind === 'arrow';
  if (!isArrow && !addableKinds().includes(kind)) return null;
  const built = isArrow ? null : buildKind(kind);
  const el = (built && 'el' in built ? built.el : { type: 'arrow' }) as Element;
  const head = isArrow
    ? 'arrow: connect <a> -> <b> [id=<id>] key=value… [again]'
    : `${kind}: ${el.type === 'shape' ? 'a shape' : withArticle(el.type)}. add ${kind} [id=<id>] key=value… [<placement>]`;
  const size =
    'width' in el ? [`Size: ${el.width}×${el.height} at first, grown to fit its label.`] : [];
  const aliases = aliasesOf(el).map((a) => `${a}=${aliasValue(el, a)}`);
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
