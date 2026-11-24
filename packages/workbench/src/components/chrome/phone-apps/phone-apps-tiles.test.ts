// The Apps drawer's tiles per role and app (liveworkspace/docs/specs/011-workbench/phone-apps-drawer.md "The Apps
// drawer", "Share roles"): what the corner card would have shown this person, and nothing it would not.
import { describe, expect, it } from 'vitest';
import type { PhoneAppsSnapshot } from './phone-apps-store';
import { inboxBadgeWords, phoneAppsTiles } from './phone-apps-tiles';

const base: PhoneAppsSnapshot = {
  itemName: 'Offsite Planning',
  shareWords: 'Shared',
  showShare: false,
  onOpenShare: () => {},
  copying: false,
  hasCall: true,
  offline: false,
};

// An Editor who may share, signed in, in an app with an Inbox, a deck to present.
const editor: PhoneAppsSnapshot = {
  ...base,
  showShare: true,
  present: { slideCount: 3, starting: false, onPresent: () => {} },
  onOpenAccount: () => {},
};
// A Participant or Viewer on a share link: no Share, Make a Copy instead.
const visitor: PhoneAppsSnapshot = { ...base, onMakeCopy: () => {} };

describe('phoneAppsTiles', () => {
  it('gives an Editor every tile the corner card had, in order', () => {
    expect(
      phoneAppsTiles({
        snapshot: editor,
        call: { kind: 'start' },
        signedIn: true,
        hasInbox: true,
      }),
    ).toEqual(['explorer', 'call', 'share', 'present', 'copy-link', 'inbox']);
  });

  it('gives a signed-in visitor Make a Copy and no Share, and Call only to join a live one', () => {
    expect(
      phoneAppsTiles({ snapshot: visitor, call: null, signedIn: true, hasInbox: true }),
    ).toEqual(['explorer', 'copy-link', 'make-copy', 'inbox']);
    expect(
      phoneAppsTiles({ snapshot: visitor, call: { kind: 'join' }, signedIn: true, hasInbox: true }),
    ).toEqual(['explorer', 'call', 'copy-link', 'make-copy', 'inbox']);
  });

  it('gives a guest no Inbox', () => {
    expect(
      phoneAppsTiles({ snapshot: visitor, call: null, signedIn: false, hasInbox: true }),
    ).toEqual(['explorer', 'copy-link', 'make-copy']);
  });

  it('shows no Inbox in an app without one (livehuddle)', () => {
    expect(
      phoneAppsTiles({ snapshot: editor, call: null, signedIn: true, hasInbox: false }),
    ).not.toContain('inbox');
  });

  it('shows no Call where the app has none, even with a call to start', () => {
    expect(
      phoneAppsTiles({
        snapshot: { ...editor, hasCall: false },
        call: { kind: 'start' },
        signedIn: true,
        hasInbox: true,
      }),
    ).not.toContain('call');
  });

  it('leaves Share to an app’s own share action (liveplanner’s Share Form)', () => {
    expect(
      phoneAppsTiles({
        snapshot: { ...editor, shareAction: 'Share Form' },
        call: null,
        signedIn: true,
        hasInbox: true,
      }),
    ).not.toContain('share');
  });

  it('has no Copy Link for an Offline item, whose address opens nowhere else', () => {
    expect(
      phoneAppsTiles({
        snapshot: { ...editor, offline: true },
        call: null,
        signedIn: true,
        hasInbox: true,
      }),
    ).not.toContain('copy-link');
  });

  it('has Explorer alone (and the Inbox) with no corner card on the page', () => {
    expect(phoneAppsTiles({ snapshot: null, call: null, signedIn: true, hasInbox: true })).toEqual([
      'explorer',
      'inbox',
    ]);
  });

  it('caps the Inbox’s count at 99+', () => {
    expect(inboxBadgeWords(3)).toBe('3');
    expect(inboxBadgeWords(99)).toBe('99');
    expect(inboxBadgeWords(140)).toBe('99+');
  });
});
