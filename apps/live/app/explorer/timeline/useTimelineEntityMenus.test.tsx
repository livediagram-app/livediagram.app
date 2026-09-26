// @vitest-environment jsdom

// What a card's ⋯ menu offers for the thing it's about (docs/specs/013-workspace/timeline.md §2.8):
// the Explorer's own verbs for tokens, teams, invites and themes, and
// only the "open the section" row when the Explorer can't resolve the
// entity any more.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { TimelineEvent } from '@livediagram/ui';
import { ExplorerProvider } from '../ExplorerContext';
import type { ExplorerStateValue } from '../useExplorerState';
import { useTimelineEntityMenus } from './useTimelineEntityMenus';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiDeleteTeam: vi.fn(),
  apiGetTeam: vi.fn(),
  apiRemoveTeamMember: vi.fn(),
  apiUpdateTeam: vi.fn(),
}));
const themes = vi.hoisted(() => ({
  themes: [{ id: 'th1', name: 'Dusk', definition: {} }],
  updateTheme: vi.fn(),
  deleteTheme: vi.fn(),
  createTheme: vi.fn(),
  loading: false,
}));
vi.mock('@/components/primitives/CustomThemeProvider', () => ({
  useCustomThemes: () => themes,
}));

const revoke = vi.fn();
const go = vi.fn();
const acceptInvite = vi.fn(async () => 't1');
const declineInvite = vi.fn(async () => {});

function explorer(over: Partial<ExplorerStateValue> = {}): ExplorerStateValue {
  return {
    ownerId: 'me',
    clerkUserId: 'me',
    go,
    tokens: { list: [{ id: 'tok1', name: 'CI' }], revoke },
    teams: [
      { id: 't1', name: 'Guild', organisation: null, myRole: 'admin' },
      { id: 't2', name: 'Ops', organisation: null, myRole: 'member' },
    ],
    invites: [{ memberId: 'm1', team: { id: 't3', name: 'Newcomers' }, memberCount: 2 }],
    acceptInvite,
    declineInvite,
    refreshTeams: vi.fn(),
    ...over,
  } as unknown as ExplorerStateValue;
}

function event(over: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: 'e',
    sourceType: 'account',
    sourceId: 'x',
    eventType: 'token_created',
    title: 'API Token Created',
    description: null,
    occurredAt: 1,
    actorId: 'me',
    snapshot: {},
    ...over,
  } as TimelineEvent;
}

function menuFor(value = explorer()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ExplorerProvider value={value}>{children}</ExplorerProvider>
  );
  return renderHook(() => useTimelineEntityMenus(), { wrapper }).result.current.menuFor;
}

const labels = (m: ReturnType<ReturnType<typeof menuFor>>) => m?.items.map((i) => i.label);

describe('useTimelineEntityMenus', () => {
  it('offers Revoke on a token the Explorer still holds, and only Open Tokens on one it does not', () => {
    const m = menuFor();
    const live = m(event({ sourceId: 'tok1', snapshot: { tokenName: 'CI' } }));
    expect(labels(live)).toEqual(['Open Tokens', 'Revoke Token']);
    expect(live?.subject).toBe('CI');
    expect(live?.items[1]?.danger).toBe(true);
    const gone = m(event({ sourceId: 'tok-old', eventType: 'token_revoked' }));
    expect(labels(gone)).toEqual(['Open Tokens']);
  });

  it('gives an admin Edit and Delete on their team, a member only Leave', () => {
    const m = menuFor();
    const admin = m(
      event({ sourceType: 'team', eventType: 'team_renamed', snapshot: { teamId: 't1' } }),
    );
    expect(labels(admin)).toEqual(['Open Team', 'Edit Team', 'Leave Team', 'Delete Team']);
    expect(admin?.subject).toBe('Guild');
    const member = m(
      event({ sourceType: 'team', eventType: 'team_member_joined', snapshot: { teamId: 't2' } }),
    );
    expect(labels(member)).toEqual(['Open Team', 'Leave Team']);
    // A team the reader has since left: nothing to act on.
    const left = m(
      event({ sourceType: 'team', eventType: 'team_member_left', snapshot: { teamId: 't9' } }),
    );
    expect(labels(left)).toEqual([]);
  });

  it('offers Accept and Decline on a pending invite, and routes an accept to the team', async () => {
    const m = menuFor();
    const pending = m(
      event({
        sourceType: 'team',
        eventType: 'team_invite_received',
        snapshot: { teamId: 't3', memberId: 'm1' },
      }),
    );
    expect(labels(pending)).toEqual(['Open Invites', 'Accept Invite', 'Decline Invite']);
    expect(pending?.subject).toBe('Newcomers');
    pending!.items[1]!.onClick();
    await Promise.resolve();
    await Promise.resolve();
    expect(acceptInvite).toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith({ kind: 'team', id: 't1' });
    const answered = m(
      event({
        sourceType: 'team',
        eventType: 'team_invite_received',
        snapshot: { teamId: 't3', memberId: 'm-old' },
      }),
    );
    expect(labels(answered)).toEqual(['Open Invites']);
  });

  it('offers Edit and Delete on a theme the reader still has', () => {
    const m = menuFor();
    const live = m(event({ sourceId: 'th1', eventType: 'theme_saved' }));
    expect(labels(live)).toEqual(['Open Themes', 'Edit Theme', 'Delete Theme']);
    expect(live?.subject).toBe('Dusk');
    const gone = m(event({ sourceId: 'th1:deleted', eventType: 'theme_deleted' }));
    expect(labels(gone)).toEqual(['Open Themes']);
  });

  it('opens an unresolved diagram, and returns nothing for a folder tombstone', () => {
    const m = menuFor();
    expect(
      labels(
        m(
          event({
            sourceType: 'diagram',
            eventType: 'diagram_renamed',
            snapshot: { diagramId: 'd9' },
          }),
        ),
      ),
    ).toEqual(['Open Diagram']);
    expect(m(event({ eventType: 'folder_deleted', snapshot: { folderName: 'Gone' } }))).toBeNull();
  });
});
