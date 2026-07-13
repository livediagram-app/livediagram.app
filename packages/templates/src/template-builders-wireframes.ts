// Wireframe templates lifted out of template-builders.ts to keep
// that file focused on diagram primitives (mind map, flowchart,
// boards, processes). The three device wireframes here (mobile,
// laptop, browser) are among the largest single builders in the
// catalogue, so splitting them out is the highest-leverage cut. The
// slide deck (a framed-panel design template, not a device wireframe)
// moved on to template-builders-slides.ts beside the storyboard.
//
// Each function is still pure: takes a centre (cx, cy), returns a
// fresh Element[]. Sizing constants stay inline so the geometry
// remains self-describing alongside the shape it draws. See spec/09
// "Templates" for the catalogue and per-template intent.

import { createShape, type Element } from '@livediagram/diagram';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// All three wireframes ship pre-layered (spec/74 "Layered templates"):
// the device shells sit on a "Frames" scaffold layer, and every inner
// placeholder box lands on a "UI" content layer, so rearranging the UI
// never drags the device along. Each builder's local box / pill / dot
// helpers stamp the content id; the device shapes carry the scaffold id.

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
    layerId: TEMPLATE_CONTENT_LAYER_ID,
    ...(opts.label !== undefined ? { label: opts.label } : {}),
    ...(opts.left ? { textAlignX: 'left' as const } : {}),
  });
  const dot = (x: number, y: number, w: number, h: number): Element => ({
    ...createShape('circle', x, y),
    width: w,
    height: h,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });
  const pill = (x: number, y: number, w: number, h: number, label: string): Element => ({
    ...createShape('stadium', x, y),
    width: w,
    height: h,
    textSize: 'sm',
    label,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
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
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
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

    // Bottom tab bar with three evenly-spaced icons (all screens). The 29px
    // lead-in centres the icon cluster in the 252px bar (a 25 left it 4px
    // off-centre: margins 25 vs 33).
    inner.push(box(x + barInset, phoneY + 554, barW, 54));
    [0, 1, 2].forEach((i) => {
      inner.push(dot(x + barInset + 29 + i * 84, phoneY + 568, 26, 27));
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
    layerId: TEMPLATE_CONTENT_LAYER_ID,
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
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });
  const dot = (rx: number, ry: number, w: number, h: number): Element => ({
    ...createShape('circle', laptopX + rx, laptopY + ry),
    width: w,
    height: h,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });

  const elements: Element[] = [
    {
      ...createShape('laptop', laptopX, laptopY),
      width: laptopW,
      height: laptopH,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    },
  ];

  // Top nav bar + its chrome (logo, three nav pills, avatar).
  elements.push(box(122, 42, 965, 75, { rounded: true, thin: true }));
  elements.push(box(150, 63, 85, 35, { label: 'Logo', size: 'sm' }));
  elements.push(pill(263, 59, 85, 43, 'Home'));
  elements.push(pill(363, 59, 85, 43, 'Projects'));
  elements.push(pill(463, 59, 85, 43, 'Reports'));
  elements.push(dot(1024, 58, 42, 42));

  // Left sidebar + nav rows, sharing the nav bar's left gutter.
  elements.push(box(122, 131, 192, 362, { thin: true }));
  ['Overview', 'Customers', 'Pipeline', 'Reports', 'Settings'].forEach((label, i) => {
    elements.push(box(135, 163 + i * 52, 164, 40, { label, size: 'sm', left: true }));
  });

  // Three stat cards: container + metric label + value. Sized so the row
  // spans the full dashboard body (sidebar edge 332 to the nav's right
  // edge 1087) — the old 187px cards left a ~165px dead band on the right.
  const cards: { cardX: number; label: string }[] = [
    { cardX: 332, label: 'Active users' },
    { cardX: 589, label: 'Revenue' },
    { cardX: 846, label: 'Conversion' },
  ];
  for (const c of cards) {
    elements.push(box(c.cardX, 134, 241, 140));
    elements.push(box(c.cardX + 14, 154, 213, 24, { label: c.label, size: 'sm', left: true }));
    elements.push(box(c.cardX + 14, 195, 213, 44, { label: '0', size: 'md', left: true }));
  }

  return elements;
}

// Browser wireframe: a marketing landing page sketched inside the
// browser device frame — top nav (logo, links, CTA), a hero split
// between headline copy + buttons and an image placeholder, a
// three-card feature row, and a footer strip. Same conventions as the
// laptop wireframe above: geometry mirrors a hand-built reference
// (1216x840 frame), offsets are relative to the frame's top-left, and
// colours are left to the theme so the shell reads under light / dark
// / multi-colour themes alike.
export function buildBrowserWireframe(cx: number, cy: number): Element[] {
  const browserW = 1216;
  const browserH = 840;
  const browserX = cx - browserW / 2;
  const browserY = cy - browserH / 2;

  type BoxOpts = {
    label?: string;
    size?: 'sm' | 'md' | 'lg';
    left?: boolean;
    bold?: boolean;
    thin?: boolean;
  };
  const box = (rx: number, ry: number, w: number, h: number, o: BoxOpts = {}): Element => ({
    ...createShape('square', browserX + rx, browserY + ry),
    width: w,
    height: h,
    textSize: o.size ?? 'md',
    layerId: TEMPLATE_CONTENT_LAYER_ID,
    ...(o.label !== undefined ? { label: o.label } : {}),
    ...(o.left ? { textAlignX: 'left' as const } : {}),
    ...(o.bold ? { textBold: true } : {}),
    ...(o.thin ? { strokeWidth: 'thin' as const } : {}),
  });
  const pill = (rx: number, ry: number, w: number, h: number, label: string): Element => ({
    ...createShape('stadium', browserX + rx, browserY + ry),
    width: w,
    height: h,
    textSize: 'sm',
    label,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });
  const dot = (rx: number, ry: number, w: number, h: number): Element => ({
    ...createShape('circle', browserX + rx, browserY + ry),
    width: w,
    height: h,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });

  const elements: Element[] = [
    {
      ...createShape('browser', browserX, browserY),
      width: browserW,
      height: browserH,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    },
  ];

  // Top nav: logo, three links, and the nav CTA on the right.
  const navY = 92;
  elements.push(box(64, navY, 96, 38, { label: 'Logo', size: 'sm' }));
  ['Product', 'Pricing', 'Docs'].forEach((label, i) => {
    elements.push(pill(430 + i * 112, navY, 98, 38, label));
  });
  elements.push(pill(1042, navY, 110, 38, 'Sign up'));

  // Hero: headline + subcopy + button pair on the left, an image
  // placeholder (framed box with a photo-corner dot) on the right.
  elements.push(
    box(64, 190, 520, 96, {
      label: 'Design together, ship faster',
      size: 'lg',
      bold: true,
      left: true,
    }),
  );
  elements.push(
    box(64, 298, 470, 54, {
      label: 'One canvas for the whole team, from idea to launch.',
      size: 'sm',
      left: true,
    }),
  );
  elements.push(pill(64, 386, 170, 52, 'Start free'));
  elements.push(pill(254, 386, 170, 52, 'Watch demo'));
  elements.push(box(664, 190, 488, 268, { thin: true }));
  elements.push(dot(694, 220, 44, 44));

  // Feature row: three cards, each an icon dot + title + copy line.
  const cardY = 520;
  const cardW = 352;
  const cardX = [64, 432, 800];
  const features: [string, string][] = [
    ['Realtime', 'Cursors, comments and presence'],
    ['Templates', 'Start from a working scaffold'],
    ['Share', 'One link, no accounts needed'],
  ];
  features.forEach(([title, copy], i) => {
    elements.push(box(cardX[i]!, cardY, cardW, 180, { thin: true }));
    elements.push(dot(cardX[i]! + 24, cardY + 24, 40, 40));
    elements.push(
      box(cardX[i]! + 24, cardY + 80, cardW - 48, 34, {
        label: title,
        size: 'md',
        bold: true,
        left: true,
      }),
    );
    elements.push(
      box(cardX[i]! + 24, cardY + 122, cardW - 48, 34, { label: copy, size: 'sm', left: true }),
    );
  });

  // Footer strip.
  elements.push(box(64, 736, 1088, 64, { thin: true }));
  elements.push(box(88, 752, 96, 32, { label: 'Logo', size: 'sm' }));
  ['About', 'Blog', 'Contact'].forEach((label, i) => {
    elements.push(box(848 + i * 104, 752, 92, 32, { label, size: 'sm' }));
  });

  return elements;
}
