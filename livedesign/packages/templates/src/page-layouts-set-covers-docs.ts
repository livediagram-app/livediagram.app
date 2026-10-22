// The Covers set's document fronts (docs/specs/007-editor/pages-mode.md "Layouts"): a report
// cover, a proposal cover, a case study cover and a contents page. Same contract as
// page-layouts.ts: the page's content box in, uncoloured elements out, a tall page stacking and a
// wide one setting side by side.
import type { Element } from '@livedesign/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';
import {
  field,
  figure,
  FIELD_H,
  FIGURE_H,
  fitted,
  hairline,
  headline,
  kicker,
  KICKER_H,
  panel,
  rule,
  vline,
} from './page-layouts-set-covers-parts';

// A row of figures, hairline-divided, each over its caption.
function figures(
  k: Kit,
  x: number,
  y: number,
  w: number,
  rows: readonly (readonly [string, string])[],
): Element[] {
  const { u } = k;
  const gap = u * 4;
  const colW = (w - gap * (rows.length - 1)) / rows.length;
  return rows.flatMap(([value, caption], i) => {
    const cx = x + i * (colW + gap);
    return [
      ...(i > 0 ? [vline(k, cx - gap / 2, y, u * (FIGURE_H - 4))] : []),
      ...figure(k, cx, y, colW, value, caption),
    ];
  });
}

const REPORT_FIGURES = [
  ['£4.2m', 'invested in local power'],
  ['38', 'communities supported'],
  ['12,400', 'homes on clean energy'],
] as const;

function reportCover(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const title = 'Building a fairer energy future';
  const lead = 'How 38 communities took charge of the power they use, and what we learned.';
  const foot = 'Figures for the year to 31 December 2026 · northwindtrust.org';
  const top = [
    kicker(k, 0, 0, W * 0.6, 'Northwind Trust'),
    kicker(k, W * 0.4, 0, W * 0.6, 'Annual report', { textAlignX: 'right' }),
    rule(k, 0, u * 7, W),
  ];
  const footer = k.text(0, H - u * 5, W, u * 5, foot, { textAlignY: 'bottom' });
  const figsY = H - u * 5 - u * 5 - u * FIGURE_H;
  if (k.wide) {
    const colW = W * 0.46;
    const rightX = W * 0.52;
    const rightW = W - rightX;
    const yearH = Math.min(rightW * 0.55, (H - u * 12) * 0.45);
    const imgY = u * 12 + yearH + u * 3;
    return [
      ...top,
      headline(k, 0, u * 16, colW, u * 24, title, 2),
      k.text(0, u * 42, colW, u * 19, lead, { textSize: 'lg' }),
      hairline(k, 0, figsY - u * 4, colW),
      ...figures(k, 0, figsY, colW, REPORT_FIGURES),
      { ...fitted(k, rightX, u * 12, rightW, yearH, '2026', 'right') },
      k.image(rightX, imgY, rightW, figsY + u * FIGURE_H - imgY),
      footer,
    ];
  }
  // Tall: the year set huge under the rule, the title and lead, a picture where there is room, then
  // the figures and the footer.
  const yearH = Math.min(W * 0.5, H * 0.26);
  const titleY = u * 10 + yearH;
  const titleH = u * 20;
  const leadY = titleY + titleH + u * 2;
  const leadH = u * 12;
  const bottom = figsY - u * 5;
  const els: Element[] = [
    ...top,
    fitted(k, 0, u * 10, W, yearH, '2026'),
    headline(k, 0, titleY, W * 0.92, titleH, title, 2),
  ];
  const hasLead = leadY + leadH <= bottom;
  if (hasLead) els.push(k.text(0, leadY, W * 0.88, leadH, lead, { textSize: 'lg' }));
  const imgY = (hasLead ? leadY + leadH : titleY + titleH) + u * 4;
  if (bottom - imgY > u * 18) els.push(k.image(0, imgY, W, bottom - imgY));
  els.push(hairline(k, 0, figsY - u * 4, W), ...figures(k, 0, figsY, W, REPORT_FIGURES), footer);
  return els;
}

const PROPOSAL_FIELDS = [
  ['Prepared for', 'Dana Whitfield', 'Head of Digital, Harbour & Co'],
  ['Prepared by', 'Sam Patel', 'Lead Designer, Lantern Studio'],
  ['Date', '12 October 2026', 'Valid for thirty days'],
  ['Reference', 'LS-041', 'Version 2, for review'],
] as const;

function proposalCover(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const title = 'A new booking experience for Harbour & Co';
  const lead = 'Scope, timeline and investment for a twelve-week redesign of online booking.';
  const logo = u * 12;
  const head = [
    { ...k.image(0, 0, logo, logo), borderRadius: 'md' as const },
    kicker(k, logo + u * 4, (logo - u * KICKER_H) / 2, W * 0.5, 'Lantern Studio'),
    k.shape('stadium', W - u * 30, (logo - u * 8) / 2, u * 30, u * 8, {
      label: 'Confidential',
      textBold: true,
    }),
  ];
  // The title block: an accent bar down its side, the kicker, the title and the lead.
  const block = (x: number, y: number, w: number, h: number): Element[] => {
    const tx = x + u * 6;
    const tw = w - u * 6;
    const titleH = h - u * 8 - u * 21;
    return [
      k.shape('banner', x, y, u * 1.4, h, { label: '', pageSubtitle: '' }),
      kicker(k, tx, y, tw, 'Proposal'),
      headline(k, tx, y + u * 7, tw, titleH, title, tw > u * 80 ? 2 : 3),
      k.text(tx, y + h - u * 19, tw, u * 19, lead, { textSize: 'lg' }),
    ];
  };
  if (k.wide) {
    const colW = W * 0.52;
    const panelX = W * 0.6;
    const panelW = W - panelX;
    const pad = u * 6;
    const blockH = Math.min(u * 62, H - logo - u * 12);
    const blockY = logo + (H - logo - blockH) / 2;
    return [
      ...head.slice(0, 2),
      ...block(0, blockY, colW, blockH),
      // Beside the Proposal kicker, clear of the studio's name.
      k.shape('stadium', colW - u * 30, blockY - u * 1.5, u * 30, u * 8, {
        label: 'Confidential',
        textBold: true,
      }),
      panel(k, panelX, 0, panelW, H),
      ...PROPOSAL_FIELDS.flatMap((f, i) =>
        field(
          k,
          panelX + pad,
          pad + i * ((H - 2 * pad) / PROPOSAL_FIELDS.length),
          panelW - 2 * pad,
          f,
        ),
      ),
    ];
  }
  // Tall: the details two by two at the foot, the title block centred in the room above them. A
  // page not much taller than wide (a square) keeps one row: who it is for, and when.
  const fields = H < W * 1.2 ? [PROPOSAL_FIELDS[0], PROPOSAL_FIELDS[2]] : PROPOSAL_FIELDS;
  const gridRows = fields.length / 2;
  const gridH = u * FIELD_H * gridRows + u * 4 * (gridRows - 1);
  const gridY = H - gridH;
  const colW = (W - u * 6) / 2;
  const room = gridY - logo - u * 8;
  const blockH = Math.min(u * 66, room - u * 4);
  return [
    ...head,
    ...block(0, logo + u * 4 + (room - blockH) / 2, W, blockH),
    ...fields.flatMap((f, i) =>
      field(
        k,
        (i % 2) * (colW + u * 6),
        gridY + Math.floor(i / 2) * (u * FIELD_H + u * 4),
        colW,
        f,
      ),
    ),
  ];
}

const CASE_FIGURES = [
  ['89%', 'faster onboarding'],
  ['3.4x', 'more accounts opened'],
  ['£1.2m', 'saved a year'],
] as const;

function caseStudyCover(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const title = 'How Lumen Bank cut onboarding from nine days to one';
  const quote = '“We stopped losing customers at the very first hurdle.”';
  const who = 'Priya Shah, COO, Lumen Bank';
  const source = 'Results measured over the six months after launch.';
  const badge = (x: number, y: number) =>
    k.shape('stadium', x, y, u * 30, u * 8, { label: 'Case study', textBold: true });
  const meta = (x: number, w: number) =>
    kicker(k, x, u * 1.5, w, 'Banking · 2026', { textAlignX: 'right' });
  const quoteBlock = (x: number, y: number, w: number, h = u * 14): Element[] => [
    k.text(x, y, w, h, quote, { textSize: 'lg', textItalic: true }),
    k.text(x, y + h + u * 1, w, u * 6, who),
  ];
  const footer = k.text(0, H - u * 5, W, u * 5, source, { textAlignY: 'bottom' });
  if (k.wide) {
    const colW = W * 0.42;
    const rightX = W * 0.48;
    const rightW = W - rightX;
    const figsY = H - u * 10 - u * FIGURE_H;
    return [
      badge(0, 0),
      headline(k, 0, u * 14, colW, u * 32, title, 4),
      ...quoteBlock(0, u * 52, colW, u * 20),
      meta(rightX, rightW),
      k.image(rightX, u * 12, rightW, figsY - u * 18),
      ...figures(k, rightX, figsY, rightW, CASE_FIGURES),
      footer,
    ];
  }
  const titleH = u * 30;
  const figsY = H - u * 10 - u * FIGURE_H;
  const quoteY = figsY - u * 6 - u * 21;
  const imgY = u * 12 + titleH + u * 4;
  const els: Element[] = [badge(0, 0), meta(W * 0.4, W * 0.6)];
  els.push(headline(k, 0, u * 12, W, titleH, title, 3));
  // The quote where the page has room for it as well as a picture; else just the picture.
  const withQuote = quoteY - imgY > u * 30;
  const imgBottom = (withQuote ? quoteY : figsY) - u * 5;
  if (imgBottom - imgY > u * 14) els.push(k.image(0, imgY, W, imgBottom - imgY));
  if (withQuote) els.push(...quoteBlock(0, quoteY, W));
  els.push(hairline(k, 0, figsY - u * 3, W), ...figures(k, 0, figsY, W, CASE_FIGURES), footer);
  return els;
}

const CONTENTS = [
  ['Foreword', 'A letter from our chair', '03'],
  ['The year at a glance', 'Twelve months in numbers', '06'],
  ['Our work', 'Thirty-eight projects in three regions', '10'],
  ['People', 'The staff and volunteers behind it', '18'],
  ['Money', 'Where every pound went', '24'],
  ['What comes next', 'Our plan for 2027', '30'],
] as const;

// The contents' rows down a column: a number, a section and its note, the page it starts on.
function contentsRows(k: Kit, x: number, y: number, w: number, h: number): Element[] {
  const { u } = k;
  const rowH = h / CONTENTS.length;
  const withNotes = rowH >= u * 15;
  const numW = Math.min(u * 16, w * 0.18);
  const pageW = u * 12;
  const numH = Math.min(rowH - u * 4, u * 11);
  const textX = x + numW + u * 3;
  const textW = w - numW - u * 3 - pageW;
  return CONTENTS.flatMap(([name, note, page], i) => {
    const ry = y + i * rowH;
    const nameY = withNotes ? ry + (rowH - u * 14) / 2 : ry + (rowH - u * 7) / 2;
    return [
      hairline(k, x, ry, w),
      fitted(k, x, ry + (rowH - numH) / 2, numW, numH, `0${i + 1}`),
      k.text(textX, nameY, textW, u * 7, name, {
        textSize: 'lg',
        textBold: true,
        textAlignY: 'middle',
      }),
      ...(withNotes
        ? [k.text(textX, nameY + u * 7.5, textW, u * 6, note, { textAlignY: 'top' })]
        : []),
      k.text(x + w - pageW, ry, pageW, rowH, page, {
        textSize: 'lg',
        textAlignX: 'right',
        textAlignY: 'middle',
      }),
    ];
  });
}

function contents(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const intro = 'Six chapters on the year that was.';
  if (k.wide) {
    const colW = W * 0.32;
    const listX = colW + u * 8;
    return [
      kicker(k, 0, 0, colW, 'Inside this report'),
      fitted(k, 0, u * 7, colW, u * 16, 'Contents'),
      rule(k, 0, u * 26, u * 14),
      k.text(0, u * 31, colW, u * 16, intro, { textSize: 'lg' }),
      k.image(0, u * 51, colW, H - u * 51),
      ...contentsRows(k, listX, 0, W - listX, H),
    ];
  }
  const top = u * 40;
  return [
    kicker(k, 0, 0, W, 'Inside this report'),
    fitted(k, 0, u * 7, W, u * 16, 'Contents'),
    rule(k, 0, u * 26, u * 14),
    k.text(0, u * 30, W, u * 7, intro, { textSize: 'lg', textAlignY: 'middle' }),
    ...contentsRows(k, 0, top, W, H - top),
  ];
}

export const buildReportCover = (b: LayoutBox) => reportCover(kit(b));
export const buildProposalCover = (b: LayoutBox) => proposalCover(kit(b));
export const buildCaseStudyCover = (b: LayoutBox) => caseStudyCover(kit(b));
export const buildContents = (b: LayoutBox) => contents(kit(b));
