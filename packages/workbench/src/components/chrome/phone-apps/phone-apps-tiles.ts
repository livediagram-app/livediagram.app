// Which tiles the phone's Apps drawer shows (liveworkspace/docs/specs/011-workbench/phone-apps-drawer.md "The Apps
// drawer"): only where the app and the viewer's role offer the action today, read from what the corner card would
// show (its published props), the item's call and the Inbox. No dead tiles.
import type { PhoneAppsSnapshot } from './phone-apps-store';

export type PhoneAppsTileId =
  | 'explorer'
  | 'call'
  | 'share'
  | 'present'
  | 'copy-link'
  | 'make-copy'
  | 'inbox';

export type PhoneAppsCall = { kind: 'start' | 'join'; people?: number } | null;

export type PhoneAppsTilesInput = {
  // The app keeps an Inbox (every app but livehuddle, which reads none: @liveworkspace/explorer inbox-apps).
  hasInbox: boolean;
  // The corner card's props on this phone; null where the app draws none (a page with no card).
  snapshot: PhoneAppsSnapshot | null;
  // The call's action (useItemCallAction): Start for an account that may, Join while one is live.
  call: PhoneAppsCall;
  signedIn: boolean;
};

/** The tiles, in the drawer's order. */
export function phoneAppsTiles({
  hasInbox,
  snapshot,
  call,
  signedIn,
}: PhoneAppsTilesInput): PhoneAppsTileId[] {
  const tiles: PhoneAppsTileId[] = ['explorer'];
  if (snapshot?.hasCall && call) tiles.push('call');
  // An app's own share action (liveplanner's Share Form) stands in for Share, as on the corner card.
  if (snapshot?.showShare && !snapshot.shareAction) tiles.push('share');
  if (snapshot?.present) tiles.push('present');
  if (snapshot && !snapshot.offline) tiles.push('copy-link');
  if (snapshot?.onMakeCopy) tiles.push('make-copy');
  if (signedIn && hasInbox) tiles.push('inbox');
  return tiles;
}

/** The Inbox's count as a badge says it. */
export const inboxBadgeWords = (count: number): string => (count > 99 ? '99+' : String(count));
