'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { MenuSliderRow } from '@liveworkspace/workbench/components/primitives/MenuSliderRow';
import { SegmentedRadio } from '@liveworkspace/workbench/components/primitives/SegmentedRadio';
import { useCoarsePointer } from '@liveworkspace/workbench/hooks/ui/useCoarsePointer';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import type { DockAnchor } from '@/lib/canvas-chrome';
import {
  formatMagnification,
  MAGNIFIER_SHAPES,
  MAGNIFIER_SIZES,
  MAGNIFIER_ZOOM_RANGE,
  magnifierSizePreset,
  type MagnifierSizePreset,
} from '@/lib/magnifier-config';
import { magnifierStore, type MagnifierStore } from '@/lib/magnifier-store';
import { magnifierHeroArt } from './MagnifierHeroArt';

// The Magnifier's settings (docs/specs/008-canvas/magnifier.md "The settings popover"): a small popover above its
// cluster button. Every change applies to the lens at once and is remembered on this device (magnifierStore).

export const MAGNIFIER_HINT = 'Scroll to change magnification. Shift+scroll to change size.';
export const MAGNIFIER_TOUCH_HINT = 'Drag a finger to move the lens.';

const NO_MOVE = () => {};

// The Size row's choices, with Custom shown only while the lens sits between the presets.
const sizeOptions = (preset: MagnifierSizePreset) => [
  ...MAGNIFIER_SIZES.map(({ id, label }) => ({ id: id as MagnifierSizePreset, label })),
  ...(preset === 'custom' ? [{ id: 'custom' as const, label: 'Custom' }] : []),
];

export function MagnifierPopover({
  anchor,
  onClose,
  store = magnifierStore,
}: {
  anchor?: DockAnchor;
  onClose: () => void;
  store?: MagnifierStore;
}) {
  const config = useSyncExternalStore(store.subscribe, store.get, store.get);
  // The hint follows the pointer, not the width: a narrow desktop window still scrolls, a touch tablet drags.
  const touch = useCoarsePointer();
  const preset = magnifierSizePreset(config.size);

  // Escape closes it, like the menus it sits beside.
  const onCloseRef = useLatest(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCloseRef]);

  return (
    <MovablePanel
      title="Magnifier"
      hero={{ art: magnifierHeroArt }}
      helpArticle="magnifier"
      position={null}
      defaultCorner="bottom-right"
      onMoveTo={NO_MOVE}
      popoverOpen
      popoverAnchor={anchor}
      asPopover
      popoverWidth="w-72"
      dismissOnOutside
      onPopoverClose={onClose}
    >
      <div data-magnifier-settings="" className="flex flex-col gap-1 pb-3">
        <MenuSliderRow
          label="Magnification"
          min={MAGNIFIER_ZOOM_RANGE.min}
          max={MAGNIFIER_ZOOM_RANGE.max}
          step={MAGNIFIER_ZOOM_RANGE.step}
          value={config.zoom}
          display={formatMagnification(config.zoom)}
          valueText={`Magnification ${formatMagnification(config.zoom)}`}
          onChange={(zoom) => store.set('zoom', zoom)}
        />
        <div className="flex flex-col gap-1 px-3 py-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Size</p>
            <span className="text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-300">
              {config.size}px
            </span>
          </div>
          <SegmentedRadio
            label="Lens size"
            options={sizeOptions(preset)}
            value={preset}
            onChange={(id) => {
              const size = MAGNIFIER_SIZES.find((s) => s.id === id)?.px;
              if (size !== undefined) store.set('size', size);
            }}
          />
        </div>
        <div className="flex flex-col gap-1 px-3 py-1.5">
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Shape</p>
          <SegmentedRadio
            label="Lens shape"
            options={MAGNIFIER_SHAPES}
            value={config.shape}
            onChange={(shape) => store.set('shape', shape)}
          />
        </div>
        <p className="px-3 pt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
          {touch ? MAGNIFIER_TOUCH_HINT : MAGNIFIER_HINT}
        </p>
      </div>
    </MovablePanel>
  );
}
