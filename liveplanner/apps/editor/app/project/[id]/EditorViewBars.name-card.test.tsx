// @vitest-environment jsdom
// Work Tracker 1522: a guest's Change Name opens the name card over the canvas and nothing more. With the card open
// (the state's `identityOnlyScreenOpen`, and `anyWelcomeOpen`, which only holds the tours) the header keeps Share or
// Make a Copy and the tab bar stays, as with the card closed.
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderEditorHeader, renderEditorTabBar } from './EditorViewBars';

vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

type Ctx = Parameters<typeof renderEditorHeader>[0];

const ctxWith = (over: Record<string, unknown>): Ctx =>
  ({
    zenMode: false,
    appChrome: true,
    embedMode: false,
    hydrated: true,
    projectId: 'p1',
    projectName: 'Roadmap',
    projectShareable: true,
    projectTeamId: null,
    sessionCommunity: null,
    copying: false,
    workbench: null,
    makeCopy: () => {},
    openSettingsOn: () => {},
    setShareDialogOpen: () => {},
    tabs: [],
    activeTab: { id: 't1', elements: [] },
    followMe: { followingId: null, followerCount: 0 },
    selfParticipant: { id: 'guest-1', name: 'Clever Marlin' },
    trackerImport: { canImport: false },
    ...over,
  }) as unknown as Ctx;

// The corner actions inside the header's error boundary.
function cornerProps(node: ReactNode): Record<string, unknown> {
  expect(isValidElement(node)).toBe(true);
  const child = (node as ReactElement<{ children: ReactElement<Record<string, unknown>> }>).props
    .children;
  return child.props;
}

const headerView = {
  isOffline: false,
  headerCommunity: false,
  onTakeOffline: undefined,
  visibilityActions: undefined,
} as Parameters<typeof renderEditorHeader>[1];

describe("a guest's name card", () => {
  for (const open of [false, true]) {
    it(`leaves the header and the tab bar as they are (card ${open ? 'open' : 'closed'})`, () => {
      const card = { identityOnlyScreenOpen: open, anyWelcomeOpen: open };
      // A visitor: Make a Copy rather than Share.
      const visitor = ctxWith({ ...card, canShareProject: false });
      expect(typeof cornerProps(renderEditorHeader(visitor, headerView)).onMakeCopy).toBe(
        'function',
      );
      expect(renderEditorTabBar(visitor, { selectTab: () => {}, barsShown: true })).not.toBeNull();
      // An Editor on a share link: Share.
      const editor = ctxWith({ ...card, canShareProject: true });
      expect(cornerProps(renderEditorHeader(editor, headerView)).showShare).toBe(true);
    });
  }
});
