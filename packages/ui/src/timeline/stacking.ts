// Same-day stacking (spec/138 §2.1).
//
// A day where you renamed six diagrams should read as one line, not
// six. Within a day, events sharing a bucket collapse into a single
// bubble the reader can expand.
//
// Pure over the event list so the rules are testable without mounting
// anything — which matters, because "why did these two not stack?" is
// the question this feature will get asked most.

import type { TimelineEvent } from './types';

export type TimelineStack = {
  // React key. Uses the first event's id so a stack that gains a
  // member doesn't remount.
  key: string;
  // The bucket these share. StackedBubble reads it to pick a headline
  // that is true of all of them.
  bucket: string;
  events: TimelineEvent[];
};

// Event types that are two halves of one moment. Without this, a day
// where somebody joined and somebody else left shows two near-identical
// collapsed bubbles for what a person would describe as "the team
// changed".
const BUCKET_ALIASES: Record<string, string> = {
  team_member_joined: 'team_membership',
  team_member_left: 'team_membership',
  team_member_removed: 'team_membership',
  share_link_created: 'sharing',
  share_link_expiring: 'sharing',
  diagram_moved: 'filing',
  team_diagram_added: 'filing',
};

// Events that always stand alone.
//
// A collapsed comment hides the one thing the reader wanted — the
// words. Comments are the highest-signal item on this feed and the
// reason someone opens it, so they never fold into "4 events".
//
// Deletions stand alone for a different reason: a tombstone is the
// last thing a diagram ever says, and burying it in a stack is how
// somebody fails to notice a teammate deleted their work.
const NEVER_STACK = new Set<string>(['comment_added', 'diagram_deleted', 'team_invite_received']);

export function bucketFor(event: TimelineEvent): string {
  return BUCKET_ALIASES[event.eventType] ?? `${event.sourceType}::${event.eventType}`;
}

// Group one day's events into stacks.
//
// Bucketing is by kind, NOT by adjacency: four member changes split by
// an unrelated bubble still collapse into one stack of four. A reader
// scanning a day asks "what kind of thing happened", not "what ran
// consecutively".
//
// A stack lands at the position of its most recent member, because
// events arrive newest-first and the first one seen for a bucket is
// therefore the latest. If the caller ever passes an oldest-first list
// this ordering assumption breaks — which is why the input contract is
// stated here rather than left implicit.
export function buildStacks(events: readonly TimelineEvent[]): TimelineStack[] {
  const stacks: TimelineStack[] = [];
  const byBucket = new Map<string, TimelineStack>();

  for (const event of events) {
    if (NEVER_STACK.has(event.eventType)) {
      stacks.push({ key: event.id, bucket: bucketFor(event), events: [event] });
      continue;
    }
    const bucket = bucketFor(event);
    const existing = byBucket.get(bucket);
    if (existing) {
      existing.events.push(event);
    } else {
      const created: TimelineStack = { key: event.id, bucket, events: [event] };
      stacks.push(created);
      byBucket.set(bucket, created);
    }
  }

  return stacks;
}

// The headline a collapsed stack wears.
//
// It must be true of EVERY event in the run, which is why it can't
// just reuse the first event's label: "Renamed Payments architecture"
// on a stack that also contains two other diagrams reads as a lie. The
// per-bucket map below is the honest generic; anything unmapped falls
// back to the shared title, which is already a generic category by the
// copy rules (spec/138 §2).
const STACK_LABELS: Record<string, string> = {
  'diagram::diagram_edited': 'Diagrams Updated',
  'diagram::diagram_created': 'Diagrams Created',
  'diagram::diagram_renamed': 'Diagrams Renamed',
  'diagram::diagram_duplicated': 'Diagrams Duplicated',
  'diagram::comment_resolved': 'Comments Resolved',
  'diagram::action_assigned': 'Actions Assigned',
  'diagram::action_completed': 'Actions Completed',
  'team::team_role_changed': 'Roles Changed',
  'team::team_invite_accepted': 'Invites Accepted',
  'team::team_invite_declined': 'Invites Declined',
  'account::token_created': 'API Tokens Created',
  'account::token_expiring': 'API Tokens Expiring',
  'account::theme_saved': 'Themes Saved',
  team_membership: 'Members Changed',
  sharing: 'Sharing Changed',
  filing: 'Diagrams Filed',
};

export function stackLabel(stack: TimelineStack): string {
  return STACK_LABELS[stack.bucket] ?? stack.events[0]!.title;
}
