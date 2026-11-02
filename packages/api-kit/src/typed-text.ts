// Free text people type that a Worker keeps and every app shows: accounts' token names, team names and organisations,
// account names and display names, the index's webhook names and the MCP servers' registered client names
// (liveworkspace/docs/specs/003-accounts/accounts.md "Names and other typed text").

// The explicit bidi embeddings, overrides and isolates (LRE, RLE, PDF, LRO, RLO, LRI, RLI, FSI, PDI). One left open
// turns the text drawn after it around too ("\u202Eevil org · 1 member" reads "rebmem 1 · gro live"), and an override
// can make one address or name look like another. Right-to-left letters need none of them: they lay themselves out.
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

/** The text without any bidi embedding, override or isolate character. */
export function withoutBidiControls(value: string): string {
  return value.replace(BIDI_CONTROLS, '');
}

let segmenter: Intl.Segmenter | null = null;

/** At most `max` UTF-16 units (what a field's `maxLength` counts), cut between whole characters: never half an
 *  emoji's surrogate pair, never part of a joined emoji or a letter and its accents. */
export function clipText(value: string, max: number): string {
  if (value.length <= max) return value;
  segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let end = 0;
  for (const { segment } of segmenter.segment(value)) {
    if (end + segment.length > max) break;
    end += segment.length;
  }
  return value.slice(0, end);
}

// What a name may not start or end with: spaces and the characters that draw nothing (zero-width spaces and
// joiners, word joiners, byte order marks, soft hyphens and the rest of Unicode's format characters). Left at an
// end, they make a name that looks blank (a team called only "\u200B" is a nameless row in every sidebar), or two
// names that look the same and aren't.
const EDGE = /[\s\p{Cf}]/u;

/** The text without spaces or invisible formatting characters at either end, found by a scan from each end. */
export function trimInvisible(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && EDGE.test(value[start]!)) start += 1;
  while (end > start && EDGE.test(value[end - 1]!)) end -= 1;
  return value.slice(start, end);
}

/** A typed name as it is kept: bidi controls out, trimmed of spaces and invisible characters, clipped to `max`
 *  between whole characters. */
export function cleanText(value: string, max: number): string {
  return trimInvisible(clipText(trimInvisible(withoutBidiControls(value)), max));
}
