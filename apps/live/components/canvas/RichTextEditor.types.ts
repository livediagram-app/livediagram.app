import type { BoxedElement, TextAlignX, TextAlignY, TextRun, TextSize } from '@livediagram/diagram';

export type RichTextEditorProps = {
  // The element being edited — its whole-element text* fields are the
  // defaults each run's unset attrs inherit (for effective styling +
  // toggle computation).
  element: BoxedElement;
  initialLabel: string;
  initialRuns?: TextRun[];
  placeholder: string;
  textSize: TextSize;
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: number;
  fontFamily?: string;
  multiline: boolean;
  cursorAtEnd: boolean;
  zoom: number;
  textClassName?: string;
  // When true, the editor lays out as a flex CHILD (it fills the slot it's
  // given) instead of an `absolute inset-0` fill of the whole element, and
  // drops its own padding (the surrounding layout owns the inset). Used by
  // the inline-icon shape layout so the icon stays visible beside the editor
  // while typing; positioning + padding are handled by that flex group.
  inline?: boolean;
  onCommit: (label: string, runs: TextRun[]) => void;
  onCancel: () => void;
  // Whole-element controls surfaced in the edit toolbar (they operate on the
  // current selection = the editing element).
  onSetAlign?: (x: TextAlignX, y: TextAlignY) => void;
  onSetTextSize?: (size: TextSize) => void;
};
