// An article's footnotes (docs/specs/007-editor/article-pages.md "Footnotes"): a reference is a run carrying its
// note's text (`fn`), one reference a character of the run's text, so the note moves, syncs and undoes with the text
// it sits in. Numbered through the article in the writing's order, never stored. Pure.
import type { ArticleRun } from './article-flow';

// The longest note: plain text, about a dozen lines at the foot of a page.
export const MAX_ARTICLE_FOOTNOTE_TEXT = 1000;
// The character a reference holds in its run. A reader that knows no footnotes (an older client, a plain-text view)
// shows an asterisk where the reference is.
export const ARTICLE_FOOTNOTE_REF = '*';

/** A note's text as stored: plain, one line (any line break or tab a space), at most MAX_ARTICLE_FOOTNOTE_TEXT
 *  characters. Never a half emoji at the cut. */
export function cleanFootnoteText(v: string): string {
  let text = v.replace(/[\r\n\t\u2028\u2029]/g, ' ');
  if (text.length > MAX_ARTICLE_FOOTNOTE_TEXT) {
    const code = text.charCodeAt(MAX_ARTICLE_FOOTNOTE_TEXT - 1);
    const end =
      code >= 0xd800 && code <= 0xdbff ? MAX_ARTICLE_FOOTNOTE_TEXT - 1 : MAX_ARTICLE_FOOTNOTE_TEXT;
    text = text.slice(0, end);
  }
  return text;
}

/** A block's text as read: its runs' text, footnote references left out. */
export const articleRunsText = (runs: readonly ArticleRun[]): string =>
  runs.map((r) => (r.fn === undefined ? r.text : '')).join('');

/** One footnote of an article: its number (1 first, through the article) and its note. */
export type ArticleFootnote = { n: number; text: string };

type RunsHolder = {
  type: string;
  runs?: readonly ArticleRun[];
  rows?: readonly { cells: readonly (readonly ArticleRun[])[] }[];
};

/** Every footnote of the writing in order, numbered 1, 2, 3: each block's runs, a table's cells row by row. */
export function articleFootnotes(blocks: readonly RunsHolder[]): ArticleFootnote[] {
  const out: ArticleFootnote[] = [];
  const read = (runs: readonly ArticleRun[]) => {
    for (const r of runs) {
      if (r.fn === undefined) continue;
      for (let i = 0; i < r.text.length; i++) out.push({ n: out.length + 1, text: r.fn });
    }
  };
  for (const b of blocks) {
    if (b.runs) read(b.runs);
    else if (b.type === 'table')
      for (const row of b.rows ?? []) for (const cell of row.cells) read(cell);
  }
  return out;
}
