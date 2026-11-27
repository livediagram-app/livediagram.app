// How to add the app to the Home Screen (liveworkspace/docs/specs/003-accounts/push.md "Settings"): iOS and iPadOS
// give a page Web Push only once it is there, and no page can add itself, so the Phone row's Add to Home Screen
// opens these steps, worded for this device and browser. Pure, so each wording is tested on its own.

export type HomeScreenDevice = 'iPad' | 'iPhone';
export type HomeScreenBrowser = 'Safari' | 'Chrome' | 'Firefox' | 'Edge' | 'other';
/** Where the browser keeps Share: the toolbar's top right, its bottom bar, or behind its menu. */
export type SharePlace = 'top' | 'bottom' | 'menu';

export type HomeScreenStep = { key: 'share' | 'add' | 'open'; title: string; detail: string };

export type HomeScreenGuide = {
  device: HomeScreenDevice;
  browser: HomeScreenBrowser;
  share: SharePlace;
  steps: HomeScreenStep[];
};

/** An iPad, including one that says it is a Mac (iPadOS 13 on asks for desktop sites); any other Apple phone or
 *  iPod reads as an iPhone. */
export function homeScreenDevice(userAgent: string, maxTouchPoints: number): HomeScreenDevice {
  return /iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
    ? 'iPad'
    : 'iPhone';
}

export function homeScreenBrowser(userAgent: string): HomeScreenBrowser {
  if (/CriOS\//.test(userAgent)) return 'Chrome';
  if (/FxiOS\//.test(userAgent)) return 'Firefox';
  if (/EdgiOS\//.test(userAgent)) return 'Edge';
  // Every iOS browser is WebKit, so only Safari carries Version/ and Safari/ with none of the others' marks.
  if (/Version\/[\d.]+.*Safari\//.test(userAgent)) return 'Safari';
  return 'other';
}

function sharePlace(device: HomeScreenDevice, browser: HomeScreenBrowser): SharePlace {
  if (browser === 'Chrome') return 'top';
  if (browser === 'Safari') return device === 'iPad' ? 'top' : 'bottom';
  return 'menu';
}

const SHARE_DETAIL: Record<SharePlace, (browser: HomeScreenBrowser) => string> = {
  top: (browser) =>
    browser === 'Chrome'
      ? 'The square with an arrow, at the right of Chrome’s address bar.'
      : 'The square with an arrow, at the top right beside the address bar. Not there? Tap ••• first.',
  bottom: () =>
    'The square with an arrow, in the bar at the bottom of the screen. Not there? Tap ••• first.',
  menu: (browser) =>
    `Open ${browser === 'other' ? 'your browser’s' : `${browser}’s`} menu (•••), then tap Share.`,
};

export function homeScreenGuide(userAgent: string, maxTouchPoints: number): HomeScreenGuide {
  const device = homeScreenDevice(userAgent, maxTouchPoints);
  const browser = homeScreenBrowser(userAgent);
  const share = sharePlace(device, browser);
  return {
    device,
    browser,
    share,
    steps: [
      { key: 'share', title: 'Tap Share', detail: SHARE_DETAIL[share](browser) },
      {
        key: 'add',
        title: 'Tap Add to Home Screen',
        detail: 'Scroll down the list to find it, or tap More if it’s hidden. Then tap Add.',
      },
      {
        key: 'open',
        title: 'Open it from your Home Screen',
        detail: `Tap the new icon on your ${device}’s Home Screen, sign in if asked, and turn these on in Settings, Notifications.`,
      },
    ],
  };
}

/** This browser's guide, read when the steps open (from a press, so always in a browser). */
export function thisBrowserGuide(): HomeScreenGuide {
  return homeScreenGuide(navigator.userAgent, navigator.maxTouchPoints);
}
