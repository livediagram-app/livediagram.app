'use client';

// What a Timeline card's ⋯ menu can DO for the thing it's about, beyond
// removing the card (spec/138 §2.8): the verbs the Explorer already
// offers that kind of entity, resolved from the Explorer's own state
// and run through the Explorer's own handlers.
//
//   token   Open Tokens · Revoke Token (confirmed)
//   team    Open Team · Edit Team (admin) · Leave Team · Delete Team (admin)
//   invite  Open Invites · Accept · Decline
//   theme   Open Themes · Edit Theme · Delete Theme (confirmed)
//   image   Open Images
//   diagram the Explorer can't resolve (a team diagram the sidebar
//           hasn't loaded): Open Diagram
//
// A tombstone, or an entity the Explorer no longer holds (a revoked
// token, an answered invite, a team the reader has left), keeps only
// the "open the section" row: a menu of guesses is worse than none.
//
// The dialogs a verb opens (Edit Team, Edit Theme) are owned here and
// handed back as `dialogs` for the pane to render, so the cards stay
// stateless. Confirm copy comes from the panes' own helpers, so the
// warning a reader sees is the same one they'd see on the Tokens,
// Themes or Team page.

import { CloseIcon } from '@livediagram/ui';
import {
  CheckIcon,
  DiagramIcon,
  ImageIcon,
  InviteIcon,
  KeyIcon,
  PaletteIcon,
  PencilIcon,
  TeamIcon,
  TrashIcon,
} from '@/components/primitives/explorer-icons';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { TimelineEvent } from '@livediagram/ui';
import type { TeamInvite, TeamListItem } from '@livediagram/api-schema';
import { apiDeleteTeam, apiGetTeam, apiRemoveTeamMember, apiUpdateTeam } from '@/lib/api-client';
import { TeamFormModal } from '@/components/dialogs/TeamFormModal';
import { useCustomThemes } from '@/components/primitives/CustomThemeProvider';
import {
  ThemeBuilderModal,
  themeDeleteConfirm,
  type CustomThemeDraft,
} from '@/components/panels/ThemeBuilderModal';
import { teamDeleteCopy, teamRemovalCopy } from '@/components/panels/team-removal';
import { TOKEN_REVOKE_MESSAGE } from '@/components/panels/token-copy';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';
import { useExplorer } from '../ExplorerContext';
import type { TimelineMenuItem } from './TimelineCardMenu';

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
const THEME_EVENTS = new Set(['theme_saved', 'theme_deleted']);
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
  dialogs: ReactNode;
} {
  const {
    ownerId,
    clerkUserId,
    go,
    tokens,
    teams,
    invites,
    acceptInvite,
    declineInvite,
    refreshTeams,
  } = useExplorer();
  const { themes, updateTheme, deleteTheme } = useCustomThemes();
  const confirm = useConfirm();
  const toast = useToast();

  // The two dialogs a verb can open.
  const [editingTeam, setEditingTeam] = useState<TeamListItem | null>(null);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editingTheme = editingThemeId ? themes.find((t) => t.id === editingThemeId) : undefined;

  // ---- tokens -----------------------------------------------------
  const revokeToken = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: 'Revoke token?',
        message: TOKEN_REVOKE_MESSAGE,
        confirmLabel: 'Revoke',
      });
      if (ok) await tokens.revoke(id);
    },
    [confirm, tokens],
  );

  // ---- teams ------------------------------------------------------
  const leaveTeam = useCallback(
    async (team: TeamListItem) => {
      if (!ownerId) return;
      // The member list isn't in the Explorer's team list; fetch it for
      // the reader's own row and the last-admin rule (spec/32).
      const detail = await apiGetTeam(ownerId, team.id).catch(() => null);
      const self = detail?.members.find((m) => m.userId !== null && m.userId === clerkUserId);
      if (!detail || !self) {
        toast.error('Could not leave the team. Try again.');
        return;
      }
      const admins = detail.members.filter((m) => m.role === 'admin').length;
      if (self.role === 'admin' && admins <= 1) {
        toast.error('A team needs at least one Admin. Promote someone else first.');
        return;
      }
      const copy = teamRemovalCopy('self', { memberLabel: null, teamName: team.name });
      if (
        !(await confirm({
          title: copy.title,
          message: copy.message,
          confirmLabel: copy.confirmLabel,
        }))
      )
        return;
      const result = await apiRemoveTeamMember(ownerId, team.id, self.id).catch(() => null);
      if (!result?.ok) {
        toast.error(copy.failureNotice);
        return;
      }
      track('Team', 'Removed', 'Self');
      void refreshTeams();
    },
    [ownerId, clerkUserId, confirm, toast, refreshTeams],
  );

  const deleteTeam = useCallback(
    async (team: TeamListItem) => {
      if (!ownerId) return;
      if (!(await confirm(teamDeleteCopy(team.name)))) return;
      try {
        await apiDeleteTeam(ownerId, team.id);
      } catch {
        toast.error('Could not delete the team. Try again.');
        return;
      }
      track('Team', 'Deleted');
      void refreshTeams();
    },
    [ownerId, confirm, toast, refreshTeams],
  );

  const submitTeamEdit = useCallback(
    async (values: { name: string; organisation: string | null }) => {
      if (!ownerId || !editingTeam) return;
      try {
        await apiUpdateTeam(ownerId, editingTeam.id, values);
      } catch {
        toast.error('Could not save the team. Try again.');
        return;
      }
      track('Team', 'Changed');
      setEditingTeam(null);
      void refreshTeams();
    },
    [ownerId, editingTeam, toast, refreshTeams],
  );

  // ---- invites ----------------------------------------------------
  const accept = useCallback(
    (invite: TeamInvite) =>
      void acceptInvite(invite).then((teamId) => {
        if (teamId) go({ kind: 'team', id: teamId });
      }),
    [acceptInvite, go],
  );

  // ---- themes -----------------------------------------------------
  const removeTheme = useCallback(
    async (id: string, name: string) => {
      if (await confirm(themeDeleteConfirm(name))) deleteTheme(id);
    },
    [confirm, deleteTheme],
  );
  const saveTheme = useCallback(
    async (draft: CustomThemeDraft) => {
      if (!editingTheme) return;
      setSaving(true);
      try {
        if (await updateTheme(editingTheme.id, draft)) setEditingThemeId(null);
      } finally {
        setSaving(false);
      }
    },
    [editingTheme, updateTheme],
  );

  const menuFor = useCallback<TimelineEntityMenuFor>(
    (event) => {
      const { sourceType, eventType, snapshot } = event;

      if (sourceType === 'diagram') {
        // Only reached for a diagram the Explorer could NOT resolve (the
        // slots hook builds the full menu otherwise). The card click
        // opens it; the menu says so explicitly.
        const id = str(snapshot, 'diagramId');
        if (!id) return null;
        return {
          items: [
            {
              label: 'Open Diagram',
              icon: <DiagramIcon />,
              onClick: () => window.location.assign(`/diagram/${encodeURIComponent(id)}`),
            },
          ],
        };
      }

      if (sourceType === 'team') {
        if (eventType === 'team_invite_received') {
          const memberId = str(snapshot, 'memberId');
          const invite = memberId ? invites.find((i) => i.memberId === memberId) : undefined;
          const items: TimelineMenuItem[] = [
            { label: 'Open Invites', icon: <InviteIcon />, onClick: () => go({ kind: 'invites' }) },
          ];
          if (invite) {
            items.push(
              { label: 'Accept Invite', icon: <CheckIcon />, onClick: () => accept(invite) },
              {
                label: 'Decline Invite',
                icon: <CloseIcon size={11} strokeWidth={1.8} />,
                onClick: () => void declineInvite(invite),
                danger: true,
              },
            );
          }
          return { subject: invite?.team.name, items };
        }
        if (!TEAM_EVENTS.has(eventType)) return null;
        const teamId = str(snapshot, 'teamId');
        const team = teamId ? teams.find((t) => t.id === teamId) : undefined;
        if (!teamId || !team) return { items: [] };
        const items: TimelineMenuItem[] = [
          {
            label: 'Open Team',
            icon: <TeamIcon />,
            onClick: () => go({ kind: 'team', id: teamId }),
          },
        ];
        if (team.myRole === 'admin') {
          items.push({
            label: 'Edit Team',
            icon: <PencilIcon size={12} />,
            onClick: () => setEditingTeam(team),
          });
        }
        items.push({
          label: 'Leave Team',
          icon: <CloseIcon size={11} strokeWidth={1.8} />,
          onClick: () => void leaveTeam(team),
          danger: true,
        });
        if (team.myRole === 'admin') {
          items.push({
            label: 'Delete Team',
            icon: <TrashIcon size={12} />,
            onClick: () => void deleteTeam(team),
            danger: true,
          });
        }
        return { subject: team.name, items };
      }

      if (sourceType === 'account') {
        if (TOKEN_EVENTS.has(eventType)) {
          const items: TimelineMenuItem[] = [
            { label: 'Open Tokens', icon: <KeyIcon />, onClick: () => go({ kind: 'tokens' }) },
          ];
          const token = tokens.list?.find((t) => t.id === event.sourceId);
          if (token) {
            items.push({
              label: 'Revoke Token',
              icon: <TrashIcon size={12} />,
              onClick: () => void revokeToken(token.id),
              danger: true,
            });
          }
          return { subject: token?.name ?? undefined, items };
        }
        if (THEME_EVENTS.has(eventType)) {
          const items: TimelineMenuItem[] = [
            { label: 'Open Themes', icon: <PaletteIcon />, onClick: () => go({ kind: 'themes' }) },
          ];
          const theme = themes.find((t) => t.id === event.sourceId);
          if (theme) {
            items.push(
              {
                label: 'Edit Theme',
                icon: <PencilIcon size={12} />,
                onClick: () => setEditingThemeId(theme.id),
              },
              {
                label: 'Delete Theme',
                icon: <TrashIcon size={12} />,
                onClick: () => void removeTheme(theme.id, theme.name),
                danger: true,
              },
            );
          }
          return { subject: theme?.name, items };
        }
        if (eventType === 'image_uploaded') {
          return {
            items: [
              {
                label: 'Open Images',
                icon: <ImageIcon />,
                onClick: () => window.location.assign('/explorer/images'),
              },
            ],
          };
        }
      }
      return null;
    },
    [
      invites,
      teams,
      tokens.list,
      themes,
      go,
      accept,
      declineInvite,
      leaveTeam,
      deleteTeam,
      revokeToken,
      removeTheme,
    ],
  );

  const dialogs = useMemo(
    () => (
      <>
        <TeamFormModal
          open={editingTeam !== null}
          title="Edit Team"
          submitLabel="Save"
          initial={
            editingTeam
              ? { name: editingTeam.name, organisation: editingTeam.organisation }
              : undefined
          }
          onSubmit={(values) => void submitTeamEdit(values)}
          onCancel={() => setEditingTeam(null)}
        />
        {editingTheme ? (
          <ThemeBuilderModal
            title="Edit Theme"
            initial={{ name: editingTheme.name, definition: editingTheme.definition }}
            saving={saving}
            onSave={(draft) => void saveTheme(draft)}
            onClose={() => setEditingThemeId(null)}
          />
        ) : null}
      </>
    ),
    [editingTeam, editingTheme, saving, submitTeamEdit, saveTheme],
  );

  return { menuFor, dialogs };
}
