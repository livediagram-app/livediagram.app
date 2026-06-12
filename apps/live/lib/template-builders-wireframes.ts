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

// Laptop wireframe: a wide laptop frame with three internal
// placeholder rectangles sketched as a header + sidebar + content
// area. The laptop's silhouette comes from the device shape itself;
// the inner rectangles are plain squares so the user can rename
// each region without fighting the device's chrome geometry.
export function buildLaptopWireframe(cx: number, cy: number): Element[] {
  const elements: Element[] = [];
  const laptopW = 720;
  const laptopH = 440;
  const laptopX = cx - laptopW / 2;
  const laptopY = cy - laptopH / 2;
  elements.push({
    ...createShape('laptop', laptopX, laptopY),
    width: laptopW,
    height: laptopH,
  });
  // Screen area sits in the top ~46% of the laptop's bounding box
  // (the keyboard base lives below). Inset by 30px on each side so
  // the UI doesn't bleed into the bezel.
  const screenTop = laptopY + 20;
  const screenLeft = laptopX + 80;
  const screenW = laptopW - 160;
  const screenH = laptopH * 0.46 - 24;
  const headerH = 38;
  const sidebarW = 110;
  const innerGap = 8;
  const contentLeft = screenLeft + sidebarW + innerGap;
  const contentTop = screenTop + headerH + innerGap;
  const contentW = screenW - sidebarW - innerGap;
  const contentH = screenH - headerH - innerGap;

  // Header strip: logo (square) on the left, three nav pills in the
  // middle, an avatar (circle) on the right.
  elements.push({
    ...createShape('square', screenLeft, screenTop),
    width: screenW,
    height: headerH,
  });
  elements.push({
    ...createShape('square', screenLeft + 10, screenTop + 10),
    width: 60,
    height: 18,
    label: 'Logo',
    textSize: 'sm',
  });
  ['Home', 'Projects', 'Reports'].forEach((label, i) => {
    elements.push({
      ...createShape('stadium', screenLeft + 90 + i * 70, screenTop + 8),
      width: 60,
      height: 22,
      label,
      textSize: 'sm',
    });
  });
  elements.push({
    ...createShape('circle', screenLeft + screenW - 32, screenTop + 7),
    width: 24,
    height: 24,
  });

  // Sidebar: section title strip + a vertical stack of nav rows.
  elements.push({
    ...createShape('square', screenLeft, screenTop + headerH + innerGap),
    width: sidebarW,
    height: contentH,
  });
  const navItems = ['Overview', 'Customers', 'Pipeline', 'Reports', 'Settings'];
  navItems.forEach((label, i) => {
    elements.push({
      ...createShape('square', screenLeft + 8, screenTop + headerH + innerGap + 12 + i * 26),
      width: sidebarW - 16,
      height: 20,
      label,
      textSize: 'sm',
      textAlignX: 'left',
    });
  });

  // Main content area: page title, three stat cards in a row, and a
  // wider data card beneath.
  elements.push({
    ...createShape('square', contentLeft + 12, contentTop + 10),
    width: 220,
    height: 22,
    label: 'Dashboard',
    textSize: 'sm',
    textAlignX: 'left',
  });
  const cardGap = 10;
  const cardW = (contentW - 24 - cardGap * 2) / 3;
  const cardH = 70;
  ['Active users', 'Revenue', 'Conversion'].forEach((label, i) => {
    const cardX = contentLeft + 12 + i * (cardW + cardGap);
    const cardY = contentTop + 44;
    elements.push({
      ...createShape('square', cardX, cardY),
      width: cardW,
      height: cardH,
    });
    elements.push({
      ...createShape('square', cardX + 10, cardY + 10),
      width: cardW - 20,
      height: 12,
      label,
      textSize: 'sm',
      textAlignX: 'left',
    });
    elements.push({
      ...createShape('square', cardX + 10, cardY + 30),
      width: cardW - 20,
      height: 22,
      label: '0',
      textSize: 'md',
      textAlignX: 'left',
    });
  });
  // Wider data row card.
  const tableY = contentTop + 124;
  const tableH = contentTop + contentH - tableY - 12;
  if (tableH > 24) {
    elements.push({
      ...createShape('square', contentLeft + 12, tableY),
      width: contentW - 24,
      height: tableH,
      label: 'Recent activity',
      textSize: 'sm',
      textAlignY: 'top',
    });
  }
  return elements;
}

// Slide deck: four monitor frames in a 2 by 2 grid, each labelled
// like a PowerPoint slide ("Title", "Agenda", etc.). The monitor
// silhouette (rounded screen + stand) reads as a presentation slide
// at a glance and the natural aspect ratio matches typical slide
// proportions. Easy to extend (delete a slide, duplicate one).
export function buildSlideDeck(cx: number, cy: number): Element[] {
  const elements: Element[] = [];
  const slideW = 380;
  const slideH = 280;
  const gap = 90;
  const totalW = 2 * slideW + gap;
  const totalH = 2 * slideH + gap;
  const startX = cx - totalW / 2;
  const startY = cy - totalH / 2;

  // Each slide is a plain rectangle the user can resize / restyle.
  // Inside, a heading band sits at the top, then slide-specific
  // content (bullet rows, agenda items, a chart placeholder, an
  // action list). Arrows between the slides describe the deck's
  // reading order.
  type SlideKind = 'title' | 'agenda' | 'content' | 'actions';
  type Slide = {
    kind: SlideKind;
    heading: string;
    bullets: string[];
  };
  const slides: Slide[] = [
    {
      kind: 'title',
      heading: 'Q3 Roadmap',
      bullets: ['Team kick-off · 6 Aug', 'Hosted by Alex Rivera'],
    },
    {
      kind: 'agenda',
      heading: 'Agenda',
      bullets: ['Where we landed in Q2', 'Three Q3 bets', 'Risks + dependencies', 'Open questions'],
    },
    {
      kind: 'content',
      heading: 'Three Q3 bets',
      bullets: ['Self-serve onboarding', 'Realtime collaboration', 'Pricing experiment'],
    },
    {
      kind: 'actions',
      heading: 'Next steps',
      bullets: [
        'Lock scope by Friday',
        'Eng + design pairing',
        'Weekly review on Tuesdays',
        'Send recap by EOD',
      ],
    },
  ];

  const slideElements = slides.map((slide, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const slideX = startX + col * (slideW + gap);
    const slideY = startY + row * (slideH + gap);
    // The outer slide frame: a plain square (no device shape) so the
    // user can adjust the chrome to taste. textAlignY = top keeps any
    // future label they add anchored at the top of the slide.
    const frame = {
      ...createShape('square', slideX, slideY),
      width: slideW,
      height: slideH,
      textAlignY: 'top' as const,
    };
    elements.push(frame);

    // Heading band: a stadium-shaped accent strip at the top of each
    // slide so the slide title reads as a hero block. Sits inset by
    // 16px on each side so it doesn't crowd the slide edges.
    const headingH = 44;
    elements.push({
      ...createShape('stadium', slideX + 16, slideY + 16),
      width: slideW - 32,
      height: headingH,
      label: slide.heading,
      textSize: 'md',
    });

    if (slide.kind === 'title') {
      // Subtitle row + a tag pill at the bottom for the speaker.
      elements.push({
        ...createShape('square', slideX + 24, slideY + 16 + headingH + 18),
        width: slideW - 48,
        height: 30,
        label: slide.bullets[0]!,
        textSize: 'sm',
        textAlignX: 'left',
      });
      elements.push({
        ...createShape('stadium', slideX + 24, slideY + slideH - 50),
        width: 200,
        height: 28,
        label: slide.bullets[1]!,
        textSize: 'sm',
      });
    } else if (slide.kind === 'content') {
      // Three feature cards in a row beneath the heading.
      const cardGap = 12;
      const cardCount = slide.bullets.length;
      const cardW = (slideW - 32 - cardGap * (cardCount - 1)) / cardCount;
      const cardY = slideY + 16 + headingH + 22;
      const cardH = slideH - (16 + headingH + 22) - 32;
      slide.bullets.forEach((bullet, j) => {
        const bx = slideX + 16 + j * (cardW + cardGap);
        elements.push({
          ...createShape('square', bx, cardY),
          width: cardW,
          height: cardH,
        });
        elements.push({
          ...createShape('circle', bx + cardW / 2 - 16, cardY + 18),
          width: 32,
          height: 32,
        });
        elements.push({
          ...createShape('square', bx + 10, cardY + cardH - 60),
          width: cardW - 20,
          height: 38,
          label: bullet,
          textSize: 'sm',
        });
      });
    } else {
      // Agenda + actions both render as a stack of bullet rows.
      // Agenda uses square rows ("read more like a numbered list").
      // Actions uses stadiums ("read like to-do pills").
      const rowH = 28;
      const rowGap = 10;
      const rowsTop = slideY + 16 + headingH + 22;
      const rowsLeft = slideX + 28;
      const rowsW = slideW - 56;
      slide.bullets.forEach((bullet, j) => {
        const rowY = rowsTop + j * (rowH + rowGap);
        if (slide.kind === 'agenda') {
          // Small index square (1 / 2 / 3 / ...) followed by the row.
          elements.push({
            ...createShape('square', rowsLeft, rowY),
            width: 28,
            height: rowH,
            label: `${j + 1}`,
            textSize: 'sm',
          });
          elements.push({
            ...createShape('square', rowsLeft + 36, rowY),
            width: rowsW - 36,
            height: rowH,
            label: bullet,
            textSize: 'sm',
            textAlignX: 'left',
          });
        } else {
          // Actions: checkbox circle + a stadium row.
          elements.push({
            ...createShape('circle', rowsLeft, rowY + 4),
            width: rowH - 8,
            height: rowH - 8,
          });
          elements.push({
            ...createShape('stadium', rowsLeft + 32, rowY),
            width: rowsW - 32,
            height: rowH,
            label: bullet,
            textSize: 'sm',
            textAlignX: 'left',
          });
        }
      });
    }
    return frame;
  });

  // Connecting arrows: 1→2 (top row), 2→3 (right column, top to
  // bottom), 3→4 (bottom row). Anchored to each frame's nearest face
  // so the arrows visibly chain the slides in reading order.
  elements.push(createPinnedArrow(slideElements[0]!.id, 'e', slideElements[1]!.id, 'w'));
  elements.push(createPinnedArrow(slideElements[1]!.id, 's', slideElements[3]!.id, 'n'));
  elements.push(createPinnedArrow(slideElements[3]!.id, 'w', slideElements[2]!.id, 'e'));

  return elements;
}
