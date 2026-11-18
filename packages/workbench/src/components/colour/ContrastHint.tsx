'use client';

// A text colour picker's readability row (each product's docs/specs/004-interface-design/colour-picker.md "Reading on
// its ground"): under the swatches, kept at one height for as long as the picker is open, so the swatches never move
// under the pointer and the popover opens tall enough to show it. While the colour judged is under its WCAG target
// where the text sits: the colour on its ground as a small Aa tile, what falls short ("1.9:1, aim for 4.5:1"), and Use
// with the nearest shade of the same hue that passes. While it reads, a quiet line says so. A hint, never a block: the
// status region is always there (so screen readers hear a shortfall arrive) and holds only the shortfall.
import { Tooltip } from '@liveworkspace/ui';
import { canvasSurface, contrastRatio } from '@liveworkspace/element-model/colour-math';
import type { TextGround } from '@liveworkspace/element-model/text-contrast';
import { judgeText, type TextJudgement } from '@liveworkspace/element-model/text-contrast-judge';
import type { TextContrastProbe } from '@liveworkspace/element-model/text-contrast-probe';
import { onMouseHover } from '../primitives/hover-preview';

const GROUND_WORDS: Record<TextGround['on'], string> = {
  page: 'on this page',
  canvas: 'on the canvas',
  shape: 'on its fill',
  card: 'on the shape behind',
  cell: 'on its cell',
};

// The row's one height: three lines of the hint's text (two of what it reads on, one of the ratio), inside its padding
// and border, the tallest it draws.
export const CONTRAST_ROW_PX = 60;

// One decimal, never rounded up onto the target: 4.47 reads 4.4, so it never shows "4.5:1" short of 4.5.
const ratioText = (r: number) => `${Math.floor(r * 10) / 10}:1`;

// Where it was judged: the one ground, the page as exported on a dark canvas, the canvas as saved when it is seen in
// the other appearance, or how many of several.
function whereWords(j: TextJudgement): string {
  if (j.of > 1) return j.passes ? `for all ${j.of}` : `for ${j.failing} of ${j.of}`;
  if (!j.exported) return GROUND_WORDS[j.on];
  return j.on === 'canvas' ? `on the ${canvasSurface(j.tone)} canvas` : 'on the exported page';
}

export function ContrastHint({
  probes,
  judged,
  onUse,
  onArrive,
}: {
  // Every ground the text sits on (one element, or several: the worst counts).
  probes: readonly TextContrastProbe[];
  // The swatch id judged, or null for the colour in force.
  judged: string | null;
  onUse: (hex: string) => void;
  // The mouse reaching the row, on its way to Use (useJudgedSwatch's `arrive`).
  onArrive?: () => void;
}) {
  const j = judgeText(probes, judged);
  const short = j && !j.passes ? j : null;
  const where = j ? whereWords(j) : '';
  // Further from black than the colour judged: a lighter shade.
  const way =
    short?.suggestion &&
    contrastRatio(short.suggestion, '#000000') > contrastRatio(short.colour, '#000000')
      ? 'lighter'
      : 'darker';
  const useWhere = short && short.of > 1 ? `on all ${short.of}` : where;
  const useLabel = short?.suggestion
    ? `Use ${short.suggestion}, a ${way} shade that reads ${useWhere}`
    : '';
  return (
    <div
      data-contrast-row=""
      className="grid *:col-start-1 *:row-start-1"
      style={{ height: CONTRAST_ROW_PX }}
      onPointerEnter={onArrive ? onMouseHover(onArrive) : undefined}
    >
      <div role="status" data-testid="contrast-hint">
        {short ? (
          <div className="flex h-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/60">
            <AaTile colour={short.colour} tone={short.tone} />
            <p className="min-w-0 flex-1 text-xs leading-tight text-slate-700 dark:text-slate-200">
              <span className="block font-medium">Hard to read {where}</span>
              <span className="block tabular-nums text-slate-600 dark:text-slate-300">
                {short.of > 1 ? 'Worst ' : ''}
                {ratioText(short.ratio)}, aim for {short.needed}:1
              </span>
            </p>
            {short.suggestion ? (
              <Tooltip label={useLabel}>
                <button
                  type="button"
                  aria-label={useLabel}
                  onClick={() => onUse(short.suggestion!)}
                  className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white pl-1 pr-2.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:bg-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-700 dark:active:bg-slate-600"
                >
                  <AaTile colour={short.suggestion} tone={short.tone} />
                  Use
                </button>
              </Tooltip>
            ) : null}
          </div>
        ) : null}
      </div>
      {j?.passes ? (
        <div
          data-contrast-reads=""
          className="flex h-full items-center gap-2 rounded-lg border border-transparent p-1.5"
        >
          <AaTile colour={j.colour} tone={j.tone} />
          <p className="min-w-0 flex-1 text-xs leading-tight text-slate-600 dark:text-slate-300">
            <span className="block">Easy to read {where}</span>
            <span className="block tabular-nums">
              {j.of > 1 ? 'At least ' : ''}
              {ratioText(j.ratio)}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

// The words as they would look: the text colour on its ground. Decorative; the copy says it.
function AaTile({ colour, tone }: { colour: string; tone: string }) {
  return (
    <span
      aria-hidden
      data-contrast-tile=""
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border border-black/10 text-[11px] font-semibold forced-color-adjust-none dark:border-white/15"
      style={{ backgroundColor: tone, color: colour }}
    >
      Aa
    </span>
  );
}
