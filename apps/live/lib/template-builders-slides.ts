// Framed-panel design templates: the slide deck (moved here from
// template-builders-wireframes.ts, which now holds only the device
// wireframes) and the storyboard. Both arrange content inside a grid
// of presentation frames, which is why they share a file.
//
// Each function is pure: takes a centre (cx, cy), returns a fresh
// Element[]. Sizing constants stay inline so the geometry remains
// self-describing alongside the shape it draws. See spec/09
// "Templates" for the catalogue and per-template intent.

import { createPinnedArrow, createShape, createText, type Element } from '@livediagram/diagram';

// Slide deck: four slides in a 2x2 grid, each a framed square with a
// stadium heading band and slide-specific content — a title slide, a
// numbered agenda, three feature cards, and a next-steps checklist —
// wired by arrows in a TL -> TR -> BR -> BL loop. Geometry mirrors a
// hand-built reference (562x400 slides), re-centred on the supplied
// canvas point. Colours are left to the theme.
export function buildSlideDeck(cx: number, cy: number): Element[] {
  const slideW = 562;
  const slideH = 400;
  const hGap = 44;
  const vGap = 41;
  const totalW = 2 * slideW + hGap;
  const totalH = 2 * slideH + vGap;
  const startX = cx - totalW / 2;
  const startY = cy - totalH / 2;
  const tl = { x: startX, y: startY };
  const tr = { x: startX + slideW + hGap, y: startY };
  const bl = { x: startX, y: startY + slideH + vGap };
  const br = { x: startX + slideW + hGap, y: startY + slideH + vGap };

  const elements: Element[] = [];
  type Origin = { x: number; y: number };
  type Kind = 'square' | 'stadium' | 'circle';
  type Opts = { label?: string; size?: 'sm' | 'md'; left?: boolean };
  // Element at an offset from a slide's top-left. textSize defaults to
  // 'sm'; pass size for the headings / cards.
  const at = (
    o: Origin,
    kind: Kind,
    rx: number,
    ry: number,
    w: number,
    h: number,
    opts: Opts = {},
  ): Element => ({
    ...createShape(kind, o.x + rx, o.y + ry),
    width: w,
    height: h,
    textSize: opts.size ?? 'sm',
    ...(opts.label !== undefined ? { label: opts.label } : {}),
    ...(opts.left ? { textAlignX: 'left' as const } : {}),
  });

  // Frames first, so content layers on top and the ids are available
  // to pin the connector arrows.
  const fTL = at(tl, 'square', 0, 0, slideW, slideH);
  const fTR = at(tr, 'square', 0, 0, slideW, slideH);
  const fBL = at(bl, 'square', 0, 0, slideW, slideH);
  const fBR = at(br, 'square', 0, 0, slideW, slideH);
  elements.push(fTL, fTR, fBL, fBR);

  // Heading band on every slide.
  elements.push(at(tl, 'stadium', 24, 23, 515, 63, { label: 'Q3 Roadmap', size: 'md' }));
  elements.push(at(tr, 'stadium', 24, 23, 515, 63, { label: 'Agenda', size: 'md' }));
  // BR/BL carry the third/fourth slides so the TL -> TR -> BR -> BL snake
  // visits them in presentation order (bets before next steps).
  elements.push(at(br, 'stadium', 24, 23, 515, 63, { label: 'Three Q3 bets', size: 'md' }));
  elements.push(at(bl, 'stadium', 24, 23, 515, 63, { label: 'Next steps', size: 'md' }));

  // TL — title slide: subtitle + speaker tag.
  elements.push(at(tl, 'square', 36, 111, 491, 43, { label: 'Team kick-off · 6 Aug', left: true }));
  elements.push(at(tl, 'stadium', 36, 329, 296, 40, { label: 'Hosted by Alex Rivera' }));

  // TR — agenda: numbered rows.
  const agenda = [
    'Where we landed in Q2',
    'Three Q3 bets',
    'Risks + dependencies',
    'Open questions',
  ];
  const rowY = [117, 172, 226, 280];
  agenda.forEach((label, i) => {
    elements.push(at(tr, 'square', 41, rowY[i]!, 41, 40, { label: `${i + 1}` }));
    elements.push(at(tr, 'square', 95, rowY[i]!, 426, 40, { label, left: true }));
  });

  // BR — three feature cards (icon dot + label).
  const bets = ['Self-serve onboarding', 'Realtime collaboration', 'Pricing experiment'];
  const cardX = [24, 201, 379];
  bets.forEach((label, i) => {
    elements.push(at(br, 'square', cardX[i]!, 117, 160, 237, { size: 'md' }));
    elements.push(at(br, 'circle', cardX[i]! + 56, 143, 47, 46, { size: 'md' }));
    elements.push(at(br, 'square', cardX[i]! + 14, 269, 130, 54, { label }));
  });

  // BL — next steps: checkbox + action pill per row.
  const actions = [
    'Lock scope by Friday',
    'Eng + design pairing',
    'Weekly review on Tuesdays',
    'Send recap by EOD',
  ];
  actions.forEach((label, i) => {
    elements.push(at(bl, 'circle', 41, rowY[i]! + 6, 30, 29, { size: 'md' }));
    elements.push(at(bl, 'stadium', 89, rowY[i]!, 432, 40, { label, left: true }));
  });

  // Connector arrows in the deck's reading order (TL -> TR -> BR -> BL).
  elements.push(createPinnedArrow(fTL.id, 'e', fTR.id, 'w'));
  elements.push(createPinnedArrow(fTR.id, 's', fBR.id, 'n'));
  elements.push(createPinnedArrow(fBR.id, 'w', fBL.id, 'e'));

  return elements;
}

// Storyboard: six numbered scene frames in a 2x3 grid, each sketching
// its beat with a couple of line-art glyphs and carrying a caption
// beneath, so the template reads as a told story (a first-run product
// demo) the user redraws with their own narrative. Scene-number chips
// overlap each frame's top-left corner, pushed after the frame so they
// layer above it.
export function buildStoryboard(cx: number, cy: number): Element[] {
  const frameW = 360;
  const frameH = 210;
  const hGap = 48;
  const captionH = 34;
  const captionGap = 10;
  const vGap = 56;
  const titleH = 50;
  const titleGap = 40;
  const cols = 3;

  type Scene = { caption: string; icons: [string, string] };
  const scenes: Scene[] = [
    { caption: '1 · Maya hits a planning wall', icons: ['user', 'alert-triangle'] },
    { caption: '2 · A teammate shares a link', icons: ['link', 'smile'] },
    { caption: '3 · She starts from a template', icons: ['layers', 'edit'] },
    { caption: '4 · The team joins the canvas', icons: ['users', 'message'] },
    { caption: '5 · The plan takes shape live', icons: ['git-branch', 'check-circle'] },
    { caption: '6 · They ship it together', icons: ['send', 'award'] },
  ];

  const rowPitch = frameH + captionGap + captionH + vGap;
  const totalW = cols * frameW + (cols - 1) * hGap;
  const totalH = titleH + titleGap + 2 * rowPitch - vGap;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const framesTop = y0 + titleH + titleGap;

  const elements: Element[] = [];

  elements.push({
    ...createText(x0, y0),
    width: totalW,
    height: titleH,
    label: 'Storyboard · First-run demo',
    textSize: 'lg',
    textBold: true,
  });

  scenes.forEach((scene, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const fx = x0 + col * (frameW + hGap);
    const fy = framesTop + row * rowPitch;

    // Frame first, then its contents layer above it.
    const frame = {
      ...createShape('square', fx, fy),
      width: frameW,
      height: frameH,
      textSize: 'md' as const,
    };
    elements.push(frame);

    // Scene sketch: two glyphs side by side, the beat's subject and
    // its outcome, sized like a rough thumbnail drawing.
    const glyph = 64;
    scene.icons.forEach((iconId, j) => {
      elements.push({
        ...createShape(
          'icon',
          fx + frameW / 2 - glyph - 24 + j * (glyph + 48),
          fy + frameH / 2 - glyph / 2,
        ),
        width: glyph,
        height: glyph,
        iconId,
      });
    });

    // Scene-number chip overlapping the frame's top-left corner.
    const chip = 40;
    elements.push({
      ...createShape('circle', fx - chip / 2 + 6, fy - chip / 2 + 6),
      width: chip,
      height: chip,
      label: `${i + 1}`,
      textSize: 'sm',
      textBold: true,
      colorPreset: 'bold',
    });

    elements.push({
      ...createText(fx, fy + frameH + captionGap),
      width: frameW,
      height: captionH,
      label: scene.caption,
      textSize: 'sm',
      textAlignX: 'center',
      textColor: '#64748b',
    });
  });

  return elements;
}
