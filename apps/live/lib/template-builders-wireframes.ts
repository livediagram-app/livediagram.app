// Wireframe templates lifted out of template-builders.ts to keep
// that file focused on diagram primitives (mind map, flowchart,
// boards, processes). The three wireframes here (mobile, laptop,
// slide-deck) account for ~500 of the original 1666 lines and are
// the largest single builders in the catalogue, so splitting them
// out is the highest-leverage cut.
//
// Each function is still pure: takes a centre (cx, cy), returns a
// fresh Element[]. Sizing constants stay inline so the geometry
// remains self-describing alongside the shape it draws. See spec/09
// "Templates" for the catalogue and per-template intent.

import { createPinnedArrow, createShape, type Element } from '@livediagram/diagram';

// Mobile wireframe: three fully-sketched phone screens side by side —
// Login, Feed, Profile — a user-flow starter for mobile UI work. Each
// frame is a 304x686 phone shape (roughly 2x the create-default so the
// screen content reads comfortably) carrying a status strip, a
// screen-specific body, and a shared bottom tab bar, so the user lands
// on a recognisable app shell rather than three empty device frames.
// Colours are left to the theme (recolourElementsForTheme handles the
// fills): every inner box adopts the theme's element fill and is
// delineated by its border, so the wireframe reads correctly under
// light / dark / multi-colour themes alike. The geometry mirrors a
// hand-built reference, re-centred on the supplied canvas point and
// rounded to clean offsets.
export function buildMobileWireframe(cx: number, cy: number): Element[] {
  const phoneW = 304;
  const phoneH = 686;
  const gap = 40;
  const screens = ['Login', 'Feed', 'Profile'] as const;
  const totalW = screens.length * phoneW + (screens.length - 1) * gap;
  const startX = cx - totalW / 2;
  const phoneY = cy - phoneH / 2;

  // Two recurring widths: the status strip + tab bar span the wide
  // `barW`, while inputs / rows / feed cards use the slightly narrower
  // `fieldW`. Insets are derived so both centre cleanly in the frame.
  const barW = 252;
  const barInset = (phoneW - barW) / 2;
  const fieldW = 224;
  const fieldInset = (phoneW - fieldW) / 2;

  // Local element helpers keep the per-screen layout readable instead
  // of repeating the createShape spread for all ~14 boxes per screen.
  // `box` defaults to centred small text; pass `left` for a left-rail
  // label, `label` for the placeholder copy.
  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { label?: string; left?: boolean } = {},
  ): Element => ({
    ...createShape('square', x, y),
    width: w,
    height: h,
    textSize: 'sm',
    ...(opts.label !== undefined ? { label: opts.label } : {}),
    ...(opts.left ? { textAlignX: 'left' as const } : {}),
  });
  const dot = (x: number, y: number, w: number, h: number): Element => ({
    ...createShape('circle', x, y),
    width: w,
    height: h,
  });
  const pill = (x: number, y: number, w: number, h: number, label: string): Element => ({
    ...createShape('stadium', x, y),
    width: w,
    height: h,
    textSize: 'sm',
    label,
  });

  const buildScreen = (label: (typeof screens)[number], x: number): Element[] => {
    const phone: Element = {
      ...createShape('phone', x, phoneY),
      width: phoneW,
      height: phoneH,
      label,
      textSize: 'sm',
      textAlignY: 'top',
      // Large padding pushes the screen-name label clear of the
      // device's top bezel / notch so it reads as a screen title.
      padding: 'lg',
    };
    const inner: Element[] = [];

    // Status strip across the top of the screen area (all screens).
    inner.push(box(x + barInset, phoneY + 82, barW, 20));

    if (label === 'Login') {
      // Logo, welcome headline, two input fields, a primary button, a
      // small "forgot password" strip beneath.
      inner.push(dot(x + (phoneW - 67) / 2, phoneY + 130, 67, 70));
      inner.push(box(x + (phoneW - 193) / 2, phoneY + 217, 193, 31, { label: 'Welcome back' }));
      inner.push(box(x + fieldInset, phoneY + 276, fieldW, 50, { label: 'Email', left: true }));
      inner.push(box(x + fieldInset, phoneY + 346, fieldW, 50, { label: 'Password', left: true }));
      inner.push(pill(x + fieldInset, phoneY + 421, fieldW, 58, 'Sign in'));
      inner.push(box(x + (phoneW - 186) / 2, phoneY + 499, 186, 27, { label: 'Forgot password?' }));
    } else if (label === 'Feed') {
      // Title strip + three content cards, each an avatar dot + two
      // text lines — the skeleton of a feed list.
      inner.push(box(x + fieldInset, phoneY + 117, fieldW, 39, { label: 'Feed', left: true }));
      [0, 1, 2].forEach((row) => {
        const cardY = phoneY + 165 + row * 130;
        inner.push(box(x + fieldInset, cardY, fieldW, 116));
        inner.push(dot(x + fieldInset + 11, cardY + 15, 33, 35));
        inner.push(box(x + fieldInset + 56, cardY + 23, 148, 20));
        inner.push(box(x + fieldInset + 56, cardY + 46, 122, 20));
      });
    } else {
      // Profile: avatar + name + bio strip + three settings rows.
      inner.push(dot(x + (phoneW - 96) / 2, phoneY + 120, 96, 101));
      inner.push(box(x + (phoneW - 163) / 2, phoneY + 240, 163, 31, { label: 'Alex Rivera' }));
      inner.push(box(x + (phoneW - 193) / 2, phoneY + 286, 193, 20));
      ['Account', 'Notifications', 'Privacy'].forEach((rowLabel, i) => {
        inner.push(
          box(x + fieldInset, phoneY + 325 + i * 74, fieldW, 62, { label: rowLabel, left: true }),
        );
      });
    }

    // Bottom tab bar with three evenly-spaced icons (all screens).
    inner.push(box(x + barInset, phoneY + 554, barW, 54));
    [0, 1, 2].forEach((i) => {
      inner.push(dot(x + barInset + 25 + i * 84, phoneY + 568, 26, 27));
    });

    return [phone, ...inner];
  };

  const elements: Element[] = [];
  screens.forEach((label, i) => {
    elements.push(...buildScreen(label, startX + i * (phoneW + gap)));
  });
  return elements;
}

// Laptop wireframe: a desktop dashboard sketched inside the laptop
// device's display — a top nav bar (logo, nav pills, avatar), a left
// sidebar of nav rows, and three stat cards. Geometry mirrors a
// hand-built reference: the device frame is 1209x833 and the content
// fills its display bezel, then the whole thing is re-centred on the
// supplied canvas point. Colours are left to the theme
// (recolourElementsForTheme); only the structural border-radius /
// stroke-width hints are pinned so the chrome reads.
export function buildLaptopWireframe(cx: number, cy: number): Element[] {
  const laptopW = 1209;
  const laptopH = 833;
  const laptopX = cx - laptopW / 2;
  const laptopY = cy - laptopH / 2;

  // Offsets below are relative to the device frame's top-left.
  type BoxOpts = {
    label?: string;
    size?: 'sm' | 'md';
    left?: boolean;
    rounded?: boolean;
    thin?: boolean;
  };
  const box = (rx: number, ry: number, w: number, h: number, o: BoxOpts = {}): Element => ({
    ...createShape('square', laptopX + rx, laptopY + ry),
    width: w,
    height: h,
    textSize: o.size ?? 'md',
    ...(o.label !== undefined ? { label: o.label } : {}),
    ...(o.left ? { textAlignX: 'left' as const } : {}),
    ...(o.rounded ? { borderRadius: 'md' as const } : {}),
    ...(o.thin ? { strokeWidth: 'thin' as const } : {}),
  });
  const pill = (rx: number, ry: number, w: number, h: number, label: string): Element => ({
    ...createShape('stadium', laptopX + rx, laptopY + ry),
    width: w,
    height: h,
    textSize: 'sm',
    label,
  });
  const dot = (rx: number, ry: number, w: number, h: number): Element => ({
    ...createShape('circle', laptopX + rx, laptopY + ry),
    width: w,
    height: h,
  });

  const elements: Element[] = [
    { ...createShape('laptop', laptopX, laptopY), width: laptopW, height: laptopH },
  ];

  // Top nav bar + its chrome (logo, three nav pills, avatar).
  elements.push(box(122, 42, 965, 75, { rounded: true, thin: true }));
  elements.push(box(150, 63, 85, 35, { label: 'Logo', size: 'sm' }));
  elements.push(pill(263, 59, 85, 43, 'Home'));
  elements.push(pill(362, 59, 85, 43, 'Projects'));
  elements.push(pill(462, 59, 85, 43, 'Reports'));
  elements.push(dot(1024, 58, 42, 42));

  // Left sidebar + nav rows.
  elements.push(box(124, 131, 192, 362, { thin: true }));
  ['Overview', 'Customers', 'Pipeline', 'Reports', 'Settings'].forEach((label, i) => {
    elements.push(box(135, 163 + i * 52, 164, 40, { label, size: 'sm', left: true }));
  });

  // Three stat cards: container + metric label + value.
  const cards: { cardX: number; labelX: number; label: string }[] = [
    { cardX: 332, labelX: 346, label: 'Active users' },
    { cardX: 533, labelX: 547, label: 'Revenue' },
    { cardX: 735, labelX: 749, label: 'Conversion' },
  ];
  for (const c of cards) {
    elements.push(box(c.cardX, 134, 187, 140));
    elements.push(box(c.labelX, 154, 159, 24, { label: c.label, size: 'sm', left: true }));
    elements.push(box(c.labelX, 195, 159, 44, { label: '0', size: 'md', left: true }));
  }

  return elements;
}

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
