// Recipe Card template (kind `recipe-card`, docs/specs/007-editor/templates-by-mode.md
// "Illustrate templates"): a recipe to share, a made-up weeknight bake, that opens in Illustrate
// on two pages sized for a feed: a Square page for the dish and a Portrait post (4:5) page for
// the method, so the pair posts as a carousel.
//
//   1. The dish: a kicker, the dish's name set large over two lines, a one-line promise, a big
//      photo slot with a herb sticker, and three cards for serves, prep and cook time, each on
//      its own glyph.
//   2. The method: a card of ingredients in two columns, then five numbered steps down a rail,
//      and a tip to finish.
//
// The colours are the card's own (terracotta on a warm cream) and locked against the theme; the
// photo is an empty image placeholder (imageId: null), so the template ships no bytes.
//
// Pure: () -> Element[], placed on the card's pages (recipeCardPages) whatever centre is passed.

import type { Element, IllustratePage } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { CARD_SHADOW, iconDisc, lockedFill, panel } from './template-page-design';
import { pageKits, templatePage } from './template-page-kit';

const TERRACOTTA = '#c2410c';
const TOMATO = '#ea580c';
const INK = '#292524';
const MUTED = '#57534e';
const PAPER = '#ffffff';
const CREAM = '#fff7ed';

const FACTS = [
  { iconId: 'users', label: 'SERVES', value: '4 people' },
  { iconId: 'clock', label: 'PREP', value: '15 minutes' },
  { iconId: 'stove', label: 'COOK', value: '40 minutes' },
] as const;

const INGREDIENTS = [
  [
    '600g cherry tomatoes',
    '2 tins butter beans',
    '1 red onion, in wedges',
    '4 garlic cloves',
    '2 tbsp olive oil',
  ],
  [
    '1 tsp smoked paprika',
    '1 tbsp red wine vinegar',
    '50g sourdough crumbs',
    'Zest of 1 lemon',
    'Feta and basil, to serve',
  ],
] as const;

const STEPS = [
  'Heat the oven to 200°C (180°C fan). Toss the tomatoes, onion and whole garlic with the oil and paprika in a roasting tin.',
  'Roast for 20 minutes, until the tomatoes start to burst and the onion catches at the edges.',
  'Squash the soft garlic into the tin, stir in the drained beans and the vinegar, and season well.',
  'Toss the crumbs with the lemon zest and a little oil, scatter them over and bake for 20 minutes more.',
  'Rest for five minutes, then crumble over the feta and tear over the basil.',
] as const;

const TIP = 'Make it a day ahead. It is even better warmed through, with crusty bread.';

/** The card's pages: the dish on a Square page, the method on a Portrait post (4:5) page. */
export function recipeCardPages(): IllustratePage[] {
  return [
    templatePage(1, 'square', 'portrait', 'The Dish', {
      fill: { kind: 'gradient', from: '#fff7ed', to: '#ffe4e6', angle: 160 },
    }),
    templatePage(2, 'social', 'portrait', 'The Method', { fill: { kind: 'solid', color: CREAM } }),
  ];
}

// 1. The dish: kicker, name, promise, photo and the three facts.
function dish(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const photoTop = u * 39;
  const factsH = u * 12;
  const factsTop = H - factsH;
  const photoH = factsTop - photoTop - u * 4;
  const gap = u * 3;
  const cardW = (W - gap * 2) / 3;
  const d = u * 7;
  return [
    k.text(0, 0, W * 0.8, u * 4, 'WEEKNIGHT SUPPER · ONE TRAY', {
      textBold: true,
      textScale: 1.1,
      textColor: TERRACOTTA,
    }),
    { ...k.title(0, u * 5, W, u * 11, 'Roast Tomato and'), textColor: INK },
    { ...k.title(0, u * 16, W, u * 11, 'Butter Bean Bake'), textColor: TOMATO },
    k.text(0, u * 29, W * 0.9, u * 8, 'Sweet tomatoes, creamy beans and a crunchy lemon crumb.', {
      textScale: 1.2,
      textColor: MUTED,
    }),
    k.image(0, photoTop, W, photoH),
    k.shape('sticker', W - u * 13, photoTop - u * 4, u * 15, u * 15, {
      stickerId: 'emoji-herb',
      rotation: 12,
    }),
    ...FACTS.flatMap((f, i) => {
      const x = i * (cardW + gap);
      const textX = x + u * 3 + d + u * 2.5;
      const textW = cardW - (textX - x) - u * 2;
      return [
        panel(k, x, factsTop, cardW, factsH, PAPER, {
          strokeColor: '#fed7aa',
          shadow: CARD_SHADOW,
        }),
        ...iconDisc(k, f.iconId, x + u * 3, factsTop + (factsH - d) / 2, d, TOMATO, PAPER),
        k.text(textX, factsTop + u * 2.4, textW, u * 3.4, f.label, {
          textSize: 'sm',
          textBold: true,
          textColor: TERRACOTTA,
        }),
        k.text(textX, factsTop + u * 5.8, textW, u * 4, f.value, {
          textBold: true,
          textColor: INK,
        }),
      ];
    }),
  ];
}

// 2. The method: the ingredients card, the numbered steps down a rail, and the tip.
function method(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const cardTop = u * 17;
  const cardH = u * 30;
  const pad = u * 4;
  const colW = (W - pad * 2) / 2;
  const tipH = u * 10;
  const tipTop = H - tipH;
  const stepsTop = cardTop + cardH + u * 6;
  const rowH = (tipTop - u * 4 - stepsTop) / STEPS.length;
  const d = u * 7;
  const textX = d + u * 4;
  const els: Element[] = [
    k.text(0, 0, W * 0.8, u * 4, 'THE METHOD', {
      textBold: true,
      textScale: 1.1,
      textColor: TERRACOTTA,
    }),
    { ...k.title(0, u * 5, W * 0.9, u * 9, 'How to make it'), textColor: INK },
    panel(k, 0, cardTop, W, cardH, PAPER, { strokeColor: '#fed7aa', shadow: CARD_SHADOW }),
    k.text(pad, cardTop + u * 3, colW, u * 5, 'Ingredients', {
      textScale: 1.2,
      textBold: true,
      textColor: INK,
    }),
    ...INGREDIENTS.map((col, c) =>
      k.text(
        pad + c * colW,
        cardTop + u * 10,
        colW - u * 2,
        cardH - u * 12,
        col.map((l) => `• ${l}`).join('\n'),
        {
          textColor: MUTED,
        },
      ),
    ),
    // The rail the step numbers sit on.
    panel(k, d / 2 - u * 0.4, stepsTop + d / 2, u * 0.8, rowH * (STEPS.length - 1), '#fed7aa', {
      borderRadius: 'full',
    }),
  ];
  STEPS.forEach((s, i) => {
    const y = stepsTop + i * rowH;
    els.push(
      k.shape('circle', 0, y, d, d, {
        label: String(i + 1),
        textBold: true,
        textColor: PAPER,
        ...lockedFill(TOMATO),
      }),
      k.text(textX, y + u * 0.6, W - textX, rowH - u * 1.5, s, { textColor: INK }),
    );
  });
  els.push(
    panel(k, 0, tipTop, W, tipH, '#ffedd5'),
    ...iconDisc(k, 'star', u * 3, tipTop + (tipH - u * 6) / 2, u * 6, TERRACOTTA, PAPER),
    k.text(u * 12, tipTop + u * 1.5, W - u * 15, tipH - u * 3, `Tip: ${TIP}`, {
      textColor: INK,
      textAlignY: 'middle',
    }),
  );
  return els;
}

export function buildRecipeCard(): Element[] {
  const [front, back] = pageKits(recipeCardPages());
  return [...dish(front!), ...method(back!)];
}
