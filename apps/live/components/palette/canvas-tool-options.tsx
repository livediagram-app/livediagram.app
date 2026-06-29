import {
  EraserIcon,
  FormatPainterIcon,
  IsometricIcon,
  LaserIcon,
  PanIcon,
  SelectIcon,
  SpotlightIcon,
} from '@/components/palette/palette-icons';
import type { PaletteDropdownOption } from '@/components/palette/PaletteDropdown';

// The canvas-tool dropdown's option set (Select / Hand / Eraser / Format /
// Laser / Spotlight / Isometric), grouped (group index drives the menu
// dividers): editing tools, then presenter tools, then the isometric view.
// Eraser and everything after act on existing content, so they disable on an
// empty canvas; Spotlight is desktop-only. Built off the two gating flags so
// the palette wiring stays declarative. Split out of CommandPalette.
export function buildCanvasToolOptions({
  canvasEmpty,
  isMobile,
}: {
  canvasEmpty?: boolean;
  isMobile: boolean;
}): PaletteDropdownOption[] {
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
    {
      id: 'isometric',
      label: 'Isometric',
      shortcut: 'I',
      icon: <IsometricIcon />,
      group: 2,
      disabled: canvasEmpty,
    },
  ];
}
