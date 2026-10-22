'use client';

// The Background section's kinds (docs/specs/007-editor/pages-mode.md "Backgrounds"): Solid, Gradient,
// Image and Animated as a row of tiles, each a small sheet showing what it makes, its name under it, the way
// the Pattern tiles below them read. A sheet shows the page's own fill when it is of that kind, so the
// chosen tile pictures the page, and otherwise the theme's colour.
import type { CSSProperties } from 'react';
import { lucideImage, lucideSparkles } from '@livedesign/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import type { PageFill } from '@livedesign/document';
import { fillCss, type BackgroundCategory } from '@/lib/page-paint';
import { tileClass } from './page-panel-sections';

const ImageGlyph = lucideGlyph(lucideImage, 14);
const SparklesGlyph = lucideGlyph(lucideSparkles, 13);

export const CATEGORY_LABEL: Record<BackgroundCategory, string> = {
  solid: 'Solid',
  gradient: 'Gradient',
  image: 'Image',
  animated: 'Animated',
};

const PAPER_SHEET = '#ffffff';
// A picture's stand-in while the page has none: a sky over a meadow.
const IMAGE_STAND_IN =
  'linear-gradient(180deg, #bae6fd 0%, #e0f2fe 55%, #bbf7d0 55%, #86efac 100%)';

/** What each kind's tile sheet paints: the page's fill when it is of that kind, else one from the theme's
 *  colour (`accent`, a hex) and its own gradient (`themeGradient`). */
export function kindPreview(
  kind: BackgroundCategory,
  fill: PageFill | undefined,
  current: BackgroundCategory,
  accent: string,
  themeGradient: PageFill | undefined,
): string {
  if (fill && kind === current) return fillCss(fill);
  // The page's own paper: no fill stored, so the Solid tile shows it bare.
  if (!fill && kind === 'solid' && current === 'solid') return PAPER_SHEET;
  if (kind === 'solid') return `${accent}33`;
  if (kind === 'image') return IMAGE_STAND_IN;
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
  // The kind on show, and the kind the page's fill is.
  value: BackgroundCategory;
  current: BackgroundCategory;
  fill: PageFill | undefined;
  accent: string;
  themeGradient: PageFill | undefined;
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
              {c === 'image' ? (
                <span className="text-sky-800/70 drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
                  <ImageGlyph />
                </span>
              ) : null}
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
