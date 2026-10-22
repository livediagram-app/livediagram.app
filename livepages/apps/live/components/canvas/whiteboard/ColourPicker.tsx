'use client';

// A marker's colour (docs/specs/023-draw-mode/draw-mode.md "The colour picker"): the one colour
// picker (docs/specs/004-interface-design/colour-picker.md) with the strong standard colours by
// name, each in its version for the board, Custom colours from the document, and + with the
// hard-to-see warning. Ink is the pen's null colour.
import { INK_PEN_COLOUR, type Appearance, type PenColour } from '@livediagram/document';
import { ColourPicker as Picker } from '@/components/colour/ColourPicker';
import { standardGroup } from '@/components/colour/colour-options';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';

export function ColourPicker({
  value,
  board,
  onPick,
}: {
  // The colour in force: null is the ink.
  value: PenColour | null;
  board: Appearance;
  onPick: (colour: PenColour | null) => void;
}) {
  const yours = useDocumentColours();
  return (
    <Picker
      label="Marker colour"
      value={value ?? INK_PEN_COLOUR}
      standard={[standardGroup('strong', board, 'name')]}
      yours={yours}
      boardWarning
      onPick={(id) => onPick(id === INK_PEN_COLOUR ? null : id)}
    />
  );
}
