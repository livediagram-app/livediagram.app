// The subtitle a feature category's social card shows (app/features/[slug]/opengraph-image.tsx). The
// card sets it at 32px in an 880px column, so about fifty characters a line; past two lines it runs
// into the footer pill. The first sentence is used when it fits, otherwise the text is cut at the last
// whole word that fits, so the card never ends mid-word.
export const CARD_SUBTITLE_MAX = 100;

export function cardSubtitle(text: string, max = CARD_SUBTITLE_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const sentence = clean.match(/^.+?[.!?](?=\s)/)?.[0];
  if (sentence && sentence.length <= max) return sentence;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  const words = (space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, '');
  return `${words}…`;
}
