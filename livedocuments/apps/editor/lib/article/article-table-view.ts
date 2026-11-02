// A table in the writing as drawn (docs/specs/007-editor/article-pages.md "Tables"): a real table whose
// rows the stylesheet lays as grids on the columns' shares, so each row is an ordinary block in the
// writing's columns and a long table splits between rows like text. For someone who may reshape,
// hovering the line between two columns shows a resize grip; dragging it moves width between those two
// columns, previewed on the table alone and written as one edit on release (Escape puts it back).
import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView, NodeView, ViewMutationRecord } from 'prosemirror-view';
import {
  ARTICLE_TABLE_MIN_SHARE,
  normaliseShares,
  type ArticleTableColumn,
} from '@livedocuments/document';

// How close (screen px) to a column line the pointer must be to take its grip.
const GRIP_REACH = 5;

const sharesOf = (node: PMNode): number[] =>
  (Array.isArray(node.attrs.cols) ? (node.attrs.cols as ArticleTableColumn[]) : []).map((c) => c.w);

/** The grid template for a table's columns: their shares as fractions. */
export function columnTemplate(shares: readonly number[]): string {
  return shares.length ? shares.map((w) => `${Math.max(0.0001, w)}fr`).join(' ') : '1fr';
}

/** The column line (1 to n-1) within `reach` of `x` across a row `width` wide, or 0 for none. */
export function gripAt(shares: readonly number[], x: number, width: number, reach: number): number {
  let edge = 0;
  for (let i = 0; i < shares.length - 1; i++) {
    edge += shares[i]!;
    if (Math.abs(x - edge * width) <= reach) return i + 1;
  }
  return 0;
}

/** Shares with `delta` (a share of the width) moved across line `line` (between columns line-1 and
 *  line), each of the two kept at ARTICLE_TABLE_MIN_SHARE or more. */
export function sharesDragged(shares: readonly number[], line: number, delta: number): number[] {
  const a = shares[line - 1]!;
  const b = shares[line]!;
  const d = Math.max(ARTICLE_TABLE_MIN_SHARE - a, Math.min(b - ARTICLE_TABLE_MIN_SHARE, delta));
  return shares.map((w, i) => (i === line - 1 ? a + d : i === line ? b - d : w));
}

type Drag = { line: number; startX: number; width: number; from: number[]; now: number[] };

export class ArticleTableView implements NodeView {
  dom: HTMLTableElement;
  contentDOM: HTMLElement;
  private node: PMNode;
  private drag: Drag | null = null;
  private view: EditorView;
  private getPos: () => number | undefined;
  private canReshape: () => boolean;
  private onResized: () => void;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    // Whether this person may reshape the table (an Editor on an unlocked article).
    canReshape: () => boolean,
    // A width written (the table's columns resized), for telemetry.
    onResized: () => void,
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.canReshape = canReshape;
    this.onResized = onResized;
    this.dom = document.createElement('table');
    this.dom.className = 'article-block article-table';
    this.contentDOM = this.dom.appendChild(document.createElement('tbody'));
    this.render();
    this.dom.addEventListener('pointermove', this.onMove);
    this.dom.addEventListener('pointerleave', this.onLeave);
    this.dom.addEventListener('pointerdown', this.onDown);
  }

  private render(): void {
    const id = this.node.attrs.id as string;
    if (id) this.dom.dataset.blockId = id;
    else delete this.dom.dataset.blockId;
    const first = this.node.firstChild;
    let header = !!first && first.childCount > 0;
    first?.forEach((c) => {
      if (c.type.name !== 'table_header') header = false;
    });
    if (header) this.dom.dataset.header = '';
    else delete this.dom.dataset.header;
    this.setTemplate(this.drag?.now ?? sharesOf(this.node));
  }

  private setTemplate(shares: readonly number[]): void {
    this.dom.style.setProperty('--article-table-cols', columnTemplate(shares));
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }

  // The table's own attributes (its template, the grip's place) are the view's, never the writing's.
  ignoreMutation(m: ViewMutationRecord): boolean {
    return m.type === 'attributes' && m.target === this.dom;
  }

  // A press on a grip, and the drag after it, are the grip's alone.
  stopEvent(e: Event): boolean {
    return (
      this.drag !== null || (e.type.startsWith('pointer') && this.dom.dataset.grip !== undefined)
    );
  }

  destroy(): void {
    this.dom.removeEventListener('pointermove', this.onMove);
    this.dom.removeEventListener('pointerleave', this.onLeave);
    this.dom.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('keydown', this.onKey, true);
  }

  // The row under the pointer: where the column lines are on screen.
  private rowAt(e: PointerEvent): DOMRect | null {
    const row = (e.target as Element | null)?.closest?.('tr');
    return row && this.dom.contains(row) ? row.getBoundingClientRect() : null;
  }

  private showGrip(line: number, shares: readonly number[]): void {
    if (line === 0) {
      delete this.dom.dataset.grip;
      return;
    }
    const at = shares.slice(0, line).reduce((n, w) => n + w, 0);
    this.dom.dataset.grip = String(line);
    this.dom.style.setProperty('--article-grip-x', `${(at * 100).toFixed(3)}%`);
  }

  private onMove = (e: PointerEvent): void => {
    if (this.drag) {
      const d = this.drag;
      d.now = sharesDragged(d.from, d.line, (e.clientX - d.startX) / Math.max(1, d.width));
      this.setTemplate(d.now);
      this.showGrip(d.line, d.now);
      return;
    }
    if (e.pointerType === 'touch' || !this.canReshape() || !this.view.editable) {
      this.showGrip(0, []);
      return;
    }
    const rect = this.rowAt(e);
    const shares = sharesOf(this.node);
    this.showGrip(rect ? gripAt(shares, e.clientX - rect.left, rect.width, GRIP_REACH) : 0, shares);
  };

  private onLeave = (): void => {
    if (!this.drag) this.showGrip(0, []);
  };

  private onDown = (e: PointerEvent): void => {
    const line = Number(this.dom.dataset.grip ?? 0);
    const rect = this.rowAt(e);
    if (!line || !rect || e.button !== 0 || !this.canReshape()) return;
    e.preventDefault();
    e.stopPropagation();
    const from = sharesOf(this.node);
    this.drag = { line, startX: e.clientX, width: rect.width, from, now: from };
    this.dom.setPointerCapture?.(e.pointerId);
    this.dom.addEventListener('pointerup', this.onUp);
    this.dom.addEventListener('pointercancel', this.onCancel);
    window.addEventListener('keydown', this.onKey, true);
  };

  private end(): Drag | null {
    const d = this.drag;
    this.drag = null;
    this.dom.removeEventListener('pointerup', this.onUp);
    this.dom.removeEventListener('pointercancel', this.onCancel);
    window.removeEventListener('keydown', this.onKey, true);
    return d;
  }

  private onUp = (): void => {
    const d = this.end();
    const pos = this.getPos();
    if (!d || pos === undefined) return;
    const shares = normaliseShares(d.now);
    if (shares.every((w, i) => Math.abs(w - d.from[i]!) < 1e-4)) {
      this.render();
      return;
    }
    const cols = (this.node.attrs.cols as ArticleTableColumn[]).map((c, i) => ({
      id: c.id,
      w: shares[i]!,
    }));
    this.view.dispatch(this.view.state.tr.setNodeAttribute(pos, 'cols', cols));
    this.onResized();
  };

  private onCancel = (): void => {
    this.end();
    this.render();
  };

  // Escape mid-drag: the widths as they were, nothing written.
  private onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !this.drag) return;
    e.preventDefault();
    e.stopPropagation();
    this.end();
    this.showGrip(0, []);
    this.render();
  };
}
