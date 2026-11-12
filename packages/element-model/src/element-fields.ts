// The building blocks of each product's element field table (its `element-fields.ts`; docs/specs/024-agents/blueprints/
// edit-operations.md "Fields and values"): what an edit operation's `set` may name, and the list its `unknown_field`
// refusal offers. A product's table names its own element types and their fields in its own order; this module holds
// the exhaustiveness check, the lookup over a table and the runs of fields many element types list together, which a
// product's list spreads in place, so the order a refusal offers stays the product's.

type Unlisted<E, L extends readonly PropertyKey[]> = Exclude<keyof E, L[number]>;

// `fieldsOf<E>()(names)` fails the build when `E` gains a field `names` does not list.
export const fieldsOf =
  <E extends object>() =>
  <const L extends readonly (keyof E & string)[]>(
    names: L & ([Unlisted<E, L>] extends [never] ? unknown : { unlisted: Unlisted<E, L> }),
  ): L =>
    names;

// The lookup over a product's table: true when `key` is a stored field of elements of `type`; never for a prototype
// key.
export function elementFieldLookup<T extends string>(table: {
  readonly [K in T]: readonly string[];
}): (type: T, key: string) => boolean {
  const sets: ReadonlyMap<string, ReadonlySet<string>> = new Map(
    Object.entries<readonly string[]>(table).map(([type, names]) => [type, new Set<string>(names)]),
  );
  return (type, key) => sets.get(type)?.has(key) ?? false;
}

// The runs of fields many element types list together, in the order they list them.
export const BOX_FIELDS = ['x', 'y', 'width', 'height'] as const;

const TEXT_EMPHASIS_FIELDS = [
  'textBold',
  'textItalic',
  'textUnderline',
  'textStrikethrough',
] as const;

export const TEXT_STYLE_FIELDS = [
  'textSize',
  'textAlignX',
  'textAlignY',
  ...TEXT_EMPHASIS_FIELDS,
  'font',
] as const;

export const MOTION_FIELDS = ['animation', 'animationSpeed', 'animationRepeat'] as const;

export const TEXT_MOTION_FIELDS = [
  'textAnimation',
  'textAnimationSpeed',
  'textAnimationRepeat',
] as const;

export const NOTE_FIELDS = ['commentThread', 'action', 'note', 'noteRich'] as const;

// A shape's icon, its progress ring, its data pieces (rating, rail, pie, chart, legend, sankey) and its code.
export const ICON_FIELDS = [
  'iconId',
  'stickerId',
  'iconAnimation',
  'iconAnimationSpeed',
  'iconAnimationRepeat',
  'iconSize',
  'iconWeight',
  'iconPosition',
] as const;

export const PROGRESS_FIELDS = [
  'progress',
  'progressAnim',
  'progressAnimSpeed',
  'progressAnimRepeat',
] as const;

export const DATA_SHAPE_FIELDS = [
  'railCount',
  'railLabels',
  'rating',
  'ratingAnim',
  'ratingAnimSpeed',
  'ratingAnimRepeat',
  'pieSlices',
  'pieAnim',
  'pieAnimSpeed',
  'pieAnimRepeat',
  'chartLegend',
  'chartLegendPosition',
  'chartValues',
  'chartAxis',
  'chartVariant',
  'lineCategories',
  'lineSeries',
  'legendItems',
  'sankeyFlows',
  'sankeyNodes',
  'sankeyLinkColor',
  'sankeyAlign',
  'sankeyValueLabel',
  'sankeyUnit',
  'sankeyLeftover',
  'sankeyLeftoverName',
  'sankeyAnim',
  'sankeyAnimSpeed',
  'sankeyAnimRepeat',
  'chartPalette',
] as const;

export const CODE_FIELDS = ['code', 'codeLanguage', 'codeTheme', 'codeWrap'] as const;

// A shape's web pieces: the card and chip, a stack's layout, a sequence, a concept and the rest of the web kit.
export const CARD_FIELDS = [
  'pageTitle',
  'pageSubtitle',
  'cardMedia',
  'cardHeader',
  'tags',
  'chipLook',
  'attachedTo',
  'attachAt',
] as const;

export const STACK_FIELDS = [
  'stackDirection',
  'stackAlign',
  'stackGap',
  'stackPadding',
  'stackColumns',
] as const;

export const SEQUENCE_FIELDS = [
  'sequenceParticipants',
  'sequenceMessages',
  'sequenceNumbered',
  'sequenceAnim',
  'sequenceAnimSpeed',
  'sequenceAnimRepeat',
] as const;

export const CONCEPT_FIELDS = [
  'conceptRows',
  'pyramidVariant',
  'conceptAnim',
  'conceptAnimSpeed',
  'conceptAnimRepeat',
] as const;

export const WEB_FIELDS = [
  'hubSpokes',
  'stats',
  'processSteps',
  'navLinks',
  'checklistItems',
] as const;

// A text's type settings, a freehand's stroke, a table's grid and an arrow's ends, route and label.
export const TEXT_TYPE_FIELDS = [
  'sizing',
  'textScale',
  'letterSpacing',
  'fontWeight',
  'textCase',
  'textArc',
] as const;

export const FREEHAND_STROKE_FIELDS = [
  'packedPoints',
  'closed',
  'pen',
  'penWidth',
  'streamline',
  'penColour',
  'straightEdges',
] as const;

export const TABLE_GRID_FIELDS = [
  'cells',
  'headerRow',
  'headerColumn',
  'zebra',
  'tablePreset',
  'cellStyles',
  'headerTextColor',
  'colWidths',
  'rowHeights',
] as const;

export const ARROW_FIELDS = [
  'from',
  'to',
  'locked',
  'strokeColor',
  'penColour',
  'strokeSwatch',
  'arrowheadColor',
  'opacity',
  'link',
  'arrowEnds',
  'strokeWidth',
  'strokeStyle',
  'arrowheadSize',
  'arrowheadShape',
  'arrowheadStartShape',
  'arrowStyle',
  'routeBehind',
  'exactStart',
  'exactEnd',
  'flow',
  'flowSpeed',
  'flowRepeat',
  'curveOffset',
  'curvePoints',
  'elbowOffset',
  'label',
  'labelOffset',
  'labelMaxWidth',
  'textSize',
  ...TEXT_EMPHASIS_FIELDS,
  'textColor',
  'penTextColour',
  'labelFill',
  'font',
  'finish',
] as const;
