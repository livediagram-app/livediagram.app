import { useState, type ReactNode } from 'react';
import { type StandardTone } from '@livedesign/design';
import { useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { ColourPopover } from '@/components/colour/ColourPopover';
import {
  noColour,
  standardGroup,
  themeOptions,
} from '@liveworkspace/workbench/components/colour/colour-options';
import { useDesignColours } from '@/hooks/ui/useDesignColours';
import type { TextContrastProbe } from '@/lib/text-contrast-probe';

// Shared by every editor; re-exported for the rows that import it from here.
export { MenuToggleRow } from '@liveworkspace/workbench/components/palette/MenuToggleRow';

// "No colour". A real value, not an absence: it is what a frame defaults to,
// and what you want when a shape should show the canvas through it.
const TRANSPARENT = 'transparent';

// The standard checkerboard that means "nothing here" in every graphics tool,
// on the row's chip: a plain white chip labelled Transparent would read as white.
const CHECKER =
  'repeating-conic-gradient(rgb(203 213 225) 0% 25%, rgb(255 255 255) 0% 50%) 50% / 8px 8px';

const isTransparent = (color: string): boolean =>
  color.toLowerCase() === TRANSPARENT || color.toLowerCase() === 'none';

// The palette half of a ColourRow's props: the active theme's colours, spread at every call site
// (useColourPalette) so every row offers the SAME Theme Palette.
export type ColourPalette = {
  presets: string[];
};

// One labelled colour row in an element menu's Colours section (docs/specs/008-canvas/
// canvas-and-palette.md Colours): the label, a mark for what it paints and the colour in force
// open the one colour picker (docs/specs/004-interface-design/colour-picker.md) beside it, in a
// popover, since the menu is narrower than the picker. The Theme Palette is the theme's colours, then
// the standard colours (strong for lines and text, soft for backgrounds), then Custom colours.
export function ColourRow({
  label,
  icon,
  value,
  open,
  onToggle,
  onChange,
  presets,
  onPreview,
  onCommit,
  onPreviewEnd,
  ink,
  tone = 'strong',
  contrast,
}: {
  label: string;
  // A mark for what this row paints: "Text", "Background", "Border" and "Heading" are four words of
  // similar length and shape, and in a dense menu the glyph is what tells them apart.
  icon?: ReactNode;
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (color: string) => void;
  // Hover-to-preview: onPreview shows a colour live, onPreviewEnd reverts, and onCommit is the
  // pick that snapshots the true pre-hover value for undo. Without them a pick is onChange.
  onPreview?: (color: string) => void;
  onCommit?: (color: string) => void;
  onPreviewEnd?: () => void;
  // Set where the row can store a stock colour by name (docs/specs/008-canvas/canvas-and-palette.md
  // "Colours"): the standard colours are then picked by name, Ink included, and adapt per canvas.
  ink?: string;
  // Lines and text take the strong colours; backgrounds the soft ones.
  tone?: StandardTone;
  // The Text row's ground: its picker says when a colour would be hard to read there.
  contrast?: readonly TextContrastProbe[];
} & ColourPalette) {
  const surface = useCanvasSurface();
  // In state, not a ref: a row can mount already open, and the popover needs its anchor then.
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const yours = useDesignColoursWhen(open, presets);
  const theme = themeOptions(presets);
  return (
    <div>
      <button
        ref={setTrigger}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span className="flex items-center gap-2">
          {icon ? (
            <span className="text-slate-400" aria-hidden>
              {icon}
            </span>
          ) : null}
          {label}
        </span>
        <span
          className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600"
          style={isTransparent(value) ? { background: CHECKER } : { backgroundColor: value }}
          aria-hidden
        />
      </button>
      {open && trigger ? (
        <ColourPopover
          anchor={trigger}
          // Beside the menu (or its flyout) the row sits in, which is narrower than the picker.
          beside={trigger.closest<HTMLElement>('[data-menu-flyout], [data-context-menu]')}
          onClose={onToggle}
          label={`${label} colour`}
          value={isTransparent(value) ? TRANSPARENT : value}
          leading={[noColour(TRANSPARENT, `No ${label.toLowerCase()} colour`)]}
          theme={theme}
          standard={[standardGroup(tone, surface, ink ? 'name' : 'hex')]}
          yours={yours}
          boardWarning={ink !== undefined}
          contrast={contrast}
          onPreview={onPreview}
          onPreviewEnd={onPreviewEnd}
          onPick={(id) => {
            (onCommit ?? onChange)(id);
            onToggle();
          }}
        />
      ) : null}
    </div>
  );
}

// Custom colours only while the row's picker is open, so a closed menu row never walks the design.
function useDesignColoursWhen(open: boolean, offered: readonly string[]): string[] {
  const colours = useDesignColours(open ? offered : NO_COLOURS);
  return open ? colours : [];
}
const NO_COLOURS: readonly string[] = [];

// One labelled button grid in the Border section. Literal column classes so
// Tailwind keeps them.
