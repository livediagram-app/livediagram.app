'use client';

// The Fill tool's colour (docs/specs/023-draw-mode/fill-tool.md "Its colour"): the one colour picker
// (docs/specs/004-interface-design/colour-picker.md) with No fill first, the theme's fills, the soft
// standard colours drawn for the board, Custom colours from the document, and +.
import type { Appearance } from '@livehuddle/document';
import { ColourPicker } from '@/components/colour/ColourPicker';
import { noColour, standardGroup, themeOptions } from '@/components/colour/colour-options';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';
import { FILL_TRANSPARENT } from '@liveworkspace/workbench/lib/fill-choice';

export function FillColourPicker({
  value,
  themeFills,
  board,
  onPick,
}: {
  // A `#rrggbb` or `transparent`.
  value: string;
  // The quick style panel's Background fills, custom swatches included.
  themeFills: readonly string[];
  board: Appearance;
  onPick: (colour: string) => void;
}) {
  const yours = useDocumentColours();
  return (
    <ColourPicker
      label="Fill colour"
      value={value}
      leading={[noColour(FILL_TRANSPARENT, 'No fill')]}
      theme={themeOptions([...new Set(themeFills.map((c) => c.toLowerCase()))])}
      standard={[standardGroup('soft', board, 'hex')]}
      yours={yours}
      onPick={onPick}
    />
  );
}
