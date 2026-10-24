'use client';

// The photo tools' colours (docs/specs/031-photo/photo-pages.md "The photo tools"), after the groups: the foreground swatch
// over and left of the background's, a swap (X) and a reset (D, black over white). A press on a
// swatch opens the shared colour picker for it. The person's own, kept in this browser.
import { lucideArrowLeftRight, lucideRotateCcw } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';
import { standardGroup } from '@/components/colour/colour-options';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { photoTools, usePhotoTools } from '@/lib/photo-editor/tool-state';

const SwapIcon = lucideGlyph(lucideArrowLeftRight, 12);
const ResetIcon = lucideGlyph(lucideRotateCcw, 12);

const STANDARD = [standardGroup('strong', 'light', 'hex'), standardGroup('soft', 'light', 'hex')];
const HEX = /^#[0-9a-f]{6}$/i;

const SMALL =
  'flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white';

export function PhotoColours() {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const { foreground, background } = usePhotoTools();
  const set = (which: 'foreground' | 'background') => (id: string) => {
    if (HEX.test(id)) photoTools.set({ [which]: id.toLowerCase() });
  };
  return (
    <div className="flex items-center justify-center gap-1 border-l border-slate-100 px-1.5 dark:border-slate-800">
      <div className="relative h-9 w-9">
        <div className="absolute bottom-0 right-0 z-0">
          <ColourSwatchButton
            label="Background Colour"
            swatch={background}
            value={background}
            standard={STANDARD}
            onPick={set('background')}
            className="h-6 w-6 ring-1 ring-slate-300 dark:ring-slate-600"
          />
        </div>
        <div className="absolute left-0 top-0 z-[1]">
          <ColourSwatchButton
            label="Foreground Colour"
            swatch={foreground}
            value={foreground}
            standard={STANDARD}
            onPick={set('foreground')}
            className="h-6 w-6 ring-1 ring-slate-300 dark:ring-slate-600"
          />
        </div>
      </div>
      <div className="flex gap-0.5">
        <Tooltip label="Swap Colours (X)">
          <button
            type="button"
            aria-label="Swap Colours (X)"
            onClick={() => photoTools.swapColours()}
            className={SMALL}
          >
            <SwapIcon />
          </button>
        </Tooltip>
        <Tooltip label="Reset Colours (D)">
          <button
            type="button"
            aria-label="Reset Colours (D)"
            onClick={() => photoTools.resetColours()}
            className={SMALL}
          >
            <ResetIcon />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
