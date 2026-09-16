import { EVENT_STORMING_NOTES, ES_NOTE_SIZE_PX } from '@livediagram/diagram';
import { PHOTO_MAX_NOTES } from '@livediagram/api-schema';

// What the vision model is asked of a photograph of a sticky wall (spec/139
// Phase 8).
//
// The colour legend is DERIVED from the notation catalogue, never hand-copied.
// Colour IS the notation on this board, and a second copy of the table is how
// the model ends up calling a policy an aggregate six months after someone
// adjusts a hex. The same rule the palette tiles and the template builder
// already follow.
//
// The model is asked ONLY what it can see. It is never asked which notes are
// already on the board: that is a question about our data, its answer could
// not be checked, and reconciliation is pure code on our side.

function legend(): string {
  return EVENT_STORMING_NOTES.map(
    (n) => `- ${n.kind}: ${n.fill} (${n.label}) — ${n.blurb.toLowerCase()}`,
  ).join('\n');
}

function silhouettes(): string {
  return (Object.keys(ES_NOTE_SIZE_PX) as (keyof typeof ES_NOTE_SIZE_PX)[])
    .map((size) => {
      const kinds = EVENT_STORMING_NOTES.filter((n) => n.size === size).map((n) => n.kind);
      const px = ES_NOTE_SIZE_PX[size];
      return `- ${size} (${px.width}x${px.height}): ${kinds.join(', ')}`;
    })
    .join('\n');
}

export function buildPhotoNotesPrompt(tabName: string): string {
  return [
    'You are reading a photograph of a physical event-storming wall: paper sticky notes,',
    'written on with a marker, stuck to a wall or whiteboard.',
    '',
    'Report EVERY sticky note you can see, including ones that are partly covered by',
    'another note, curling at a corner, or at an angle. A partly covered note still',
    'counts — read what is legible and lower its confidence.',
    '',
    'Read the text VERBATIM, exactly as written, including abbreviations, shorthand and',
    'misspellings. Do not correct it, expand it, translate it or tidy it up: these are',
    'domain terms, and a helpful rewrite renames somebody’s business.',
    '',
    'The PAPER COLOUR is the notation. Match each note to the nearest of these, allowing',
    'for camera white balance and shadow:',
    legend(),
    'Use "unknown" when the colour is clearly not one of these, or the lighting makes it',
    'unjudgeable. Never guess a kind from the words: the colour decides.',
    '',
    'The note SHAPE is notation too. Classify each as:',
    silhouettes(),
    '',
    'Geometry: give each note a centre (cx, cy) and extent (w, h) NORMALISED to the image,',
    'so 0,0 is the top-left corner and 1,1 the bottom-right.',
    '',
    'Also group the notes into ROWS as a human reading the wall would: row 0 is the top',
    'row, and `order` is the position along that row from the left, starting at 0. A wall',
    'sags and drifts — trust what reads as a row over exact pixel alignment.',
    '',
    `Report at most ${PHOTO_MAX_NOTES} notes.`,
    '',
    'If this photograph is not of a wall of sticky notes at all, set wall=false, return an',
    'empty notes list, and put one short sentence in hint saying what you see instead.',
    'If it IS a wall but the photo is hard to read, still return what you can and put one',
    'short line of retake advice in hint.',
    tabName ? `\nThe board these notes will join is called "${tabName}".` : '',
  ].join('\n');
}

// The strict JSON schema the model answers in (OpenAI structured outputs). Its
// shape IS `DetectedNote[]` from @livediagram/api-schema; a test pins that the
// two agree, because a silent drift here would land unparsed fields.
export function photoNotesSchema(): Record<string, unknown> {
  const kinds = [...EVENT_STORMING_NOTES.map((n) => n.kind), 'unknown'];
  return {
    type: 'object',
    additionalProperties: false,
    required: ['notes', 'wall'],
    properties: {
      wall: { type: 'boolean' },
      hint: { type: 'string' },
      notes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'id',
            'text',
            'kind',
            'colour',
            'size',
            'cx',
            'cy',
            'w',
            'h',
            'row',
            'order',
            'confidence',
          ],
          properties: {
            id: { type: 'integer' },
            text: { type: 'string' },
            kind: { type: 'string', enum: kinds },
            colour: { type: 'string' },
            size: { type: 'string', enum: Object.keys(ES_NOTE_SIZE_PX) },
            cx: { type: 'number' },
            cy: { type: 'number' },
            w: { type: 'number' },
            h: { type: 'number' },
            row: { type: 'integer' },
            order: { type: 'integer' },
            confidence: { type: 'number' },
          },
        },
      },
    },
  };
}
