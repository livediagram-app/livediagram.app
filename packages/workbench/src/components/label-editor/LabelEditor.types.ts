// The label editor's props and the binding each editor hands `createLabelEditor`
// (liveworkspace/docs/specs/011-workbench/label-editor.md).

import type { CSSProperties, ComponentType, KeyboardEvent, RefObject } from 'react';
import type { TextAlignX, TextAlignY, TextSize } from '@liveworkspace/model-core/basics';
import type {
  ListStyle,
  RunBoolKey,
  RunHeading,
  RunPatch,
  RunSize,
  TextRun,
} from '@liveworkspace/model-core/rich-text';
import type { BoxedElement } from '@liveworkspace/element-model/element';
import type { LabelPadding } from './label-style';
import type { ActiveFormat } from './rich-text-format';

// Generic over the product's own element, which is assignable to the structural one, so a binding's toolbar and
// key handling read it precisely.
export type LabelEditorProps<E extends BoxedElement = BoxedElement> = {
  // The element being edited, its whole-element text* fields are the
  // defaults each run's unset attrs inherit (for effective styling +
  // toggle computation).
  element: E;
  initialLabel: string;
  initialRuns?: TextRun[];
  placeholder: string;
  textSize: TextSize;
  // The box an auto-fitting ('scale') multi-line label measures against.
  // Absent = no auto-fit; the static size bucket applies.
  fitBox?: { width: number; height: number; padding: number };
  alignX: TextAlignX;
  alignY: TextAlignY;
  padding: LabelPadding;
  // A Shift-resized text box's scale on its text. Absent = 1.
  textScale?: number;
  // Called with the editor node on every change to its text (and once on opening), so a text box
  // can grow with what is typed.
  onLiveText?: (editor: HTMLElement) => void;
  fontFamily?: string;
  multiline: boolean;
  // Paint the live text in capitals (a note that paints in capitals, or a text's Upper case). A
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
  // The label's character cap (a badge's 24, a step's 3: docs/specs/009-elements/badge.md); none when absent.
  maxLength?: number;
  onCommit: (label: string, runs: TextRun[]) => void;
  onCancel: () => void;
  // Whole-element controls surfaced in the edit toolbar (they operate on the
  // current selection = the editing element).
  onSetAlign?: (x: TextAlignX, y: TextAlignY) => void;
  onSetTextSize?: (size: TextSize) => void;
};

/** What the editor hands its product's toolbar: the selection's format and the commands on it. */
export type LabelToolbarProps<E extends BoxedElement = BoxedElement> = {
  active: ActiveFormat;
  alignX: TextAlignX;
  alignY: TextAlignY;
  element: E;
  listStyle: ListStyle;
  onToggle: (key: RunBoolKey) => void;
  onPatch: (patch: RunPatch, command?: string) => void;
  onApplyList: (style: ListStyle) => void;
  onApplyHeading: (level: RunHeading | null) => void;
  onApplyTitleCaption: () => void;
  onSetAlign: (x: TextAlignX, y: TextAlignY) => void;
};

/** The session's parts a product's own key handling reads (livediagram's mind node keys). */
export type LabelKeySession<E extends BoxedElement = BoxedElement> = {
  element: E;
  initialLabel: string;
  editorRef: RefObject<HTMLDivElement | null>;
  syncFromDom: () => void;
  commitNow: () => void;
  handleCancel: () => void;
};

/** A run's span style: its own deltas over the element's text fields, at the label's run sizes. */
export type LabelRunStyle = (
  run: TextRun,
  el: BoxedElement,
  runSizePx: Record<RunSize, number>,
) => CSSProperties;

/** What an editor hands `createLabelEditor`, once, at module scope. */
export type LabelEditorBinding<E extends BoxedElement = BoxedElement> = {
  // The product's label toolbar (its colours, contrast reading and editor context).
  Toolbar: ComponentType<LabelToolbarProps<E>>;
  // Emitted once per applied format command (docs/specs/017-telemetry/telemetry.md): the product's
  // `Element / Changed / TextFormat`.
  trackFormat: (command: string) => void;
  // The run style; the shared `effectiveRunStyle` when absent (livedocuments adds its Text Effects).
  runStyle?: LabelRunStyle;
  // Keys the product handles before the editor's own, called as a hook on every render: `true` from its handler
  // means the key was handled. livediagram's mind node keys.
  useKeyDown?: (session: LabelKeySession<E>) => (e: KeyboardEvent<HTMLDivElement>) => boolean;
  // What Escape runs, handed the editor's commit; the commit itself when absent. livediagram's leaves a
  // placement's selection too.
  onEscape?: (commitNow: () => void) => void;
};
