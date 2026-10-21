import {
  AvatarModeIcon,
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

// The modes only a Selection Mode button on the board hands out (docs/specs/008-canvas/avatar-mode.md "Where it
// lives"): the dropdown lists one only while you are in it, so the picker names the mode you are in and any other
// pick leaves it. No key and no search command enters them either.
const BOARD_ONLY_TOOLS: ReadonlySet<string> = new Set(['avatar']);

// The canvas-tool dropdown's option set (Select / Hand / Format /
// Laser / Spotlight / Isometric / Zen, plus Avatar while in it), grouped (group index drives
// the menu dividers): editing tools, then presenter tools, then the view modes.
// Format and everything after act on existing content, so they disable on an
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
  currentTool,
}: {
  canvasEmpty?: boolean;
  isMobile: boolean;
  includeZen?: boolean;
  // Plan mode leaves Format out (docs/specs/026-plan/plan-mode.md).
  planMode?: boolean;
  // The tool in force: a board-only mode (Avatar) is listed only while it is the one in force.
  currentTool?: string;
}): PaletteDropdownOption[] {
  const options = buildAll(canvasEmpty, isMobile, includeZen).filter(
    (o) => !BOARD_ONLY_TOOLS.has(o.id) || o.id === currentTool,
  );
  return planMode ? options.filter((o) => o.id !== 'format') : options;
}

function buildAll(
  canvasEmpty: boolean | undefined,
  isMobile: boolean,
  includeZen: boolean | undefined,
): PaletteDropdownOption[] {
  return [
    { id: 'select', label: 'Select', shortcut: 'V', icon: <SelectIcon />, group: 0 },
    { id: 'pan', label: 'Hand', shortcut: 'H', icon: <PanIcon />, group: 0 },
    // Format / Laser / Spotlight / Isometric all act on
    // existing content, so they're disabled on an empty canvas —
    // only Select + Hand stay available until something's drawn.
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
    // you're narrating. Entered only from a Selection Mode button on the board, so it is listed only while in
    // force (see BOARD_ONLY_TOOLS), never disabled, and has no key.
    {
      id: 'avatar',
      label: 'Avatar',
      icon: <AvatarModeIcon />,
      group: 1,
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
