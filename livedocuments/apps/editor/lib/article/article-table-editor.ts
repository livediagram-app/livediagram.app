// What tables and contents blocks add to the writing's editor (ArticleEditor), in one place so the editor
// only spreads them in: their plugins, their node views, the paste composed over the writing's own, and a
// contents entry's jump to its heading.
import { Selection, type Plugin } from 'prosemirror-state';
import type { DirectEditorProps, EditorView, NodeViewConstructor } from 'prosemirror-view';
import { isInTable, tableEditing } from 'prosemirror-tables';
import { track } from '@/lib/telemetry';
import { tableColsPlugin, tableKeymap } from './article-table-plugins';
import { repeatHeaderPlugin } from './article-table-repeat';
import { ArticleTableView } from './article-table-view';
import { TocView, tocPlugin } from './article-toc-view';
import {
  normalisePastedTables,
  pasteIntoCell,
  trackTablePaste,
  tsvGrid,
  tsvSlice,
} from './article-table-paste';

/** What this person may do in the writing now, read as it is needed. */
export type TableRights = { editable: () => boolean; reshape: () => boolean };

/** The table keys: before the writing's own keymap (Tab, Enter and Backspace mean other things in a cell). */
export const tableKeyPlugins = (rights: TableRights): Plugin[] => [
  tableKeymap(() => rights.editable() && rights.reshape()),
];

/** The rest: columns and rows kept in order, cell selection, the repeated header rows and the contents. */
export const tablePlugins = (): Plugin[] => [
  tableColsPlugin,
  tableEditing({ allowTableNodeSelection: false }),
  repeatHeaderPlugin,
  tocPlugin,
];

/** A press on a contents entry: the caret at its heading's start for someone writing, else the heading
 *  brought into view (`reveal`, a canvas rect from a screen rect). */
export function jumpToHeading(
  view: EditorView,
  id: string,
  editable: boolean,
  reveal: (screen: DOMRect) => void,
): void {
  let at = -1;
  view.state.doc.forEach((node, pos) => {
    if (at < 0 && node.attrs.id === id) at = pos;
  });
  if (at < 0) return;
  if (editable) {
    view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(at + 1))));
    view.focus();
  }
  const el = view.nodeDOM(at) as HTMLElement | null;
  const r = el?.getClientRects()[0];
  if (r) reveal(r);
}

export function tableNodeViews(
  rights: TableRights,
  onJump: (view: EditorView, id: string) => void,
): Record<'table' | 'toc', NodeViewConstructor> {
  const reshape = () => rights.editable() && rights.reshape();
  return {
    table: (node, view, getPos) =>
      new ArticleTableView(node, view, getPos, reshape, () =>
        track('Element', 'Changed', 'ArticleTableShape'),
      ),
    toc: (node, view, getPos, decorations) =>
      new TocView(node, view, getPos, decorations, {
        editable: rights.editable,
        reshape,
        onJump: (id) => onJump(view, id),
      }),
  };
}

type PasteProps = Pick<
  DirectEditorProps,
  'transformPastedHTML' | 'clipboardTextParser' | 'handlePaste'
>;

/** The writing's paste (`base`) with tables composed over it: pasted HTML tables made plain, tab-separated
 *  text made a table, and a paste into a cell kept to the cell (or prosemirror-tables' to fill cells). */
export function articleTablePasteProps(base: PasteProps): PasteProps {
  return {
    transformPastedHTML: (html, view) =>
      normalisePastedTables(base.transformPastedHTML ? base.transformPastedHTML(html, view) : html),
    clipboardTextParser: (text, $context, plain, view) => {
      if (!$context.parent.type.spec.code) {
        const table = tsvSlice(text);
        if (table) return table;
      }
      return base.clipboardTextParser?.(text, $context, plain, view) as ReturnType<
        NonNullable<PasteProps['clipboardTextParser']>
      >;
    },
    handlePaste: (view, event, slice) => {
      if (isInTable(view.state)) return pasteIntoCell(view, slice);
      trackTablePaste(slice, false);
      const data = event.clipboardData;
      // Tab-separated text is the text parser's (a table), never the writing's lines.
      if (data && !data.types.includes('text/html') && tsvGrid(data.getData('text/plain')))
        return false;
      return base.handlePaste?.(view, event, slice) ?? false;
    },
  };
}
