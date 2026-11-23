// The cards a send makes (liveworkspace/docs/specs/004-index/send-to-plan.md "The picker" step 3): one card each place,
// or one card with a checklist of them, each titled from its words, assigned and due as the picker says. Pure.
import {
  PLAN_SEND_CHECKLIST_MAX,
  PLAN_SEND_TITLE_MAX,
  type PlanSend,
  type PlanSendCardInput,
  type PlanSendPlace,
} from '@liveworkspace/index-client';
import { readSendWords, SEND_TITLE_MAX } from './send-words';

export type SendMode = 'each' | 'checklist';

export type CardChoices = {
  mode: SendMode;
  // The one card's title (one place, or a checklist), as the person left it.
  title: string;
  // A plan person's name, or '' for nobody.
  assignee: string;
  // `YYYY-MM-DD`, or '' for none.
  due: string;
};

/** A place's own title: its words' first line, or its words cut when that line is all mention and date. */
export function placeTitle(place: PlanSendPlace, today: Date): string {
  const read = readSendWords(place.text, today);
  if (read.title) return read.title;
  const text = place.text.trim();
  const line = text.indexOf('\n');
  const words = line < 0 ? text : text.slice(0, line);
  return words.length > SEND_TITLE_MAX ? words.slice(0, SEND_TITLE_MAX) : words;
}

const clip = (s: string) => (s.length > PLAN_SEND_TITLE_MAX ? s.slice(0, PLAN_SEND_TITLE_MAX) : s);

/** The cards to ask for. A blank title falls back to the place's own. */
export function sendCards(
  places: readonly PlanSendPlace[],
  choices: CardChoices,
  today: Date,
): PlanSendCardInput[] {
  const extra = {
    ...(choices.assignee ? { assignee: choices.assignee } : {}),
    ...(choices.due ? { due: choices.due } : {}),
  };
  const first = places[0];
  if (!first) return [];
  if (places.length === 1 || choices.mode === 'checklist') {
    const title = clip(choices.title.trim() || placeTitle(first, today));
    const checklist =
      places.length > 1
        ? places.slice(0, PLAN_SEND_CHECKLIST_MAX).map((p) => clip(placeTitle(p, today)))
        : undefined;
    return [{ title, places: [...places], ...extra, ...(checklist ? { checklist } : {}) }];
  }
  return places.map((p) => ({ title: clip(placeTitle(p, today)), places: [p], ...extra }));
}

/** The newest send already made from any of these places, to offer it rather than make another unasked. */
export function alreadySent(
  places: readonly PlanSendPlace[],
  sends: readonly PlanSend[],
  ref: (p: PlanSendPlace) => string,
): PlanSend | null {
  const refs = new Set(places.map(ref));
  return sends.find((s) => refs.has(s.ref)) ?? null;
}
