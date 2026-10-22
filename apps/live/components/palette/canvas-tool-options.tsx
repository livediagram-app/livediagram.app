import {
  FormatPainterIcon,
  IsometricIcon,
  PanIcon,
  SelectIcon,
  ZenIcon,
} from '@/components/palette/palette-icons';
import type { PaletteDropdownOption } from '@/components/palette/PaletteDropdown';

// The canvas-tool dropdown's option set (Select / Hand / Format /
// Isometric / Zen), grouped (group index drives the menu dividers): editing
// tools, then the view modes. Format and everything after act on existing
// content, so they disable on an empty canvas. Zen is an ACTION, not a persistent
// tool: picking it fires the toggle and leaves the current tool selected (the
// picker's onChange special-cases the id); `includeZen` is set only when the
// host wired a toggle. Built off the gating flags so the palette wiring stays
// declarative.
export function buildCanvasToolOptions({
  canvasEmpty,
  includeZen,
}: {
  canvasEmpty?: boolean;
  includeZen?: boolean;
}): PaletteDropdownOption[] {
  // Plan leaves Format out (docs/specs/026-plan/plan-mode.md "The tools").
  return buildAll(canvasEmpty, includeZen).filter((o) => o.id !== 'format');
}

function buildAll(
  canvasEmpty: boolean | undefined,
  includeZen: boolean | undefined,
): PaletteDropdownOption[] {
  return [
    { id: 'select', label: 'Select', shortcut: 'V', icon: <SelectIcon />, group: 0 },
    { id: 'pan', label: 'Hand', shortcut: 'H', icon: <PanIcon />, group: 0 },
    // Format / Isometric all act on existing content, so they're
    // disabled on an empty canvas — only Select + Hand stay available until
    // something's drawn.
    // Format painter as a persistent tool: pick a base element,
    // then tap any number of targets to paint its style. No
    // keyboard shortcut (F is the Frame key).
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
