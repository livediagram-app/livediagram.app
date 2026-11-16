'use client';

// The Text row's readability hint (docs/specs/004-interface-design/colour-picker.md "Reading on its
// ground"): under the swatches, only while the colour judged is under its WCAG target where the text
// sits. The colour on its ground as a small Aa tile, what falls short ("1.9:1, aim for 4.5:1"), and
// Use with the nearest shade of the same hue that passes. A hint, never a block: the region is always
// there (so screen readers hear it arrive) and empty while the colour reads.
import { contrastRatio, textContrast, type TextGround } from '@livedesign/design';
import { Tooltip } from '@liveworkspace/ui';

const GROUND_WORDS: Record<TextGround['on'], string> = {
  page: 'on this page',
  shape: 'on its fill',
  card: 'on the shape behind',
};

// One decimal, never rounded up onto the target: 4.47 reads 4.4, so it never shows "4.5:1" short of 4.5.
const ratioText = (r: number) => `${Math.floor(r * 10) / 10}:1`;

export function ContrastHint({
  colour,
  ground,
  large,
  onUse,
}: {
  // The colour judged, as drawn there; null judges nothing.
  colour: string | null;
  ground: TextGround;
  large: boolean;
  onUse: (hex: string) => void;
}) {
  const hint = colour ? textContrast(colour, ground.tones, large) : null;
  const short = hint && !hint.passes ? hint : null;
  // Further from black than the colour judged: a lighter shade.
  const way =
    short?.suggestion &&
    contrastRatio(short.suggestion, '#000000') > contrastRatio(colour!, '#000000')
      ? 'lighter'
      : 'darker';
  const useLabel = short?.suggestion
    ? `Use ${short.suggestion}, a ${way} shade that reads ${GROUND_WORDS[ground.on]}`
    : '';
  return (
    <div role="status" data-testid="contrast-hint" className="empty:-mt-2.5">
      {short ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/60">
          <AaTile colour={colour!} tone={short.tone} />
          <p className="min-w-0 flex-1 text-xs leading-tight text-slate-700 dark:text-slate-200">
            <span className="block font-medium">Hard to read {GROUND_WORDS[ground.on]}</span>
            <span className="block tabular-nums text-slate-600 dark:text-slate-300">
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
