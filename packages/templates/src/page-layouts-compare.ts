// The compare layouts (docs/specs/007-editor/illustrate-pages.md "Layouts"): pros and cons, before
// and after, and a feature matrix. Same contract as page-layouts.ts: the page's content box in,
// elements out, a tall page stacking and a wide one setting side by side. Only a tick's green and
// a cross's rose are fixed, since there the colour is the meaning.
import { createPinnedArrow, type Element } from '@livediagram/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';
import { CROSS_ROSE, iconRow, TICK_GREEN } from './page-layout-parts';

const PROS = [
  'Everything in one place',
  'Works on any device',
  'Free for the whole team',
  'Set up in an afternoon',
] as const;
const CONS = [
  'Old files need moving',
  'A week of learning',
  'Two tools for a while',
  'Some habits must change',
] as const;

function prosCons(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Pros and cons', 'Should we switch to the new tool?');
  const gap = u * 6;
  const colW = (W - gap) / 2;
  const verdictH = u * 18;
  const rowsTop = head.top + u * 18;
  // The rows share their column down to the verdict, as Comparison's do.
  const rowH = (H - verdictH - u * 6 - rowsTop) / PROS.length;
  const icon = Math.min(u * 10, rowH * 0.5);
  // Page type a size up where the column is wide enough to keep a point to two lines.
  const lineSize = colW > u * 40 ? 'lg' : 'md';
  const column = (
    x: number,
    title: string,
    iconId: string,
    color: string,
    lines: readonly string[],
  ) => [
    k.shape('square', x, head.top, colW, u * 12, {
      label: title,
      textBold: true,
      textSize: 'lg',
      borderRadius: 'md',
    }),
    ...lines.flatMap((line, i) =>
      iconRow(k, x, rowsTop + i * rowH, colW, icon, iconId, line, {
        iconColor: color,
        lineH: Math.min(rowH - u * 2, u * 14),
        textSize: lineSize,
      }),
    ),
  ];
  return [
    ...head.els,
    ...column(0, 'Pros', 'check', TICK_GREEN, PROS),
    ...column(colW + gap, 'Cons', 'x', CROSS_ROSE, CONS),
    k.shape('callout', 0, H - verdictH, W, verdictH, {
      pageTitle: 'Weighing it up',
      label: 'Say which side wins, and why, in one sentence.',
      textSize: 'md',
    }),
  ];
}

// Wider than this many times its height, a panel sets its image beside its points.
const PANEL_WIDE = 1.15;

function beforeAfter(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'The difference it made', 'How the weekly report changed.');
  const top = head.top;
  // A card, its name, an image and three points: the image over the points, or beside them in a
  // panel much wider than tall (a tall page's stacked panels), so neither is squeezed thin.
  const panel = (
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    iconId: string,
    points: readonly string[],
  ) => {
    const pad = u * 4;
    const card = k.shape('square', x, y, w, h, { label: '', borderRadius: 'lg' });
    const innerW = w - 2 * pad;
    const nameH = u * 8;
    const rowH = u * 9;
    const icon = u * 6;
    const rows = (rx: number, ry: number, rw: number) =>
      points.flatMap((p, i) => iconRow(k, rx, ry + i * rowH, rw, icon, iconId, p));
    if (w > h * PANEL_WIDE) {
      const imgW = innerW * 0.42;
      const textX = x + pad + imgW + u * 5;
      const textW = x + w - pad - textX;
      return {
        card,
        els: [
          card,
          k.image(x + pad, y + pad, imgW, h - 2 * pad),
          k.text(textX, y + pad, textW, nameH, title, { textSize: 'lg', textBold: true }),
          ...rows(textX, y + pad + nameH + u * 2, textW),
        ],
      };
    }
    const pointsH = points.length * rowH;
    const imgY = y + pad + nameH + u * 2;
    const imgH = h - 2 * pad - nameH - u * 5 - pointsH;
    return {
      card,
      els: [
        card,
        k.text(x + pad, y + pad, innerW, nameH, title, { textSize: 'lg', textBold: true }),
        k.image(x + pad, imgY, innerW, imgH),
        ...rows(x + pad, imgY + imgH + u * 3, innerW),
      ],
    };
  };
  const before = [
    'Built by hand every Friday',
    'Numbers from five places',
    'Out of date by Monday',
  ];
  const after = [
    'Builds itself overnight',
    'One source for every number',
    'Live whenever you look',
  ];
  // The change in one figure: the figure over what it measures, in page type where it sits in
  // the narrow column between the panels.
  const figure = (x: number, y: number, w: number, h: number, align: 'left' | 'center') => [
    { ...k.title(x, y, w, h * 0.62, '3x'), textAlignX: align },
    k.text(x, y + h * 0.64, w, h * 0.36, 'faster to an answer', {
      textSize: align === 'left' ? 'lg' : 'md',
      textBold: true,
      textAlignX: align,
    }),
  ];
  // Side by side unless the page is clearly taller than wide (a square's stacked panels would be
  // too short for their points).
  if (W >= H * 0.9) {
    // The panels either side, the figure between them over the arrow that joins them.
    const midW = Math.max(W * 0.2, u * 26);
    const panelW = (W - midW) / 2;
    const h = H - top;
    const a = panel(0, top, panelW, h, 'Before', 'clock', before);
    const b = panel(panelW + midW, top, panelW, h, 'After', 'check-circle', after);
    const figH = Math.min(u * 30, h * 0.4);
    return [
      ...head.els,
      ...a.els,
      ...b.els,
      ...figure(panelW + u * 3, top + h / 2 - figH - u * 4, midW - u * 6, figH, 'center'),
      createPinnedArrow(a.card.id, 'e', b.card.id, 'w'),
    ];
  }
  // Stacked: Before, an arrow down to After, then the change in one figure at the foot.
  const figH = u * 20;
  const arrowGap = u * 10;
  const panelH = (H - top - figH - u * 6 - arrowGap) / 2;
  const a = panel(0, top, W, panelH, 'Before', 'clock', before);
  const b = panel(0, top + panelH + arrowGap, W, panelH, 'After', 'check-circle', after);
  return [
    ...head.els,
    ...a.els,
    ...b.els,
    createPinnedArrow(a.card.id, 's', b.card.id, 'n'),
    ...figure(0, H - figH, W, figH, 'left'),
  ];
}

const OPTIONS = ['Starter', 'Team', 'Business'] as const;
// The option the matrix recommends: its column is highlighted.
const RECOMMENDED = 1;
const FEATURES = [
  ['Unlimited pages', [true, true, true]],
  ['Real-time editing', [false, true, true]],
  ['Export to PDF', [true, true, true]],
  ['Shared templates', [false, true, true]],
  ['Single sign-on', [false, false, true]],
] as const;

function featureMatrix(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Which plan fits?', 'Three options against what matters most.');
  const labelW = W * (k.wide ? 0.4 : 0.34);
  const colW = (W - labelW) / OPTIONS.length;
  const headerH = u * 16;
  const rowsTop = head.top + headerH + u * 2;
  // The rows share the page down to its foot, so the grid never stops short.
  const rowH = (H - rowsTop - u * 2) / FEATURES.length;
  const mark = Math.min(u * 9, rowH * 0.6);
  const colX = (c: number) => labelW + c * colW;
  return [
    ...head.els,
    // The recommended option's column, highlighted from its name to the last row.
    k.shape('square', colX(RECOMMENDED) + u, head.top, colW - u * 2, H - head.top, {
      label: '',
      borderRadius: 'lg',
    }),
    k.text(colX(RECOMMENDED) + u, head.top + u * 2, colW - u * 2, u * 5, 'Our pick', {
      textBold: true,
      textAlignX: 'center',
    }),
    ...OPTIONS.map((name, c) =>
      k.text(colX(c), head.top + u * 7, colW, u * 8, name, {
        textSize: 'lg',
        textBold: true,
        textAlignX: 'center',
      }),
    ),
    ...FEATURES.flatMap(([feature, cells], r) => {
      const y = rowsTop + r * rowH;
      return [
        k.text(0, y, labelW - u * 3, rowH, feature, { textSize: 'lg', textAlignY: 'middle' }),
        ...cells.map((has, c) => {
          const cx = colX(c) + colW / 2;
          const cy = y + rowH / 2;
          // A tick where the option has the feature, a short dash where it does not.
          return has
            ? k.shape('icon', cx - mark / 2, cy - mark / 2, mark, mark, { iconId: 'check' })
            : k.shape('square', cx - mark * 0.3, cy - u * 0.6, mark * 0.6, u * 1.2, {
                label: '',
                borderRadius: 'full',
              });
        }),
      ];
    }),
  ];
}

export const buildProsCons = (b: LayoutBox) => prosCons(kit(b));
export const buildBeforeAfter = (b: LayoutBox) => beforeAfter(kit(b));
export const buildFeatureMatrix = (b: LayoutBox) => featureMatrix(kit(b));
