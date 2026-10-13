// The Explainers reference layouts (docs/specs/007-editor/illustrate-pages.md "Layouts"): a Cheat
// Sheet (grouped shortcuts on keycaps), a Glossary (terms A to Z, each under its letter) and Myths
// and Facts (each myth beside the fact that corrects it). Same contract as page-layouts.ts: the
// page's content box in, uncoloured elements out, laid out in proportions of the box.
import { createPinnedArrow, type Element } from '@livediagram/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';
import { CROSS_ROSE, iconRow, sourceLine, TICK_GREEN } from './page-layout-parts';
import { explainerHeading, FOOT, sizeToFit } from './page-layouts-set-explainers-parts';

// Four groups of four shortcuts: the keys, then what they do.
const SHORTCUTS = [
  [
    'map-pin',
    'Move',
    [
      ['Ctrl + →', 'Jump to end'],
      ['Ctrl + Home', 'Back to A1'],
      ['Ctrl + G', 'Go to a cell'],
      ['Page Down', 'Next screen'],
    ],
  ],
  [
    'layers',
    'Select',
    [
      ['Shift + Space', 'Row'],
      ['Ctrl + Space', 'Column'],
      ['Ctrl + A', 'All cells'],
      ['Shift + →', 'Grow by one'],
    ],
  ],
  [
    'edit',
    'Edit',
    [
      ['F2', 'Edit cell'],
      ['Ctrl + D', 'Fill down'],
      ['Ctrl + ;', 'Insert date'],
      ['Alt + =', 'AutoSum'],
    ],
  ],
  [
    'sliders',
    'Format',
    [
      ['Ctrl + B', 'Bold'],
      ['Ctrl + I', 'Italic'],
      ['Ctrl + U', 'Underline'],
      ['Ctrl + 1', 'Cell format'],
    ],
  ],
] as const;

function cheatSheet(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = explainerHeading(k, 'Spreadsheet shortcuts', 'The sixteen that save the most time.');
  const top = head.top;
  const bottom = H - u * FOOT;
  // A long page has room for a tip under the groups.
  const tipH = H > W * 1.3 ? u * 18 : 0;
  const groupsBottom = bottom - (tipH ? tipH + u * 5 : 0);
  // One column on a story, two everywhere else.
  const cols = H > W * 1.6 ? 1 : 2;
  const rowsOfGroups = SHORTCUTS.length / cols;
  const gapX = u * 6;
  const gapY = u * 5;
  const colW = (W - gapX * (cols - 1)) / cols;
  const groupH = (groupsBottom - top - gapY * (rowsOfGroups - 1)) / rowsOfGroups;
  const headH = u * 8;
  const keyW = Math.min(colW * 0.56, u * 40);
  const els: Element[] = [...head.els];
  SHORTCUTS.forEach(([iconId, name, keys], g) => {
    const x = (g % cols) * (colW + gapX);
    const y = top + Math.floor(g / cols) * (groupH + gapY);
    els.push(
      ...iconRow(k, x, y, colW, headH, iconId, name, { textSize: 'lg', textBold: true }),
      // The rule under the group's name, across its column.
      k.shape('square', x, y + headH + u * 1.5, colW, u * 0.6, { label: '', borderRadius: 'full' }),
    );
    const rowsTop = y + headH + u * 4;
    const rowH = Math.min(u * 12, (y + groupH - rowsTop) / keys.length);
    const capH = Math.min(u * 8, rowH * 0.8);
    keys.forEach(([combo, action], i) => {
      const ry = rowsTop + i * rowH + (rowH - capH) / 2;
      els.push(
        k.shape('square', x, ry, keyW, capH, {
          label: combo,
          textBold: true,
          borderRadius: 'md',
        }),
        k.text(x + keyW + u * 4, ry, colW - keyW - u * 4, capH, action, { textAlignY: 'middle' }),
      );
    });
  });
  if (tipH) {
    els.push(
      k.shape('callout', 0, bottom - tipH, W, tipH, {
        pageTitle: 'Pro tip',
        label: 'Hold Ctrl and click to pick cells that are not next to each other.',
        textSize: 'md',
      }),
    );
  }
  els.push(sourceLine(k, 'On a Mac, use Cmd for Ctrl and Option for Alt.'));
  return els;
}

// Eight terms, A to Z, each with a plain-words definition.
const TERMS = [
  ['Carbon footprint', 'All the greenhouse gas a person, product or firm causes.'],
  ['Decarbonise', 'To cut the carbon a process, a firm or a country puts out.'],
  ['Greenhouse gas', 'A gas, like CO2 or methane, that traps heat in the air.'],
  ['Net zero', 'Taking out as much greenhouse gas as you put in.'],
  ['Offsetting', 'Paying to cut emissions elsewhere to balance your own.'],
  ['Renewable', 'Energy from a source that refills itself: sun, wind, water.'],
  ['Scope 3', "The emissions in a firm's supply chain: often the largest share."],
  ['Tipping point', 'A threshold past which a change feeds itself and is hard to undo.'],
] as const;

function glossary(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = explainerHeading(
    k,
    'Climate words, decoded',
    'Eight terms you will hear this year, A to Z.',
  );
  const top = head.top;
  // Two columns, reading down, or one on a story.
  const cols = H > W * 1.6 ? 1 : 2;
  const rows = TERMS.length / cols;
  const gapX = u * 6;
  const colW = (W - gapX * (cols - 1)) / cols;
  const rowH = (H - top) / rows;
  const tile = Math.min(u * 10, rowH * 0.6);
  const textX = tile + u * 4;
  const termSize = sizeToFit(
    colW - textX,
    TERMS.map(([t]) => t),
  );
  const termH = termSize === 'lg' ? u * 7 : u * 5.5;
  return [
    ...head.els,
    ...TERMS.flatMap(([term, meaning], i) => {
      const x = Math.floor(i / rows) * (colW + gapX);
      const y = top + (i % rows) * rowH;
      return [
        k.shape('square', x, y, tile, tile, {
          label: term[0]!,
          textBold: true,
          textSize: 'lg',
          borderRadius: 'md',
        }),
        k.text(x + textX, y, colW - textX, termH, term, { textSize: termSize, textBold: true }),
        k.text(x + textX, y + termH + u, colW - textX, rowH - termH - u * 4, meaning),
      ];
    }),
  ];
}

// Each myth and the fact that corrects it.
const MYTHS = [
  [
    'You can catch up on sleep at the weekend.',
    'A lie-in eases the tiredness, but not a week of short nights.',
  ],
  ['Older adults need less sleep.', 'Adults of every age need seven to nine hours a night.'],
  ['A nightcap helps you sleep.', 'Alcohol sends you off faster, then breaks up deep sleep.'],
  ['Snoring is harmless.', 'Loud, regular snoring can be a sign of sleep apnoea.'],
] as const;

function mythsFacts(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = explainerHeading(k, 'Sleep: myths and facts', 'What the research actually says.');
  const top = head.top;
  const bottom = H - u * FOOT;
  const source = sourceLine(k, 'Source: say which studies or health body these facts come from.');
  const card = (x: number, y: number, w: number, h: number, label: string, myth: boolean) =>
    k.shape('square', x, y, w, h, {
      label,
      borderRadius: 'lg',
      textAlignX: 'left',
      ...(myth ? { strokeStyle: 'dashed' as const } : { textBold: true }),
    });
  const tag = (x: number, y: number, w: number, myth: boolean) =>
    iconRow(k, x, y, w, u * 7, myth ? 'x' : 'check', myth ? 'Myth' : 'Fact', {
      iconColor: myth ? CROSS_ROSE : TICK_GREEN,
      textSize: 'lg',
      textBold: true,
    });
  const els: Element[] = [...head.els];
  // A story: each myth over its fact, an arrow down between them, the pairs down the page.
  if (H > W * 1.6) {
    const tagH = u * 7;
    const pairGap = u * 8;
    const pairH = (bottom - top - pairGap * (MYTHS.length - 1)) / MYTHS.length;
    const cardH = (pairH - u * 6 - tagH) / 2;
    MYTHS.forEach(([myth, fact], i) => {
      const y = top + i * (pairH + pairGap);
      const a = card(u * 11, y, W - u * 11, cardH, myth, true);
      const b = card(u * 11, y + cardH + u * 6, W - u * 11, cardH, fact, false);
      els.push(
        k.shape('icon', 0, y + (cardH - tagH) / 2, tagH, tagH, {
          iconId: 'x',
          strokeColor: CROSS_ROSE,
        }),
        a,
        k.shape('icon', 0, y + cardH + u * 6 + (cardH - tagH) / 2, tagH, tagH, {
          iconId: 'check',
          strokeColor: TICK_GREEN,
        }),
        b,
        createPinnedArrow(a.id, 's', b.id, 'n'),
      );
    });
    return [...els, source];
  }
  // Two columns, Myth and Fact, each myth's row joined by an arrow to its fact.
  const mid = u * 10;
  const colW = (W - mid) / 2;
  const tagH = u * 7;
  const rowsTop = top + tagH + u * 4;
  const gap = u * 4;
  const rowH = (bottom - rowsTop) / MYTHS.length;
  els.push(...tag(0, top, colW, true), ...tag(colW + mid, top, colW, false));
  MYTHS.forEach(([myth, fact], i) => {
    const y = rowsTop + i * rowH;
    const a = card(0, y, colW, rowH - gap, myth, true);
    const b = card(colW + mid, y, colW, rowH - gap, fact, false);
    els.push(a, b, createPinnedArrow(a.id, 'e', b.id, 'w'));
  });
  return [...els, source];
}

export const buildCheatSheet = (b: LayoutBox) => cheatSheet(kit(b));
export const buildGlossary = (b: LayoutBox) => glossary(kit(b));
export const buildMythsFacts = (b: LayoutBox) => mythsFacts(kit(b));
