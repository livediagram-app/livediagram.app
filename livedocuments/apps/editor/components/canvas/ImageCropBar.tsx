'use client';

// The crop bar (docs/specs/009-elements/picture-crop-and-mask.md "Cropping in the editor"): fixed at the foot of
// the screen while an image is cropped, the same size at any zoom and on a phone. Aspect, Zoom, then Reset,
// Cancel and Done.
import { Button, Portal, Tooltip, safeInset } from '@livedocuments/ui';
import { SegmentedRadio } from '@liveworkspace/workbench/components/primitives/SegmentedRadio';
import { IMAGE_CROP_ZOOM_MAX } from '@/lib/image-crop-math';

export type CropAspect = 'free' | 'original' | 'square' | '4:3' | '16:9';
export const CROP_ASPECTS: readonly { id: CropAspect; label: string }[] = [
  { id: 'free', label: 'Free' },
  { id: 'original', label: 'Original' },
  { id: 'square', label: 'Square' },
  { id: '4:3', label: '4:3' },
  { id: '16:9', label: '16:9' },
];

/** An aspect choice as width / height; null for Free. */
export function cropAspectRatio(
  a: CropAspect,
  picture: { width: number; height: number },
): number | null {
  if (a === 'free') return null;
  if (a === 'original') return picture.width / picture.height;
  if (a === 'square') return 1;
  return a === '4:3' ? 4 / 3 : 16 / 9;
}

export function ImageCropBar({
  aspect,
  zoom,
  onAspect,
  onZoom,
  onReset,
  onCancel,
  onDone,
  barRef,
}: {
  aspect: CropAspect;
  // 1 is 100%.
  zoom: number;
  onAspect: (a: CropAspect) => void;
  onZoom: (z: number) => void;
  onReset: () => void;
  onCancel: () => void;
  onDone: () => void;
  barRef: React.Ref<HTMLDivElement>;
}) {
  const pct = Math.round(zoom * 100);
  return (
    <Portal>
      <div
        ref={barRef}
        role="toolbar"
        aria-label="Crop Image"
        data-image-crop-bar=""
        className="fixed left-1/2 z-[60] flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        style={{ bottom: `calc(16px + ${safeInset('bottom')})` }}
        // A press on the bar is the bar's: it never reaches the canvas (which would end the crop).
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Aspect
          </span>
          <SegmentedRadio
            label="Aspect"
            options={CROP_ASPECTS}
            value={aspect}
            onChange={onAspect}
            className="w-[300px] max-w-[calc(100vw-110px)]"
          />
        </div>
        <label className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Zoom
          <input
            type="range"
            aria-label="Zoom"
            aria-valuetext={`${pct}%`}
            min={100}
            max={IMAGE_CROP_ZOOM_MAX * 100}
            step={5}
            value={pct}
            onChange={(e) => onZoom(Number(e.currentTarget.value) / 100)}
            className="w-28 cursor-pointer accent-brand-600"
          />
          <span className="w-10 text-right text-xs font-medium tabular-nums text-slate-700 normal-case dark:text-slate-200">
            {pct}%
          </span>
        </label>
        <div className="flex items-center gap-1.5">
          <Tooltip label="Reset">
            <Button variant="ghost" size="sm" className="cursor-pointer" onClick={onReset}>
              Reset
            </Button>
          </Tooltip>
          <Tooltip label="Cancel">
            <Button variant="secondary" size="sm" className="cursor-pointer" onClick={onCancel}>
              Cancel
            </Button>
          </Tooltip>
          <Tooltip label="Done">
            <Button variant="primary" size="sm" className="cursor-pointer" onClick={onDone}>
              Done
            </Button>
          </Tooltip>
        </div>
      </div>
    </Portal>
  );
}
