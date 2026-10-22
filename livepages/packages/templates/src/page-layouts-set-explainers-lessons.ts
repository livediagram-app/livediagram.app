// The Explainers lesson layouts (docs/specs/007-editor/pages-mode.md "Layouts"): a Fact File
// (an image, a table of key facts and one surprising one), a Lesson Summary (objectives, key
// points, key words and a quiz question) and Formula Explained (a rule set large, each term led to
// its meaning, and a worked example). Same contract as page-layouts.ts: the page's content box in,
// uncoloured elements out, laid out in proportions of the box.
import { createTable, LABEL_FONT_PX, type Element, type TableElement } from '@livepages/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';
import { iconRow, sourceLine } from './page-layout-parts';
import {
  explainerHeading,
  FOOT,
  leader,
  section,
  sizeToFit,
} from './page-layouts-set-explainers-parts';

// A table placed in the content box: no header row, the first column a header column.
function table(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  cells: string[][],
): TableElement {
  return {
    ...createTable(Math.round(k.box.x + x), Math.round(k.box.y + y)),
    width: Math.round(w),
    height: Math.round(h),
    cells,
    headerRow: false,
    headerColumn: true,
    textSize: 'md',
  };
}

const MARS = [
  ['From the Sun', '228 million km'],
  ['A day', '24 h 37 min'],
  ['A year', '687 Earth days'],
  ['Gravity', '38% of Earth’s'],
  ['Moons', 'Phobos, Deimos'],
  ['Average temperature', '−63°C'],
] as const;

function factFile(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = explainerHeading(k, 'Fact file: Mars', 'The red planet, by the numbers.');
  const top = head.top;
  const bottom = H - u * FOOT;
  const cells = MARS.map(([fact, value]) => [fact, value]);
  const callout = (x: number, y: number, w: number, h: number) =>
    k.callout(x, y, w, h, {
      pageTitle: 'Did you know?',
      label: 'Olympus Mons, a volcano on Mars, stands almost three times as tall as Everest.',
      textSize: 'md',
    });
  const source = sourceLine(k, 'Source: NASA planetary fact sheet.');
  const calloutH = u * 22;
  // Side by side unless the page is clearly taller than wide: the image down the left, the facts
  // and the callout down the right.
  if (W >= H * 0.77) {
    const imgW = W * 0.42;
    const colX = imgW + u * 6;
    const tableH = bottom - top - calloutH - u * 5;
    return [
      ...head.els,
      k.image(0, top, imgW, bottom - top),
      table(k, colX, top, W - colX, tableH, cells),
      callout(colX, bottom - calloutH, W - colX, calloutH),
      source,
    ];
  }
  const tableH = Math.min(MARS.length * u * 11, (bottom - top) * 0.42);
  const calloutY = bottom - calloutH;
  const tableY = calloutY - u * 5 - tableH;
  return [
    ...head.els,
    k.image(0, top, W, tableY - u * 5 - top),
    table(k, 0, tableY, W, tableH, cells),
    callout(0, calloutY, W, calloutH),
    source,
  ];
}

const OBJECTIVES = [
  'Say what a plant needs to make its food',
  'Write the word equation for it',
  'Explain why leaves are green',
] as const;
const KEY_POINTS = [
  'Plants make glucose from CO2 and water.',
  'Light is the energy; chlorophyll captures it.',
  'Oxygen is given off as a by-product.',
] as const;
const KEY_WORDS = ['Chlorophyll', 'Chloroplast', 'Glucose', 'Stomata'] as const;
const QUESTION = 'Which gas do plants take in?';
const OPTIONS = ['A  Oxygen', 'B  Carbon dioxide', 'C  Nitrogen', 'D  Hydrogen'] as const;

function lessonSummary(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = explainerHeading(k, 'Photosynthesis', 'Lesson summary · Science, Year 8');
  const top = head.top;
  const bottom = H - u * FOOT;
  const gap = u * 6;
  const objectives = (x: number, y: number, w: number, h: number) => {
    const s = section(k, x, y, w, 'You can now');
    const rowH = (h - (s.top - y)) / OBJECTIVES.length;
    const icon = Math.min(u * 6, rowH * 0.7);
    return [
      ...s.els,
      ...OBJECTIVES.flatMap((line, i) =>
        iconRow(k, x, s.top + i * rowH, w, icon, 'check-circle', line, {
          lineH: Math.min(rowH, u * 10),
        }),
      ),
    ];
  };
  const keyPoints = (x: number, y: number, w: number, h: number) => {
    const s = section(k, x, y, w, 'Key points');
    const rowH = (h - (s.top - y)) / KEY_POINTS.length;
    const d = Math.min(u * 7, rowH * 0.7);
    return [
      ...s.els,
      ...KEY_POINTS.flatMap((line, i) => {
        const ry = s.top + i * rowH;
        return [
          // A Step number (docs/specs/009-elements/step-number.md) for each key point.
          k.shape('step', x, ry, d, d, { label: `${i + 1}`, textBold: true, chipLook: 'solid' }),
          k.text(x + d + u * 3, ry, w - d - u * 3, Math.min(rowH, u * 10), line, {
            textAlignY: d >= u * 6 ? 'middle' : 'top',
          }),
        ];
      }),
    ];
  };
  // The key words as pills, two to a row.
  const keyWords = (x: number, y: number, w: number, h: number) => {
    const s = section(k, x, y, w, 'Key words');
    const pillGap = u * 3;
    const pillW = (w - pillGap) / 2;
    const pillH = Math.min(u * 8, (h - (s.top - y) - pillGap) / 2);
    return [
      ...s.els,
      ...KEY_WORDS.map((word, i) =>
        k.shape(
          'square',
          x + (i % 2) * (pillW + pillGap),
          s.top + Math.floor(i / 2) * (pillH + pillGap),
          pillW,
          pillH,
          { label: word, textBold: true, borderRadius: 'full' },
        ),
      ),
    ];
  };
  // The quiz: a question and four answers to pick from, two by two.
  const quiz = (x: number, y: number, w: number, h: number) => {
    const s = section(k, x, y, w, 'Check yourself');
    // On one line where the column is wide enough, else two.
    // (A regular glyph's mean advance is a little under half its size.)
    const qH = QUESTION.length * LABEL_FONT_PX.lg * 0.45 <= w ? u * 8 : u * 13;
    // The answers one under another where the column has the height, else two by two.
    const optGap = u * 2.5;
    const room = h - (s.top - y) - qH - u * 2;
    const optCols = (room - optGap * 3) / 4 >= u * 7 ? 1 : 2;
    const optW = (w - optGap * (optCols - 1)) / optCols;
    const optRows = OPTIONS.length / optCols;
    const optH = Math.min(u * 9, (room - optGap * (optRows - 1)) / optRows);
    return [
      ...s.els,
      k.text(x, s.top, w, qH, QUESTION, { textSize: 'lg' }),
      ...OPTIONS.map((opt, i) =>
        k.shape(
          'square',
          x + (i % optCols) * (optW + optGap),
          s.top + qH + u * 2 + Math.floor(i / optCols) * (optH + optGap),
          optW,
          optH,
          { label: opt, borderRadius: 'md', textAlignX: 'left', strokeStyle: 'dashed' },
        ),
      ),
    ];
  };
  const answer = sourceLine(k, 'Answer: B. Plants take in carbon dioxide and give out oxygen.');
  // Two columns but on a story: what was learnt on the left, the words and the quiz on the right.
  if (H <= W * 1.6) {
    const colW = (W - gap) / 2;
    const rx = colW + gap;
    const half = (bottom - top - gap) / 2;
    const wordsH = Math.min(u * 30, half);
    return [
      ...head.els,
      ...objectives(0, top, colW, half),
      ...keyPoints(0, top + half + gap, colW, half),
      ...keyWords(rx, top, colW, wordsH),
      ...quiz(rx, top + wordsH + gap, colW, bottom - top - wordsH - gap),
      answer,
    ];
  }
  // A story: the four sections down the page, the room shared in proportion to what each holds.
  const room = bottom - top - gap * 3;
  const weights = [2.8, 3, 2.6, 3.8];
  const sum = weights.reduce((a, b) => a + b, 0);
  const hs = weights.map((wt) => (room * wt) / sum);
  let y = top;
  const els: Element[] = [...head.els];
  [objectives, keyPoints, keyWords, quiz].forEach((part, i) => {
    els.push(...part(0, y, W, hs[i]!));
    y += hs[i]! + gap;
  });
  return [...els, answer];
}

// The formula's pieces, left to right: a term (with the definition it is led to), or an operator.
// A raised piece is set smaller and higher, as an exponent.
type Piece = { label: string; span: number; term?: [string, string]; raised?: boolean };
const FORMULA: readonly Piece[] = [
  { label: 'A', span: 1, term: ['Amount', 'What you end up with.'] },
  { label: '=', span: 0.6 },
  { label: 'P', span: 1, term: ['Principal', 'What you put in at the start.'] },
  { label: '×', span: 0.6 },
  { label: '(1 + r)', span: 2.6, term: ['Rate', 'The yearly rate as a decimal: 5% is 0.05.'] },
  { label: 'n', span: 0.8, term: ['Years', 'How many years it grows for.'], raised: true },
];
const BALANCE = [1000, 1103, 1216, 1340, 1477, 1629];

function formula(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = explainerHeading(
    k,
    'How compound interest grows',
    'Interest that earns interest, in one rule.',
  );
  const top = head.top;
  // The formula set large across a band, each term on a tile; the band never wider than reads well.
  const bandH = Math.min(u * 20, H * 0.18);
  const totalSpan = FORMULA.reduce((a, p) => a + p.span, 0);
  const unit = Math.min((W * 0.92) / totalSpan, bandH * 1.3);
  let fx = (W - unit * totalSpan) / 2;
  const tiles: { id: string; term: [string, string]; symbol: string }[] = [];
  // A piece's type: a headline fitted to the middle of its tile, with room all round.
  const glyph = (x: number, y: number, w: number, h: number, label: string) => ({
    ...k.title(x, y + h * 0.2, w, h * 0.6, label),
    textAlignX: 'center' as const,
  });
  const els: Element[] = [...head.els];
  for (const p of FORMULA) {
    const w = unit * p.span;
    const h = p.raised ? bandH * 0.55 : bandH;
    const y = top;
    if (p.term) {
      const tile = k.shape('square', fx + u, y, w - u * 2, h, { label: '', borderRadius: 'lg' });
      els.push(tile, glyph(fx + u * 3, y, w - u * 6, h, p.label));
      tiles.push({ id: tile.id, term: p.term, symbol: p.label });
    } else {
      els.push(glyph(fx, y, w, h, p.label));
    }
    fx += w;
  }
  // The definitions: a symbol disc, the term's name and its meaning.
  const defs = (x: number, y: number, w: number, h: number, cols: number, lead: boolean) => {
    const gapX = u * 5;
    const cellW = (w - gapX * (cols - 1)) / cols;
    const rows = tiles.length / cols;
    const cellH = h / rows;
    const d = Math.min(u * 9, cellH * 0.4);
    const names = tiles.map(({ term: [n] }) => n);
    return tiles.flatMap(({ id, term: [name, meaning], symbol }, i) => {
      const cx = x + (i % cols) * (cellW + gapX);
      const cy = y + Math.floor(i / cols) * cellH;
      const disc = k.shape('circle', cx, cy, d, d, {
        label: symbol === '(1 + r)' ? 'r' : symbol,
        textBold: true,
        textSize: 'lg',
      });
      // The name beside its disc where the cell has room, else under it.
      const beside = sizeToFit(cellW - d - u * 3, names) === 'lg';
      const tx = beside ? cx + d + u * 3 : cx;
      const ny = beside ? cy : cy + d + u * 2;
      const nameH = beside ? d : u * 7;
      const my = ny + nameH + u * 2;
      return [
        disc,
        k.text(tx, ny, cx + cellW - tx, nameH, name, {
          textSize: beside ? 'lg' : sizeToFit(cellW, names),
          textBold: true,
          textAlignY: 'middle',
        }),
        k.text(cx, my, cellW, cy + cellH - u * 2 - my, meaning),
        ...(lead ? [leader(id, 's', disc.id, 'n')] : []),
      ];
    });
  };
  const chart = (x: number, y: number, w: number, h: number) => [
    k.text(x, y, w, u * 7, '£1,000 at 5%, year by year', { textBold: true }),
    k.shape('bar-chart', x, y + u * 7, w, h - u * 7, {
      pieSlices: BALANCE.map((value, i) => ({ label: `Yr ${i * 2}`, value })),
      chartLegend: false,
      // Values name each column under its baseline, which the legend would otherwise do.
      chartValues: true,
    }),
  ];
  const example = (x: number, y: number, w: number, h: number) =>
    k.callout(x, y, w, h, {
      pageTitle: 'Worked example',
      label: '£1,000 at 5% for 10 years: A = 1,000 × 1.05¹⁰ = £1,629.',
      textSize: 'md',
    });
  const defsY = top + bandH + u * 8;
  // A wide page, or one not much taller than wide: the four meanings in a row under their terms,
  // led to from them, the worked example beside the chart under that.
  if (k.wide || H < W * 1.3) {
    const defsH = u * 28;
    const lowY = defsY + defsH + u * 4;
    const lowH = H - lowY;
    const exW = W * 0.4;
    return [
      ...els,
      ...defs(0, defsY, W, defsH, 4, true),
      example(0, lowY, exW, lowH),
      ...chart(exW + u * 6, lowY, W - exW - u * 6, lowH),
    ];
  }
  // Tall: the meanings two by two, the chart, then the worked example at the foot.
  const defsH = u * 44;
  const lowY = defsY + defsH + u * 4;
  const exH = u * 20;
  return [
    ...els,
    ...defs(0, defsY, W, defsH, 2, false),
    ...chart(0, lowY, W, H - exH - u * 5 - lowY),
    example(0, H - exH, W, exH),
  ];
}

export const buildFactFile = (b: LayoutBox) => factFile(kit(b));
export const buildLessonSummary = (b: LayoutBox) => lessonSummary(kit(b));
export const buildFormula = (b: LayoutBox) => formula(kit(b));
