// An agent's label held to a heading (docs/specs/024-agents/blueprints/edit-operations.md "Fields and values", EO18):
// a shape's label over LABEL_CAP_MAX keeps its heading, and the edit operations move the whole text into its note.

export const LABEL_CAP_MAX = 40;

// The words that start a clause after a noun phrase: "Orders service WHICH
// creates orders", "Message queue FOR async events". The part before the first
// one is the heading a person would have written.
const CLAUSE_START =
  /\s(?:which|that|who|whom|whose|where|when|for|to|with|by|holding|sending|serving|served|handling|storing|running|using|used|responsible)\s/i;

// Whether `s` is at most `max` characters (code points, as names count them in truncateName: an
// emoji is one, never two). Stops counting past `max`, so a long label costs no more than a short one.
function fitsIn(s: string, max: number): boolean {
  if (s.length <= max) return true;
  let n = 0;
  for (const _ of s) if (++n > max) return false;
  return true;
}

// The first `k` characters of `s`, never ending on half a surrogate pair.
function firstChars(s: string, k: number): string {
  let out = '';
  let n = 0;
  for (const ch of s) {
    if (n++ >= k) break;
    out += ch;
  }
  return out;
}

// A label within `max` characters. When it runs over, bracketed asides go
// first ("Web client (React SPA served from the CDN)" is "Web client"); then
// the heading is the noun phrase before the first clause word, if there is one
// of at least two words; otherwise the text is cut at a word boundary and
// marked with an ellipsis. Returns the text unchanged when it already fits.
//
// The text is untrusted (any API token's changeset reaches it), so every pass is a linear scan:
// the regular expressions these replace backtracked quadratically over a long run of spaces,
// brackets or punctuation.
export function capLabel(text: string, max = LABEL_CAP_MAX): { label: string; cut: boolean } {
  // A label that fits keeps the line breaks it was written with ("App tasks\nECS Fargate"), runs of other space
  // made one; one that is cut is read as one line.
  const lines = text
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
  if (fitsIn(lines, max)) return { label: lines, cut: false };
  const whole = text.replace(/\s+/g, ' ').trim();
  const clean = withoutAsides(whole).trim() || whole;
  if (fitsIn(clean, max)) return { label: clean, cut: true };
  const clause = CLAUSE_START.exec(clean);
  if (clause) {
    const head = trimTrailingPunctuation(clean.slice(0, clause.index));
    if (fitsIn(head, max) && head.includes(' ')) return { label: head, cut: true };
  }
  // Cut by characters, so a surrogate pair is never split into a lone half.
  const room = firstChars(clean, max - 1);
  const space = room.lastIndexOf(' ');
  const head = space > max * 0.5 ? room.slice(0, space) : room;
  return { label: `${trimTrailingPunctuation(head)}…`, cut: true };
}

const OPENERS = new Set(['(', '[']);
const CLOSERS = new Set([')', ']']);
const TRAILING = new Set([',', ';', ':', '.', '-']);
const isSpace = (ch: string) => /\s/.test(ch);

// Every bracketed aside with the whitespace before it: an opener up to the first closer after it,
// of either kind, as `\s*[([][^)\]]*[)\]]` matched. An opener with no closer after it stays.
function withoutAsides(text: string): string {
  const nextCloser = new Array<number>(text.length + 1).fill(-1);
  for (let i = text.length - 1; i >= 0; i -= 1) {
    nextCloser[i] = CLOSERS.has(text[i + 1] ?? '') ? i + 1 : nextCloser[i + 1]!;
  }
  // Characters kept so far; popping the whitespace before an aside costs only what it removes.
  const out: string[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const close = OPENERS.has(text[i]!) ? nextCloser[i]! : -1;
    if (close === -1) {
      out.push(text[i]!);
      continue;
    }
    while (out.length > 0 && isSpace(out[out.length - 1]!)) out.pop();
    i = close;
  }
  return out.join('');
}

// The text without trailing whitespace and `, ; : . -`, as `[\s,;:.-]+$` removed them.
function trimTrailingPunctuation(text: string): string {
  let end = text.length;
  while (end > 0 && (TRAILING.has(text[end - 1]!) || isSpace(text[end - 1]!))) end -= 1;
  return text.slice(0, end);
}
