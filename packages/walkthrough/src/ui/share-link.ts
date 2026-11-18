import { workspaceOriginFor } from '@liveworkspace/sites';

/** A walkthrough's public link: liveworkspace.app's page for it (staging's from a staging app). */
export function walkthroughShareUrl(code: string, host = globalThis.location?.host ?? ''): string {
  return `${workspaceOriginFor(host)}/walkthrough?c=${code}`;
}

export const SHARE_TITLE = 'Share Walkthrough';
export const SHARE_DESCRIPTION =
  'Anyone with the link can watch this video, without signing in. They see its name and who made it, never the canvas.';
