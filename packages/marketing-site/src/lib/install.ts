// What makes a site installable and able to show phone notifications (liveworkspace/docs/specs/003-accounts/push.md
// "The app side"; each app's docs/specs/016-platform/installable-app.md): its web app manifest and its push-only
// service worker, built once for every app's marketing site and liveworkspace.app. Each serves them at its root, so
// they cover the editor, the Explorer and every page on the address.
import { PUSH_WORKER_PATH } from '@liveworkspace/settings/push';

// Where an installed app opens: the Explorer, the person's work across every app, never the marketing page.
export const INSTALLED_START_URL = '/explorer';

export type InstallIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: 'any' | 'maskable';
};

/** A site's manifest (Next's `app/manifest.ts` returns it). Its `id` stays `/`, what installs made before the start
 *  page moved to the Explorer were keyed by, so they stay the same app. */
export function installManifest({
  name,
  description,
  themeColor,
  icons,
}: {
  name: string;
  description: string;
  themeColor: string;
  icons: readonly InstallIcon[];
}) {
  return {
    id: '/',
    name,
    short_name: name,
    description,
    start_url: INSTALLED_START_URL,
    scope: '/',
    display: 'standalone' as const,
    theme_color: themeColor,
    background_color: '#ffffff',
    icons: icons.map((icon) => ({ purpose: 'any' as const, ...icon })),
  };
}

/** The usual icons of an app's marketing site: its scalable mark and the two PNGs in its public folder. */
export function appIcons(app: string): InstallIcon[] {
  return [
    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    { src: `/${app}-icon-256.png`, sizes: '256x256', type: 'image/png' },
    { src: `/${app}-icon-512.png`, sizes: '512x512', type: 'image/png' },
  ];
}

/**
 * The push-only service worker's source. It never answers a request (no fetch listener, so nothing is cached and the
 * editor still can't start offline, as each app's load-recovery.md says) and only:
 *   - shows each push as a notification: its title, the app's name, the site's icon, its tag;
 *   - on a tap, focuses a window already at the link, or opens the link, on whichever app's address it is.
 * A link that isn't http(s) is dropped.
 */
export function pushWorkerSource(icon: string): string {
  return `// The push-only service worker (liveworkspace/docs/specs/003-accounts/push.md). No fetch handler.
'use strict';
var ICON = ${JSON.stringify(icon)};
function linkOf(value) {
  try {
    var url = new URL(String(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch (e) {
    return null;
  }
}
self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('push', function (event) {
  var message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch (e) {
    message = {};
  }
  var title = typeof message.title === 'string' && message.title ? message.title : 'liveworkspace';
  var options = {
    body: typeof message.body === 'string' ? message.body : '',
    icon: ICON,
    badge: ICON,
    data: { url: linkOf(message.url) }
  };
  if (typeof message.tag === 'string' && message.tag) {
    options.tag = message.tag;
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = event.notification.data && event.notification.data.url;
  if (!url) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        if (windows[i].url === url && 'focus' in windows[i]) return windows[i].focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
`;
}

/** The worker as a site's `app/push-worker.js/route.ts` answers it (built once, at export). */
export function pushWorkerResponse(icon: string): Response {
  return new Response(pushWorkerSource(icon), {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      // A browser checks a service worker for updates on its own; this keeps a stale copy from lingering past a day.
      'cache-control': 'public, max-age=0, must-revalidate',
    },
  });
}

export { PUSH_WORKER_PATH };
