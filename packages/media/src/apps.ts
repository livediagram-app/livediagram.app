// The apps that keep their pictures in liveworkspace's media service (liveworkspace/docs/specs/006-media/media.md).
// One service holds every app's uploads, so a person's gallery follows them from app to app. Each
// request names the app it comes from, by its public site, the way people know it.

import type { SiteId } from '@liveworkspace/sites';

export const MEDIA_APPS = [
  'livediagram.app',
  'liveplanner.app',
  'livedocuments.app',
  'livedesign.app',
] as const satisfies readonly Exclude<SiteId, 'liveworkspace.app'>[];

export type MediaApp = (typeof MEDIA_APPS)[number];

export function isMediaApp(value: unknown): value is MediaApp {
  return typeof value === 'string' && (MEDIA_APPS as readonly string[]).includes(value);
}
