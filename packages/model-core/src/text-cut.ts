// A name or short text cut to its cap (a page's, a component's, a tag's): at most `max` UTF-16 units, as every
// validator counts them, but never between the two halves of an emoji's surrogate pair. A plain `slice` there left a
// lone high surrogate, which draws as a replacement box and is stored as U+FFFD once the text is encoded. The one cut
// every product's capped names, labels, tags and participant names go through (first written in livedesign).

/** `text` cut to at most `max` UTF-16 units, one short when the cut would split a surrogate pair. */
export function cutText(text: string, max: number): string {
  if (text.length <= max) return text;
  const end = max > 0 && isHighSurrogate(text.charCodeAt(max - 1)) ? max - 1 : max;
  return text.slice(0, Math.max(0, end));
}

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
