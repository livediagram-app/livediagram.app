import {
  AvatarModeIcon,
  EraserIcon,
  FormatPainterIcon,
  IsometricIcon,
  LaserIcon,
  PanIcon,
  SelectIcon,
  SlideDeckIcon,
  SpotlightIcon,
  ZenIcon,
} from '@/components/palette/palette-icons';
import type { PaletteDropdownOption } from '@/components/palette/PaletteDropdown';

// The canvas-tool dropdown's option set (Select / Hand / Eraser / Format /
// Laser / Spotlight / Avatar / Isometric / Zen), grouped (group index drives
// the menu dividers): editing tools, then presenter tools, then the view modes.
// Eraser and everything after act on existing content, so they disable on an
// empty canvas; Spotlight and Slide Deck are desktop-only. Zen is an ACTION, not a persistent
// tool: picking it fires the toggle and leaves the current tool selected (the
// picker's onChange special-cases the id); `includeZen` is set only when the
// host wired a toggle. Built off the gating flags so the palette wiring stays
// declarative.
export function buildCanvasToolOptions({
  canvasEmpty,
  isMobile,
  includeZen,
  planMode,
}: {
  canvasEmpty?: boolean;
  isMobile: boolean;
  includeZen?: boolean;
  // Plan mode leaves Eraser and Format out (docs/specs/026-plan/plan-mode.md).
  planMode?: boolean;
}): PaletteDropdownOption[] {
  const options = buildAll(canvasEmpty, isMobile, includeZen);
  return planMode ? options.filter((o) => o.id !== 'eraser' && o.id !== 'format') : options;
}

function buildAll(
  canvasEmpty: boolean | undefined,
  isMobile: boolean,
  includeZen: boolean | undefined,
): PaletteDropdownOption[] {
  return [
    { id: 'select', label: 'Select', shortcut: 'V', icon: <SelectIcon />, group: 0 },
    { id: 'pan', label: 'Hand', shortcut: 'H', icon: <PanIcon />, group: 0 },
    // Eraser / Format / Laser / Spotlight / Isometric all act on
    // existing content, so they're disabled on an empty canvas —
    // only Select + Hand stay available until something's drawn.
    {
      id: 'eraser',
      label: 'Eraser',
      shortcut: 'E',
      icon: <EraserIcon />,
      group: 0,
      disabled: canvasEmpty,
    },
    // Format painter as a persistent tool: pick a base element,
    // then tap any number of targets to paint its style. No
    // keyboard shortcut (F is the Pencil/freehand key).
    {
      id: 'format',
      label: 'Format',
      icon: <FormatPainterIcon />,
      group: 0,
      disabled: canvasEmpty,
    },
    {
      id: 'laser',
      label: 'Laser',
      shortcut: 'K',
      icon: <LaserIcon />,
      group: 1,
      disabled: canvasEmpty,
    },
    // Spotlight is desktop-only (hover + click-to-resize don't map
    // to touch); omitted on mobile viewports.
    ...(isMobile
      ? []
      : [
          {
            id: 'spotlight',
            label: 'Spotlight',
            icon: <SpotlightIcon />,
            group: 1,
            disabled: canvasEmpty,
          },
        ]),
    // Avatar mode (docs/specs/008-canvas/avatar-mode.md): a walking character you steer to whatever
    // you're narrating. A presenter tool like Laser / Spotlight, but it
    // works on touch too (tap-to-walk), so no mobile carve-out.
    {
      id: 'avatar',
      label: 'Avatar',
      shortcut: 'W',
      icon: <AvatarModeIcon />,
      group: 1,
      disabled: canvasEmpty,
    },
    // Slide Deck (docs/specs/012-collaboration/presentation-mode.md). In the Present band with the Laser and Spotlight:
    // like them it is a tool for showing a document to somebody rather than
    // for changing it. Needs content for the same reason they do — there is
    // nothing to put on a slide on an empty canvas. Desktop-only like
    // Spotlight: the deck workbench has no room beside the canvas on a phone.
    ...(isMobile
      ? []
      : [
          {
            id: 'slide-deck',
            label: 'Slide Deck',
            icon: <SlideDeckIcon />,
            group: 1,
            disabled: canvasEmpty,
          },
        ]),
    {
      id: 'isometric',
      label: 'Isometric',
      shortcut: 'I',
      icon: <IsometricIcon />,
      group: 2,
      disabled: canvasEmpty,
    },
    // Zen hides the chrome rather than acting on content, so it stays
    // available on an empty canvas. Exit lives on the zoom dock (the only
    // chrome left in zen) and on Z / Esc.
    ...(includeZen
      ? [{ id: 'zen', label: 'Zen', shortcut: 'Z', icon: <ZenIcon />, group: 2 }]
      : []),
  ];
}
