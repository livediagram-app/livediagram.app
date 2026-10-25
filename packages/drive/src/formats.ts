// The file each app's item becomes in Google Drive (liveworkspace/docs/drive.md "The file"): one place for the
// envelope kind, the MIME type and the extension, so the service and every app's export and import doors agree.
import type { AppSiteId } from '@liveworkspace/sites';

export type AppFileFormat = {
  // The app's name, as `@liveworkspace/sites` names it.
  app: AppName;
  // The envelope's `kind`.
  kind: string;
  mimeType: string;
  extension: string;
};

export type AppName = 'livediagram' | 'liveplanner' | 'livedocuments' | 'livedesign';

export const APP_FILE_FORMATS: Record<AppName, AppFileFormat> = {
  livediagram: {
    app: 'livediagram',
    kind: 'livediagram.document',
    mimeType: 'application/vnd.livediagram+json',
    extension: '.livediagram',
  },
  liveplanner: {
    app: 'liveplanner',
    kind: 'liveplanner.project',
    mimeType: 'application/vnd.liveplanner+json',
    extension: '.liveplanner',
  },
  livedocuments: {
    app: 'livedocuments',
    kind: 'livedocuments.document',
    mimeType: 'application/vnd.livedocuments+json',
    extension: '.livedocuments',
  },
  livedesign: {
    app: 'livedesign',
    kind: 'livedesign.design',
    mimeType: 'application/vnd.livedesign+json',
    extension: '.livedesign',
  },
};

export const APP_NAMES = Object.keys(APP_FILE_FORMATS) as AppName[];

export const isAppName = (value: unknown): value is AppName =>
  typeof value === 'string' && Object.hasOwn(APP_FILE_FORMATS, value);

/** The app a site belongs to: `liveplanner.app` → `liveplanner`. */
export const appNameOfSite = (site: AppSiteId): AppName => site.replace(/\.app$/, '') as AppName;

/** The format whose MIME type this is, or null. */
export function formatOfMime(mimeType: string): AppFileFormat | null {
  return Object.values(APP_FILE_FORMATS).find((f) => f.mimeType === mimeType) ?? null;
}

/** The format whose envelope `kind` this is, or null. */
export function formatOfKind(kind: unknown): AppFileFormat | null {
  return Object.values(APP_FILE_FORMATS).find((f) => f.kind === kind) ?? null;
}

/** The Drive file name for an item: its name plus its app's extension. */
export const driveFileName = (app: AppName, name: string) => `${name}${APP_FILE_FORMATS[app].extension}`;

/** The item name a Drive file name stands for: any app's extension dropped, trimmed, cut to `max`. Null when
 *  nothing is left, so an empty rename in Drive keeps the old name. */
export function stripDriveName(driveName: string, max = Number.POSITIVE_INFINITY): string | null {
  let name = driveName.trim();
  const lower = name.toLowerCase();
  for (const f of Object.values(APP_FILE_FORMATS)) {
    if (lower.endsWith(f.extension)) {
      name = name.slice(0, -f.extension.length);
      break;
    }
  }
  name = name.trim();
  return name.length === 0 ? null : name.slice(0, max);
}
