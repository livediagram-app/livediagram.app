// Sticky-note workshop boards: the affinity map (research notes clustered
// into insights) and the user story map (a journey backbone with story cards
// sliced into releases). Both are the OUTPUT of a real workshop, drawn the
// way the practice draws them, in the stationery colours the practice uses:
// yellow for the raw notes, a cooler colour for each level of synthesis above
// them. The fill-the-boxes strategy canvases live in
// template-builders-canvases.ts.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. See docs/specs/008-canvas/canvas-and-palette.md "Templates" for the catalogue.

import { createShape, createSticky, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { BLUE, MUTED, PINK, YELLOW } from './template-workshop-stickies';

// The user story map lives in its own module; re-exported so build-template
// keeps importing both workshop boards from here.
export { buildUserStoryMap } from './template-builders-story-map';

// Affinity map: interview notes after the room has clustered them, in the
// Contextual Design hierarchy. Yellow notes are verbatim observations tagged
// with the participant who said them (P3); a blue note heads each group with
// the insight in the user's voice ("I don't know where to start"); a pink
// note names the theme two groups share. Each theme is a dashed frame drawn
// round its groups. The blue headers carry the dot-vote tally from the vote
// button up by the title, so the board shows which insight won. Two notes
// still lean in an Unsorted pile at the side: the part of the wall nobody has
// placed yet. Frames and labels are the "Board" scaffold; every note, disc
// and the vote button ride "Stickies".
type Group = { insight: string; votes: number; notes: string[] };
type Theme = { title: string; groups: [Group, Group] };

const AFFINITY_THEMES: [Theme, Theme] = [
  {
    title: 'Getting started feels like work',
    groups: [
      {
        insight: '“I don’t know where to start”',
        votes: 6,
        notes: [
          'Blank canvas froze me · P3',
          'Wanted a sample to poke at · P7',
          'Never saw the templates button · P11',
        ],
      },
      {
        insight: '“Setup takes too long”',
        votes: 2,
        notes: ['Invite flow asked too much · P2', 'Verified my email twice · P9'],
      },
    ],
  },
  {
    title: 'I can’t tell if it’s worth paying for',
    groups: [
      {
        insight: '“Pricing is a mystery”',
        votes: 4,
        notes: [
          'Couldn’t find the free-tier limits · P4',
          'No pricing link inside the app · P6',
          'Scared of a surprise bill · P12',
        ],
      },
      {
        insight: '“I don’t trust it yet”',
        votes: 1,
        notes: ['Never heard of the brand · P1', 'No logos from teams like mine · P8'],
      },
    ],
  },
];
const AFFINITY_UNSORTED = ['Slow to load on my phone · P5', 'Dark mode please! · P10'];

export function buildAffinityMap(cx: number, cy: number): Element[] {
  const colW = 260;
  const colGap = 20;
  const framePad = 20;
  const themeGap = 40;
  const pinkH = 68;
  const blueH = 80;
  const noteH = 84;
  const noteGap = 12;
  const rowGap = 16;
  const pileW = 230;
  const titleH = 52;
  const subtitleH = 30;
  const headGap = 28;
  const maxNotes = Math.max(...AFFINITY_THEMES.flatMap((t) => t.groups.map((g) => g.notes.length)));
  const themeW = colW * 2 + colGap;
  const frameW = themeW + framePad * 2;
  const frameH =
    framePad + pinkH + rowGap + blueH + rowGap + maxNotes * (noteH + noteGap) - noteGap + framePad;
  const totalW = frameW * 2 + themeGap + themeGap + pileW;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + frameH) / 2;
  const top = y0 + titleH + subtitleH + headGap;

  const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
  const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };
  const voteW = 152;
  const elements: Element[] = [
    {
      ...createText(x0, y0),
      width: totalW - voteW - 260,
      height: titleH,
      label: 'Affinity map · Why do trial users leave before day 7?',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(x0, y0 + titleH),
      width: totalW - voteW - 260,
      height: subtitleH,
      label:
        '31 notes from 12 interviews. Cluster in silence, name each group in the user’s words, then vote.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...scaffold,
    },
    {
      ...createText(x0 + totalW - voteW - 244, y0),
      width: 228,
      height: 96,
      label: 'Three dots each on the insights we should act on first.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'right',
      textAlignY: 'middle',
      ...scaffold,
    },
    {
      ...createShape('session-button', x0 + totalW - voteW, y0),
      width: voteW,
      height: 96,
      session: { tool: 'vote', dots: 3 },
      ...content,
    },
  ];

  AFFINITY_THEMES.forEach((theme, ti) => {
    const fx = x0 + ti * (frameW + themeGap);
    elements.push({
      ...createShape('frame', fx, top),
      width: frameW,
      height: frameH,
      label: '',
      strokeStyle: 'dashed',
      strokeColor: '#e11d48',
      ...scaffold,
    });
    const innerX = fx + framePad;
    elements.push({
      ...createSticky(innerX, top + framePad),
      width: themeW,
      height: pinkH,
      label: theme.title,
      textSize: 'md',
      textBold: true,
      textAlignX: 'center',
      textAlignY: 'middle',
      ...PINK,
      ...content,
    });
    const blueY = top + framePad + pinkH + rowGap;
    theme.groups.forEach((group, gi) => {
      const gx = innerX + gi * (colW + colGap);
      elements.push({
        ...createSticky(gx, blueY),
        width: colW,
        height: blueH,
        label: group.insight,
        textSize: 'sm',
        textBold: true,
        textAlignX: 'center',
        textAlignY: 'middle',
        ...BLUE,
        ...content,
      });
      const disc = 32;
      elements.push({
        ...createShape('circle', gx + colW - disc + 8, blueY - 10),
        width: disc,
        height: disc,
        label: String(group.votes),
        textSize: 'sm',
        textBold: true,
        padding: 'none',
        // The Inked preset: a dark disc with light text under every theme.
        fillColor: '#0f172a',
        strokeColor: '#334155',
        textColor: '#f8fafc',
        strokeWidth: 'medium',
        colorPreset: 'inked',
        ...content,
      });
      group.notes.forEach((text, ni) => {
        elements.push({
          ...createSticky(gx, blueY + blueH + rowGap + ni * (noteH + noteGap)),
          width: colW,
          height: noteH,
          label: text,
          textSize: 'sm',
          // A gentle alternating tilt, so the wall reads as hand-placed.
          rotation: (ni + gi) % 2 === 0 ? -1.5 : 1.5,
          ...YELLOW,
          ...content,
        });
      });
    });
  });

  // The unsorted pile leans harder than the clustered notes: nobody has
  // placed it yet.
  const pileX = x0 + totalW - pileW;
  elements.push({
    ...createText(pileX, top),
    width: pileW,
    height: 36,
    label: 'Unsorted',
    textSize: 'md',
    textBold: true,
    textColor: MUTED,
    textAlignX: 'left',
    ...scaffold,
  });
  AFFINITY_UNSORTED.forEach((text, i) => {
    elements.push({
      ...createSticky(pileX + 6, top + 52 + i * (noteH + 36)),
      width: pileW - 12,
      height: noteH,
      label: text,
      textSize: 'sm',
      rotation: i % 2 === 0 ? 4 : -5,
      ...YELLOW,
      ...content,
    });
  });

  return elements;
}
