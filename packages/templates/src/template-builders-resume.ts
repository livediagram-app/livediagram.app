// Résumé template (kind `resume`, docs/specs/007-editor/templates-by-mode.md "Illustrate
// templates"): a one-page A4 CV for a made-up product designer, Maya Lindqvist, that opens in
// Illustrate ready to export as a PDF. It follows the shape recruiters skim fastest:
//
//   - a navy header bleeding off the top with a photo slot, the name, the role and a two-by-two
//     contact block, each detail on its own glyph;
//   - a main column with a short profile and the experience as a timeline, a dot on a rail per
//     role, each with its dates and two or three achievements that carry a number;
//   - a tinted side column bleeding off the right and bottom edges with skills as chips,
//     education, languages and one human line about interests.
//
// The colours are the résumé's own and locked against the theme; the photo is an empty image
// placeholder (imageId: null), so the template ships no bytes. The words live in
// template-resume-data.ts.
//
// Pure: () -> Element[], placed on the résumé's page (resumePages) whatever centre is passed.

import { pageMargin, type Element, type IllustratePage } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { glyph, lockedFill, panel } from './template-page-design';
import { pageKits, templatePage } from './template-page-kit';
import {
  CONTACTS,
  EDUCATION,
  INTERESTS,
  LANGUAGES,
  NAME,
  PROFILE,
  ROLE,
  ROLES,
  SKILLS,
} from './template-resume-data';

const NAVY = '#1e293b';
const ACCENT = '#4f46e5';
const SOFT_ACCENT = '#a5b4fc';
const SIDE = '#eef2ff';
const INK = '#0f172a';
const MUTED = '#475569';
const PAPER = '#ffffff';

const RESUME_PAGE = templatePage(1, 'a4', 'portrait', 'Résumé', {
  fill: { kind: 'solid', color: PAPER },
});

/** The résumé's page: one A4 portrait sheet. */
export function resumePages(): IllustratePage[] {
  return [RESUME_PAGE];
}

// Where the header ends and the side column starts, in units / shares of the content box.
const HEADER_BOTTOM = 33;
const SIDE_X = 0.62;
const MAIN_W = 0.56;

// A section's small capitals heading over a short accent rule.
function sectionHead(k: Kit, x: number, y: number, w: number, label: string): Element[] {
  const { u } = k;
  return [
    k.text(x, y, w, u * 3.5, label, { textSize: 'sm', textBold: true, textColor: ACCENT }),
    panel(k, x, y + u * 4, u * 8, u * 0.6, ACCENT, { borderRadius: 'full' }),
  ];
}

// The header: navy band, photo, name, role and the contact block.
function header(k: Kit, bleed: number): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const d = u * 24;
  const textX = d + u * 6;
  const colW = (W - textX) / 2;
  return [
    panel(k, -bleed, -bleed, W + bleed * 2, u * HEADER_BOTTOM + bleed, NAVY, {
      borderRadius: 'none',
    }),
    {
      ...k.image(0, u * 1, d, d),
      borderRadius: 'full',
      aspectLocked: true,
    },
    { ...k.title(textX, 0, W - textX, u * 9, NAME), textColor: PAPER },
    k.text(textX, u * 9.5, W - textX, u * 5, ROLE, { textScale: 1.1, textColor: SOFT_ACCENT }),
    ...CONTACTS.flatMap((c, i) => {
      const x = textX + (i % 2) * colW;
      const y = u * 17 + Math.floor(i / 2) * u * 4.5;
      return [
        glyph(k, c.iconId, x, y, u * 3, SOFT_ACCENT),
        k.text(x + u * 4.5, y - u * 0.2, colW - u * 5, u * 3.5, c.text, {
          textSize: 'sm',
          textColor: '#e2e8f0',
        }),
      ];
    }),
  ];
}

// The main column: the profile, then the experience down a rail.
function main(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const w = W * MAIN_W;
  const top = u * (HEADER_BOTTOM + 5);
  const expTop = top + u * 26;
  const railX = u * 1;
  const textX = u * 5;
  const els: Element[] = [
    ...sectionHead(k, 0, top, w, 'PROFILE'),
    k.text(0, top + u * 7, w, u * 17, PROFILE, {
      textSize: 'sm',
      textScale: 1.1,
      textColor: INK,
    }),
    ...sectionHead(k, 0, expTop, w, 'EXPERIENCE'),
  ];
  let y = expTop + u * 8;
  const railTop = y + u * 1;
  ROLES.forEach((r) => {
    const bulletsH = u * 3.1 * r.lines;
    els.push(
      k.shape('circle', railX - u * 1.25, y + u * 0.6, u * 2.5, u * 2.5, {
        label: '',
        strokeWidth: 'thick',
        ...lockedFill(PAPER, ACCENT),
      }),
      k.text(textX, y, w - textX, u * 3.8, r.title, { textBold: true, textColor: INK }),
      k.text(textX, y + u * 4, w - textX, u * 3.2, `${r.company} · ${r.dates}`, {
        textSize: 'sm',
        textBold: true,
        textColor: ACCENT,
      }),
      k.text(textX, y + u * 8, w - textX, bulletsH, r.points.map((p) => `• ${p}`).join('\n'), {
        textSize: 'sm',
        textColor: MUTED,
      }),
    );
    y += u * 9.5 + bulletsH;
  });
  // The rail runs behind the dots, from the first to the last.
  els.splice(
    els.length - ROLES.length * 4,
    0,
    panel(k, railX - u * 0.25, railTop, u * 0.5, y - railTop - u * 10, '#c7d2fe', {
      borderRadius: 'full',
    }),
  );
  return els;
}

// The side column: skills as chips flowed into rows, then education, languages and interests.
function side(k: Kit, bleed: number): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const x0 = W * SIDE_X;
  const pad = u * 4;
  const x = x0 + pad;
  const w = W - x;
  const top = u * HEADER_BOTTOM;
  const els: Element[] = [
    panel(k, x0, top, W - x0 + bleed, H - top + bleed, SIDE, { borderRadius: 'none' }),
    ...sectionHead(k, x, top + u * 5, w, 'SKILLS'),
  ];
  // Chips, measured from their labels, wrapping to a new row when the next would overflow.
  const chipH = u * 4.6;
  const gap = u * 1.2;
  let cx = 0;
  let cy = top + u * 12;
  for (const s of SKILLS) {
    const cw = s.length * u * 1.08 + u * 3.5;
    if (cx > 0 && cx + cw > w) {
      cx = 0;
      cy += chipH + gap;
    }
    els.push(
      k.shape('stadium', x + cx, cy, cw, chipH, {
        label: s,
        textSize: 'sm',
        textBold: true,
        textColor: ACCENT,
        padding: 'none',
        ...lockedFill(PAPER, '#c7d2fe'),
      }),
    );
    cx += cw + gap;
  }
  let y = cy + chipH + u * 7;
  els.push(...sectionHead(k, x, y, w, 'EDUCATION'));
  y += u * 7;
  for (const e of EDUCATION) {
    els.push(
      k.text(x, y, w, u * 3.6, e.course, { textSize: 'sm', textBold: true, textColor: INK }),
      k.text(x, y + u * 3.6, w, u * 6.4, `${e.school} · ${e.year}`, {
        textSize: 'sm',
        textColor: MUTED,
      }),
    );
    y += u * 11;
  }
  y += u * 2;
  els.push(...sectionHead(k, x, y, w, 'LANGUAGES'));
  y += u * 7;
  for (const [language, level] of LANGUAGES) {
    els.push(
      k.text(x, y, w * 0.5, u * 3.6, language, { textSize: 'sm', textBold: true, textColor: INK }),
      k.text(x + w * 0.45, y, w * 0.55, u * 3.6, level, {
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'right',
      }),
    );
    y += u * 4.6;
  }
  y += u * 5;
  els.push(
    ...sectionHead(k, x, y, w, 'INTERESTS'),
    k.text(x, y + u * 7, w, u * 10, INTERESTS, { textSize: 'sm', textColor: MUTED }),
  );
  return els;
}

export function buildResume(): Element[] {
  const [k] = pageKits(resumePages());
  const bleed = pageMargin(RESUME_PAGE);
  return [...header(k!, bleed), ...side(k!, bleed), ...main(k!)];
}
