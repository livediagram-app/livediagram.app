'use client';

// The Background section's kinds (docs/specs/030-forms/forms.md "The form card, top to bottom", Cover): Solid,
// Gradient and Animated as a row of tiles, each a small sheet showing what it makes, its name under it, the way
// the Pattern tiles below them read. A sheet shows the cover's own fill when it is of that kind, so the
// chosen tile pictures the cover, and otherwise the theme's colour.
import type { CSSProperties } from 'react';
import { lucideSparkles } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import type { PageColourFill } from '@/lib/form-cover/colour-background';
import { fillCss, type BackgroundCategory } from '@/lib/form-cover/cover-paint';
import { tileClass } from './cover-panel-sections';

const SparklesGlyph = lucideGlyph(lucideSparkles, 13);

export const CATEGORY_LABEL: Record<BackgroundCategory, string> = {
  solid: 'Solid',
  gradient: 'Gradient',
  animated: 'Animated',
};

const PAPER_SHEET = '#ffffff';

/** What each kind's tile sheet paints: the cover's fill when it is of that kind, else one from the theme's
 *  colour (`accent`, a hex) and its own gradient (`themeGradient`). */
export function kindPreview(
  kind: BackgroundCategory,
  fill: PageColourFill | undefined,
  current: BackgroundCategory,
  accent: string,
  themeGradient: PageColourFill | undefined,
): string {
  if (fill && kind === current) return fillCss(fill);
  // The plain paper: no fill stored, so the Solid tile shows it bare.
  if (!fill && kind === 'solid' && current === 'solid') return PAPER_SHEET;
  if (kind === 'solid') return `${accent}33`;
  const gradient = themeGradient ? fillCss(themeGradient) : null;
  return gradient ?? `linear-gradient(135deg, ${accent}55, ${accent})`;
}

export function BackgroundKinds({
  categories,
  value,
  current,
  fill,
  accent,
  themeGradient,
  onChange,
}: {
  categories: readonly BackgroundCategory[];
  // The kind on show, and the kind the cover's fill is.
  value: BackgroundCategory;
  current: BackgroundCategory;
  fill: PageColourFill | undefined;
  accent: string;
  themeGradient: PageColourFill | undefined;
  onChange: (c: BackgroundCategory) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Background kind"
      className="mb-2 grid gap-1"
      style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}
    >
      {categories.map((c) => {
        const on = c === value;
        const sheet: CSSProperties = {
          background: kindPreview(c, fill, current, accent, themeGradient),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        };
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            data-background-kind={c}
            onClick={() => onChange(c)}
            className={tileClass(on)}
          >
            <span
              aria-hidden
              className="relative flex h-6 w-9 items-center justify-center overflow-hidden rounded-sm ring-1 ring-inset ring-slate-900/10 dark:ring-white/15"
              style={sheet}
            >
              {c === 'animated' ? (
                <span className="text-white drop-shadow-[0_1px_1px_rgba(15,23,42,0.35)]">
                  <SparklesGlyph />
                </span>
              ) : null}
            </span>
            {CATEGORY_LABEL[c]}
          </button>
        );
      })}
    </div>
  );
}
