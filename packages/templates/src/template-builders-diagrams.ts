// Per-template element builders for the diagram-style templates: pyramid and
// flywheel, plus re-exports of the Venn, journey map and fishbone. Split out of template-builders.ts to keep each file
// under the ~400-line target; build-template dispatches here. Each builder is
// pure: (cx, cy) -> Element[].
//
// The three timelines moved to ./template-builders-timelines, and the Venn,
// journey map and fishbone grew into files of their own
// (./template-builders-venn, -journey, -fishbone); they are re-exported below
// so build-template keeps one import for the family.
import {
  createArrow,
  createPinnedArrow,
  createShape,
  createText,
  type Anchor,
  type Element,
} from '@livediagram/diagram';
export { buildVenn } from './template-builders-venn';

export { buildJourney } from './template-builders-journey';
export { buildFishbone } from './template-builders-fishbone';

const MUTED = '#64748b';

// A true pyramid: one clean triangle banded into five tiers (Purpose at the
// peak down to Initiatives at the base). Each band is a triangle sharing the
// apex and the slope, drawn largest first, so every smaller one covers the
// top of the one behind it and what shows is exactly that tier's band; the
// slanted sides line up by construction. The bands ramp from a saturated
// peak to a pale foundation (kept light enough that the dark ink every light
// theme gives text stays legible on the locked fills), and a rail on the right gives every tier its
// guiding question plus a worked answer, so the template teaches the model
// while it scaffolds a real strategy.
export function buildPyramid(cx: number, cy: number): Element[] {
  type Tier = { label: string; question: string; answer: string; fill: string; ink: string };
  const tiers: Tier[] = [
    {
      label: 'Purpose',
      question: 'Why do we exist?',
      answer: 'Help every team think out loud, together',
      fill: '#3b82f6',
      ink: '#0f172a',
    },
    {
      label: 'Vision',
      question: 'Where are we going?',
      answer: 'The first canvas a team opens, by 2028',
      fill: '#60a5fa',
      ink: '#0f172a',
    },
    {
      label: 'Strategy',
      question: 'How will we win?',
      answer: 'Free, open and faster than a whiteboard',
      fill: '#93c5fd',
      ink: '#0f172a',
    },
    {
      label: 'Goals',
      question: 'What will we hit this year?',
      answer: '50k weekly teams, NPS 55',
      fill: '#bfdbfe',
      ink: '#0f172a',
    },
    {
      label: 'Initiatives',
      question: 'What are we doing now?',
      answer: 'Templates, live cursors, a mobile app',
      fill: '#e0ecff',
      ink: '#0f172a',
    },
  ];
  const baseW = 1000;
  const tierH = 112;
  const H = tiers.length * tierH;
  const railGap = 64;
  const railW = 380;
  // The rail hangs off the right, so shift the pyramid left by half of it to
  // keep the whole composition centred on (cx, cy).
  const px = cx - (railGap + railW) / 2;
  const top = cy - H / 2;
  // Half-width of the triangle at a given y.
  const half = (y: number) => ((y - top) / H) * (baseW / 2);
  // The triangle silhouette spans 2..98% of its box on both axes, so a band
  // whose visible triangle is h tall and w wide needs a box 1/0.96 larger,
  // nudged up and left by the 2% inset.
  const inset = 0.96;

  const bands: Element[] = [];
  const labels: Element[] = [];
  tiers.forEach((t, i) => {
    const y1 = top + (i + 1) * tierH;
    const visW = half(y1) * 2;
    const visH = y1 - top;
    const boxW = visW / inset;
    const boxH = visH / inset;
    bands.push({
      ...createShape('triangle', px - boxW / 2, top - boxH * 0.02),
      width: boxW,
      height: boxH,
      label: '',
      fillColor: t.fill,
      // The ramp is the reading order (peak = most enduring), so it
      // survives a theme switch.
      themeLockFill: true,
    });

    // Tier names are overlay text (the funnel's convention): a shape's own
    // label centres on its box, which here is the whole triangle above the
    // band. The apex name sits in its lower, wider half.
    const y0 = y1 - tierH;
    const nameY = i === 0 ? y1 - 44 : (y0 + y1) / 2 - 18;
    labels.push({
      ...createText(px - 120, nameY),
      width: 240,
      height: 36,
      label: t.label,
      textSize: 'md',
      textBold: true,
      textAlignX: 'center',
      textColor: t.ink,
    });

    // Rail: a dotted leader from the band's slanted edge, then the tier's
    // guiding question over a muted worked answer.
    const midY = (y0 + y1) / 2;
    const railX = px + baseW / 2 + railGap;
    labels.push({
      ...createArrow(px + half(midY) + 14, midY, railX - 14, midY),
      arrowEnds: 'none',
      strokeStyle: 'dotted',
      strokeColor: '#cbd5e1',
      routeBehind: false,
    });
    labels.push({
      ...createText(railX, midY - 32),
      width: railW,
      height: 30,
      label: t.question,
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      textColor: '#1d4ed8',
    });
    labels.push({
      ...createText(railX, midY + 2),
      width: railW,
      height: 30,
      label: t.answer,
      textSize: 'sm',
      textAlignX: 'left',
      textColor: MUTED,
    });
  });
  // Largest band first, so each smaller one paints over the top of it.
  return [...bands.reverse(), ...labels];
}

// Flywheel: central hub circle + four reinforcing-stage sector
// circles arranged at 12/3/6/9 o'clock, connected by a clockwise loop
// of arrows. A small caption sits outside each sector with example
// tactics. Reads as a momentum loop rather than a static four-up.
export function buildFlywheel(cx: number, cy: number): Element[] {
  const elements: Element[] = [];
  const hubSize = 200;
  const sectorSize = 160;
  const orbitRadius = 260;
  const captionOffset = 110;
  const captionW = 200;
  const captionH = 50;

  const hub = {
    ...createShape('circle', cx - hubSize / 2, cy - hubSize / 2),
    width: hubSize,
    height: hubSize,
    label: 'Growth flywheel',
    textSize: 'md' as const,
    // The hub drives the whole loop → hero preset.
    colorPreset: 'bold',
  };
  elements.push(hub);

  type SectorSpec = {
    angleDeg: number;
    label: string;
    caption: string;
    // Anchors on THIS sector. `out` is where this sector's outgoing
    // arrow leaves (toward the next sector clockwise). `into` is
    // where this sector's incoming arrow arrives (from the previous
    // sector). Picking the cardinal anchor that FACES the neighbour
    // keeps the arrow off the hub and off the other sectors — e.g.
    // Attract (top) leaves from its east face toward Engage (right),
    // and Engage's incoming arrow arrives at its north face.
    out: Anchor;
    into: Anchor;
  };
  // Clockwise starting at the top. Each sector's `out` faces the
  // NEXT sector clockwise; each `into` faces the PREVIOUS sector.
  const sectors: SectorSpec[] = [
    {
      angleDeg: -90,
      label: 'Attract',
      caption: 'Ads, SEO, content',
      out: 'e', // Attract.E -> Engage.N
      into: 'w', // Refer.N -> Attract.W
    },
    {
      angleDeg: 0,
      label: 'Engage',
      caption: 'Demos, onboarding, support',
      out: 's', // Engage.S -> Delight.E
      into: 'n', // Attract.E -> Engage.N
    },
    {
      angleDeg: 90,
      label: 'Delight',
      caption: 'Wins, outcomes, wow moments',
      out: 'w', // Delight.W -> Refer.S
      into: 'e', // Engage.S -> Delight.E
    },
    {
      angleDeg: 180,
      label: 'Refer',
      caption: 'Reviews, word of mouth, referrals',
      out: 'n', // Refer.N -> Attract.W
      into: 's', // Delight.W -> Refer.S
    },
  ];

  const sectorElements = sectors.map(({ angleDeg, label }) => {
    const rad = (angleDeg * Math.PI) / 180;
    const sx = cx + Math.cos(rad) * orbitRadius - sectorSize / 2;
    const sy = cy + Math.sin(rad) * orbitRadius - sectorSize / 2;
    return {
      ...createShape('circle', sx, sy),
      width: sectorSize,
      height: sectorSize,
      label,
      textSize: 'md' as const,
    };
  });
  elements.push(...sectorElements);

  // Captions sit OUTSIDE each sector, in line with the sector's
  // outward direction from the hub. Positioned by the same angle as
  // the sector, just further out.
  sectors.forEach(({ angleDeg, caption }) => {
    const rad = (angleDeg * Math.PI) / 180;
    const dist = orbitRadius + sectorSize / 2 + captionOffset;
    const cxC = cx + Math.cos(rad) * dist;
    const cyC = cy + Math.sin(rad) * dist;
    elements.push({
      ...createText(cxC - captionW / 2, cyC - captionH / 2),
      width: captionW,
      height: captionH,
      label: caption,
      textSize: 'sm',
    });
  });

  // Clockwise arrows between adjacent sectors. The outgoing arrow
  // leaves THIS sector's `out` anchor and lands on the NEXT sector's
  // `into` anchor, so each arrow stays on the outside of the wheel
  // rather than cutting through the hub.
  //
  // Style: curved so the connector arcs around the outside of the
  // wheel (a straight line between adjacent sectors cuts close to
  // the hub at this radius), and dashed so it reads as "ongoing
  // momentum / repeat cycle" rather than a one-shot flow. A slow
  // "dashes" flow animation runs by default so the momentum reads as
  // motion the moment the template lands, not a static diagram.
  sectors.forEach((sector, i) => {
    const next = sectors[(i + 1) % sectors.length]!;
    const nextEl = sectorElements[(i + 1) % sectors.length]!;
    elements.push({
      ...createPinnedArrow(sectorElements[i]!.id, sector.out, nextEl.id, next.into),
      arrowStyle: 'curved',
      strokeStyle: 'dashed',
      flow: 'dashes',
      flowSpeed: 'slow',
    });
  });

  return elements;
}
