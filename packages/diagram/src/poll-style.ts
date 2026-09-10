// How a poll's answers are shaped (spec/88).
//
// A LEAF module holding only the vocabulary — no `LivePoll`, which is a wire
// DTO and stays in @livediagram/api-schema beside the tally helpers.
//
// It lives HERE, one package lower, because the style is no longer only a
// wire value: a Session button (spec/105) stores its poll's style on the
// element, so `SessionButtonConfig` — a `Tab` field — needs the union too,
// and @livediagram/diagram cannot import from @livediagram/api-schema (the
// dependency runs the other way). api-schema re-exports `PollStyle` from
// here, so there is one list and both sides read it.

export const POLL_STYLES = ['yesNo', 'yesNoAbstain', 'choice', 'rating', 'text'] as const;

export type PollStyle = (typeof POLL_STYLES)[number];

// `choice` is the only style whose answers the author writes; every other
// style has a fixed set (Yes / No, 1-5, or free text). Callers use this to
// decide whether to ask for an answer list at all, so the "does this poll
// need options" question is answered in one place.
export function pollStyleNeedsOptions(style: PollStyle): boolean {
  return style === 'choice';
}

// The fixed answer sets. `choice` is the only style that reads the author's
// own options; `text` has no tokens at all (answers are free-form, listed
// rather than counted).
const YES_NO = ['Yes', 'No'];
const YES_NO_ABSTAIN = ['Yes', 'No', 'Abstain'];
const RATINGS = ['1', '2', '3', '4', '5'];

// Every answer token a poll of this shape can receive, in display order.
// Empty for a free-text poll, which is the signal to render the answer list
// instead of a bar chart.
//
// Pure, and stated in terms of the STYLE rather than a `LivePoll`, so the
// authoring menus can preview the answers a style produces before a poll
// exists — api-schema's `pollOptionTokens` is this function applied to a
// running poll.
export function pollStyleTokens(style: PollStyle, options: readonly string[] = []): string[] {
  switch (style) {
    case 'yesNo':
      return [...YES_NO];
    case 'yesNoAbstain':
      return [...YES_NO_ABSTAIN];
    case 'rating':
      return [...RATINGS];
    case 'choice':
      return [...options];
    case 'text':
      return [];
  }
}

export function isPollStyle(value: unknown): value is PollStyle {
  return typeof value === 'string' && (POLL_STYLES as readonly string[]).includes(value);
}

// What each style is CALLED, in the one place both poll composers read it
// from — the tab menu's Poll section and the Session button's own settings.
// They offer the same five answers to the same question, so a label that
// drifted between them would describe two different products.
export const POLL_STYLE_LABEL: Record<PollStyle, string> = {
  yesNo: 'Yes / No',
  yesNoAbstain: '+ Abstain',
  choice: 'Choices',
  rating: 'Rating 1-5',
  text: 'Free text',
};
