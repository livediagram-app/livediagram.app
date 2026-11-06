// The notes at the foot of each page (docs/specs/007-editor/article-pages.md "Footnotes"): one box per page holding
// footnotes, under a short rule, each note its number then its text, laid over the page's foot in canvas space beside
// the writing (the writing's text ends above it: article-footnote-layout.ts). The text is edited in place by anyone
// who may write, and committed to its reference as they leave it. Drawn imperatively, as the writing is: a box is
// reused as the layout changes, and a note being typed in is never redrawn under the caret.
import { cleanFootnoteText, MAX_ARTICLE_FOOTNOTE_TEXT } from '@livedocuments/document';

/** One page's notes and where they sit: canvas px, the box's foot at `bottom` (the text area's foot). */
export type NotePage = {
  index: number;
  x: number;
  bottom: number;
  width: number;
  maxHeight: number;
  notes: readonly { n: number; text: string }[];
};

export type NotesHost = {
  // Whether the person may write (and so edit a note).
  editable: () => boolean;
  // A note's text as left: written to its reference when it changed.
  commit: (n: number, text: string) => void;
  // Escape: the caret back after the reference.
  leave: (n: number) => void;
  // A note's text changed as typed: its height may have.
  resize: () => void;
  // A press on a note: the canvas's selection goes, as for a press on the writing.
  press: () => void;
};

// `plaintext-only` keeps a paste plain; a browser without it takes `true`, its paste read as text all the same.
let editableValue: string | null = null;
function plainEditable(): string {
  if (editableValue !== null) return editableValue;
  try {
    const probe = document.createElement('span');
    probe.contentEditable = 'plaintext-only';
    editableValue = probe.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true';
  } catch {
    editableValue = 'true';
  }
  return editableValue;
}

const TEXT = 'article-footnote-text';
const noteOf = (target: EventTarget | null): HTMLElement | null =>
  target instanceof Element ? target.closest<HTMLElement>(`.${TEXT}`) : null;
const numberOf = (text: HTMLElement): number => Number(text.closest<HTMLElement>('li')?.dataset.n);

function boxOf(): HTMLElement {
  const box = document.createElement('aside');
  box.className = 'article-footnotes';
  box.setAttribute('aria-label', 'Footnotes');
  const rule = document.createElement('hr');
  rule.className = 'article-footnotes-rule';
  rule.setAttribute('aria-hidden', 'true');
  const list = document.createElement('ol');
  list.className = 'article-footnotes-list';
  box.append(rule, list);
  return box;
}

function itemOf(): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'article-footnote';
  const n = document.createElement('span');
  n.className = 'article-footnote-n';
  const text = document.createElement('span');
  text.className = TEXT;
  text.dataset.placeholder = 'Footnote';
  li.append(n, text);
  return li;
}

export class FootnoteNotes {
  readonly host: HTMLDivElement;
  private boxes: HTMLElement[] = [];
  private probe: HTMLElement;
  private heights = new Map<string, number>();
  private head = 0;
  private sig = '';
  private vars = '';
  private readonly on: NotesHost;

  constructor(parent: HTMLElement, on: NotesHost) {
    this.on = on;
    this.host = document.createElement('div');
    this.host.className = 'article-footnotes-host';
    this.probe = boxOf();
    this.probe.classList.add('article-footnotes-probe');
    this.probe.setAttribute('aria-hidden', 'true');
    this.host.append(this.probe);
    parent.append(this.host);
    this.host.addEventListener('pointerdown', this.onPress);
    this.host.addEventListener('keydown', this.onKey);
    this.host.addEventListener('beforeinput', this.onBeforeInput);
    this.host.addEventListener('input', this.onInput);
    this.host.addEventListener('focusout', this.onLeave);
  }

  /** The writing's look (its CSS variables), so the notes take its fonts, size and colours. */
  setVars(from: HTMLElement): void {
    const parts: string[] = [];
    for (let i = 0; i < from.style.length; i++) {
      const name = from.style.item(i);
      if (name.startsWith('--')) parts.push(`${name}: ${from.style.getPropertyValue(name)}`);
    }
    const vars = parts.join('; ');
    if (vars === this.vars) return;
    this.vars = vars;
    this.host.setAttribute('style', vars);
  }

  /** How tall the box is with no notes (its rule and space), and each note's height, at `width` (canvas px). Measured
   *  once per text and look, all new ones in one layout. */
  heightsOf(texts: readonly string[], width: number): { head: number; notes: number[] } {
    const sig = `${width}|${this.vars}`;
    if (sig !== this.sig) {
      this.sig = sig;
      this.heights.clear();
      this.probe.style.width = `${width}px`;
      this.head = -1;
    }
    const list = this.probe.querySelector('ol')!;
    const fresh = [...new Set(texts.filter((t) => !this.heights.has(t)))];
    if (fresh.length > 0 || this.head < 0) {
      const items = fresh.map((t) => {
        const li = itemOf();
        li.lastElementChild!.textContent = t;
        li.firstElementChild!.textContent = '99';
        return li;
      });
      list.replaceChildren(...items);
      items.forEach((li, i) => this.heights.set(fresh[i]!, li.offsetHeight));
      list.replaceChildren();
      this.head = this.probe.offsetHeight;
    }
    return { head: this.head, notes: texts.map((t) => this.heights.get(t) ?? 0) };
  }

  /** The note being typed in: its number and its text as it stands, or null. */
  editing(): { n: number; text: string } | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !active.classList.contains(TEXT)) return null;
    if (!this.host.contains(active)) return null;
    return { n: numberOf(active), text: active.textContent ?? '' };
  }

  /** Draws the pages' notes, reusing the boxes there. */
  render(pages: readonly NotePage[]): void {
    const editable = this.on.editable();
    while (this.boxes.length > pages.length) this.boxes.pop()!.remove();
    while (this.boxes.length < pages.length) {
      const box = boxOf();
      this.host.append(box);
      this.boxes.push(box);
    }
    pages.forEach((page, i) => {
      const box = this.boxes[i]!;
      box.dataset.page = String(page.index);
      box.style.left = `${page.x}px`;
      box.style.top = `${page.bottom}px`;
      box.style.width = `${page.width}px`;
      box.style.maxHeight = `${page.maxHeight}px`;
      const list = box.querySelector('ol')!;
      while (list.children.length > page.notes.length) list.lastElementChild!.remove();
      while (list.children.length < page.notes.length) list.append(itemOf());
      page.notes.forEach((note, k) => {
        const li = list.children[k] as HTMLLIElement;
        const label = li.firstElementChild!;
        const text = li.lastElementChild as HTMLElement;
        const typing = document.activeElement === text;
        if (li.dataset.n !== String(note.n)) li.dataset.n = String(note.n);
        if (label.textContent !== String(note.n)) label.textContent = String(note.n);
        if (!typing && text.textContent !== note.text) text.textContent = note.text;
        const value = editable ? plainEditable() : 'false';
        if (text.getAttribute('contenteditable') !== value)
          text.setAttribute('contenteditable', value);
        // To a writer each note is a field named by its number; to a reader, its number then its text.
        if (editable) {
          text.setAttribute('role', 'textbox');
          text.setAttribute('aria-label', `Footnote ${note.n}`);
          label.setAttribute('aria-hidden', 'true');
        } else {
          text.removeAttribute('role');
          text.removeAttribute('aria-label');
          label.removeAttribute('aria-hidden');
        }
      });
    });
  }

  /** Puts the caret at the end of note `n`'s text; false when it is not drawn. */
  focus(n: number): boolean {
    const li = this.host.querySelector<HTMLElement>(`li.article-footnote[data-n="${n}"]`);
    const text = li?.querySelector<HTMLElement>(`.${TEXT}`);
    if (!text || text.getAttribute('contenteditable') === 'false') return false;
    text.focus({ preventScroll: true });
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(text);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    return true;
  }

  /** The boxes drawn, for an export. */
  roots(): HTMLElement[] {
    return [...this.boxes];
  }

  destroy(): void {
    this.host.removeEventListener('pointerdown', this.onPress);
    this.host.removeEventListener('keydown', this.onKey);
    this.host.removeEventListener('beforeinput', this.onBeforeInput);
    this.host.removeEventListener('input', this.onInput);
    this.host.removeEventListener('focusout', this.onLeave);
    this.host.remove();
  }

  // A press on a note is the note's: never the canvas's (a marquee, a pan, an element beneath).
  private onPress = (e: PointerEvent) => {
    e.stopPropagation();
    this.on.press();
  };

  private onKey = (e: KeyboardEvent) => {
    const text = noteOf(e.target);
    if (!text) return;
    // The canvas's shortcuts never see a key typed into a note.
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      text.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      const n = numberOf(text);
      this.on.commit(n, cleanFootnoteText(text.textContent ?? ''));
      this.on.leave(n);
    }
  };

  // One line: a line break is never typed into a note.
  private onBeforeInput = (e: InputEvent) => {
    if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') e.preventDefault();
  };

  private onInput = (e: Event) => {
    const text = noteOf(e.target);
    if (!text) return;
    const typed = text.textContent ?? '';
    if (typed.length > MAX_ARTICLE_FOOTNOTE_TEXT || /[\r\n]/.test(typed)) {
      text.textContent = cleanFootnoteText(typed);
      this.focus(numberOf(text));
    }
    this.on.resize();
  };

  private onLeave = (e: FocusEvent) => {
    const text = noteOf(e.target);
    if (text) this.on.commit(numberOf(text), cleanFootnoteText(text.textContent ?? ''));
  };
}
