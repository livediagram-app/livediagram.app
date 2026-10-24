'use client';

// The options flyout (docs/specs/031-photo/photo-pages.md "The options flyout"): the tool in hand's options as a card
// hanging from its button in the palette strip, in the category flyout's look (CategoryFlyout): a header with the
// tool's glyph on a soft plate, its name, what it does and Reset; its options in place in their sections
// (PhotoToolOptionsBody); and a footer saying what the pointed-at control does. Pressing the button of the tool in hand opens it
// (tool-flyout); a press anywhere but the card, the strip or a popover opened from the card closes it, and so do
// Escape and putting the tool down. While a Free Transform or a crop box is open and the card is not, a small bar
// hangs there instead (HeldBar): the tool's name, Options (the card), Cancel and Commit or Crop.
import { useEffect, useState } from 'react';
import { FlyoutHeader } from '@/components/palette/CategoryFlyout';
import { FlyoutFooter } from '@/components/palette/category-flyout-items';
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
import { Button } from '@livedesign/ui';
import type { Pointed } from './flyout-controls';
import { TOOL_ICONS } from './photo-icons';
import { PhotoToolOptionsBody } from './PhotoToolOptionsBody';
import { TransformOptionsBody } from './PhotoTransformOptions';
import { useToolAnchor } from './useToolAnchor';
import { lucideGlyph } from '@livedesign/ui';
import { lucideScaling } from '@liveworkspace/icons/lucide';

const TransformIcon = lucideGlyph(lucideScaling, 18);

// The card's width, px, and its room from the window's edges.
export const FLYOUT_WIDTH = 360;
const EDGE = 12;
// The pointer's half width, px.
const POINTER = 6;
// A press in these is the card's, not outside it: the photo tools in the strip (a tool's button toggles the card
// itself) and the colours, and the popovers, pickers and menus the card opens.
const INSIDE =
  '[data-photo-flyout], [data-photo-rail], [data-anchored-popover], [data-colour-picker], [data-photo-gradient-editor], [role="menu"]';

export function PhotoToolFlyout({ photo }: { photo: PhotoEditorView }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const { tool } = usePhotoTools();
  const transform = useFreeTransform();
  const crop = useCropBox();
  const open = useToolFlyoutOpen();
  // A transform, or a crop box being drawn, holds the card open for its Commit and Cancel.
  const held = !!transform || !!crop;
  const shown = held || (open && tool !== null);
  // Held open by a transform or a crop box, but not opened: the small bar, not the card.
  const compact = held && !open;
  const anchor = useToolAnchor(shown ? (tool ?? 'transform') : null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(FLYOUT_WIDTH);
  // What the footer describes, and the tool it was pointed at in (a new tool starts with the hint).
  const [pointedIn, setPointedIn] = useState<{ tool: string | null; p: Pointed }>({
    tool: null,
    p: null,
  });
  const pointed = pointedIn.tool === tool ? pointedIn.p : null;
  const setPointed = (p: Pointed) => setPointedIn({ tool, p });

  useEffect(() => {
    if (tool === null) toolFlyout.close();
  }, [tool]);
  useEffect(() => {
    if (!card || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(card.offsetWidth));
    ro.observe(card);
    return () => ro.disconnect();
  }, [card]);
  useEffect(() => {
    if (!shown || !open) return;
    // Capture: the photo's own press (the tool at work) closes it as it starts.
    const down = (e: PointerEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest(INSIDE)) return;
      toolFlyout.close();
    };
    // Before the photo's keys: Escape closes the card rather than putting the tool down.
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if ((e.target as Element | null)?.closest?.('[data-anchored-popover]')) return;
      e.preventDefault();
      e.stopPropagation();
      toolFlyout.close();
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [shown, open]);

  if (!shown || !anchor) return null;
  const centre = (anchor.left + anchor.right) / 2;
  const viewport = window.innerWidth;
  const left = Math.max(EDGE, Math.min(anchor.left - 16, viewport - width - EDGE));
  const pointer = Math.max(POINTER * 2, Math.min(centre - left - POINTER, width - POINTER * 3));
  const top = anchor.bottom + 10;
  const name = transform ? 'Free Transform' : tool ? TOOL_NAMES[tool] : '';
  const Icon = transform ? TransformIcon : tool ? TOOL_ICONS[tool] : TransformIcon;
  const keep = transform ? 'Commit' : 'Crop';
  const ends = `Press ${keep} or Enter to keep it, or Cancel or Escape to put it back.`;
  if (compact && photo.ctx) {
    const ctx = photo.ctx;
    return (
      <div
        ref={setCard}
        data-photo-flyout=""
        role="toolbar"
        aria-label={name}
        className="fixed z-[var(--z-popover)]"
        style={{ top, left }}
      >
        <span
          aria-hidden
          className="absolute -top-[6px] z-[1] h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          style={{ left: pointer }}
        />
        <div className="flex origin-top animate-dropdown-down items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 pl-2 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200/70 dark:from-brand-500/20 dark:to-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30 [&_svg]:h-4 [&_svg]:w-4">
            <Icon />
          </span>
          <span className="whitespace-nowrap pr-1 text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">
            {name}
          </span>
          <button
            type="button"
            onClick={() => toolFlyout.open()}
            className="h-8 rounded-lg px-2.5 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Options
          </button>
          <button
            type="button"
            onClick={() => (transform ? cancelTransform(ctx) : cancelCrop(ctx))}
            className="h-8 rounded-lg px-3 text-[12px] font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <Button size="sm" onClick={() => (transform ? commitTransform(ctx) : commitCrop(ctx))}>
            {keep}
          </Button>
        </div>
      </div>
    );
  }
  const tagline = transform
    ? 'Drag the box’s corners and sides, or set its numbers here.'
    : tool
      ? (TOOL_BLURBS[tool] ?? '')
      : '';
  return (
    <div
      ref={setCard}
      data-photo-flyout=""
      role="dialog"
      aria-label={`${name} Options`}
      className="fixed z-[var(--z-popover)]"
      style={{ top, left, width: `min(${FLYOUT_WIDTH}px, calc(100vw - ${EDGE * 2}px))` }}
    >
      {/* The pointer up to the tool's button, over the card's top edge. */}
      <span
        aria-hidden
        className="absolute -top-[6px] z-[1] h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        style={{ left: pointer }}
      />
      <div
        className="flex origin-top animate-dropdown-down flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
        style={{ maxHeight: `calc(100dvh - ${top + 16}px)` }}
      >
        <FlyoutHeader
          icon={<Icon />}
          title={name}
          tagline={tagline}
          wrap
          aside={
            tool && !transform ? (
              <button
                type="button"
                onClick={() => photoTools.resetOptions(optionsKey(tool))}
                className="shrink-0 rounded-lg px-2 py-1 text-[11.5px] font-medium text-slate-500 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                Reset
              </button>
            ) : null
          }
        />
        <div
          key={transform ? 'transform' : tool}
          onPointerLeave={() => setPointed(null)}
          className="flex min-h-0 animate-fade-in flex-col gap-4 overflow-y-auto overscroll-contain p-3.5"
        >
          {transform ? (
            <TransformOptionsBody photo={photo} onPoint={setPointed} />
          ) : tool ? (
            <PhotoToolOptionsBody photo={photo} tool={tool} onPoint={setPointed} />
          ) : null}
        </div>
        <FlyoutFooter
          item={pointed}
          hint={
            held
              ? ends
              : `Press on the photo to use the ${name}. Press its button again to hide these.`
          }
          touchHint={held ? ends : `Tap the photo to use the ${name}.`}
        />
      </div>
    </div>
  );
}
