// What a person wrote, without what they replied to (liveworkspace/docs/specs/003-accounts/inbound-email.md "Quoted
// replies"): a line-by-line scan from the top that cuts at the first quote opener, a `>` run reaching the end, or a
// signature. Plain string checks, no pattern that can backtrack, so a hostile body costs time in its length only.

// A line of this many underscores or more opens Outlook's quoted header block.
const RULE_MIN = 16;

const isWrote = (line: string) => line.endsWith('wrote:') || line.endsWith('a écrit :');

function opensQuote(lines: readonly string[], i: number): boolean {
  const line = lines[i]!.trim();
  if (line.startsWith('On ') && (isWrote(line) || isWrote((lines[i + 1] ?? '').trim())))
    return true;
  if (line.startsWith('Le ') && isWrote(line)) return true;
  if (line.toLowerCase() === '-----original message-----') return true;
  if (line.startsWith('From:') && i > 0 && lines[i - 1]!.trim() === '') return true;
  if (line.length >= RULE_MIN && [...line].every((c) => c === '_')) return true;
  return false;
}

const isSignature = (line: string) => line === '-- ' || line === '--';

/** The text with its quoted reply and signature cut off; the text as it was when that would leave nothing. */
export function stripQuotedReply(text: string): string {
  const lines = text.split('\n').map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (isSignature(lines[i]!) || opensQuote(lines, i)) {
      cut = i;
      break;
    }
  }
  // A run of `>` lines (blank lines between allowed) reaching the end of what is left.
  let tail = cut;
  while (tail > 0) {
    const line = lines[tail - 1]!.trim();
    if (line === '' || line.startsWith('>')) tail--;
    else break;
  }
  if (tail < cut && lines.slice(tail, cut).some((l) => l.trim().startsWith('>'))) cut = tail;
  while (cut > 0 && lines[cut - 1]!.trim() === '') cut--;
  const kept = lines.slice(0, cut).join('\n').trim();
  return kept === '' ? text.trim() : kept;
}
