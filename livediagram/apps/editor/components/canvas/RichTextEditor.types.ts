import type {
  BoxedElement,
  TextAlignX,
  TextAlignY,
  TextRun,
  TextSize,
} from '@livediagram/document';
import type { LabelPadding } from './label-style';

export type RichTextEditorProps = {
  // The element being edited — its whole-element text* fields are the
  // defaults each run's unset attrs inherit (for effective styling +
  // toggle computation).
  element: BoxedElement;
  initialLabel: string;
  initialRuns?: TextRun[];
  placeholder: string;
  textSize: TextSize;
  // The box an auto-fitting ('scale') multi-line label measures against
  // (docs/specs/021-event-storming/event-storming.md). Absent = no auto-fit; the static size bucket applies.
  fitBox?: { width: number; height: number; padding: number };
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: LabelPadding;
  // A Shift-resized text box's scale on its text (docs/specs/023-draw-mode/draw-mode.md). Absent = 1.
  textScale?: number;
  // Called with the editor node on every change to its text (and once on opening), so a whiteboard
  // text box can grow with what is typed (docs/specs/023-draw-mode/draw-mode.md "Text boxes").
  onLiveText?: (editor: HTMLElement) => void;
  fontFamily?: string;
  multiline: boolean;
  // Paint the live text in capitals (an event-storming note, docs/specs/021-event-storming/event-storming.md). A
  // CSS transform only: the committed label keeps the author's casing, and
  // the auto-fit measures the caps so the size can't jump on commit.
  uppercase?: boolean;
  cursorAtEnd: boolean;
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
