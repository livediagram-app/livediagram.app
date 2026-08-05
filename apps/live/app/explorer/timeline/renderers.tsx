'use client';

// livediagram's timeline renderers (spec/138 §7).
//
// These are the half of the Timeline that knows about this product:
// which route a diagram bubble opens, how a comment reads, and when to
// say "You" instead of a name. The components in @livediagram/ui take
// this registry as a prop and never import a route themselves, which
// is what will let a per-diagram feed reuse them later without
// inheriting the Explorer's copy.
//
// Copy rule (spec/138 §2): the stored `title` is a Title Case category
// and never carries user content; user content lives in the
// description. These renderers mostly pass the title through and
// enrich the description — the exception is the actor-relative wording
// below, which can only be resolved once we know who is reading.

import type { TimelineEvent, TimelineRenderer, TimelineRendererRegistry } from '@livediagram/ui';
import { SourceTypeIcon } from '@livediagram/ui';
import { EVENT_ICONS } from './icons';

function str(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function icon(event: TimelineEvent) {
  return EVENT_ICONS[event.eventType] ?? <SourceTypeIcon sourceType={event.sourceType} />;
}

// "You" vs a name. The stored row is viewer-agnostic — one row serves a
// whole team — so the pronoun has to be decided here, at render time,
// against whoever is looking.
function actorLabel(event: TimelineEvent, viewerId: string | null): string {
  if (event.actorId && viewerId && event.actorId === viewerId) return 'You';
  return str(event.snapshot, 'authorName') ?? str(event.snapshot, 'memberName') ?? 'Someone';
}

function diagramHref(event: TimelineEvent): string | null {
  const id = str(event.snapshot, 'diagramId');
  return id ? `/diagram/${encodeURIComponent(id)}` : null;
}

const diagramRenderer: TimelineRenderer = (event, ctx) => {
  const name = str(event.snapshot, 'diagramName') ?? event.description ?? 'a diagram';
  const href = diagramHref(event);
  // A tombstone carries no diagramId (the emit deliberately omits it),
  // so this is structurally unclickable rather than relying on anyone
  // remembering not to link a deleted diagram.
  const onClick = href ? () => window.location.assign(href) : undefined;

  switch (event.eventType) {
    case 'diagram_edited': {
      const who = actorLabel(event, ctx.viewerId);
      return {
        icon: icon(event),
        description: who === 'You' ? `You worked on ${name}` : `${who} edited ${name}`,
        onClick,
      };
    }
    case 'comment_added':
      return {
        icon: icon(event),
        // The comment text is the description the worker stored, so it
        // stays where it is; the meta line carries who and where,
        // which is what the reader needs to decide whether to open it.
        meta: `${str(event.snapshot, 'authorName') ?? 'Someone'} · ${name}`,
        onClick,
      };
    case 'action_assigned':
    case 'action_completed':
      return { icon: icon(event), meta: name, onClick };
    default:
      return { icon: icon(event), onClick };
  }
};

const teamRenderer: TimelineRenderer = (event, ctx) => {
  const teamId = str(event.snapshot, 'teamId');
  const onClick = teamId
    ? () => window.location.assign(`/explorer/team?id=${encodeURIComponent(teamId)}`)
    : undefined;

  if (event.eventType === 'team_invite_received') {
    return {
      icon: icon(event),
      // An invite is the one bubble with something to DO, so it points
      // at the Invites section rather than the team it can't open yet:
      // a pending invite grants no access to the team page (spec/32).
      meta: 'Open Invites to accept or decline',
      onClick: () => window.location.assign('/explorer/invites'),
    };
  }

  // The stored description already reads as a sentence ("Priya joined
  // Platform Guild"), but it says a name where the reader is the
  // subject. Swap in "You" so their own arrival doesn't read like a
  // stranger's.
  if (event.actorId && ctx.viewerId && event.actorId === ctx.viewerId) {
    const teamName = str(event.snapshot, 'teamName');
    const memberName = str(event.snapshot, 'memberName');
    if (teamName && memberName && event.description?.startsWith(memberName)) {
      return {
        icon: icon(event),
        description: event.description.replace(memberName, 'You'),
        onClick,
      };
    }
  }

  return { icon: icon(event), onClick };
};

const accountRenderer: TimelineRenderer = (event) => {
  if (event.eventType === 'token_expiring') {
    return {
      icon: icon(event),
      meta: 'Rotate it before it lapses to keep connected tools working',
      onClick: () => window.location.assign('/explorer/tokens'),
    };
  }
  return { icon: icon(event) };
};

export const TIMELINE_RENDERERS: TimelineRendererRegistry = {
  diagram: diagramRenderer,
  team: teamRenderer,
  account: accountRenderer,
};
