import {
  EraserIcon,
  FormatPainterIcon,
  IsometricIcon,
  PanIcon,
  SelectIcon,
  ZenIcon,
} from '@/components/palette/palette-icons';
import type { PaletteDropdownOption } from '@/components/palette/PaletteDropdown';

// The canvas-tool dropdown's option set (Select / Hand / Eraser / Format /
// Isometric / Zen), grouped (group index drives the menu dividers): editing
// tools, then the view modes. Eraser and everything after act on existing
// content, so they disable on an empty canvas. Zen is an ACTION, not a persistent
// tool: picking it fires the toggle and leaves the current tool selected (the
// picker's onChange special-cases the id); `includeZen` is set only when the
// host wired a toggle. Built off the gating flags so the palette wiring stays
// declarative.
export function buildCanvasToolOptions({
  canvasEmpty,
  includeZen,
  planMode,
}: {
  canvasEmpty?: boolean;
  includeZen?: boolean;
  // Plan mode leaves Eraser and Format out (docs/specs/026-plan/plan-mode.md).
  planMode?: boolean;
} = {}): PaletteDropdownOption[] {
  const options = buildAll(canvasEmpty, includeZen);
  return planMode ? options.filter((o) => o.id !== 'eraser' && o.id !== 'format') : options;
}

function buildAll(
  canvasEmpty: boolean | undefined,
  includeZen: boolean | undefined,
): PaletteDropdownOption[] {
  return [
    { id: 'select', label: 'Select', shortcut: 'V', icon: <SelectIcon />, group: 0 },
    { id: 'pan', label: 'Hand', shortcut: 'H', icon: <PanIcon />, group: 0 },
    // Eraser / Format / Isometric all act on existing content, so they're
    // disabled on an empty canvas — only Select + Hand stay available until
    // something's drawn.
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
      id: 'isometric',
      label: 'Isometric',
      shortcut: 'I',
      icon: <IsometricIcon />,
      group: 1,
      disabled: canvasEmpty,
    },
    // Zen hides the chrome rather than acting on content, so it stays
    // available on an empty canvas. Exit lives on the zoom dock (the only
    // chrome left in zen) and on Z / Esc.
    ...(includeZen
      ? [{ id: 'zen', label: 'Zen', shortcut: 'Z', icon: <ZenIcon />, group: 1 }]
      : []),
  ];
}
