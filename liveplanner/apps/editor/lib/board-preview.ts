// The Tab Style Finish and Text panels' preview on a plan's tab (docs/specs/011-theme/canvas-and-theme-dialog.md "One
// dialog, this editor's profile"): a small board, three columns of cards under their names, drawn by the same
// renderer as the exports and the look cards (lib/look-preview.ts's sample board), in the tab's theme, finish, font and
// the size new text takes. As on a real board (components/plan/column-tones.ts), a multi-colour theme gives each
// column a bar in the next of its colours while the cards stay alike; a single-colour theme draws every bar in its
// own ink. Fixed ids, so the Sketch wobble is the same every time.
import {
  renderElementsToSvg,
  type Element,
  type Finish,
  type ShapeElement,
  type Tab,
  type TextSize,
} from '@liveplanner/project';
import { LOOK_PREVIEW_ELEMENTS } from '@/lib/look-preview';
import { withThemeApplied } from '@/lib/tab-theme-apply';
import { getTheme } from '@/lib/themes';

const BAR_H = 5;
// The bar's ink on a theme that leaves boxes their type default (Default): the shape's default outline.
const DEFAULT_BAR = '#64748b';
// The bar sits just under the column's name, above its first card.
const BAR_Y = 28;

const isCard = (el: Element): el is ShapeElement => el.type === 'shape';

/** The sample board drawn in `finish` on the tab's background, in its theme, font and new-text size, as SVG. */
export function boardPreviewSvg(
  finish: Finish,
  tab: { background: string; theme: string; font?: string; textSize?: TextSize },
): string {
  const sample = tab.textSize
    ? LOOK_PREVIEW_ELEMENTS.map((el) => ({ ...el, textSize: tab.textSize }))
    : [...LOOK_PREVIEW_ELEMENTS];
  const themed = withThemeApplied(
    { id: 'board-preview', name: '', elements: sample },
    tab.theme,
  ).elements;
  // Every card in the first card's colours: a board's cards are alike whatever the theme.
  const first = themed.find(isCard)!;
  const theme = getTheme(tab.theme);
  const branches = theme.palette;
  const ink = first.strokeColor ?? theme.elementStroke ?? DEFAULT_BAR;
  const multi = !!branches && branches.length > 1;
  const elements: Element[] = [];
  let column = -1;
  for (const el of themed) {
    if (el.type === 'text') {
      column += 1;
      const bar: ShapeElement = {
        id: `board-preview-bar-${column}`,
        type: 'shape',
        shape: 'square',
        x: el.x,
        y: BAR_Y,
        width: el.width,
        height: BAR_H,
        label: '',
        fillColor: multi ? branches[column % branches.length]!.stroke : ink,
        strokeColor: 'transparent',
      };
      elements.push(el, bar);
      continue;
    }
    // The rest are the cards (the sample is names and cards only).
    elements.push({
      ...el,
      fillColor: first.fillColor,
      strokeColor: first.strokeColor,
      textColor: first.textColor,
    } as ShapeElement);
  }
  const previewTab = {
    id: 'board-preview',
    name: 'Board preview',
    elements,
    finish,
    backgroundColor: tab.background,
    theme: tab.theme,
    ...(tab.font ? { font: tab.font } : {}),
  } as Tab;
  return renderElementsToSvg(previewTab, { padding: 16 });
}
