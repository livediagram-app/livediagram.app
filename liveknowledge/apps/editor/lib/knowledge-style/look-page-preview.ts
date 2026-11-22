// A look's card (docs/specs/030-knowledgebase/page-surface.md "Looks"): a small page of writing drawn in the look,
// never a diagram. A title, a heading, two lines, a link, a quote and a small table, set in the look's typeface and
// coloured as the article style machinery colours a page (lib/article/article-style-vars.ts): the ink for the
// viewer's ground, the theme's accent held legible on it, headings in the accent, a rule under them when the style
// asks for one. Pure markup, built from constants and the catalogue: nothing a person typed reaches it.
import {
  knowledgeArticleStyle,
  legibleOn,
  resolveArticleStyle,
  resolveFontStack,
  type Appearance,
  type KnowledgeStyle,
} from '@liveknowledge/document';
import { getResolvedAppearance } from '@liveknowledge/ui';
import { PAGE_GROUND } from '@/lib/view-backdrop';
import { knowledgeDarkGround, knowledgeWritingAccent } from './knowledge-accent';

const W = 220;
const H = 84;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** The colours a page of writing is drawn in for a style and an appearance. */
export function previewInks(
  style: Pick<KnowledgeStyle, 'theme' | 'accent'>,
  appearance: Appearance,
): { paper: string; ink: string; muted: string; accent: string; rule: string } {
  const dark = appearance === 'dark';
  // The ground the look's own pages stand on: white, and in the dark the look's theme's own dark surface.
  const paper = dark ? knowledgeDarkGround(style.theme) : PAGE_GROUND.light;
  return {
    paper,
    ink: dark ? '#e2e8f0' : '#1e293b',
    muted: dark ? '#94a3b8' : '#64748b',
    // As the page holds it: 4.5:1 on the ground (lib/article/article-style-vars.ts).
    accent: legibleOn(knowledgeWritingAccent(style), paper, 4.5),
    rule: dark ? 'rgb(255 255 255 / 0.22)' : 'rgb(15 23 42 / 0.16)',
  };
}

/** The card's markup and the paper under it. */
export function lookPagePreview(
  style: KnowledgeStyle,
  appearance: Appearance = getResolvedAppearance(),
): { markup: string; paper: string } {
  const r = resolveArticleStyle(knowledgeArticleStyle(style));
  const c = previewInks(style, appearance);
  const heading = esc(resolveFontStack(r.headingFont) ?? 'system-ui, sans-serif');
  const body = esc(resolveFontStack(r.bodyFont) ?? 'system-ui, sans-serif');
  const ruled = r.rules === 'headings';
  const tableX = 138;
  const cell = (row: number, col: number, text: string, bold: boolean) =>
    `<text x="${tableX + 5 + col * 35}" y="${37 + row * 12}" font-family="${body}" font-size="5.5" ${
      bold ? `font-weight="600" fill="${c.accent}"` : `fill="${c.ink}"`
    }>${text}</text>`;
  const markup = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">`,
    `<rect width="${W}" height="${H}" fill="${c.paper}"/>`,
    // The title, in the ink, and the heading in the accent.
    `<text x="12" y="20" font-family="${heading}" font-size="13" font-weight="700" letter-spacing="-0.2" fill="${c.ink}">Team Handbook</text>`,
    `<text x="12" y="35" font-family="${heading}" font-size="9" font-weight="600" fill="${c.accent}">How We Work</text>`,
    ruled ? `<rect x="12" y="38" width="114" height="0.8" fill="${c.accent}"/>` : '',
    // Two lines, the second ending in a link.
    `<text x="12" y="${ruled ? 48 : 46}" font-family="${body}" font-size="6.5" fill="${c.ink}">Write it down once, where</text>`,
    `<text x="12" y="${ruled ? 57 : 55}" font-family="${body}" font-size="6.5" fill="${c.ink}">everyone looks. <tspan fill="${c.accent}" text-decoration="underline">Read more</tspan></text>`,
    // A quote: the accent's bar, italic words.
    `<rect x="12" y="${ruled ? 63 : 62}" width="1.6" height="13" rx="0.8" fill="${c.accent}"/>`,
    `<text x="18" y="${ruled ? 72 : 71}" font-family="${body}" font-size="7" font-style="italic" fill="${c.ink}">Clear beats clever.</text>`,
    // A small table: a header row tinted with the accent, two rows under it.
    `<rect x="${tableX}" y="29" width="70" height="12" rx="2" fill="${c.accent}" fill-opacity="0.12"/>`,
    `<rect x="${tableX}" y="29" width="70" height="36" rx="2" fill="none" stroke="${c.rule}" stroke-width="0.8"/>`,
    `<line x1="${tableX}" y1="41" x2="${tableX + 70}" y2="41" stroke="${c.rule}" stroke-width="0.8"/>`,
    `<line x1="${tableX}" y1="53" x2="${tableX + 70}" y2="53" stroke="${c.rule}" stroke-width="0.8"/>`,
    `<line x1="${tableX + 35}" y1="29" x2="${tableX + 35}" y2="65" stroke="${c.rule}" stroke-width="0.8"/>`,
    cell(0, 0, 'Team', true),
    cell(0, 1, 'Owner', true),
    cell(1, 0, 'Docs', false),
    cell(1, 1, 'Maya', false),
    cell(2, 0, 'Support', false),
    cell(2, 1, 'Jon', false),
    '</svg>',
  ].join('');
  return { markup, paper: c.paper };
}
