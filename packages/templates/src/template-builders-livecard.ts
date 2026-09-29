// "Live card" template builder: a group greeting card the whole team signs.
// It opens like a real card. The left page is the cover (a festive title,
// a photo slot and a few party stickers); the right page is the message
// wall, seven signed notes from different teammates plus a dashed "your
// message here" slot, so the first thing a visitor sees is where to write.
//
// The notes are stickies in a spread of pastels: stickies keep their own
// fills under every theme, so the card stays cheerful whatever the tab
// wears. Each carries a coloured initials badge in its corner, the "who
// signed this" cue a real card gets from handwriting. The photo is an empty
// image placeholder (imageId: null) so the template ships no bytes.
//
// The builder is pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createImage,
  createShape,
  createSticky,
  createText,
  type Element,
} from '@livediagram/diagram';

// Page geometry, relative to the card's centre.
const PAGE_H = 900;
const COVER_W = 620;
const WALL_W = 860;
const SPINE = 24;
const PAD = 36;

const COVER_FILL = '#fdf2f8';
const COVER_STROKE = '#f9a8d4';
const WALL_FILL = '#fffbeb';
const WALL_STROKE = '#fcd34d';
const MUTED = '#64748b';

type Note = { message: string; name: string; initials: string; paper: string; badge: string };

// Seven teammates, each with their own paper colour and badge colour.
const NOTES: Note[] = [
  {
    message: 'Happy birthday! Thank you for the best snack drawer in the building.',
    name: 'Priya',
    initials: 'PS',
    paper: '#fef08a',
    badge: '#ca8a04',
  },
  {
    message: 'Another lap round the sun and still the calmest person in every incident.',
    name: 'Marcus',
    initials: 'MO',
    paper: '#fbcfe8',
    badge: '#db2777',
  },
  {
    message: 'Hope today is as brilliant as your release notes.',
    name: 'Aisha',
    initials: 'AK',
    paper: '#bfdbfe',
    badge: '#2563eb',
  },
  {
    message: 'Cake is on me this year. Well, on the team card.',
    name: 'Tom',
    initials: 'TB',
    paper: '#bbf7d0',
    badge: '#16a34a',
  },
  {
    message: 'Thank you for being the world’s best onboarding buddy!',
    name: 'Lena',
    initials: 'LH',
    paper: '#ddd6fe',
    badge: '#7c3aed',
  },
  {
    message: 'Have a wonderful day, and a very long lie-in tomorrow.',
    name: 'Kenji',
    initials: 'KT',
    paper: '#fed7aa',
    badge: '#ea580c',
  },
  {
    message: 'Wishing you a year of green builds and meeting-free Mondays.',
    name: 'Sofia',
    initials: 'SR',
    paper: '#a5f3fc',
    badge: '#0891b2',
  },
];

function page(x: number, y: number, w: number, fill: string, stroke: string): Element {
  return {
    ...createShape('square', x, y),
    width: w,
    height: PAGE_H,
    label: '',
    borderRadius: 'lg',
    fillColor: fill,
    strokeColor: stroke,
    themeLockFill: true,
  };
}

function sticker(stickerId: string, x: number, y: number, size: number, rotation: number): Element {
  return {
    ...createShape('sticker', x, y),
    width: size,
    height: size,
    stickerId,
    rotation,
  };
}

export function buildLiveCard(cx: number, cy: number): Element[] {
  const totalW = COVER_W + SPINE + WALL_W;
  const left = cx - totalW / 2;
  const top = cy - PAGE_H / 2;
  const wallX = left + COVER_W + SPINE;
  const elements: Element[] = [
    page(left, top, COVER_W, COVER_FILL, COVER_STROKE),
    page(wallX, top, WALL_W, WALL_FILL, WALL_STROKE),
  ];

  // Cover: title, dedication, photo slot, then stickers scattered on top.
  const innerW = COVER_W - PAD * 2;
  elements.push({
    ...createText(left + PAD, top + 70),
    width: innerW,
    height: 56,
    label: 'Happy birthday, Sandra!',
    textSize: 'lg',
    textBold: true,
    textAlignX: 'center',
  });
  elements.push({
    ...createText(left + PAD, top + 128),
    width: innerW,
    height: 28,
    label: 'With love from everyone on the Product team',
    textSize: 'sm',
    textAlignX: 'center',
    textColor: MUTED,
  });
  const photoW = 460;
  const photoH = 460;
  elements.push({
    ...createImage(left + (COVER_W - photoW) / 2, top + 190),
    width: photoW,
    height: photoH,
    borderRadius: 'lg',
    objectFit: 'cover',
  });
  elements.push({
    ...createText(left + PAD, top + 190 + photoH + 24),
    width: innerW,
    height: 28,
    label: 'Double-click the frame to add a favourite photo',
    textSize: 'sm',
    textAlignX: 'center',
    textColor: MUTED,
  });
  elements.push(sticker('emoji-party-popper', left + 20, top + 12, 96, -12));
  elements.push(sticker('emoji-balloon', left + COVER_W - 110, top + 150, 104, 10));
  elements.push(sticker('emoji-cake', left + 26, top + PAGE_H - 150, 120, -6));
  elements.push(sticker('emoji-gift', left + COVER_W - 124, top + PAGE_H - 140, 100, 8));

  // Message wall: header, then a 2 x 4 grid of signed notes, the last slot
  // left open as the invitation to add one.
  const wallInnerW = WALL_W - PAD * 2;
  elements.push({
    ...createText(wallX + PAD, top + 34),
    width: wallInnerW,
    height: 40,
    label: 'Messages for Sandra',
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
  });
  elements.push({
    ...createText(wallX + PAD, top + 74),
    width: wallInnerW,
    height: 26,
    label: 'Grab a sticky from the palette, write something kind, and sign it.',
    textSize: 'sm',
    textAlignX: 'left',
    textColor: MUTED,
  });

  const cols = 2;
  const gapX = 28;
  const gapY = 22;
  const noteW = (wallInnerW - gapX) / cols;
  const noteH = 164;
  const gridTop = top + 124;
  const badge = 40;
  // Alternating small tilts so the wall reads as hand-stuck notes.
  const tilts = [-1.2, 0.9, 1.1, -0.8, -1, 1.3, 0.7];
  NOTES.forEach((n, i) => {
    const x = wallX + PAD + (i % cols) * (noteW + gapX);
    const y = gridTop + Math.floor(i / cols) * (noteH + gapY);
    elements.push({
      ...createSticky(x, y),
      width: noteW,
      height: noteH,
      label: `${n.message}\n\n~ ${n.name}`,
      textSize: 'md',
      fillColor: n.paper,
      rotation: tilts[i]!,
    });
    elements.push({
      ...createShape('circle', x + noteW - badge + 8, y - 12),
      width: badge,
      height: badge,
      label: n.initials,
      textSize: 'sm',
      textBold: true,
      fillColor: n.badge,
      strokeColor: '#ffffff',
      textColor: '#ffffff',
      themeLockFill: true,
    });
  });
  const slot = NOTES.length;
  elements.push({
    ...createShape(
      'square',
      wallX + PAD + (slot % cols) * (noteW + gapX),
      gridTop + Math.floor(slot / cols) * (noteH + gapY),
    ),
    width: noteW,
    height: noteH,
    label: '+ Your message here',
    textSize: 'md',
    strokeStyle: 'dashed',
    colorPreset: 'outline',
  });

  return elements;
}
