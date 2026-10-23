// Measures a text box's text with the real DOM, so the box hugs the words exactly in whatever
// face and size they are drawn in.
//
// One hidden block, kept off-screen under <body>, is laid out the way the label and its editor
// lay their text out: the single-line label typography (medium weight, tight leading), pre-wrap
// with long words breaking. A committed label is laid in as its runs, each a span in the run's
// own style; a live edit as a copy of the editor's own nodes, so whatever the browser left in
// the editor (a held-open empty line, a stray break) measures exactly as it shows. It is outside
// the canvas's zoom transform, so what it reports is in canvas px at any zoom.

import {
  elementFontId,
  type BoxedElement,
  resolveFontStack,
  runsFromPlainText,
  type Finish,
  type ShapeElement,
  type TextElement,
  type TextRun,
} from '@livedesign/design';
import { applyCss } from '@/components/rich-text/rich-text-format';
import { effectiveRunStyle, labelRunPx } from '@/components/canvas/label-style';
import { TEXT_HUG_LEADING, textHugFontPx, type MeasureTextBlock } from '@/lib/text-hug';

const MEASURER_ATTR = 'data-text-hug-measurer';

function measurer(): HTMLDivElement {
  const found = document.querySelector<HTMLDivElement>(`[${MEASURER_ATTR}]`);
  if (found) return found;
  const node = document.createElement('div');
  node.setAttribute(MEASURER_ATTR, '');
  node.setAttribute('aria-hidden', 'true');
  applyCss(node.style, {
    position: 'absolute',
    left: '-100000px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    fontWeight: 500,
    lineHeight: String(TEXT_HUG_LEADING),
  });
  document.body.appendChild(node);
  return node;
}

// The runs a label draws: its rich runs when it has them, else its plain text as one run.
export function labelRuns(el: BoxedElement): TextRun[] {
  const rich = (el as { richText?: TextRun[] }).richText;
  return rich && rich.length > 0 ? rich : runsFromPlainText(el.label ?? '');
}

// A measure for this element's text: its runs as the label draws them, or the live editor's
// content as it shows, where an empty editor still holds one line for the caret.
export function measureTextHug(
  el: TextElement,
  content: TextRun[] | HTMLElement,
  fontFamily: string | undefined,
): MeasureTextBlock {
  return measureLabelBlock(el, content, fontFamily, textHugFontPx(el), el.textScale ?? 1);
}

// The same measure for any boxed element's single-line-style label (medium weight, tight
// leading) drawn at `fontPx`, its runs' own sizes scaled by `runScale`. Wordmark fields are a
// text box's; on any other element they read as unset.
export function measureLabelBlock(
  el: BoxedElement,
  content: TextRun[] | HTMLElement,
  fontFamily: string | undefined,
  fontPx: number,
  runScale = 1,
): MeasureTextBlock {
  const word = el as Partial<Pick<TextElement, 'letterSpacing' | 'fontWeight' | 'textCase'>>;
  return (width, fixed) => {
    const node = measurer();
    const runPx = labelRunPx(false, runScale);
    node.style.fontSize = `${fontPx}px`;
    node.style.fontFamily = fontFamily ?? '';
    node.style.width = fixed ? `${width}px` : 'max-content';
    node.style.maxWidth = `${width}px`;
    // Wordmark type (docs/specs/007-editor/logo-pages.md): tracked, weighted and cased text hugs
    // the width it draws at. Reset every time: the measurer is shared.
    node.style.letterSpacing = word.letterSpacing ? `${word.letterSpacing}em` : '';
    node.style.fontWeight = String(word.fontWeight ?? 500);
    node.style.textTransform =
      word.textCase === 'upper' ? 'uppercase' : word.textCase === 'lower' ? 'lowercase' : '';
    if (Array.isArray(content)) {
      node.replaceChildren(
        ...content.map((run) => {
          const span = document.createElement('span');
          applyCss(span.style, effectiveRunStyle(run, el, runPx));
          span.textContent = run.text;
          return span;
        }),
      );
    } else if (content.textContent) {
      node.replaceChildren(...[...content.childNodes].map((child) => child.cloneNode(true)));
    } else {
      node.replaceChildren('\u200b');
    }
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  };
}

// The face a label is drawn in outside an edit: its own, or else the tab's (the fallback the
// canvas uses, docs/specs/004-interface-design/fonts.md), or the handwriting font under the
// Sketch finish (docs/specs/008-canvas/finish.md).
function drawnLabelFont(
  el: TextElement | ShapeElement,
  tabFont: string | undefined,
  tabFinish: Finish | undefined,
): string | undefined {
  return (
    resolveFontStack(el.font) ??
    resolveFontStack(elementFontId({ finish: el.finish }, tabFont, tabFinish))
  );
}

// The measure for a text box as the canvas draws it, outside an edit: its own runs in the face
// it is drawn in.
export function measureDrawnText(
  tabFont: string | undefined,
  tabFinish?: Finish,
): (el: TextElement) => MeasureTextBlock {
  return (el) => measureTextHug(el, labelRuns(el), drawnLabelFont(el, tabFont, tabFinish));
}
