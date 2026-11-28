// @vitest-environment jsdom
// Work Tracker 1522: a guest's Change Name opens the name card over the canvas and nothing more. With the card open
// (the state's `identityOnlyScreenOpen`, and `anyWelcomeOpen`, which only holds the tours) the header keeps Share or
// Make a Copy and the tab bar stays, as with the card closed.
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { editorViewFooter, editorViewHeader } from './editor-view-bars';

vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

type Ctx = Parameters<typeof editorViewHeader>[0];

const ctxWith = (over: Record<string, unknown>): Ctx =>
  ({
    zenMode: false,
    appChrome: true,
    embedMode: false,
    hydrated: true,
    documentId: 'd1',
    documentName: 'Map',
    documentShareable: true,
    documentTeamId: null,
    sessionCommunity: null,
    copying: false,
    workbench: null,
    slideDeck: { runnable: [], startingDeck: false, start: () => {} },
    makeCopy: () => {},
    openSettingsOn: () => {},
    setShareDialogOpen: () => {},
    tabs: [],
    activeTab: { id: 't1', elements: [] },
    followMe: { followingId: null, followerCount: 0 },
    selfParticipant: { id: 'guest-1', name: 'Clever Marlin' },
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
  isMobileViewport: false,
  landscapeShown: true,
} as unknown as Parameters<typeof editorViewHeader>[1];
const footerView = {
  isOffline: false,
  selectTab: () => {},
  landscapeShown: true,
} as unknown as Parameters<typeof editorViewFooter>[1];

describe("a guest's name card", () => {
  for (const open of [false, true]) {
    it(`leaves the header and the tab bar as they are (card ${open ? 'open' : 'closed'})`, () => {
      const card = { identityOnlyScreenOpen: open, anyWelcomeOpen: open };
      // A visitor: Make a Copy rather than Share.
      const visitor = ctxWith({ ...card, canShareDocument: false });
      expect(typeof cornerProps(editorViewHeader(visitor, headerView)).onMakeCopy).toBe('function');
      expect(editorViewFooter(visitor, footerView)).not.toBeNull();
      // An Editor on a share link: Share.
      const editor = ctxWith({ ...card, canShareDocument: true });
      expect(cornerProps(editorViewHeader(editor, headerView)).showShare).toBe(true);
    });
  }
});
