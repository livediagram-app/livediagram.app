// A form cover's animated backgrounds (docs/specs/030-forms/forms.md "The form card, top to bottom", Cover):
// the motions offered, the theme colourings they come in, and the colours a motion layer paints
// its moving parts in. Pure: the Animated tab and the motion layer both read it.
import {
  hexToRgb,
  mixHex,
  rgbToHex,
  shade,
  themeAccent,
  tint,
  type ThemeDefinition,
} from '@livediagram/document';
import {
  PAGE_GRADIENT_ANGLE,
  pageIsDark,
  themeSecondaries,
  type PageColourFill,
  type PageMotion,
} from './colour-background';

type PageMotionEntry = {
  id: PageMotion;
  label: string;
  // What it does, for its tooltip.
  description: string;
  // The colouring it starts in (a slide's background is most often deep).
  colouring: PageMotionColouringId;
};

export const PAGE_MOTION_CATALOGUE: readonly PageMotionEntry[] = [
  {
    id: 'aurora',
    label: 'Aurora',
    description: 'Soft lights drifting across the sky',
    colouring: 'deep',
  },
  {
    id: 'mesh',
    label: 'Mesh',
    description: 'Colours slowly turning into each other',
    colouring: 'bright',
  },
  {
    id: 'starfield',
    label: 'Starfield',
    description: 'Stars twinkling as the sky drifts',
    colouring: 'night',
  },
  {
    id: 'retro-grid',
    label: 'Retro Grid',
    description: 'A neon grid rolling to the horizon',
    colouring: 'night',
  },
  {
    id: 'bokeh',
    label: 'Bokeh',
    description: 'Out-of-focus lights floating by',
    colouring: 'deep',
  },
  {
    id: 'waves',
    label: 'Waves',
    description: 'Layered waves rolling along the bottom',
    colouring: 'deep',
  },
  {
    id: 'spotlight',
    label: 'Spotlight',
    description: 'A stage light sweeping the slide',
    colouring: 'night',
  },
  { id: 'beams', label: 'Beams', description: 'Shafts of light gliding past', colouring: 'deep' },
  {
    id: 'flow',
    label: 'Flow',
    description: 'Fine lines streaming on the diagonal',
    colouring: 'deep',
  },
  { id: 'drift', label: 'Drift', description: 'Bubbles rising and fading', colouring: 'bright' },
  {
    id: 'ripple',
    label: 'Ripple',
    description: 'Rings spreading from the centre',
    colouring: 'soft',
  },
  {
    id: 'ribbons',
    label: 'Ribbons',
    description: 'Ribbons of colour flowing sideways',
    colouring: 'soft',
  },
  {
    id: 'sunburst',
    label: 'Sunburst',
    description: 'Rays turning slowly from below',
    colouring: 'vivid',
  },
  {
    id: 'fireflies',
    label: 'Fireflies',
    description: 'Small lights drifting and glowing',
    colouring: 'night',
  },
  { id: 'snowfall', label: 'Snowfall', description: 'Snow falling softly past', colouring: 'deep' },
  {
    id: 'lava',
    label: 'Lava',
    description: 'Big soft blobs rising and sinking',
    colouring: 'vivid',
  },
  {
    id: 'dot-wave',
    label: 'Dot Wave',
    description: 'A grid of dots swelling in a wave',
    colouring: 'deep',
  },
  {
    id: 'clouds',
    label: 'Clouds',
    description: 'Soft clouds drifting across',
    colouring: 'bright',
  },
  {
    id: 'warp',
    label: 'Warp',
    description: 'Stars streaking out from the centre',
    colouring: 'night',
  },
  {
    id: 'orbits',
    label: 'Orbits',
    description: 'Planets circling a glowing sun',
    colouring: 'deep',
  },
  {
    id: 'radar',
    label: 'Radar',
    description: 'A sweep turning, lighting blips as it passes',
    colouring: 'night',
  },
  {
    id: 'equaliser',
    label: 'Equaliser',
    description: 'Bars rising and falling to a beat',
    colouring: 'vivid',
  },
  {
    id: 'confetti',
    label: 'Confetti',
    description: 'Confetti fluttering down',
    colouring: 'bright',
  },
  {
    id: 'threads',
    label: 'Threads',
    description: 'Fine threads of light weaving past',
    colouring: 'deep',
  },
];

export type PageMotionColouringId = 'deep' | 'night' | 'bright' | 'vivid' | 'soft' | 'mist';

export const PAGE_MOTION_COLOURINGS: readonly { id: PageMotionColouringId; label: string }[] = [
  { id: 'deep', label: 'Theme Deep' },
  { id: 'night', label: 'Theme Night' },
  { id: 'vivid', label: 'Theme Vivid' },
  { id: 'bright', label: 'Theme Bright' },
  { id: 'soft', label: 'Theme Soft' },
  { id: 'mist', label: 'Theme Mist' },
];

type ThemeColours = Partial<Pick<ThemeDefinition, 'elementStroke' | 'palette'>>;

/** A colouring's two gradient stops, drawn from the theme's accent and its second colour. */
export function motionColouring(
  theme: ThemeColours,
  id: PageMotionColouringId,
): {
  from: string;
  to: string;
} {
  const a = themeAccent(theme);
  const [b] = themeSecondaries(theme);
  switch (id) {
    case 'deep':
      return { from: shade(a, 0.62), to: shade(b, 0.38) };
    case 'night':
      return { from: '#0b1020', to: shade(a, 0.72) };
    case 'vivid':
      return { from: a, to: shade(b, 0.25) };
    case 'bright':
      return { from: tint(a, 0.15), to: b };
    case 'soft':
      return { from: tint(a, 0.88), to: tint(b, 0.7) };
    case 'mist':
      return { from: tint(a, 0.95), to: tint(a, 0.72) };
  }
}

/** The fill a motion makes in a colouring: a gradient (what exports and re-inking see) with its
 *  motion. */
export function motionFill(
  theme: ThemeColours,
  motion: PageMotion,
  colouring: PageMotionColouringId,
): PageColourFill {
  return {
    kind: 'gradient',
    ...motionColouring(theme, colouring),
    angle: PAGE_GRADIENT_ANGLE,
    motion,
  };
}

/** The colouring a fill's stops match for this theme, if any (its swatch shows as chosen). */
export function colouringOf(
  theme: ThemeColours,
  fill: PageColourFill | undefined,
): PageMotionColouringId | undefined {
  if (fill?.kind !== 'gradient') return undefined;
  return PAGE_MOTION_COLOURINGS.find(({ id }) => {
    const c = motionColouring(theme, id);
    return c.from === fill.from && c.to === fill.to;
  })?.id;
}

export type MotionPaint = {
  // The two stops, for parts tinted like the page.
  a: string;
  b: string;
  // A light that reads on the page: near white on a dark page, white on a light one.
  hi: string;
  // A shade deeper than the page, for parts that sit in its shadows.
  lo: string;
  // How strongly the moving parts show: a light page takes them softer.
  strength: number;
  // Two companion hues, the page's colour turned either way round the wheel and lit: what gives
  // an aurora or a mesh its play of colour on a one-colour theme.
  warm: string;
  cool: string;
};

/** The colours a motion layer paints in, from its gradient. */
export function motionPaint(fill: { from: string; to: string }): MotionPaint {
  const mid = mixHex(fill.from, fill.to, 0.5);
  const dark = pageIsDark({ background: { fill: { kind: 'solid', color: mid } } });
  return {
    a: fill.from,
    b: fill.to,
    hi: dark ? tint(mid, 0.72) : '#ffffff',
    lo: dark ? shade(mid, 0.45) : shade(mid, 0.18),
    strength: dark ? 1 : 0.7,
    warm: hueTurned(fill.to, -42, dark ? 0.62 : 0.55),
    cool: hueTurned(fill.to, 48, dark ? 0.6 : 0.55),
  };
}

/** A colour turned `degrees` round the hue wheel, at saturation 0.75 and lightness `lightness`. */
export function hueTurned(color: string, degrees: number, lightness: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (((h * 60 + degrees) % 360) + 360) % 360;
  const s = 0.75;
  const c = (1 - Math.abs(2 * lightness - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;
  const [r1, g1, b1] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgbToHex({ r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 });
}

/** A fixed pseudo-random number in [0, 1) for part `i` of a motion: the same on every render and
 *  every machine, so a slide looks the same wherever it is opened. */
export function motionSeed(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
