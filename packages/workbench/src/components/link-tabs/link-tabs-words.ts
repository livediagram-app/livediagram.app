// Connect as tabs' words (liveworkspace/docs/specs/004-index/connected-tabs.md "Linked from a Send to"): what the
// pickers' row says for how the two files stand, and what a link that did not give both files their tab says after.
import {
  linkedTabHeld,
  type LinkedTabSide,
  type LinkedTabsMade,
} from '@liveworkspace/index-client';

// How the two files stand, as far as the picker knows.
export type LinkTabsState =
  // The destination is still to be made (New Plan, New Diagram): both files will be the person's to change.
  | { kind: 'new' }
  | { kind: 'loading' }
  | { kind: 'ready'; source: LinkedTabSide; target: LinkedTabSide }
  // The read failed: offered all the same, and the index decides.
  | { kind: 'failed' };

// What the row shows: the switch offering what is missing, a tick when nothing is, or why nothing can be.
export type LinkTabsView = 'offer' | 'connected' | 'blocked';

export function linkTabsView(state: LinkTabsState): LinkTabsView {
  if (state.kind !== 'ready') return 'offer';
  const { source, target } = state;
  if (source === 'can' || target === 'can') return 'offer';
  if (source === 'connected' || target === 'connected') return 'connected';
  return 'blocked';
}

export type LinkTabsNames = { source: string; target: string };

const named = (name: string) => name.trim() || 'Untitled';

/** The row's title and line. */
export function linkTabsCopy(
  state: LinkTabsState,
  names: LinkTabsNames,
): { title: string; line: string } {
  const s = named(names.source);
  const t = named(names.target);
  const view = linkTabsView(state);
  if (view === 'blocked')
    return { title: 'Connect as tabs', line: 'You can’t change the tabs of either file.' };
  if (view === 'connected') {
    const both =
      state.kind === 'ready' && state.source === 'connected' && state.target === 'connected';
    return {
      title: 'Connected as tabs',
      line: both
        ? `${s} and ${t} already open each other.`
        : state.kind === 'ready' && state.source === 'connected'
          ? `${s} already has a tab for ${t}.`
          : `${t} already has a tab for ${s}.`,
    };
  }
  const title = 'Connect as tabs';
  if (state.kind === 'ready') {
    const { source, target } = state;
    if (source === 'cannot')
      return { title, line: `Only ${t} gets a tab: you can’t change ${s}’s tabs.` };
    if (target === 'cannot')
      return { title, line: `Only ${s} gets a tab: you can’t change ${t}’s tabs.` };
    if (source === 'connected')
      return { title, line: `${t} gets a tab that opens ${s}, which has one already.` };
    if (target === 'connected')
      return { title, line: `${s} gets a tab that opens ${t}, which has one already.` };
  }
  return { title, line: `${s} and ${t} each get a tab that opens the other.` };
}

export type LinkTabsNotice = { tone: 'info' | 'warning'; message: string };

/** What to say once a link is made: nothing when both files hold their tab, else which did not and why. */
export function linkedTabsNotice(
  made: LinkedTabsMade,
  names: LinkTabsNames,
): LinkTabsNotice | null {
  const s = named(names.source);
  const t = named(names.target);
  const sourceHeld = linkedTabHeld(made.source);
  const targetHeld = linkedTabHeld(made.target);
  if (sourceHeld && targetHeld) return null;
  if (!sourceHeld && !targetHeld) {
    if (made.source === 'cannot' && made.target === 'cannot')
      return {
        tone: 'info',
        message: 'Not connected as tabs: you can’t change the tabs of either file.',
      };
    return { tone: 'warning', message: `${s} and ${t} could not be connected as tabs just now.` };
  }
  const [missing, outcome, other] = sourceHeld ? [t, made.target, s] : [s, made.source, t];
  if (outcome === 'cannot')
    return {
      tone: 'info',
      message: `Connected one way: only ${other} got a tab, as you can’t change ${missing}’s tabs.`,
    };
  if (outcome === 'full')
    return {
      tone: 'warning',
      message: `Connected one way: ${missing} holds as many connected tabs as it may.`,
    };
  return {
    tone: 'warning',
    message: `Connected one way: ${missing} could not be reached just now.`,
  };
}

/** Failing to link never undoes the send. */
export const LINK_FAILED_WORDS = 'Sent. The two files could not be connected as tabs just now.';
