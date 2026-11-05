import {
  AvatarModeIcon,
  EraserIcon,
  FormatPainterIcon,
  PanIcon,
  SelectIcon,
} from '@/components/palette/palette-icons';
import type { PaletteDropdownOption } from '@liveworkspace/workbench/components/palette/PaletteDropdown';

// The canvas-tool picker's bands (docs/specs/010-palette/palette-top-level-categories.md "The Selection Mode picker"),
// keyed by each option's `group`: Build is how you arrange the board and move round it, Edit changes what is drawn,
// and Interact is being on the board yourself. A new tool joins a band by its group alone.
export const CANVAS_TOOL_GROUP_LABELS: Readonly<Record<number, string>> = {
  0: 'Build',
  1: 'Edit',
  2: 'Interact',
};

// The canvas-tool dropdown's option set, in band order: Build (Select, Hand), Edit (Eraser, Format), Interact
// (Avatar). Eraser and Format act on existing content, so they disable on an empty canvas. Built off the gating flag
// so the palette wiring stays declarative.
export function buildCanvasToolOptions({
  canvasEmpty,
}: {
  canvasEmpty?: boolean;
}): PaletteDropdownOption[] {
  return [
    { id: 'select', label: 'Select', shortcut: 'V', icon: <SelectIcon />, group: 0 },
    { id: 'pan', label: 'Hand', shortcut: 'H', icon: <PanIcon />, group: 0 },
    {
      id: 'eraser',
      label: 'Eraser',
      shortcut: 'E',
      icon: <EraserIcon />,
      group: 1,
      disabled: canvasEmpty,
    },
    // Format painter as a persistent tool: pick a base element, then tap any number of targets to paint its style.
    // No keyboard shortcut (F was the frame key).
    {
      id: 'format',
      label: 'Format',
      icon: <FormatPainterIcon />,
      group: 1,
      disabled: canvasEmpty,
    },
    // Avatar mode (docs/specs/008-canvas/avatar-mode.md "Where it lives"): walking is the point of a meeting app, so
    // it has the Interact band to itself, on every viewport and for every role. Never disabled (an empty board is
    // still a place to stand in) and no key: the arrows and Space are the walk's.
    { id: 'avatar', label: 'Avatar', icon: <AvatarModeIcon />, group: 2 },
  ];
}
