'use client';

// liveplanner's timeline renderers (docs/specs/013-workspace/timeline.md §7).
//
// These are the half of the Timeline that knows about this product:
// which route a card opens, what its preview shows, and when to say
// "you" instead of a name. The components in @liveplanner/ui take this
// registry as a prop and never import a route themselves, which is what
// lets a per-project feed reuse them without inheriting the Explorer's
// copy.
//
// Copy rule (docs/specs/013-workspace/timeline.md §2): a card's TITLE is the subject (the project,
// the team, the token) and its REASON LINE is the stored Title Case
// category ("Project Created"). Renderers therefore set `subject` and
// leave `label` to fall back to `event.title`, so every card and every
// collapsed stack draws its wording from the same field and the feed
// can't drift into a mix of "created" and "Created". People and detail
// go in `meta`.

import type {
  TimelineEvent,
  TimelineRenderer,
  TimelineRendererContext,
  TimelineRendererRegistry,
} from '@liveplanner/ui';
import { SourceTypeIcon } from '@liveplanner/ui';
import { ProjectThumbnail } from '@/components/panels/ProjectThumbnail';
import { EVENT_ICONS } from './icons';
import { requestOpenSettings } from '@/lib/open-settings';
import { explorerPathFor } from '../routes';
import { assignAppLocation } from '@/lib/app-location';

function str(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function icon(event: TimelineEvent) {
  return EVENT_ICONS[event.eventType] ?? <SourceTypeIcon sourceType={event.sourceType} />;
}

// "you" vs a name. The stored row is viewer-agnostic — one row serves a
// whole team — so the pronoun is decided here, against whoever is
// reading.
function isMine(event: TimelineEvent, ctx: TimelineRendererContext): boolean {
  return Boolean(event.actorId && ctx.viewerId && event.actorId === ctx.viewerId);
}

function actorName(event: TimelineEvent, ctx: TimelineRendererContext): string {
  if (isMine(event, ctx)) return 'You';
  return str(event.snapshot, 'authorName') ?? str(event.snapshot, 'memberName') ?? 'Someone';
}

function byActor(event: TimelineEvent, ctx: TimelineRendererContext): string {
  return isMine(event, ctx) ? 'by you' : `by ${actorName(event, ctx)}`;
}

// The project's snapshot, filling the card's preview box. Reuses the
// Explorer's own thumbnail component, so this inherits its lazy
// intersection-observer fetch, its blob-URL auth handling, and its
// stable placeholder: a feed of fifty cards doesn't fire fifty renders
// for projects the reader never scrolls to.
function preview(event: TimelineEvent, ctx: TimelineRendererContext) {
  const projectId = str(event.snapshot, 'projectId');
  if (!projectId) return undefined;
  return (
    <ProjectThumbnail
      ownerId={ctx.viewerId}
      projectId={projectId}
      // The event's own timestamp as the cache-bust key. The coalesced
      // edit event's timestamp walks forward through a day, so an
      // actively-edited project re-fetches; a months-old card keeps
      // serving its cached snapshot rather than re-rendering on scroll.
      version={event.occurredAt}
      className="h-full w-full"
    />
  );
}

const projectRenderer: TimelineRenderer = (event, ctx) => {
  const name = str(event.snapshot, 'projectName') ?? 'A plan';
  const projectId = str(event.snapshot, 'projectId');
  // No id, no link: a row from an older worker (or one whose snapshot
  // lost its id) must not point the reader at nothing. The card dims
  // itself when there's no handler.
  const open = projectId
    ? () => assignAppLocation(`/project/${encodeURIComponent(projectId)}`)
    : undefined;
  // `description: null` clears the stored line: the reason line already
  // says what happened and the title already names the project, so
  // repeating either underneath is noise. Comments are the exception.
  const base = {
    icon: icon(event),
    subject: name,
    onClick: open,
    preview: preview(event, ctx),
    description: null,
  };

  switch (event.eventType) {
    case 'project_edited':
      return { ...base, meta: byActor(event, ctx) };
    case 'project_duplicated': {
      const source = str(event.snapshot, 'sourceName');
      return { ...base, meta: source ? `Copy of ${source}` : undefined };
    }
    case 'project_moved':
      return { ...base, meta: `To ${str(event.snapshot, 'destination') ?? 'a folder'}` };
    case 'team_project_added':
      return { ...base, meta: str(event.snapshot, 'teamName') ?? undefined };
    case 'team_project_removed': {
      // Who has it now. A non-owner pulling a team project out takes
      // ownership of it (docs/specs/013-workspace/team-shared-projects.md), so this is the part a reader of the
      // TEAM's copy of this event actually needs.
      const owner = str(event.snapshot, 'newOwnerName');
      return {
        ...base,
        meta: owner ? `Now owned by ${owner}` : (str(event.snapshot, 'teamName') ?? undefined),
      };
    }
    case 'comment_added':
    case 'comment_resolved':
      // The stored description holds the comment's words (for a
      // resolution, the thread's opening comment), which is the whole
      // reason to look, so it stays. The person goes in the meta,
      // because on a shared project "who" is the next thing worth
      // knowing.
      return { ...base, meta: actorName(event, ctx), description: undefined };
    case 'action_assigned': {
      // The action's name is what the card is really about, so it gets
      // the description line rather than the quiet meta; who it went to
      // trails the time.
      const assignee = str(event.snapshot, 'assigneeName');
      return {
        ...base,
        description: str(event.snapshot, 'actionName') ?? null,
        meta: assignee ? `To ${assignee}` : undefined,
      };
    }
    case 'action_completed':
      return {
        ...base,
        description: str(event.snapshot, 'actionName') ?? null,
        meta: byActor(event, ctx),
      };
    case 'project_offline':
      return { ...base, meta: 'Kept only in this browser' };
    case 'project_opened_by_visitor':
    case 'project_copied_by_visitor':
      return {
        ...base,
        meta: str(event.snapshot, 'visitorName') ?? 'Someone with the share link',
      };
    default:
      return base;
  }
};

const teamRenderer: TimelineRenderer = (event, ctx) => {
  const teamId = str(event.snapshot, 'teamId');
  const team = str(event.snapshot, 'teamName') ?? 'A team';
  const member = str(event.snapshot, 'memberName');
  const open = teamId
    ? () => assignAppLocation(explorerPathFor({ kind: 'team', id: teamId }))
    : undefined;
  const base = { icon: icon(event), subject: team, onClick: open, description: null };
  const who = isMine(event, ctx) ? 'You' : (member ?? 'Someone');

  switch (event.eventType) {
    case 'team_invite_received':
      return {
        ...base,
        meta: 'Open Invites to accept or decline',
        // A pending invite grants no access to the team page (docs/specs/013-workspace/teams.md),
        // so this points where the reader can actually act.
        onClick: () => assignAppLocation('/explorer/invites'),
      };
    case 'team_invite_accepted':
    case 'team_invite_declined':
    case 'team_member_joined':
    case 'team_member_left':
    case 'team_member_removed':
      return { ...base, meta: who };
    case 'team_renamed': {
      const previous = str(event.snapshot, 'previousName');
      return { ...base, meta: previous ? `Was ${previous}` : undefined };
    }
    case 'team_role_changed':
      return {
        ...base,
        meta: `${member ?? 'A member'} is now ${str(event.snapshot, 'toRole') ?? 'changed'}`,
      };
    default:
      return base;
  }
};

const accountRenderer: TimelineRenderer = (event) => {
  const base = { icon: icon(event), description: null };
  const token = str(event.snapshot, 'tokenName') ?? 'API token';
  const theme = str(event.snapshot, 'themeName') ?? 'A theme';
  const folder = str(event.snapshot, 'folderName') ?? 'A folder';
  // Tokens live in Settings, which opens in place over the feed.
  const tokens = () => requestOpenSettings('tokens');
  switch (event.eventType) {
    case 'token_created':
    case 'token_revoked':
      return { ...base, subject: token, onClick: tokens };
    case 'token_expiring':
      return {
        ...base,
        subject: token,
        meta: 'Rotate it before it lapses to keep connected tools working',
        onClick: tokens,
      };
    case 'theme_saved':
      return {
        ...base,
        subject: theme,
        onClick: () => assignAppLocation('/explorer/themes'),
      };
    case 'theme_deleted':
      return { ...base, subject: theme };
    case 'folder_created': {
      // The folder's own Explorer page. A deleted folder has no id in
      // its snapshot (there is nothing left to open), so it stays inert.
      const folderId = str(event.snapshot, 'folderId');
      return {
        ...base,
        subject: folder,
        onClick: folderId
          ? () => assignAppLocation(explorerPathFor({ kind: 'folder', id: folderId }))
          : undefined,
      };
    }
    case 'folder_deleted':
      return { ...base, subject: folder };
    default:
      return base;
  }
};

export const TIMELINE_RENDERERS: TimelineRendererRegistry = {
  project: projectRenderer,
  team: teamRenderer,
  account: accountRenderer,
};
