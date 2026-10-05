// The element format as an agent writes it (docs/specs/015-api/blueprints/cli.md CLI73): the kinds `add` makes, and
// for one kind its first size, the aliases `set` takes with their values, and the stored fields it also takes by
// name. Read off the engine's own factories, aliases and value lists, so it says what the engine accepts.

import {
  ELEMENT_FIELD_NAMES,
  LIVE_ELEMENT_FIELDS,
  SHAPE_KINDS,
  STICKY_PRESETS,
  THEMES,
  type Element,
} from '@livediagram/document';
import { fillSlotNames } from './colours';
import { aliasesOf, ARROW_STYLES, BORDER_STYLES, TEXT_SIZES } from './fields';
import { buildKind, NOT_ADDED, OTHER_KINDS } from './operations/add-kind';

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
  return [...OTHER_KINDS, ...SHAPE_KINDS];
}

export function elementKindsText(): string {
  return [
    'Element kinds: add <kind> makes one; livediagram schema <kind> shows its fields.',
    `  ${OTHER_KINDS.join(', ')}`,
    '  shapes:',
    ...wrapped([...SHAPE_KINDS], '    ', ', '),
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
      return TEXT_SIZES.join('|');
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
  entity: ['entityFields'],
  'pie-chart': ['pieSlices', 'chartLegend', 'chartPalette'],
  'bar-chart': ['pieSlices', 'chartLegend', 'chartPalette'],
  'line-chart': ['lineCategories', 'lineSeries', 'chartLegend', 'chartPalette'],
  checklist: ['checklistItems'],
  lane: ['headerFill', 'headerSize', 'titleOrientation'],
  frame: ['headerFill', 'headerSize'],
  'progress-bar': ['progress'],
  'progress-ring': ['progress'],
  rating: ['rating'],
  legend: ['legendItems'],
  'timeline-rail': ['railCount', 'railLabels'],
  agenda: ['agendaItems'],
  decision: ['decisionStatus', 'decisionDate', 'decisionDrivers'],
  quiz: ['quizOptions', 'quizCorrect', 'quizSeconds'],
  picker: ['pickerOptions', 'pickerSource'],
  'stat-row': ['stats'],
  process: ['processSteps'],
  'site-header': ['navLinks'],
  page: ['pageTitle', 'pageSubtitle'],
  'mind-node': ['mindParentId', 'mindFlow'],
  icon: ['iconSize', 'iconWeight'],
  sticker: ['stickerId'],
  estimate: ['estimateScale'],
  chair: ['chairFacing'],
  portal: ['portalTarget'],
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
    : `${kind}: ${el.type === 'shape' ? 'a shape' : `a ${el.type}`}. add ${kind} [id=<id>] key=value… [<placement>]`;
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
