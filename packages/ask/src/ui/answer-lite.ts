// An answer's light Markdown as Ask AI draws it in Tools (liveworkspace/docs/specs/019-ask/ask.md "What an answer
// shows"): paragraphs and lists, with bold and code text and the citation chips. The tool is 480 px wide and its
// answers are short, so this reads only what such an answer uses; anything else stays the characters it was. Nothing
// is ever HTML, and nothing the model writes is a link. Pure, and linear in the answer.
import { answerParts } from '../answer-parts';

export type LiteInline =
  { kind: 'text'; text: string; b?: true; code?: true } | { kind: 'cite'; number: number };
export type LiteBlock =
  | { kind: 'paragraph'; heading: boolean; inline: LiteInline[] }
  | { kind: 'list'; ordered: boolean; items: LiteInline[][] };

// Bold and code runs: each closes on its own line, so an unclosed mark stays the characters it was.
const MARKED = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

function inlineOf(text: string, cited: ReadonlySet<number>): LiteInline[] {
  const out: LiteInline[] = [];
  for (const piece of text.split(MARKED)) {
    if (!piece) continue;
    if (piece.length > 2 && piece.startsWith('`') && piece.endsWith('`')) {
      // Code is the characters it is: `[1]` inside it names no passage.
      out.push({ kind: 'text', text: piece.slice(1, -1), code: true });
    } else if (piece.length > 4 && piece.startsWith('**') && piece.endsWith('**')) {
      for (const part of answerParts(piece.slice(2, -2), cited))
        out.push(part.kind === 'cite' ? part : { ...part, b: true });
    } else {
      out.push(...answerParts(piece, cited));
    }
  }
  return out;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/** The answer as blocks to draw. `cited` are the source numbers the answer came with: only those become chips. */
export function answerLite(text: string, cited: ReadonlySet<number>): LiteBlock[] {
  const blocks: LiteBlock[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({
      kind: 'paragraph',
      heading: false,
      inline: inlineOf(paragraph.join('\n'), cited),
    });
    paragraph = [];
  };
  for (const line of text.split('\n')) {
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      endParagraph();
      const ordered = !bullet;
      const last = blocks[blocks.length - 1];
      const inline = inlineOf(item[1]!, cited);
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(inline);
      else blocks.push({ kind: 'list', ordered, items: [inline] });
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      endParagraph();
      blocks.push({ kind: 'paragraph', heading: true, inline: inlineOf(heading[1]!, cited) });
    } else if (line.trim() === '') {
      endParagraph();
    } else {
      paragraph.push(line.trim());
    }
  }
  endParagraph();
  return blocks;
}
