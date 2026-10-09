import { useState, type ReactNode } from 'react';
import { Glyph } from '@livediagram/ui';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { DirArrow } from '@/components/palette/context-menu-icons';
import { type IconPosition, type StandardTone } from '@livediagram/document';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { ColourPopover } from '@/components/colour/ColourPopover';
import { noColour, standardGroup, themeOptions } from '@/components/colour/colour-options';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';

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
  // Set where the row can store a stock colour by name (docs/specs/007-editor/editor-modes.md
  // "One look"): the standard colours are then picked by name, Ink included, and adapt per canvas.
  ink?: string;
  // Lines and text take the strong colours; backgrounds the soft ones.
  tone?: StandardTone;
} & ColourPalette) {
  const surface = useCanvasSurface();
  // In state, not a ref: a row can mount already open, and the popover needs its anchor then.
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const yours = useDocumentColoursWhen(open, presets);
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

// Custom colours only while the row's picker is open, so a closed menu row never walks the document.
function useDocumentColoursWhen(open: boolean, offered: readonly string[]): string[] {
  const colours = useDocumentColours(open ? offered : NO_COLOURS);
  return open ? colours : [];
}
const NO_COLOURS: readonly string[] = [];

// The inline-icon placement picker laid out as a cross (Top / Left / Right /
// Bottom around an empty centre), each cell an arrow + label.
export function IconPositionGrid({
  current,
  onPick,
  onPreview,
  onPreviewEnd,
}: {
  current: string;
  onPick: (pos: IconPosition) => void;
  // Optional hover-preview pair (docs/specs/010-palette/style-presets.md flow): hovering a cell shows the
  // icon on that side live, leaving reverts.
  onPreview?: (pos: IconPosition) => void;
  onPreviewEnd?: () => void;
}) {
  const cell = (key: IconPosition, label: string, dir: 'up' | 'down' | 'left' | 'right') => (
    <button
      type="button"
      aria-pressed={current === key}
      onClick={() => onPick(key)}
      onPointerEnter={onPreview ? onMouseHover(() => onPreview(key)) : undefined}
      onPointerLeave={onPreviewEnd ? onMouseHover(onPreviewEnd) : undefined}
      className={`flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition ${
        current === key
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      <DirArrow dir={dir} />
      {label}
    </button>
  );
  return (
    <div className="grid grid-cols-3 gap-1 px-2 pb-1.5">
      <span />
      {cell('above', 'Top', 'up')}
      <span />
      {cell('left', 'Left', 'left')}
      <span />
      {cell('right', 'Right', 'right')}
      <span />
      {cell('below', 'Bottom', 'down')}
      <span />
    </div>
  );
}

// One labelled button grid in the Border section. Literal column classes so
// Tailwind keeps them.

// A full-width row whose whole surface toggles an iOS-style switch (the
// switch is presentational so we don't nest a button in a button). Shared by
// the Layer aspect-lock row + the Table header/zebra toggles.
export function MenuToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      <span className="flex flex-col">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
        {description ? (
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{description}</span>
        ) : null}
      </span>
      <ToggleSwitch presentational checked={checked} label={label} />
    </button>
  );
}

// A pipette: the tool that lifts a colour off something already there.
export function PipetteIcon() {
  return (
    <Glyph size={14} units={24}>
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.9.9a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4 0L11.3 8.1a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 0 1 1.4 0L15 6z" />
    </Glyph>
  );
}
