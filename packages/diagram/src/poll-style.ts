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

export const POLL_STYLES = [
  'yesNo',
  'yesNoAbstain',
  'choice',
  'collaborators',
  'rating',
  'text',
] as const;

export type PollStyle = (typeof POLL_STYLES)[number];

// `choice` is the only style whose answers the author WRITES; every other
// style's answers come from somewhere else — a fixed set (Yes / No, 1-5),
// the room (`collaborators`), or nowhere (`text`). Callers use this to decide
// whether to show an answer EDITOR, so the "do I ask the author to type a
// list" question is answered in one place.
export function pollStyleNeedsOptions(style: PollStyle): boolean {
  return style === 'choice';
}

// Whether a poll of this style carries its own `options` list rather than
// resolving to a fixed set. A DIFFERENT question from the one above, and the
// distinction is the whole of `collaborators`: its list is generated rather
// than typed, but once generated it is stored and validated exactly like a
// written one (min 2, max POLL_OPTIONS_MAX, frozen for the poll's life).
//
// Kept separate rather than widening `pollStyleNeedsOptions`, because that one
// drives an editor UI that `collaborators` must NOT show — the author does not
// type the room's names, and a list they could edit would be a list that
// disagrees with who is actually here.
export function pollStyleCarriesOptions(style: PollStyle): boolean {
  return style === 'choice' || style === 'collaborators';
}

// Whether the poll's answers are the people currently in the diagram, filled
// in when the poll STARTS (spec/88). One place to ask, because two surfaces
// start polls — the Session Studio composer and a Session button (spec/105) —
// and both hand the substitution to the same `startPoll`.
export function pollStyleUsesRoster(style: PollStyle): boolean {
  return style === 'collaborators';
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
    // Both styles carry their own list: `choice` because the author wrote it,
    // `collaborators` because the room was frozen into it when the poll
    // started. From here on the two are indistinguishable, which is the whole
    // intent — one tally path, and a ballot that cannot move under the voters.
    case 'choice':
    case 'collaborators':
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
  collaborators: 'Collaborators',
  rating: 'Rating 1-5',
  text: 'Free text',
};
