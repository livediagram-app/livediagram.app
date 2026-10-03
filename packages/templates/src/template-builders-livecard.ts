// "Group card" template builder (kind `live-card`, docs/specs/008-canvas/canvas-and-palette.md
// "Templates on pages"): a greeting card the whole team signs, opening in Illustrate on two
// Portrait post (4:5) pages, the shape of a real card. The first page is the cover (a festive
// title, a dedication, a photo slot and a few party stickers) on a blush-to-sunshine wash; the
// second is the inside, the message wall on cream: seven signed notes from different teammates
// plus a dashed "your message here" slot, so the first thing a visitor sees is where to write.
//
// The notes are stickies in a spread of pastels: stickies keep their own fills under every theme,
// so the card stays cheerful whatever the tab wears. Each carries a coloured initials badge in its
// corner, the "who signed this" cue a real card gets from handwriting. The photo is an empty image
// placeholder (imageId: null) so the template ships no bytes.
//
// Pure: () -> Element[], placed on the card's pages (liveCardPages) whatever centre is passed.

import { createSticky, type Element, type IllustratePage } from '@livediagram/document';
import { heading, type Kit } from './page-layout-kit';
import { pageKits, templatePage } from './template-page-kit';

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

/** The card's pages: the cover and the inside, both Portrait post (4:5). */
export function liveCardPages(): IllustratePage[] {
  return [
    templatePage(1, 'social', 'portrait', 'Cover', {
      fill: { kind: 'gradient', from: '#fce7f3', to: '#fef9c3', angle: 160 },
    }),
    templatePage(2, 'social', 'portrait', 'Inside', {
      fill: { kind: 'solid', color: '#fffbeb' },
    }),
  ];
}

function sticker(k: Kit, stickerId: string, x: number, y: number, size: number, rotation: number) {
  return k.shape('sticker', x, y, size, size, { stickerId, rotation });
}

// The cover: title, dedication, photo slot and its hint, then stickers scattered on top.
function cover(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const centred = { textAlignX: 'center' as const };
  const photo = W * 0.8;
  const photoTop = u * 38;
  return [
    { ...k.title(0, u * 13, W, u * 12, 'Happy birthday, Sandra!'), ...centred },
    k.text(0, u * 27, W, u * 6, 'With love from everyone on the Product team', {
      ...centred,
      textSize: 'lg',
    }),
    k.image((W - photo) / 2, photoTop, photo, photo),
    k.text(
      0,
      photoTop + photo + u * 3,
      W,
      u * 5,
      'Double-click the frame to add a favourite photo',
      {
        ...centred,
      },
    ),
    sticker(k, 'emoji-party-popper', -u * 2, -u * 2, u * 17, -12),
    sticker(k, 'emoji-balloon', W - u * 16, u * 30, u * 18, 10),
    sticker(k, 'emoji-cake', -u * 1, H - u * 34, u * 20, -6),
    sticker(k, 'emoji-gift', W - u * 18, H - u * 32, u * 17, 8),
  ];
}

// The inside: the heading and how-to, then a 2 x 4 grid of signed notes, the last slot left open
// as the invitation to add one.
function inside(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(
    k,
    'Messages for Sandra',
    'Grab a sticky from the palette, write something kind, and sign it.',
  );
  const cols = 2;
  const rows = 4;
  const gapX = u * 4;
  const gapY = u * 3.5;
  const noteW = (W - gapX) / cols;
  const noteH = (H - head.top - gapY * (rows - 1)) / rows;
  const badge = u * 6;
  // Alternating small tilts so the wall reads as hand-stuck notes.
  const tilts = [-1.2, 0.9, 1.1, -0.8, -1, 1.3, 0.7];
  const slot = (i: number) => ({
    x: (i % cols) * (noteW + gapX),
    y: head.top + Math.floor(i / cols) * (noteH + gapY),
  });
  const els: Element[] = [...head.els];
  NOTES.forEach((n, i) => {
    const { x, y } = slot(i);
    els.push({
      ...createSticky(Math.round(k.box.x + x), Math.round(k.box.y + y)),
      width: Math.round(noteW),
      height: Math.round(noteH),
      label: `${n.message}\n\n~ ${n.name}`,
      textSize: 'lg',
      fillColor: n.paper,
      rotation: tilts[i]!,
    });
    els.push(
      k.shape('circle', x + noteW - badge + u, y - u * 1.5, badge, badge, {
        label: n.initials,
        textSize: 'md',
        textBold: true,
        fillColor: n.badge,
        strokeColor: '#ffffff',
        textColor: '#ffffff',
        themeLockFill: true,
      }),
    );
  });
  const open = slot(NOTES.length);
  els.push(
    k.shape('square', open.x, open.y, noteW, noteH, {
      label: '+ Your message here',
      textSize: 'lg',
      strokeStyle: 'dashed',
      colorPreset: 'outline',
    }),
  );
  return els;
}

export function buildLiveCard(_cx: number, _cy: number): Element[] {
  const [front, back] = pageKits(liveCardPages());
  return [...cover(front!), ...inside(back!)];
}
