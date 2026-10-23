// @vitest-environment jsdom

// What a card's ⋯ menu offers for the thing it's about (docs/specs/013-workspace/timeline.md §2.8):
// the Explorer's own verbs for themes, a link to liveworkspace.app for teams and tokens (run there),
// and only the "open the section" row when the Explorer can't resolve the entity any more.

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { TimelineEvent } from '@livediagram/ui';
import { ExplorerProvider } from '../ExplorerContext';
import type { ExplorerStateValue } from '../useExplorerState';
import { useTimelineEntityMenus } from './useTimelineEntityMenus';
import { OPEN_SETTINGS_EVENT } from '@/lib/open-settings';

const assign = vi.hoisted(() => vi.fn());
vi.mock('@/lib/app-location', () => ({ assignAppLocation: assign }));
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

const go = vi.fn();

function explorer(over: Partial<ExplorerStateValue> = {}): ExplorerStateValue {
  return {
    go,
    teams: [
      { id: 't1', name: 'Guild', organisation: null, myRole: 'admin' },
      { id: 't2', name: 'Ops', organisation: null, myRole: 'member' },
    ],
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
  };
}

function menuFor(value = explorer()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ExplorerProvider value={value}>{children}</ExplorerProvider>
  );
  return renderHook(() => useTimelineEntityMenus(), { wrapper }).result.current.menuFor;
}

const labels = (m: ReturnType<ReturnType<typeof menuFor>>) => m?.items.map((i) => i.label);

describe('useTimelineEntityMenus', () => {
  it('opens API Tokens in Settings and links to liveworkspace.app, where tokens are run', () => {
    const m = menuFor();
    const created = m(event({ sourceId: 'tok1', snapshot: { tokenName: 'CI' } }));
    expect(labels(created)).toEqual(['Open API Tokens', 'Manage API Tokens']);
    created?.items[1]?.onClick();
    expect(assign).toHaveBeenCalledWith('https://liveworkspace.app/account/tokens');
    const revoked = m(event({ sourceId: 'tok-old', eventType: 'token_revoked' }));
    expect(labels(revoked)).toEqual(['Open API Tokens', 'Manage API Tokens']);
  });

  it('opens Settings on API Tokens in place rather than navigating', () => {
    const heard = vi.fn<(detail: string) => void>();
    const onOpen = (e: Event) => heard((e as CustomEvent<string>).detail);
    window.addEventListener(OPEN_SETTINGS_EVENT, onOpen);
    menuFor()(event({ sourceId: 'tok1' }))?.items[0]?.onClick();
    window.removeEventListener(OPEN_SETTINGS_EVENT, onOpen);
    expect(heard).toHaveBeenCalledWith('tokens');
    expect(go).not.toHaveBeenCalled();
  });

  it('opens a team the reader is in and links to liveworkspace.app to manage it', () => {
    const m = menuFor();
    const admin = m(
      event({ sourceType: 'team', eventType: 'team_renamed', snapshot: { teamId: 't1' } }),
    );
    expect(labels(admin)).toEqual(['Open Team', 'Manage Team']);
    expect(admin?.subject).toBe('Guild');
    admin?.items[1]?.onClick();
    expect(assign).toHaveBeenCalledWith('https://liveworkspace.app/account/teams');
    const member = m(
      event({ sourceType: 'team', eventType: 'team_member_joined', snapshot: { teamId: 't2' } }),
    );
    expect(labels(member)).toEqual(['Open Team', 'Manage Team']);
    // A team the reader has since left: nothing to act on.
    const left = m(
      event({ sourceType: 'team', eventType: 'team_member_left', snapshot: { teamId: 't9' } }),
    );
    expect(labels(left)).toEqual([]);
  });

  it('opens Invites for an invite, which are answered on liveworkspace.app', () => {
    const invite = menuFor()(
      event({
        sourceType: 'team',
        eventType: 'team_invite_received',
        snapshot: { teamId: 't3', memberId: 'm1' },
      }),
    );
    expect(labels(invite)).toEqual(['Open Invites']);
    invite?.items[0]?.onClick();
    expect(go).toHaveBeenCalledWith({ kind: 'invites' });
  });

  it('offers Edit and Delete on a theme the reader still has', () => {
    const m = menuFor();
    const live = m(event({ sourceId: 'th1', eventType: 'theme_saved' }));
    expect(labels(live)).toEqual(['Open Themes', 'Edit Theme', 'Delete Theme']);
    expect(live?.subject).toBe('Dusk');
    const gone = m(event({ sourceId: 'th1:deleted', eventType: 'theme_deleted' }));
    expect(labels(gone)).toEqual(['Open Themes']);
  });

  it('opens an unresolved document, and returns nothing for a folder tombstone', () => {
    const m = menuFor();
    expect(
      labels(
        m(
          event({
            sourceType: 'document',
            eventType: 'document_renamed',
            snapshot: { documentId: 'd9' },
          }),
        ),
      ),
    ).toEqual(['Open Document']);
    expect(m(event({ eventType: 'folder_deleted', snapshot: { folderName: 'Gone' } }))).toBeNull();
  });
});
