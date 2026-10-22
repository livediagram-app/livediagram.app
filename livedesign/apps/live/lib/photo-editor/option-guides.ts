// What each of a tool's options does, for its popover (docs/specs/031-photo/photo-pages.md "The options flyout"): the
// line under the option's name, the values a slider offers as one-press presets, the keys that change it, and for a
// choice what each of its values does and the sections it is shown in. Pure data, keyed by the option's field key
// (tool-option-fields); a key with no guide shows its name alone.
import { BLEND_MODE_GROUPS } from '@livedesign/photo-engine';

export type OptionGuide = {
  // What the option does, in a line.
  blurb: string;
  // A slider's one-press values, in its readout's units (a percent option's in percent).
  presets?: readonly number[];
  // The keys that change it, as the footer says them.
  keys?: string;
};

const PERCENTS = [0, 25, 50, 75, 100] as const;

export const OPTION_GUIDES: Readonly<Record<string, OptionGuide>> = {
  size: {
    blurb: "The tip's width across, in photo pixels.",
    presets: [1, 5, 10, 25, 50, 100, 250],
    keys: '[ and ] make it smaller and larger',
  },
  hardness: {
    blurb: 'How crisp the tip is: soft fades out, hard has a clean edge.',
    presets: PERCENTS,
    keys: 'Shift [ and Shift ] step it by a quarter',
  },
  opacity: { blurb: 'How strongly each stroke covers what is under it.', presets: PERCENTS },
  flow: { blurb: 'How much paint each dab lays down as it builds up.', presets: PERCENTS },
  smoothing: {
    blurb: 'Steadies a wobbly hand by trailing the tip behind the pointer.',
    presets: PERCENTS,
  },
  mode: { blurb: 'How the paint mixes with the colours already on the layer.' },
  pressure: { blurb: 'What a pen pressing harder changes.' },
  eraserMode: { blurb: 'The tip the eraser rubs out with.' },
  tolerance: {
    blurb: 'How different a colour can be and still count as alike.',
    presets: [0, 8, 16, 32, 64, 128],
  },
  feather: {
    blurb: "Softens the selection's edge over this many pixels.",
    presets: [0, 2, 5, 10, 25, 50],
  },
  style: { blurb: 'Whether the shape is free, held to a ratio or a fixed size.' },
  gradientStyle: { blurb: 'The shape the colours spread out in.' },
  width: { blurb: 'How far from the pointer it looks for an edge.', presets: [5, 10, 20, 40, 80] },
  contrast: { blurb: 'How strong an edge must be to snap to.', presets: [5, 10, 25, 50, 75] },
  frequency: {
    blurb: 'How often it pins the line down as you go.',
    presets: [0, 25, 57, 75, 100],
  },
  ratio: { blurb: 'Keeps the crop box to this shape.' },
  sample: { blurb: 'How many pixels around the pointer are averaged.' },
  strength: { blurb: 'How much each pass changes the pixels.', presets: PERCENTS },
  range: { blurb: 'Which tones the tool works on.' },
  exposure: { blurb: 'How much each pass lightens or darkens.', presets: PERCENTS },
  pupil: { blurb: 'How much of the eye counts as pupil.', presets: PERCENTS },
  darken: { blurb: 'How dark the pupil is made.', presets: PERCENTS },
  font: { blurb: 'The typeface the text is set in.' },
  weight: { blurb: 'How heavy the letters are.' },
  align: { blurb: 'Which side the lines line up on.' },
  lineHeight: {
    blurb: 'The space from one line to the next, times the size.',
    presets: [1, 1.2, 1.5, 2],
  },
  tracking: { blurb: 'The space between letters.', presets: [-0.05, 0, 0.05, 0.1, 0.25] },
  strokeWidth: { blurb: "The outline's width, in photo pixels.", presets: [1, 2, 4, 8, 16, 32] },
  radius: { blurb: "How round the rectangle's corners are.", presets: [0, 8, 16, 32, 64] },
  selection: {
    blurb: 'How a new selection meets the one there.',
  },
  antiAlias: { blurb: 'Smooths the edge so it never looks jagged.' },
  contiguous: { blurb: 'Only areas touching where you click.' },
  sampleAll: { blurb: 'Looks at every layer, not just this one.' },
  square: { blurb: 'A square tip instead of a round one.' },
  autoErase: { blurb: 'Drawing over the foreground colour paints the background colour.' },
  aligned: { blurb: 'The source moves with you from stroke to stroke.' },
  proximity: { blurb: 'Fills from the pixels round the spot, not similar texture.' },
  protectDetail: { blurb: 'Sharpens without adding grain.' },
  fingerPainting: { blurb: 'Starts each smudge with the foreground colour.' },
  protectTones: { blurb: 'Keeps colours true as they lighten or darken.' },
  saturate: { blurb: 'On adds colour; off takes it away.' },
  vibrance: { blurb: 'Goes easy on colours that are already strong.' },
  continuous: { blurb: 'Samples the colour under the centre all the way along.' },
  protect: { blurb: 'Never rubs out the foreground colour.' },
  autoEnhance: { blurb: "Smooths the selection's edge after each stroke." },
  deletePixels: { blurb: 'Throws away what is outside the box, rather than hiding it.' },
  reverse: { blurb: 'Swaps the ends of the gradient.' },
  dither: { blurb: 'Adds a fine noise so smooth blends never band.' },
  italic: { blurb: 'Slanted letters.' },
  fill: { blurb: 'Fills the shape with the foreground colour.' },
  stroke: { blurb: 'Outlines the shape with the background colour.' },
  startArrow: { blurb: 'An arrowhead at the start.' },
  endArrow: { blurb: 'An arrowhead at the end.' },
  intoActive: { blurb: 'Draws on this layer instead of a new one.' },
  autoSelect: { blurb: 'Pressing on a layer picks it up.' },
  x: { blurb: "Where the box's left edge sits, in photo pixels." },
  y: { blurb: "Where the box's top edge sits, in photo pixels." },
  w: { blurb: "The box's width." },
  h: { blurb: "The box's height." },
  angle: { blurb: 'How far the box is turned.', presets: [-90, -45, 0, 45, 90, 180] },
  transformMode: { blurb: 'What dragging a corner does to the box.' },
  percent: { blurb: 'W and H as a percent of the size it started at.' },
  clip: { blurb: 'Changes only the layer just below, not everything under it.' },
  interpolation: { blurb: 'How the pixels are worked out as they are resized or turned.' },
};

// What each value of a choice does, by the option's field key, then the value.
export const CHOICE_BLURBS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  selection: {
    new: 'Replaces the selection.',
    add: 'Adds to the selection.',
    subtract: 'Takes away from the selection.',
    intersect: 'Keeps only where the two overlap.',
  },
  pressure: {
    size: 'Pressing harder makes the tip larger.',
    opacity: 'Pressing harder lays the paint on thicker.',
    both: 'Pressing harder does both.',
    off: 'Every dab is the same.',
  },
  eraserMode: {
    brush: 'A soft, round tip.',
    pencil: 'A hard tip with no soft edge.',
    block: 'A square block, whole pixels.',
  },
  style: {
    normal: 'Any shape you drag.',
    ratio: 'Held to a fixed shape.',
    size: 'Exactly a fixed size.',
  },
  gradientStyle: {
    linear: 'Straight from start to end.',
    radial: 'Out from the centre in rings.',
    angle: 'Round the centre like a clock hand.',
    reflected: 'Mirrored either side of the start.',
    diamond: 'Out from the centre as a diamond.',
  },
  range: {
    shadows: 'The dark tones.',
    midtones: 'The tones in between.',
    highlights: 'The light tones.',
  },
  ratio: {
    free: 'Any shape.',
    original: "The photo's own shape.",
    '1:1': 'Square.',
    '4:5': 'Portrait, for a feed post.',
    '3:2': 'A classic print.',
    '16:9': 'Wide, for a screen.',
    '9:16': 'Tall, for a story.',
  },
  sample: {
    '1': 'Just the pixel under the pointer.',
    '3': 'The average of 9 pixels.',
    '5': 'The average of 25 pixels.',
    '11': 'The average of 121 pixels.',
    '31': 'The average of 961 pixels.',
  },
  weight: { '400': 'Regular weight.', '500': 'A little heavier.', '700': 'Bold.' },
  align: { left: 'Lines start together.', centre: 'Lines centre.', right: 'Lines end together.' },
  transformMode: {
    free: 'Corners scale and turn the box.',
    skew: 'Corners slide the sides.',
    perspective: 'Corners pull the box into depth.',
  },
  interpolation: {
    bicubic: 'Smoothest, for photos.',
    bilinear: 'Smooth and quick.',
    nearest: 'Hard pixels, for pixel art.',
  },
  mode: {
    normal: 'Paint covers what is under it.',
    dissolve: 'Scatters pixels where it is see-through.',
    darken: 'Keeps the darker of the two.',
    multiply: 'Darkens, like layered ink.',
    'colour-burn': 'Darkens and deepens contrast.',
    'linear-burn': 'Darkens more strongly than Multiply.',
    'darker-colour': 'Keeps whichever colour is darker overall.',
    lighten: 'Keeps the lighter of the two.',
    screen: 'Lightens, like projected light.',
    'colour-dodge': 'Brightens and lowers contrast.',
    'linear-dodge': 'Adds the colours together.',
    'lighter-colour': 'Keeps whichever colour is lighter overall.',
    overlay: 'Deepens contrast, keeping the highlights and shadows under it.',
    'soft-light': 'A gentle Overlay, like diffused light.',
    'hard-light': 'A strong Overlay, like a spotlight.',
    'vivid-light': 'Burns or dodges by contrast.',
    'linear-light': 'Burns or dodges by brightness.',
    'pin-light': 'Swaps in colours by how light the paint is.',
    'hard-mix': 'Posterises to pure primaries.',
    difference: 'Takes away the lighter from the darker.',
    exclusion: 'A softer Difference.',
    subtract: 'Takes the paint away from what is under it.',
    divide: 'Divides what is under it by the paint.',
    hue: "The paint's hue, the rest kept.",
    saturation: "The paint's saturation, the rest kept.",
    colour: "The paint's hue and saturation, the brightness kept.",
    luminosity: "The paint's brightness, the colour kept.",
    behind: 'Paints only where the layer is see-through.',
    clear: 'Rubs out, like an eraser.',
  },
};

// The section names a long choice is shown in, in order (the blend modes' families).
export const BLEND_SECTION_NAMES = [
  'Normal',
  'Darken',
  'Lighten',
  'Contrast',
  'Inversion',
  'Component',
] as const;

/** A choice's values in their sections: the blend modes in their families (a brush's Behind and Clear under
 *  Painting); any other choice in one untitled section. */
export function choiceSections<T extends string | number>(
  key: string,
  choices: readonly { value: T; label: string }[],
): { title: string | null; choices: { value: T; label: string }[] }[] {
  if (key !== 'mode' || choices.length < 8) return [{ title: null, choices: [...choices] }];
  const placed = new Set<string>();
  const sections: { title: string | null; choices: { value: T; label: string }[] }[] =
    BLEND_MODE_GROUPS.map((group, i) => {
      const these = choices.filter((c) => group.includes(String(c.value) as never));
      for (const c of these) placed.add(String(c.value));
      return { title: BLEND_SECTION_NAMES[i] ?? null, choices: these };
    });
  const rest = choices.filter((c) => !placed.has(String(c.value)));
  if (rest.length) sections.push({ title: 'Painting', choices: rest });
  return sections.filter((s) => s.choices.length > 0);
}

// What each tool does, for its flyout's header.
export const TOOL_BLURBS: Readonly<Record<string, string>> = {
  move: 'Drag the layer, or the selected pixels, to move them.',
  'rect-select': 'Drag a rectangle to select.',
  'ellipse-select': 'Drag an ellipse to select.',
  lasso: 'Draw round what you want to select.',
  'polygon-lasso': 'Click from corner to corner to select.',
  'magnetic-lasso': 'Trace an edge and the line snaps to it.',
  'quick-select': 'Paint over an area and the selection grows to its edges.',
  'magic-wand': 'Click a colour to select everything like it.',
  crop: 'Drag the box to the part you keep.',
  eyedropper: 'Click to pick up a colour from the photo.',
  'spot-heal': 'Paint over a spot and it blends away.',
  heal: 'Alt-click a clean area, then paint over a flaw.',
  'red-eye': 'Click a red pupil to darken it.',
  brush: 'Paint soft strokes in the foreground colour.',
  pencil: 'Draw hard-edged strokes, pixel for pixel.',
  clone: 'Alt-click a source, then paint a copy of it.',
  eraser: 'Rub out pixels on the layer.',
  'background-eraser': 'Rub out the colour under the centre, keeping the edges.',
  gradient: 'Drag to fill with a blend of colours.',
  bucket: 'Click to fill an area of like colour.',
  blur: 'Paint to soften detail.',
  sharpen: 'Paint to crisp up detail.',
  smudge: 'Drag to push colour along.',
  dodge: 'Paint to lighten.',
  burn: 'Paint to darken.',
  sponge: 'Paint to add or take away colour.',
  text: 'Click to type, or drag a box for the text.',
  rectangle: 'Drag to draw a rectangle.',
  ellipse: 'Drag to draw an ellipse.',
  line: 'Drag to draw a line.',
};

// The sections a tool's options are shown in, by field key, in this order; a key not listed goes under Options,
// and an on and off option with no section under Behaviour.
export const OPTION_SECTIONS: readonly { title: string; keys: readonly string[] }[] = [
  {
    title: 'Selection',
    keys: ['selection', 'style', 'feather', 'tolerance', 'width', 'contrast', 'frequency'],
  },
  {
    title: 'Tip',
    keys: ['eraserMode', 'size', 'hardness', 'square', 'strokeWidth', 'radius', 'pupil'],
  },
  { title: 'Type', keys: ['font', 'weight', 'align', 'lineHeight', 'tracking', 'italic'] },
  { title: 'Gradient', keys: ['gradientStyle', 'gradient', 'reverse', 'dither'] },
  { title: 'Crop', keys: ['ratio', 'deletePixels'] },
  { title: 'Sampling', keys: ['sample'] },
  {
    title: 'Paint',
    keys: ['mode', 'opacity', 'flow', 'smoothing', 'strength', 'range', 'exposure', 'darken'],
  },
  { title: 'Pen', keys: ['pressure'] },
];
