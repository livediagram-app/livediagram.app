// The writing's keys and Markdown-as-you-type (docs/specs/007-editor/document-pages.md "Writing").
// Undo and redo are the editor's own history (the host's), never ProseMirror's: the writing commits
// into the same history as every other edit.
import { InputRule, inputRules, undoInputRule } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap, chainCommands } from 'prosemirror-commands';
import { NodeSelection, TextSelection, type Command, type Plugin } from 'prosemirror-state';
import type { MarkType } from 'prosemirror-model';
import type { DocParagraphStyle } from '@livediagram/document';
import { docSchema } from './doc-schema';
import {
  backspaceAtStart,
  clearFormatting,
  deleteAtEnd,
  enter,
  lineBreak,
  selectAll,
  setAlign,
  setBlockStyle,
  shiftTab,
  tab,
  toggleBold,
  toggleCode,
  toggleItalic,
  toggleList,
  toggleStrike,
  toggleUnderline,
} from './doc-commands';

const S = docSchema;

// A block-start pattern turned into a block, the typed characters going.
function blockRule(pattern: RegExp, make: (m: RegExpMatchArray) => Command): InputRule {
  return new InputRule(pattern, (state, match, start, end) => {
    const $start = state.doc.resolve(start);
    // Only at the start of a body paragraph (or any paragraph for a list): not inside code.
    if ($start.parent.type !== S.nodes.paragraph) return null;
    if ($start.parentOffset !== 0) return null;
    let tr = state.tr.delete(start, end);
    const after = state.apply(tr);
    const command = make(match);
    let out = null as typeof tr | null;
    command(after, (t) => {
      out = t;
    });
    if (!out) return null;
    // One transaction: the deletion, then the change on top.
    for (const step of (out as typeof tr).steps) tr = tr.step(step);
    tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(start)));
    return tr;
  });
}

const style = (s: DocParagraphStyle): Command => setBlockStyle(s);

// A closing mark typed after its text (`**bold**`, `*italic*`, `~~struck~~`, `` `code` ``): the
// markers go and the text takes the mark. The pattern's group 1 is the text; the match ends with
// the closing marker, whose last character is being typed (not yet in the document).
function markRule(pattern: RegExp, type: MarkType, markerLen: number): InputRule {
  return new InputRule(pattern, (state, match, start, end) => {
    const whole = match[0];
    const inner = match[1];
    if (!inner) return null;
    if (state.doc.resolve(start).parent.type === S.nodes.code_block) return null;
    const openStart = start + whole.length - 2 * markerLen - inner.length;
    const innerStart = openStart + markerLen;
    const tr = state.tr;
    tr.delete(innerStart + inner.length, end);
    tr.delete(openStart, innerStart);
    tr.addMark(openStart, openStart + inner.length, type.create());
    tr.removeStoredMark(type);
    return tr;
  });
}

function dividerRule(): InputRule {
  return new InputRule(/^(---|\*\*\*|___)$/, (state, _m, start, end) => {
    const $start = state.doc.resolve(start);
    if ($start.parent.type !== S.nodes.paragraph || $start.parentOffset !== 0) return null;
    const blockStart = $start.before(1);
    const blockEnd = $start.after(1);
    // The whole paragraph is the two characters typed so far.
    if ($start.parent.content.size !== end - start) return null;
    const tr = state.tr.replaceWith(blockStart, blockEnd, [
      S.nodes.divider!.create(),
      S.nodes.paragraph!.create(),
    ]);
    tr.setSelection(TextSelection.create(tr.doc, blockStart + 2));
    return tr;
  });
}

export function docInputRules(): Plugin {
  return inputRules({
    rules: [
      blockRule(/^#\s$/, () => style('h1')),
      blockRule(/^##\s$/, () => style('h2')),
      blockRule(/^###\s$/, () => style('h3')),
      blockRule(/^>\s$/, () => style('quote')),
      blockRule(/^[-*+]\s$/, () => toggleList('bullet')),
      blockRule(/^1[.)]\s$/, () => toggleList('numbered')),
      blockRule(
        /^\[( |x|X)?\]\s$/,
        (m) => (state, dispatch) =>
          toggleList('todo')(state, (tr) => {
            if (m[1] && m[1] !== ' ') {
              const pos = state.selection.$from.before(1);
              tr.setNodeAttribute(pos, 'checked', true);
            }
            dispatch?.(tr);
          }),
      ),
      blockRule(/^```$/, () => setBlockStyle('code')),
      dividerRule(),
      markRule(/\*\*([^*]+)\*\*$/, S.marks.bold!, 2),
      markRule(/(?:^|[^*])\*([^*\s][^*]*)\*$/, S.marks.italic!, 1),
      markRule(/(?:^|[^_\w])_([^_\s][^_]*)_$/, S.marks.italic!, 1),
      markRule(/~~([^~]+)~~$/, S.marks.strike!, 2),
      markRule(/`([^`]+)`$/, S.marks.code!, 1),
    ],
  });
}

export function docKeymap(host: {
  undo: () => void;
  redo: () => void;
  onLink: () => void;
  onEscape: () => void;
}): Plugin[] {
  const run =
    (fn: () => void): Command =>
    () => {
      fn();
      return true;
    };
  return [
    keymap({
      Enter: enter,
      'Shift-Enter': lineBreak,
      Backspace: chainCommands(undoInputRule, backspaceAtStart),
      Delete: deleteAtEnd,
      Tab: tab,
      'Shift-Tab': shiftTab,
      'Mod-b': toggleBold,
      'Mod-i': toggleItalic,
      'Mod-u': toggleUnderline,
      'Mod-Shift-x': toggleStrike,
      'Mod-e': toggleCode,
      'Mod-k': run(host.onLink),
      'Mod-Alt-0': setBlockStyle('body'),
      'Mod-Alt-1': setBlockStyle('h1'),
      'Mod-Alt-2': setBlockStyle('h2'),
      'Mod-Alt-3': setBlockStyle('h3'),
      'Mod-Shift-7': toggleList('numbered'),
      'Mod-Shift-8': toggleList('bullet'),
      'Mod-Shift-9': toggleList('todo'),
      'Mod-Shift-l': setAlign('left'),
      'Mod-Shift-e': setAlign('center'),
      'Mod-Shift-r': setAlign('right'),
      'Mod-Shift-j': setAlign('justify'),
      'Mod-\\': clearFormatting,
      'Mod-a': selectAll,
      'Mod-z': run(host.undo),
      'Mod-Shift-z': run(host.redo),
      'Mod-y': run(host.redo),
      Escape: run(host.onEscape),
    }),
    keymap(baseKeymap),
  ];
}

export { NodeSelection };
