import { PRISM_PALETTES, PRISM_STOPS, type PrismScheme, type PrismStop } from './brand-prism';

// The Living Prism's geometry (docs/specs/004-interface-design/brand-mark.md),
// shared by the React <BrandMark> and by the SVG strings the static copies are
// drawn from (favicons, marketing/media/logo/, the Apple icon, the social card).

// A square box centred on the cube, whose drawing spans x -130..130, y -150..100.
export const BRAND_MARK_VIEWBOX = '-135 -160 270 270';

// `compact` below 48px; `full` adds the detail that only reads from 48px up.
export type BrandMarkVariant = 'compact' | 'full';

export type BrandGradient = {
  key: 'frontLeft' | 'frontBottom' | 'backTop' | 'backRight';
  // Gradient vector, in percent of the face's bounding box.
  vector: { x1: number; y1: number; x2: number; y2: number };
  // [palette stop, offset %, stop opacity]
  stops: readonly (readonly [PrismStop, number, number])[];
};

export const BRAND_GRADIENTS: readonly BrandGradient[] = [
  {
    key: 'frontLeft',
    vector: { x1: 0, y1: 0, x2: 100, y2: 100 },
    stops: [
      ['light', 0, 0.9],
      ['vivid', 50, 0.85],
      ['primary', 100, 0.95],
    ],
  },
  {
    key: 'frontBottom',
    vector: { x1: 0, y1: 0, x2: 100, y2: 100 },
    stops: [
      ['vivid', 0, 0.8],
      ['deep', 100, 0.95],
    ],
  },
  {
    key: 'backTop',
    vector: { x1: 0, y1: 100, x2: 100, y2: 0 },
    stops: [
      ['light', 0, 0.75],
      ['highlight', 100, 0.85],
    ],
  },
  {
    key: 'backRight',
    vector: { x1: 0, y1: 0, x2: 100, y2: 100 },
    stops: [
      ['primary', 0, 0.7],
      ['dark', 100, 0.85],
    ],
  },
];

export type BrandFace = {
  key: 'top' | 'rearRight' | 'left' | 'bottom';
  d: string;
  gradient: BrandGradient['key'];
  // Blends into the faces behind it (multiply light, screen dark).
  blend: boolean;
  // The face's opacity in the one-colour `mono` tone.
  monoOpacity: number;
};

// Back to front. The inner diagram (full only) sits between rearRight and left.
export const BRAND_FACES: readonly BrandFace[] = [
  {
    key: 'top',
    d: 'M-130 -75L0 -150L130 -75L0 0Z',
    gradient: 'backTop',
    blend: false,
    monoOpacity: 0.45,
  },
  {
    key: 'rearRight',
    d: 'M130 -75L130 25L0 100L0 0Z',
    gradient: 'backRight',
    blend: true,
    monoOpacity: 0.7,
  },
  {
    key: 'left',
    d: 'M-130 -75L-130 25L0 100L0 0Z',
    gradient: 'frontLeft',
    blend: false,
    monoOpacity: 0.9,
  },
  {
    key: 'bottom',
    d: 'M-130 25L0 100L130 25L0 -50Z',
    gradient: 'frontBottom',
    blend: true,
    monoOpacity: 0.6,
  },
];

// Full-only detail.
export const BRAND_DETAIL = {
  // The inner diagram: a dashed link through three nodes, in `highlight`.
  nodes: {
    opacity: 0.65,
    link: 'M-60 -35L0 0L60 -35',
    circles: [
      { cx: -60, cy: -35, r: 4 },
      { cx: 0, cy: 0, r: 5 },
      { cx: 60, cy: -35, r: 4 },
    ],
  },
  // White glass sheen on the top ridge, the bottom ridge and the front edge.
  sheen: [
    { d: 'M-130 -75L0 -150L130 -75', width: 2.5, opacity: 1 },
    { d: 'M-130 25L0 100L130 25', width: 3, opacity: 1 },
    { d: 'M0 0L0 100', width: 1.5, opacity: 0.7 },
  ],
  // The live signal pulse along the front-right edge.
  pulse: [
    { cx: 45, cy: 74, r: 3.5, opacity: 1, glow: true },
    { cx: 85, cy: 51, r: 3, opacity: 0.8, glow: false },
  ],
} as const;

const BLEND: Record<PrismScheme, string> = { light: 'multiply', dark: 'screen' };

// The mark as a standalone SVG document. `light` / `dark` write literal colours
// (renderers without CSS variables or media queries: next/og's resvg, the PNG
// script); `auto` follows the viewer's prefers-color-scheme, for favicons.
// `idPrefix` keeps gradient ids unique when several marks share one document.
export function brandMarkSvg({
  variant = 'compact',
  scheme = 'auto',
  idPrefix = '',
}: { variant?: BrandMarkVariant; scheme?: PrismScheme | 'auto'; idPrefix?: string } = {}): string {
  const fixed = scheme === 'auto' ? null : PRISM_PALETTES[scheme];
  const stopColour = (stop: PrismStop) =>
    fixed ? ` stop-color="${fixed[stop]}"` : ` class="s-${stop}"`;
  const gradients = BRAND_GRADIENTS.map(({ key, vector: v, stops }) => {
    const inner = stops
      .map(
        ([stop, offset, opacity]) =>
          `<stop offset="${offset}%"${stopColour(stop)} stop-opacity="${opacity}"/>`,
      )
      .join('');
    return `<linearGradient id="${idPrefix}${key}" x1="${v.x1}%" y1="${v.y1}%" x2="${v.x2}%" y2="${v.y2}%">${inner}</linearGradient>`;
  });
  const full = variant === 'full';
  if (full) {
    gradients.push(
      `<linearGradient id="${idPrefix}sheen" x1="0%" y1="0%" x2="0%" y2="100%">` +
        `<stop offset="0%" stop-color="#ffffff" stop-opacity="0.45"/>` +
        `<stop offset="100%" stop-color="#ffffff" stop-opacity="0.05"/></linearGradient>`,
      `<filter id="${idPrefix}glow" x="-20%" y="-20%" width="140%" height="140%">` +
        `<feGaussianBlur stdDeviation="3" result="blur"/>` +
        `<feComposite in="SourceGraphic" in2="blur" operator="over"/></filter>`,
    );
  }
  const css = (s: PrismScheme) =>
    PRISM_STOPS.map((stop) => `.s-${stop}{stop-color:${PRISM_PALETTES[s][stop]}}`).join('') +
    `.blend{mix-blend-mode:${BLEND[s]}}` +
    (full
      ? `.node-fill{fill:${PRISM_PALETTES[s].highlight}}.node-stroke{stroke:${PRISM_PALETTES[s].highlight}}`
      : '');
  const style = fixed
    ? ''
    : `<style>${css('light')}@media (prefers-color-scheme:dark){${css('dark')}}</style>`;
  const blendAttr = fixed
    ? ` style="mix-blend-mode:${BLEND[scheme as PrismScheme]}"`
    : ' class="blend"';
  const nodeFill = fixed ? ` fill="${fixed.highlight}"` : ' class="node-fill"';
  const nodeStroke = fixed ? ` stroke="${fixed.highlight}"` : ' class="node-stroke"';

  const body: string[] = [];
  BRAND_FACES.forEach((face, i) => {
    body.push(
      `<path d="${face.d}" fill="url(#${idPrefix}${face.gradient})"${face.blend ? blendAttr : ''}/>`,
    );
    if (full && i === 1) {
      const { nodes } = BRAND_DETAIL;
      body.push(
        `<g opacity="${nodes.opacity}">` +
          `<path d="${nodes.link}"${nodeStroke} fill="none" stroke-width="2.5" stroke-dasharray="4 4"/>` +
          nodes.circles
            .map(
              (c) =>
                `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"${nodeFill} filter="url(#${idPrefix}glow)"/>`,
            )
            .join('') +
          `</g>`,
      );
    }
  });
  if (full) {
    for (const s of BRAND_DETAIL.sheen) {
      body.push(
        `<path d="${s.d}" stroke="url(#${idPrefix}sheen)" stroke-width="${s.width}" stroke-linecap="round" fill="none"` +
          (s.opacity < 1 ? ` opacity="${s.opacity}"` : '') +
          `/>`,
      );
    }
    for (const p of BRAND_DETAIL.pulse) {
      body.push(
        `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="#ffffff"` +
          (p.opacity < 1 ? ` opacity="${p.opacity}"` : '') +
          (p.glow ? ` filter="url(#${idPrefix}glow)"` : '') +
          `/>`,
      );
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK_VIEWBOX}" style="isolation:isolate">` +
    style +
    `<defs>${gradients.join('')}</defs>` +
    body.join('') +
    `</svg>`
  );
}
