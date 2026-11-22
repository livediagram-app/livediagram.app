// The words of read and edit mode (docs/specs/030-knowledgebase/blueprints/editing.md "Presentation and UX"). Pure.
import { draftDiffers, draftOf, type Tab } from '@liveknowledge/document';
import { relativeSince } from '@/lib/relative-time';

/** "Priya", "Priya and Sam", "Priya and 2 others": the people editing, for "Being edited by …". */
export function editorsPhrase(names: readonly string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} others`;
}

const differsCache = new WeakMap<Tab, boolean>();

/** Whether the page's draft differs from its saved page, once per stored tab object (a commit makes a new one). */
export function draftDiffersOnce(tab: Tab): boolean {
  const known = differsCache.get(tab);
  if (known !== undefined) return known;
  const differs = draftDiffers(tab);
  differsCache.set(tab, differs);
  return differs;
}

/**
 * The draft bar's status: nothing while the draft is the saved page; "Unsaved changes" for changes made in this
 * editing session; "Unsaved changes from Priya, 2 hours ago" for a draft this session opened onto, left by someone
 * (this person too, on another day) before Edit.
 */
export function draftStatus(tab: Tab, opts: { me: string; since: number; now: number }): string {
  const draft = draftOf(tab);
  if (!draft || !draftDiffersOnce(tab)) return '';
  const { by, at } = draft.record;
  const left = by !== opts.me || at < opts.since;
  if (!left) return 'Unsaved changes';
  return `Unsaved changes from ${by === opts.me ? 'you' : by}, ${relativeSince(at, opts.now)}`;
}

/** The agent note's hover card: how much changed under the draft, and what Save does with it. */
export function agentChangeDetail(blocks: number): string {
  return `${blocks} ${blocks === 1 ? 'block' : 'blocks'} changed. Saving keeps your changes and theirs.`;
}

/** The platform's modifier, as the hover cards name it: Cmd on a Mac, Ctrl elsewhere. */
export function modifierName(platform: string | undefined): 'Cmd' | 'Ctrl' {
  return platform && /mac|iphone|ipad|ipod/i.test(platform) ? 'Cmd' : 'Ctrl';
}
