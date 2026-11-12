// A Word document's footnotes read as plain text, for the body's footnote references (docx.ts; docs/specs/007-editor/
// article-pages.md "Footnotes"). Split out of docx.ts, which re-exports readFootnotes.

import { cleanFootnoteText } from '@livedocuments/document';
import { readStyles, runHidden, type DocxStyles } from './docx-styles';
import { child, findAll, kids, textOf, type XmlElement } from './xml';

/** A document's footnotes by id, each its paragraphs' text as one plain line (the separators Word keeps there are
 *  left out). */
export function readFootnotes(
  root: XmlElement | undefined,
  styles: DocxStyles = readStyles(undefined),
): Map<string, string> {
  const out = new Map<string, string>();
  for (const note of kids(root)) {
    const id = note.attrs['w:id'];
    if (note.name !== 'w:footnote' || !id || note.attrs['w:type']) continue;
    const paragraphs = findAll(note, 'w:p').map((p) => footnoteText(p, styles));
    const text = cleanFootnoteText(paragraphs.join(' ').trim());
    out.set(id, text);
  }
  return out;
}

/** A footnote paragraph's shown text, read as the body's is: tabs and breaks a space, text a tracked change deletes
 *  or moves away and hidden runs left out. A paragraph or table nested inside adds nothing here: `findAll` reads
 *  each paragraph on its own. */
function footnoteText(el: XmlElement, styles: DocxStyles): string {
  let text = '';
  for (const c of kids(el)) {
    if (c.name === 'w:r') {
      if (runHidden(child(c, 'w:rPr'), styles)) continue;
      for (const t of kids(c)) {
        if (t.name === 'w:t') text += textOf(t);
        else if (FOOTNOTE_SPACES.has(t.name)) text += ' ';
        else if (t.name === 'w:noBreakHyphen') text += '-';
      }
    } else if (!FOOTNOTE_SKIPPED.has(c.name)) text += footnoteText(c, styles);
  }
  return text;
}
const FOOTNOTE_SKIPPED = new Set(['w:p', 'w:tbl', 'w:del', 'w:moveFrom', 'w:pPr', 'mc:Fallback']);
const FOOTNOTE_SPACES = new Set(['w:tab', 'w:ptab', 'w:br', 'w:cr']);
