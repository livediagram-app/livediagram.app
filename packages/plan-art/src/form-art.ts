// A Form tab's picture (docs/specs/030-forms/forms.md "Agents": read_form's image; blueprint §15): the form as a
// respondent sees it on its tab's look, every section one after another as Preview scrolls them: the cover band, the
// heading card, each question's card with its answer control, and the button that ends it. Pure markup, light half.
import { svgText, svgWrapLines, type FormLook } from '@livediagram/document';
import {
  DROPDOWN_AFTER,
  RATING_SCALE_DEFAULT,
  promptOf,
  type FormDefinition,
  type FormQuestion,
} from '@livediagram/forms';
import { xmlEscape } from '@livediagram/icons';
import { box, line, r2, type Rect } from './plan-art-kit';

// The builder's column (640) inside its gutters, and the cover's height on a desktop.
export const FORM_ART_WIDTH = 720;
const COLUMN = 640;
const GUTTER = (FORM_ART_WIDTH - COLUMN) / 2;
const COVER_H = 160;
const BAND_H = 10;
const PAD = 24;
const GAP = 12;
// A form past this height is cut off with a line saying how many questions were left out: the MCP draws a preview at
// most 2,048 px on its longest side (render.ts PREVIEW_MAX_SIDE_PX), so a taller picture would shrink past reading.
export const FORM_ART_HEIGHT_MAX = 2048;

const INK = '#0f172a';
const MUTED = '#64748b';
const RULE = '#cbd5e1';
const FIELD = '#f8fafc';
const CARD = '#ffffff';
const REQUIRED = '#dc2626';

type Draw = {
  markup: string[];
  y: number;
  accent: string;
  onAccent: string;
  rx: number;
  font: string;
};

const wrap = (text: string, width: number, size: number, max = 6) =>
  svgWrapLines(text, width, size, max);

function textBlock(
  d: Draw,
  x: number,
  text: string,
  o: { size: number; color: string; weight?: number; width: number; max?: number },
) {
  const lines = wrap(text, o.width, o.size, o.max);
  const lh = Math.round(o.size * 1.4);
  for (const l of lines) {
    d.y += lh;
    d.markup.push(
      svgText(x, d.y - Math.round(o.size * 0.35), l, {
        size: o.size,
        color: o.color,
        ...(o.weight ? { weight: o.weight } : {}),
      }),
    );
  }
  return lines.length * lh;
}

const OPTION_H = 28;
const INPUT_H = 40;

// How tall a question's answer control draws.
function controlHeight(q: FormQuestion): number {
  switch (q.type) {
    case 'paragraph':
      return 88;
    case 'single':
      return q.dropdown || (q.options?.length ?? 0) > DROPDOWN_AFTER
        ? INPUT_H
        : optionRows(q) * OPTION_H;
    case 'multi':
      return optionRows(q) * OPTION_H;
    case 'rating':
      return q.style === 'numbers' && (q.lowLabel || q.highLabel) ? 60 : 40;
    case 'checkbox':
      return 0;
    default:
      return INPUT_H;
  }
}

const optionRows = (q: FormQuestion) => (q.options?.length ?? 0) + (q.other ? 1 : 0);

const HINTS: Partial<Record<FormQuestion['type'], string>> = {
  short: 'Your answer',
  paragraph: 'Your answer',
  number: 'A number',
  email: 'name@example.com',
  link: 'https://',
  date: 'dd/mm/yyyy',
};

function star(cx: number, cy: number, r: number, fill: string, stroke: string): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const len = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${r2(cx + Math.cos(rad) * len)},${r2(cy + Math.sin(rad) * len)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${xmlEscape(stroke)}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

function drawControl(d: Draw, q: FormQuestion, x: number, width: number): void {
  const top = d.y;
  const m = d.markup;
  switch (q.type) {
    case 'single':
    case 'multi': {
      const options = [...(q.options ?? []), ...(q.other ? ['Other:'] : [])];
      if (q.type === 'single' && (q.dropdown || options.length > DROPDOWN_AFTER)) {
        m.push(
          box(
            { x, y: top, width: Math.min(width, 280), height: INPUT_H },
            { fill: FIELD, stroke: RULE, rx: d.rx },
          ),
        );
        m.push(line(x + 12, top + 25, 'Choose', { size: 14, color: MUTED }));
        m.push(
          `<path d="M${x + Math.min(width, 280) - 22} ${top + 17} l5 6 l5 -6" fill="none" stroke="${MUTED}" stroke-width="1.6"/>`,
        );
        break;
      }
      options.forEach((o, i) => {
        const cy = top + i * OPTION_H + OPTION_H / 2;
        m.push(
          q.type === 'single'
            ? `<circle cx="${x + 9}" cy="${cy}" r="8" fill="${CARD}" stroke="${MUTED}" stroke-width="1.5"/>`
            : box(
                { x: x + 1, y: cy - 8, width: 16, height: 16 },
                { fill: CARD, stroke: MUTED, rx: 3, strokeWidth: 1.5 },
              ),
        );
        m.push(line(x + 28, cy + 5, o, { size: 14, color: INK, width: width - 28 }));
        if (o === 'Other:')
          m.push(
            `<line x1="${x + 80}" y1="${cy + 6}" x2="${x + Math.min(width, 320)}" y2="${cy + 6}" stroke="${RULE}"/>`,
          );
      });
      break;
    }
    case 'rating': {
      const scale = q.scale ?? RATING_SCALE_DEFAULT;
      if (q.style === 'numbers') {
        const w = Math.min(40, (width - (scale - 1) * 6) / scale);
        for (let i = 0; i < scale; i += 1) {
          const bx = x + i * (w + 6);
          m.push(
            box({ x: bx, y: top, width: w, height: 36 }, { fill: CARD, stroke: RULE, rx: d.rx }),
          );
          m.push(
            line(bx + w / 2, top + 23, String(i + 1), { size: 14, color: INK, anchor: 'middle' }),
          );
        }
        if (q.lowLabel)
          m.push(line(x, top + 54, q.lowLabel, { size: 12, color: MUTED, width: width / 2 }));
        if (q.highLabel)
          m.push(
            line(x + scale * (w + 6) - 6, top + 54, q.highLabel, {
              size: 12,
              color: MUTED,
              anchor: 'end',
              width: width / 2,
            }),
          );
      } else
        for (let i = 0; i < scale; i += 1)
          m.push(star(x + 16 + i * 36, top + 20, 14, 'none', MUTED));
      break;
    }
    case 'checkbox':
      break;
    default: {
      const h = controlHeight(q);
      m.push(box({ x, y: top, width, height: h }, { fill: FIELD, stroke: RULE, rx: d.rx }));
      m.push(
        line(x + 12, top + 25, q.placeholder ?? HINTS[q.type] ?? '', {
          size: 14,
          color: MUTED,
          width: width - 24,
        }),
      );
    }
  }
  d.y = top + controlHeight(q);
}

function drawQuestion(d: Draw, q: FormQuestion): void {
  const x = GUTTER;
  const inner = COLUMN - PAD * 2;
  const top = d.y;
  const body: Draw = { ...d, markup: [], y: top + PAD - 6 };
  if (q.type === 'checkbox') {
    body.markup.push(
      box(
        { x: x + PAD, y: body.y + 6, width: 18, height: 18 },
        { fill: CARD, stroke: MUTED, rx: 3, strokeWidth: 1.5 },
      ),
    );
    textBlock(body, x + PAD + 28, promptOf(q) + (q.required ? ' *' : ''), {
      size: 16,
      color: INK,
      weight: 500,
      width: inner - 28,
    });
  } else {
    const prompt = promptOf(q);
    const lines = wrap(prompt, inner - 12, 16, 4);
    for (const [i, l] of lines.entries()) {
      body.y += 22;
      // The required mark rides the prompt's last line, so it sits right after the words whatever their width.
      const mark =
        q.required && i === lines.length - 1 ? `<tspan fill="${REQUIRED}"> *</tspan>` : '';
      body.markup.push(
        `<text x="${x + PAD}" y="${body.y - 5}" font-size="16" font-weight="500" fill="${INK}">${xmlEscape(l)}${mark}</text>`,
      );
    }
  }
  if (q.help) {
    body.y += 2;
    textBlock(body, x + PAD, q.help, { size: 13, color: MUTED, width: inner, max: 3 });
  }
  if (q.type !== 'checkbox') {
    body.y += 12;
    drawControl(body, q, x + PAD, inner);
  }
  const height = body.y + PAD - top;
  d.markup.push(box({ x, y: top, width: COLUMN, height }, { fill: CARD, stroke: RULE, rx: d.rx }));
  d.markup.push(...body.markup);
  d.y = top + height + GAP;
}

function headerCard(
  d: Draw,
  title: string,
  description: string | undefined,
  o: { heading: boolean; label?: string },
): void {
  const x = GUTTER;
  const top = d.y;
  const body: Draw = { ...d, markup: [], y: top + PAD - 8 };
  if (o.label) {
    body.y += 16;
    body.markup.push(
      svgText(x + PAD, body.y - 2, o.label, { size: 12, color: MUTED, weight: 600 }),
    );
  }
  textBlock(body, x + PAD, title, {
    size: o.heading ? 28 : 20,
    color: INK,
    weight: 700,
    width: COLUMN - PAD * 2,
    max: 3,
  });
  if (description) {
    body.y += 6;
    textBlock(body, x + PAD, description, {
      size: 14,
      color: MUTED,
      width: COLUMN - PAD * 2,
      max: 8,
    });
  }
  const height = body.y + PAD - top;
  d.markup.push(box({ x, y: top, width: COLUMN, height }, { fill: CARD, stroke: RULE, rx: d.rx }));
  // The accent bar down the card's left edge, as the builder draws a selected card.
  d.markup.push(box({ x, y: top, width: 6, height }, { fill: d.accent, rx: d.rx ? 3 : 0 }));
  d.markup.push(...body.markup);
  d.y = top + height + GAP;
}

function coverMarkup(form: FormDefinition, accent: string): { markup: string; height: number } {
  const fill = form.cover?.fill;
  if (!fill)
    return {
      markup: box({ x: GUTTER, y: 24, width: COLUMN, height: BAND_H }, { fill: accent, rx: 4 }),
      height: BAND_H,
    };
  let paint = fill.kind === 'solid' ? fill.color : 'url(#form-cover)';
  let defs = '';
  if (fill.kind === 'gradient') {
    const rad = ((fill.angle - 90) * Math.PI) / 180;
    const dx = Math.cos(rad) / 2;
    const dy = Math.sin(rad) / 2;
    defs =
      `<defs><linearGradient id="form-cover" x1="${r2(0.5 - dx)}" y1="${r2(0.5 - dy)}" x2="${r2(0.5 + dx)}" y2="${r2(0.5 + dy)}">` +
      `<stop offset="0" stop-color="${xmlEscape(fill.from)}"/><stop offset="1" stop-color="${xmlEscape(fill.to)}"/></linearGradient></defs>`;
  }
  paint = xmlEscape(paint);
  return {
    markup: `${defs}<rect x="${GUTTER}" y="24" width="${COLUMN}" height="${COVER_H}" rx="12" fill="${paint}"/>`,
    height: COVER_H,
  };
}

export interface FormArt {
  svg: string;
  width: number;
  height: number;
}

// The form drawn on its look: every section in order, each later one under a "Section n of m" card.
export function formArt(form: FormDefinition, look: FormLook, fontStack?: string): FormArt {
  const accent = look.accent.light;
  const rx = look.finish === 'professional' ? 2 : 10;
  const cover = coverMarkup(form, accent);
  const d: Draw = {
    markup: [cover.markup],
    y: 24 + cover.height + GAP,
    accent,
    onAccent: look.onAccent.light,
    rx,
    font: fontStack ?? 'system-ui, sans-serif',
  };
  const total = form.sections.length;
  let cut = 0;
  form.sections.forEach((s, i) => {
    if (i === 0) headerCard(d, form.heading, form.description, { heading: true });
    else
      headerCard(d, s.title || 'Untitled Section', s.description, {
        heading: false,
        label: `Section ${i + 1} of ${total}`,
      });
    for (const q of s.questions) {
      if (d.y > FORM_ART_HEIGHT_MAX - 200) {
        cut += 1;
        continue;
      }
      drawQuestion(d, q);
    }
  });
  if (cut) {
    d.y += 8;
    d.markup.push(
      line(FORM_ART_WIDTH / 2, d.y + 14, `${cut} more question${cut === 1 ? '' : 's'} not drawn`, {
        size: 13,
        color: MUTED,
        anchor: 'middle',
      }),
    );
    d.y += 28;
  }
  const button: Rect = { x: GUTTER, y: d.y + 4, width: 96, height: 40 };
  d.markup.push(box(button, { fill: accent, rx }));
  d.markup.push(
    line(button.x + 48, button.y + 25, 'Submit', {
      size: 14,
      weight: 600,
      color: look.onAccent.light,
      anchor: 'middle',
    }),
  );
  const height = Math.round(button.y + button.height + 32);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${FORM_ART_WIDTH}" height="${height}" viewBox="0 0 ${FORM_ART_WIDTH} ${height}">` +
    `<rect width="100%" height="100%" fill="${xmlEscape(look.backdrop.light)}"/>` +
    `<g font-family="${xmlEscape(d.font)}">${d.markup.join('')}</g></svg>`;
  return { svg, width: FORM_ART_WIDTH, height };
}
