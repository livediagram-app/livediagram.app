// The Phone section's words (liveworkspace/docs/specs/003-accounts/push.md "Settings"), apart from the row so each
// state's wording is tested on its own.
import type { PhoneSupport } from './browser-push';

/** Where the row stands: reading, this browser's device on, one of the browser's own states, phone notifications
 *  off on this deployment, or the account unreachable. */
export type PhoneState = 'loading' | 'on' | PhoneSupport | 'off-here' | 'unreachable';

export const PHONE_ROW_LABEL = 'Phone Notifications';
export const PHONE_ROW_DESCRIPTION =
  'A notification on this device for a mention, an assignment, a reply or a comment, from every app.';
export const PHONE_KEYWORDS =
  'phone push mobile notification notify device iphone android install home screen app';

// How the status reads: on (`good`), needing something (`warn`), or plain.
type StateCopy = { description: string; status?: string; warn?: boolean; good?: boolean };

export const phoneCopy = {
  state(state: PhoneState): StateCopy {
    switch (state) {
      case 'loading':
        return { description: PHONE_ROW_DESCRIPTION };
      case 'ready':
        return {
          description: `${PHONE_ROW_DESCRIPTION} One device is enough: every app’s notifications reach it. Your browser asks first.`,
        };
      case 'on':
        return {
          description:
            'This device gets a notification when someone mentions you, assigns you an action, replies in your thread or comments on your work. Tap one to open it.',
          status: 'On',
          good: true,
        };
      case 'needs-install':
        return {
          description:
            'On iPhone and iPad, add this app to your Home Screen first: tap Share, then Add to Home Screen, and open it from there to turn these on.',
          status: 'Add to Home Screen',
          warn: true,
        };
      case 'blocked':
        return {
          description:
            'Notifications are blocked for this site. Allow them in your browser’s site settings, then come back here.',
          status: 'Blocked',
          warn: true,
        };
      case 'unsupported':
        return {
          description:
            'This browser can’t show notifications from a website. Try another browser, or your phone.',
          status: 'Not Available',
        };
      case 'off-here':
        return {
          description: 'Phone notifications aren’t set up on this server.',
          status: 'Not Available',
        };
      case 'unreachable':
        return {
          description: 'Couldn’t reach your account to read your devices.',
          warn: true,
        };
    }
  },
  subscribeFailed: (reason: 'dismissed' | 'failed') =>
    reason === 'dismissed'
      ? 'Your browser didn’t give permission. Press Turn On to be asked again.'
      : 'Couldn’t turn on notifications in this browser. Try again in a moment.',
  registerFailed: 'Couldn’t save this device to your account. Try again in a moment.',
  removeFailed: 'Couldn’t remove that device just now. Try again in a moment.',
  removeMessage: (label: string, thisOne: boolean) =>
    thisOne
      ? `${label} stops getting phone notifications from every app. You can turn them on again here.`
      : `${label} stops getting phone notifications from every app. Turn them on from that device to add it back.`,
};
