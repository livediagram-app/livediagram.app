'use client';

// A phone's tool options (docs/specs/031-photo/photo-pages.md "On a phone"): no row of options and no quick panel; a
// tap on the tool in hand opens its options as a bottom sheet (the options flyout's header and body: the Tool picker,
// its sections, its presets), and while a crop or Free Transform is under way a small bar over the tools row holds
// Cancel and Crop or Commit.
import { Button } from '@livedesign/ui';
import { lucideScaling } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import { FlyoutHeader } from '@/components/palette/CategoryFlyout';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { TOOL_BLURBS } from '@/lib/photo-editor/option-guides';
import { toolFlyout, useToolFlyoutOpen } from '@/lib/photo-editor/tool-flyout';
import { optionsKey, photoTools, TOOL_NAMES, usePhotoTools } from '@/lib/photo-editor/tool-state';
import { cancelCrop, commitCrop, useCropBox } from '@/lib/photo-editor/tools/crop-tool';
import {
  cancelTransform,
  commitTransform,
  useFreeTransform,
} from '@/lib/photo-editor/tools/transform-tool';
import { TOOL_ICONS } from './photo-icons';
import { PhotoToolOptionsBody } from './PhotoToolOptionsBody';
import { TransformOptionsBody } from './PhotoTransformOptions';
import { TOOL_FLYOUT_INSIDE, useToolFlyoutDismiss } from './useToolFlyoutDismiss';

const PHONE_SHEET_INSIDE = `${TOOL_FLYOUT_INSIDE}, [data-bottom-sheet]`;

const TransformIcon = lucideGlyph(lucideScaling, 18);
// The flyout's footer is pointer help; a phone has none to give.
const noPoint = () => {};

/** The Cancel and Crop or Commit bar over a phone's tools row, while a crop or transform is under way. */
export function PhotoPhoneHeldBar({ photo }: { photo: PhotoEditorView }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const transform = useFreeTransform();
  const crop = useCropBox();
  const ctx = photo.ctx;
  if (!ctx || (!transform && !crop)) return null;
  return (
    <div
      role="toolbar"
      aria-label={transform ? 'Free Transform' : 'Crop'}
      className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pl-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      <span className="flex-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
        {transform ? 'Free Transform' : 'Crop'}
      </span>
      <button
        type="button"
        onClick={() => toolFlyout.open()}
        className="h-9 rounded-lg px-3 text-[13px] font-medium text-slate-600 dark:text-slate-300"
      >
        Options
      </button>
      <button
        type="button"
        onClick={() => (transform ? cancelTransform(ctx) : cancelCrop(ctx))}
        className="h-9 rounded-lg px-3 text-[13px] font-medium text-slate-700 ring-1 ring-slate-200 dark:text-slate-200 dark:ring-slate-700"
      >
        Cancel
      </button>
      <Button size="sm" onClick={() => (transform ? commitTransform(ctx) : commitCrop(ctx))}>
        {transform ? 'Commit' : 'Crop'}
      </Button>
    </div>
  );
}

/** The tool in hand's options as a bottom sheet, opened by a tap on that tool. */
export function PhotoPhoneOptionsSheet({ photo }: { photo: PhotoEditorView }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const open = useToolFlyoutOpen();
  const { tool } = usePhotoTools();
  const transform = useFreeTransform();
  const shown = open && (!!tool || !!transform);
  // As the desktop's card: a press outside the sheet (its grab handle is the sheet's own) or Escape closes it. Without
  // this the sheet, over the lower half of the screen and the photo, could only be dragged away by its handle.
  useToolFlyoutDismiss(shown, PHONE_SHEET_INSIDE);
  if (!shown) return null;
  const name = transform ? 'Free Transform' : TOOL_NAMES[tool!];
  const Icon = transform ? TransformIcon : TOOL_ICONS[tool!];
  return (
    <BottomSheet onClose={() => toolFlyout.close()} zClassName="z-[var(--z-popover)]" flush>
      <div data-photo-flyout="" className="flex max-h-[70dvh] flex-col">
        <FlyoutHeader
          icon={<Icon />}
          title={name}
          tagline={transform ? 'Set the box’s numbers, then Commit.' : (TOOL_BLURBS[tool!] ?? '')}
          wrap
          aside={
            tool && !transform ? (
              <button
                type="button"
                onClick={() => photoTools.resetOptions(optionsKey(tool))}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-slate-500 ring-1 ring-slate-200 dark:text-slate-400 dark:ring-slate-700"
              >
                Reset
              </button>
            ) : null
          }
        />
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
          {transform ? (
            <TransformOptionsBody photo={photo} onPoint={noPoint} />
          ) : (
            <PhotoToolOptionsBody photo={photo} tool={tool!} onPoint={noPoint} />
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
