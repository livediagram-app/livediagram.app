'use client';

// What a Timeline card's ⋯ menu can DO for the thing it's about, beyond
// removing the card (docs/specs/013-workspace/timeline.md §2.8): the verbs the Explorer already
// offers that kind of entity, resolved from the Explorer's own state
// and run through the Explorer's own handlers.
//
//   token   Open API Tokens · Manage API Tokens (liveworkspace.app)
//   team    Open Team · Manage Team (liveworkspace.app)
//   invite  Open Invites
//   image   Open Images
//   document the Explorer can't resolve (a team document the sidebar
//           hasn't loaded): Open Document
//
// Teams and API tokens are run on liveworkspace.app (liveworkspace/docs/accounts.md "Teams",
// "API tokens"), so their verbs (rename, leave, delete, revoke, answer an invite) are a link there,
// the same one the Team page and Settings give.
//
// A tombstone, or an entity the Explorer no longer holds (a team the
// reader has left), keeps only the "open the section" row: a menu of
// guesses is worse than none.

import {
  DocumentIcon,
  ImageIcon,
  InviteIcon,
  KeyIcon,
  OpenIcon,
  TeamIcon,
} from '@/components/primitives/explorer-icons';
import { useCallback } from 'react';
import type { TimelineEvent } from '@livediagram/ui';
import { manageTeamsUrl, manageTokensUrl } from '@/lib/auth-config';
import { requestOpenSettings } from '@/lib/open-settings';
import { useExplorer } from '../ExplorerContext';
import type { TimelineMenuItem } from './TimelineCardMenu';
import { assignAppLocation } from '@/lib/app-location';

export type TimelineEntityMenu = {
  /** The subject as the Explorer knows it now, when it can resolve one. */
  subject?: string;
  items: TimelineMenuItem[];
};

export type TimelineEntityMenuFor = (event: TimelineEvent) => TimelineEntityMenu | null;

function str(snapshot: Record<string, unknown>, key: string): string | null {
  const v = snapshot[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

const TOKEN_EVENTS = new Set(['token_created', 'token_expiring', 'token_revoked']);
const TEAM_EVENTS = new Set([
  'team_created',
  'team_renamed',
  'team_deleted',
  'team_member_joined',
  'team_member_left',
  'team_member_removed',
  'team_role_changed',
  'team_invite_accepted',
  'team_invite_declined',
  'team_invite_link_enabled',
  'team_invite_link_disabled',
]);

export function useTimelineEntityMenus(): {
  menuFor: TimelineEntityMenuFor;
} {
  const { go, teams } = useExplorer();

  const menuFor = useCallback<TimelineEntityMenuFor>(
    (event) => {
      const { sourceType, eventType, snapshot } = event;

      if (sourceType === 'document') {
        // Only reached for a document the Explorer could NOT resolve (the
        // slots hook builds the full menu otherwise). The card click
        // opens it; the menu says so explicitly.
        const id = str(snapshot, 'documentId');
        if (!id) return null;
        return {
          items: [
            {
              label: 'Open Document',
              icon: <DocumentIcon />,
              onClick: () => assignAppLocation(`/document/${encodeURIComponent(id)}`),
            },
          ],
        };
      }

      if (sourceType === 'team') {
        if (eventType === 'team_invite_received') {
          // Invites are answered on liveworkspace.app; the Invites page says so and links there.
          return {
            items: [
              { label: 'Open Invites', icon: <InviteIcon />, onClick: () => go({ kind: 'invites' }) },
            ],
          };
        }
        if (!TEAM_EVENTS.has(eventType)) return null;
        const teamId = str(snapshot, 'teamId');
        const team = teamId ? teams.find((t) => t.id === teamId) : undefined;
        if (!teamId || !team) return { items: [] };
        return {
          subject: team.name,
          items: [
            {
              label: 'Open Team',
              icon: <TeamIcon />,
              onClick: () => go({ kind: 'team', id: teamId }),
            },
            {
              label: 'Manage Team',
              icon: <OpenIcon />,
              onClick: () => assignAppLocation(manageTeamsUrl),
            },
          ],
        };
      }

      if (sourceType === 'account') {
        if (TOKEN_EVENTS.has(eventType)) {
          // Tokens are made, listed and revoked on liveworkspace.app; Settings lists the workbenches
          // paired with them.
          return {
            items: [
              {
                label: 'Open API Tokens',
                icon: <KeyIcon />,
                onClick: () => requestOpenSettings('tokens'),
              },
              {
                label: 'Manage API Tokens',
                icon: <OpenIcon />,
                onClick: () => assignAppLocation(manageTokensUrl),
              },
            ],
          };
        }
        if (eventType === 'image_uploaded') {
          return {
            items: [
              {
                label: 'Open Images',
                icon: <ImageIcon />,
                onClick: () => assignAppLocation('/explorer/images'),
              },
            ],
          };
        }
      }
      return null;
    },
    [teams, go],
  );

  return { menuFor };
}
