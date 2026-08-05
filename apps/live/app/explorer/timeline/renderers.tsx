'use client';

// livediagram's timeline renderers (spec/138 §7).
//
// These are the half of the Timeline that knows about this product:
// which route a bubble opens, how each event reads, and when to say
// "You" instead of a name. The components in @livediagram/ui take this
// registry as a prop and never import a route themselves, which is what
// will let a per-diagram feed reuse them later without inheriting the
// Explorer's copy.
//
// Copy rule: the headline names the SUBJECT FIRST, then what happened
// to it — "Payments architecture deleted", not "Diagram Deleted" with
// the name on a second line. A feed is read by scanning the left edge,
// and the subject is what the reader is scanning for; the category is
// already carried by the icon and the colour. The subject is bolded so
// that edge stays legible at a glance.
//
// The generic Title Case category still lives on the stored event and
// is what a collapsed stack wears (stackLabel), so the two readings
// coexist: individual rows are specific, collapsed runs are honest.

import type { ReactNode } from 'react';
import type {
  TimelineEvent,
  TimelineRenderer,
  TimelineRendererContext,
  TimelineRendererRegistry,
} from '@livediagram/ui';
import { SourceTypeIcon } from '@livediagram/ui';
import { DiagramThumbnail } from '@/components/panels/DiagramThumbnail';
import { EVENT_ICONS } from './icons';

function str(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function icon(event: TimelineEvent) {
  return EVENT_ICONS[event.eventType] ?? <SourceTypeIcon sourceType={event.sourceType} />;
}

// The headline shape: bold subject, then the verb phrase. One helper so
// every renderer produces the same rhythm and none of them re-types the
// emphasis classes.
function headline(subject: string, rest: string): ReactNode {
  return (
    <>
      <strong className="font-semibold">{subject}</strong> {rest}
    </>
  );
}

// "You" vs a name. The stored row is viewer-agnostic — one row serves a
// whole team — so the pronoun is decided here, against whoever is
// reading.
function isMine(event: TimelineEvent, ctx: TimelineRendererContext): boolean {
  return Boolean(event.actorId && ctx.viewerId && event.actorId === ctx.viewerId);
}

function actorName(event: TimelineEvent, ctx: TimelineRendererContext): string {
  if (isMine(event, ctx)) return 'You';
  return str(event.snapshot, 'authorName') ?? str(event.snapshot, 'memberName') ?? 'Someone';
}

// A small snapshot of the diagram on the right of the row. Reuses the
// Explorer's own thumbnail component, so this inherits its lazy
// intersection-observer fetch, its blob-URL auth handling, and its
// stable placeholder — a feed of fifty rows doesn't fire fifty renders
// for diagrams the reader never scrolls to.
//
// Fixed height, so it sits inside the row rather than setting it.
function preview(event: TimelineEvent, ctx: TimelineRendererContext): ReactNode {
  const diagramId = str(event.snapshot, 'diagramId');
  if (!diagramId) return undefined;
  return (
    <DiagramThumbnail
      ownerId={ctx.viewerId}
      diagramId={diagramId}
      // The event's own timestamp as the cache-bust key. The coalesced
      // edit event's timestamp walks forward through a day, so an
      // actively-edited diagram re-fetches; a months-old bubble keeps
      // serving its cached snapshot rather than re-rendering on scroll.
      version={event.occurredAt}
      className="h-8 w-11 rounded border border-slate-200 bg-white/60 dark:border-slate-700 dark:bg-slate-900/40"
    />
  );
}

const diagramRenderer: TimelineRenderer = (event, ctx) => {
  const name = str(event.snapshot, 'diagramName') ?? 'a diagram';
  const diagramId = str(event.snapshot, 'diagramId');
  // A tombstone carries no diagramId (the emit deliberately omits it),
  // so it is structurally unclickable rather than relying on anyone
  // remembering not to link a deleted diagram. The bubble dims itself
  // when there's no handler.
  const open = diagramId
    ? () => window.location.assign(`/diagram/${encodeURIComponent(diagramId)}`)
    : undefined;
  // `description: null` clears the stored line: these headlines already
  // name the diagram, and repeating it underneath is noise.
  const base = {
    icon: icon(event),
    onClick: open,
    preview: preview(event, ctx),
    description: null,
  };

  switch (event.eventType) {
    case 'diagram_created':
      return { ...base, label: headline(name, 'created') };
    case 'diagram_edited':
      return {
        ...base,
        label: headline(name, 'updated'),
        meta: isMine(event, ctx) ? 'by you' : `by ${actorName(event, ctx)}`,
      };
    case 'diagram_renamed': {
      const previous = str(event.snapshot, 'previousName');
      return {
        ...base,
        label: headline(previous ?? name, 'renamed'),
        meta: previous ? `Now ${name}` : undefined,
      };
    }
    case 'diagram_duplicated': {
      const source = str(event.snapshot, 'sourceName');
      return { ...base, label: headline(source ?? name, 'duplicated'), meta: `Copy: ${name}` };
    }
    case 'diagram_deleted':
      return { ...base, label: headline(name, 'deleted') };
    case 'diagram_moved':
      return {
        ...base,
        label: headline(name, 'moved'),
        meta: `To ${str(event.snapshot, 'destination') ?? 'a folder'}`,
      };
    case 'team_diagram_added':
      return {
        ...base,
        label: headline(name, `shared with ${str(event.snapshot, 'teamName') ?? 'a team'}`),
      };
    case 'comment_added':
      return {
        ...base,
        // The commenter leads, because on a shared diagram "who said
        // this" is the first thing worth knowing. This is the one event
        // whose stored description is worth keeping: it holds the
        // comment text, which is the whole reason to look.
        label: headline(actorName(event, ctx), `commented on ${name}`),
        description: undefined,
      };
    case 'comment_resolved':
      return { ...base, label: headline(name, 'comment resolved') };
    case 'action_assigned': {
      const action = str(event.snapshot, 'actionName') ?? 'An action';
      const assignee = str(event.snapshot, 'assigneeName');
      return {
        ...base,
        label: headline(action, assignee ? `assigned to ${assignee}` : 'assigned'),
        meta: name,
      };
    }
    case 'action_completed':
      return {
        ...base,
        label: headline(str(event.snapshot, 'actionName') ?? 'An action', 'completed'),
        meta: name,
      };
    case 'share_link_created':
      return { ...base, label: headline(name, 'share link created') };
    case 'share_link_expiring':
      return { ...base, label: headline(name, 'share link expires') };
    default:
      return { ...base, label: headline(name, event.title.toLowerCase()) };
  }
};

const teamRenderer: TimelineRenderer = (event, ctx) => {
  const teamId = str(event.snapshot, 'teamId');
  const team = str(event.snapshot, 'teamName') ?? 'a team';
  const member = str(event.snapshot, 'memberName');
  const open = teamId
    ? () => window.location.assign(`/explorer/team?id=${encodeURIComponent(teamId)}`)
    : undefined;
  const base = { icon: icon(event), onClick: open, description: null };
  const who = isMine(event, ctx) ? 'You' : (member ?? 'Someone');

  switch (event.eventType) {
    case 'team_created':
      return { ...base, label: headline(team, 'created') };
    case 'team_invite_received':
      return {
        ...base,
        label: headline(team, 'invited you'),
        meta: 'Open Invites to accept or decline',
        // A pending invite grants no access to the team page (spec/32),
        // so this points where the reader can actually act.
        onClick: () => window.location.assign('/explorer/invites'),
      };
    case 'team_invite_accepted':
      return { ...base, label: headline(team, isMine(event, ctx) ? 'joined by you' : 'joined') };
    case 'team_invite_declined':
      return { ...base, label: headline(team, 'invite declined'), meta: member ?? undefined };
    case 'team_member_joined':
      return { ...base, label: headline(who, `joined ${team}`) };
    case 'team_member_left':
      return { ...base, label: headline(who, `left ${team}`) };
    case 'team_member_removed':
      return { ...base, label: headline(who, `removed from ${team}`) };
    case 'team_role_changed':
      return {
        ...base,
        label: headline(
          member ?? 'A member',
          `is now ${str(event.snapshot, 'toRole') ?? 'changed'}`,
        ),
        meta: team,
      };
    default:
      return { ...base, label: headline(team, event.title.toLowerCase()) };
  }
};

const accountRenderer: TimelineRenderer = (event) => {
  const base = { icon: icon(event), description: null };
  switch (event.eventType) {
    case 'token_created':
      return {
        ...base,
        label: headline(str(event.snapshot, 'tokenName') ?? 'API token', 'created'),
        onClick: () => window.location.assign('/explorer/tokens'),
      };
    case 'token_expiring':
      return {
        ...base,
        label: headline(str(event.snapshot, 'tokenName') ?? 'API token', 'expires'),
        meta: 'Rotate it before it lapses to keep connected tools working',
        onClick: () => window.location.assign('/explorer/tokens'),
      };
    case 'theme_saved':
      return {
        ...base,
        label: headline(str(event.snapshot, 'themeName') ?? 'A theme', 'saved'),
        onClick: () => window.location.assign('/explorer/themes'),
      };
    case 'image_uploaded': {
      const count = typeof event.snapshot.count === 'number' ? event.snapshot.count : 1;
      return {
        ...base,
        label: headline(count === 1 ? '1 image' : `${count} images`, 'uploaded'),
        onClick: () => window.location.assign('/explorer/images'),
      };
    }
    default:
      return base;
  }
};

export const TIMELINE_RENDERERS: TimelineRendererRegistry = {
  diagram: diagramRenderer,
  team: teamRenderer,
  account: accountRenderer,
};
