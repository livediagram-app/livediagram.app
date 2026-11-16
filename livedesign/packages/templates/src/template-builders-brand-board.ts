// Brand Board template (docs/specs/007-editor/logo-pages.md "Branding templates"): a made-up cycle shop, Tandem, as
// the sheet a brand is handed over on, on five logo pages (the 1024 artboard), so the guides, previews and Logo Kit
// all work on it: the logo, the mark and its icons, the colours, the type and the logo on dark. The mark is two
// overlapping discs (two riders, one bike); the name is set in Syne, a display face. The words about each page are
// the template's notes, which the Logo Kit leaves out.
//
// Pure: () -> Element[], placed on the board's pages (brandBoardPages) whatever centre is passed.
import type { Element, Page } from '@livedesign/design';
import { inDisplayFace } from './logo-display-face';
import { word } from './logo-layout-kit';
import { heading, type Kit } from './page-layout-kit';
import { pageKits, templateLogoPage } from './template-page-kit';

// The brand's colours. Fills that carry the identity lock against a theme.
const TEAL = '#0f4c5c';
const CORAL = '#ff6b4a';
const SAND = '#f4ecdf';
const INK = '#14213d';
const MUTED = '#4b5563';
const SAND_MUTED = '#d6cfc2';

const NAME = 'Tandem';
const SHOP = 'Tandem Cycles';
const TAG = 'Bikes built for two';
export const BRAND_BOARD_FACE = 'syne';

const PAGES = ['Logo', 'Mark and Icons', 'Colours', 'Type', 'On Dark'] as const;

/** The board's pages: five logo pages, the last on the brand's dark ink. */
export function brandBoardPages(): Page[] {
  return PAGES.map((name, i) =>
    templateLogoPage(
      i + 1,
      name,
      name === 'On Dark' ? { fill: { kind: 'solid', color: INK } } : undefined,
    ),
  );
}

const note = { templateNote: true } as const;

// The mark: a teal disc and a coral one overlapping, `d` across each, its left edge at x.
function mark(k: Kit, x: number, y: number, d: number, back = TEAL, front = CORAL): Element[] {
  const disc = (dx: number, fill: string) =>
    k.shape('circle', x + dx, y, d, d, {
      label: '',
      fillColor: fill,
      strokeColor: fill,
      strokeWidth: 'none',
      themeLockFill: true,
    });
  return [disc(0, back), disc(d * 0.6, front)];
}
const markWidth = (d: number) => d * 1.6;

// The horizontal lockup centred on the artboard: the mark, then the name over the tagline.
function lockup(k: Kit, cy: number, ink: string, tagInk: string, back = TEAL): Element[] {
  const S = k.box.width;
  const d = S * 0.15;
  const gap = S * 0.045;
  const nameW = S * 0.42;
  const x0 = (S - (markWidth(d) + gap + nameW)) / 2;
  const nameH = S * 0.13;
  const tagH = S * 0.05;
  const textX = x0 + markWidth(d) + gap;
  return [
    ...mark(k, x0, cy - d / 2, d, back),
    inDisplayFace(
      word(k, textX, cy - (nameH + tagH) / 2, nameW, nameH, NAME, 0.105, {
        textAlignX: 'left',
        fontWeight: 700,
        letterSpacing: -0.02,
        textColor: ink,
      }),
      BRAND_BOARD_FACE,
    ),
    word(k, textX, cy - (nameH + tagH) / 2 + nameH, nameW, tagH, TAG, 0.032, {
      textAlignX: 'left',
      textColor: tagInk,
      fontWeight: 500,
    }),
  ];
}

// A page's notes: its number and name at the top, the shop's name beside it, and what the page is for at the foot.
function notes(k: Kit, i: number, use: string, ink = INK): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  return [
    k.text(0, 0, W * 0.6, u * 6, `${String(i + 1).padStart(2, '0')} · ${PAGES[i]}`, {
      textSize: 'lg',
      textBold: true,
      textColor: ink,
      ...note,
    }),
    k.text(W * 0.5, 0, W * 0.5, u * 6, SHOP, { textAlignX: 'right', textColor: ink, ...note }),
    k.text(0, H - u * 7, W, u * 7, use, { textColor: ink, ...note }),
  ];
}

function logoPage(k: Kit): Element[] {
  return [
    ...notes(k, 0, 'The primary logo. Keep one disc’s width of clear space all round it.'),
    ...lockup(k, k.box.height / 2, INK, MUTED),
  ];
}

// The mark alone, large; on its app icon tile; and at favicon size, each captioned.
function markPage(k: Kit): Element[] {
  const { width: S } = k.box;
  const { u } = k;
  const top = u * 16;
  const big = S * 0.3;
  const els: Element[] = [
    ...notes(
      k,
      1,
      'The mark stands alone where the name is already said: avatars, stickers, the saddle.',
    ),
    ...mark(k, (S - markWidth(big)) / 2, top, big),
  ];
  const rowY = top + big + u * 12;
  const tile = S * 0.22;
  const sizes = [tile, tile * 0.5, tile * 0.28];
  const captions = ['App icon', '64 px', '32 px'];
  const gap = S * 0.08;
  const rowW = sizes.reduce((a, b) => a + b, 0) + gap * (sizes.length - 1);
  let x = (S - rowW) / 2;
  sizes.forEach((side, i) => {
    const y = rowY + (tile - side);
    els.push(
      k.shape('square', x, y, side, side, {
        label: '',
        borderRadius: 'lg',
        fillColor: TEAL,
        strokeColor: TEAL,
        strokeWidth: 'none',
        themeLockFill: true,
      }),
      ...mark(k, x + (side - markWidth(side * 0.42)) / 2, y + side * 0.29, side * 0.42, SAND),
    );
    const capW = Math.max(side, S * 0.18);
    els.push(
      k.text(x + side / 2 - capW / 2, rowY + tile + u * 2, capW, u * 5, captions[i]!, {
        textAlignX: 'center',
        textColor: MUTED,
        ...note,
      }),
    );
    x += side + gap;
  });
  return els;
}

const SWATCHES = [
  { name: 'Teal', role: 'Primary: the logo, headings and buttons', hex: TEAL },
  { name: 'Coral', role: 'Accent: the front disc and calls to action', hex: CORAL },
  { name: 'Sand', role: 'Background: pages, boxes and the shop walls', hex: SAND },
  { name: 'Ink', role: 'Text: body copy and one-colour prints', hex: INK },
];

// A 2 x 2 of locked swatches, each with its name, hex code and use.
function coloursPage(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Colours', `${SHOP}: four colours and what each is for.`);
  const gap = u * 6;
  const cellW = (W - gap) / 2;
  const cellH = (H - head.top - gap) / 2;
  const swatchH = cellH - u * 15;
  return [
    ...head.els,
    ...SWATCHES.flatMap((s, i) => {
      const x = (i % 2) * (cellW + gap);
      const y = head.top + Math.floor(i / 2) * (cellH + gap);
      return [
        k.shape('square', x, y, cellW, swatchH, {
          label: '',
          borderRadius: 'lg',
          fillColor: s.hex,
          strokeColor: s.hex === SAND ? SAND_MUTED : s.hex,
          themeLockFill: true,
        }),
        k.text(x, y + swatchH + u * 2, cellW, u * 6, `${s.name} · ${s.hex.toUpperCase()}`, {
          textSize: 'lg',
          textBold: true,
        }),
        k.text(x, y + swatchH + u * 8, cellW, u * 7, s.role),
      ];
    }),
  ];
}

// The two faces: the display face for headings and the label face for text, each with a specimen.
function typePage(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const head = heading(
    k,
    'Type',
    'Two faces: one for the name and headings, one for everything else.',
  );
  const display = (el: Element) => inDisplayFace(el, BRAND_BOARD_FACE);
  let y = head.top;
  const els: Element[] = [...head.els];
  els.push(
    display(word(k, 0, y, W * 0.3, u * 22, 'Aa', 0.16, { textAlignX: 'left', fontWeight: 700 })),
    k.text(W * 0.34, y + u * 2, W * 0.66, u * 6, 'Syne Bold · Headings', {
      textSize: 'lg',
      textBold: true,
    }),
    display(
      k.text(W * 0.34, y + u * 9, W * 0.66, u * 6, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', {
        textSize: 'lg',
        fontWeight: 700,
      }),
    ),
    display(
      k.text(W * 0.34, y + u * 15, W * 0.66, u * 6, 'abcdefghijklmnopqrstuvwxyz', {
        textSize: 'lg',
      }),
    ),
    display(k.text(W * 0.34, y + u * 21, W * 0.66, u * 6, '0123456789 & ! ?', { textSize: 'lg' })),
  );
  y += u * 30;
  els.push(
    k.shape('square', 0, y, W, u * 0.4, {
      label: '',
      fillColor: SAND_MUTED,
      strokeWidth: 'none',
      themeLockFill: true,
    }),
  );
  y += u * 5;
  els.push(
    k.text(0, y, W * 0.3, u * 22, 'Aa', {
      textSize: 'lg',
      textScale: 4.2,
      textAlignY: 'middle',
      font: 'inter',
    }),
    k.text(W * 0.34, y + u * 2, W * 0.66, u * 6, 'Inter · Body text', {
      textSize: 'lg',
      textBold: true,
      font: 'inter',
    }),
    k.text(
      W * 0.34,
      y + u * 9,
      W * 0.66,
      u * 18,
      'Every bike is fitted to both riders. Book a fitting online or drop in on a Saturday.',
      { textSize: 'lg', font: 'inter' },
    ),
  );
  return els;
}

function onDarkPage(k: Kit): Element[] {
  return [
    ...notes(k, 4, 'On a dark ground the name turns Sand and the back disc Sand too.', SAND),
    ...lockup(k, k.box.height / 2, SAND, SAND_MUTED, SAND),
  ];
}

export function buildBrandBoard(_cx: number, _cy: number): Element[] {
  const kits = pageKits(brandBoardPages());
  return [
    ...logoPage(kits[0]!),
    ...markPage(kits[1]!),
    ...coloursPage(kits[2]!),
    ...typePage(kits[3]!),
    ...onDarkPage(kits[4]!),
  ];
}
