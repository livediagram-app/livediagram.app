// Every word Home says (docs/specs/013-workspace/explorer-home.md "Jump back in", "What happened",
// "States"; blueprint docs/specs/013-workspace/blueprints/explorer-home-view.md). Pure, so the
// sentences are tested once and every part of Home reads alike.

import type {
  HomeAction,
  HomeDocument,
  HomeGroup,
  HomePerson,
  HomeVerb,
  HomeVerbCount,
} from '@livediagram/api-schema';
import { timeLabel } from '@livediagram/ui';

export const HOME_COPY = {
  jumpBackIn: 'Jump back in',
  whatHappened: 'What happened',
  seeMore: 'See more',
  seeTimeline: 'See timeline',
  jumpBackInEmpty: 'The documents you use most and last will gather here.',
  whatHappenedEmpty: 'Nothing from others in the last 14 days.',
  readFailed: 'Home could not load. Check your connection and try again.',
  tryAgain: 'Try again',
} as const;

/** The verb phrase of each action (spec table), as a summary lists them. */
export const VERB_PHRASES: Readonly<Record<HomeVerb, string>> = {
  commented: 'commented',
  replied: 'replied',
  resolved: 'resolved a thread',
  edited: 'edited',
  assigned_you: 'assigned you an action',
  assigned: 'assigned an action',
  completed: 'completed an action',
  shared: 'shared',
};

/** The same, as one person's entry reads before the document's name. */
const ACTION_PHRASES: Readonly<Record<HomeVerb, string>> = {
  commented: 'commented on',
  replied: 'replied on',
  resolved: 'resolved a thread in',
  edited: 'edited',
  assigned_you: 'assigned you an action in',
  assigned: 'assigned an action in',
  completed: 'completed an action in',
  shared: 'shared',
};

/** Verbs that take the document directly ("edited Payments"), not through "in". */
const DIRECT: ReadonlySet<HomeVerb> = new Set(['edited', 'shared']);

/** Verbs whose detail is words worth quoting: a comment, or an action's name. */
const QUOTED: ReadonlySet<HomeVerb> = new Set([
  'commented',
  'replied',
  'resolved',
  'assigned_you',
  'assigned',
  'completed',
]);

/** A summary names at most this many people, then counts the rest. */
const SUMMARY_NAMES_MAX = 3;

export function personName(person: HomePerson | undefined): string {
  return person?.name?.trim() || 'Someone';
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** "Priya", "Priya and Sam", "Priya, Sam and Lee", "Priya, Sam, Lee and 2 others". */
export function peopleList(people: readonly HomePerson[]): string {
  const names = people.map(personName);
  if (names.length <= SUMMARY_NAMES_MAX) return joinAnd(names);
  const rest = names.length - SUMMARY_NAMES_MAX;
  return `${names.slice(0, SUMMARY_NAMES_MAX).join(', ')} and ${rest} ${rest === 1 ? 'other' : 'others'}`;
}

/** "commented, edited and assigned you an action". */
export function verbList(verbs: readonly HomeVerbCount[]): string {
  return joinAnd(verbs.map((v) => VERB_PHRASES[v.verb]));
}

/** The parts of a summary's sentence; the view bolds the document. */
export function summarySentence(group: Pick<HomeGroup, 'people' | 'verbs' | 'name'>): {
  people: string;
  verbs: string;
  preposition: 'in' | null;
  document: string;
} {
  return {
    people: peopleList(group.people),
    verbs: verbList(group.verbs),
    preposition: group.verbs.every((v) => DIRECT.has(v.verb)) ? null : 'in',
    document: group.name,
  };
}

/** One person's action, before the document's name: "commented on", "edited". */
export function actionPhrase(verb: HomeVerb): string {
  return ACTION_PHRASES[verb];
}

/** The quoted words under an action, or null when it has none worth showing. */
export function actionDetail(action: Pick<HomeAction, 'verb' | 'detail'>): string | null {
  const words = action.detail?.trim();
  return words && QUOTED.has(action.verb) ? `“${words}”` : null;
}

export function updatesLabel(total: number): string {
  return `${total} ${total === 1 ? 'update' : 'updates'}`;
}

/** Where a document lives: its space, then its folder; a shared one by its owner. */
export function locationLabel(
  doc: Pick<HomeDocument, 'via' | 'teamName' | 'folderName' | 'ownerName'>,
): string {
  if (doc.via === 'shared') return doc.ownerName ? `Shared by ${doc.ownerName}` : 'Shared with you';
  // A team document lives in its team whoever reaches it: its owner reads it as `own`.
  const space = doc.teamName ?? 'My documents';
  return doc.folderName ? `${space} › ${doc.folderName}` : space;
}

/** The person's clock time of an instant: "14:05". */
export function clockTime(at: number): string {
  return timeLabel(at);
}
