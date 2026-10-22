// The Covers set's print fronts (docs/specs/007-editor/pages-mode.md "Layouts"): a magazine
// cover, a book cover, a newsletter's front page and a certificate. Same contract as
// page-layouts.ts: the page's content box in, uncoloured elements out, a tall page stacking and a
// wide one setting side by side.
import type { Element } from '@livepages/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';
import { iconDisc } from './page-layout-parts';
import {
  doubleFrame,
  fitted,
  hairline,
  headline,
  kicker,
  KICKER_H,
  panel,
  rule,
} from './page-layouts-set-covers-parts';

// A masthead's tracking, in em.
const MASTHEAD_TRACKING = 0.12;

const COVER_LINES = [
  ['12 streets', 'that put people before cars'],
  ['Car-free cities', 'Do they work outside Paris?'],
  ['Plus', 'Night buses and pocket parks'],
] as const;

// A cover line's least room, in units.
const COVER_LINE_H = 20;

// The magazine's cover lines down a column: a bold kicker over its line, an accent rule between.
function coverLines(k: Kit, x: number, y: number, w: number, h: number): Element[] {
  const { u } = k;
  // As many as get a row of COVER_LINE_H units each: three on most pages, two on a square.
  const n = Math.max(1, Math.min(COVER_LINES.length, Math.floor(h / (u * COVER_LINE_H))));
  const rowH = h / n;
  return COVER_LINES.slice(0, n).flatMap(([lead, line], i) => {
    const ry = y + i * rowH;
    return [
      rule(k, x, ry, u * 10, u * 1),
      k.text(x, ry + u * 3, w, u * 8, lead, { textSize: 'lg', textBold: true }),
      k.text(x, ry + u * 11, w, Math.max(u * 7, rowH - u * 12), line, {
        textSize: rowH > u * 30 ? 'lg' : 'md',
      }),
    ];
  });
}

function magazineCover(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const story = 'The quiet revolution in how cities move';
  const mastH = Math.min(W * 0.3, H * 0.2);
  const stripY = mastH + u * 2;
  const strip = [
    hairline(k, 0, stripY, W),
    kicker(k, 0, stripY + u * 1.5, W * 0.7, 'Issue 14 · Winter 2026'),
    kicker(k, W * 0.7, stripY + u * 1.5, W * 0.3, '£6.50', { textAlignX: 'right' }),
    hairline(k, 0, stripY + u * 8, W),
  ];
  const bodyY = stripY + u * 13;
  const masthead = fitted(k, 0, 0, W, mastH, 'ORBIT', 'center', MASTHEAD_TRACKING);
  if (k.wide) {
    const storyW = W * 0.3;
    const linesW = W * 0.24;
    const imgX = storyW + u * 6;
    const imgW = W - storyW - linesW - u * 12;
    const bodyH = H - bodyY;
    return [
      masthead,
      ...strip,
      kicker(k, 0, bodyY, storyW, 'Cover story'),
      headline(k, 0, bodyY + u * 7, storyW, bodyH * 0.55, story, 4),
      k.text(
        0,
        bodyY + u * 9 + bodyH * 0.55,
        storyW,
        bodyH * 0.45 - u * 9,
        'Inside the cities quietly rebuilding their streets.',
        {
          textSize: 'lg',
        },
      ),
      k.image(imgX, bodyY, imgW, bodyH),
      ...coverLines(k, W - linesW, bodyY, linesW, bodyH),
    ];
  }
  // Tall: the picture beside the cover lines, the cover story across the foot.
  const storyH = Math.min(u * 26, H * 0.2);
  const storyY = H - storyH;
  const bodyH = storyY - u * 12 - bodyY;
  const linesW = W * 0.36;
  return [
    masthead,
    ...strip,
    ...coverLines(k, 0, bodyY, linesW, bodyH),
    k.image(linesW + u * 5, bodyY, W - linesW - u * 5, bodyH),
    kicker(k, 0, storyY - u * 7, W, 'Cover story'),
    headline(k, 0, storyY, W, storyH, story, 2),
  ];
}

function bookCover(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const pad = u * 10;
  const title = 'The Lighthouse Keeper’s Daughter';
  const blurb = '“Haunting, tender and impossible to put down.”';
  // An ornament: a short rule each side of a star.
  const ornament = (cx: number, y: number): Element[] => {
    const s = u * 6;
    const arm = u * 12;
    return [
      hairline(k, cx - s / 2 - u * 2 - arm, y + s / 2, arm),
      k.shape('icon', cx - s / 2, y, s, s, { iconId: 'star' }),
      hairline(k, cx + s / 2 + u * 2, y + s / 2, arm),
    ];
  };
  // The words, centred in a column: author, title, ornament, subtitle.
  const words = (x: number, y: number, w: number, titleH: number): Element[] => {
    const cx = x + w / 2;
    return [
      kicker(k, x, y, w, 'Julia Marsh', { textAlignX: 'center' }),
      headline(k, x, y + u * 9, w, titleH, title, 3, 'center'),
      ...ornament(cx, y + u * 12 + titleH),
      k.text(x, y + u * 21 + titleH, w, u * 7, 'A novel', {
        textSize: 'lg',
        textItalic: true,
        textAlignX: 'center',
        textAlignY: 'middle',
      }),
    ];
  };
  const wordsH = (titleH: number) => u * 28 + titleH;
  const foot = (x: number, w: number): Element[] => [
    k.text(x, H - pad - u * 18, w, u * 9, blurb, {
      textItalic: true,
      textAlignX: 'center',
      textAlignY: 'bottom',
    }),
    kicker(k, x, H - pad - u * KICKER_H, w, 'Lantern Press', { textAlignX: 'center' }),
  ];
  if (k.wide) {
    const half = W / 2;
    const d = Math.min(half - pad * 1.5, H - 2 * pad);
    const colX = half + u * 2;
    const colW = W - pad - colX;
    const titleH = Math.min(u * 36, H - 2 * pad - u * 50);
    return [
      ...doubleFrame(k),
      { ...k.image(pad + (half - pad - d) / 2, (H - d) / 2, d, d), borderRadius: 'full' },
      ...words(colX, pad, colW, titleH),
      ...foot(colX, colW),
    ];
  }
  const innerW = W - 2 * pad;
  const titleH = Math.min(u * 36, H * 0.24);
  const imgY = pad + wordsH(titleH) + u * 4;
  const imgBottom = H - pad - u * 22;
  const d = Math.min(innerW * 0.8, imgBottom - imgY);
  // Without room for the artwork the words sit centred above the blurb.
  const wordsY = d > u * 16 ? pad : pad + Math.max(0, (imgBottom - pad - wordsH(titleH)) / 2);
  const els: Element[] = [...doubleFrame(k), ...words(pad, wordsY, innerW, titleH)];
  if (d > u * 16) {
    els.push({
      ...k.image((W - d) / 2, imgY + (imgBottom - imgY - d) / 2, d, d),
      borderRadius: 'full',
    });
  }
  return [...els, ...foot(pad, innerW)];
}

const IN_THIS_ISSUE = [
  ['02', 'Meet the new support team'],
  ['03', 'What we shipped in September'],
  ['04', 'Your questions, answered'],
  ['05', 'Dates for the diary'],
] as const;

// "In this issue": a tinted panel, a page number beside each story.
function inThisIssue(k: Kit, x: number, y: number, w: number, h: number, cols: number): Element[] {
  const { u } = k;
  const pad = u * 5;
  const rows = IN_THIS_ISSUE.length / cols;
  const listY = y + pad + u * 8;
  const cellW = (w - 2 * pad - u * 6 * (cols - 1)) / cols;
  const rowH = (y + h - pad - listY) / rows;
  const numW = u * 9;
  return [
    panel(k, x, y, w, h),
    kicker(k, x + pad, y + pad, w - 2 * pad, 'In this issue'),
    ...IN_THIS_ISSUE.flatMap(([page, line], i) => {
      const cx = x + pad + (i % cols) * (cellW + u * 6);
      const cy = listY + Math.floor(i / cols) * rowH;
      return [
        k.text(cx, cy, numW, Math.min(rowH, u * 12), page, {
          textSize: 'lg',
          textBold: true,
          textAlignY: 'middle',
        }),
        k.text(cx + numW, cy, cellW - numW, Math.min(rowH, u * 12), line, {
          textAlignY: 'middle',
        }),
      ];
    }),
  ];
}

function newsletterFront(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const mastH = Math.min(u * 20, H * 0.15);
  const headlineText = 'Search is now three times faster';
  const standfirst =
    'A rebuilt index means results land before you finish typing. Here is how we did it.';
  const top = [
    kicker(k, 0, 0, W * 0.5, 'Vol. 3 · No. 42'),
    kicker(k, W * 0.5, 0, W * 0.5, '16 October 2026', { textAlignX: 'right' }),
    k.shape('banner', 0, u * 7, W, mastH, {
      label: 'The Weekly Loop',
      pageSubtitle: 'News and notes from the product team',
      textSize: 'lg',
    }),
  ];
  const bodyY = u * 7 + mastH + u * 6;
  if (k.wide) {
    const sideW = W * 0.3;
    const mainW = W - sideW - u * 6;
    const textW = mainW * 0.42;
    const imgX = textW + u * 5;
    const bodyH = H - bodyY;
    return [
      ...top,
      kicker(k, 0, bodyY, textW, 'Lead story'),
      headline(k, 0, bodyY + u * 7, textW, u * 26, headlineText, 3),
      k.text(0, bodyY + u * 36, textW, bodyH - u * 36, standfirst, {
        textSize: 'lg',
      }),
      k.image(imgX, bodyY, mainW - imgX, bodyH),
      ...inThisIssue(k, W - sideW, bodyY, sideW, bodyH, 1),
    ];
  }
  // Tall: the lead story's headline and standfirst, its picture, "In this issue" two by two.
  const issueH = u * 40;
  const issueY = H - issueH;
  const headH = u * 20;
  const standY = bodyY + u * 7 + headH + u * 2;
  const standH = u * 14;
  const imgY = standY + standH + u * 4;
  const els: Element[] = [
    ...top,
    kicker(k, 0, bodyY, W, 'Lead story'),
    headline(k, 0, bodyY + u * 7, W, headH, headlineText, 2),
  ];
  // The standfirst where the page has room for it above In this issue.
  if (standY + standH <= issueY - u * 4) {
    els.push(k.text(0, standY, W, standH, standfirst, { textSize: 'lg' }));
  }
  if (issueY - u * 5 - imgY > u * 14) els.push(k.image(0, imgY, W, issueY - u * 5 - imgY));
  return [...els, ...inThisIssue(k, 0, issueY, W, issueH, 2)];
}

// A certificate taller than this many times its width stacks its seal over its signatures.
const CERT_TALL_RATIO = 1.3;

function certificate(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  // Set as a landscape certificate unless the page is clearly taller than wide.
  const wide = k.wide || H < W * CERT_TALL_RATIO;
  const pad = u * 10;
  const innerW = W - 2 * pad;
  const cx = W / 2;
  const centred = { textAlignX: 'center' } as const;
  const reason =
    'For leading the Riverside clean-up and planting 1,200 trees with forty volunteers in 2026.';
  const seal = Math.min(u * 20, H * 0.16);
  // Wide: the two signatures either side of the seal. Tall: the seal on its own, the signatures
  // side by side under it.
  const sigW = wide ? Math.min(innerW * 0.34, u * 50) : (innerW - u * 6) / 2;
  const sigH = u * 16;
  const sigY = H - pad - sigH;
  const sealY = wide ? H - pad - seal : sigY - u * 4 - seal;
  // The heading: one tracked line when wide; "Certificate" set large over "of achievement" when tall.
  const headH = wide ? u * 7 : Math.min(u * 14, H * 0.1) + u * 7;
  const nameH = Math.min(u * 20, H * 0.15);
  const reasonH = wide ? u * 14 : u * 20;
  const blockH = headH + u * 4 + u * 7 + u * 3 + nameH + u * 6 + reasonH;
  const room = sealY - pad - u * 4;
  const y = pad + Math.max(0, (room - blockH) / 2);
  const presentedY = y + headH + u * 4;
  const nameY = presentedY + u * 10;
  const heading: Element[] = wide
    ? [kicker(k, pad, y, innerW, 'Certificate of achievement', { ...centred, textSize: 'lg' })]
    : [
        fitted(k, pad, y, innerW, headH - u * 7, 'CERTIFICATE', 'center', 0.08),
        kicker(k, pad, y + headH - u * KICKER_H, innerW, 'of achievement', centred),
      ];
  const signature = (x: number, name: string, role: string): Element[] => [
    k.text(x, sigY, sigW, u * 7, name, {
      textSize: 'lg',
      textItalic: true,
      ...centred,
      textAlignY: 'bottom',
    }),
    hairline(k, x, sigY + u * 8.5, sigW),
    k.text(x, sigY + u * 10, sigW, u * 6, role, { ...centred, textAlignY: 'middle' }),
  ];
  const sigInset = wide ? u * 4 : 0;
  return [
    ...doubleFrame(k),
    ...heading,
    k.text(pad, presentedY, innerW, u * 7, 'This is proudly presented to', {
      textSize: 'lg',
      textItalic: true,
      ...centred,
      textAlignY: 'middle',
    }),
    fitted(k, pad, nameY, innerW, nameH, 'Amara Okafor', 'center'),
    rule(k, cx - u * 10, nameY + nameH + u * 2, u * 20, u * 1),
    k.text(
      pad + (wide ? innerW * 0.08 : 0),
      nameY + nameH + u * 6,
      wide ? innerW * 0.84 : innerW,
      reasonH,
      reason,
      { textSize: 'lg', ...centred },
    ),
    ...signature(pad + sigInset, 'Sam Patel', 'Programme director'),
    ...iconDisc(k, cx - seal / 2, sealY, seal, 'award').els,
    ...signature(W - pad - sigInset - sigW, '14 Nov 2026', 'Date'),
  ];
}

export const buildMagazineCover = (b: LayoutBox) => magazineCover(kit(b));
export const buildBookCover = (b: LayoutBox) => bookCover(kit(b));
export const buildNewsletterFront = (b: LayoutBox) => newsletterFront(kit(b));
export const buildCertificate = (b: LayoutBox) => certificate(kit(b));
