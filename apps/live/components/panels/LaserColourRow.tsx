'use client';

// The Laser Panel's Colour row (docs/specs/008-canvas/laser-panel.md): drawn like the panel's other
// rows (uppercase title, the current colour still readable on the right), but it opens the one
// colour picker (docs/specs/004-interface-design/colour-picker.md) in a popover beside the row, since
// the picker is wider than the panel. "Your colour" (the presence colour) leads it; then the strong
// standard colours by name, drawn for the canvas; Custom colours and +.
import { useState } from 'react';
import { ChevronIcon } from '@/components/primitives/ChevronIcon';
import { ColourPopover } from '@/components/colour/ColourPopover';
import { SwatchChip } from '@/components/colour/ColourSwatch';
import { standardGroup } from '@/components/colour/colour-options';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';
import {
  LASER_PRESENCE,
  laserColour,
  laserColourLabel,
  type LaserConfig,
} from '@/lib/laser-config';

export function LaserColourRow({
  config,
  selfColour,
  onPick,
  onOpen,
}: {
  config: LaserConfig;
  selfColour: string;
  onPick: (colour: LaserConfig['colour']) => void;
  // Opening it closes the panel's open row: one thing open at a time.
  onOpen?: () => void;
}) {
  const appearance = useCanvasSurface();
  const yours = useDocumentColours();
  const [open, setOpen] = useState(false);
  // The trigger, held in state (a callback ref) so the popover can anchor to it during render.
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const label = laserColourLabel(config.colour);
  return (
    <div>
      <button
        ref={setTrigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Colour: ${label}`}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-2 py-1.5 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Colour
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <SwatchChip colour={laserColour(config, selfColour, appearance)} small />
            {label}
          </span>
          <ChevronIcon open={open} className="text-slate-400" />
        </span>
      </button>
      {open && trigger ? (
        <ColourPopover
          anchor={trigger}
          label="Laser colour"
          value={config.colour}
          leading={[{ id: LASER_PRESENCE, colour: selfColour, label: 'Your colour' }]}
          standard={[standardGroup('strong', appearance, 'name')]}
          yours={yours}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            onPick(id);
            setOpen(false);
            trigger.focus();
          }}
        />
      ) : null}
    </div>
  );
}
